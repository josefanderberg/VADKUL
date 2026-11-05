/**
 * pushMessages - REN uppbyggnad av FCM-meddelandena för EN användares enheter.
 *
 * Två sorters tokens bor i fcmTokens/{uid}/tokens/*:
 *  - WEBBENS (inget platform-fält): DATA-ONLY. Webbens service worker ritar
 *    notisen själv ur payload.data; en notification-payload hade gett dubbla
 *    notiser (FCM-SDK:t visar den också).
 *  - APPENS (platform 'ios' | 'android', vadkul-app src/data/push.ts): en
 *    RIKTIG notis-payload. En native app visar aldrig ett data-only-
 *    meddelande - iOS levererar det tyst och Android lämnar det åt appen,
 *    så före 5/11 2026 kom ingen påminnelse eller helgtips fram i apparna.
 *    data följer med så att trycket på notisen kan öppna rätt skärm.
 *
 * TTL: samma hållbarhet på alla tre vägarna (webpush-headern, apns-expiration
 * och androids ttl) - en påminnelse som kommer fram efter eventstart är
 * meningslös, helgtipset får ett dygn.
 */
import type * as admin from 'firebase-admin';

export type PushPayload = { title: string; body: string; url: string; type: string; eventId?: string };

export type TokenPost = { token: string; platform?: unknown };

export function ärAppToken(platform: unknown): platform is 'ios' | 'android' {
    return platform === 'ios' || platform === 'android';
}

export function byggPushMeddelanden(
    tokens: readonly TokenPost[],
    payload: PushPayload,
    ttlSeconds: number,
    nowMs: number,
): admin.messaging.Message[] {
    // Alla data-värden måste vara strängar.
    const data = {
        type: payload.type,
        title: payload.title,
        body: payload.body,
        url: payload.url,
        eventId: payload.eventId ?? '',
    };
    return tokens.map(({ token, platform }) => {
        if (!ärAppToken(platform)) {
            return {
                token,
                data,
                webpush: { headers: { TTL: String(ttlSeconds), Urgency: 'high' } },
            };
        }
        return {
            token,
            notification: { title: payload.title, body: payload.body },
            data,
            apns: {
                headers: {
                    // Sekunder sedan epoken då Apple slänger meddelandet.
                    'apns-expiration': String(Math.floor(nowMs / 1000) + ttlSeconds),
                    'apns-priority': '10',
                },
                payload: { aps: { sound: 'default' } },
            },
            android: {
                priority: 'high' as const,
                ttl: ttlSeconds * 1000,
                notification: { sound: 'default' },
            },
        };
    });
}

/**
 * Bara fel som betyder att tokenen är DÖD får radera den. Förr raderades
 * tokenen vid alla fel - även tillfälliga (kvot, nätverk, Apple nere) - och
 * enheten tystnade tills någon slog på notiserna igen.
 */
const DÖDA_FEL = new Set([
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
]);

export function ärDödToken(code: string | undefined): boolean {
    return code != null && DÖDA_FEL.has(code);
}
