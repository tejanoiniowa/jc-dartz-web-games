// app.js — start-up, board events, keyboard, offline support
'use strict';

(() => {
  Store.load();
  UI.init();

  let lastNext = 0;
  Board.on({
    hit(key) {
      if (UI.screen === 'game' && !UI.modalOpen) Engine.hit(key);
    },
    button() {
      const t = Date.now();
      if (t - lastNext < 1200) return;      // one press = one action
      lastNext = t;
      if (UI.modalOpen) { UI.activate(); return; }
      if (UI.screen === 'game') Engine.next();
      else UI.activate();
    },
    state(s, msg) {
      UI.updateConn();
      if (s === 'ok') UI.toast('Board connected');
      else if (s === 'off' && msg) UI.toast(msg);
    },
  });
  Board.autoConnect();

  // Keyboard: arrows move, Enter selects, Esc goes back. In a game: Space = next, U = undo.
  addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') return;
    const k = e.key;
    if (UI.screen === 'game' && !UI.modalOpen) {
      if (k === ' ' || k === 'Enter' || k === 'n') { e.preventDefault(); Engine.next(); }
      else if (k === 'u' || k === 'Backspace') { e.preventDefault(); Engine.undo(); }
      else if (k === 'Escape') UI.goBack();
      return;
    }
    if (k === 'ArrowDown') { e.preventDefault(); UI.moveSel(1); }
    else if (k === 'ArrowUp') { e.preventDefault(); UI.moveSel(-1); }
    else if (k === 'ArrowRight') { e.preventDefault(); UI.stepSel(1); }
    else if (k === 'ArrowLeft') { e.preventDefault(); UI.stepSel(-1); }
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); UI.activate(); }
    else if (k === 'Escape' || k === 'Backspace') { e.preventDefault(); UI.goBack(); }
  });

  // Sound needs one tap before the browser lets it play
  addEventListener('pointerdown', () => Sound.unlock(), { once: true });

  // Keep the screen awake during play where the browser allows it
  let lock = null;
  async function wake() { try { if ('wakeLock' in navigator && !lock) { lock = await navigator.wakeLock.request('screen'); lock.onrelease = () => { lock = null; }; } } catch (e) {} }
  addEventListener('pointerdown', wake);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });

  // Works offline after the first visit
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
