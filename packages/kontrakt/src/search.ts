/**
 * search.ts - eventsöket som webben OCH appen kör: vad som matchar, i vilken
 * ordning och vilka bokstäver i titeln som ska stå i fetstil.
 *
 * Bor i kontraktet sedan 21/10 2026 (Josef: "nu är de ju inte synkade
 * riktigt webb och app"): förut låg logiken i webbens utils/eventSearch och
 * en handport i appens lib/sok, och de gled isär (appen rankade, webbens
 * lista låg i tidsordning; appen kände bara stadslistans orter). Nu är båda
 * shimmar hit.
 *
 * Bakgrund (FB-klagomål 11/9: "blir helt andra bokstäver än det man skriver,
 * åtminstone på mobilen"): sökningen matchade titel, plats, arrangör OCH hela
 * URL:en, och träffarna låg i ren tidsordning. URL:erna bär UUID/hex-id:n
 * (svenskakyrkan.se/kalender?event=ab98…), så de första bokstäverna man
 * skriver träffade tusentals event där INGET synligt liknade söktexten - "ab"
 * gav 56 % rena URL-träffar, "cafe" 78 %. På mobilen syns bara de översta
 * raderna, och de var brus.
 *
 * TVÅ LÄGEN, avgjorda av vad man skriver (Josef 20-21/10):
 *  - FILTERLISTA (`isFilterQuery`): inget fritt sökord - bara chips,
 *    kategoriord ("konst", "musik och teater") och/eller en ort. Man undrar
 *    vad som händer: dag för dag från kartans dag, det närmaste först inom
 *    dagen (`sortNearestFirst`). Kategoriorden (`parseCategoryQuery`)
 *    ERSÄTTER kartfiltrets kategorier och 🔥 för sökningen.
 *  - FRITT SÖK ("håkan hellström", "pustervik"): man letar efter en sak.
 *    Rankat (`searchEvents`/`rankSearchResults`): titel → plats/arrangör →
 *    kategori, NÄROMRÅDET först inom varje nivå (ägarbeslut 21/10:
 *    "närområdet prioriterat"), sedan nivån i detalj och tiden. Rena
 *    länkträffar visas bara när inget annat träffar.
 *
 * Rent och miljöfritt (kontraktets regel): inga beroenden utöver kontraktet.
 */
import type { EventCategoryType } from './categories';
import { findCityPoint, type CityPoint } from './cityPoints';

export interface SearchableEvent {
    title: string;
    locationName?: string;
    hostName?: string;
    /** Källänken. Saknas den används `id` - i appflödet ÄR id:t länken. */
    url?: string;
    id?: string;
    /** Kategorinyckel (music, sport …) - söks via kategorins namn (16/9). */
    category?: string;
}

/** Ett event som kan rankas och avståndssorteras. `time` som Date (webben)
 *  eller ISO-sträng (appflödet). */
export interface RankableEvent extends SearchableEvent {
    time: Date | string;
    lat?: number | null;
    lng?: number | null;
}

export type LatLng = { lat: number; lng: number };

/**
 * Hur nära orten ett event måste ligga för att räknas till en stadssökning
 * ("Hudiksvall", "jazz göteborg"). 2,5 mil ≈ orten plus dess byar (Hudiksvall
 * + Forsa/Hög/Iggesund). Siffran är en CIRKEL kring centrum, medan stadsrutan
 * man möts av efter hoppet räknar kartans rektangel: de landar nära varandra
 * men behöver inte bli exakt lika. Samma cirkel är fria sökets NÄROMRÅDE.
 */
export const CITY_SEARCH_RADIUS_KM = 25;

/** Rankningsnivåer, lägst först. -1 = ingen träff. */
export const SEARCH_TIER = {
    TITLE_START: 0,  // titeln BÖRJAR på söktexten ("Jazz…" på "jazz")
    TITLE_WORD: 1,   // ett ord i titeln börjar på den ("Kväll med jazz")
    TITLE_ANY: 2,    // mitt i ett ord i titeln ("Afrojazz")
    LOCATION: 3,     // platsraden - syns i raden
    HOST: 4,         // arrangören - syns inte i raden
    CATEGORY: 5,     // bara kategorin ("sport" → Sport & träning) - syns som emoji
    URL: 6,          // bara URL:en - syns inte alls
} as const;

