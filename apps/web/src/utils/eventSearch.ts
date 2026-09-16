/**
 * eventSearch.ts — kartans eventsök: vad som matchar, i vilken ordning och
 * vilka bokstäver i titeln som ska stå i fetstil.
 *
 * Bakgrund (FB-klagomål 11/9: "blir helt andra bokstäver än det man skriver,
 * åtminstone på mobilen"): sökningen matchade titel, plats, arrangör OCH hela
 * URL:en, och träffarna låg i ren tidsordning. URL:erna bär UUID/hex-id:n
 * (svenskakyrkan.se/kalender?event=ab98…), så de första bokstäverna man
 * skriver träffade tusentals event där INGET synligt liknade söktexten — "ab"
 * gav 56 % rena URL-träffar, "cafe" 78 %. På mobilen syns bara de översta
 * raderna, och de var brus.
 *
 * Nu: titeln först, och inom titeln början före mitten. URL-matchningen är
 * kvar (sök "tickster" → plattformens event) men hamnar sist. Inom varje nivå
 * behålls listans ordning (tid).
 */

import { EVENT_CATEGORIES, type EventCategoryType } from './categories';
import { findCityPoint, type CityPoint } from './cityPoints';

export interface SearchableEvent {
    title: string;
    locationName?: string;
    hostName?: string;
    url?: string;
    /** Kategorinyckel (music, sport …) — söks via kategorins namn (16/9). */
    category?: string;
}

/** Rankningsnivåer, lägst först. -1 = ingen träff. */
export const SEARCH_TIER = {
    TITLE_START: 0,  // titeln BÖRJAR på söktexten ("Jazz…" på "jazz")
    TITLE_WORD: 1,   // ett ord i titeln börjar på den ("Kväll med jazz")
    TITLE_ANY: 2,    // mitt i ett ord i titeln ("Afrojazz")
    LOCATION: 3,     // platsraden — syns i raden
    HOST: 4,         // arrangören — syns inte i raden
    CATEGORY: 5,     // bara kategorin ("sport" → Sport & träning) — syns som emoji
    URL: 6,          // bara URL:en — syns inte alls
} as const;

/**
 * Söktexten som den ska jämföras: gemener, trimmad, inre mellanrum ihopslagna.
 * Trimmet är inte kosmetika: mobilens ordförslag lägger ett mellanslag EFTER
 * ordet, och "håkan " matchade då bara titlar där något följde efter namnet.
 */
export function normalizeSearchQuery(raw: string): string {
    return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Bokstav/siffra? (`\p{L}` kräver ES2018-target — tsconfig står på ES2017.) */
const isWordChar = (ch: string): boolean =>
    ch.toLowerCase() !== ch.toUpperCase() || (ch >= '0' && ch <= '9');

/**
 * Var i titeln träffen sitter. `lowerTitle` och `q` är redan gemener.
 * Början räknas FÖRE inledande tecken som inte är bokstäver — ”Hamlet” och
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
 * Övrigt är inget sökord. Förberäknat — listan är statisk.
 */
const CATEGORY_WORDS: { key: string; words: string[] }[] = (Object.keys(EVENT_CATEGORIES) as EventCategoryType[])
    .filter(key => key !== 'other')
    .map(key => ({
        key,
        words: EVENT_CATEGORIES[key].label.toLowerCase().split(/[^a-zåäöéü]+/).filter(w => w.length >= 3),
    }));

/**
 * Matchar söktexten eventets kategori? Prefix åt båda håll men snålt: man
 * skriver "spo" → Sport, och böjningar ("marknader", "barnen") får högst tre
 * tecken extra — "festival" ska INTE dra in hela Fest & uteliv.
 */
function categoryMatches(category: string | undefined, q: string): boolean {
    if (!category || q.length < 3) return false;
    const entry = CATEGORY_WORDS.find(c => c.key === category);
    if (!entry) return false;
    return entry.words.some(w => w.startsWith(q) || (q.startsWith(w) && q.length - w.length <= 3));
}

/** Ett ords (eller hela frasens) nivå i eventets fält, -1 = ingen träff. */
function fieldTier(evt: SearchableEvent, q: string): number {
    const t = titleTier(evt.title.toLowerCase(), q);
    if (t >= 0) return t;
    if (evt.locationName?.toLowerCase().includes(q)) return SEARCH_TIER.LOCATION;
    if (evt.hostName?.toLowerCase().includes(q)) return SEARCH_TIER.HOST;
    if (categoryMatches(evt.category, q)) return SEARCH_TIER.CATEGORY;
    if (evt.url?.toLowerCase().includes(q)) return SEARCH_TIER.URL;
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
 * event, nu verkar man kunna söka på antingen eller"). Prövar 1–3 ord i
 * SLUTET och i BÖRJAN (längst först) mot findCityPoint — exakt uppslag,
 * aldrig en gissning, så "kar" blir aldrig Karlstad. Resten är eventsöket;
 * bindeord närmast orten ("i", "på") tas bort.
 *
 * Bara när det finns mer än orten: en ren ortsökning ("göteborg") ger
 * city = null och sköts av stadsraden som förut. Bestod resten bara av
 * bindeord ("i göteborg") blir text tom — alla event runt orten.
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
 * Sökträffarna i visningsordning: nivå för nivå, listans egen ordning (tid)
 * inom varje nivå. Event som inte matchar tas bort.
 */
export function rankSearchResults<T extends SearchableEvent>(events: T[], q: string): T[] {
    if (!q) return events;
    const tiered: { evt: T; tier: number; i: number }[] = [];
    events.forEach((evt, i) => {
        const tier = eventSearchTier(evt, q);
        if (tier >= 0) tiered.push({ evt, tier, i });
    });
    tiered.sort((a, b) => a.tier - b.tier || a.i - b.i);
    return tiered.map(x => x.evt);
}

export interface HighlightSegment {
    text: string;
    hit: boolean;
}

/**
 * Delar upp `text` i träff/icke-träff för fetstil — ALLA förekomster, i
 * originalets skiftläge. `q` ska vara normaliserad. Om gemenerna inte har
 * samma längd som originalet (exotiska tecken som "İ") går index inte att
 * lita på — då hellre ingen fetstil än fel bokstäver i fetstil.
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
