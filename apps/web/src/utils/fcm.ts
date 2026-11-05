import { getMessaging, getToken, deleteToken, onMessage, isSupported, type Messaging } from 'firebase/messaging';
import { app } from '../lib/firebase';
import { notificationService } from '../services/notificationService';
import {
    SAVED_TOKEN_KEY,
    parseSavedTokenRecord,
    planTokenSync,
    tokenToForgetOnLogout,
    type SavedTokenRecord,
} from './fcmTokenSync';

const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

/**
 * Messaging-instansen som ett LÖFTE. isSupported() är asynkron (öppnar en
 * test-IndexedDB), och förut låg instansen i en variabel som fylldes "snart":
 * hann FCMHandler före blev det "Messaging not initialized", ingen token och
 * ingen ny chans förrän nästa sidladdning (samma race tappade
 * förgrundslyssnaren). Alla vägar väntar nu in löftet.
 */
const messagingPromise: Promise<Messaging | null> =
    typeof window !== 'undefined' && 'serviceWorker' in navigator
        ? isSupported()
            .then((supported) => (supported ? getMessaging(app) : null))
            .catch((error) => {
                console.error('Failed to initialize Firebase Messaging:', error);
                return null;
            })
        : Promise.resolve(null);

// Synkron spegel av löftet: undefined = inte klart än. Tillståndsfrågan måste
// ställas UTAN await före (iOS godtar den bara synkront i tap-gesten), så
// requestNotificationPermission kan inte vänta in löftet innan den frågar.
let messagingSettled: Messaging | null | undefined;
messagingPromise.then((m) => { messagingSettled = m; });

/**
 * SW-registreringen med vakt: `navigator.serviceWorker.ready` väntar FÖR
 * EVIGT om ingen SW någonsin registreras — och i dev registreras den
 * AVSIKTLIGT inte (registerServiceWorker avregistrerar t.o.m.). Ett bart
 * `await ready` fick notis-knappen att fastna i busy/'…' för alltid
 * (Josef 21/8: "stängde av den och nu går den inte klicka på igen").
 * Ingen registrering → null direkt; annars ready med timeout-fallnät
 * ifall aktiveringen hängt sig.
 */
async function getActiveSWRegistration(): Promise<ServiceWorkerRegistration | null> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
    try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) return null;
        const ready = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise<null>(resolve => setTimeout(() => resolve(null), 4000)),
        ]);
        return ready ?? (reg.active ? reg : null);
    } catch {
        return null;
    }
}

/**
 * Enhetens FCM-token UTAN att fråga om tillstånd: null om tillståndet inte
 * redan är beviljat, om messaging saknas eller om ingen service worker är
 * aktiv. getToken() är billig i normalfallet (IndexedDB + pushManager, inget
 * nät) men gör jobbet när något ändrats: saknas pushprenumerationen (iOS har
 * återkallat den) prenumererar SDK:n om och ger en NY token, och en vecka
 * gammal token fräschas upp hos FCM.
 */
async function currentDeviceToken(): Promise<string | null> {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return null;
    const messaging = await messagingPromise;
    if (!messaging) return null;

    // Ge registreringen explicit, annars letar Firebase efter
    // /firebase-messaging-sw.js (bara en platshållare, se public/).
    const registration = await getActiveSWRegistration();
    if (!registration || !registration.active) {
        console.warn('FCM: ingen aktiv service worker (i dev registreras ingen - notiser kan bara slås på i produktion)');
        return null;
    }

    return getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
}

/**
 * Request notification permission and get FCM token
 */
export async function requestNotificationPermission(): Promise<string | null> {
    // Bara ett SLUTGILTIGT nej hindrar frågan. Är löftet inte klart än
    // (tap direkt efter sidladdning) frågar vi ändå - currentDeviceToken
    // väntar in det efteråt.
    if (messagingSettled === null) {
        console.warn('Messaging not supported');
        return null;
    }

    try {
        // Request permission - FÖRST, ingen await före (tap-gesten, se ovan).
        const permission = await Notification.requestPermission();

        if (permission !== 'granted') {
            console.log('Notification permission denied');
            return null;
        }

        const token = await currentDeviceToken();
        if (token) console.log('FCM Token received:', token);
        return token;
    } catch (error) {
        console.error('Error getting FCM token:', error);
        return null;
    }
}

function readSavedToken(): SavedTokenRecord | null {
    try {
        return parseSavedTokenRecord(localStorage.getItem(SAVED_TOKEN_KEY));
    } catch {
        return null;
    }
}

