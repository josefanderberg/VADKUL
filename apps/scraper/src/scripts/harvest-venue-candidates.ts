/**
 * harvest-venue-candidates.ts — ortens krogar, scener och caféer ur OSM →
 * kandidatfil för webb-snöbollen.
 *
 * Snöbollens egen skörd följer länkar i event vi redan har. De unika ställena
 * (krogen med livemusik, gastropuben, caféet med quiz) finns inte där — och
 * det är dem Happymap har och vi saknar (jämförelsen 14/11 2026: i Växjö
 * Kafé de luxe, Slottsstallarna, PM & Vänner, Chapter House, keun joo).
 * OSM vet vilka ställen som finns i en ort och vad deras webbplats heter.
 *
 * Få ställen har `website` i OSM (Växjö: 22 av 106, mest pizzerior), så för
 * scener och krogar utan adress gissas domänen ur namnet ("Chapter House" →
 * chapterhouse.se) och godtas bara om sidan nämner både orten och stället.
 *
 * Det här skriptet SKÖRDAR bara. Vilka som har en läsbar kalender avgör
 * snöbollens vanliga kedja (proben, rimlighetskontrollen, tsc-vakten):
 *
 *   npm run venue-candidates -- --city=Växjö
 *   npm run web-snowball -- --candidates=venue-candidates.txt --max=80 --dry
 *
 *   --city=A,B     orter (namn som i SCB:s tätortsregister)
 *   --top=20       i stället: landets N största tätorter
 *   --radius=5     km runt ortens mittpunkt (default 5)
 *   --limit=80     högst så många kandidater per ort (default 80)
 *   --out=fil      default venue-candidates.txt i scraper-roten
 *   --elements=fil ett sparat Overpass-svar (JSON) i stället för en ny fråga
 *   --guess-limit=80  högst så många ställen per ort får sin domän gissad
 *
 * En Overpass-fråga per ort, med paus emellan. Skriver ingenting till
 * databasen och rör inte registret.
 */

import fs from 'fs';
import path from 'path';
import { sqlite } from '../utils/sqliteHelper';
import {
    rankVenueCandidates, candidateLine, unresolvedVenues, domainGuesses, looksLikeVenueSite,
    type OsmElement, type VenueCandidate, type UnresolvedVenue,
} from '../utils/venueCandidates';

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const RADIUS_KM = parseFloat(flag('radius') ?? '5');
const LIMIT = parseInt(flag('limit') ?? '80', 10);
const TOP = flag('top') ? parseInt(flag('top')!, 10) : 0;
const SAVED_ELEMENTS = flag('elements');
/** Högst så många ställen per ort får sin domän gissad (scener och krogar först). */
const GUESS_LIMIT = parseInt(flag('guess-limit') ?? '80', 10);
const OUT = path.resolve(flag('out') ?? path.resolve(__dirname, '../../venue-candidates.txt'));

/** Två publika instanser — huvudinstansen 406:ar när slottarna är fulla. */
const OVERPASS_ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const PAUSE_MS = 6_000;

interface City { name: string; lat: number; lng: number }

function cities(): City[] {
    if (TOP > 0) {
        return sqlite.prepare('SELECT name, lat, lng FROM tatorter ORDER BY bef DESC LIMIT ?').all(TOP) as City[];
    }
    const names = (flag('city') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (names.length === 0) throw new Error('ange --city=Ort[,Ort] eller --top=N');
    const byName = sqlite.prepare('SELECT name, lat, lng FROM tatorter WHERE name = ? COLLATE NOCASE ORDER BY bef DESC LIMIT 1');
    return names.map((n) => {
        const row = byName.get(n) as City | undefined;
        if (!row) throw new Error(`okänd tätort: ${n}`);
        return row;
    });
}

async function overpass(city: City): Promise<OsmElement[]> {
    const around = `(around:${Math.round(RADIUS_KM * 1000)},${city.lat},${city.lng})`;
    const query = `[out:json][timeout:60];
(
  nwr${around}["amenity"~"^(pub|bar|biergarten|restaurant|cafe|nightclub|theatre|arts_centre|community_centre|social_centre|cinema|music_venue|events_venue|conference_centre)$"]["name"];
  nwr${around}["tourism"~"^(hotel|museum|gallery)$"]["name"];
  nwr${around}["leisure"~"^(dance|bowling_alley)$"]["name"];
);
out tags;`;
    for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 20_000));
        const endpoint = OVERPASS_ENDPOINTS[attempt % OVERPASS_ENDPOINTS.length];
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'VadkulScraperBot/1.0 (admin@vadkul.se)' },
                body: 'data=' + encodeURIComponent(query),
                signal: AbortSignal.timeout(90_000),
            });
            if (res.ok) return ((await res.json()) as { elements?: OsmElement[] }).elements ?? [];
            console.warn(`  … ${city.name}: ${res.status} från ${new URL(endpoint).host} (försök ${attempt + 1})`);
        } catch (e) {
            console.warn(`  … ${city.name}: ${(e as Error).message} mot ${new URL(endpoint).host} (försök ${attempt + 1})`);
        }
    }
    console.warn(`⚠️ Overpass gav upp för ${city.name}`);
    return [];
}

