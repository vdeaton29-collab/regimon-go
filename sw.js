// Regimon GO service worker: caches the game so it works offline after the first visit.
const CACHE = 'regimon-go-v19';
const FILES = [
  './', 'index.html', 'style.css', 'manifest.webmanifest', 'icon.svg',
  'js/osm.js', 'js/geo.js', 'js/data.js', 'js/families.js', 'js/evolutions.js', 'js/dragon-art.js', 'js/art.js', 'js/music.js', 'js/online.js', 'js/cloud.js', 'js/minigames.js', 'js/battle.js', 'js/game.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Network first (so updates show up right away), falling back to the cache when offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    // always check with the server so new versions show up right away (a fresh Request works for page loads too)
    fetch(new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }))
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))),
  );
});