/**
 * Söktexten som den ska jämföras: gemener, trimmad, inre mellanrum ihopslagna.
 * Trimmet är inte kosmetika: mobilens ordförslag lägger ett mellanslag EFTER
 * ordet, och "håkan " matchade då bara titlar där något följde efter namnet.
 */
export function normalizeSearchQuery(raw: string): string {
    return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Bokstav/siffra? (Inte `\p{L}` - webbens tsconfig står på ES2017.) */
const isWordChar = (ch: string): boolean =>
    ch.toLowerCase() !== ch.toUpperCase() || (ch >= '0' && ch <= '9');

/**
 * Var i titeln träffen sitter. `lowerTitle` och `q` är redan gemener.
 * Början räknas FÖRE inledande tecken som inte är bokstäver - ”Hamlet” och
 * "🎃 Halloween" börjar fortfarande på sitt första ord.
 */
function titleTier(lowerTitle: string, q: string): number {
    let idx = lowerTitle.indexOf(q);
    if (idx < 0) return -1;
    let best: number = SEARCH_TIER.TITLE_ANY;
    while (idx >= 0) {
        const atWordStart = idx === 0 || !isWordChar(lowerTitle[idx - 1]);
        if (atWordStart) {
            const onlyPunctBefore = ![...lowerTitle.slice(0, idx)].some(isWordChar);
            if (onlyPunctBefore) return SEARCH_TIER.TITLE_START;
            best = SEARCH_TIER.TITLE_WORD;
        }
        idx = lowerTitle.indexOf(q, idx + 1);
    }
    return best;
}

/**
 * Kategoriord (Josef 16/9, användarfeedback "bara få upp sport eller musik"):
 * orden i kategoriernas svenska namn ("Sport & träning" → sport, träning).
 * Övrigt är inget sökord. Namnen själva är presentationslager och bor per
 * klient - webbens och appens tester håller orden i takt med etiketterna.
 */
export const CATEGORY_SEARCH_WORDS: Readonly<Record<Exclude<EventCategoryType, 'other'>, readonly string[]>> = {
    music: ['musik'],
    stage: ['scen'],
    art: ['konst'],
    sport: ['sport', 'träning'],
    food: ['mat', 'dryck'],
    market: ['marknad'],
    party: ['fest', 'uteliv'],
    social: ['socialt', 'spel'],
    course: ['kurs', 'föreläsning'],
    family: ['familj', 'barn'],
};

const CATEGORY_WORDS = Object.entries(CATEGORY_SEARCH_WORDS) as [EventCategoryType, readonly string[]][];

/**
 * Matchar söktexten eventets kategori? Prefix åt båda håll men snålt: man
 * skriver "spo" → Sport, och böjningar ("marknader", "barnen") får högst tre
 * tecken extra - "festival" ska INTE dra in hela Fest & uteliv.
 */
function categoryMatches(category: string | undefined, q: string): boolean {
    if (!category || q.length < 3) return false;
    const words = CATEGORY_WORDS.find(([key]) => key === category)?.[1];
    if (!words) return false;
    return words.some(w => w.startsWith(q) || (q.startsWith(w) && q.length - w.length <= 3));
}

/** Ett ords (eller hela frasens) nivå i eventets fält, -1 = ingen träff. */
function fieldTier(evt: SearchableEvent, q: string): number {
    const t = titleTier(evt.title.toLowerCase(), q);
    if (t >= 0) return t;
    if (evt.locationName?.toLowerCase().includes(q)) return SEARCH_TIER.LOCATION;
    if (evt.hostName?.toLowerCase().includes(q)) return SEARCH_TIER.HOST;
    if (categoryMatches(evt.category, q)) return SEARCH_TIER.CATEGORY;
    if ((evt.url ?? evt.id)?.toLowerCase().includes(q)) return SEARCH_TIER.URL;
    return -1;
}

/**
 * Eventets nivå för söktexten, -1 om det inte matchar alls.
 * `q` ska vara normaliserad (normalizeSearchQuery) och icke-tom.
 *
 * Hela frasen först, som förut. Matchar den inte måste VARJE ORD matcha
 * något fält ("håkan pustervik", "quiz pub"), och raden får det sämsta
 * ordets nivå. Förr (t.o.m. 15/9) krävdes hela strängen i ett och samma fält.
 */
export function eventSearchTier(evt: SearchableEvent, q: string): number {
    const whole = fieldTier(evt, q);
    if (whole >= 0) return whole;
    const words = q.split(' ');
    if (words.length < 2) return -1;
    let worst = 0;
    for (const w of words) {
        const t = fieldTier(evt, w);
        if (t < 0) return -1;
        if (t > worst) worst = t;
    }
    return worst;
}

/** Småord som binder ortnamnet till resten ("jazz i göteborg"). */
const CITY_GLUE = new Set(['i', 'på', 'vid', 'nära', 'runt', 'in']);

function dropGlue(rest: string[], side: 'start' | 'end'): string {
    const out = [...rest];
    if (side === 'end') {
        while (out.length > 0 && CITY_GLUE.has(out[out.length - 1])) out.pop();
    } else {
        while (out.length > 0 && CITY_GLUE.has(out[0])) out.shift();
    }
    return out.join(' ');
}

/**
 * Ortnamn i söktexten (Josef 16/9, användarfeedback: "söka på stad och
 * event, nu verkar man kunna söka på antingen eller"). Prövar 1-3 ord i
 * SLUTET och i BÖRJAN (längst först) mot findCityPoint - exakt uppslag,
 * aldrig en gissning, så "kar" blir aldrig Karlstad. Resten är eventsöket;
 * bindeord närmast orten ("i", "på") tas bort.
 *
 * Bara när det finns mer än orten: en ren ortsökning ("göteborg") ger
 * city = null och sköts av stadsraden som förut. Bestod resten bara av
 * bindeord ("i göteborg") blir text tom - alla event runt orten.
 * `q` ska vara normaliserad (normalizeSearchQuery).
 */
export function splitCityFromQuery(q: string): { city: CityPoint | null; text: string } {
    const words = q.split(' ').filter(Boolean);
    for (let n = Math.min(3, words.length - 1); n >= 1; n--) {
        const tail = findCityPoint(words.slice(-n).join(' '));
        if (tail) return { city: tail, text: dropGlue(words.slice(0, -n), 'end') };
        const head = findCityPoint(words.slice(0, n).join(' '));
        if (head) return { city: head, text: dropGlue(words.slice(n), 'start') };
    }
    return { city: null, text: q };
}

/**
 * Vanliga sökord som betyder en kategori fast de inte står i dess namn.
 * BARA ord som täcker ungefär hela kategorin - "quiz" stod här 20/10 men är
 * mycket smalare än Socialt & spel (brädspel, mingel …), så det är vanlig
 * textsökning igen (21/10) och hittar quizen på titeln.
 */
const CATEGORY_SYNONYMS: Record<string, EventCategoryType> = {
    teater: 'stage',
    konsert: 'music',
    utställning: 'art',
    vernissage: 'art',
    loppis: 'market',
};

/** Svenska böjningsändelser som får hänga på ett kategoriord ("konsten",
 *  "konserter", "barnen"). En lista, inte "några tecken till" som
 *  rankningens categoryMatches: "match" är inte mat och "mats" inte heller. */
const CATEGORY_INFLECTIONS = ['', 'n', 't', 'en', 'et', 'na', 'er', 'ar', 'or', 'erna', 'arna', 'orna'];

/** Grundorden per riktig kategori - kategorinamnens ord (utan Övrigt;
 *  källorna kyrkan/PRO är inga kategorier) plus synonymerna. */
const CATEGORY_BASE_WORDS: { key: EventCategoryType; word: string }[] = [
    ...CATEGORY_WORDS.flatMap(([key, words]) => words.map(word => ({ key, word }))),
    ...Object.entries(CATEGORY_SYNONYMS).map(([word, key]) => ({ key, word })),
];

/** Kategorin ett HELT sökord står för, annars null. Strängare än
 *  rankningens kategoriträff: ett halvskrivet ord ("kon") räknas inte. */
export function categoryForWord(word: string): EventCategoryType | null {
    for (const { key, word: base } of CATEGORY_BASE_WORDS) {
        if (word.startsWith(base) && CATEGORY_INFLECTIONS.includes(word.slice(base.length))) return key;
    }
    return null;
}

/** Bindeord mellan kategoriorden ("musik och teater", "mat & dryck"). */
const CATEGORY_GLUE = new Set([...CITY_GLUE, 'och', '&', 'med']);

/**
 * Kategoriorden i en (normaliserad, ortfri - splitCityFromQuery först)
 * söktext. Bara när VARJE ord är ett kategoriord eller ett bindeord blir det
 * en kategorisökning: "konst", "musik och teater". Står något annat kvar
 * ("jazz", "konst jazz") är det vanlig textsökning och rankningen sköter
 * kategoriträffarna som förut. Tom mängd = ingen kategorisökning.
 *
 * En kategorisökning ERSÄTTER kartfiltrets kategorier och 🔥 (Josef 20/10:
 * med 🔥 på gav "konst växjö" 0 träffar) - klienten filtrerar med de här
 * kategorierna i stället och hoppar över textmatchningen.
 */
export function parseCategoryQuery(text: string): ReadonlySet<EventCategoryType> {
    const categories = new Set<EventCategoryType>();
    for (const word of text.split(' ').filter(Boolean)) {
        if (CATEGORY_GLUE.has(word)) continue;
        const key = categoryForWord(word);
        if (!key) return new Set();
        categories.add(key);
    }
    return categories;
}

/**
 * Är sökningen en FILTERLISTA - inget fritt sökord, bara kategoriord
 * och/eller en ort ("konst växjö", "i växjö")? `city`/`text` ur
 * splitCityFromQuery, `categories` ur parseCategoryQuery. Ren ortsökning
 * ("växjö", city = null) är det inte - den sköts av stadsraden.
 */
export function isFilterQuery(
    city: CityPoint | null,
    text: string,
    categories: ReadonlySet<EventCategoryType>,
): boolean {
    return categories.size > 0 || (!!city && !text);
}

/** Avstånd på marken i km (haversine). */
function distanceKm(a: LatLng, b: LatLng): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}

