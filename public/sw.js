// Minimal Service Worker to satisfy PWA requirements
self.addEventListener('install', (event) => {
    // Force new SW to take control immediately
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // Become available to all pages
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Passthrough for now - minimal setup
    // In future versions, we can add offline caching here
});
