// Service Worker para Roc Waves / RadioTunes
const CACHE_NAME = 'radiotunes-v8-live';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
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
  const url = event.request.url;

  // Streams de áudio e APIs externas sempre diretos pela rede
  if (
    url.includes('.mp3') ||
    url.includes('.m3u8') ||
    url.includes('.aac') ||
    url.includes('stream') ||
    url.includes('radio-browser.info') ||
    url.includes('streamtheworld') ||
    url.includes('bauermedia')
  ) {
    return;
  }

  // Network-First para HTML e ficheiros da app: garante sempre a versão mais recente!
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
