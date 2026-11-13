// sw.js — keeps the app working offline. Bump VERSION when files change.
const VERSION = 'jcw-3';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/store.js', 'js/segs.js', 'js/sound.js', 'js/ble.js', 'js/engine.js', 'js/games/common.js', 'js/games/x01.js', 'js/games/cricket.js', 'js/games/golf.js', 'js/games/horse.js', 'js/games/practice.js', 'js/ui.js', 'js/app.js',
  'fonts/russo-one.woff', 'fonts/teko.woff', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable.png', 'icons/logo.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first (so updates show up), cache when offline. Voice clips are cached as they play.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r && r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(m => m || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
