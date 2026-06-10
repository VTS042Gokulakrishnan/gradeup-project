// Minimal service worker for local development and PWA
self.addEventListener('install', (event) => {
  self.skipWaiting();
  // console.log('[SW] installed');
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
  // console.log('[SW] activated');
});

// Basic fetch handler: try network first, fallback to cache (no cache used here)
self.addEventListener('fetch', (event) => {
  // Let normal navigation and resource loading proceed; we don't cache here to avoid complexity
});
