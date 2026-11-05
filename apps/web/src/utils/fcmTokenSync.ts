/**
 * Ren logik för den tysta FCM-token-synken (FCMHandler i Providers +
 * enableEventReminders i utils/fcm). React-, nät- och Firebase-fri.
 *
 * VARFÖR den finns (utredningen 21/9): helgtipset 17/9 nådde 19 tokens, 11 var
 * döda - men de 11 kom från bara TRE installationer (prefixet före ':' i en
 * token är Firebase-installationens id). Två av dem hade kedjor på fem tokens:
 * fyra "NotRegistered" + en "Device unregistered.". Mönstret: pushprenumerationen
 * byts (iOS återkallar den, av/på i profilpanelen, SW:ns pushsubscriptionchange),
 * SDK:n raderar den gamla tokenen hos FCM och ger en ny - och klienten sparade
 * den nya men lät den gamla ligga kvar i fcmTokens. Dessutom sparades samma
 * enhets token på VARJE konto som loggat in på enheten.
 *
 * Därför minns enheten vad den senast sparade (uid + token) i localStorage:
 * byts token på samma konto raderas förra dokumentet, och utloggningen
 * städar enhetens dokument på kontot som loggar ut.
 */

/** Vad den här enheten senast sparade, på vilket konto. Bor i localStorage. */
export interface SavedTokenRecord {
    uid: string;
    token: string;
    /** ms sedan epoch */
    savedAt: number;
}

export const SAVED_TOKEN_KEY = 'vadkul_fcm_token';

/**
 * Hur ofta en OFÖRÄNDRAD token skrivs om (lastSeenAt). Varje sparning är en
 * Firestore-skrivning, så inte vid varje sidladdning - men tillräckligt ofta
 * för att ett dokument som servern raderat ska komma tillbaka vid nästa besök
 * dagen efter, och för att lastSeenAt ska gå att gallra på.
 */
export const TOKEN_RESAVE_MS = 24 * 60 * 60 * 1000;

/**
 * Minsta avstånd mellan två tysta kontroller när appen kommer tillbaka i
 * förgrunden. En iOS-PWA laddas sällan om - den väcks ur bakgrunden - så
 * kontrollen vid sidladdning ensam missar de flesta "besök".
 */
export const RESUME_CHECK_MIN_MS = 10 * 60 * 1000;

export interface TokenSyncPlan {
    /** Skriv token-dokumentet. */
    save: boolean;
    /** Tokenen är ny för kontot på den här enheten → sätt createdAt. */
    isNew: boolean;
    /** Förra tokenens dokument på SAMMA konto ska raderas (roterad token). */
    deleteToken: string | null;
}

export function planTokenSync(
    prev: SavedTokenRecord | null,
    uid: string,
    token: string,
    now: number,
): TokenSyncPlan {
    // Första gången, eller ett annat konto: spara. Förra kontots dokument kan
    // inte raderas härifrån (reglerna: bara ägaren) - det städar utloggningen.
    if (!prev || prev.uid !== uid) return { save: true, isNew: true, deleteToken: null };
    if (prev.token !== token) return { save: true, isNew: true, deleteToken: prev.token };
    // Samma token: skriv bara om när sparningen är gammal (eller klockan
    // hoppat bakåt - hellre en skrivning för mycket än en token som aldrig
    // fräschas upp).
    const stale = now - prev.savedAt >= TOKEN_RESAVE_MS || now < prev.savedAt;
    return { save: stale, isNew: false, deleteToken: null };
}

export function parseSavedTokenRecord(raw: string | null): SavedTokenRecord | null {
    if (!raw) return null;
    try {
        const v = JSON.parse(raw) as Partial<SavedTokenRecord> | null;
        if (!v || typeof v.uid !== 'string' || !v.uid) return null;
        if (typeof v.token !== 'string' || !v.token) return null;
        if (typeof v.savedAt !== 'number' || !Number.isFinite(v.savedAt)) return null;
        return { uid: v.uid, token: v.token, savedAt: v.savedAt };
    } catch {
        return null;
    }
}

/** Utloggning: vilken token ska raderas från kontot som loggar ut, om någon. */
export function tokenToForgetOnLogout(prev: SavedTokenRecord | null, uid: string): string | null {
    return prev && prev.uid === uid ? prev.token : null;
}

export function shouldCheckOnResume(lastCheckAt: number | null, now: number): boolean {
    if (lastCheckAt === null) return true;
    return now - lastCheckAt >= RESUME_CHECK_MIN_MS || now < lastCheckAt;
}
