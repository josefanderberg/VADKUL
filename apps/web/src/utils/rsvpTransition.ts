import type { EventRsvpStatus } from '@/types';
import { eventShareSlug } from '@/utils/eventShareSlug';

/**
 * Kommer/Intresserad-svarets övergångar (6/10, spår 3). Ett tryck på samma
 * knapp togglar av; ett tryck på den andra byter. REN logik så räknar-
 * deltorna (eventStats.going/.interested) aldrig glider ur synk med valet:
 * varje övergång ger exakt de increments som gör serverns siffror rätt.
 */
export function nextRsvp(
    prev: EventRsvpStatus | null,
    pressed: EventRsvpStatus,
): EventRsvpStatus | null {
    return prev === pressed ? null : pressed;
}

export interface RsvpCountDeltas {
    going: number;
    interested: number;
}

/** Räknardeltat för övergången prev → next. Noll-deltan utelämnas inte —
 *  anroparen skickar bara de fält som är ≠ 0. */
export function rsvpCountDeltas(
    prev: EventRsvpStatus | null,
    next: EventRsvpStatus | null,
): RsvpCountDeltas {
    const d: RsvpCountDeltas = { going: 0, interested: 0 };
    if (prev === next) return d;
    if (prev) d[prev] -= 1;
    if (next) d[next] += 1;
    return d;
}

/** Dokument-id:t för svaret: veckoserietillfällen ("<docId>__2026-09-18")
 *  svarar på seriens DOKUMENT — samma regel som delningslänken (/e/). */
export function rsvpShareId(eventId: string, userCreated: boolean | undefined): string {
    return userCreated ? eventId.split('__')[0] : eventId;
}

/** BJUD MED-länken (6/10): /e/<slug>?inb=1&fran=<uid> - mottagaren landar på
 *  kartan med inbjudningsbannern och svarar utan konto. DELAD av kartkortet
 *  ((v2)/page.tsx) och stadssidornas utfällda event, så länken aldrig ser
 *  olika ut beroende på var man bjöd. fromUid null = utloggad (ingen fran). */
export function inviteUrl(origin: string, eventId: string, userCreated: boolean | undefined, fromUid: string | null): string {
    const fran = fromUid ? `&fran=${encodeURIComponent(fromUid)}` : '';
    return `${origin}/e/${eventShareSlug(rsvpShareId(eventId, userCreated))}?inb=1${fran}`;
}

/** localStorage-nyckeln för eget svar — DELAD mellan kartan ((v2)/page.tsx)
 *  och stadssidorna (hooks/useEventRsvp): {going: string[], interested: string[]}. */
export const RSVP_EVENTS_KEY = 'vadkul_rsvp_events';

/** Tolka lagringsvärdet — ren och defensiv, som parseMapFilter. */
export function parseRsvpLocal(raw: string | null): { going: string[]; interested: string[] } {
    const empty = { going: [] as string[], interested: [] as string[] };
    if (!raw) return empty;
    let obj: unknown;
    try { obj = JSON.parse(raw); } catch { return empty; }
    if (!obj || typeof obj !== 'object') return empty;
    const list = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    const { going, interested } = obj as Record<string, unknown>;
    return { going: list(going), interested: list(interested) };
}
