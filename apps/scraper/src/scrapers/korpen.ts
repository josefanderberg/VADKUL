/**
 * Korpen — nätverks-engine över föreningarnas Zoezi-instanser.
 *
 * Upptäckt (recon 2026-06-12, allt verifierat):
 *   1. Katalogen https://www.korpen.se/foreningar/ är statisk SSR-HTML och
 *      listar ~136 föreningar som rot-slugs: <a href="/korpenfalun">Korpen Falun</a>.
 *   2. Slugen ÄR Zoezi-subdomänen: https://<slug>.zoezi.se — inga transformationer.
 *      ~102/136 svarar på API:t (resten 404 = ingen Zoezi-instans).
 *   3. Pass-API (ingen auth, CORS *):
 *      GET https://<slug>.zoezi.se/api/public/workout/get/all?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
 *      OBS: datum MÅSTE vara YYYY-MM-DD med bindestreck — fel format ger
 *      HTTP 200 med TOM lista (tyst fälla, inte ett fel).
 *
 * Fält: startTime/endTime är lokal Stockholm-väggtid utan offset
 * ("2026-06-15 17:30:00"). resources[].position är en STRÄNG "lat,lng" med
 * LATITUD FÖRST. status==="Cancelled" filtreras. Pris/bild är opålitliga i
 * detta endpoint — utelämnas. Publika sidan är /schema (verifierad 200) —
 * event-URL blir <instans>/schema#pass-<id>.
 *
 * Volym: veckoåterkommande pass → dedupeSeries (PRO-mönstret) behåller
 * första kommande tillfället per (förening, passnamn).
 */

import { RawEvent, Engine } from '../sources/types';
import { dedupeSeries } from './pro';
import { mapPool } from '../utils/mapPool';

const CATALOG_URL = 'https://www.korpen.se/foreningar/';
const CONCURRENCY = 6;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/** Rot-slugs på korpen.se som INTE är föreningar — slipp proba dem. */
const NON_ASSOCIATION_SLUGS = new Set([
    'foreningar', 'nyheter', 'om-korpen', 'om-oss', 'kontakt', 'aktiviteter',
    'in-english', 'sok', 'press', 'jobb', 'kalender', 'utbildning', 'butik',
    'integritetspolicy', 'tillganglighet', 'cookies', 'logga-in', 'english',
    'starta-forening', 'bli-medlem', 'traningskortet', 'hitta-aktivitet',
]);

export interface KorpenAssociation {
    slug: string;
    name: string;
    /** Orten från katalogkortet ("Falun") — stads-fallback för pass utan plats-resurs. */
    ort?: string;
}

/**
 * Extrahera föreningar (slug + visningsnamn) ur katalogsidans HTML.
 *
 * Markup per förening (verifierad 2026-06-12):
 *   <a href="/korpenfalun" ...><span class="double">Falun<span class="secondary ...">Korpförening Falun</span></span></a>
 * Nav-länkar har trailing slash ("/sok/", "/orter/") — föreningslänkar inte.
 * Exporterad för test.
 */
export function parseAssociations(html: string): KorpenAssociation[] {
    const out = new Map<string, KorpenAssociation>();
    // Matcha hela ankar-blocket; namn plockas ur inner-HTML (nästlade spans).
    const re = /<a[^>]+href="(?:https?:\/\/(?:www\.)?korpen\.se)?\/([a-z0-9][a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
        const slug = m[1].toLowerCase();
        if (NON_ASSOCIATION_SLUGS.has(slug)) continue;
        // Inner-HTML → textrader (taggar blir radbrytningar)
        const lines = m[2].replace(/<[^>]+>/g, '\n').split('\n')
            .map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
        const primary = lines[0] || '';     // orten ("Falun")
        const secondary = lines[1] || '';   // officiella namnet ("Korpförening Falun")
        if (!primary || /läs mer|visa fler|in english/i.test(primary)) continue;
        // Brand-namnet "Korpen <Ort>" för korpen*-slugs; fristående klubbar
        // (kalmar-pickleballklubb m.fl.) behåller sitt eget namn.
        const name = slug.startsWith('korpen')
            ? `Korpen ${primary}`
            : (secondary || primary);
        if (!out.has(slug)) out.set(slug, { slug, name, ort: primary });
    }
    return [...out.values()];
}

interface ZoeziResource {
    lastname?: string;
    resourceType?: string;
    position?: string;   // "lat,lng" — LATITUD FÖRST
    address?: string;
    city?: string;
}

interface ZoeziWorkout {
    id: number;
    workoutType?: { name?: string; subcategory?: string; description?: string | null };
    startTime?: string;   // "2026-06-15 17:30:00" lokal väggtid
    endTime?: string;
    status?: string;      // "Ok" | "Cancelled"
    extra_title?: string | null;
    description?: string | null;
    resources?: ZoeziResource[];
}

