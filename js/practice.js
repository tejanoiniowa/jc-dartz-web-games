// practice.js — Target Practice: one target, 10 rounds of 3 darts, only the target counts
'use strict';

(() => {
  const TYPES = [['S', 'SINGLE'], ['D', 'DOUBLE'], ['T', 'TRIPLE'], ['B', 'ANY BULL'], ['SB', 'SINGLE BULL'], ['DB', 'DOUBLE BULL']];
  const keyOf = o => ['B', 'SB', 'DB'].includes(o.type) ? o.type : o.type + o.num;
  const nameOf = k0 => { const [k, r] = String(k0).split('/'); return nm(k) + (r ? ' · ' + r + ' RDS' : ''); };
  const nm = k => ({ B: 'BULL', SB: 'SINGLE BULL', DB: 'DOUBLE BULL' }[k] ||
    ({ S: 'SINGLE ', D: 'DOUBLE ', T: 'TRIPLE ' }[k[0]] + k.slice(1)));
  const bigOf = k => ({ B: 'BULL', SB: 'SB', DB: 'DB' }[k] || k);
  function isHit(k, d) {
    if (k === 'B') return d.num === 25;
    if (k === 'SB') return d.num === 25 && d.mult === 1;
    if (k === 'DB') return d.num === 25 && d.mult === 2;
    const m = { S: 1, D: 2, T: 3 }[k[0]];
    return d.num === +k.slice(1) && d.mult === m;   // either single (inner or outer) counts
  }

  const P = {
    id: 'practice', name: 'TARGET PRACTICE', maxPlayers: 1, noCpu: true, solo: true,
    options: [
      { key: 'type', label: 'TARGET', def: 'T', values: TYPES },
      { key: 'num', label: 'NUMBER', def: 20, values: Array.from({ length: 20 }, (_, i) => [20 - i, String(20 - i)]) },
      { key: 'rounds', label: 'ROUNDS', def: 10, values: [[3, '3'], [5, '5'], [10, '10']] },
    ],
    title(o) { return 'PRACTICE · ' + nameOf(keyOf(o)); },
    info(S) { const n = S.opts.rounds || 10; return 'ROUND ' + Math.min(S.round, n) + ' / ' + n; },
    init(c) {
      c.shared.key = keyOf(c.opts);
      c.sides.forEach(s => { s.data = { hits: 0, darts: 0, streak: 0, best: 0, rounds: [], turnHits: 0 }; });
    },
    turnBegin(c) { c.side.data.turnHits = 0; },
    dart(c, d) {
      const sd = c.side.data, hit = isHit(c.shared.key, d);
      d.hitT = hit; sd.darts++;
      if (hit) { sd.hits++; sd.turnHits++; sd.streak++; sd.best = Math.max(sd.best, sd.streak); }
      else sd.streak = 0;
      return {};
    },
    turnEnd(c) {
      c.side.data.rounds[c.S.round - 1] = c.side.data.turnHits;
      if (c.side.data.turnHits === 3) return Kit.generic(c.darts) || { big: '3 FOR 3', say: ['three_for_three', 'Three for three!'] };
      return null;
    },
    roundLimit(S) { return S.opts.rounds || 10; },
    limitWinner() { return 0; },
    label(c) { return 'TARGET'; },
    big(c) { return bigOf(c.shared.key); },
    box(side) { return { sc: side.data.hits + ' / ' + side.data.darts, sub: Kit.pct(side.data.hits, side.data.darts) + ' · STREAK ' + side.data.streak }; },
    turnTotal(c) { return c.side.data.turnHits + ' HIT' + (c.side.data.turnHits === 1 ? '' : 'S'); },
    dartText(c, d) { return { v: d.hitT ? 'HIT' : 'MISS', miss: !d.hitT }; },
    upNext(side) { return Kit.pct(side.data.hits, side.data.darts) + ' SO FAR'; },
    aimLights(c) { const k = c.shared.key; const n = +k.slice(1); if (n >= 1 && n <= 20) Board.Lights.targets([n], 'green'); else Board.Lights.turn(c.side.rgb); },
    extra(S) {
      const sd = S.sides[0].data;
      const n = S.opts.rounds || 10;
      return `<div class="card" style="--n:${n}"><div class="cr hd"><span>ROUND</span>` + Array.from({ length: n }, (_, i) => `<span class="${i === S.round - 1 ? 'now' : ''}">${i + 1}</span>`).join('') + '</div>' +
        '<div class="cr on"><span class="nm">HITS</span>' + Array.from({ length: n }, (_, i) => { const v = sd.rounds[i]; return `<span class="${v === 3 ? 'u' : v === 0 ? 'o' : ''}">${v === undefined ? '' : v}</span>`; }).join('') + '</div></div>';
    },
    saveStats(S) {
      const e = S.entrants[0], sd = S.sides[0].data, k = S.shared.key + ((S.opts.rounds || 10) === 10 ? '' : '/' + S.opts.rounds);
      const x = Kit.bucket(e, 'practice', { games: 0, hits: 0, darts: 0, targets: {} });
      if (!x) return;
      const t = x.targets[k] = Object.assign({ games: 0, hits: 0, darts: 0, best: 0, streak: 0, history: [] }, x.targets[k]);
      const pct = sd.darts ? Math.round(100 * sd.hits / sd.darts) : 0;
      S.prevBest = t.games ? t.best : null;
      x.games++; x.hits += sd.hits; x.darts += sd.darts; x.last = k;
      t.games++; t.hits += sd.hits; t.darts += sd.darts; t.best = Math.max(t.best, pct); t.streak = Math.max(t.streak, sd.best);
      Kit.push(t.history, { at: Date.now(), v: pct });
      Kit.push(x.history, { at: Date.now(), v: pct, k });
    },
    resultCols: ['HITS', 'HIT %', 'BEST STREAK'],
    resultRow(e, S) { const sd = S.sides[0].data; return [sd.hits + ' / ' + sd.darts, Kit.pct(sd.hits, sd.darts), sd.best]; },
    overNote(S) {
      const sd = S.sides[0].data, pct = sd.darts ? Math.round(100 * sd.hits / sd.darts) : 0;
      if (S.prevBest === undefined) return '';
      if (S.prevBest === null) return 'FIRST ' + (S.opts.rounds || 10) + '-ROUND GAME ON ' + nameOf(S.shared.key);
      return pct > S.prevBest ? 'NEW PERSONAL BEST! (WAS ' + S.prevBest + '%)' : 'PERSONAL BEST ' + Math.max(S.prevBest, pct) + '%';
    },
    statKey: 'practice', statName: 'PRACTICE',
    statTiles(x) {
      const t = x.last && x.targets[x.last];
      const tiles = [[x.games || 0, 'GAMES'], [Kit.pct(x.hits, x.darts), 'ALL TARGETS']];
      if (t) tiles.push([nameOf(x.last).replace('SINGLE ', 'S').replace('DOUBLE ', 'D').replace('TRIPLE ', 'T'), 'LAST TARGET'], [Kit.pct(t.hits, t.darts), 'ITS HIT %'], [t.best + '%', 'ITS BEST'], [t.streak, 'BEST STREAK']);
      return tiles;
    },
    statChart(x) { const t = x.last && x.targets[x.last]; return { label: 'HIT % · ' + (x.last ? nameOf(x.last) : ''), pts: t ? t.history.map(h => ({ v: h.v, win: false })) : [] }; },
  };
  Engine.register(P);
})();
