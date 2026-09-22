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
    /** Arrangeras på VADKUL (isVadkulHostedEvent: userCreated utan url, inte
     *  tips) — grön ram, som på kartan. */
    hosted?: boolean;
    /** Dokumentet bakom ett utvecklat serietillfälle (id:t är då
     *  "<docId>__<datum>", se expandSeries). */
    seriesId?: string;
    /** Veckoseriens rytm ("Varje vecka") - sätts av anroparen. En veckoserie
     *  blir EN rad med nästa tillfälle och rytmen som chip. */
    rhythm?: string;
    /** Sätts av groupSpotEvents när raden står för flera dagar i rad: antalet
     *  dagar och sista dagens tid (ISO). */
    days?: number;
    lastTime?: string;
    /** Sätts av groupSpotEvents: alla dokument raden står för (boost-matchning). */
    docIds?: string[];
}

/** Radens ram: guld för boostade, grön för VADKUL-arrangerade, blå (som förut)
 *  för tips. Boosten vinner — den syns mest i exponeringstrappan. */
export type SpotFrame = 'gold' | 'hosted' | 'tip';
export function spotFrame(e: Pick<SpotRow, 'boosted' | 'hosted'>): SpotFrame {
    if (e.boosted) return 'gold';
    if (e.hosted) return 'hosted';
    return 'tip';
}

/** Fler rader än så här → sektionen kapas till de första radernas höjd och
 *  scrollar inuti (Josef 6/9: "bläddra genom dem innan man går till de andra"). */
export const SPOTLIGHT_VISIBLE_ROWS = 3;

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
    // BILD FÖRST inom varje nivå (Josef 22/9: "precis som vi har i listan
    // längre ner"), sedan tid. Sorteras FÖRE taket, så eventen med bild får
    // platserna först.
    const byImageThenTime = (a: SpotEvent, b: SpotEvent) =>
        (a.coverImage ? 0 : 1) - (b.coverImage ? 0 : 1) || byTime(a, b);

    // EN rad per sak: serier och samma event flera dagar i rad slås ihop
    // (groupSpotEvents). Grupperingen görs EFTER färskhetsfiltret, så en
    // tvådagarsgrej vars första dag passerat visas som den dag som är kvar.
    const userFresh = groupSpotEvents(userCreated.filter(fresh).sort(byTime));
    const docIdsOf = (e: SpotEvent) => e.docIds ?? [e.seriesId ?? e.id];
    const isBoosted = (e: SpotEvent) => boostedIds.has(e.id) || docIdsOf(e).some(id => boostedIds.has(id));
    const userIds = new Set(userFresh.flatMap(e => [e.id, ...docIdsOf(e)]));

    const boosted: SpotRow[] = [
        ...userFresh.filter(isBoosted).map(e => ({ ...e, vadkul: true, boosted: true })),
        ...staticEvents.filter(e => fresh(e) && boostedIds.has(e.id) && !userIds.has(e.id))
            .sort(byTime)
            .map(e => ({ ...e, vadkul: false, boosted: true })),
    ].sort(byImageThenTime).slice(0, SPOTLIGHT_MAX_BOOSTED);

    const boostedIdsOut = new Set(boosted.map(e => e.id));
    const vadkul: SpotRow[] = userFresh
        .filter(e => !boostedIdsOut.has(e.id))
        .sort(byImageThenTime)
        .map(e => ({ ...e, vadkul: true, boosted: false }))
        .slice(0, SPOTLIGHT_MAX_VADKUL);

    return { boosted, vadkul };
}

const DAY_FMT = new Intl.DateTimeFormat('sv-SE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Stockholm' });
const DAY_NO_MONTH_FMT = new Intl.DateTimeFormat('sv-SE', { weekday: 'short', day: 'numeric', timeZone: 'Europe/Stockholm' });
const LONG_DAY_FMT = new Intl.DateTimeFormat('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Stockholm' });
const LONG_DAY_NO_MONTH_FMT = new Intl.DateTimeFormat('sv-SE', { weekday: 'long', day: 'numeric', timeZone: 'Europe/Stockholm' });
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

/** Kalenderdagar (svensk tid) från `aIso` till `bIso`: 1 = dagen efter. */
function spotDayDiff(aIso: string, bIso: string): number {
    const utc = (iso: string) => {
        const [y, m, d] = KEY_FMT.format(new Date(iso)).split('-').map(Number);
        return Date.UTC(y, m - 1, d);
    };
    return Math.round((utc(bIso) - utc(aIso)) / 864e5);
}

/** "Samma event igen": titel + plats (adressraden, annars koordinaten). Samma
 *  nyckel som profilens "Mina event" (utils/myEventRows). */
