
self.addEventListener('install', (event) => {
  // Opcional: acá podrías cachear assets
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Con solo escuchar el fetch ya cuenta como SW "válido" para PWA
});
