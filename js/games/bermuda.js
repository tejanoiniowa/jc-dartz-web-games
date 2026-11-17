// bermuda.js — Bermuda Triangle: 13 rounds, each with its own target.
// Hit it to score. Miss it with all 3 darts and your total is cut in half.
'use strict';

(() => {
  // 12, 13, 14, any double, 15, 16, 17, any triple, 18, 19, 20, outer bull, any bull
  const ROUNDS = [12, 13, 14, 'D', 15, 16, 17, 'T', 18, 19, 20, 'SB', 'B'];
  const SHORT = { D: 'D', T: 'T', SB: 'SB', B: 'B' };
  const BIG = { D: 'DOUBLE', T: 'TRIPLE', SB: 'BULL', B: 'BULL' };
  const LONG = { D: 'ANY DOUBLE', T: 'ANY TRIPLE', SB: 'OUTER BULL', B: 'ANY BULL' };
  const tgt = S => ROUNDS[Math.min(S.round, 13) - 1];
  function scores(t, d) {
    if (!d.num) return false;
    if (t === 'D') return d.mult === 2;
    if (t === 'T') return d.mult === 3;
    if (t === 'SB') return d.num === 25 && d.mult === 1;
    if (t === 'B') return d.num === 25;
    return d.num === t;
  }

  const B = {
    id: 'bermuda', name: 'BERMUDA TRIANGLE', group: 'practice', blurb: '13 targets. Miss one and your score is halved', maxPlayers: 8, solo: true,
    options: [],
    title() { return 'BERMUDA TRIANGLE'; },
    info(S) { return 'ROUND ' + Math.min(S.round, 13) + ' / 13'; },
    init(c) { c.sides.forEach(s => { s.data = { total: 0, turn: 0, hits: 0, rounds: [], survived: 0 }; }); },
    turnBegin(c) { c.side.data.turn = 0; c.side.data.hits = 0; },
    dart(c, d) {
      const sd = c.side.data;
      d.hitT = scores(tgt(c.S), d);
      if (d.hitT) { sd.turn += d.value; sd.hits++; sd.total += d.value; c.thrower.stats.points += d.value; }
      return d.hitT ? {} : { noCount: true };
    },
    turnEnd(c) {
      const sd = c.side.data, r = c.S.round - 1;
      if (!sd.hits) {
        const before = sd.total;
        sd.total = Math.floor(sd.total / 2);
        sd.rounds[r] = 'X';
        if (before > 0) return { big: 'LOST AT SEA', red: true, sub: 'SCORE CUT TO ' + sd.total, say: ['lost_at_sea', 'Lost at sea!'] };
        return null;
      }
      sd.rounds[r] = sd.turn; sd.survived++;
      return Kit.generic(c.darts);
    },
    roundLimit() { return 13; },
    limitWinner(S) {
      const t = S.sides.map(s => s.data.total), best = Math.max(...t);
      const w = t.map((v, i) => v === best ? i : -1).filter(i => i >= 0);
      if (w.length > 1) { S.tied = w; return -1; }
      return w[0];
    },

    label(c) { return 'ROUND ' + Math.min(c.S.round, 13) + ' · ' + (LONG[tgt(c.S)] ? 'HIT ' + LONG[tgt(c.S)] : 'HIT THE'); },
    big(c) { const t = tgt(c.S); return BIG[t] || t; },
    box(side) { return { sc: side.data.total, sub: side.data.survived + ' ROUNDS SURVIVED' }; },
    turnTotal(c) { return c.side.data.turn; },
    dartText(c, d) { return d.hitT ? { v: d.value } : { v: 'NO SCORE', miss: true }; },
    upNext(side) { return side.data.total + ' POINTS'; },
    aimLights(c) {
      const t = tgt(c.S);
      if (typeof t === 'number') Board.Lights.targets([t], 'green');
      else if (t === 'D' || t === 'T') Board.Lights.targets(Segs.BOARD_ORDER, t === 'D' ? 'yellow' : 'purple');
      else Board.Lights.turn(c.side.rgb);
    },
    // The 13-target track with each player's round scores (up to 4 players)
    extra(S) {
      if (S.sides.length > 4) return '';
      const cur = S.order[S.cur].side, now = Math.min(S.round, 13) - 1;
      let h = '<div class="card" style="--n:14;--cw:46px;--nw:110px"><div class="cr hd"><span></span>' +
        ROUNDS.map((t, i) => `<span class="${i === now ? 'now' : ''}">${SHORT[t] || t}</span>`).join('') + '<span>TOT</span></div>';
      S.sides.forEach((s, si) => {
        h += `<div class="cr${si === cur ? ' on' : ''}"><span class="nm">${s.name.replace(/[<>&]/g, '')}</span>` +
          ROUNDS.map((t, i) => { const v = s.data.rounds[i]; return `<span class="${v === 'X' ? 'o' : v ? 'u' : ''}">${v === undefined ? '' : v === 'X' ? '½' : v}</span>`; }).join('') +
          `<span class="t">${s.data.total}</span></div>`;
      });
      return h + '</div>';
    },
    cpuAim(c) {
      const t = tgt(c.S), L = Engine.LEVELS[c.thrower.level] || {};
      if (t === 'D') return c.side.data.hits ? 'D20' : 'D16';
      if (t === 'T') return 'T20';
      if (t === 'SB' || t === 'B') return 'SB';
      return ((L.t || 0) >= 0.2 ? 'T' : 'S') + t;
    },

    saveStats(S) {
      S.entrants.forEach(e => {
        const x = Kit.bucket(e, 'bermuda', { games: 0, wins: 0, best: 0, sum: 0, survived: 0 });
        if (!x) return;
        const sd = S.sides.find(s => s.members.includes(e.idx)).data, won = Kit.won(S, e);
        if (S.sides.length === 1) S.prevBest = x.games ? x.best : null;
        x.games++; if (won && S.sides.length > 1) x.wins++;
        x.sum += sd.total; x.best = Math.max(x.best, sd.total); x.survived += sd.survived;
        Kit.push(x.history, { at: Date.now(), v: sd.total, win: won });
      });
    },
    overNote(S) {
      if (S.sides.length !== 1 || S.prevBest === undefined) return '';
      const t = S.sides[0].data.total;
      if (S.prevBest === null) return 'FIRST GAME · ' + t + ' POINTS';
      return t > S.prevBest ? 'NEW PERSONAL BEST! (WAS ' + S.prevBest + ')' : 'PERSONAL BEST ' + S.prevBest;
    },
    resultCols: ['TOTAL', 'SURVIVED', 'LOST AT SEA'],
    resultRow(e, S) { const sd = S.sides.find(s => s.members.includes(e.idx)).data; return [sd.total, sd.survived + ' / 13', 13 - sd.survived]; },
    sortResults(a, b, S) { const f = x => S.sides.find(s => s.members.includes(x.idx)).data.total; return f(b) - f(a); },
    statKey: 'bermuda', statName: 'BERMUDA',
    statTiles(x) {
      return [[x.games || 0, 'GAMES'], [x.wins || 0, 'WINS'], [x.best || 0, 'BEST TOTAL'],
        [x.games ? Math.round(x.sum / x.games) : '-', 'AVG TOTAL'], [x.games ? (x.survived / x.games).toFixed(1) + ' / 13' : '-', 'AVG SURVIVED']];
    },
    statChart(x) { return { label: 'TOTAL', pts: (x.history || []).map(h => ({ v: h.v, win: h.win })) }; },
  };
  Engine.register(B);
})();
