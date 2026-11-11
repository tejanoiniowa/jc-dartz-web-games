// golf.js — 9 holes: 13 to 20, then the bull. Every dart counts. Lowest total wins.
'use strict';

(() => {
  const HOLES = [13, 14, 15, 16, 17, 18, 19, 20, 25];
  const fmt = n => n === 0 ? 'E' : n > 0 ? '+' + n : String(n);

  // Strokes for one dart on a hole
  function strokes(d, hole) {
    if (hole === 25) return d.num === 25 ? -d.mult : 1;
    if (d.num !== hole) return 1;
    return d.mult === 3 ? -2 : d.mult === 2 ? -1 : 0;
  }
  const KIND = { 1: 'MISS', 0: 'PAR', '-1': 'BIRDIE', '-2': 'EAGLE' };
  function holeScore(darts, hole) {
    if (darts.length === 3 && darts.every(d => strokes(d, hole) === 1)) return 5;
    return darts.reduce((a, d) => a + strokes(d, hole), 0);
  }
  const total = side => side.data.holes.reduce((a, v) => a + (v || 0), 0);
  const holeOf = S => HOLES[Math.min(S.round, 9) - 1];

  const G = {
    id: 'golf', name: 'GOLF', maxPlayers: 8, options: [],
    title() { return 'GOLF · 9 HOLES'; },
    info(S) { return 'HOLE ' + Math.min(S.round, 9) + ' / 9'; },
    init(c) { c.sides.forEach(s => { s.data = { holes: [] }; }); },
    dart(c, d) { d.st = strokes(d, holeOf(c.S)); return {}; },
    turnEnd(c) {
      const h = holeScore(c.darts, holeOf(c.S));
      c.side.data.holes[c.S.round - 1] = h;
      if (h <= -6) return { big: 'PERFECT HOLE', sub: fmt(h), say: ['perfect_hole', 'Perfect hole!'] };
      return Kit.generic(c.darts);
    },
    roundLimit() { return 9; },
    limitWinner(S) {
      const t = S.sides.map(total), best = Math.min(...t);
      const w = t.map((v, i) => v === best ? i : -1).filter(i => i >= 0);
      if (w.length > 1) { S.tied = w; return -1; }
      return w[0];
    },
    label(c) { return 'HOLE ' + Math.min(c.S.round, 9) + ' · AIM AT'; },
    big(c) { const h = holeOf(c.S); return h === 25 ? 'BULL' : h; },
    box(side, S) { return { sc: fmt(total(side)), sub: 'THRU ' + side.data.holes.filter(v => v !== undefined).length }; },
    turnTotal(c) { return fmt(holeScore(c.darts, holeOf(c.S))); },
    dartText(c, d) { const k = KIND[String(d.st)]; return { v: k, miss: d.st === 1 }; },
    upNext(side) { return 'TOTAL ' + fmt(total(side)); },
    aimLights(c) { const h = holeOf(c.S); if (h <= 20) Board.Lights.targets([h], 'green'); else Board.Lights.turn(c.side.rgb); },
    // Scorecard across the lower middle of the screen (up to 4 players)
    extra(S) {
      if (S.sides.length > 4) return '';
      const cur = S.order[S.cur].side;
      let h = '<div class="card"><div class="cr hd"><span></span>' + HOLES.map((n, i) => `<span class="${i === S.round - 1 ? 'now' : ''}">${n === 25 ? 'B' : n}</span>`).join('') + '<span>TOT</span></div>';
      S.sides.forEach((s, si) => {
        h += `<div class="cr${si === cur ? ' on' : ''}"><span class="nm">${s.name.replace(/[<>&]/g, '')}</span>` +
          HOLES.map((n, i) => { const v = s.data.holes[i]; return `<span class="${v < 0 ? 'u' : v > 0 ? 'o' : ''}">${v === undefined ? '' : fmt(v)}</span>`; }).join('') +
          `<span class="t">${fmt(total(s))}</span></div>`;
      });
      return h + '</div>';
    },
    cpuAim(c) {
      const h = holeOf(c.S), L = Engine.LEVELS[c.thrower.level] || {};
      if (h === 25) return (L.b || 0) >= 0.2 ? 'DB' : 'SB';
      return ((L.t || 0) >= 0.3 ? 'T' : 'S') + h;
    },
    saveStats(S) {
      S.entrants.forEach(e => {
        const x = Kit.bucket(e, 'golf', { games: 0, wins: 0, best: null, sum: 0, birdies: 0 });
        if (!x) return;
        const side = S.sides.find(s => s.members.includes(e.idx)), t = total(side), won = Kit.won(S, e);
        x.games++; if (won && S.sides.length > 1) x.wins++;
        x.sum += t; x.best = x.best === null ? t : Math.min(x.best, t);
        Kit.push(x.history, { at: Date.now(), v: t, win: won });
      });
    },
    resultCols: ['TOTAL', 'BEST HOLE', 'WORST'],
    resultRow(e, S) {
      const side = S.sides.find(s => s.members.includes(e.idx)), hs = side.data.holes.filter(v => v !== undefined);
      return [fmt(total(side)), hs.length ? fmt(Math.min(...hs)) : '-', hs.length ? fmt(Math.max(...hs)) : '-'];
    },
    sortResults(a, b, S) {
      const ta = total(S.sides.find(s => s.members.includes(a.idx))), tb = total(S.sides.find(s => s.members.includes(b.idx)));
      return ta - tb;
    },
    statKey: 'golf', statName: 'GOLF',
    statTiles(x) {
      return [[x.games || 0, 'GAMES'], [x.wins || 0, 'WINS'], [x.best === null || x.best === undefined ? '-' : fmt(x.best), 'BEST ROUND'],
        [x.games ? fmt(Math.round(x.sum / x.games)) : '-', 'AVG ROUND']];
    },
    statChart(x) { return { label: 'ROUND SCORE', pts: (x.history || []).map(h => ({ v: h.v, win: h.win })) }; },
  };
  Engine.register(G);
})();