/** "55.6963695,13.2013822" → [lat, lng] eller null. */
export function parsePosition(pos: string | undefined): [number, number] | null {
    if (!pos) return null;
    const [latS, lngS] = pos.split(',');
    const lat = parseFloat(latS);
    const lng = parseFloat(lngS);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat === 0 && lng === 0) return null;
    return [lat, lng];
}

/** Lokal Stockholm-väggtid "2026-06-15 17:30:00" → Date (processen kör Europe/Stockholm). */
export function parseZoeziTime(s: string | undefined): Date | null {
    if (!s) return null;
    const d = new Date(s.replace(' ', 'T'));
    return isNaN(d.getTime()) ? null : d;
}

/** Mappa ett Zoezi-pass → RawEvent. Exporterad för test. */
export function mapWorkout(w: ZoeziWorkout, assoc: KorpenAssociation): RawEvent | null {
    if (w.status === 'Cancelled') return null;
    const startDate = parseZoeziTime(w.startTime);
    if (!startDate) return null;

    const typeName = w.workoutType?.name?.trim() || '';
    const title = (w.extra_title?.trim() || typeName);
    if (!title) return null;

    const location = (w.resources || []).find((r) => r.resourceType === 'location' && (r.lastname || r.position));
    const coords = parsePosition(location?.position);
    const venueName = location?.lastname?.trim();
    const city = location?.city?.trim();
    // Zoezi skriver ibland staden i VERSALER ("GÄVLE")
    let cityPretty = city && city === city.toUpperCase() && city.length > 2
        ? city[0] + city.slice(1).toLowerCase()
        : city;
    // Pass utan plats-resurs: falla tillbaka på föreningens ort från katalogen
    // ("Bjärred-Lund" → första ortsdelen) så eventet åtminstone hamnar i rätt stad.
    if (!cityPretty && assoc.ort) cityPretty = assoc.ort.split(/[-–\/]/)[0].trim();

    const descParts = [
        typeName && title !== typeName ? typeName : '',
        w.description?.trim() || w.workoutType?.description?.trim() || '',
        `Motionspass med ${assoc.name}. Boka/drop-in via föreningens schema.`,
    ].filter(Boolean);

    return {
        externalId: String(w.id),
        title,
        startDate,
        endDate: parseZoeziTime(w.endTime) ?? undefined,
        url: `https://${assoc.slug}.zoezi.se/schema#pass-${w.id}`,
        venueName,
        city: cityPretty,
        address: location?.address?.trim(),
        coords: coords ?? undefined,
        description: descParts.join(' — '),
        category: 'sport',
        hostName: assoc.name,
        hasSpecificTime: true,
    };
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<any | null> {
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': UA, 'Accept': 'application/json' },
            signal: signal ?? AbortSignal.timeout(25_000),
        });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

export const korpenEngine: Engine = async (config, ctx) => {
    // 1. Katalogen → föreningslista
    let catalogHtml: string | null = null;
    try {
        const res = await fetch(CATALOG_URL, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) });
        if (res.ok) catalogHtml = await res.text();
    } catch { /* hanteras nedan */ }
    if (!catalogHtml) {
        ctx.log('kunde inte hämta föreningskatalogen');
        return [];
    }

    let associations = parseAssociations(catalogHtml);
    ctx.log(`${associations.length} förenings-slugs i katalogen`);
    const maxAssociations: number | undefined = config?.maxAssociations;
    if (maxAssociations) associations = associations.slice(0, maxAssociations);

    // 2. Pass-API per förening. OBS: YYYY-MM-DD med bindestreck — annars tom lista.
    const fromDate = ctx.windowStart.toISOString().slice(0, 10);
    const toDate = ctx.windowEnd.toISOString().slice(0, 10);

    let live = 0, dead = 0, empty = 0;
    const all: RawEvent[] = [];
    await mapPool(associations, CONCURRENCY, async (assoc) => {
        const url = `https://${assoc.slug}.zoezi.se/api/public/workout/get/all?fromDate=${fromDate}&toDate=${toDate}`;
        const data = await fetchJson(url, ctx.signal);
        if (!data || !Array.isArray(data.workouts)) { dead++; return; }
        live++;
        if (data.workouts.length === 0) { empty++; return; }

        const events = (data.workouts as ZoeziWorkout[])
            .map((w) => mapWorkout(w, assoc))
            .filter((e): e is RawEvent => e !== null);
        // Veckoåterkommande pass → första kommande tillfället per (förening, namn)
        all.push(...dedupeSeries(events));
    });

    ctx.log(`${live} Zoezi-instanser live (${empty} utan schema, ${dead} utan instans) → ${all.length} pass efter serie-dedup`);
    return all;
};