/** Eventets position, eller null utan riktiga koordinater (0,0 = saknas). */
function positionOf(e: { lat?: number | null; lng?: number | null }): LatLng | null {
    return typeof e.lat === 'number' && typeof e.lng === 'number' && !(e.lat === 0 && e.lng === 0)
        ? { lat: e.lat, lng: e.lng }
        : null;
}

const timeMs = (t: Date | string): number => (typeof t === 'string' ? Date.parse(t) : t.getTime());

/** Är eventet inom ortcirkeln (CITY_SEARCH_RADIUS_KM) runt `center`? */
export function withinCitySearch(e: { lat?: number | null; lng?: number | null }, center: LatLng): boolean {
    const p = positionOf(e);
    return !!p && distanceKm(center, p) <= CITY_SEARCH_RADIUS_KM;
}

/**
 * Inom så här många km räknas två event som lika nära, och då gäller
 * klockslaget - inne i en stad betyder 300 m inget, 17:00 före 18:00 gör det.
 */
export const SAME_DISTANCE_KM = 2;

/**
 * Varifrån "närmast" räknas: sökets ort ("konst växjö") först, sedan ens
 * position om den ligger i kartans ruta, annars kartans mitt. Positionen
 * utanför rutan väljs bort med flit - tittar man på Göteborg från Växjö är
 * det Göteborg man vill ha närmast, inte Göteborgs östra kant. Utan ruta
 * (appen) gäller positionen.
 */
