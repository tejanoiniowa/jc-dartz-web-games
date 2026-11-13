// sound.js — synthesized bar-machine sounds and the announcer
// Announcer: plays audio/<key>.mp3 when that clip exists, otherwise the
// device's built-in voice says the text.
'use strict';

const Sound = (() => {
  let ctx = null;
  const VOL = { off: 0, low: 0.35, medium: 0.7, high: 1 };
  const vol = () => VOL[Store.settings.sound] ?? 0.7;

  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  function tone(freq, dur, type = 'sine', v = 0.3, when = 0, slideTo = 0) {
    const g = vol(); if (!g) return;
    try {
      const c = ac(), t = c.currentTime + when;
      const o = c.createOscillator(), a = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      a.gain.setValueAtTime(0.0001, t);
      a.gain.exponentialRampToValueAtTime(v * g, t + 0.01);
      a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(a); a.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
  }
  function noise(dur, v = 0.2, when = 0, hp = 800) {
    const g = vol(); if (!g) return;
    try {
      const c = ac(), t = c.currentTime + when;
      const b = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
      const s = c.createBufferSource(), f = c.createBiquadFilter(), a = c.createGain();
      f.type = 'highpass'; f.frequency.value = hp;
      s.buffer = b; a.gain.value = v * g;
      s.connect(f); f.connect(a); a.connect(c.destination); s.start(t);
    } catch (e) {}
  }

  // ---------- Sound effect files ----------
  // Put MP3s in audio/sfx/ with these names. Any that are missing use the built-in synth sound.
  const SFX = ['hit_single', 'hit_double', 'hit_triple', 'hit_bull', 'hit_dbull', 'miss', 'bust', 'next', 'click', 'award', 'win', 'connect'];
  const buf = {};
  let loaded = false;
  function loadSfx() {
    if (loaded) return; loaded = true;
    const c = ac();
    SFX.forEach(n => {
      fetch('audio/sfx/' + n + '.mp3').then(r => r.ok ? r.arrayBuffer() : null)
        .then(a => a && c.decodeAudioData(a)).then(b => { if (b) buf[n] = b; }).catch(() => {});
    });
  }
  // Play a file if we have it; returns false so the caller falls back to the synth
  function file(n) {
    const b = buf[n], g = vol();
    if (!b) return false;
    if (!g) return true;
    try {
      const c = ac(), s = c.createBufferSource(), a = c.createGain();
      s.buffer = b; a.gain.value = g; s.connect(a); a.connect(c.destination); s.start();
    } catch (e) {}
    return true;
  }

  const S = {
    unlock() { try { ac(); loadSfx(); } catch (e) {} },
    connect() { if (file('connect')) return; tone(660, 0.1, 'triangle', 0.2); tone(990, 0.18, 'triangle', 0.2, 0.1); },
    click() { if (file('click')) return; tone(1200, 0.04, 'square', 0.08); },
    hit(d) {
      const n = !d || !d.num ? 'miss' : d.num === 25 ? (d.mult === 2 ? 'hit_dbull' : 'hit_bull') : d.mult === 3 ? 'hit_triple' : d.mult === 2 ? 'hit_double' : 'hit_single';
      if (file(n)) return;
      if (!d || !d.num) { tone(140, 0.25, 'sawtooth', 0.18, 0, 70); return; }
      noise(0.06, 0.35, 0, 1500);
      if (d.num === 25) { tone(880, 0.15, 'square', 0.18); tone(1320, 0.3, 'square', 0.18, 0.1); return; }
      if (d.mult === 3) { tone(523, 0.1, 'square', 0.16); tone(784, 0.1, 'square', 0.16, 0.08); tone(1047, 0.25, 'square', 0.16, 0.16); }
      else if (d.mult === 2) { tone(587, 0.1, 'square', 0.16); tone(880, 0.22, 'square', 0.16, 0.08); }
      else tone(660, 0.12, 'triangle', 0.22);
    },
    bust() { if (file('bust')) return; tone(220, 0.5, 'sawtooth', 0.25, 0, 110); tone(180, 0.5, 'sawtooth', 0.2, 0.05, 90); },
    next() { if (file('next')) return; tone(440, 0.08, 'square', 0.1); tone(660, 0.12, 'square', 0.1, 0.07); },
    award() { if (file('award')) return; [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'square', 0.14, i * 0.08)); noise(0.6, 0.12, 0.1, 3000); },
    win() { if (file('win')) return; [392, 523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i === 7 ? 0.7 : 0.2, 'square', 0.15, i * 0.12)); },
  };

  // ---------- Announcer ----------
  const missing = new Set();
  function speak(text) {
    try {
      if (!('speechSynthesis' in window)) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.0; u.pitch = 0.9; u.volume = Math.min(1, vol() + 0.2);
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  S.say = function (key, text) {
    if (!Store.settings.announcer || !vol()) return;
    if (!key || missing.has(key)) { speak(text); return; }
    const a = new Audio('audio/' + key + '.mp3');
    a.volume = Math.min(1, vol() + 0.2);
    a.onerror = () => { missing.add(key); speak(text); };
    a.play().catch(() => { missing.add(key); speak(text); });
  };
  return S;
})();
window.Sound = Sound;
