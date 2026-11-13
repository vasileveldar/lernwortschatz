// Служба кэша: страница открывается мгновенно (из кэша) и работает без сети; свежая версия подтягивается в фоне
// и появляется при следующем открытии. Запросы к облаку (прогресс) и к Telegram в кэш не попадают.
const CACHE = 'lw-site-v1';
const FILES = ['./', 'index.html', 'config.js', 'tg-sync.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;   // чужие адреса (Telegram, облако) — напрямую
  e.respondWith(caches.open(CACHE).then(cache => cache.match(req, { ignoreSearch: true }).then(hit => {
    const fresh = fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => hit);
    return hit || fresh;
  })));
});
