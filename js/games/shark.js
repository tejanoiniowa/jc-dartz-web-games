// shark.js — Shark Bite (our own rules)
// Each round the lowest 3-dart score gets bitten (2 bites if under half the round's top score).
// Bulls score 0. Reach the bite limit and the shark eats you. Last surfer standing wins.
'use strict';

(() => {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const active = S => S.sides.filter(s => !s.data.out);

  const SH = {
    id: 'shark', name: 'SHARK BITE', group: 'party', blurb: 'Lowest score each round gets bitten', maxPlayers: 8, minPlayers: 2,
    options: [
      { key: 'bites', label: 'BITE LIMIT', def: 5, values: [[3, '3 BITES'], [5, '5 BITES'], [7, '7 BITES']] },
    ],
    title(o) { return 'SHARK BITE · ' + o.bites + ' BITES'; },
    info(S) { return 'ROUND ' + S.round; },
    value(c, d) { return d.num === 25 ? 0 : d.value; },
    init(c) {
      c.sides.forEach(s => { s.data = { bites: 0, out: false, pts: 0, sum: 0, rounds: 0, last: null }; });
      c.shared.thrown = [];
      c.shared.outOrder = [];
      c.shared.last = null;      // what happened last round, for the screen
    },
    turnBegin(c) { c.side.data.pts = 0; },
    isOut(side) { return side.data.out; },
    dart(c, d) {
      const v = this.value(c, d);
      c.side.data.pts += v;
      c.thrower.stats.points += v;
      return {};
    },

    // The last surfer to throw in a round settles the bites
    turnEnd(c) {
      const S = c.S, sh = S.shared, sd = c.side.data;
      sd.sum += sd.pts; sd.rounds++; sd.last = sd.pts;
      if (!sh.thrown.includes(c.side.idx)) sh.thrown.push(c.side.idx);
      const alive = active(S);
      if (!alive.every(s => sh.thrown.includes(s.idx))) return Kit.generic(c.darts);
      sh.thrown = [];
      return this.settle(S, alive) || Kit.generic(c.darts);
    },
    settle(S, alive) {
      const limit = S.opts.bites, sh = S.shared;
      const pts = alive.map(s => s.data.pts);
      const lo = Math.min(...pts), hi = Math.max(...pts);
      if (lo === hi) { sh.last = { safe: true }; return { big: 'SAFE ROUND', sub: 'EVERYONE TIED · NO BITES', say: ['safe_round', 'Safe round!'] }; }
      const bitten = alive.filter(s => s.data.pts === lo);
      const n = lo < hi / 2 ? 2 : 1;
      bitten.forEach(s => { s.data.bites = Math.min(limit, s.data.bites + n); });
      let eaten = bitten.filter(s => s.data.bites >= limit);
      // Showdown: if everyone left would be eaten, the higher round score survives (a tie throws again)
      if (eaten.length && eaten.length === alive.length) {
        const best = Math.max(...eaten.map(s => s.data.pts));
        const keep = eaten.filter(s => s.data.pts === best);
        keep.forEach(s => { s.data.bites = limit - 1; });
        eaten = keep.length === eaten.length ? [] : eaten.filter(s => !keep.includes(s));
      }
      eaten.forEach(s => { s.data.out = true; sh.outOrder.push(s.idx); });
      const names = bitten.map(s => s.name).join(' & ');
      sh.last = { bitten: bitten.map(s => s.idx), n, eaten: eaten.map(s => s.idx) };
      const left = active(S);
      if (left.length === 1) S.legOverAfter = left[0].idx;
      if (eaten.length) return { big: 'EATEN!', red: true, sub: eaten.map(s => s.name).join(' & ') + ' · THE SHARK WINS', say: ['eaten', 'Eaten by the shark!'] };
      return { big: n === 2 ? 'DOUBLE BITE!' : 'CHOMP!', red: true, sub: names + (bitten.length > 1 ? ' GET BITTEN' : ' GETS BITTEN'), say: n === 2 ? ['double_bite', 'Double bite!'] : ['bitten', 'Shark bite!'] };
    },

    box(side, S) { return { sc: side.data.out ? 'EATEN' : side.data.bites + ' / ' + S.opts.bites, sub: side.data.out ? '' : 'BITES' }; },
    turnTotal(c) { return c.side.data.pts; },
    dartText(c, d) { return d.num === 25 ? { v: '0 · BULL', miss: true } : null; },
    upNext(side, S) { return side.data.bites + ' OF ' + S.opts.bites + ' BITES'; },
    aimLights(c) { Board.Lights.turn(c.side.rgb); },
    cpuAim(c) { const L = Engine.LEVELS[c.thrower.level] || {}; return (L.t || 0) >= 0.2 ? 'T20' : 'S20'; },

    // Ocean scene: one lane per surfer, the fin closes in as bites add up
    view(S, c) {
      const limit = S.opts.bites, sides = S.sides, n = sides.length, act = S.order[S.cur].side;
      const W = 740, laneH = Math.min(78, Math.floor(470 / n)), H = laneH * n + 70;
      const thrown = S.shared.thrown || [];
      let g = '';
      sides.forEach((s, i) => {
        const y = 60 + i * laneH, mid = y + laneH / 2, sd = s.data;
        const on = i === act && S.phase !== 'over';
        const sx = W - 120;                                      // surfer position
        const fx = 150 + (sx - 210) * Math.min(sd.bites, limit) / limit;   // fin creeps closer
        const k = Math.min(1, laneH / 70);
        // water
        g += `<rect x="0" y="${y + 4}" width="${W}" height="${laneH - 8}" rx="10" fill="${sd.out ? '#3a0c0c' : on ? '#0c2f55' : '#0a1d36'}" stroke="${on ? '#8fdc2a' : '#1d3a66'}" stroke-width="${on ? 3 : 1.5}"/>`;
        let wave = `M10 ${mid + 10 * k}`;
        for (let x = 10; x < W - 10; x += 40) wave += ` q10 ${-8 * k} 20 0 t20 0`;
        g += `<path d="${wave}" fill="none" stroke="#2f6fb3" stroke-width="2" opacity=".7"/>`;
        // name + round score
        g += `<text x="18" y="${y + 24 * k + 6}" fill="${on ? '#8fdc2a' : '#e8ecf8'}" font-family="Teko" font-size="${26 * k}" font-weight="600" letter-spacing="1">${esc(s.name)}</text>`;
        const shown = sd.out ? 'EATEN' : on ? sd.pts : thrown.includes(i) ? sd.last : '';
        g += `<text x="${sx - 40}" y="${mid + 9 * k}" fill="#f2e600" font-family="Russo One" font-size="${26 * k}" text-anchor="end">${shown}</text>`;
        // fin
        if (!sd.out) g += `<path d="M${fx} ${mid + 12 * k} l${16 * k} ${-30 * k} q${10 * k} ${12 * k} ${14 * k} ${30 * k} z" fill="#5d6b85" stroke="#c9d3e8" stroke-width="1.5"/>`;
        // surfer: board + rider (gone when eaten)
        if (!sd.out) {
          g += `<ellipse cx="${sx + 30}" cy="${mid + 12 * k}" rx="${34 * k}" ry="${6 * k}" fill="#f2a900" stroke="#fff" stroke-width="1.5"/>`;
          g += `<circle cx="${sx + 30}" cy="${mid - 20 * k}" r="${6 * k}" fill="#ffd9b0"/>`;
          g += `<path d="M${sx + 30} ${mid - 14 * k} v${16 * k} M${sx + 30} ${mid + 2 * k} l${-8 * k} ${8 * k} M${sx + 30} ${mid + 2 * k} l${8 * k} ${8 * k} M${sx + 18 * k} ${mid - 8 * k} h${24 * k}" stroke="#ffd9b0" stroke-width="${3 * k}" stroke-linecap="round"/>`;
        } else {
          g += `<path d="M${sx + 10} ${mid + 12 * k} l${20 * k} ${-36 * k} q${12 * k} ${14 * k} ${18 * k} ${36 * k} z" fill="#e0201b" stroke="#ff8a86" stroke-width="1.5"/>`;
        }
        // bites as teeth
        const tw = Math.min(16, 220 / limit) * k;
        for (let b = 0; b < limit; b++) {
          const bx = 18 + b * (tw + 4), by = y + laneH - 14 * k;
          g += `<path d="M${bx} ${by - tw * 0.9} l${tw / 2} ${tw * 0.9} l${tw / 2} ${-tw * 0.9} z" fill="${b < sd.bites ? '#e0201b' : 'none'}" stroke="${b < sd.bites ? '#ff8a86' : '#3a5a8a'}" stroke-width="1.5"/>`;
        }
      });
      const last = S.shared.last;
      let head = 'LOWEST SCORE GETS BITTEN · BULLS SCORE 0';
      if (last && last.safe) head = 'LAST ROUND: SAFE, EVERYONE TIED';
      else if (last && last.bitten) head = 'LAST ROUND: ' + last.bitten.map(i => sides[i].name).join(' & ') + (last.n === 2 ? ' · DOUBLE BITE' : ' · BITTEN');
      g = `<text x="${W / 2}" y="34" fill="#9fb0d4" font-family="Teko" font-size="26" letter-spacing="2" text-anchor="middle">${esc(head.toUpperCase())}</text>` + g;
      return `<svg class="ocean" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-label="Shark Bite board">${g}</svg>`;
    },

    saveStats(S) {
      S.entrants.forEach(e => {
        const x = Kit.bucket(e, 'shark', { games: 0, wins: 0, sum: 0, rounds: 0 });
        if (!x) return;
        const sd = S.sides.find(s => s.members.includes(e.idx)).data, won = Kit.won(S, e);
        x.games++; if (won) x.wins++;
        x.sum += sd.sum; x.rounds += sd.rounds;
        Kit.push(x.history, { at: Date.now(), v: sd.rounds ? Math.round(sd.sum / sd.rounds) : 0, win: won });
      });
    },
    resultCols: ['FINISH', 'BITES', 'AVG ROUND'],
    resultRow(e, S) {
      const side = S.sides.find(s => s.members.includes(e.idx)), sd = side.data;
      const pos = sd.out ? S.sides.length - S.shared.outOrder.indexOf(side.idx) : 1;
      return [pos === 1 ? '1ST' : pos === 2 ? '2ND' : pos === 3 ? '3RD' : pos + 'TH', sd.out ? 'EATEN' : sd.bites, sd.rounds ? Math.round(sd.sum / sd.rounds) : 0];
    },
    sortResults(a, b, S) {
      const pos = x => { const side = S.sides.find(s => s.members.includes(x.idx)); return side.data.out ? S.sides.length - S.shared.outOrder.indexOf(side.idx) : 1; };
      return pos(a) - pos(b);
    },
    statKey: 'shark', statName: 'SHARK',
    statTiles(x) {
      return [[x.games || 0, 'GAMES'], [Kit.pct(x.wins, x.games), 'WINS'], [x.rounds ? Math.round(x.sum / x.rounds) : '-', 'AVG ROUND']];
    },
    statChart(x) { return { label: 'AVG ROUND', pts: (x.history || []).map(h => ({ v: h.v, win: h.win })) }; },
  };
  Engine.register(SH);
})();
