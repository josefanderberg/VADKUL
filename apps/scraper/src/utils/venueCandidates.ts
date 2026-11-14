/**
 * venueCandidates.ts — OSM-platser med egen webbplats → kandidater för
 * webb-snöbollen. Ren modul (ingen I/O); skörden bor i
 * scripts/harvest-venue-candidates.ts.
 *
 * Bakgrund (jämförelsen mot Happymap 14/11 2026): det vi saknar är inte de
 * stora kalendrarna utan de UNIKA ställena — krogen med livemusik på
 * fredagar, gastropuben med ölprovning, caféet med quiz. Snöbollens skörd
 * följer bara länkar i event vi redan har, och dit kommer en restaurang
 * aldrig. OSM vet däremot vilka ställen som finns i en ort och vad deras
 * webbplats heter. Den här modulen rangordnar dem; proben och rimlighets-
 * kontrollen (bulk-probe, snowballSmoke) avgör sedan vilka som faktiskt har
 * en kalender vi kan läsa.
 */

export interface OsmElement {
    tags?: Record<string, string>;
}

export interface VenueCandidate {
    name: string;
    /** https://domän — proben körs mot roten. */
    base: string;
    domain: string;
    /** OSM-typen som gav högst poäng ("pub", "theatre", "restaurant" …). */
    kind: string;
    score: number;
}

/** Poäng per platstyp: scener och krogar först, restauranger och caféer sist. */
const KIND_SCORE: Record<string, number> = {
    nightclub: 4, music_venue: 4, theatre: 4, arts_centre: 4, events_venue: 4,
    pub: 3, bar: 3, biergarten: 3,
    community_centre: 2, social_centre: 2, cinema: 2, museum: 2, gallery: 2, dance: 2, conference_centre: 2,
    restaurant: 1, cafe: 1, hotel: 1, bowling_alley: 1,
};

/**
 * Domäner som aldrig är ett ställes egen kalender: sociala medier, boknings-
 * och menytjänster, kartor, länksamlingar. (Snöbollen har en egen spärrlista;
 * den här sparar kandidatbudgeten redan i skörden.)
 */
const NOT_A_VENUE_SITE = /(?:^|\.)(?:facebook|fb|instagram|tiktok|youtube|linktr|linktree|google|goo|tripadvisor|thefork|bokabord|bookatable|waiteraid|caspeco|foodora|wolt|ubereats|qopla|weiq|untappd|booking|hotels|wikipedia|wikidata|blogspot|wordpress|wixsite|business\.site|squarespace|weebly|sites\.google)\./i;

/** OSM-taggarnas webbadress → bas-URL och domän, eller null när den inte går att använda. */
export function websiteOf(tags: Record<string, string> | undefined): { base: string; domain: string } | null {
    const raw = (tags?.website ?? tags?.['contact:website'] ?? tags?.url ?? '').trim().split(/[;\s]/)[0];
    if (!raw) return null;
    let u: URL;
    try { u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { return null; }
    const domain = u.hostname.toLowerCase().replace(/^www\./, '');
    if (!domain.includes('.') || NOT_A_VENUE_SITE.test(`${domain}.`) || NOT_A_VENUE_SITE.test(domain)) return null;
    return { base: `https://${u.hostname.toLowerCase()}`, domain };
}

function kindOf(tags: Record<string, string>): string {
    const kinds = [tags.amenity, tags.tourism, tags.leisure].filter((k): k is string => !!k && k in KIND_SCORE);
    return kinds.sort((a, b) => KIND_SCORE[b] - KIND_SCORE[a])[0] ?? '';
}

/**
 * Rangordna en orts OSM-platser som kandidater.
 *   - bara namngivna platser med egen webbplats,
 *   - `live_music=yes` väger tyngst — det är precis ställena vi letar efter,
 *   - en domän som delas av `chainLimit` eller fler platser i samma ort är en
 *     kedja eller en galleria (olearys.se, espressohouse.se): sajten är inte
 *     ortens kalender och hoppas,
 *   - en kandidat per domän; högst poäng vinner, sedan kortast namn.
 */
export function rankVenueCandidates(elements: OsmElement[], chainLimit = 3): VenueCandidate[] {
    const perDomain = new Map<string, VenueCandidate[]>();
    for (const el of elements) {
        const tags = el.tags ?? {};
        const name = (tags.name ?? '').trim();
        const kind = kindOf(tags);
        const site = websiteOf(tags);
        if (!name || !kind || !site) continue;
        const score = KIND_SCORE[kind] + (tags.live_music === 'yes' ? 5 : 0);
        const list = perDomain.get(site.domain) ?? [];
        list.push({ name, base: site.base, domain: site.domain, kind, score });
        perDomain.set(site.domain, list);
    }
    const out: VenueCandidate[] = [];
    for (const list of perDomain.values()) {
        if (new Set(list.map((c) => c.name.toLowerCase())).size >= chainLimit) continue;
        out.push(list.sort((a, b) => b.score - a.score || a.name.length - b.name.length)[0]);
    }
    return out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'sv'));
}

// ─── Ställen som OSM känner till men utan webbadress ────────────────────────

export interface UnresolvedVenue { name: string; kind: string; score: number }

/** Typer värda en domängissning: scener och krogar. Restauranger och caféer bara med live_music=yes. */
const WORTH_GUESSING = new Set(['nightclub', 'music_venue', 'theatre', 'arts_centre', 'events_venue', 'pub', 'bar', 'biergarten', 'cinema']);

