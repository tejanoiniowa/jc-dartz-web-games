// atc.js — Around the Clock: 1 to 20, then the bull. First to hit the bull wins.
'use strict';

(() => {
  const BULL = 21;
  const name = t => t >= BULL ? 'BULL' : String(t);

  const A = {
    id: 'atc', name: 'AROUND THE CLOCK', group: 'practice', blurb: 'Hit 1 to 20, then the bull', maxPlayers: 8, solo: true,
    options: [
      { key: 'count', label: 'WHAT COUNTS', def: 'any', values: [['any', 'ANY PART'], ['double', 'DOUBLES ONLY'], ['triple', 'TRIPLES ONLY']] },
      { key: 'skip', label: 'SKIP AHEAD', def: false, values: [[false, 'OFF'], [true, 'ON']] },
      { key: 'finish', label: 'FINISH', def: 'any', values: [['any', 'ANY BULL'], ['double', 'DOUBLE BULL']] },
    ],
    title(o) {
      const t = ['AROUND THE CLOCK'];
      if (o.count !== 'any') t.push(o.count === 'double' ? 'DOUBLES' : 'TRIPLES');
      if (o.skip && o.count === 'any') t.push('SKIP');
      return t.join(' · ');
    },
    info(S) { return 'ROUND ' + S.round; },
    init(c) { c.sides.forEach(s => { s.data = { t: 1, hits: 0, darts: 0, turnHits: 0 }; }); },
    turnBegin(c) { c.side.data.turnHits = 0; },

    hits(o, t, d) {
      if (t >= BULL) return d.num === 25 && (o.finish === 'any' || d.mult === 2);
      if (d.num !== t) return false;
      return o.count === 'any' || (o.count === 'double' ? d.mult === 2 : d.mult === 3);
    },
    dart(c, d) {
      const sd = c.side.data, o = c.opts;
      sd.darts++;
      const hit = this.hits(o, sd.t, d);
      d.hitT = hit;
      if (!hit) return { noCount: true };
      sd.hits++; sd.turnHits++;
      if (sd.t >= BULL) { sd.t = BULL + 1; sd.finishDarts = sd.darts; return { win: true }; }
      const step = o.skip && o.count === 'any' ? d.mult : 1;
      sd.t = Math.min(BULL, sd.t + step);
      return {};
    },
    turnEnd(c) {
      const g = Kit.generic(c.darts); if (g) return g;
      if (c.side.data.turnHits === 3) return { big: '3 FOR 3', say: ['three_for_three', 'Three for three!'] };
      return null;
    },

    label(c) { return c.side.data.t >= BULL ? 'FINISH ON' : 'HIT NEXT'; },
    big(c) { return name(c.side.data.t); },
    box(side) { return { sc: side.data.t > BULL ? 'DONE' : 'ON ' + name(side.data.t), sub: side.data.hits + ' / ' + side.data.darts + ' HIT' }; },
    turnTotal(c) { return c.side.data.turnHits + ' HIT' + (c.side.data.turnHits === 1 ? '' : 'S'); },
    dartText(c, d) { return { v: d.hitT ? 'HIT' : 'MISS', miss: !d.hitT }; },
    upNext(side) { return 'ON ' + name(side.data.t); },
    aimLights(c) { const t = c.side.data.t; if (t <= 20) Board.Lights.targets([t], 'green'); else Board.Lights.turn(c.side.rgb); },
    // A track of 1–20 + bull with each player's progress (up to 4 players)
    extra(S) {
      if (S.sides.length > 4) return '';
      const cur = S.order[S.cur].side;
      let h = '<div class="card" style="--n:21;--cw:29px;--nw:100px;font-size:20px"><div class="cr hd"><span></span>' +
        Array.from({ length: 21 }, (_, i) => `<span>${i < 20 ? i + 1 : 'B'}</span>`).join('') + '</div>';
      S.sides.forEach((s, si) => {
        h += `<div class="cr${si === cur ? ' on' : ''}"><span class="nm">${s.name.replace(/[<>&]/g, '')}</span>` +
          Array.from({ length: 21 }, (_, i) => { const t = i + 1; return `<span class="${t < s.data.t ? 'u' : t === s.data.t ? 'now' : ''}">${t < s.data.t ? '●' : t === s.data.t ? '◆' : '·'}</span>`; }).join('') + '</div>';
      });
      return h + '</div>';
    },
    cpuAim(c) {
      const t = c.side.data.t, o = c.opts;
      if (t >= BULL) return o.finish === 'double' ? 'DB' : 'SB';
      if (o.count === 'double') return 'D' + t;
      if (o.count === 'triple') return 'T' + t;
      const L = Engine.LEVELS[c.thrower.level] || {};
      return (o.skip && (L.t || 0) >= 0.3 ? 'T' : 'S') + t;
    },

    saveStats(S) {
      S.entrants.forEach(e => {
        const x = Kit.bucket(e, 'atc', { games: 0, wins: 0, finished: 0, best: null, hits: 0, darts: 0 });
        if (!x) return;
        const sd = S.sides.find(s => s.members.includes(e.idx)).data, won = Kit.won(S, e);
        if (S.sides.length === 1) S.prevBest = x.best;
        x.games++; if (won && S.sides.length > 1) x.wins++;
        x.hits += sd.hits; x.darts += sd.darts;
        if (sd.finishDarts) { x.finished++; x.best = x.best === null ? sd.finishDarts : Math.min(x.best, sd.finishDarts); }
        Kit.push(x.history, { at: Date.now(), v: sd.finishDarts || sd.darts, win: won });
      });
    },
    overNote(S) {
      if (S.sides.length !== 1 || S.prevBest === undefined) return '';
      const d = S.sides[0].data.finishDarts;
      if (S.prevBest === null) return 'FINISHED IN ' + d + ' DARTS · FIRST PERSONAL BEST';
      return d < S.prevBest ? 'NEW PERSONAL BEST: ' + d + ' DARTS (WAS ' + S.prevBest + ')' : 'FINISHED IN ' + d + ' DARTS · BEST ' + S.prevBest;
    },
    resultCols: ['REACHED', 'DARTS', 'HIT %'],
    resultRow(e, S) { const sd = S.sides.find(s => s.members.includes(e.idx)).data; return [sd.t > BULL ? 'FINISHED' : name(sd.t), sd.darts, Kit.pct(sd.hits, sd.darts)]; },
    sortResults(a, b, S) { const f = x => S.sides.find(s => s.members.includes(x.idx)).data.t; return f(b) - f(a); },
    statKey: 'atc', statName: 'CLOCK',
    statTiles(x) {
      return [[x.games || 0, 'GAMES'], [x.wins || 0, 'WINS'], [x.best === null || x.best === undefined ? '-' : x.best, 'BEST (DARTS)'],
        [Kit.pct(x.hits, x.darts), 'HIT %'], [x.finished || 0, 'FINISHED']];
    },
    statChart(x) { return { label: 'DARTS PER GAME', pts: (x.history || []).map(h => ({ v: h.v, win: h.win })) }; },
  };
  Engine.register(A);
})();
