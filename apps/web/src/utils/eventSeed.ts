import type { LinkEvent } from '@/types';
import type { EventCategoryType } from '@/utils/categories';

// ── Djuplänks-seed: kortet före kartan ───────────────────────────────────────
// Ett klick på ett event på en stadssida (eller /e/-delningssidan) navigerar
// till kartan med /?event=<id> — och kartan lät kortet vänta på hela Sveriges
// aggregat-lager (16+ MB JSON) innan det ens fick öppnas, trots att stadssidan
// redan hade titel/värd/bild/beskrivning serverrenderade. Överlämningen här
// löser det i två steg:
//
//   1. SEED: avsändarsidan lägger eventets kortfält i sessionStorage vid
//      klicket (writeEventSeed). Kartsidan läser dem vid boot (takeEventSeed)
//      och öppnar kortet KOMPLETT direkt — noll nätverk.
//   2. API: /api/event?id=<id> svarar med fulla fält ur aggregaten (~1 kB,
//      CDN-cachat) — täcker djuplänkar utan seed (delad länk, ny flik) och
//      fyller på seedens luckor (stadssidans beskrivning är kapad vid ~300
//      tecken, delningssidan saknar koordinater).
//
// Aggregatlagren tar sedan över per id när de landat; mergeDeepLinkEvent
// backfillar bara fält som lagren ännu inte bär (destinations saknar värd/
// bild/beskrivning tills cards/descriptions mergats in).
//
// sessionStorage är per flik — cmd/mittenklick till ny flik får ingen seed och
// tas om hand av API-vägen. Seeden är engångs och åldersbegränsad: en gammal
// kvarglömd seed ska aldrig öppna fel/förlegat kort.

export const EVENT_SEED_KEY = 'vadkul_event_seed';
export const EVENT_SEED_MAX_AGE_MS = 15 * 60_000;

/** JSON-formen i sessionStorage. Allt utom id/titel/starttid är valfritt —
 *  avsändare vet olika mycket (stadssidan nästan allt, delningssidan minst). */
export type EventSeedRaw = {
    v: 1;
    savedAt: number;
    id: string;
    title: string;
    /** Starttiden som epoch-ms. */
    t: number;
    hasSpecificTime?: boolean;
    lat?: number;
    lng?: number;
    locationName?: string;
    category?: string;
    emoji?: string;
    hostName?: string;
    coverImage?: string;
    price?: string;
    attendees?: number;
    /** Stadssidornas är kapad vid ~300 tecken (schema.org-trimmen) — API:t/
     *  descriptions-lagret fyller på med hela texten i efterhand. */
    description?: string;
};

const validCoords = (lat: unknown, lng: unknown): lat is number =>
    typeof lat === 'number' && typeof lng === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0);

/** Bygg kortets LinkEvent ur en validerad seed. Samma fältsemantik som
 *  linkEventService.mapDestinationsToLinkEvents: url = id (url ÄR primär-
 *  nyckeln för skrapade event), ogiltig koordinat → 0,0 ("oplacerad"). */
function seedRawToLinkEvent(raw: EventSeedRaw): LinkEvent {
    const time = new Date(raw.t);
    const coordsOk = validCoords(raw.lat, raw.lng);
    return {
        id: raw.id,
        url: raw.id,
        title: raw.title,
        time,
        createdAt: new Date(),
        locationName: raw.locationName || '',
        lat: coordsOk ? (raw.lat as number) : 0,
        lng: coordsOk ? (raw.lng as number) : 0,
        hostName: raw.hostName || '',
        category: (raw.category as EventCategoryType) || 'other',
        emoji: raw.emoji || undefined,
        coverImage: raw.coverImage || '',
        // undefined = "vet inte" → kortet visar "Hämtar beskrivning…" tills
        // API:t/lagren svarat. Sätts bara när avsändaren faktiskt hade en.
        description: raw.description || undefined,
        price: raw.price || undefined,
        attendees: raw.attendees ?? 0,
        hasSpecificTime: raw.hasSpecificTime ?? !(time.getHours() === 0 && time.getMinutes() === 0),
        isLocationVerified: false,
    };
}

/** REN parsning/validering (testbar): JSON-strängen från sessionStorage →
 *  LinkEvent, eller null när seeden inte gäller (fel event-id, för gammal,
 *  trasig/främmande data). */
export function parseEventSeed(json: string, id: string, nowMs: number): LinkEvent | null {
    let raw: unknown;
    try { raw = JSON.parse(json); } catch { return null; }
    if (!raw || typeof raw !== 'object') return null;
    const seed = raw as Partial<EventSeedRaw>;
    if (seed.v !== 1) return null;
    if (seed.id !== id) return null;
    if (typeof seed.title !== 'string' || !seed.title.trim()) return null;
    if (typeof seed.t !== 'number' || !Number.isFinite(seed.t)) return null;
    if (typeof seed.savedAt !== 'number' || !Number.isFinite(seed.savedAt)) return null;
    const age = nowMs - seed.savedAt;
    if (age < -60_000 || age > EVENT_SEED_MAX_AGE_MS) return null;
    return seedRawToLinkEvent(seed as EventSeedRaw);
}