export function nearestOrigin(
    searchCity: LatLng | null,
    userPos: LatLng | null,
    bounds: { west: number; south: number; east: number; north: number } | null,
): LatLng | null {
    if (searchCity) return { lat: searchCity.lat, lng: searchCity.lng };
    if (!bounds) return userPos;
    if (userPos && userPos.lat >= bounds.south && userPos.lat <= bounds.north
        && userPos.lng >= bounds.west && userPos.lng <= bounds.east) return userPos;
    return { lat: (bounds.south + bounds.north) / 2, lng: (bounds.west + bounds.east) / 2 };
}

/**
 * Filterlistans ordning inom EN dag: det närmaste `from` först, i band om
 * SAME_DISTANCE_KM där klockslaget avgör. Lika klockslag behåller
 * indataordningen (webbens eventDays har redan skilt dem på id). Event utan
 * koordinater hamnar sist.
 */
export function sortNearestFirst<T extends { time: Date | string; lat?: number | null; lng?: number | null }>(
    events: readonly T[],
    from: LatLng,
): T[] {
    const band = (e: T): number => {
        const p = positionOf(e);
        return p ? Math.floor(distanceKm(from, p) / SAME_DISTANCE_KM) : Infinity;
    };
    return events
        .map((e, i) => ({ e, i, band: band(e), t: timeMs(e.time) }))
        .sort((a, b) => (a.band === b.band ? 0 : a.band < b.band ? -1 : 1) || a.t - b.t || a.i - b.i)
        .map(x => x.e);
}

