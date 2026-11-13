// ui.js — every screen: main menu, game setup, game, game over, players, setup menu
'use strict';

const UI = (() => {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LOGO_SVG = '<img class="logo-s" src="icons/logo.png" alt="">';
  const LOGO = '<img class="logo" src="icons/logo.png" alt="JC Dartz">';
  const TEAM_CLS = ['t1', 't2', 't3', 't4'];

  let cur = 'main';
  const back = {};          // screen -> function for the BACK / Esc key
  let setup = null;         // game setup being edited
  let statsSel = null;
  let statsGame = 'x01';
  let shownAt = 0;         // when the last game pop-up appeared

  // ---------------------------------------------------------------
  // Basics
  // ---------------------------------------------------------------
  function show(id) {
    $$('.screen').forEach(s => s.classList.toggle('on', s.id === 'scr-' + id));
    cur = id;
    const fs = focusables();
    if (fs.length && !fs.some(f => f.classList.contains('sel'))) setSel(fs[0]);
    updateConn();
  }
  let toastT = 0;
  function toast(msg, ms) {
    const t = $('#toast'); if (!t) return;
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms || 3200);
  }
  function topbar(title, extra) {
    return `<div class="topbar">${LOGO}<h1 class="title">${title}</h1><div class="right">${extra || '<button class="conn" data-conn><span class="dot"></span><span class="t">BOARD</span></button>'}</div></div>`;
  }
  function updateConn() {
    $$('[data-conn]').forEach(b => {
      b.classList.toggle('ok', Board.state === 'ok');
      b.classList.toggle('busy', Board.state === 'busy');
      $('.t', b).textContent = Board.state === 'ok' ? (Board.name || 'CONNECTED').toUpperCase().slice(0, 14)
        : Board.state === 'busy' ? 'CONNECTING' : 'CONNECT BOARD';
    });
  }

  // ---------------------------------------------------------------
  // Focus (keyboard + red button on menus)
  // ---------------------------------------------------------------
  function root() { return $('.modal.on') || $('#scr-' + cur); }
  function focusables() { const r = root(); return r ? $$('[data-f]', r).filter(e => !e.disabled && e.offsetParent !== null) : []; }
  function setSel(el) {
    const r = root();
    $$('[data-f].sel', r).forEach(e => e.classList.remove('sel'));
    if (el) { el.classList.add('sel'); if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest' }); }
  }
  function moveSel(dir) {
    const fs = focusables(); if (!fs.length) return;
    let i = fs.findIndex(f => f.classList.contains('sel'));
    i = i < 0 ? 0 : (i + dir + fs.length) % fs.length;
    setSel(fs[i]); Sound.click();
  }
  function activate() {
    const fs = focusables(); const el = fs.find(f => f.classList.contains('sel')) || fs[0];
    if (!el) return;
    if (el.classList.contains('vbar')) { el._step && el._step(1); return; }
    el.click();
  }
  function stepSel(dir) {
    const el = focusables().find(f => f.classList.contains('sel'));
    if (el && el._step) el._step(dir); else moveSel(dir);
  }
  function goBack() {
    if ($('.modal.on')) { closeModal(); return; }
    if (back[cur]) back[cur]();
  }

  // bar(label, fn, cls)
  function bar(label, fn, cls) {
    const b = document.createElement('button');
    b.className = 'bar ' + (cls || ''); b.innerHTML = label; b.setAttribute('data-f', '');
    b.onclick = () => { Sound.click(); setSel(b); fn && fn(); };
    return b;
  }
  // vbar(label, values [[v,text]], get, set)
  function vbar(label, values, get, set) {
    const r = document.createElement('div');
    r.className = 'vbar'; r.setAttribute('data-f', '');
    r.innerHTML = `<span class="lbl">${label}</span><span class="ctl"><button class="arrow l" aria-label="previous"></button><span class="val"></span><button class="arrow r" aria-label="next"></button></span>`;
    const paint = () => { const v = get(); const f = values.find(x => x[0] === v) || values[0]; $('.val', r).textContent = f[1]; };
    r._step = dir => {
      let i = values.findIndex(x => x[0] === get()); if (i < 0) i = 0;
      i = (i + dir + values.length) % values.length;
      set(values[i][0]); paint(); Sound.click();
    };
    $('.arrow.l', r).onclick = e => { e.stopPropagation(); setSel(r); r._step(-1); };
    $('.arrow.r', r).onclick = e => { e.stopPropagation(); setSel(r); r._step(1); };
    r.onclick = () => setSel(r);
    paint();
    return r;
  }
  function menu(style, items) {
    const m = document.createElement('div'); m.className = 'menu'; m.style.cssText = style;
    items.forEach(i => m.appendChild(i)); return m;
  }
  function screen(id, html) {
    let s = $('#scr-' + id);
    if (!s) { s = document.createElement('div'); s.className = 'screen'; s.id = 'scr-' + id; $('#stage').appendChild(s); }
    s.innerHTML = html || '';
    $$('[data-conn]', s).forEach(b => b.onclick = () => Board.connect(Store.settings.btAll));
    return s;
  }

  // ---------------------------------------------------------------
  // Modal
  // ---------------------------------------------------------------
  // opts: { title, text, input:{value,placeholder}, items:[{t, fn(value), cls}], cancel }
  function modal(o) {
    const m = $('#modal');
    m.innerHTML = `<div class="box"><h2>${o.title || ''}</h2>${o.text ? '<p>' + o.text + '</p>' : ''}${o.input ? '<input maxlength="16" autocomplete="off" spellcheck="false">' : ''}<div class="mitems"></div></div>`;
    const inp = $('input', m);
    if (inp) { inp.value = o.input.value || ''; inp.placeholder = o.input.placeholder || ''; }
    const box = $('.mitems', m);
    (o.items || []).forEach(it => box.appendChild(bar(it.t, () => { const v = inp ? inp.value : undefined; if (it.keep !== true) closeModal(); it.fn && it.fn(v); }, 'small ' + (it.cls || ''))));
    if (o.cancel !== false) box.appendChild(bar('CANCEL', () => closeModal(), 'small'));
    m.classList.add('on');
    const fs = focusables(); if (fs.length) setSel(fs[0]);
    if (inp) {
      setTimeout(() => inp.focus(), 50);
      inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); box.firstChild && box.firstChild.click(); } if (e.key === 'Escape') closeModal(); };
    }
  }
  function closeModal() { const m = $('#modal'); m.classList.remove('on'); m.innerHTML = ''; }
  function confirm(title, text, yes, fn) { modal({ title, text, items: [{ t: yes, fn, cls: 'go' }] }); }

  // ---------------------------------------------------------------
  // Main menu
  // ---------------------------------------------------------------
  function buildMain() {
    const s = screen('main', topbar('MAIN MENU'));
    const games = Object.values(Engine.games);
    const items = games.map(g => bar(g.name, () => openSetup(g.id), 'big'));
    items.push(bar('PLAYERS &amp; STATS', () => openPlayers(), 'big'));
    items.push(bar('SETUP', () => openSettings(), 'big'));
    s.appendChild(menu('left: 340px; width: 600px; top: 96px; gap: 10px', items));
    s.insertAdjacentHTML('beforeend', '<div class="hint"><span class="btn-dot"></span>RED BUTTON SELECTS · TAP TO CHOOSE</div>');
  }

  // ---------------------------------------------------------------
  // Game setup: players on the left, options on the right
  // ---------------------------------------------------------------
  function lastSetup(gameId) {
    try { const all = JSON.parse(localStorage.getItem('jcw_last') || '{}'); return all[gameId] || null; } catch (e) { return null; }
  }
  function saveLast() {
    try {
      const all = JSON.parse(localStorage.getItem('jcw_last') || '{}');
      all[setup.game] = { opts: setup.opts, entrants: setup.entrants, teams: setup.teams, bestOf: setup.bestOf };
      localStorage.setItem('jcw_last', JSON.stringify(all));
    } catch (e) {}
  }
  function openSetup(gameId) {
    const g = Engine.games[gameId];
    const last = lastSetup(gameId);
    setup = { game: gameId, opts: {}, entrants: [], teams: false, bestOf: 1 };
    g.options.forEach(o => { setup.opts[o.key] = o.def; });
    if (last) {
      Object.keys(setup.opts).forEach(k => { if (last.opts && last.opts[k] !== undefined) setup.opts[k] = last.opts[k]; });
      setup.teams = !!last.teams && !!g.teams; setup.bestOf = g.bestOf ? (last.bestOf || 1) : 1;
      setup.entrants = (last.entrants || []).filter(e => e.kind !== 'player' || Store.get(e.id)).map(e => {
        if (e.kind === 'player') e.name = Store.get(e.id).name; return e;
      });
    }
    renderSetup();
    show('setup');
  }
  function renderSetup() {
    const g = Engine.games[setup.game];
    const s = screen('setup', topbar(g.name));
    back.setup = () => show('main');
    const max = g.maxPlayers || 8;

    // left: players
    const left = document.createElement('div');
    left.className = 'menu'; left.style.cssText = 'left: 40px; width: 560px; top: 100px; gap: 8px';
    left.innerHTML = '<div class="sect">PLAYERS</div>';
    setup.entrants.forEach((e, i) => {
      const sl = document.createElement('div');
      sl.className = 'slot' + (setup.teams ? ' ' + TEAM_CLS[(e.team || 1) - 1] : '');
      const kind = e.kind === 'cpu' ? 'CPU' : e.kind === 'guest' ? 'GUEST' : 'P' + (i + 1);
      sl.innerHTML = `<span class="n">${kind}</span><span class="nm">${esc(e.name)}</span>${setup.teams ? `<button class="tm">TEAM ${e.team || 1}</button>` : ''}<button class="x" aria-label="remove">×</button>`;
      $('.x', sl).onclick = () => { setup.entrants.splice(i, 1); renderSetup(); };
      if (setup.teams) $('.tm', sl).onclick = () => { const nT = Math.min(4, Math.max(2, setup.entrants.length)); e.team = (e.team || 1) % nT + 1; renderSetup(); };
      left.appendChild(sl);
    });
    if (setup.entrants.length < max) {
      const r = document.createElement('div'); r.className = 'row';
      r.appendChild(bar('+ PLAYER', addPlayerPick, 'small'));
      r.appendChild(bar('+ GUEST', addGuest, 'small'));
      if (!g.noCpu) r.appendChild(bar('+ COMPUTER', addCpu, 'small'));
      left.appendChild(r);
    }
    if (!setup.entrants.length) left.insertAdjacentHTML('beforeend', '<div class="empty">Add players to start. Guests and computers don\'t keep stats.</div>');
    else if (setup.entrants.length < (g.minPlayers || 1)) left.insertAdjacentHTML('beforeend', '<div class="empty">' + g.name + ' needs at least ' + g.minPlayers + ' players.</div>');
    s.appendChild(left);

    // right: options
    const items = [document.createRange().createContextualFragment('<div class="sect">OPTIONS</div>')];
    g.options.forEach(o => items.push(vbar(o.label, o.values, () => setup.opts[o.key], v => { setup.opts[o.key] = v; })));
    if (g.bestOf) items.push(vbar('MATCH', [[1, 'SINGLE GAME'], [3, 'BEST OF 3'], [5, 'BEST OF 5']], () => setup.bestOf, v => { setup.bestOf = v; }));
    if (g.teams) items.push(vbar('TEAMS', [[false, 'OFF'], [true, 'ON']], () => setup.teams, v => {
      setup.teams = v;
      if (v) setup.entrants.forEach((e, i) => { e.team = (i % 2) + 1; });
      renderSetup();
    }));
    const ok = canStart();
    const go = bar('START', startGame, 'big go'); go.disabled = !ok;
    items.push(go);
    items.push(bar('BACK', () => show('main'), 'small'));
    const right = document.createElement('div'); right.className = 'menu'; right.style.cssText = 'left: 640px; width: 600px; top: 100px; gap: 10px';
    items.forEach(i => right.appendChild(i));
    s.appendChild(right);
    if (cur === 'setup') { const fs = focusables(); setSel(ok ? go : fs[0]); }
  }
  function canStart() {
    const g = Engine.games[setup.game];
    if (setup.entrants.length < (g.minPlayers || 1)) return false;
    if (setup.teams) { const t = new Set(setup.entrants.map(e => e.team || 1)); return t.size >= 2; }
    return true;
  }
  function addEntrant(e) {
    if (setup.teams) {
      const counts = {}; setup.entrants.forEach(x => { counts[x.team || 1] = (counts[x.team || 1] || 0) + 1; });
      e.team = (counts[1] || 0) <= (counts[2] || 0) ? 1 : 2;
    }
    setup.entrants.push(e); renderSetup();
  }
  function addPlayerPick() {
    const used = new Set(setup.entrants.filter(e => e.kind === 'player').map(e => e.id));
    const avail = Store.players.filter(p => !used.has(p.id));
    const items = avail.slice(0, 8).map(p => ({ t: esc(p.name), fn: () => addEntrant({ kind: 'player', id: p.id, name: p.name }) }));
    items.push({ t: 'NEW PLAYER', cls: 'go', fn: () => newPlayer(p => addEntrant({ kind: 'player', id: p.id, name: p.name })) });
    modal({ title: 'ADD PLAYER', text: avail.length ? '' : 'No saved players yet.', items });
  }
  function newPlayer(then) {
    modal({
      title: 'NEW PLAYER', input: { placeholder: 'NAME' }, items: [{
        t: 'SAVE', cls: 'go', keep: true, fn: v => {
          const p = Store.addPlayer(v);
          if (!p) { toast('Type a name'); return; }
          if (p === 'dup') { toast('That name is taken'); return; }
          closeModal(); then && then(p);
        }
      }]
    });
  }
  function addGuest() {
    let n = 1; while (setup.entrants.some(e => e.name === 'GUEST ' + n)) n++;
    addEntrant({ kind: 'guest', id: 'g' + Date.now(), name: 'GUEST ' + n });
  }
  function addCpu() {
    modal({
      title: 'COMPUTER LEVEL', items: Object.keys(Engine.LEVELS).map(k => ({
        t: Engine.LEVELS[k].name, fn: () => {
          const base = Engine.LEVELS[k].name; let name = base, n = 2;
          while (setup.entrants.some(e => e.name === name)) name = base + ' ' + n++;
          addEntrant({ kind: 'cpu', id: 'c' + Date.now(), name, level: k });
        }
      }))
    });
  }
  function startGame() {
    if (!canStart()) return;
    saveLast();
    let entrants = setup.entrants.slice();
    if (setup.teams) entrants = entrants.slice().sort((a, b) => (a.team || 1) - (b.team || 1));
    Sound.unlock();
    Engine.start({ game: setup.game, opts: setup.opts, entrants, teams: setup.teams, bestOf: setup.bestOf });
  }

  // ---------------------------------------------------------------
  // Game screen
  // ---------------------------------------------------------------
  function buildGame() {
    const s = screen('game', `
      <div class="info"><div class="a" id="g-a"></div><div class="b">${LOGO_SVG}</div><div class="c" id="g-c"></div></div>
      <div id="g-boxes"></div>
      <div class="center"><div class="glbl" id="g-lbl"></div><div class="bigscore" id="g-big"></div><div class="thrower" id="g-who"></div><div class="checkout" id="g-co"></div></div>
      <div id="g-view"></div><div id="g-extra"></div>
      <div class="gbtns" id="g-btns"></div>
      <div class="strip"><div class="lg">${LOGO}</div><div class="darts" id="g-darts"></div><div class="turn"><span class="n">TURN</span><span class="v" id="g-turn">0</span></div></div>
      <div class="ovl" id="g-rm"><div class="dim"></div><div class="panel up"><div class="a" id="rm-who"></div><div class="b" id="rm-line"></div></div><div class="panel rm"><div class="a">REMOVE DARTS</div><div class="b" id="rm-b"></div></div></div>
      <div class="ovl" id="g-award"></div>`);
    const b = $('#g-btns', s);
    const mk = (t, cls, fn) => { const x = document.createElement('button'); x.className = 'gbtn ' + cls; x.textContent = t; x.onclick = () => { Sound.click(); fn(); }; b.appendChild(x); return x; };
    mk('NEXT', 'g-next', () => Engine.next());
    mk('UNDO', 'g-undo', () => Engine.undo());
    mk('MENU', 'g-menu', pauseMenu);
    // Ignore the tail end of the tap that threw the last dart (it lands on the panel)
    $('#g-rm', s).onclick = () => { if (Date.now() - shownAt > 800) Engine.next(); };
    $('#g-award', s).onclick = () => { if (Date.now() - shownAt > 800) closeAward(); };
    back.game = pauseMenu;
    s.appendChild(buildTapBoard());
  }
  function pauseMenu() {
    modal({
      title: 'GAME MENU', items: [
        { t: 'RESUME', cls: 'go' },
        { t: 'RESTART GAME', fn: () => confirm('RESTART?', 'Start this game over from the beginning.', 'RESTART', () => Engine.rematch()) },
        { t: 'QUIT TO MAIN MENU', fn: () => confirm('QUIT GAME?', 'This game won\'t count in stats.', 'QUIT', () => { Engine.quit(); show('main'); }) },
      ], cancel: false
    });
  }

  function boxPos(n, i) {
    if (n <= 4) {
      const L = 22, R = 1280 - 22 - 230, T = 18, B = 720 - 92 - 118 - 16;
      return [[L, T], [R, T], [L, B], [R, B]][i];
    }
    const col = i % 2, row = Math.floor(i / 2);
    return [col ? 1280 - 22 - 196 : 22, 18 + row * 102];
  }

  function renderGame(S, G, c) {
    if (cur !== 'game') show('game');
    const n = S.sides.length, small = n > 4;
    const need = Math.floor(S.bestOf / 2) + 1;
    const active = S.order[S.cur].side;
    // player boxes
    const wrap = $('#g-boxes');
    if (wrap.children.length !== n) {
      wrap.innerHTML = S.sides.map(() => `<div class="pbox${small ? ' small' : ''}"><div class="legs"></div><div class="nm"></div><div class="sc"></div><div class="sub"></div></div>`).join('');
    }
    S.sides.forEach((side, i) => {
      const el = wrap.children[i], p = boxPos(n, i), bx = G.box(side, S);
      el.style.left = p[0] + 'px'; el.style.top = p[1] + 'px';
      el.classList.toggle('on', i === active && S.phase !== 'over');
      $('.nm', el).textContent = S.setup.teams ? side.name : side.name;
      $('.sc', el).textContent = bx.sc;
      let sub = bx.sub || '';
      if (S.setup.teams) sub = side.members.map(m => S.entrants[m].name).join(' · ');
      $('.sub', el).textContent = sub;
      $('.legs', el).innerHTML = S.bestOf > 1 ? Array.from({ length: need }, (_, k) => `<i class="${k < side.legs ? 'won' : ''}"></i>`).join('') : '';
    });
    // info strip
    const lim = G.roundLimit ? G.roundLimit(S) : 0;
    $('#g-a').textContent = G.info ? G.info(S) : 'ROUND ' + S.round + (lim ? ' / ' + lim : '') + (S.bestOf > 1 ? ' · LEG ' + S.leg : '');
    $('#g-c').textContent = G.title ? G.title(S.opts) : G.name;
    // centre
    const view = $('#g-view'), extra = $('#g-extra');
    $('.center', $('#scr-game')).style.display = G.view ? 'none' : '';
    view.innerHTML = G.view ? G.view(S, c) : '';
    extra.innerHTML = G.extra ? G.extra(S, c) : '';
    $('#g-lbl').textContent = G.label ? G.label(c) : '';
    $('#g-lbl').style.display = G.label ? '' : 'none';
    const big = $('#g-big');
    big.classList.toggle('mid', !!(G.extra && extra.innerHTML));
    if (!G.view) big.textContent = G.big(c);
    big.classList.toggle('bust', !!(G.bust && G.bust(c)));
    const e = c.thrower;
    $('#g-who').textContent = (e.kind === 'cpu' ? e.name + ' (COMPUTER)' : e.name) + (S.setup.teams ? ' · ' + c.side.name : '');
    const h = S.phase === 'throw' && G.hint ? G.hint(c) : null;
    const co = $('#g-co');
    if (h) {
      co.innerHTML = `<span class="lbl">${h.label}</span>` + (h.route || []).map(k => {
        const d = Segs.parseSeg(k); const cls = d.num === 25 ? 'b' : d.mult === 3 ? 't' : d.mult === 2 ? 'd' : '';
        return `<span class="seg ${cls}">${Segs.segShort(d)}</span>`;
      }).join('');
    } else co.innerHTML = '';
    // dart strip
    let html = '';
    for (let k = 0; k < 3; k++) {
      const d = S.darts[k];
      if (!d) html += `<div class="dart ${k === S.darts.length && S.phase === 'throw' ? 'next' : 'empty'}"><span class="n">DART ${k + 1}</span><span class="v">-</span></div>`;
      else {
        const v = G.value ? G.value(c, d) : d.value;
        const t = G.dartText ? G.dartText(c, d) : null;
        const miss = t ? !!t.miss || !d.num : (!d.num || d.res && d.res.bust);
        const shown = d.res && d.res.bust ? 'BUST' : t && t.v !== undefined ? t.v : d.num ? v : 'MISS';
        html += `<div class="dart ${miss ? 'miss' : 'hit'}"><span class="n">${d.filler ? 'NO DART' : Segs.segName(d).toUpperCase()}</span><span class="v">${shown}</span></div>`;
      }
    }
    $('#g-darts').innerHTML = html;
    $('#g-turn').textContent = G.turnTotal ? G.turnTotal(c) : '';
    // buttons
    const cpu = e.kind === 'cpu';
    $('.gbtn.g-next').disabled = cpu || S.phase === 'over' || S.phase === 'legover';
    $('.gbtn.g-undo').disabled = !Engine.canUndo;
    const btns = $('#g-btns'); btns.style.top = (small ? 430 : 160) + 'px';
    const tb = $('#tapboard');
    if (small) { tb.style.left = '232px'; tb.style.top = '150px'; tb.style.width = tb.style.height = '250px'; }
    else { tb.style.left = '22px'; tb.style.top = '150px'; tb.style.width = tb.style.height = n > 2 ? '330px' : '300px'; }
    if (n > 2 && !small) tb.style.top = '140px';
    tb.classList.toggle('on', !!Store.settings.tapBoard && !cpu && S.phase === 'throw');
  }
  function popScore() {
    const b = $('#g-big'); if (!b || Store.settings.effects === 'off') return;
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  }
  function showRemove(info, cpu) {
    $('#rm-who').textContent = info.who;
    $('#rm-line').textContent = info.line || '';
    const np = Store.settings.nextPlayer;
    $('#rm-b').textContent = cpu ? 'COMPUTER IS PULLING ITS DARTS' : np ? 'NEXT PLAYER IN ' + np + ' SECONDS' : 'PRESS THE BUTTON FOR NEXT PLAYER';
    if (!$('#g-rm').classList.contains('on')) shownAt = Date.now();
    $('#g-rm').classList.add('on');
    $('#tapboard').classList.remove('on');
  }
  function hideRemove() { const r = $('#g-rm'); if (r) r.classList.remove('on'); }
  function showAward(a, who) {
    const o = $('#g-award'); if (!o) return;
    const fx = Store.settings.effects;
    o.innerHTML = `<div class="award">${fx === 'full' ? '<div class="ring" style="width:700px;height:700px;border:10px solid var(--yel)"></div><div class="ring" style="width:700px;height:700px;border:10px solid var(--red);animation-delay:.35s"></div>' : ''}
      ${who ? `<div class="who">${esc(who)}</div>` : ''}<div class="big${a.red ? ' red' : ''}">${a.big}</div>${a.sub ? `<div class="sub">${a.sub}</div>` : ''}</div>`;
    o.classList.add('on');
    shownAt = Date.now();
  }
  function closeAward() { const o = $('#g-award'); if (o) { o.classList.remove('on'); o.innerHTML = ''; } }

  // ---------------------------------------------------------------
  // Tap board (score by tapping, for testing without Bluetooth)
  // ---------------------------------------------------------------
  function buildTapBoard() {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.id = 'tapboard'; svg.setAttribute('viewBox', '-200 -200 400 400');
    const pt = (r, a) => [r * Math.sin(a * Math.PI / 180), -r * Math.cos(a * Math.PI / 180)];
    const sector = (r0, r1, a0, a1) => {
      const [x0, y0] = pt(r1, a0), [x1, y1] = pt(r1, a1), [x2, y2] = pt(r0, a1), [x3, y3] = pt(r0, a0);
      return `M${x0} ${y0}A${r1} ${r1} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`;
    };
    let h = `<circle class="tapmiss" r="198" fill="#15182a" data-k="OUT"/>`;
    Segs.BOARD_ORDER.forEach((num, i) => {
      const a0 = i * 18 - 9, a1 = a0 + 18, dark = i % 2 === 0;
      const sCol = dark ? '#1b1b1b' : '#e9dfc4', rCol = dark ? '#c8241e' : '#1f8a3a';
      h += `<path d="${sector(170, 180, a0, a1)}" fill="${rCol}" data-k="D${num}"/>`;
      h += `<path d="${sector(110, 170, a0, a1)}" fill="${sCol}" data-k="S${num}O"/>`;
      h += `<path d="${sector(100, 110, a0, a1)}" fill="${rCol}" data-k="T${num}"/>`;
      h += `<path d="${sector(18, 100, a0, a1)}" fill="${sCol}" data-k="S${num}I"/>`;
      const [tx, ty] = pt(190, i * 18);
      h += `<text x="${tx}" y="${ty + 5}" fill="#fff" font-size="15" text-anchor="middle" pointer-events="none" font-family="Teko">${num}</text>`;
    });
    h += `<circle r="18" fill="#1f8a3a" data-k="SB"/><circle r="7" fill="#c8241e" data-k="DB"/>`;
    svg.innerHTML = h;
    svg.addEventListener('pointerdown', e => {
      const k = e.target.getAttribute && e.target.getAttribute('data-k');
      if (k) { e.preventDefault(); Engine.hit(k); }
    });
    return svg;
  }

  // ---------------------------------------------------------------
  // Game over
  // ---------------------------------------------------------------
  function showGameOver(S, G) {
    const s = screen('over', topbar('GAME OVER', ' '));
    back.over = () => show('main');
    const tie = S.winner < 0;
    const winSides = tie ? (S.tied || []) : [S.winner];
    const isW = e => winSides.some(i => S.sides[i].members.includes(e.idx));
    const cols = G.resultCols || [];
    let rows = `<div class="tr th"><span>PLAYER</span>${cols.map(c => `<span>${c}</span>`).join('')}</div>`;
    const order = S.entrants.slice().sort((a, b) => (isW(b) ? 1 : 0) - (isW(a) ? 1 : 0) || (G.sortResults ? G.sortResults(a, b, S) : 0));
    order.slice(0, 8).forEach(e => {
      rows += `<div class="tr${isW(e) ? ' w' : ''}"><span>${esc(e.name)}</span>${G.resultRow(e, S).map(v => `<span>${v}</span>`).join('')}</div>`;
    });
    const left = document.createElement('div');
    left.style.cssText = 'position:absolute; left:40px; top:110px; width:700px; display:flex; flex-direction:column; gap:14px; z-index:2';
    const legs = S.bestOf > 1 ? ' · ' + S.sides.map(x => x.legs).join(' - ') : '';
    const solo = S.sides.length === 1;
    const head = solo ? 'ROUND COMPLETE' : tie ? 'TIE GAME' : 'WINNER' + legs;
    const who = solo ? S.sides[0].name : winSides.map(i => S.sides[i].name).join(' & ');
    const note = G.overNote ? G.overNote(S) : '';
    left.innerHTML = `<div class="winner"><div class="a">${head}</div><div class="b">${esc(who)}</div></div>${note ? `<div class="sect" style="color:var(--yel)">${note}</div>` : ''}<div class="table" style="grid-template-columns:${'1fr '.repeat(cols.length)}">${rows}</div>`;
    s.appendChild(left);
    $$('.table .tr', s).forEach(r => { r.style.gridTemplateColumns = '1.6fr' + ' 1fr'.repeat(cols.length); });
    s.appendChild(menu('left: 780px; width: 460px; top: 110px', [
      bar(solo ? 'GO AGAIN' : 'REMATCH', () => Engine.rematch(), 'big go'),
      bar('NEW GAME', () => openSetup(S.game), 'big'),
      bar('PLAYERS &amp; STATS', () => openPlayers(), 'big'),
      bar('MAIN MENU', () => { Engine.quit(); show('main'); }, 'big'),
      bar('UNDO LAST DART', () => Engine.undo(), 'small'),
    ]));
    show('over');
    setSel($('.bar.go', s));
  }

  // ---------------------------------------------------------------
  // Players & stats
  // ---------------------------------------------------------------
  function openPlayers() { renderPlayers(); show('players'); }
  function renderPlayers() {
    const s = screen('players', topbar('PLAYERS &amp; STATS'));
    back.players = () => show('main');
    const ps = Store.players;
    if (statsSel && !Store.get(statsSel)) statsSel = null;
    if (!statsSel && ps.length) statsSel = ps[0].id;
    const list = document.createElement('div'); list.className = 'plist';
    const scroll = document.createElement('div'); scroll.style.cssText = 'display:flex; flex-direction:column; gap:10px; max-height:430px; overflow-y:auto';
    ps.forEach(p => {
      const sl = document.createElement('div'); sl.className = 'slot' + (p.id === statsSel ? ' sel' : ''); sl.setAttribute('data-f', '');
      const x = Object.values(p.stats).reduce((a, b) => ({ games: (a.games || 0) + ((b && b.games) || 0) }), {});
      sl.innerHTML = `<span class="nm">${esc(p.name)}</span><span class="n" style="width:auto">${x.games || 0} GAME${x.games === 1 ? '' : 'S'}</span>`;
      sl.onclick = () => { statsSel = p.id; renderPlayers(); };
      scroll.appendChild(sl);
    });
    if (!ps.length) scroll.innerHTML = '<div class="empty">No players yet. Add one to start keeping stats.</div>';
    list.appendChild(scroll);
    const r = document.createElement('div'); r.className = 'row';
    r.appendChild(bar('ADD PLAYER', () => newPlayer(p => { statsSel = p.id; renderPlayers(); }), 'small'));
    if (statsSel) {
      r.appendChild(bar('RENAME', renamePlayer, 'small'));
      r.appendChild(bar('DELETE', () => {
        const p = Store.get(statsSel);
        confirm('DELETE ' + esc(p.name) + '?', 'Their stats will be gone for good.', 'DELETE', () => { Store.removePlayer(p.id); statsSel = null; renderPlayers(); });
      }, 'small'));
    }
    list.appendChild(r);
    list.appendChild(bar('BACK', () => show('main'), 'small'));
    s.appendChild(list);

    const st = document.createElement('div'); st.className = 'pstats';
    const p = statsSel && Store.get(statsSel);
    if (p) {
      const games = Object.values(Engine.games).filter(g => g.statKey);
      let g = games.find(x => x.id === statsGame) || games[0];
      const x = p.stats[g.statKey] || { history: [] };
      const stat = (v, l) => `<div class="stat"><div class="v">${v}</div><div class="l">${l}</div></div>`;
      const ch = g.statChart(x);
      st.innerHTML = `<div class="gtabs"></div><div class="statgrid">${g.statTiles(x).map(t => stat(t[0], t[1])).join('')}</div>
        <div class="chart">${chart(ch.pts, ch.label)}</div>`;
      const tabs = $('.gtabs', st);
      games.forEach(gm => {
        const b = bar(gm.statName, () => { statsGame = gm.id; renderPlayers(); }, 'small' + (gm === g ? ' on' : ''));
        tabs.appendChild(b);
      });
    } else st.innerHTML = '';
    s.appendChild(st);
    show('players');
  }
  function chart(h, label) {
    if (h.length < 2) return '<div class="empty">' + label + ' chart shows after 2 games.</div>';
    const W = 560, H = 120, pts = h.slice(-20);
    let lo = Math.min(0, ...pts.map(p => p.v)), hi = Math.max(1, ...pts.map(p => p.v));
    const pad = (hi - lo) * 0.15; hi += pad;
    const xy = pts.map((p, i) => [10 + i * (W - 20) / (pts.length - 1), H - 10 - ((p.v - lo) / (hi - lo)) * (H - 30)]);
    return `<svg viewBox="0 0 ${W} ${H}" aria-label="${label}, last ${pts.length} games">
      <text x="8" y="16" fill="#9fb0d4" font-size="16" font-family="Teko" letter-spacing="2">${label} · LAST ${pts.length} GAMES</text>
      <polyline points="${xy.map(p => p.join(',')).join(' ')}" fill="none" stroke="#f2e600" stroke-width="3"/>
      ${xy.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="5" fill="${pts[i].win ? '#8fdc2a' : '#4a5a80'}"/>`).join('')}</svg>`;
  }
  function renamePlayer() {
    const p = Store.get(statsSel); if (!p) return;
    modal({
      title: 'RENAME', input: { value: p.name }, items: [{
        t: 'SAVE', cls: 'go', keep: true, fn: v => {
          v = String(v || '').trim().slice(0, 16);
          if (!v) { toast('Type a name'); return; }
          if (Store.players.some(q => q !== p && q.name.toLowerCase() === v.toLowerCase())) { toast('That name is taken'); return; }
          p.name = v; Store.savePlayers(); closeModal(); renderPlayers();
        }
      }]
    });
  }

  // ---------------------------------------------------------------
  // Setup menu (settings)
  // ---------------------------------------------------------------
  function openSettings() { renderSettings(); show('settings'); }
  function renderSettings() {
    const s = screen('settings', topbar('SETUP'));
    back.settings = () => show('main');
    const st = Store.settings;
    const set = k => v => { st[k] = v; Store.saveSettings(); applySettings(); };
    const get = k => () => st[k];
    const L = [
      vbar('LAYOUT', [['auto', 'FIT SCREEN'], ['tv', 'TV (SAFE EDGES)']], get('layout'), set('layout')),
      vbar('NEXT PLAYER', [[0, 'BUTTON'], [2, 'AUTO 2 SEC'], [3, 'AUTO 3 SEC'], [5, 'AUTO 5 SEC']], get('nextPlayer'), set('nextPlayer')),
      vbar('PULL DARTS PAUSE', [[0, 'OFF'], [3, '3 SEC'], [4, '4 SEC'], [5, '5 SEC']], get('pullPause'), set('pullPause')),
      vbar('COMPUTER WAITS', [[3, '3 SEC'], [5, '5 SEC'], [8, '8 SEC'], [12, '12 SEC']], get('cpuWait'), set('cpuWait')),
      vbar('EFFECTS', [['full', 'FULL'], ['subtle', 'SUBTLE'], ['off', 'OFF']], get('effects'), set('effects')),
      vbar('LITE MODE', [['auto', 'AUTO'], ['on', 'ON'], ['off', 'OFF']], get('lite'), set('lite')),
      vbar('SOUND', [['off', 'OFF'], ['low', 'LOW'], ['medium', 'MEDIUM'], ['high', 'HIGH']], get('sound'), set('sound')),
    ];
    const R = [
      vbar('ANNOUNCER', [[true, 'ON'], [false, 'OFF']], get('announcer'), set('announcer')),
      bar('TEST ANNOUNCER', () => { Sound.unlock(); Sound.say('ton80', 'One hundred and eighty!'); }, 'small'),
      vbar('BOARD LIGHTS', [[true, 'ON'], [false, 'OFF']], get('lights'), set('lights')),
      bar('TEST BOARD LIGHTS', () => { if (!Board.canLight) toast('Connect a board with lights first'); else Board.Lights.test(); }, 'small'),
      vbar('SHOW ALL BLUETOOTH', [[false, 'OFF'], [true, 'ON']], get('btAll'), set('btAll')),
      vbar('TAP BOARD', [[false, 'OFF'], [true, 'ON']], get('tapBoard'), set('tapBoard')),
      bar('BACKUP / RESTORE', backupMenu, 'small'),
      bar('BACK', () => show('main'), 'small'),
    ];
    s.appendChild(menu('left: 40px; width: 590px; top: 110px; gap: 10px', L));
    s.appendChild(menu('left: 650px; width: 590px; top: 110px; gap: 10px', R));
  }
  function backupMenu() {
    modal({
      title: 'BACKUP', text: 'Players, stats and settings live in this browser. Save a backup file before clearing the browser or moving to a new tablet.', items: [
        { t: 'SAVE BACKUP FILE', cls: 'go', fn: () => {
          const blob = new Blob([Store.backupText()], { type: 'application/json' });
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
          a.download = 'jcdartz-backup-' + new Date().toISOString().slice(0, 10) + '.json';
          document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        } },
        { t: 'RESTORE FROM FILE', fn: () => {
          const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json';
          i.onchange = () => {
            const f = i.files[0]; if (!f) return;
            f.text().then(t => {
              try { const n = Store.restoreText(t); applySettings(); renderSettings(); toast('Restored ' + n + ' players'); }
              catch (e) { toast('That file is not a JC Dartz backup'); }
            });
          };
          i.click();
        } },
      ]
    });
  }

  // ---------------------------------------------------------------
  // Settings that change the page
  // ---------------------------------------------------------------
  function isLite() {
    const l = Store.settings.lite;
    if (l === 'on') return true; if (l === 'off') return false;
    return (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 2;
  }
  function applySettings() {
    const st = $('#stage');
    st.classList.toggle('lite', isLite());
    st.classList.toggle('fx-subtle', Store.settings.effects === 'subtle');
    st.classList.toggle('fx-off', Store.settings.effects === 'off');
    fit();
    stars();
  }
  function fit() {
    const st = $('#stage');
    const m = Store.settings.layout === 'tv' ? 0.92 : 1;
    const k = Math.min(innerWidth / 1280, innerHeight / 720) * m;
    st.style.transform = 'scale(' + k + ')';
  }

  // Starfield background (drawn once; a slow twinkle unless lite mode)
  let starTimer = 0;
  function stars() {
    const c = $('#stars'); if (!c) return;
    const g = c.getContext('2d'); c.width = 1280; c.height = 720;
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const list = [];
    for (let i = 0; i < 140; i++) list.push([rnd() * 1280, rnd() * 720, rnd() < 0.85 ? 1 : 2, 0.3 + rnd() * 0.6, rnd() * 6.28]);
    const glows = [];
    for (let i = 0; i < 7; i++) glows.push([rnd() * 1280, rnd() * 720]);
    const draw = t => {
      g.fillStyle = '#020207'; g.fillRect(0, 0, 1280, 720);
      list.forEach(s => {
        const a = isLite() ? s[3] : s[3] * (0.65 + 0.35 * Math.sin(t / 900 + s[4]));
        g.globalAlpha = a; g.fillStyle = s[2] > 1 ? '#ffffff' : '#b9c8ff'; g.fillRect(s[0], s[1], s[2], s[2]);
      });
      g.globalAlpha = 1;
      glows.forEach(p => {
        const r = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], 14);
        r.addColorStop(0, 'rgba(223,232,255,0.95)'); r.addColorStop(0.3, 'rgba(140,170,255,0.45)'); r.addColorStop(1, 'rgba(140,170,255,0)');
        g.fillStyle = r; g.fillRect(p[0] - 14, p[1] - 14, 28, 28);
      });
    };
    clearInterval(starTimer);
    draw(0);
    if (!isLite()) starTimer = setInterval(() => { if (!document.hidden) draw(performance.now()); }, 120);
  }

  function init() {
    buildMain(); buildGame();
    screen('setup'); screen('players'); screen('settings'); screen('over');
    applySettings();
    addEventListener('resize', fit);
    show('main');
  }

  return {
    init, show, toast, updateConn, renderGame, popScore, showRemove, hideRemove, showAward, closeAward, showGameOver,
    moveSel, activate, stepSel, goBack, closeModal, applySettings, openSetup,
    get screen() { return cur; }, get modalOpen() { return !!$('.modal.on'); },
  };
})();
window.UI = UI;
