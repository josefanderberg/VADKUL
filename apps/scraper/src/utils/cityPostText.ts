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

/* ── Opt-in-källorna ──────────────────────────────────────────────────────── */

/**
 * Svenska kyrkan, PRO och Korpen är OPT-IN på kartan — en utloggad besökare
 * ser dem inte alls förrän hen kryssar i dem (utils/categoryDefaults, 31/8).
 * De bär samtidigt ~2/3 av eventmängden i storstadsområdena.
 *
 * Ett stadsinlägg fyllt av dem lovar därför något länken inte levererar:
 * Stockholm-inlägget 1/9 hade 11 av 12 rader ur kyrkan/PRO, och den som
 * klickade sig in såg inget av dem. Källorna hålls helt utanför inläggen
 * (ägarbeslut 1/9) — inlägget ska spegla kartan en ny besökare möter.
 *
 * Speglar apps/web/src/utils/sources.ts (SOURCE_DEFS). Ändras den ena måste
 * den andra med, annars glider inlägg och karta isär igen.
 */
export function isOptInSource(url: string): boolean {
    let host: string;
    try { host = new URL(url).hostname.toLowerCase(); } catch { return false; }
    return host.includes('svenskakyrkan')
        || host === 'pro.se' || host.endsWith('.pro.se')
        || host.includes('korpen');
}

/**
 * Biljettsläppta event är dragplåster per definition — någon har redan
 * bestämt att de är värda att ta betalt för. Ticketmaster väger tyngst
 * (ägarens prioritet 1/9); affiliatelänkarna går via ticketmaster.evyy.net,
 * därför substrängmatchning och inte exakt värdnamn.
 */
export function ticketBoost(url: string): number {
    if (/ticketmaster/i.test(url)) return 6;
    if (/tickster|billetto|nortic|ticketpress|eventbrite/i.test(url)) return 3;
    return 0;
}

/* ── Brusfiltret ──────────────────────────────────────────────────────────── */

/**
 * Rader som gör inlägget sämre även när de är närmast i tid:
 * korpenmatcher ("Lag A - Lag B"), kyrkans och förskolans veckorutiner.
 * Lärdomen från Söderhamn 7/8 (3 av 5 rader var PRO/kyrko-rutiner) — rutinerna
 * finns på kartan, men de säljer inte ett inlägg.
 */
/**
 * Körrep känns igen på att titeln ÄR körens namn. Den gamla regeln krävde
 * ordet "övar" och släppte därför igenom nästan allihop — "Diskantkören",
 * "Körrep Kyrkokören", "Västlands kyrkokör", "Stalakören" heter precis så i
 * datat (Eksjö-inlägget 5/9: 5 av 11 rader var körrep).
 *
 * Konsertord räddar raden: en kör som faktiskt uppträder hör hemma i
 * inlägget, det är veckorepetitionen som inte gör det.
 */
const CHOIR = /kör(en|rep|övning)\b|kyrkokör|[a-zåäö]{3,}kören\b|ungdomskör|diskantkör|sånggrupp|ensemblen övar/i;
const CHOIR_PERFORMS = /konsert|framträd|uppträd|allsång|festival|sjunger för|julkonsert|luciakonsert/i;

export function isChoirRehearsal(title: string): boolean {
    return CHOIR.test(title) && !CHOIR_PERFORMS.test(title);
}

export function isNoiseEvent(e: Pick<CityEventRow, 'title' | 'category'>): boolean {
    const t = e.title;
    if (e.category === 'sport' && /\s[-–]\s/.test(t) && !/parkrun|lopp|tävling|cup|race|\bSM\b|festival|träff/i.test(t)) {
        return true;    // seriematch "Lag - Lag" utan publikvärde
    }
    if (isChoirRehearsal(t)) return true;                                       // körens veckorep
    return /^(kyrkan (är )?öppen|butiken är öppen|kyrkkaffe|kyrkis|öppen kyrkis|öppna kyrkis|sångstund|öppen förskola|öppna förskolan|mässa|högmässa|gudstjänst|morgonbön|laudes|veckomässa|sinnesromässa|lunchmässa|morgonmässa|kvällsmässa|måltid med mening|bibelstudie|bibelsamtal|konfirmandanmälan)/i.test(t);
}

