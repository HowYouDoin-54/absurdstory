const CACHE_NAME = 'absurdstory-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/client.js',
  '/style.css',
  '/beep.mp3',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  // Socket.io isteklerini cache'leme
  if (e.request.url.includes('/socket.io/')) return;

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
