const CACHE_NAME = 'vadkul-v1';
const STATIC_CACHE = 'vadkul-static-v1';

// Assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/manifest.json',
    '/pwa-icon-v2.png',
];

// Install - Cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate - Clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name !== CACHE_NAME && name !== STATIC_CACHE)
                        .map(name => caches.delete(name))
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch - Cache-first for static, network-first for dynamic
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip Firebase/external APIs
    if (url.origin !== location.origin) return;

    // Cache strategy
    event.respondWith(
        caches.match(request)
            .then(cached => {
                // For static assets, return cached version
                if (cached && (
                    request.url.includes('.png') ||
                    request.url.includes('.jpg') ||
                    request.url.includes('.css') ||
                    request.url.includes('.js') ||
                    request.url.includes('manifest.json')
                )) {
                    return cached;
                }

                // For pages, try network first, fallback to cache
                return fetch(request)
                    .then(response => {
                        // Cache successful responses
                        if (response && response.status === 200) {
                            const responseClone = response.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => cache.put(request, responseClone));
                        }
                        return response;
                    })
                    .catch(() => {
                        // Fallback to cache if network fails
                        return cached || new Response('Offline - ingen internetanslutning', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
});

// ==============================
// PUSH NOTIFICATIONS (FCM)
// ==============================

// Import Firebase Messaging (via importScripts for SW context)
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Initialize Firebase in Service Worker
firebase.initializeApp({
    apiKey: "AIzaSyD0bkVdGqCzOlwx49-sLfJdj6fiRrnPnGI",
    authDomain: "vadkul-f2cb2.firebaseapp.com",
    projectId: "vadkul-f2cb2",
    storageBucket: "vadkul-f2cb2.firebasestorage.app",
    messagingSenderId: "866093925820",
    appId: "1:866093925820:web:ea43aa0df86cfbda7b09cd"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('Background message received:', payload);

    const notificationTitle = payload.notification?.title || 'VADKUL';
    const notificationOptions = {
        body: payload.notification?.body || 'Du har en ny notis',
        icon: '/pwa-icon-v2.png',
        badge: '/pwa-icon-v2.png',
        tag: payload.data?.type || 'general',
        data: payload.data,
        vibrate: [200, 100, 200],
        requireInteraction: false,
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                // Check if there's already a window open
                for (let client of windowClients) {
                    if (client.url === new URL(urlToOpen, self.location.origin).href && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Open new window if none exists
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