/** Dragplåster-vikt per kategori — musik/scen/marknad bär inlägget. */
const CATEGORY_RANK: Record<string, number> = {
    festival: 6, music: 5, stage: 5, market: 5, party: 4, food: 4, art: 4,
    family: 3, sport: 2, social: 2, other: 2, course: 1,
};

export function rankCategory(category: string): number {
    return CATEGORY_RANK[category] ?? 1;
}

/**
 * Dragplåster-poäng: vad som förtjänar en av inläggets tolv rader.
 *
 * Ersätter den gamla sorteringen "kategori, sedan tidigast först". Den lät
 * tiden avgöra inom varje kategori, vilket systematiskt gav förmiddagen
 * tidigt i veckan företräde framför lördagskvällen — kyrkomusiken på
 * tisdag kl 9 slog varje konsert på fredag kl 19 (Stockholm 1/9).
 *
 * Kategorin väger fortfarande tyngst (×10), biljettsläppet näst, och
 * kvällstid sist: kl 17–22 är när man faktiskt går ut.
 */
export function dragScore(e: Pick<CityEventRow, 'category' | 'url' | 'time'>): number {
    let score = rankCategory(e.category) * 10 + ticketBoost(e.url);
    const hour = new Date(e.time).getHours();
    if (hour >= 17 && hour <= 22) score += 3;
    else if (hour >= 12 && hour < 17) score += 1;
    return score;
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
const titleKey = (t: string) => t.toLowerCase()
    // Ledorden skiljer sig mellan källorna och lurade prefix-jämförelsen:
    // Ticketmasters "Konsert: Jacob Karlzon Questar" och arrangörens "Jacob
    // Karlzon QUESTAR" stod båda i Älmhult-inlägget 2/9.
    //
    // Separatorn och lookahead:en är inte pynt: utan dem åt regexen upp en
    // titel som BARA är ledordet ("Konsert"), och en tom nyckel är prefix av
    // allt — hela sektionen hade räknats som en enda dubblett.
    .replace(/^(konsert|live|biljetter|föreställning|show)\s*[:–-]\s*(?=\S)/, '')
    .replace(/[^a-zåäö0-9]/g, '').slice(0, 28);
const isDupTitle = (key: string, seen: string[]) =>
    // Tom nyckel (titel utan bokstäver) jämförs aldrig — den är prefix av allt.
    key !== '' && seen.some(s => s !== '' && (s.startsWith(key) || key.startsWith(s)));

function pickSection(events: CityEventRow[], max: number, seenTitles: string[]): CityEventRow[] {
    // Bäst dragplåster först, sedan sprid över dagar/platser som förr.
    const ranked = [...events].sort((a, b) =>
        dragScore(b) - dragScore(a) ||
        a.time.localeCompare(b.time));

    const seenDay = new Map<string, number>();
    const seenCategory = new Map<string, number>();
    const seenVenue = new Set<string>();
    const picked: CityEventRow[] = [];

    const take = (categoryCap: number) => {
        for (const e of ranked) {
            if (picked.length >= max) return;
            const tk = titleKey(e.title);
            if (isDupTitle(tk, seenTitles)) continue;
            const day = e.time.slice(0, 10);
            const venue = (e.locationName ?? '').toLowerCase().trim();
            if ((seenDay.get(day) ?? 0) >= 3) continue;
            if ((seenCategory.get(e.category) ?? 0) >= categoryCap) continue;
            if (venue && seenVenue.has(venue)) continue;
            picked.push(e);
            seenTitles.push(tk);
            seenDay.set(day, (seenDay.get(day) ?? 0) + 1);
            seenCategory.set(e.category, (seenCategory.get(e.category) ?? 0) + 1);
            if (venue) seenVenue.add(venue);
        }
    };

    // TVÅ RUNDOR. Första med hårt kategoritak, så bredden får företräde framför
    // rankningen: en ren topplista blir en genrelista — Stockholm 2/9 gav bara
    // "music, stage" innan taket fanns, trots 3000 event att välja bland.
    //
    // Andra rundan lyfter taket och fyller resten. Den är till för de tunna
    // orterna: har Åmål bara konserter ska inlägget få bestå av konserter,
    // hellre än att kapas till två rader av ett tak som var tänkt för
    // storstadens överflöd.
    take(Math.max(1, Math.ceil(max / 4)));
    if (picked.length < max) take(Infinity);

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
    const clean = events.filter(e => !isOptInSource(e.url) && !isNoiseEvent(e));
    const weekEnd = endOfPublishWeek(publishAt);
    const nextWeekEnd = weekEnd + 7 * DAY_MS;

    const inWindow = (e: CityEventRow, from: number, to: number) => {
        const t = Date.parse(e.time);
        return !isNaN(t) && t >= from && t <= to;
    };

    // Titel-dubbletterna räknas över BÅDA sektionerna: en pjäs som spelas varje
    // helg stod annars en gång i "i veckan" och en gång i "nästa vecka"
    // (Stockholm 2/9: MAMMA MIA! THE PARTY två gånger).
    const seenTitles: string[] = [];
    const thisWeek = pickSection(clean.filter(e => inWindow(e, publishAt, weekEnd)), maxThisWeek, seenTitles);
    const nextWeek = pickSection(clean.filter(e => inWindow(e, weekEnd, nextWeekEnd)), maxNextWeek, seenTitles);
    return { thisWeek, nextWeek };
}

/**
 * Kvalitetsgolvet (ägarbeslut 1/9): en ort som inte kan fylla inlägget med
 * riktiga event ska hoppas över helt, inte postas med ett tunt eller
 * rutindominerat inlägg. Beställningen var "de städer som har de allra
 * bästa och mest varierade eventen".
 *
 * Två krav, båda på det FILTRERADE urvalet: tillräckligt många rader, och
 * tillräcklig bredd. Bredden är det som skiljer ett inlägg som visar vad
 * orten erbjuder från en lista med tolv konserter.
 */
export function meetsQualityFloor(
    rows: PickedRows,
    { minRows = 8, minCategories = 3 }: { minRows?: number; minCategories?: number } = {},
): boolean {
    const all = [...rows.thisWeek, ...rows.nextWeek];
    if (all.length < minRows) return false;
    return new Set(all.map(e => e.category)).size >= minCategories;
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

/* ── Instagram-varianten ──────────────────────────────────────────────────── */

/** IG:s tak för bildtext. Stadsinläggen ligger på ~1000, men en ort med
 *  många rader ska kapas i stället för att avvisas av Meta. */
export const IG_CAPTION_MAX = 2200;

/** "Västerås" → "västerås", "Upplands Väsby" → "upplandsväsby". */
export function hashtagFor(townName: string): string {
    return townName.toLowerCase().replace(/[^a-zåäöéü0-9]/g, '');
}

/**
 * Samma inlägg, anpassat för Instagram.
 *
 * Texten är ORÖRD — den är kurerad för hand (se docs/outreach/stadsinlagg-*)
 * och ska se likadan ut på båda ytorna. Skillnaden är hashtaggarna: FB
 * rankar dem inte, IG hittar inlägget genom dem. Länken i texten blir inte
 * klickbar på Instagram, men den säger fortfarande vart man ska.
 */
export function buildIgCaption(postText: string, townName: string): string {
    const tags = ['#vadkul', `#${hashtagFor(townName)}`, '#evenemang', '#dethänder'].join(' ');
    const full = `${postText.trimEnd()}\n\n${tags}`;
    if (full.length <= IG_CAPTION_MAX) return full;
    // Kapa brödtexten, aldrig taggarna — de är hela poängen med IG-varianten.
    const room = IG_CAPTION_MAX - tags.length - 4;
    return `${postText.slice(0, room).trimEnd()}…\n\n${tags}`;
}