/** Skriv överlämningen vid klick (stadssidor, delningssidan). Får aldrig
 *  kasta — privat läge utan sessionStorage ska bara betyda "ingen seed". */
export function writeEventSeed(seed: Omit<EventSeedRaw, 'v' | 'savedAt'>): void {
    try {
        sessionStorage.setItem(EVENT_SEED_KEY, JSON.stringify({ v: 1, savedAt: Date.now(), ...seed }));
    } catch { /* ingen storage — API-vägen tar det */ }
}

/** Läs och FÖRBRUKA seeden vid kartboot. Engångs: posten tas bort även när
 *  den inte matchar, så en kvarglömd seed aldrig spökar i senare besök. */
export function takeEventSeed(id: string, nowMs = Date.now()): LinkEvent | null {
    try {
        const json = sessionStorage.getItem(EVENT_SEED_KEY);
        if (!json) return null;
        sessionStorage.removeItem(EVENT_SEED_KEY);
        return parseEventSeed(json, id, nowMs);
    } catch {
        return null;
    }
}

/** REN mappning (testbar): /api/event-svarets event-objekt → LinkEvent.
 *  Samma sanering som seedRawToLinkEvent + endDate-vakten från
 *  linkEventService (omvänt spann → inget spann). */
export function apiEventToLinkEvent(ev: unknown, id: string): LinkEvent | null {
    if (!ev || typeof ev !== 'object') return null;
    const e = ev as Record<string, unknown>;
    if (e.id !== id) return null;
    if (typeof e.title !== 'string' || !e.title.trim()) return null;
    const t = typeof e.time === 'string' ? Date.parse(e.time) : NaN;
    if (!Number.isFinite(t)) return null;
    const base = seedRawToLinkEvent({
        v: 1,
        savedAt: 0,
        id,
        title: e.title,
        t,
        hasSpecificTime: typeof e.hasSpecificTime === 'boolean' ? e.hasSpecificTime : undefined,
        lat: typeof e.lat === 'number' ? e.lat : undefined,
        lng: typeof e.lng === 'number' ? e.lng : undefined,
        locationName: typeof e.locationName === 'string' ? e.locationName : undefined,
        category: typeof e.category === 'string' ? e.category : undefined,
        hostName: typeof e.hostName === 'string' ? e.hostName : undefined,
        coverImage: typeof e.coverImage === 'string' ? e.coverImage : undefined,
        price: typeof e.price === 'string' || typeof e.price === 'number' ? String(e.price) : undefined,
        attendees: typeof e.attendees === 'number' ? e.attendees : undefined,
        description: typeof e.description === 'string' ? e.description : undefined,
    });
    if (typeof e.url === 'string' && e.url) base.url = e.url;
    if (e.isLocationVerified === true) base.isLocationVerified = true;
    const end = typeof e.endDate === 'string' ? new Date(e.endDate) : null;
    if (end && !isNaN(end.getTime()) && end.getTime() > base.time.getTime()) base.endDate = end;
    return base;
}

/** Slå ihop kortets bästa kända data: `base` (aggregatens objekt, eller det
 *  som redan visas) vinner där den har innehåll; `extra` (seed/API-svar)
 *  fyller luckorna. Beskrivningen är undantaget — längsta texten vinner,
 *  eftersom seedens är kapad medan API:ts/lagrens är hela. */
export function mergeDeepLinkEvent(base: LinkEvent, extra: LinkEvent | null | undefined): LinkEvent {
    if (!extra || extra.id !== base.id) return base;
    const baseCoords = validCoords(base.lat, base.lng);
    const longestDesc = (extra.description?.length ?? 0) > (base.description?.length ?? 0)
        ? extra.description
        : base.description;
    return {
        ...base,
        hostName: base.hostName || extra.hostName,
        coverImage: base.coverImage || extra.coverImage,
        price: base.price || extra.price,
        emoji: base.emoji || extra.emoji,
        locationName: base.locationName || extra.locationName,
        endDate: base.endDate ?? extra.endDate,
        attendees: base.attendees || extra.attendees,
        description: longestDesc,
        lat: baseCoords ? base.lat : extra.lat,
        lng: baseCoords ? base.lng : extra.lng,
        hasSpecificTime: base.hasSpecificTime ?? extra.hasSpecificTime,
        category: base.category && base.category !== 'other' ? base.category : (extra.category ?? base.category),
    };
}

/** Hämta det djuplänkade eventet från /api/event?id= — återanvänder boot-
 *  scriptets promise (startad i HTML-parsningen, se (v2)/layout.tsx) när den
 *  finns. null vid miss/fel: kortet väntar då på aggregaten som förut. */
export async function fetchDeepLinkEvent(id: string): Promise<LinkEvent | null> {
    try {
        const w = window as unknown as { __vadkulDeepLinkEvent?: Promise<{ event?: unknown } | null> };
        const data = w.__vadkulDeepLinkEvent
            ? await w.__vadkulDeepLinkEvent
            : await fetch(`/api/event?id=${encodeURIComponent(id)}`)
                .then(r => (r.ok ? r.json() : null))
                .catch(() => null);
        return data?.event ? apiEventToLinkEvent(data.event, id) : null;
    } catch {
        return null;
    }
}
