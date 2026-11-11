// store.js — players, settings and stats, saved in this device's browser
'use strict';

const Store = (() => {
  const KEY_P = 'jcw_players', KEY_S = 'jcw_settings';

  const DEFAULTS = {
    nextPlayer: 0,      // 0 = red button / tap, else seconds after the 3rd dart
    pullPause: 4,       // seconds hits are ignored after next player
    cpuWait: 5,         // seconds before a computer throws
    effects: 'full',    // full | subtle | off
    lite: 'auto',       // auto | on | off
    layout: 'auto',     // auto | full | phone
    sound: 'medium',    // off | low | medium | high
    announcer: true,
    lights: true,
    tapBoard: false,
    btAll: false,       // show every Bluetooth device in the picker    // on-screen board for scoring without Bluetooth
  };

  let settings = Object.assign({}, DEFAULTS);
  let players = [];

  function load() {
    try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY_S) || '{}')); } catch (e) {}
    try { players = JSON.parse(localStorage.getItem(KEY_P) || '[]'); } catch (e) { players = []; }
    if (!Array.isArray(players)) players = [];
    players.forEach(fill);
  }
  function fill(p) {
    p.stats = p.stats || {};
    p.stats.x01 = Object.assign({ games: 0, wins: 0, legs: 0, legsWon: 0, darts: 0, points: 0, tons: 0, ton80s: 0, bestOut: 0, history: [] }, p.stats.x01 || {});
    return p;
  }
  function saveSettings() { try { localStorage.setItem(KEY_S, JSON.stringify(settings)); } catch (e) {} }
  function savePlayers() {
    try { localStorage.setItem(KEY_P, JSON.stringify(players)); return true; }
    catch (e) { UI.toast('Could not save stats on this device'); return false; }
  }

  function addPlayer(name) {
    name = String(name || '').trim().slice(0, 16);
    if (!name) return null;
    if (players.some(p => p.name.toLowerCase() === name.toLowerCase())) return 'dup';
    const p = fill({ id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, created: Date.now() });
    players.push(p);
    savePlayers();
    return p;
  }
  function removePlayer(id) { players = players.filter(p => p.id !== id); savePlayers(); }
  function get(id) { return players.find(p => p.id === id) || null; }

  function backupText() {
    return JSON.stringify({ app: 'JC Dartz Web Games', v: 1, at: new Date().toISOString(), players, settings });
  }
  function restoreText(text) {
    const d = JSON.parse(text);
    if (!d || !Array.isArray(d.players) || d.players.some(p => !p || typeof p.name !== 'string')) throw new Error('bad');
    players = d.players.map(p => fill(Object.assign({ id: 'p' + Math.random().toString(36).slice(2) }, p)));
    if (d.settings) Object.assign(settings, d.settings);
    savePlayers(); saveSettings();
    return players.length;
  }

  return {
    DEFAULTS, load, saveSettings, savePlayers, addPlayer, removePlayer, get, backupText, restoreText,
    get settings() { return settings; },
    get players() { return players; },
  };
})();
window.Store = Store;
