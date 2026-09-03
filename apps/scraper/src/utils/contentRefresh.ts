/**
 * contentRefresh.ts — ska en KÄND händelses beskrivning/pris bytas mot vad
 * källan levererar nu?
 *
 * Bakgrund (2026-09-03): runnern hoppar över kända URL:er, så en beskrivning
 * som sparades kapad vid 500 tecken, med blankade å/ä/ö (buggen före
 * 2026-07-09) eller med ersättningstecken (�) blev kvar FÖR ALLTID — även
 * när motorn sedan länge levererade en hel, korrekt text. 159 beskrivningar
 * saknade fortfarande å/ä/ö och 1 509 var kapade vid exakt 500 tecken.
 *
 * Reglerna är avsiktligt snäva: vi byter bara när den nya texten BEVISLIGEN
 * är bättre (längre fortsättning av samma text, återfunna å/ä/ö, borttaget
 * skräp) — aldrig för att källan formulerat om sig. Ren modul, testad.
 */

const HAS_SWEDISH = /[åäöÅÄÖ]/;

/**
 * Ord där å/ä/ö blivit mellanslag ("f r", "v lkommen"). Samma lista som
 * repair-stripped-descriptions.ts — Unicode-gränser i stället för \b, som
 * annars matchar "ocks" inuti "också".
 */
const SPACE_HOLE_RE = new RegExp(
    '(?<!\\p{L})(?:' +
    'f r|h r|d r|n r|ocks|g r|st r|b rjar|v lkom(?:men|na)?|sj lv|f rest llning|f rel sning|l rdag|s ndag' +
    '|m nga|g rna|kv ll|tr dg rd|ppettider|anm l(?:an)?|f rs ljning|h lsningar' +
    '|h ller|fr n|ber ttar|m nniska|f redrag|bes k|k rlek|s song|gl dje|tr ff|m nad' +
    ')(?!\\p{L})', 'iu');

/** Ser texten ut att ha förlorat å/ä/ö (mellanslag i stället för bokstav)? */
export function looksStripped(text: string): boolean {
    return SPACE_HOLE_RE.test(text);
}

/** Ersättningstecken/ensamma surrogathalvor — spår av trasig kodning. */
const BROKEN_CHARS_RE = /�|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/** Kollapsa whitespace så gamla (en-rads) och nya (radbrytande) städningar jämförs lika. */
function norm(s: string): string {
    return s.replace(/\s+/g, ' ').trim();
}

/** Kapad-markörer i slutet som inte hör till texten själv. */
function core(s: string): string {
    return norm(s).replace(/(?:\s*(?:…|\.\.\.|\[…\]|\[\.\.\.\]))+$/, '').trim();
}

/**
 * Returnerar den FÄRSKA beskrivningen om den ska ersätta den sparade, annars null.
 *
 *  - sparad tom, färsk ≥ 20 tecken            → färsk
 *  - sparad saknar å/ä/ö (mellanslagshål), färsk har → färsk
 *  - sparad har �/trasiga surrogat, färsk inte        → färsk
 *  - färsk är en LÄNGRE FORTSÄTTNING av sparad (kapad vid tak) → färsk
 *  - sparad är kort platshållare (< 40 tecken) och färsk är ≥ 60 och minst dubbelt → färsk
 *  - annars null — omformuleringar i källan rör vi inte
 */
export function pickBetterDescription(
    stored: string | null | undefined,
    fresh: string | null | undefined,
): string | null {
    const f = (fresh ?? '').trim();
    if (f.length < 20) return null;
    const s = (stored ?? '').trim();
    if (!s) return f;
    const fn = norm(f);
    const sn = norm(s);
    if (fn === sn) return null;

    if (!HAS_SWEDISH.test(s) && looksStripped(s) && HAS_SWEDISH.test(f)) return f;
    if (BROKEN_CHARS_RE.test(s) && !BROKEN_CHARS_RE.test(f)) return f;

    const sc = core(s);
    if (sc && fn.length > sc.length + 20 && fn.startsWith(sc)) return f;
    // Kapad mitt i ett ord (gamla 500-taket): jämför fram till sista hela ordet.
    const lastWs = sc.lastIndexOf(' ');
    if (lastWs > 200 && fn.length > sc.length + 20 && fn.startsWith(sc.slice(0, lastWs))) return f;

    if (sn.length < 40 && fn.length >= 60 && fn.length >= sn.length * 2) return f;
    return null;
}

/** Pris fylls bara på när det saknas — ett sparat pris (även LLM-satt) rörs aldrig. */
export function pickBetterPrice(
    stored: string | null | undefined,
    fresh: string | null | undefined,
): string | null {
    const f = (fresh ?? '').trim();
    if (!f) return null;
    if ((stored ?? '').trim()) return null;
    return f;
}
