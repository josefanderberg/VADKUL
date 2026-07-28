import { getMessaging, getToken, deleteToken, onMessage, isSupported } from 'firebase/messaging';
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

export type NotisStatus = 'unsupported' | 'ios-needs-pwa' | 'denied' | 'granted' | 'off' | 'default';

// Satt när användaren själv stängt av påminnelser på den här enheten.
// Webbläsarens permission går inte att återkalla från JS, så "av" =
// enhetens token raderad + den här flaggan, som också hindrar FCMHandlers
// tysta token-uppfräschning från att slå på notiserna igen vid nästa login.
const NOTIS_OFF_KEY = 'vadkul_notiser_av';

export function isNotisOffOnThisDevice(): boolean {
    try {
        return typeof window !== 'undefined' && localStorage.getItem(NOTIS_OFF_KEY) === '1';
    } catch {
        return false;
    }
}

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
    if (Notification.permission === 'granted' && isNotisOffOnThisDevice()) return 'off';
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
        try { localStorage.removeItem(NOTIS_OFF_KEY); } catch { /* privat läge */ }
        return 'on';
    } catch (error) {
        console.error('Kunde inte aktivera notiser:', error);
        return 'error';
    }
}

/**
 * Stänger AV påminnelser på den här enheten: tar bort enhetens token från
 * kontot, ogiltigförklarar den hos FCM och sätter av-flaggan. Tokens på
 * användarens ANDRA enheter rörs inte — av/på är per enhet, precis som
 * webbläsarens eget notistillstånd.
 */
export async function disableEventReminders(uid: string): Promise<'off' | 'error'> {
    // Flaggan sätts FÖRST: även om raderingen nedan failar ska UI:t visa av
    // och FCMHandler sluta spara om token.
    try { localStorage.setItem(NOTIS_OFF_KEY, '1'); } catch { /* privat läge */ }
    try {
        if (messaging) {
            const registration = await navigator.serviceWorker.ready;
            const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
            if (token) await notificationService.deleteFCMToken(uid, token);
            await deleteToken(messaging);
        }
        return 'off';
    } catch (error) {
        console.error('Kunde inte stänga av notiser:', error);
        return 'error';
    }
}
