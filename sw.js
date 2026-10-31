// Service Worker para Roc Waves / RadioTunes
const CACHE_NAME = 'radiotunes-v27-live';
const APP_SHELL = [
  './',
  './index.html',
  './css/tailwind.css',
  './js/app/core.js',
  './js/app/soundscapes.js',
  './js/app/library.js',
  './js/app/health.js',
  './js/app/player.js',
  './js/app/map.js',
  './js/app/browse.js',
  './js/app/features.js',
  './js/app/visualizer.js',
  './js/app/init.js',
  './js/catalog.js',
  './js/i18n.js',
  './js/roc-core.js',
  './js/storage.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon-32.png'
];

// Extensões servidas cache-first (com revalidação em background)
const STATIC_EXT = /\.(js|css|png|jpg|jpeg|svg|webp|ico|woff2?|ttf)$/i;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('A remover cache antiga:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // Streams de áudio e APIs externas sempre diretos pela rede
  if (
    url.pathname.includes('.mp3') ||
    url.pathname.includes('.m3u8') ||
    url.pathname.includes('.aac') ||
    url.href.includes('stream') ||
    url.href.includes('radio-browser.info') ||
    url.href.includes('streamtheworld') ||
    url.href.includes('bauermedia')
  ) {
    return;
  }

  // Assets estáticos (scripts, estilos, fontes, incl. CDNs): cache-first
  if (req.destination === 'script' || req.destination === 'style' || req.destination === 'font' || STATIC_EXT.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchUpdate = fetch(req).then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        }).catch(() => cached);
        return cached || fetchUpdate;
      })
    );
    return;
  }

  // Navegação (HTML): network-first com fallback à cache e à app shell offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() =>
        caches.match(req).then((cached) => cached || caches.match('./index.html'))
      )
    );
    return;
  }

  // Resto (ex: logos remotos): rede com fallback à cache, sem agravanar a cache
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
