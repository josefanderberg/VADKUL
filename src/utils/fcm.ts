import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { app } from '../lib/firebase';

const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

let messaging: ReturnType<typeof getMessaging> | null = null;

// Initialize messaging only in browser
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
        messaging = getMessaging(app);
    } catch (error) {
        console.error('Failed to initialize Firebase Messaging:', error);
    }
}

/**
 * Request notification permission and get FCM token
 */
export async function requestNotificationPermission(): Promise<string | null> {
    if (!messaging) {
        console.warn('Messaging not initialized');
        return null;
    }

    try {
        // Request permission
        const permission = await Notification.requestPermission();

        if (permission !== 'granted') {
            console.log('Notification permission denied');
            return null;
        }

        // Get FCM token - explicitly provide the service worker registration
        // so Firebase doesn't try to look for /firebase-messaging-sw.js
        const registration = await navigator.serviceWorker.ready;

        if (!registration || !registration.active) {
            console.warn('FCM: Service worker registration not active yet');
            return null;
        }

        const token = await getToken(messaging, {
            vapidKey,
            serviceWorkerRegistration: registration
        });

        console.log('FCM Token received:', token);
        return token;
    } catch (error) {
        console.error('Error getting FCM token:', error);
        return null;
    }
}

/**
 * Listen for foreground messages
 */
export function onForegroundMessage(callback: (payload: any) => void) {
    if (!messaging) return () => { };

    return onMessage(messaging, (payload) => {
        console.log('Foreground message received:', payload);
        callback(payload);
    });
}

/**
 * Check if notifications are supported and granted
 */
export function isNotificationSupported(): boolean {
    return (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        'serviceWorker' in navigator
    );
}

export function isNotificationGranted(): boolean {
    return (
        isNotificationSupported() &&
        Notification.permission === 'granted'
    );
}
