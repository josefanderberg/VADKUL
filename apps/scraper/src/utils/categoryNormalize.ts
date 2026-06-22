/**
 * Kanonisk kategori-normalisering.
 *
 * Källor och den äldre regel-klassningen (classify.ts) läcker in icke-kanoniska
 * värden — `culture`, `creative`, `workshop`, `outdoor`, `performing-arts`,
 * `övrigt`, `årligen återkommande` … — och HTML-entiteter (`natur &amp; outdoor`).
 * Webbens filter/legend/markörfärg känner bara de 11 kanoniska kategorierna
 * (apps/web/src/utils/categories.ts ↔ CATEGORY_EMOJI i llmAudit.ts), så allt som
 * skrivs till `link_events.category` måste passera denna funktion.
 *
 * Återanvänds vid scrape (sources/runner.ts) och audit (utils/llmAudit.ts) — och
 * av backfill-skriptet (scripts/backfill-categories.ts) för historiska rader.
 */

/** De 11 kanoniska kategorierna (speglar CATEGORY_EMOJI-nycklarna). */
export const CANONICAL_CATEGORIES = [
    'music', 'stage', 'art', 'sport', 'food',
    'market', 'party', 'social', 'course', 'family', 'other',
] as const;

const CANONICAL = new Set<string>(CANONICAL_CATEGORIES);

/** Avkoda de vanligaste HTML-entiteterna (namngivna + numeriska). */
export function decodeHtmlEntities(input: string): string {
    return input
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&apos;|&#0*39;/gi, "'")
        .replace(/&nbsp;/gi, ' ')
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeFromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => safeFromCodePoint(parseInt(d, 10)));
}

function safeFromCodePoint(cp: number): string {
    try {
        return Number.isFinite(cp) && cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : '';
    } catch {
        return '';
    }
}

/**
 * Synonym → kanonisk. Nycklarna är redan entity-avkodade, trimmade och gemena.
 * Mappningarna följer de kanoniska definitionerna (stage = teater/standup/komedi/
 * dans/opera/film, social = mingel/nätverk/quiz/brädspel/träffar, course =
 * workshop/kurs/seminarium/föredrag, sport = match/träning/yoga/löpning/friluft).
 */
const SYNONYMS: Record<string, string> = {
    // — konst / kreativt —
    creative: 'art',
    // — scen (teater/komedi/film/dans) —
    culture: 'stage',            // classify-bucketens "kultur"; närmast scen
    'performing-arts': 'stage',
    'performing arts': 'stage',
    comedy: 'stage',
    movie: 'stage',
    film: 'stage',
    play: 'stage',
    // — kurs / utbildning —
    workshop: 'course',
    education: 'course',
    training: 'course',
    study: 'course',
    lecture: 'course',
    // — socialt / spel —
    boardgame: 'social',
    'board game': 'social',
    game: 'social',
    mingle: 'social',
    community: 'social',
    // — sport / friluft —
    outdoor: 'sport',
    'natur & outdoor': 'sport',
    'natur and outdoor': 'sport',
    // — mat & dryck —
    'food-drink': 'food',
    'food & drink': 'food',
    'mat & dryck': 'food',
    mat: 'food',
    // — övrigt —
    'övrigt': 'other',
    'årligen återkommande': 'other',
    services: 'other',
    // — svenska etiketter (säkerhet om en källa skriver svenska) —
    musik: 'music',
    scen: 'stage',
    konst: 'art',
    marknad: 'market',
    fest: 'party',
    socialt: 'social',
    kurs: 'course',
    familj: 'family',
};

/**
 * Normalisera ett godtyckligt kategori-värde till en av de 11 kanoniska.
 * Okänt/tomt → 'other'.
 */
export function normalizeCategory(raw: unknown): string {
    if (raw == null) return 'other';
    const decoded = decodeHtmlEntities(String(raw)).trim().toLowerCase();
    if (!decoded) return 'other';

    const collapsed = decoded.replace(/[_\s]+/g, ' ').trim();
    if (CANONICAL.has(collapsed)) return collapsed;
    if (SYNONYMS[collapsed]) return SYNONYMS[collapsed];

    // sista chans: bindestreck-variant (food-drink vs "food drink")
    const hyphen = collapsed.replace(/\s+/g, '-');
    if (SYNONYMS[hyphen]) return SYNONYMS[hyphen];

    return 'other';
}
