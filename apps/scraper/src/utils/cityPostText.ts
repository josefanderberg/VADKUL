/**
 * cityPostText.ts — texten till stadsinläggen på VADKUL-sidan.
 *
 * Formatet är ägarens val 20/8 (Sollefteå-utkastet var förlagan): ett TÄTT
 * inlägg i två sektioner — helgen/närmaste dagarna först, sedan "Och nästa
 * vecka:" — i stället för den gamla 5-raderslistan. Utbudet visar bredden;
 * det var så Hudiksvall (47/40/6) och Söderhamn (35/33) satte rekorden.
 *
 * Ren logik utan I/O — testas i cityPostText.test.ts. Skriptet
 * schedule-city-posts.ts står för SQLite/Graph/Firestore.
 *
 * Sidans röst är "vi", inte "jag" — maker-storyn hör hemma på det privata
 * kontot (samma beslut som tidigare version av skriptet).
 */

import { CATEGORY_EMOJI } from './llmAudit';

export interface CityEventRow {
    url: string;
    title: string;
    time: string;          // ISO
    /** Validerat slutdatum (ISO) — flerdagarsevent skrivs "onsdag–lördag"
     *  (FB-kommentaren om Live at Heart 26/8: festivalen visades bara på
     *  startdagen). null/utelämnad = en-dags. */
    endDate?: string | null;
    locationName: string;
    category: string;
    lat: number;
    lng: number;
}

/* ── Brusfiltret ──────────────────────────────────────────────────────────── */

/**
 * Rader som gör inlägget sämre även när de är närmast i tid:
 * korpenmatcher ("Lag A - Lag B"), kyrkans och förskolans veckorutiner.
 * Lärdomen från Söderhamn 7/8 (3 av 5 rader var PRO/kyrko-rutiner) — rutinerna
 * finns på kartan, men de säljer inte ett inlägg.
 */
export function isNoiseEvent(e: Pick<CityEventRow, 'title' | 'category'>): boolean {
    const t = e.title;
    if (e.category === 'sport' && /\s[-–]\s/.test(t) && !/parkrun|lopp|tävling|cup|race|\bSM\b|festival|träff/i.test(t)) {
        return true;    // seriematch "Lag - Lag" utan publikvärde
    }
    if (/(kören|ensemblen|kyrkokör\w*) övar|körövning/i.test(t)) return true;   // körens veckorep
    return /^(kyrkan (är )?öppen|kyrkkaffe|öppen förskola|öppna förskolan|mässa|högmässa|gudstjänst|morgonbön|laudes|veckomässa|sinnesromässa|lunchmässa|morgonmässa|kvällsmässa|måltid med mening|bibelstudie|bibelsamtal|konfirmandanmälan)/i.test(t);
}

/** Dragplåster-vikt per kategori — musik/scen/marknad bär inlägget. */
const CATEGORY_RANK: Record<string, number> = {
    festival: 6, music: 5, stage: 5, market: 5, party: 4, food: 4, art: 4,
    family: 3, sport: 2, social: 2, other: 2, course: 1,
};

export function rankCategory(category: string): number {
    return CATEGORY_RANK[category] ?? 1;
}

/* ── Urvalet: två sektioner ───────────────────────────────────────────────── */

export interface PickedRows {
    thisWeek: CityEventRow[];   // publiceringsdagen t.o.m. söndag samma vecka
    nextWeek: CityEventRow[];   // måndag–söndag veckan därpå
}

const DAY_MS = 86_400_000;

/** Söndagens sista millisekund i publiceringsdagens vecka (lokal tid). */
export function endOfPublishWeek(publishAt: number): number {
    const d = new Date(publishAt);
    d.setHours(23, 59, 59, 999);
    const toSunday = (7 - d.getDay()) % 7;   // sön = 0 dagar kvar
    return d.getTime() + toSunday * DAY_MS;
}

/** Titel-nyckel för dubblettrensning — samma event ligger ofta dubbelt i
 *  datat med små varianter ("Wilmer X" / "Wilmer X - Kackelstugan Ute").
 *  Dubblett = den ena nyckeln är prefix av den andra. */
const titleKey = (t: string) => t.toLowerCase().replace(/[^a-zåäö0-9]/g, '').slice(0, 28);
const isDupTitle = (key: string, seen: string[]) =>
    seen.some(s => s.startsWith(key) || key.startsWith(s));

