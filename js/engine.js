// engine.js — turns, legs, matches, undo, computer players, awards
// A game module (see games/x01.js) supplies the rules; the engine runs the
// bar-machine flow around it: 3 darts, REMOVE DARTS, next player, and so on.
'use strict';

const Engine = (() => {
  const GAMES = {};
  let S = null;            // live match state (plain data, so undo can copy it)
  let G = null;            // the game module
  let undo = [];           // snapshots for undo
  let ignoreUntil = 0;     // pull-darts pause
  let timers = [];
  let preMatchPlayers = null;

  const LEVELS = {
    rookie: { name: 'ROOKIE', t: 0.04, d: 0.07, s: 0.42, b: 0.04, sb: 0.12 },
    casual: { name: 'CASUAL', t: 0.10, d: 0.14, s: 0.57, b: 0.08, sb: 0.2 },
    league: { name: 'LEAGUE', t: 0.20, d: 0.24, s: 0.72, b: 0.14, sb: 0.3 },
    pro:    { name: 'PRO',    t: 0.32, d: 0.36, s: 0.83, b: 0.24, sb: 0.36 },
    master: { name: 'MASTER', t: 0.46, d: 0.5,  s: 0.91, b: 0.36, sb: 0.4 },
  };
  const SIDE_RGB = [[224, 32, 27], [59, 110, 224], [143, 220, 42], [242, 200, 0], [190, 80, 230], [255, 140, 30], [60, 210, 230], [240, 240, 240]];

  function register(g) { GAMES[g.id] = g; }
  const now = () => Date.now();
  function later(fn, ms) { const t = setTimeout(() => { timers = timers.filter(x => x !== t); fn(); }, ms); timers.push(t); return t; }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  const clone = o => JSON.parse(JSON.stringify(o));

  // ---------------------------------------------------------------
  // Start a match
  // setup = { game, opts, entrants:[{kind,id,name,level,team}], teams, bestOf }
  // ---------------------------------------------------------------
  function start(setup) {
    clearTimers();
    G = GAMES[setup.game];
    const entrants = setup.entrants.map((e, i) => Object.assign({ idx: i, stats: { darts: 0, points: 0, marks: 0, turns: 0 } }, e));
    let sides;
    if (setup.teams) {
      const nT = Math.max(...entrants.map(e => e.team || 1));
      sides = [];
      for (let t = 1; t <= nT; t++) {
        const mem = entrants.filter(e => (e.team || 1) === t).map(e => e.idx);
        if (mem.length) sides.push({ name: 'TEAM ' + t, members: mem, legs: 0, data: {} });
      }
    } else {
      sides = entrants.map(e => ({ name: e.name, members: [e.idx], legs: 0, data: {} }));
    }
    sides.forEach((s, i) => { s.idx = i; s.rgb = SIDE_RGB[i % SIDE_RGB.length]; });
    S = {
      game: setup.game, opts: Object.assign({}, setup.opts), setup: clone(setup),
      entrants, sides, bestOf: G.bestOf ? (setup.bestOf || 1) : 1,
      leg: 1, starter: 0, order: [], cur: 0, turnNo: 0, round: 1,
      darts: [], phase: 'throw', winner: null, legWinner: null, shared: {},
    };
    undo = [];
    preMatchPlayers = null;
    newLeg();
    UI.show('game');
    render();
    announceTurn(true);
    maybeCpu();
  }

  // Throwing order: teams alternate (T1 A, T2 A, T1 B, T2 B ...)
  function buildOrder() {
    const n = S.sides.length, order = [];
    const maxM = Math.max(...S.sides.map(s => s.members.length));
    for (let m = 0; m < maxM; m++) {
      for (let k = 0; k < n; k++) {
        const s = S.sides[(S.starter + k) % n];
        order.push({ side: s.idx, e: s.members[m % s.members.length] });
      }
    }
    // A team with fewer players repeats its throwers; trim to full rounds of every member
    S.order = order;
  }

  function newLeg() {
    S.sides.forEach(s => { s.data = {}; });
    S.shared = {};
    buildOrder();
    S.cur = 0;
    G.init(ctx());
    S.cur = 0; S.turnNo = 0; S.round = 1; S.darts = []; S.phase = 'throw'; S.legWinner = null;
    G.turnBegin && G.turnBegin(ctx());
  }

  // Context handed to the game module
  function ctx() {
    const o = S.order[S.cur] || S.order[0];
    return {
      S, opts: S.opts, sides: S.sides, shared: S.shared,
      side: S.sides[o.side], thrower: S.entrants[o.e], darts: S.darts, round: S.round,
      dartsLeft: 3 - S.darts.length,
    };
  }
  const curEntrant = () => S.entrants[S.order[S.cur].e];
  const curSide = () => S.sides[S.order[S.cur].side];

  // ---------------------------------------------------------------
  // Darts
  // ---------------------------------------------------------------
  function hit(key, fromCpu) {
    if (!S || S.phase !== 'throw') return;
    if (!fromCpu && now() < ignoreUntil) return;
    if (!fromCpu && curEntrant().kind === 'cpu') return;
    if (S.darts.length >= 3) return;
    UI.closeAward();
    pushUndo();
    const d = Segs.parseSeg(key);
    const c = ctx();
    const res = G.dart(c, d) || {};
    d.res = res;
    S.darts.push(d);
    c.thrower.stats.darts++;

    if (res.bust) { Sound.bust(); Board.Lights.bust(); }
    else { Sound.hit(d); Board.Lights.hit(d); }
    if (res.say) Sound.say(res.say[0], res.say[1]);

    if (res.win) { endTurnQuiet(); legWon(curSide().idx); return; }
    if (res.legOver !== undefined) { endTurnQuiet(); legWon(res.legOver); return; }
    if (res.bust || res.endTurn || S.darts.length >= 3) { endTurn(); return; }
    render();
    UI.popScore();
  }

  function endTurn() {
    const c = ctx();
    const award = G.turnEnd ? G.turnEnd(c) : null;
    c.thrower.stats.turns++;
    S.phase = 'remove';
    if (S.legOverAfter != null) {
      const w = S.legOverAfter; S.legOverAfter = null;
      if (award && award.say) Sound.say(award.say[0], award.say[1]);
      legWon(w); return;
    }
    render();
    UI.popScore();
    const cpu = curEntrant().kind === 'cpu';
    const showRemove = () => {
      if (!S || S.phase !== 'remove') return;
      UI.showRemove(upNextInfo(), cpu);
      if (cpu) later(() => next(true), 2200);
      else if (Store.settings.nextPlayer > 0) later(() => next(true), Store.settings.nextPlayer * 1000);
    };
    if (award && Store.settings.effects !== 'off') {
      Sound.award(); Board.Lights.award();
      if (award.say) Sound.say(award.say[0], award.say[1]);
      UI.showAward(award, curEntrant().name);
      later(() => { UI.closeAward(); showRemove(); }, Store.settings.effects === 'subtle' ? 1400 : 2600);
    } else {
      if (award && award.say) Sound.say(award.say[0], award.say[1]);
      showRemove();
    }
  }

  function upNextInfo() {
    const n = nextIndex();
    const o = S.order[n], side = S.sides[o.side], e = S.entrants[o.e];
    const who = S.setup.teams ? e.name + ' · ' + side.name : e.name;
    return { who, line: G.upNext ? G.upNext(side, S) : '' };
  }

  function nextIndex() {
    if (G.pickNext) {
      const sd = G.pickNext(S);
      const i = S.order.findIndex(o => o.side === sd);
      if (i >= 0) return i;
    }
    let n = S.cur;
    for (let k = 0; k < S.order.length; k++) {
      n = (n + 1) % S.order.length;
      const side = S.sides[S.order[n].side];
      if (!(G.isOut && G.isOut(side, S))) return n;
    }
    return n;
  }

  // Next player (red button, NEXT, or auto). Unthrown darts count as misses.
  function next(auto) {
    if (!S) return;
    if (S.phase === 'over' || S.phase === 'legover') return;
    if (curEntrant().kind === 'cpu' && !auto) return;
    clearTimers();
    UI.closeAward();
    if (S.phase === 'throw') {
      pushUndo();
      while (S.darts.length < 3) {
        const d = Segs.parseSeg('OUT'); d.filler = true;
        const c = ctx(); d.res = G.dart(c, d) || {}; S.darts.push(d); c.thrower.stats.darts++;
        if (d.res.legOver !== undefined) { endTurnQuiet(); legWon(d.res.legOver); return; }
      }
      endTurnQuiet();
      if (S.legOverAfter != null) { const w = S.legOverAfter; S.legOverAfter = null; legWon(w); return; }
    }
    UI.hideRemove();
    const before = S.cur;
    S.cur = nextIndex();
    S.turnNo++;
    if (S.cur <= before && !G.pickNext) { S.round++; G.roundEnd && G.roundEnd(S); }
    else if (G.pickNext) S.round++;
    S.darts = [];
    S.phase = 'throw';
    const lim = G.roundLimit ? G.roundLimit(S) : 0;
    if (lim && S.round > lim) {
      const w = G.limitWinner(S);
      legWon(w);
      return;
    }
    G.turnBegin && G.turnBegin(ctx());
    ignoreUntil = now() + (Store.settings.pullPause || 0) * 1000;
    Sound.next();
    Board.Lights.turn(curSide().rgb);
    render();
    announceTurn(false);
    maybeCpu();
  }
  function endTurnQuiet() { const c = ctx(); G.turnEnd && G.turnEnd(c); c.thrower.stats.turns++; S.phase = 'remove'; }

  function announceTurn(first) {
    later(() => { if (S && G.aimLights) G.aimLights(ctx()); }, first ? 400 : 1700);
  }

  // ---------------------------------------------------------------
  // Legs and match end
  // ---------------------------------------------------------------
  function legWon(sideIdx) {
    clearTimers();
    UI.hideRemove();
    if (sideIdx < 0) {                       // a tie (round limit ran out level)
      S.phase = 'over'; S.winner = -1;
      Sound.win(); Board.Lights.win();
      Sound.say('tie', "It's a tie!");
      render();
      later(() => finishMatch(), 1600);
      return;
    }
    const side = S.sides[sideIdx];
    side.legs++;
    S.legWinner = sideIdx;
    const need = Math.floor(S.bestOf / 2) + 1;
    Sound.win();
    Board.Lights.win();
    if (side.legs >= need) {
      S.phase = 'over'; S.winner = sideIdx;
      if (G.solo && S.sides.length === 1) Sound.say('well_done', 'Well done!');
      else Sound.say('game_shot', 'Game shot! ' + side.name + ' wins!');
      render();
      later(() => finishMatch(), 1600);
      return;
    }
    S.phase = 'legover';
    Sound.say('game_shot', 'Game shot! Leg to ' + side.name);
    render();
    UI.showAward({ big: 'LEG WON', sub: side.name + ' · ' + side.legs + ' OF ' + need }, '');
    later(() => {
      UI.closeAward();
      S.leg++;
      S.starter = (sideIdx + 1) % S.sides.length;   // the other side throws first next leg
      newLeg();
      render();
      Board.Lights.turn(curSide().rgb);
      announceTurn(false);
      maybeCpu();
    }, 3000);
  }

  function finishMatch() {
    preMatchPlayers = clone(Store.players);
    if (G.saveStats) {
      G.saveStats(S);
      Store.savePlayers();
    }
    UI.showGameOver(S, G);
    Board.Lights.off();
  }

  // ---------------------------------------------------------------
  // Undo
  // ---------------------------------------------------------------
  function pushUndo() { undo.push(JSON.stringify(S)); if (undo.length > 80) undo.shift(); }
  function undoLast() {
    if (!S || !undo.length) return;
    const fromGameOver = S.phase === 'over';
    if (S.phase === 'legover' || fromGameOver) {
      // take the leg back: restore the side's leg count via the snapshot
      clearTimers();
      if (fromGameOver && preMatchPlayers) {
        Store.players.length = 0; preMatchPlayers.forEach(p => Store.players.push(p));
        Store.savePlayers(); preMatchPlayers = null;
      }
    }
    clearTimers();
    UI.closeAward(); UI.hideRemove();
    S = JSON.parse(undo.pop());
    G = GAMES[S.game];
    if (S.phase === 'remove') { S.phase = 'throw'; }
    UI.show('game');
    render();
    maybeCpu();
  }

  // ---------------------------------------------------------------
  // Computer players
  // ---------------------------------------------------------------
  function maybeCpu() {
    if (!S || S.phase !== 'throw') return;
    const e = curEntrant();
    if (e.kind !== 'cpu') return;
    const wait = (Store.settings.cpuWait || 5) * 1000;
    later(() => cpuDart(), S.darts.length ? 1300 : wait);
  }
  function cpuDart() {
    if (!S || S.phase !== 'throw' || curEntrant().kind !== 'cpu') return;
    const aim = G.cpuAim ? G.cpuAim(ctx()) : 'T20';
    const key = throwAt(aim, LEVELS[curEntrant().level] || LEVELS.league);
    hit(key, true);
    if (S && S.phase === 'throw' && curEntrant().kind === 'cpu') later(() => cpuDart(), 1300);
  }
  // Where a dart aimed at `aim` actually lands, for a level
  function throwAt(aim, L) {
    const a = Segs.parseSeg(aim), r = Math.random();
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    if (a.num === 25) {
      if (a.mult === 2) { if (r < L.b) return 'DB'; if (r < L.b + L.sb) return 'SB'; }
      else { if (r < L.sb + L.b * 0.5) return 'SB'; if (r < L.sb + L.b) return 'DB'; }
      return Math.random() < 0.15 ? 'OUT' : 'S' + pick(Segs.BOARD_ORDER) + 'I';
    }
    if (a.num === 0) return 'OUT';
    const nb = Segs.neighbors(a.num);
    if (a.mult === 3) {
      if (r < L.t) return 'T' + a.num;
      if (r < L.t + (1 - L.t) * 0.55) return 'S' + a.num + (Math.random() < 0.5 ? 'I' : 'O');
      if (r < L.t + (1 - L.t) * 0.92) return 'S' + pick(nb) + (Math.random() < 0.5 ? 'I' : 'O');
      return 'T' + pick(nb);
    }
    if (a.mult === 2) {
      if (r < L.d) return 'D' + a.num;
      if (r < L.d + (1 - L.d) * 0.4) return 'S' + a.num + 'O';
      if (r < L.d + (1 - L.d) * 0.75) return 'OUT';
      return Math.random() < 0.5 ? 'D' + pick(nb) : 'S' + pick(nb) + 'O';
    }
    if (r < L.s) return 'S' + a.num + (Math.random() < 0.5 ? 'I' : 'O');
    if (r < L.s + (1 - L.s) * 0.7) return 'S' + pick(nb) + 'I';
    return Math.random() < 0.5 ? 'T' + a.num : 'D' + a.num;
  }

  // ---------------------------------------------------------------
  function render() { if (S) UI.renderGame(S, G, ctx()); }
  function quit() { clearTimers(); UI.hideRemove(); UI.closeAward(); S = null; Board.Lights.off(); }
  function rematch() { if (S) start(S.setup); }

  return {
    register, start, hit, next, undo: undoLast, quit, rematch, LEVELS,
    get games() { return GAMES; }, get state() { return S; }, get canUndo() { return undo.length > 0; },
    _throwAt: throwAt,
  };
})();
window.Engine = Engine;
