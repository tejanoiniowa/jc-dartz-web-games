// access.js — the unlock screen. A code from Freddy unlocks this device.
// The code server lives at api.jcdartz.com (a Cloudflare Worker). After unlocking, the app
// works offline; when it opens online it quietly checks the code is still good.
'use strict';

const Access = (() => {
  const API = 'https://api.jcdartz.com';
  const KEY = 'jcw_access', DEV = 'jcw_device';
  const BLUEFY = 'https://apps.apple.com/app/id1492822055';
  const MSG = {
    bad_code: "That code isn't right. Check it and try again.",
    taken: 'That code is already in use with a different email.',
    too_many: 'That code is already on 2 devices. Ask the person who gave it to you to reset it.',
    off: 'That code has been turned off.',
    bad_email: 'Enter a valid email address.',
    slow_down: 'Too many tries. Wait 15 minutes and try again.',
    removed: 'This device was removed from your code. Enter your code again to unlock it.',
    released: 'Your code was reset. Enter it again to unlock this device.',
    offline: 'You need an internet connection the first time you unlock.',
    server: 'Something went wrong. Try again in a minute.',
  };
  let locked = false;

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  const save = a => { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} };
  function deviceId() {
    let id = null;
    try { id = localStorage.getItem(DEV); } catch (e) {}
    if (!id) {
      const r = new Uint8Array(12); crypto.getRandomValues(r);
      id = Array.from(r, b => b.toString(16).padStart(2, '0')).join('');
      try { localStorage.setItem(DEV, id); } catch (e) {}
    }
    return id;
  }
  // A friendly name for the admin page, like "Android tablet · Chrome"
  function label() {
    const ua = navigator.userAgent;
    const ios = isIOS();
    let dev = ios ? (/iPhone/.test(ua) ? 'iPhone' : 'iPad')
      : /Android/.test(ua) ? (/Mobile/.test(ua) ? 'Android phone' : 'Android tablet')
      : /CrOS/.test(ua) ? 'Chromebook' : /Windows/.test(ua) ? 'Windows PC' : /Linux/.test(ua) ? 'Linux PC' : /Mac/.test(ua) ? 'Mac' : 'Device';
    const br = ios ? (navigator.bluetooth ? 'Bluefy' : /CriOS/.test(ua) ? 'Chrome' : 'Safari')
      : /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox/.test(ua) ? 'Firefox' : 'Browser';
    return dev + ' · ' + br;
  }
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  // Apple device in a browser that can't reach the board (anything but Bluefy)
  const iosNoBluetooth = () => isIOS() && !navigator.bluetooth;

  async function post(path, body) {
    const r = await fetch(API + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return r.json();
  }

  // ---------------------------------------------------------------
  // The unlock screen
  // ---------------------------------------------------------------
  function show(msg) {
    locked = true;
    let s = document.getElementById('scr-unlock');
    if (!s) {
      s = document.createElement('div'); s.id = 'scr-unlock';
      document.getElementById('stage').appendChild(s);
    }
    const iosWarn = iosNoBluetooth() ? `<div class="ul-warn">This browser can't connect to your dartboard. On iPhone and iPad, open this page in
      <b>Bluefy</b>, free on the App Store. <a href="${BLUEFY}" target="_blank" rel="noopener">Get Bluefy</a></div>` : '';
    s.innerHTML = `
      <div class="ul-box">
        <img class="ul-logo" src="icons/logo.png" alt="JC Dartz">
        <h1>UNLOCK JC DARTZ</h1>
        ${iosWarn}
        <label>CODE<input id="ul-code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="JCD-XXXX-XXXX" maxlength="16"></label>
        <label>EMAIL<input id="ul-email" type="email" autocomplete="email" spellcheck="false" placeholder="you@example.com" maxlength="120"></label>
        <div class="ul-msg" id="ul-msg">${msg ? MSG[msg] || msg : ''}</div>
        <button class="bar big go" id="ul-go">UNLOCK</button>
        <p class="ul-note">Works in Chrome on Android tablets and phones. On iPhone or iPad, use the free Bluefy browser.
          Each code works on 2 devices.</p>
      </div>`;
    s.classList.add('on');
    const prev = load();
    if (prev) { s.querySelector('#ul-code').value = prev.code || ''; s.querySelector('#ul-email').value = prev.email || ''; }
    const go = s.querySelector('#ul-go');
    go.onclick = submit;
    s.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }));
  }
  function hide() {
    locked = false;
    const s = document.getElementById('scr-unlock');
    if (s) { s.classList.remove('on'); s.innerHTML = ''; }
  }
  async function submit() {
    const s = document.getElementById('scr-unlock');
    const code = s.querySelector('#ul-code').value.trim(), email = s.querySelector('#ul-email').value.trim();
    const m = s.querySelector('#ul-msg'), go = s.querySelector('#ul-go');
    if (!code) { m.textContent = 'Enter your code.'; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { m.textContent = MSG.bad_email; return; }
    if (!navigator.onLine) { m.textContent = MSG.offline; return; }
    go.disabled = true; m.textContent = 'Checking…';
    let r;
    try { r = await post('/claim', { code, email, device: deviceId(), label: label() }); }
    catch (e) { r = { ok: false, reason: 'server' }; }
    go.disabled = false;
    if (!r || !r.ok) { m.textContent = MSG[r && r.reason] || MSG.server; return; }
    save({ code: r.code, email: r.email, checked: Date.now() });
    hide();
    UI.toast('Unlocked. Have fun!');
    try { Sound.unlock(); Sound.award(); } catch (e) {}
  }

  // ---------------------------------------------------------------
  // Start-up: locked until unlocked; then a quiet check whenever online
  // ---------------------------------------------------------------
  let lastVerify = 0;
  async function verify() {
    const a = load(); if (!a || !navigator.onLine) return;
    if (Date.now() - lastVerify < 10 * 60000) return;   // at most every 10 minutes
    lastVerify = Date.now();
    let r;
    try { r = await post('/check', { code: a.code, email: a.email, device: deviceId() }); }
    catch (e) { return; }                       // no connection or server trouble: keep playing
    if (r && r.ok) { a.checked = Date.now(); save(a); return; }
    if (r && ['bad_code', 'off', 'released', 'removed'].includes(r.reason)) {
      try { localStorage.removeItem(KEY); } catch (e) {}
      if (window.Engine && Engine.state) { Engine.quit(); UI.show('main'); }
      show(r.reason === 'bad_code' ? 'off' : r.reason);
      // fill in what they had, so re-entering is one tap
      const s = document.getElementById('scr-unlock');
      s.querySelector('#ul-code').value = a.code || ''; s.querySelector('#ul-email').value = a.email || '';
    }
  }
  function start() {
    if (!load()) show();
    else verify();
    addEventListener('online', verify);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) verify(); });
  }

  return { start, get locked() { return locked; }, iosNoBluetooth, BLUEFY };
})();
window.Access = Access;
