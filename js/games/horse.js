// horse.js — set a checkout, everyone else must match it or take a letter
'use strict';

(() => {
  const WORD = 'HORSE';
  const RANGES = { easy: [2, 40], medium: [41, 100], hard: [101, 170] };
  const BOGEY = [159, 162, 163, 165, 166, 168, 169];
  const letters = n => n ? WORD.slice(0, n).split('').join('-') : '-';

  function newTarget(S) {
    const [lo, hi] = RANGES[S.opts.range];
    for (let t = 0; t < 300; t++) {
      const n = lo + Math.floor(Math.random() * (hi - lo + 1));
      if (BOGEY.includes(n) || n === S.shared.last) continue;
      if (S.opts.out === 'double' && !Segs.checkoutRoute(n, 3, 'double', S.opts.bull === 'fat')) continue;
      return n;
    }
    return lo + 1;
  }
  const active = S => S.sides.map((s, i) => i).filter(i => !S.sides[i].data.out);
  function after(S, from) {
    for (let k = 1; k <= S.sides.length; k++) { const i = (from + k) % S.sides.length; if (!S.sides[i].data.out) return i; }
    return from;
  }
  function setBy(S, i) {
    const sh = S.shared;
    sh.setter = i; sh.phase = 'set'; sh.queue = [];
    sh.target = newTarget(S); sh.last = sh.target; sh.next = i;
  }

  const H = {
    id: 'horse', name: 'HORSE', maxPlayers: 8, minPlayers: 2,
    options: [
      { key: 'range', label: 'NUMBERS', def: 'medium', values: [['easy', 'EASY 2-40'], ['medium', 'MEDIUM 41-100'], ['hard', 'HARD 101-170']] },
      { key: 'bull', label: 'BULL', def: 'fat', values: [['fat', 'ANY BULL 50'], ['split', '25 / 50']] },
      { key: 'out', label: 'OUT', def: 'open', values: [['open', 'OPEN OUT'], ['double', 'DOUBLE OUT']] },
      { key: 'hints', label: 'CHECKOUT HINTS', def: true, values: [[true, 'ON'], [false, 'OFF']] },
    ],
    title(o) { return 'HORSE · ' + o.range.toUpperCase(); },
    info(S) { return 'TARGET ' + S.shared.target; },
    value(c, d) { return d.num === 25 && c.opts.bull === 'fat' ? 50 : d.value; },

    init(c) {
      c.sides.forEach(s => { s.data = { letters: 0, out: false, rem: 0, made: 0, att: 0, result: null }; });
      c.shared.last = 0; c.shared.outOrder = [];
      setBy(c.S, c.S.order[0].side);
      c.side.data.rem = c.shared.target;
    },
    turnBegin(c) { c.side.data.rem = c.shared.target; c.side.data.result = null; },
    pickNext(S) { return S.shared.next; },
    isOut(side) { return side.data.out; },

    dart(c, d) {
      const sd = c.side.data;
      if (sd.result) return { endTurn: true };
      const v = this.value(c, d), left = sd.rem - v;
      const dbl = d.mult === 2;
      if (left < 0 || (c.opts.out === 'double' && (left === 1 || (left === 0 && !dbl)))) {
        sd.result = 'miss'; return { bust: true, say: ['bust', 'Bust'] };
      }
      sd.rem = left;
      if (left === 0) { sd.result = 'made'; return { endTurn: true, say: ['checked_out', 'Checked out!'] }; }
      return {};
    },

    turnEnd(c) {
      const S = c.S, sh = S.shared, sd = c.side.data, me = c.side.idx;
      const made = sd.result === 'made';
      sd.att++; if (made) sd.made++;
      sh.lastWho = c.side.name; sh.lastMade = made;
      if (sh.phase === 'set') {
        if (made) {
          const order = [];
          for (let k = 1; k < S.sides.length; k++) { const i = (sh.setter + k) % S.sides.length; if (!S.sides[i].data.out) order.push(i); }
          sh.phase = 'match'; sh.queue = order; sh.next = sh.queue.shift();
          return { big: 'CHECKED OUT', sub: 'EVERYONE MATCH ' + sh.target };
        }
        setBy(S, after(S, sh.setter));
        return null;
      }
      // matching
      let award = null;
      if (!made) {
        sd.letters++;
        const w = letters(sd.letters);
        if (sd.letters >= WORD.length) {
          sd.out = true; sh.outOrder.push(me);
          award = { big: 'H-O-R-S-E', red: true, sub: c.side.name + ' IS OUT', say: ['horse_out', 'H O R S E. You\'re out!'] };
          const left = active(S);
          if (left.length <= 1) { S.legOverAfter = left[0]; return award; }
        } else award = { big: w, red: true, sub: 'MISSED ' + sh.target, say: ['letter', WORD.slice(0, sd.letters).split('').join(' ')] };
      }
      if (sh.queue.length) sh.next = sh.queue.shift();
      else setBy(S, sh.setter);
      return award;
    },

    label(c) { return (c.shared.phase === 'set' ? 'SET THE SHOT' : 'MATCH IT') + ' · ' + c.shared.target; },
    big(c) { return c.side.data.rem; },
    box(side) { return { sc: letters(side.data.letters), sub: side.data.out ? 'OUT' : side.data.made + ' / ' + side.data.att + ' MADE' }; },
    turnTotal(c) { return c.side.data.result === 'made' ? 'MADE' : c.side.data.result === 'miss' ? 'MISSED' : c.side.data.rem; },
    upNext(side, S) { return (S.shared.phase === 'set' ? 'SET THE SHOT · ' : 'MATCH ') + S.shared.target; },
    hint(c) {
      const sd = c.side.data, left = 3 - c.darts.length;
      if (!c.opts.hints || sd.result || left <= 0) return null;
      const r = Segs.checkoutRoute(sd.rem, left, c.opts.out, c.opts.bull === 'fat');
      return r ? { label: 'CHECKOUT', route: r } : null;
    },
    aimLights(c) {
      const r = Segs.checkoutRoute(c.side.data.rem, 3, c.opts.out, c.opts.bull === 'fat');
      const n = r ? Segs.parseSeg(r[0]).num : 0;
      if (n && n <= 20) Board.Lights.targets([n], 'green'); else Board.Lights.turn(c.side.rgb);
    },
    cpuAim(c) {
      const sd = c.side.data;
      const r = Segs.checkoutRoute(sd.rem, 3 - c.darts.length, c.opts.out, c.opts.bull === 'fat');
      if (r) return r[0].replace(/[IO]$/, '');
      return sd.rem > 60 ? 'T20' : 'S' + Math.min(20, Math.max(1, sd.rem - 40));
    },

    saveStats(S) {
      S.entrants.forEach(e => {
        const x = Kit.bucket(e, 'horse', { games: 0, wins: 0, made: 0, att: 0 });
        if (!x) return;
        const sd = S.sides.find(s => s.members.includes(e.idx)).data, won = Kit.won(S, e);
        x.games++; if (won) x.wins++;
        x.made += sd.made; x.att += sd.att;
        Kit.push(x.history, { at: Date.now(), v: sd.att ? Math.round(100 * sd.made / sd.att) : 0, win: won });
      });
    },
    resultCols: ['LETTERS', 'MADE', 'TRIES'],
    resultRow(e, S) { const sd = S.sides.find(s => s.members.includes(e.idx)).data; return [letters(sd.letters), sd.made, sd.att]; },
    sortResults(a, b, S) {
      const sa = S.sides.find(s => s.members.includes(a.idx)).data, sb = S.sides.find(s => s.members.includes(b.idx)).data;
      return sa.letters - sb.letters;
    },
    statKey: 'horse', statName: 'HORSE',
    statTiles(x) {
      return [[x.games || 0, 'GAMES'], [Kit.pct(x.wins, x.games), 'WINS'], [Kit.pct(x.made, x.att), 'CHECKOUT %'], [x.made || 0, 'CHECKOUTS']];
    },
    statChart(x) { return { label: 'CHECKOUT %', pts: (x.history || []).map(h => ({ v: h.v, win: h.win })) }; },
  };
  Engine.register(H);
})();
