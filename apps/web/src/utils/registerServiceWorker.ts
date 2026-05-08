export async function registerServiceWorker() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        console.log('Service Worker not supported');
        return;
    }

    try {
        const swUrl = `/sw.js?firebaseApiKey=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}&projectId=${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}&messagingSenderId=${process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}&appId=${process.env.NEXT_PUBLIC_FIREBASE_APP_ID}`;
        const registration = await navigator.serviceWorker.register(swUrl, {
            scope: '/',
        });

        console.log('Service Worker registered:', registration.scope);

        // Check for updates periodically
        setInterval(() => {
            registration.update().catch(err => console.debug('SW update check failed:', err));
        }, 60 * 60 * 1000); // Check every hour

        // Handle updates
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;

            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New service worker available, show update notification
                    console.log('New version available! Refresh to update.');
                }
            });
        });

        return registration;
    } catch (error) {
        if (error instanceof Error) {
            console.error('Service Worker registration failed:', {
                message: error.message,
                name: error.name,
                stack: error.stack
            });
        } else {
            console.error('Service Worker registration failed with unknown error:', error);
        }
    }
}