/**
 * Ställen utan webbadress i OSM, men av en typ som brukar ha program. I Växjö
 * 14/11 2026 var det just dessa Happymap hade och vi saknade: Chapter House,
 * Slottsstallarna, keun joo, O'Learys — alla i OSM, ingen med `website`.
 * Namnet räcker för att gissa sajten (domainGuesses) och kontrollera gissningen
 * (looksLikeVenueSite).
 */
export function unresolvedVenues(elements: OsmElement[], includeFood = false): UnresolvedVenue[] {
    const seen = new Map<string, UnresolvedVenue>();
    for (const el of elements) {
        const tags = el.tags ?? {};
        const name = (tags.name ?? '').trim();
        const kind = kindOf(tags);
        if (!name || !kind || websiteOf(tags)) continue;
        const live = tags.live_music === 'yes';
        // Restauranger och caféer (includeFood) kommer sist i listan: de flesta
        // har inget program, men det är bland dem livemusikkvällarna finns.
        const food = kind === 'restaurant' || kind === 'cafe';
        if (!WORTH_GUESSING.has(kind) && !live && !(includeFood && food)) continue;
        const key = name.toLowerCase();
        const score = KIND_SCORE[kind] + (live ? 5 : 0);
        if (!seen.has(key) || seen.get(key)!.score < score) seen.set(key, { name, kind, score });
    }
    return [...seen.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'sv'));
}

const ascii = (s: string): string => s.toLowerCase()
    .replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/[éè]/g, 'e').replace(/ü/g, 'u');

/** Ord som beskriver vad stället ÄR, inte vad det heter ("PM & Vänner Bistro" → pmvanner). */
const DESCRIPTOR_RE = /^(?:the|restaurang|restaurant|bistro|bar|pub|cafe|kafe|krog|kok|kitchen|nattklubb|club|klubb|och|and|i|pa|ab)$/;

/**
 * Domängissningar för ett ställe: "Chapter House" i Växjö → chapterhouse.se,
 * chapterhouse.com, chapterhousevaxjo.se, chapter-house.se. Högst sex, mest
 * sannolik först. Namn som blir kortare än fyra tecken ger inga gissningar —
 * "Oas" eller "Kafé" är inte en domän man kan lita på.
 */
export function domainGuesses(name: string, city: string): string[] {
    const words = ascii(name).replace(/&/g, ' ').split(/[^a-z0-9]+/).filter(Boolean);
    const core = words.filter((w) => !DESCRIPTOR_RE.test(w));
    const citySlug = ascii(city).replace(/[^a-z0-9]+/g, '');
    const out: string[] = [];
    const add = (d: string) => { if (!out.includes(d)) out.push(d); };
    for (const list of [words, core]) {
        const joined = list.join('');
        if (joined.length < 4 || joined === citySlug) continue;
        add(`${joined}.se`);
        add(`${joined}.com`);
        if (!joined.includes(citySlug)) add(`${joined}${citySlug}.se`);
        if (list.length > 1) add(`${list.join('-')}.se`);
        add(`${joined}.nu`);
    }
    return out.slice(0, 6);
}

/** Parkerade och sålda domäner — sidan finns, stället gör det inte. Matchas mot texten EFTER ascii() (å/ä→a, ö→o, gemener). */
const PARKED_RE = /doman(?:en|namnet)?\s+(?:ar\s+)?(?:till\s+salu|ledig)|domain\s+(?:is\s+)?for\s+sale|buy\s+this\s+domain|parked\s+(?:free|domain)|kop\s+(?:denna|den\s+har)\s+doman|under\s+construction|sidan\s+ar\s+under\s+uppbyggnad/;

/**
 * Är sidan ställets egen? En gissad domän räknas bara om sidan nämner ORTEN
 * (någonstans i HTML:en) och ställets NAMN i den synliga texten (alla namnets
 * egna ord, eller namnet ihopskrivet), och inte är en parkerad domän. Kravet på orten är det som skiljer Chapter House
 * i Växjö från en bokhandel med samma namn någon annanstans.
 */
export function looksLikeVenueSite(html: string, name: string, city: string): boolean {
    const text = ascii(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
    if (text.length < 300 || PARKED_RE.test(text)) return false;
    // Orten får stå var som helst i sidan: Slottsstallarnas startsida nämner
    // Växjö bara i metabeskrivningen och adressdatat, inte i den synliga texten.
    if (!ascii(html).includes(ascii(city))) return false;
    const words = ascii(name).replace(/&/g, ' ').split(/[^a-z0-9]+/).filter((w) => w && !DESCRIPTOR_RE.test(w));
    if (words.length === 0) return false;
    return words.every((w) => text.includes(w)) || text.includes(words.join(''));
}

/** "Växjö" → "vaxjo", "Upplands Väsby" → "upplands-vasby" — snöbollens region-id. */
export function regionSlug(city: string): string {
    return city.toLowerCase()
        .replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/é/g, 'e')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Snöbollens kandidatrad: "Namn|region|https://bas|Stad|ställe". Femte
 * kolumnen säger att sajten är EN lokal, så namnet blir källans defaultVenue.
 * Lodstreck i namnet skulle bryta formatet.
 */
export function candidateLine(c: VenueCandidate, city: string): string {
    return `${c.name.replace(/\|/g, '/')}|${regionSlug(city)}|${c.base}|${city}|ställe`;
}
