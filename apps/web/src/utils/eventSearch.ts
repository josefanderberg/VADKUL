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

export interface SearchableEvent {
    title: string;
    locationName?: string;
    hostName?: string;
    url?: string;
}

/** Rankningsnivåer, lägst först. -1 = ingen träff. */
export const SEARCH_TIER = {
    TITLE_START: 0,  // titeln BÖRJAR på söktexten ("Jazz…" på "jazz")
    TITLE_WORD: 1,   // ett ord i titeln börjar på den ("Kväll med jazz")
    TITLE_ANY: 2,    // mitt i ett ord i titeln ("Afrojazz")
    LOCATION: 3,     // platsraden — syns i raden
    HOST: 4,         // arrangören — syns inte i raden
    URL: 5,          // bara URL:en — syns inte alls
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
 * Eventets nivå för söktexten, -1 om det inte matchar alls.
 * `q` ska vara normaliserad (normalizeSearchQuery) och icke-tom.
 */
export function eventSearchTier(evt: SearchableEvent, q: string): number {
    const t = titleTier(evt.title.toLowerCase(), q);
    if (t >= 0) return t;
    if (evt.locationName?.toLowerCase().includes(q)) return SEARCH_TIER.LOCATION;
    if (evt.hostName?.toLowerCase().includes(q)) return SEARCH_TIER.HOST;
    if (evt.url?.toLowerCase().includes(q)) return SEARCH_TIER.URL;
    return -1;
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