/** Fria sökets grova nivåer: titel → plats/arrangör → kategori → länk. */
function searchLevel(tier: number): number {
    if (tier <= SEARCH_TIER.TITLE_ANY) return 0;
    if (tier <= SEARCH_TIER.HOST) return 1;
    if (tier === SEARCH_TIER.CATEGORY) return 2;
    return 3;
}

/**
 * Fria sökets träffar i visningsordning (`q` normaliserad, ortfri):
 *  1. nivå: titel → plats/arrangör → kategori → länk,
 *  2. NÄROMRÅDET först (inom CITY_SEARCH_RADIUS_KM från `near`; ägarbeslut
 *     21/10 "närområdet prioriterat") - utan `near` gäller det inte,
 *  3. nivån i detalj (titelns början före ett ord i titeln före mitt i),
 *  4. tid, sist listans egen ordning.
 * Rena länkträffar följer bara med när INGET annat träffar - då är det
 * sökningen ("tickster" → plattformens event), annars är det UUID-brus.
 * Event som inte matchar tas bort. Tom söktext → listan orörd.
 */
export function rankSearchResults<T extends RankableEvent>(events: readonly T[], q: string, near: LatLng | null = null): T[] {
    if (!q) return [...events];
    const hits: { evt: T; level: number; local: number; tier: number; t: number; i: number }[] = [];
    events.forEach((evt, i) => {
        const tier = eventSearchTier(evt, q);
        if (tier < 0) return;
        const local = near && !withinCitySearch(evt, near) ? 1 : 0;
        hits.push({ evt, level: searchLevel(tier), local, tier, t: timeMs(evt.time), i });
    });
    const onlyLinks = hits.every(h => h.level === 3);
    return hits
        .filter(h => onlyLinks || h.level < 3)
        .sort((a, b) => a.level - b.level || a.local - b.local || a.tier - b.tier || a.t - b.t || a.i - b.i)
        .map(h => h.evt);
}

/**
 * Fria sökets träffMÄNGD utan ordning - samma regel som rankSearchResults
 * (rena länkträffar bara när inget annat träffar). För kartans filter och
 * stadsradens siffra: markörerna ska vara samma event som listan visar.
 */
export function filterSearchMatches<T extends SearchableEvent>(events: readonly T[], q: string): T[] {
    if (!q) return [...events];
    const tiers = events.map(e => eventSearchTier(e, q));
    const anyRealHit = tiers.some(t => t >= 0 && t < SEARCH_TIER.URL);
    return events.filter((_, i) => tiers[i] >= 0 && (!anyRealHit || tiers[i] < SEARCH_TIER.URL));
}

/**
 * Hela fria söket från rå söktext: ortnamnet ("jazz göteborg") begränsar
 * till ortcirkeln och är då också närområdet, resten rankas
 * (rankSearchResults). Bara en ort ("i göteborg") = allt i cirkeln i
 * tidsordning. Filterlistan (isFilterQuery) går INTE den här vägen.
 */
export function searchEvents<T extends RankableEvent>(events: readonly T[], query: string, near: LatLng | null = null): T[] {
    const q = normalizeSearchQuery(query);
    if (!q) return [];
    const { city, text } = splitCityFromQuery(q);
    const pool = city ? events.filter(e => withinCitySearch(e, city)) : events;
    if (!text) return [...pool].sort((a, b) => timeMs(a.time) - timeMs(b.time));
    return rankSearchResults(pool, text, city ?? near);
}

export interface HighlightSegment {
    text: string;
    hit: boolean;
}

/**
 * Delar upp `text` i träff/icke-träff för fetstil - ALLA förekomster, i
 * originalets skiftläge. `q` ska vara normaliserad. Om gemenerna inte har
 * samma längd som originalet (exotiska tecken som "İ") går index inte att
 * lita på - då hellre ingen fetstil än fel bokstäver i fetstil.
 */
export function highlightSegments(text: string, q: string): HighlightSegment[] {
    const lower = text.toLowerCase();
    if (!q || lower.length !== text.length) return [{ text, hit: false }];
    const out: HighlightSegment[] = [];
    let pos = 0;
    let idx = lower.indexOf(q);
    while (idx >= 0) {
        if (idx > pos) out.push({ text: text.slice(pos, idx), hit: false });
        out.push({ text: text.slice(idx, idx + q.length), hit: true });
        pos = idx + q.length;
        idx = lower.indexOf(q, pos);
    }
    if (pos < text.length) out.push({ text: text.slice(pos), hit: false });
    return out;
}