function pickSection(events: CityEventRow[], max: number): CityEventRow[] {
    // Bäst dragplåster först, sedan sprid över dagar/platser som förr.
    const ranked = [...events].sort((a, b) =>
        rankCategory(b.category) - rankCategory(a.category) ||
        a.time.localeCompare(b.time));

    const seenTitles: string[] = [];
    const seenDay = new Map<string, number>();
    const seenVenue = new Set<string>();
    const picked: CityEventRow[] = [];

    for (const e of ranked) {
        if (picked.length >= max) break;
        const tk = titleKey(e.title);
        if (isDupTitle(tk, seenTitles)) continue;
        const day = e.time.slice(0, 10);
        const venue = (e.locationName ?? '').toLowerCase().trim();
        if ((seenDay.get(day) ?? 0) >= 3) continue;
        if (venue && seenVenue.has(venue)) continue;
        picked.push(e);
        seenTitles.push(tk);
        seenDay.set(day, (seenDay.get(day) ?? 0) + 1);
        if (venue) seenVenue.add(venue);
    }
    // Läsordningen är kronologisk även om urvalet var ranking-styrt.
    return picked.sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * Dela upp och välj rader för de två sektionerna. Tunna orter: allt som finns
 * (ärliga Hudiksvall-formatet), stora orter: taken håller inlägget läsbart.
 */
export function pickCityRows(
    events: CityEventRow[],
    publishAt: number,
    { maxThisWeek = 7, maxNextWeek = 5 }: { maxThisWeek?: number; maxNextWeek?: number } = {},
): PickedRows {
    const clean = events.filter(e => !isNoiseEvent(e));
    const weekEnd = endOfPublishWeek(publishAt);
    const nextWeekEnd = weekEnd + 7 * DAY_MS;

    const inWindow = (e: CityEventRow, from: number, to: number) => {
        const t = Date.parse(e.time);
        return !isNaN(t) && t >= from && t <= to;
    };

    return {
        thisWeek: pickSection(clean.filter(e => inWindow(e, publishAt, weekEnd)), maxThisWeek),
        nextWeek: pickSection(clean.filter(e => inWindow(e, weekEnd, nextWeekEnd)), maxNextWeek),
    };
}

/* ── Radformatet ──────────────────────────────────────────────────────────── */

const WEEKDAY = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];

/** Platsen nedkortad till venue-delen: "Kapellet Norrtälje, Norrtälje-Malsta
 *  församling" → "Kapellet Norrtälje". Tom om titeln redan säger platsen. */
export function shortVenue(title: string, locationName: string | undefined, townName?: string): string {
    const venue = (locationName ?? '').split(',')[0].trim();
    if (!venue) return '';
    if (title.toLowerCase().includes(venue.toLowerCase())) return '';
    // "— Kalmar" efter en Kalmar-rubrik säger ingenting.
    if (townName && venue.toLowerCase() === townName.toLowerCase()) return '';
    return venue;
}

export function formatCityRow(e: CityEventRow, { withDate = false, townName }: { withDate?: boolean; townName?: string } = {}): string {
    const emoji = CATEGORY_EMOJI[e.category] ?? '✨';
    const d = new Date(e.time);
    const hasTime = !(d.getHours() === 0 && d.getMinutes() === 0);
    let when = WEEKDAY[d.getDay()];
    if (withDate) when += ` ${d.getDate()}/${d.getMonth() + 1}`;
    // Flerdagarsevent: "onsdag–lördag" (med datum: "onsdag 2/9–lördag 5/9").
    // Bara när slutet är en SENARE kalenderdag — sluttid samma dag är brus i
    // det här täta formatet. Starttiden hängs på efter spannet som förut.
    const end = e.endDate ? new Date(e.endDate) : null;
    if (end && !isNaN(end.getTime()) && end.toDateString() !== d.toDateString() && end.getTime() > d.getTime()) {
        when += `–${WEEKDAY[end.getDay()]}`;
        if (withDate) when += ` ${end.getDate()}/${end.getMonth() + 1}`;
    }
    if (hasTime) {
        when += ` kl ${d.getHours()}${d.getMinutes() > 0 ? `.${String(d.getMinutes()).padStart(2, '0')}` : ''}`;
    }
    const venue = shortVenue(e.title, e.locationName, townName);
    return `${emoji} ${e.title}${venue ? ` — ${venue}` : ''} (${when})`;
}

/* ── Hela texten ──────────────────────────────────────────────────────────── */

/** Deterministisk variation: samma ort + dag ger samma text (omkörningar
 *  ska inte skapa nya varianter), olika orter får olika öppnare/avslut. */
function seed(townName: string, publishAt: number): number {
    const s = `${townName}|${new Date(publishAt).toISOString().slice(0, 10)}`;
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return Math.abs(h);
}

const OPENERS_WEEKEND = [
    (n: string) => `${n} i helgen — och en full vecka efter det 👇`,
    (n: string) => `Helgen i ${n} ser inte tom ut direkt 👇`,
    (n: string) => `Vad händer i ${n} i helgen? Mer än man tror 👇`,
];
const OPENERS_MIDWEEK = [
    (n: string) => `Veckan i ${n} 👇`,
    (n: string) => `Det händer grejer i ${n} de närmaste dagarna 👇`,
    (n: string) => `Vad händer i ${n} den här veckan? 👇`,
];
const CLOSERS = [
    'Vad har vi missat? Tipsa i kommentarerna 👇',
    'Vad blir det för er? 👇',
    'Vilken av dem lockar mest? 👇',
];

export function buildCityPostText(
    townName: string,
    link: string,
    rows: PickedRows,
    publishAt: number,
): string {
    const s = seed(townName, publishAt);
    const publishDay = new Date(publishAt).getDay();
    // tors–sön = helgvinkel, mån–ons = veckovinkel
    const openers = publishDay >= 4 || publishDay === 0 ? OPENERS_WEEKEND : OPENERS_MIDWEEK;

    const parts: string[] = [openers[s % openers.length](townName), ''];
    parts.push(...rows.thisWeek.map(e => formatCityRow(e, { townName })));
    if (rows.nextWeek.length > 0) {
        parts.push('', 'Och nästa vecka:');
        parts.push(...rows.nextWeek.map(e => formatCityRow(e, { withDate: true, townName })));
    }
    parts.push(
        '',
        'Allt kommer från vadkul.se — kartan där det som händer samlas på ett',
        'ställe i stället för utspritt på tio olika sidor. Gratis, inget konto',
        `behövs för att titta: ${link}`,
        '',
        CLOSERS[s % CLOSERS.length],
    );
    return parts.join('\n');
}
