import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { app } from '../lib/firebase';
import { notificationService } from '../services/notificationService';

const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

let messaging: ReturnType<typeof getMessaging> | null = null;

// Initialize messaging only in browser
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    isSupported().then((supported) => {
        if (supported) {
            try {
                messaging = getMessaging(app);
            } catch (error) {
                console.error('Failed to initialize Firebase Messaging:', error);
            }
        }
    }).catch(console.error);
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

export type NotisStatus = 'unsupported' | 'ios-needs-pwa' | 'denied' | 'granted' | 'default';

/**
 * Var notis-läget står just nu. 'ios-needs-pwa' = iPhone/iPad i vanliga
 * Safari — där finns web-push först när sajten ligger som PWA på hemskärmen
 * (iOS 16.4+), så knappen ska ersättas av en installera-hint i det läget.
 */
export function getNotisStatus(): NotisStatus {
    if (typeof window === 'undefined') return 'unsupported';
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches
        || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isIos && !isStandalone) return 'ios-needs-pwa';
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported';
    return Notification.permission;
}

/**
 * Slår PÅ event-påminnelser: frågar om tillstånd, hämtar FCM-token och sparar
 * den på kontot. MÅSTE anropas från en riktig tap-/klick-gest — en gest-lös
 * requestPermission() avvisas alltid i iOS-PWA:n och nedprioriteras i Chrome,
 * vilket är varför login-flödet aldrig får fråga (bara uppfräscha, se
 * FCMHandler i Providers).
 */
export async function enableEventReminders(uid: string): Promise<'on' | 'denied' | 'error'> {
    try {
        const token = await requestNotificationPermission();
        if (!token) {
            return typeof Notification !== 'undefined' && Notification.permission === 'denied'
                ? 'denied'
                : 'error';
        }
        await notificationService.saveFCMToken(uid, token);
        return 'on';
    } catch (error) {
        console.error('Kunde inte aktivera notiser:', error);
        return 'error';
    }
}