/**
 * Hitta sajten för ett ställe OSM känner till utan webbadress: prova
 * domängissningarna i tur och ordning, och godta den första där sidan nämner
 * både orten och ställets namn. Högst sex korta hämtningar per ställe.
 */
async function resolveSite(v: UnresolvedVenue, city: string): Promise<VenueCandidate | null> {
    for (const guess of domainGuesses(v.name, city)) {
        try {
            const res = await fetch(`https://${guess}/`, {
                headers: { 'User-Agent': 'VadKul/1.0 (+https://vadkul.se)', Accept: 'text/html' },
                signal: AbortSignal.timeout(8_000),
                redirect: 'follow',
            });
            if (!res.ok || !/html/i.test(res.headers.get('content-type') ?? '')) continue;
            const html = await res.text();
            if (!looksLikeVenueSite(html, v.name, city)) continue;
            // Följ omdirigeringen: slottsstallarna.se svarar från slottsstallarna.com.
            const host = new URL(res.url).hostname.toLowerCase();
            return { name: v.name, base: `https://${host}`, domain: host.replace(/^www\./, ''), kind: v.kind, score: v.score };
        } catch { /* domänen finns inte eller svarar inte — nästa gissning */ }
    }
    return null;
}

async function main() {
    const list = cities();
    const lines: string[] = [`# Skördat ur OSM ${new Date().toISOString().slice(0, 10)} — ${RADIUS_KM} km runt ${list.map((c) => c.name).join(', ')}`];
    const seen = new Set<string>();
    for (const [i, city] of list.entries()) {
        if (i > 0) await new Promise((r) => setTimeout(r, PAUSE_MS));
        // --elements=fil: ett sparat Overpass-svar i stället för en ny fråga
        // (de publika instanserna svarar 502 i perioder), bara med EN ort.
        const elements = SAVED_ELEMENTS && list.length === 1
            ? ((JSON.parse(fs.readFileSync(SAVED_ELEMENTS, 'utf8')) as { elements?: OsmElement[] }).elements ?? [])
            : await overpass(city);
        if (elements.length === 0) { console.log(`${city.name}: inget svar från Overpass — hoppas`); continue; }
        const tagged = rankVenueCandidates(elements);
        // Scener och krogar som OSM saknar webbadress för: gissa och kontrollera.
        const missing = unresolvedVenues(elements, true).slice(0, GUESS_LIMIT);
        const guessed: VenueCandidate[] = [];
        for (const v of missing) {
            const hit = await resolveSite(v, city.name);
            if (hit) guessed.push(hit);
        }
        const ranked = [...guessed, ...tagged]
            .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'sv'))
            .filter((c, idx, all) => all.findIndex((x) => x.domain === c.domain) === idx)
            .filter((c) => !seen.has(c.domain))
            .slice(0, LIMIT);
        ranked.forEach((c) => seen.add(c.domain));
        const kinds = new Map<string, number>();
        for (const c of ranked) kinds.set(c.kind, (kinds.get(c.kind) ?? 0) + 1);
        console.log(`${city.name}: ${elements.length} platser i OSM → ${tagged.length} med webbadress i OSM, `
            + `${guessed.length} av ${missing.length} utan adress hittade på gissad domän (${guessed.map((g) => g.domain).join(', ') || '–'})`);
        console.log(`  ${ranked.length} kandidater: ${[...kinds.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ')}`);
        const notFound = missing.filter((v) => !guessed.some((g) => g.name === v.name)).map((v) => v.name);
        if (notFound.length) console.log(`  utan sajt: ${notFound.join(', ')}`);
        lines.push(`# ${city.name}`, ...ranked.map((c) => candidateLine(c, city.name)));
    }
    // En misslyckad skörd får inte skriva över en tidigare kandidatfil.
    if (seen.size === 0) { console.error('Inga kandidater — ingen fil skriven.'); process.exit(1); }
    fs.writeFileSync(OUT, lines.join('\n') + '\n', 'utf8');
    console.log(`\n${seen.size} kandidater skrivna till ${OUT}`);
    console.log(`Nästa steg: npm run web-snowball -- --candidates=${path.relative(process.cwd(), OUT)} --max=${seen.size} --dry`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
