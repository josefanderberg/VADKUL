/**
 * Vänprofilens eventurval (spår 3, 7/10 kväll - "se vilka de är intresserade
 * av, kommer på"). REN logik: vilka av vännens svar som visas, i vilken
 * ordning, och om listan alls får visas (integritetsgrinden).
 *
 * Underlaget är vännens users-dokument (publikt läsbart): goingEventIds/
 * interestedEventIds - samma spegel som kartan/stadssidorna skriver via
 * arrayUnion (useEventRsvp). Listorna är append-ordnade, så SLUTET är de
 * senaste svaren - vi tar bakifrån och visar nyast svarade först innan
 * tidsfiltret/sorteringen tar vid.
 */
import type { EventRsvpStatus, LinkEvent } from '@/types';
import { isEventPast } from '@/components/v2/v2MapBricka';

export interface FriendRsvpPick {
    id: string;
    status: EventRsvpStatus;
}

/**
 * Integritetsgrinden: users.rsvpVisibleToFriends - UTELÄMNAD = synlig (fältet
 * föds först när någon aktivt stänger av, samma tolkning som weeklyDigest).
 * OBS: grinden upprätthålls i KLIENTEN - users-dokumentet är publikt läsbart
 * på regelnivå (se docs/socialt-lager.md, beslut 2 för Josef).
 */
export function friendRsvpVisible(userDocData: unknown): boolean {
    if (!userDocData || typeof userDocData !== 'object') return true;
    return (userDocData as Record<string, unknown>).rsvpVisibleToFriends !== false;
}

/**
 * Plocka vännens svar ur users-dokumentets listor: validera defensivt,
 * dubblett mellan listorna = Kommer vinner (samma företräde som
 * rsvpTransition - ett svar i taget), tak så uppslagen mot event-API:t
 * aldrig växer med listlängden (egress).
 */
export function pickFriendEventIds(going: unknown, interested: unknown, cap = 12): FriendRsvpPick[] {
    const list = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length > 0) : [];
    const picks: FriendRsvpPick[] = [];
    const seen = new Set<string>();
    // Bakifrån = senast svarade först; Kommer-listan först så den vinner dubbletter.
    for (const id of list(going).reverse()) {
        if (!seen.has(id)) { seen.add(id); picks.push({ id, status: 'going' }); }
    }
    for (const id of list(interested).reverse()) {
        if (!seen.has(id)) { seen.add(id); picks.push({ id, status: 'interested' }); }
    }
    return picks.slice(0, Math.max(0, cap));
}

export interface FriendUpcomingEvent {
    evt: LinkEvent;
    status: EventRsvpStatus;
}

/**
 * Koppla urvalet till faktiska event och behåll bara KOMMANDE (isEventPast -
 * samma gräns som alla andra ytor, uppfinn aldrig en egen). Sorteras i
 * tidsordning; event som inte gick att slå upp är redan borta (resolved
 * saknar dem). Dubblerade uppslagsmissar är anroparens sak att logga inte.
 */
export function upcomingFriendEvents(
    picks: FriendRsvpPick[],
    resolved: ReadonlyMap<string, LinkEvent>,
    nowMs: number,
): FriendUpcomingEvent[] {
    const rows: FriendUpcomingEvent[] = [];
    for (const p of picks) {
        const evt = resolved.get(p.id);
        if (!evt || isEventPast(evt, nowMs)) continue;
        rows.push({ evt, status: p.status });
    }
    rows.sort((a, b) => a.evt.time.getTime() - b.evt.time.getTime());
    return rows;
}
