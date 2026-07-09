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

try {
    // Import Firebase Messaging (via importScripts for SW context)
    importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

    const urlParams = new URLSearchParams(location.search);
    const apiKey = urlParams.get('firebaseApiKey') || '';
    const projectId = urlParams.get('projectId') || '';
    const messagingSenderId = urlParams.get('messagingSenderId') || '';
    const appId = urlParams.get('appId') || '';

    // Initialize Firebase in Service Worker
    // Check if firebase is defined (might fail if importScripts failed)
    if (typeof firebase !== 'undefined' && apiKey) {
        if (!firebase.apps.length) {
            firebase.initializeApp({
                apiKey: apiKey,
                authDomain: `${projectId}.firebaseapp.com`,
                projectId: projectId,
                storageBucket: `${projectId}.firebasestorage.app`,
                messagingSenderId: messagingSenderId,
                appId: appId
            });
        }

        const messaging = firebase.messaging();

        // Handle background messages.
        // Event-påminnelserna skickas som DATA-ONLY (title/body/url i payload.data)
        // så att FCM-SDK:t inte auto-visar en EGEN notis utöver den här → läs
        // notification-fälten först och falla tillbaka på data-fälten.
        messaging.onBackgroundMessage((payload) => {
            console.log('Background message received:', payload);

            const notificationTitle = payload.notification?.title || payload.data?.title || 'VADKUL';
            const notificationOptions = {
                body: payload.notification?.body || payload.data?.body || 'Du har en ny notis',
                icon: '/pwa-icon-v2.png',
                badge: '/pwa-icon-v2.png',
                // Tag per event → två påminnelser (t.ex. olika enhets-tokens som
                // levereras dubbelt) staplas inte som separata notiser.
                tag: payload.data?.eventId ? `${payload.data?.type}:${payload.data.eventId}` : (payload.data?.type || 'general'),
                data: payload.data,
                vibrate: [200, 100, 200],
                requireInteraction: false,
            };

            return self.registration.showNotification(notificationTitle, notificationOptions);
        });
    }
} catch (e) {
    console.error('Service Worker: Failed to initialize Firebase messaging. Push notifications might not work.', e);
}

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

