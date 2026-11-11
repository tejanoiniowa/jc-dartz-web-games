// x01.js — 301 / 501 / 701 / 901
'use strict';

(() => {
  const X01 = {
    id: 'x01', name: '01 GAMES', bestOf: true, teams: true, maxPlayers: 8,
    options: [
      { key: 'start', label: 'GAME', def: 501, values: [[301, '301'], [501, '501'], [701, '701'], [901, '901']] },
      { key: 'in', label: 'IN', def: 'open', values: [['open', 'OPEN IN'], ['double', 'DOUBLE IN']] },
      { key: 'out', label: 'OUT', def: 'double', values: [['open', 'OPEN OUT'], ['double', 'DOUBLE OUT'], ['master', 'MASTER OUT']] },
      { key: 'bull', label: 'BULL', def: 'split', values: [['split', '25 / 50'], ['fat', 'ANY BULL 50']] },
      { key: 'rounds', label: 'ROUND LIMIT', def: 0, values: [[0, 'NONE'], [10, '10'], [15, '15'], [20, '20'], [25, '25']] },
    ],
    title(o) {
      const t = [String(o.start)];
      if (o.in === 'double') t.push('DI');
      if (o.out === 'double') t.push('DO'); else if (o.out === 'master') t.push('MO');
      if (o.bull === 'fat') t.push('FAT BULL');
      return t.join(' · ');
    },

    value(c, d) { return d.num === 25 && c.opts.bull === 'fat' ? 50 : d.value; },

    init(c) {
      c.sides.forEach(s => { s.data = { score: c.opts.start, open: c.opts.in !== 'double', turnStart: c.opts.start, openAtStart: false, bust: false, turnPts: 0 }; });
    },
    turnBegin(c) {
      const d = c.side.data;
      d.turnStart = d.score; d.openAtStart = d.open; d.bust = false; d.turnPts = 0;
    },

    dart(c, dart) {
      const sd = c.side.data, o = c.opts;
      if (!dart.num) return {};
      if (!sd.open) {
        if (dart.mult === 2) sd.open = true;      // double in (double bull counts)
        else return { note: 'DOUBLE IN' };
      }
      const v = this.value(c, dart);
      const left = sd.score - v;
      const isDouble = dart.mult === 2 || (dart.num === 25 && o.bull === 'fat' && dart.mult === 2);
      const okFinish = o.out === 'open' || (o.out === 'double' && isDouble) || (o.out === 'master' && dart.mult >= 2);
      const minLeft = o.out === 'open' ? 0 : 2;
      if (left < 0 || (left === 0 && !okFinish) || (left > 0 && left < minLeft)) {
        // bust: back to where the turn started
        c.thrower.stats.points -= sd.turnPts;
        sd.score = sd.turnStart; sd.open = sd.openAtStart; sd.bust = true; sd.turnPts = 0;
        return { bust: true, say: ['bust', 'Bust'] };
      }
      sd.score = left; sd.turnPts += v;
      c.thrower.stats.points += v;
      if (left === 0) {
        const out = sd.turnPts;
        c.thrower.stats.bestOut = Math.max(c.thrower.stats.bestOut || 0, out);
        c.thrower.stats.legsWon = (c.thrower.stats.legsWon || 0) + 1;
        return { win: true };
      }
      return {};
    },

    turnEnd(c) {
      const sd = c.side.data, st = c.thrower.stats;
      if (sd.bust) return null;
      const t = sd.turnPts, ds = c.darts.filter(d => !d.filler);
      if (t === 180) { st.ton80s = (st.ton80s || 0) + 1; st.tons = (st.tons || 0) + 1; return { big: 'TON 80', say: ['ton80', 'One hundred and eighty!'] }; }
      if (ds.length === 3 && ds.every(d => d.num === 25)) return { big: 'HAT TRICK', say: ['hat_trick', 'Hat trick!'] };
      if (ds.length === 3 && ds.every(d => d.mult === 3 && d.num === ds[0].num)) return { big: 'THREE IN A BED', say: ['three_in_a_bed', 'Three in a bed!'] };
      if (t >= 151) { st.tons = (st.tons || 0) + 1; return { big: 'HIGH TON', sub: t + ' POINTS', say: ['high_ton', 'High ton!'] }; }
      if (t >= 100) { st.tons = (st.tons || 0) + 1; return { big: 'LOW TON', sub: t + ' POINTS', say: ['low_ton', 'Low ton!'] }; }
      return null;
    },

    roundLimit(S) { return S.opts.rounds || 0; },
    // Round limit ran out: lowest score wins, ties go to the better points per dart
    limitWinner(S) {
      const ppd = s => { let p = 0, d = 0; s.members.forEach(m => { p += S.entrants[m].stats.points; d += S.entrants[m].stats.darts; }); return d ? p / d : 0; };
      let best = 0;
      S.sides.forEach((s, i) => {
        const b = S.sides[best];
        if (s.data.score < b.data.score || (s.data.score === b.data.score && ppd(s) > ppd(b))) best = i;
      });
      return best;
    },

    // What the screen shows
    big(c) { return c.side.data.score; },
    bust(c) { return c.side.data.bust; },
    box(side) { return { sc: side.data.score, sub: side.data.open ? '' : 'NOT IN' }; },
    turnTotal(c) { return c.side.data.bust ? 'BUST' : c.side.data.turnPts; },
    upNext(side) { return side.data.score + ' TO GO'; },
    hint(c) {
      const sd = c.side.data, left = 3 - c.darts.length;
      if (!sd.open) return { label: 'HIT A DOUBLE TO START' };
      if (sd.bust || left <= 0) return null;
      const r = Segs.checkoutRoute(sd.score, left, c.opts.out, c.opts.bull === 'fat');
      return r ? { label: 'CHECKOUT', route: r } : null;
    },
    aimLights(c) {
      const h = this.hint(c);
      if (h && h.route) { const n = Segs.parseSeg(h.route[0]).num; if (n && n <= 20) { Board.Lights.targets([n], 'green'); return; } }
      Board.Lights.turn(c.side.rgb);
    },

    // Computer: go for the checkout when there is one, else T20 (T19 to fix odd scores near the end)
    cpuAim(c) {
      const sd = c.side.data, left = 3 - c.darts.length;
      if (!sd.open) return 'D20';
      const r = Segs.checkoutRoute(sd.score, left, c.opts.out, c.opts.bull === 'fat');
      if (r) return r[0].replace(/[IO]$/, '');
      if (c.opts.out !== 'open' && sd.score <= 60) {
        // leave a double
        for (const n of [16, 20, 8, 18, 12, 10, 4, 2]) { const need = sd.score - n * 2; if (need >= 1 && need <= 20) return 'S' + need; }
      }
      if (sd.score < 60) return sd.score > 20 ? 'S20' : 'S' + Math.max(1, sd.score - (c.opts.out === 'open' ? 0 : 2));
      return 'T20';
    },

    saveStats(S) {
      S.entrants.forEach(e => {
        if (e.kind !== 'player') return;
        const p = Store.get(e.id); if (!p) return;
        const x = p.stats.x01 = Object.assign({ games: 0, wins: 0, legs: 0, legsWon: 0, darts: 0, points: 0, tons: 0, ton80s: 0, bestOut: 0, history: [] }, p.stats.x01);
        const st = e.stats, won = S.winner >= 0 && S.sides[S.winner].members.includes(e.idx);
        x.games++; if (won) x.wins++;
        x.legs += S.leg; x.legsWon += st.legsWon || 0;
        x.darts += st.darts; x.points += st.points;
        x.tons += st.tons || 0; x.ton80s += st.ton80s || 0;
        x.bestOut = Math.max(x.bestOut, st.bestOut || 0);
        x.history.push({ at: Date.now(), ppd: st.darts ? +(st.points / st.darts).toFixed(2) : 0, win: won, g: S.opts.start });
        if (x.history.length > 50) x.history.splice(0, x.history.length - 50);
      });
    },
    // Players & stats screen
    statKey: 'x01', statName: '01 GAMES',
    statTiles(x) {
      const ppd = x.darts ? x.points / x.darts : 0;
      return [[x.games || 0, 'GAMES'], [x.games ? Math.round(100 * x.wins / x.games) + '%' : '-', 'WINS'], [ppd.toFixed(2), 'PPD'],
        [(ppd * 3).toFixed(1), '3-DART AVG'], [x.tons || 0, 'TONS'], [x.ton80s || 0, 'TON 80s'],
        [x.bestOut || '-', 'BEST OUT'], [x.legs ? x.legsWon + '/' + x.legs : '-', 'LEGS WON'], [x.darts || 0, 'DARTS']];
    },
    statChart(x) { return { label: 'PPD', pts: (x.history || []).map(h => ({ v: h.ppd, win: h.win })) }; },
    // Rows for the game-over table: name, stat columns
    resultCols: ['PPD', 'TONS', 'BEST OUT'],
    resultRow(e) {
      const s = e.stats;
      return [s.darts ? (s.points / s.darts).toFixed(2) : '0.00', s.tons || 0, s.bestOut || '-'];
    },
  };
  Engine.register(X01);
})();