function writeSavedToken(record: SavedTokenRecord | null): void {
    try {
        if (record) localStorage.setItem(SAVED_TOKEN_KEY, JSON.stringify(record));
        else localStorage.removeItem(SAVED_TOKEN_KEY);
    } catch { /* privat läge */ }
}

/**
 * Sparar enhetens token på kontot enligt planTokenSync: en ny eller roterad
 * token sparas (och förra tokenens dokument på samma konto raderas), en
 * oförändrad token skrivs om högst en gång per dygn. force = användaren slog
 * själv på notiser - skriv alltid.
 */
async function saveDeviceToken(uid: string, token: string, force = false): Promise<void> {
    const now = Date.now();
    const plan = planTokenSync(readSavedToken(), uid, token, now);
    if (!plan.save && !force) return;

    await notificationService.saveFCMToken(uid, token, { isNew: plan.isNew || force });
    writeSavedToken({ uid, token, savedAt: now });

    // EFTER sparningen: failar raderingen ligger bara en död token kvar
    // (servern städar den vid nästa utskick), aldrig tvärtom.
    if (plan.deleteToken) {
        try {
            await notificationService.deleteFCMToken(uid, plan.deleteToken);
        } catch (error) {
            console.warn('FCM: kunde inte radera förra tokenen:', error);
        }
    }
}

/**
 * TYST token-uppfräschning (FCMHandler i Providers): vid sidladdning och när
 * appen kommer tillbaka i förgrunden. Frågar ALDRIG om tillstånd - gör inget
 * alls om det inte redan är beviljat, eller om användaren stängt av notiser
 * på enheten (en omsparad token skulle slå på dem bakom ryggen).
 */
export async function refreshDeviceToken(uid: string): Promise<void> {
    if (isNotisOffOnThisDevice()) return;
    const token = await currentDeviceToken();
    if (token) await saveDeviceToken(uid, token);
}

/**
 * Utloggning: radera enhetens token från kontot som loggar ut, medan vi
 * fortfarande är inloggade (reglerna: bara ägaren får radera). Annars får
 * nästa konto på enheten även förra kontots notiser - 17/9 låg samma token
 * på två konton. Blockerar aldrig utloggningen (tak 3 s, offline hänger
 * Firestore-skrivningen annars tills nätet kommer tillbaka).
 */
export async function forgetDeviceToken(uid: string): Promise<void> {
    const token = tokenToForgetOnLogout(readSavedToken(), uid);
    if (!token) return;
    writeSavedToken(null);
    try {
        await Promise.race([
            notificationService.deleteFCMToken(uid, token),
            new Promise<void>((resolve) => setTimeout(resolve, 3000)),
        ]);
    } catch (error) {
        console.warn('FCM: kunde inte radera enhetens token vid utloggning:', error);
    }
}

/**
 * Listen for foreground messages
 */
export function onForegroundMessage(callback: (payload: any) => void) {
    let unsubscribe = () => { };
    let cancelled = false;
    messagingPromise.then((messaging) => {
        if (!messaging || cancelled) return;
        unsubscribe = onMessage(messaging, (payload) => {
            console.log('Foreground message received:', payload);
            callback(payload);
        });
    });
    return () => {
        cancelled = true;
        unsubscribe();
    };
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
export async function enableEventReminders(uid: string): Promise<'on' | 'denied' | 'no-sw' | 'error'> {
    try {
        const token = await requestNotificationPermission();
        if (!token) {
            if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return 'denied';
            // Ingen service worker = push kan aldrig kopplas. I dev är det
            // ALLTID så (registerServiceWorker registrerar ingen där) —
            // "försök igen"-toasten var bara vilseledande, säg som det är.
            if (!(await getActiveSWRegistration())) return 'no-sw';
            return 'error';
        }
        await saveDeviceToken(uid, token, true);
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
        // En ev. äldre token som enheten sparat på kontot ska också bort.
        await forgetDeviceToken(uid);
        const messaging = await messagingPromise;
        if (messaging) {
            // Ingen SW-registrering (dev) → ingen token att städa; utan vakten
            // hängde `.ready` för evigt och knappen fastnade i busy.
            const registration = await getActiveSWRegistration();
            if (registration) {
                const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
                if (token) await notificationService.deleteFCMToken(uid, token);
                await deleteToken(messaging);
            }
        }
        return 'off';
    } catch (error) {
        console.error('Kunde inte stänga av notiser:', error);
        return 'error';
    }
}
