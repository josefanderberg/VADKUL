// Ren logik för stadssidornas "spotlight"-sektion: exponeringstrappan där
// boostade event (nivå 3) och VADKUL-skapade event (nivå 2) lyfts ovanför de
// externa (nivå 1, dag-för-dag-listan). React-fritt och testat — komponenten
// CityVadkulSpotlight gör bara hämtning + rendering.

export interface SpotEvent {
    id: string;
    title: string;
    /** ISO-sträng (UTC). */
    time: string;
    emoji?: string;
    locationName?: string;
    lat?: number;
    lng?: number;
    /** Fält för utfällningen på plats (EventExpanded) — följer med genom
     *  composeSpotlightRows via spread. Saknade fält fylls av /api/event. */
    category?: string;
    hostName?: string;
    coverImage?: string;
    price?: string;
    description?: string;
    attendees?: number;
    /** Tips (isTip på userCreated-dokumentet) — "Tipsat" i stället för
     *  "Skapat på VADKUL". */
    isTip?: boolean;
}

export interface SpotRow extends SpotEvent {
    /** Skapad på VADKUL (userCreated) — nivå 2-markering. */
    vadkul: boolean;
    /** Aktiv boost — nivå 3-markering (vinner över vadkul i sortering). */
    boosted: boolean;
}

const EARTH_R_KM = 6371;
export function spotDistKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_R_KM * Math.asin(Math.sqrt(a));
}

export const SPOTLIGHT_MAX_BOOSTED = 4;
export const SPOTLIGHT_MAX_VADKUL = 4;

/**
 * Sätt ihop spotlight-raderna. `userCreated` = stadens VADKUL-event (redan
 * radie-filtrerade av anroparen), `staticEvents` = sidans externa event
 * (trimmade, för boost-matchning), `boostedIds` = event-id:n med aktiv boost.
 * Passerade event filtreras bort; dubbletter (boostat VADKUL-event) hamnar
 * bara i boost-nivån. Sortering: soonest först inom varje nivå.
 */
export function composeSpotlightRows(
    userCreated: SpotEvent[],
    staticEvents: SpotEvent[],
    boostedIds: Set<string>,
    now = Date.now(),
): { boosted: SpotRow[]; vadkul: SpotRow[] } {
    // "Framtida" med samma anda som kartan: event som startat senaste timmen
    // räknas fortfarande som aktuella.
    const cutoff = now - 60 * 60 * 1000;
    const fresh = (e: SpotEvent) => {
        const t = new Date(e.time).getTime();
        return Number.isFinite(t) && t >= cutoff;
    };
    const byTime = (a: SpotEvent, b: SpotEvent) => new Date(a.time).getTime() - new Date(b.time).getTime();

    const userFresh = userCreated.filter(fresh).sort(byTime);
    const userIds = new Set(userFresh.map(e => e.id));

    const boosted: SpotRow[] = [
        ...userFresh.filter(e => boostedIds.has(e.id)).map(e => ({ ...e, vadkul: true, boosted: true })),
        ...staticEvents.filter(e => fresh(e) && boostedIds.has(e.id) && !userIds.has(e.id))
            .sort(byTime)
            .map(e => ({ ...e, vadkul: false, boosted: true })),
    ].sort(byTime).slice(0, SPOTLIGHT_MAX_BOOSTED);

    const boostedIdsOut = new Set(boosted.map(e => e.id));
    const vadkul: SpotRow[] = userFresh
        .filter(e => !boostedIdsOut.has(e.id))
        .map(e => ({ ...e, vadkul: true, boosted: false }))
        .slice(0, SPOTLIGHT_MAX_VADKUL);

    return { boosted, vadkul };
}

const DAY_FMT = new Intl.DateTimeFormat('sv-SE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Stockholm' });
const TIME_FMT = new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' });
const KEY_FMT = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit' });

/** "Idag 19:00" / "Imorgon 18:30" / "lör 6 sep 15:00" — lokal svensk tid.
 *  Midnatt utan klockslag (heldags-heuristiken) visar bara dagen. */
export function spotWhen(iso: string, now = Date.now()): string {
    const t = new Date(iso);
    if (isNaN(t.getTime())) return '';
    const key = KEY_FMT.format(t);
    const day = key === KEY_FMT.format(new Date(now)) ? 'Idag'
        : key === KEY_FMT.format(new Date(now + 864e5)) ? 'Imorgon'
        : DAY_FMT.format(t);
    const hhmm = TIME_FMT.format(t);
    return hhmm === '00:00' ? day : `${day} ${hhmm}`;
}
