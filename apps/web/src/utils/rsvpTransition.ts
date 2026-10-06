import type { EventRsvpStatus } from '@/types';

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