function spotRepeatKey(e: SpotEvent): string {
    const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' ');
    const place = e.locationName ? norm(e.locationName) : '';
    return `${norm(e.title)}@@${place || `${(e.lat ?? 0).toFixed(3)},${(e.lng ?? 0).toFixed(3)}`}`;
}

/**
 * EN rad per sak, inte en per dag eller tillfälle (Josef 22/9: Växjö
 * Konstrunda lör 10 + sön 11 okt låg som två rader - "de borde ju vara
 * grupperade och visas som att de är 2 dagar").
 *
 *  1. VECKOSERIER (`rhythm` satt): nästa tillfälle står för serien.
 *  2. DAGAR I RAD: samma titel på samma plats, kalenderdagar utan lucka.
 *     Fångar både dagsserier (ett dokument, utvecklat) och sådant som lagts
 *     in som ett event per dag, som konstrundan. Raden får `days` och
 *     `lastTime`; första dagen står kvar som radens tid och id.
 *
 * Två tillfällen SAMMA dag (eftermiddag + kväll) är två rader, som förut.
 * `in` ska vara tidssorterad; ut kommer tidssorterat.
 */
export function groupSpotEvents(events: SpotEvent[]): SpotEvent[] {
    const out: SpotEvent[] = [];
    const docIdOf = (e: SpotEvent) => e.seriesId ?? e.id;

    const weeklySeen = new Set<string>();
    const byKey = new Map<string, SpotEvent[]>();
    for (const e of events) {
        if (e.rhythm) {
            const key = docIdOf(e);
            if (weeklySeen.has(key)) continue;
            weeklySeen.add(key);
            out.push({ ...e, docIds: [key] });
            continue;
        }
        const key = spotRepeatKey(e);
        const arr = byKey.get(key);
        if (arr) arr.push(e); else byKey.set(key, [e]);
    }

    for (const group of byKey.values()) {
        let chain: SpotEvent[] = [];
        const flush = () => {
            if (chain.length === 0) return;
            const first = chain[0];
            const docIds = [...new Set(chain.map(docIdOf))];
            out.push(chain.length > 1
                ? { ...first, days: chain.length, lastTime: chain[chain.length - 1].time, docIds }
                : { ...first, docIds });
            chain = [];
        };
        for (const e of group) {
            const prev = chain[chain.length - 1];
            const diff = prev ? spotDayDiff(prev.time, e.time) : null;
            if (diff === 1) chain.push(e);
            else if (diff === 0) out.push({ ...e, docIds: [docIdOf(e)] });
            else { flush(); chain = [e]; }
        }
        flush();
    }

    return out.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}

/** Radens chip för en sammanslagen rad: "2 dagar" / "Varje vecka". */
export function spotSpanTag(e: Pick<SpotEvent, 'days' | 'rhythm'>): string | null {
    if (e.days && e.days > 1) return `${e.days} dagar`;
    return e.rhythm ?? null;
}

/** Tiden på en rad som står för flera dagar i rad: "lör 10-sön 11 okt. 11:00",
 *  "Idag-imorgon 18:00", "fre 30 okt.-sön 1 nov.". Klockslaget är första
 *  dagens. */
export function spotRangeWhen(firstIso: string, lastIso: string, now = Date.now()): string {
    const a = new Date(firstIso);
    const b = new Date(lastIso);
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return spotWhen(firstIso, now);
    const today = KEY_FMT.format(new Date(now));
    const tomorrow = KEY_FMT.format(new Date(now + 864e5));
    const ka = KEY_FMT.format(a);
    const kb = KEY_FMT.format(b);
    const from = ka === today ? 'Idag'
        : ka === tomorrow ? 'Imorgon'
        : ka.slice(0, 7) === kb.slice(0, 7) ? DAY_NO_MONTH_FMT.format(a)
        : DAY_FMT.format(a);
    const to = kb === tomorrow ? 'imorgon' : DAY_FMT.format(b);
    const hhmm = TIME_FMT.format(a);
    return hhmm === '00:00' ? `${from}-${to}` : `${from}-${to} ${hhmm}`;
}

/** Utfällningens dagrad för flera dagar: "lördag 10-söndag 11 oktober". */
export function spotRangeDayLabel(firstIso: string, lastIso: string): string {
    const a = new Date(firstIso);
    const b = new Date(lastIso);
    const sameMonth = KEY_FMT.format(a).slice(0, 7) === KEY_FMT.format(b).slice(0, 7);
    return `${(sameMonth ? LONG_DAY_NO_MONTH_FMT : LONG_DAY_FMT).format(a)}-${LONG_DAY_FMT.format(b)}`;
}
