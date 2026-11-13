/* Service worker System Register COA.
   - Halaman & file sendiri : ambil dari jaringan dulu (update langsung terpakai), cache hanya cadangan saat offline.
   - Pustaka CDN (font, ikon, scanner kamera, XLSX) : dari cache dulu, karena URL-nya berversi.
   - Panggilan API ke Apps Script (POST) tidak pernah disentuh / di-cache.
   Naikkan angka VERSION hanya jika ingin membuang seluruh cache lama. */
const VERSION = 'coa-v1';
const SHELL = ['./', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
const CDN_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com', 'unpkg.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => Promise.all(SHELL.map(url => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(VERSION);
  try {
    // 'no-cache' = selalu tanyakan ke server apakah ada versi baru, jadi index.html yang
    // baru di-upload langsung terpakai dan tidak tertahan cache browser.
    const res = await fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' });
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(request, { ignoreSearch: request.mode === 'navigate' }) ||
                (request.mode === 'navigate' ? await cache.match('./') : null);
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(request.url);
  if (hit) return hit;
  // Minta ulang dengan mode CORS supaya status respons bisa diperiksa sebelum disimpan.
  const res = await fetch(request.url, { mode: 'cors', credentials: 'omit' });
  if (res && res.ok) cache.put(request.url, res.clone());
  return res;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) event.respondWith(networkFirst(request));
  else if (CDN_HOSTS.includes(url.hostname)) event.respondWith(cacheFirst(request));
});
