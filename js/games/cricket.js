// cricket.js — Standard, Cut-Throat, No-Score, Low Ball and Wild Card
'use strict';

(() => {
  const NAMES = { standard: 'STANDARD', cut: 'CUT-THROAT', noscore: 'NO-SCORE', low: 'LOW BALL', wild: 'WILD CARD' };
  const label = n => n === 25 ? 'B' : String(n);
  const val = n => n === 25 ? 25 : n;

  function pickWild(keep) {
    const out = keep.slice();
    while (out.length < 6) {
      const n = 1 + Math.floor(Math.random() * 20);
      if (!out.includes(n)) out.push(n);
    }
    return out.sort((a, b) => b - a);
  }
  const allClosed = (S, n) => S.sides.every(s => s.data.marks[n] >= 3);
  const totalMarks = side => Object.values(side.data.marks).reduce((a, m) => a + m, 0);

  // One mark glyph: 1 = slash, 2 = X, 3 = circled X
  function glyph(m) {
    if (!m) return '';
    let g = '<line x1="12" y1="40" x2="40" y2="12"/>';
    if (m >= 2) g += '<line x1="12" y1="12" x2="40" y2="40"/>';
    if (m >= 3) g += '<circle cx="26" cy="26" r="21"/>';
    return `<svg viewBox="0 0 52 52" class="mk m${Math.min(m, 3)}">${g}</svg>`;
  }

  const C = {
    id: 'cricket', name: 'CRICKET', bestOf: true, teams: true, maxPlayers: 8,
    options: [
      { key: 'kind', label: 'GAME', def: 'standard', values: Object.entries(NAMES) },
      { key: 'rounds', label: 'ROUND LIMIT', def: 20, values: [[0, 'NONE'], [15, '15'], [20, '20'], [25, '25']] },
    ],
    title(o) { return NAMES[o.kind] + ' CRICKET'; },

    init(c) {
      const k = c.opts.kind;
      const nums = k === 'low' ? [1, 2, 3, 4, 5, 6] : k === 'wild' ? pickWild([]) : [20, 19, 18, 17, 16, 15];
      c.shared.nums = nums.concat([25]);
      c.sides.forEach(s => {
        s.data = { marks: {}, pts: 0, turnMarks: 0 };
        for (let n = 1; n <= 20; n++) s.data.marks[n] = 0;
        s.data.marks[25] = 0;
      });
    },
    turnBegin(c) { c.side.data.turnMarks = 0; },

    // Wild Card: numbers nobody has marked are swapped at the end of each round
    roundEnd(S) {
      if (S.opts.kind !== 'wild') return;
      const keep = S.shared.nums.filter(n => n !== 25 && S.sides.some(s => s.data.marks[n] > 0));
      if (keep.length === 6) return;
      S.shared.nums = pickWild(keep).concat([25]);
      UI.toast('New wild numbers!');
    },

    dart(c, d) {
      const S = c.S, nums = S.shared.nums, k = S.opts.kind, sd = c.side.data;
      if (!d.num || !nums.includes(d.num)) return {};
      const before = sd.marks[d.num];
      const used = Math.min(d.mult, Math.max(0, 3 - before));
      let extra = d.mult - used;
      sd.marks[d.num] = Math.min(3, before + used) + 0;
      let counted = used;
      if (extra && k !== 'noscore') {
        const open = S.sides.filter(s => s !== c.side && s.data.marks[d.num] < 3);
        if (open.length) {
          if (k === 'cut') open.forEach(s => { s.data.pts += extra * val(d.num); });
          else sd.pts += extra * val(d.num);
          counted += extra;
        }
      }
      sd.turnMarks += counted;
      c.thrower.stats.marks += counted;
      // win check
      const closedAll = nums.every(n => sd.marks[n] >= 3);
      if (closedAll) {
        const others = S.sides.filter(s => s !== c.side);
        if (k === 'noscore') return { win: true };
        if (k === 'cut' ? others.every(s => sd.pts <= s.data.pts) : others.every(s => sd.pts >= s.data.pts)) return { win: true };
      }
      return {};
    },

    turnEnd(c) {
      const st = c.thrower.stats, m = c.side.data.turnMarks;
      st.bestTurn = Math.max(st.bestTurn || 0, m);
      if (m >= 5) st['m' + Math.min(m, 9)] = (st['m' + Math.min(m, 9)] || 0) + 1;
      const nums = c.S.shared.nums;
      const ds = c.darts.filter(d => !d.filler);
      const trip = ds.filter(d => d.mult === 3 && d.num !== 25 && nums.includes(d.num));
      if (trip.length === 3 && new Set(trip.map(d => d.num)).size === 3) return { big: 'WHITE HORSE', say: ['white_horse', 'White horse!'] };
      const g = Kit.generic(c.darts); if (g) return g;
      if (m >= 5) return { big: m + ' MARK', sub: m >= 9 ? 'PERFECT TURN' : '', say: ['mark' + m, m + ' mark!'] };
      return null;
    },

    roundLimit(S) { return S.opts.rounds || 0; },
    limitWinner(S) {
      const k = S.opts.kind;
      const score = s => k === 'noscore' ? totalMarks(s) : k === 'cut' ? -s.data.pts : s.data.pts;
      const rank = S.sides.map((s, i) => ({ i, a: score(s), b: totalMarks(s) }))
        .sort((x, y) => y.a - x.a || y.b - x.b);
      if (rank.length > 1 && rank[0].a === rank[1].a && rank[0].b === rank[1].b) {
        S.tied = rank.filter(r => r.a === rank[0].a && r.b === rank[0].b).map(r => r.i);
        return -1;
      }
      return rank[0].i;
    },

    // Screen
    box(side, S) { return { sc: S.opts.kind === 'noscore' ? totalMarks(side) + ' MK' : side.data.pts, sub: '' }; },
    turnTotal(c) { return c.side.data.turnMarks + ' MK'; },
    dartText(c, d) {
      if (!d.num) return null;
      if (!c.S.shared.nums.includes(d.num)) return { v: 'NO MARK', miss: true };
      return { v: d.mult === 3 ? 'TRIPLE' : d.mult === 2 ? 'DOUBLE' : 'SINGLE' };
    },
    upNext(side, S) { return S.opts.kind === 'noscore' ? totalMarks(side) + ' MARKS' : side.data.pts + ' POINTS'; },
    view(S, c) {
      const nums = S.shared.nums, sides = S.sides, n = sides.length, act = S.order[S.cur].side;
      const two = n === 2;
      const colW = n <= 2 ? 190 : n <= 4 ? 120 : 80;
      const cell = (s, num) => `<div class="cc${sides.indexOf(s) === act ? ' act' : ''}">${glyph(s.data.marks[num])}</div>`;
      let rows = '';
      nums.forEach(num => {
        const dead = allClosed(S, num);
        const mine = sides[act].data.marks[num] < 3 && !dead;
        const numCell = `<div class="cn${dead ? ' dead' : ''}${mine ? ' open' : ''}">${label(num)}</div>`;
        rows += `<div class="crow${dead ? ' dead' : ''}">` + (two ? cell(sides[0], num) + numCell + cell(sides[1], num)
          : numCell + sides.map(s => cell(s, num)).join('')) + '</div>';
      });
      const head = two ? `<div class="crow hd"><div class="cc${act === 0 ? ' act' : ''}">${esc(sides[0].name)}</div><div class="cn"></div><div class="cc${act === 1 ? ' act' : ''}">${esc(sides[1].name)}</div></div>`
        : `<div class="crow hd"><div class="cn"></div>${sides.map((s, i) => `<div class="cc${i === act ? ' act' : ''}">${esc(s.name)}</div>`).join('')}</div>`;
      return `<div class="cgrid" style="--cw:${colW}px">${head}${rows}</div>`;
    },
    aimLights(c) {
      const open = c.S.shared.nums.filter(n => n <= 20 && c.side.data.marks[n] < 3 && !allClosed(c.S, n));
      Board.Lights.targets(open, 'green');
    },

    // Computer: score on a number it owns while someone else has it open (when behind), else close the next number
    cpuAim(c) {
      const S = c.S, sd = c.side.data, k = S.opts.kind, nums = S.shared.nums;
      const others = S.sides.filter(s => s !== c.side);
      const behind = k === 'cut' ? others.some(s => s.data.pts < sd.pts) : others.some(s => s.data.pts >= sd.pts);
      if (k !== 'noscore' && behind) {
        const own = nums.find(n => sd.marks[n] >= 3 && others.some(s => s.data.marks[n] < 3));
        const L = Engine.LEVELS[c.thrower.level] || {};
        if (own && (L.t || 0) >= 0.2) return own === 25 ? 'SB' : 'T' + own;
      }
      const tgt = nums.find(n => sd.marks[n] < 3);
      if (!tgt) return 'T20';
      return tgt === 25 ? 'SB' : 'T' + tgt;
    },

    saveStats(S) {
      S.entrants.forEach(e => {
        const x = Kit.bucket(e, 'cricket', { games: 0, wins: 0, marks: 0, turns: 0, bestTurn: 0, m5: 0, m6: 0, m7: 0, m8: 0, m9: 0 });
        if (!x) return;
        const st = e.stats, won = Kit.won(S, e);
        x.games++; if (won) x.wins++;
        x.marks += st.marks; x.turns += st.turns;
        x.bestTurn = Math.max(x.bestTurn, st.bestTurn || 0);
        [5, 6, 7, 8, 9].forEach(m => { x['m' + m] += st['m' + m] || 0; });
        Kit.push(x.history, { at: Date.now(), mpr: st.turns ? +(st.marks / st.turns).toFixed(2) : 0, win: won, k: S.opts.kind });
      });
    },
    resultCols: ['MPR', 'MARKS', 'BEST TURN'],
    resultRow(e) { const s = e.stats; return [s.turns ? (s.marks / s.turns).toFixed(2) : '0.00', s.marks, s.bestTurn || 0]; },
    statKey: 'cricket', statName: 'CRICKET',
    statTiles(x) {
      return [[x.games || 0, 'GAMES'], [Kit.pct(x.wins, x.games), 'WINS'], [x.turns ? (x.marks / x.turns).toFixed(2) : '-', 'MPR'],
        [x.bestTurn || 0, 'BEST TURN'], [x.m5 || 0, '5 MARKS'], [x.m6 || 0, '6 MARKS'],
        [x.m7 || 0, '7 MARKS'], [(x.m8 || 0) + (x.m9 || 0), '8-9 MARKS'], [x.marks || 0, 'MARKS']];
    },
    statChart(x) { return { label: 'MPR', pts: (x.history || []).map(h => ({ v: h.mpr, win: h.win })) }; },
  };
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  Engine.register(C);
})();
