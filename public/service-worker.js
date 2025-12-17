
self.addEventListener('install', () => {
  // Opcional: acá podrías cachear assets
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  clients.claim();
});

self.addEventListener('fetch', () => {
  // Con solo escuchar el fetch ya cuenta como SW "válido" para PWA
});
