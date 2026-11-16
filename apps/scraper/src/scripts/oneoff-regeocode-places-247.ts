/**
 * oneoff-regeocode-places-247.ts — kör den rättade geokodningskedjan på SPARADE
 * kommande event (#247, platsgranskningen 15/11).
 *
 * Kedjans rättelser (ortsmittpunkt ur SCB-registret, ärlig märkning av rena
 * ortsfrågor, ortsmittpunkt stoppar inte kedjan, konsortiefilialer i egen ort,
 * salong → byggnad, registervakten) gäller bara NYA geokodningar. Runnerns
 * refresh läker mittpunktsevent framöver, men bara när källan körs i refresh-
 * läge och bara uppåt i precision. Det här skriptet tar ikapp en gång:
 *
 *   - mittpunktsevent (ort-/stad-centroid, och "Östersund, Östersund"-raderna
 *     som märktes 'poi') geokodas om ur locationName med eventets egen ort,
 *   - lokalträffar vars registerrad ligger långt från orten i sitt eget namn
 *     ("Malå bibliotek" i Norsjö) geokodas om,
 *   - bibliotekskonsortiernas event får exakt samma kandidater som skrapan
 *     ger dem nu (mapAxiellEvent),
 *   - flytt enligt placeRepair.decideMove; skrivning via refreshEventPlace
 *     (SQLite + Firestore genom stamped()).
 *
 * Städar först: cachade mittpunktssvar på hela bågminuter (kommunmitter,
 * även i dry-run — cachen är ingen eventdata) och, vid --apply, registerraden
 * "Malå bibliotek".
 *
 * Läser bara SQLite-spegeln. Nominatim anropas för frågor som inte är cachade
 * (1,1 s styck) — kör inte kl 00:10–04:30, då kör nattkedjan.
 *
 *   npx ts-node src/scripts/oneoff-regeocode-places-247.ts                 # dry-run, 60 dagar
 *   npx ts-node src/scripts/oneoff-regeocode-places-247.ts --apply
 *   npx ts-node src/scripts/oneoff-regeocode-places-247.ts --days=14 --limit=200
 *   npx ts-node src/scripts/oneoff-regeocode-places-247.ts --alla      # även kyrkan/PRO/Korpen
 */
import fs from 'fs';
import { sqlite, venueTownConflict, isPlaceName, isAmbiguousTownName, deleteKnownVenue } from '../utils/sqliteHelper';
import { postalTown } from '../utils/swedishAddress';
import { geocodeVenueSweden, geocodeCityCentroid, distanceKm, storedPrecisionOf, type GeoHit } from '../utils/venueCoordinates';
import { firstPreciseHit, precisionRank } from '../utils/geocodeChain';
import { refreshEventPlace } from '../utils/dbHelper';
import { geocodeQueriesFor } from '../sources/runner';
import { AXIELL_TENANTS, mapAxiellEvent } from '../scrapers/bibliotek';
import { deriveTownForRow, venueWithoutTown, decideMove, type TownSource } from '../utils/placeRepair';
import type { RawEvent } from '../sources/types';

const APPLY = process.argv.includes('--apply');
const arg = (name: string, def: number) => {
    const a = process.argv.find(x => x.startsWith(`--${name}=`));
    return a ? parseInt(a.split('=')[1], 10) : def;
};
const DAYS = arg('days', 60);
const LIMIT = arg('limit', Infinity);
const REPORT = process.argv.find(x => x.startsWith('--report='))?.split('=')[1];
/** Förvalets källor först: kyrkan, PRO och Korpen syns bara vid inzoomning (#240). --alla tar med dem. */
const ALL = process.argv.includes('--alla');
const OPT_IN = /svenskakyrkan\.se|pro\.se|zoezi|korpen/i;

interface Row {
    url: string; title: string; time: string; locationName: string | null; extractedAddress: string | null;
    geocodedQuery: string | null; lat: number; lng: number; geoPrecision: string | null;
}

/** Ingen plats att kartlägga ("Online", "Digitalt", "Zoom"). */
const NO_PLACE = /^(?:online|digital\w*|distans|zoom|webben|teams)\b/i;

const host = (u: string) => u.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
const OFFICE = /Magasinsgatan\s*8/i;

/** Kandidater + ort för ett sparat event, samma vägar som skrapan tar i dag. */
function rebuild(r: Row): { queries: string[]; city?: string; source: TownSource } | null {
    const loc = (r.locationName ?? '').trim();
    if (!loc || /^sverige$/i.test(loc) || NO_PLACE.test(loc)) return null;

    const tenant = AXIELL_TENANTS.find(t => r.url.startsWith(`${t.eventsUrl}#`));
    if (tenant) {
        const raw = mapAxiellEvent({
            id: r.url.split('#')[1] ?? 'x',
            event: { title: r.title, startDate: r.time, status: 'PUBLISHED', location: { value: loc } },
        }, tenant);
        if (!raw) return null;
        return { queries: geocodeQueriesFor(raw), city: raw.city, source: 'bibliotekets-ort' };
    }

    const town = deriveTownForRow(loc, r.geocodedQuery, r.extractedAddress, isPlaceName, postalTown);
    const venue = town ? venueWithoutTown(loc, town.town) : loc;
    const addr = (r.extractedAddress ?? '').trim();
    const raw: RawEvent = {
        title: r.title, url: r.url, startDate: new Date(r.time),
        venueName: town && venue.toLowerCase() === town.town.toLowerCase() ? undefined : venue,
        address: /\d/.test(addr) && !OFFICE.test(addr) ? addr : undefined,
        city: town?.town,
    };
    return { queries: geocodeQueriesFor(raw), city: town?.town, source: town?.source ?? 'sparad-fråga' };
}

/**
 * --revert=<rapport.json> --apply: återställ event som första skarpa körningen
 * (16/11) flyttade från en riktig punkt till en sämre mittpunkt. Orsaken var
 * att en sparad 'poi' med frågan "Malmö" togs för en felmärkt mittpunkt
 * (Malmö Arena), och att småorternas mittpunkt kom från Nominatims kommunmitt.
 * Rapporten saknade url, så raden hittas på titel + lokal + nuvarande punkt.
 */
async function revert(file: string): Promise<void> {
    const entries = JSON.parse(fs.readFileSync(file, 'utf-8')) as Array<{
        decision: string; title: string; loc: string | null; km: number;
        from: [number, number, string | null]; to: [number, number, string | null];
    }>;
    const bad = entries.filter(x => x.decision !== 'register-konflikt' && x.km > 1
        && (x.from[2] === 'poi' || x.from[2] === 'gata')
        && (x.to[2] === 'stad-centroid' || x.to[2] === 'ort-centroid'));
    const find = sqlite.prepare(`SELECT url, locationName, geocodedQuery FROM link_events
        WHERE locationName IS ? AND abs(lat - ?) < 1e-6 AND abs(lng - ?) < 1e-6 AND substr(title, 1, ?) = ?`);
    let restored = 0, missing = 0;
    for (const x of bad) {
        const rows = find.all(x.loc, x.to[0], x.to[1], x.title.length, x.title) as { url: string; locationName: string; geocodedQuery: string | null }[];
        if (rows.length === 0) { missing++; continue; }
        for (const row of rows) {
            if (APPLY && await refreshEventPlace(row.url, row.locationName, x.from[0], x.from[1], row.geocodedQuery ?? '', true, x.from[2])) restored++;
        }
    }
    console.log(`Återställning: ${bad.length} rapportrader, ${restored} event ${APPLY ? 'återställda' : '(dry-run)'}, ${missing} hittades inte`);
    process.exit(0);
}

async function main(): Promise<void> {
    const rev = process.argv.find(x => x.startsWith('--revert='))?.split('=')[1];
    if (rev) return revert(rev);
    console.log(`${APPLY ? '🔧 APPLY' : '🔍 DRY-RUN (inget skrivs)'} — kommande ${DAYS} dagar`);

    // Städning: kommunmitter i cachen och den förgiftade registerraden.
    const coarse = sqlite.prepare(`SELECT COUNT(*) n FROM geocode_cache WHERE ok = 1 AND precision IN ('stad-centroid', 'ort-centroid')
        AND abs(lat * 60 - round(lat * 60)) < 1e-4 AND abs(lng * 60 - round(lng * 60)) < 1e-4`).get() as { n: number };
    // Cachen är ingen eventdata — rensas även i dry-run, annars mäter dry-run gamla svar.
    console.log(`Cachade mittpunktssvar på hela bågminuter: ${coarse.n} — tas bort`);
    sqlite.prepare(`DELETE FROM geocode_cache WHERE ok = 1 AND precision IN ('stad-centroid', 'ort-centroid')
        AND abs(lat * 60 - round(lat * 60)) < 1e-4 AND abs(lng * 60 - round(lng * 60)) < 1e-4`).run();
    // Nominatim-svar märkta ort-centroid (7 decimaler, inte tätortsregistrets
    // punkter) kom ur första-ords- och suffixsökningarna utan ortsfilter:
    // "Arenan, Klippan", "Clas, Leksand" → en park (#247). Räknas om.
    const ortNominatim = `ok = 1 AND precision = 'ort-centroid'
        AND abs(lat * 1e7 - round(lat * 1e7)) < 1e-3 AND abs(lng * 1e7 - round(lng * 1e7)) < 1e-3`;
    const nOrt = (sqlite.prepare(`SELECT COUNT(*) n FROM geocode_cache WHERE ${ortNominatim}`).get() as { n: number }).n;
    sqlite.prepare(`DELETE FROM geocode_cache WHERE ${ortNominatim}`).run();
    console.log(`Cachade Nominatim-svar märkta ort-centroid: ${nOrt} — tas bort`);
    // Stadsmittpunkterna frågas om med bebyggelsefiltret (geocodeCityCentroid):
    // de gamla svaren var ofta kommunens gränsyta. --behall-stader hoppar över.
    if (!process.argv.includes('--behall-stader')) {
        const nCity = (sqlite.prepare(`SELECT COUNT(*) n FROM geocode_cache WHERE query LIKE 'city:%'`).get() as { n: number }).n;
        sqlite.prepare(`DELETE FROM geocode_cache WHERE query LIKE 'city:%'`).run();
        console.log(`Cachade stadsmittpunkter: ${nCity} — frågas om med bebyggelsefiltret`);
    }
    if (APPLY && deleteKnownVenue('Malå bibliotek')) console.log('Registerraden "Malå bibliotek" (Norsjös koordinater) borttagen');

    const rows = sqlite.prepare(`
        SELECT url, title, time, locationName, extractedAddress, geocodedQuery, lat, lng, geoPrecision
        FROM link_events
        WHERE hidden = 0 AND time >= datetime('now') AND time < datetime('now', '+${DAYS} days')
          AND lat IS NOT NULL AND lng IS NOT NULL AND NOT (lat = 0 AND lng = 0)
    `).all() as Row[];

    const work: { r: Row; precision: string | null; labelWrong: boolean; conflict: boolean }[] = [];
    for (const r of rows) {
        if (!ALL && OPT_IN.test(r.url)) continue;
        const precision = storedPrecisionOf(r);
        const head = (r.locationName ?? '').split(',')[0].trim();
        // Grovsållning utan ortskontext; den riktiga prövningen (med eventets ort) görs nedan.
        const maybeConflict = (r.geoPrecision === 'poi' || r.geoPrecision === 'gata') && !!venueTownConflict(head, r.lat, r.lng);
        if (precisionRank(precision) < 3 || maybeConflict) {
            work.push({ r, precision, labelWrong: precision !== r.geoPrecision, conflict: maybeConflict });
        }
    }
    console.log(`${rows.length} kommande event med koordinater, ${work.length} att pröva`);

    const cache = new Map<string, GeoHit | null>();
    const stats = new Map<string, number>();
    const byHost = new Map<string, Map<string, number>>();
    const report: unknown[] = [];
    const bump = (k: string, h: string) => {
        stats.set(k, (stats.get(k) ?? 0) + 1);
        const m = byHost.get(k) ?? new Map<string, number>();
        m.set(h, (m.get(h) ?? 0) + 1);
        byHost.set(k, m);
    };
    const started = Date.now();
    let done = 0, written = 0;

    for (const w of work) {
        const { r, labelWrong } = w;
        if (done >= LIMIT) break;
        done++;
        if (done % 200 === 0) console.log(`  … ${done}/${work.length} (${Math.round((Date.now() - started) / 1000)} s, ${written} skrivna)`);
        const h = host(r.url);
        const plan = rebuild(r);
        if (!plan || plan.queries.length === 0) { bump('ingen-kandidat', h); continue; }
        // Utan säker ort finns ingen ortsvakt: "Marknadsgränd 2" hamnade 529 km
        // bort och "Bergs Bygdegård" hos en namne (dry-run 16/11). Hellre orört.
        if (!plan.city) { bump('ingen-ort', h); continue; }
        if (isAmbiguousTownName(plan.city)) { bump('tvetydig-ort', h); continue; }
        const head = (r.locationName ?? '').split(',')[0].trim();
        const conflict = w.conflict && !!venueTownConflict(head, r.lat, r.lng, await geocodeCityCentroid(plan.city));
        if (w.conflict && !conflict && precisionRank(w.precision) >= 3) { bump('oförändrad', h); continue; }
        const precision = conflict ? 'stad-centroid' : w.precision;

        const best = await firstPreciseHit(plan.queries, async (q) => {
            const key = plan.city ? `${q}|near:${plan.city}` : q;
            if (!cache.has(key)) cache.set(key, await geocodeVenueSweden(q, plan.city ? { nearCity: plan.city } : undefined));
            return cache.get(key);
        });
        const decision = decideMove({
            stored: { lat: r.lat, lng: r.lng, precision },
            storedLabelWrong: labelWrong, storedConflict: conflict,
            best: best?.hit, townSource: plan.source, distanceKm,
        });
        if (!decision || !best) { bump(best ? 'oförändrad' : 'ingen-träff', h); continue; }

        const km = distanceKm(r.lat, r.lng, best.hit[0], best.hit[1]);
        // En felmärkt ortsfråga långt från ortens punkt är en namne ("Klippan"
        // finns både i Skåne och i Småland): rätta bara märkningen.
        const relabelOnly = labelWrong && km > 20 && decision !== 'register-konflikt';
        if (relabelOnly) best.hit = [r.lat, r.lng, precision as GeoHit[2]];
        bump(relabelOnly ? 'märkning-namne' : decision, h);
        report.push({
            url: r.url, decision, host: h, title: r.title.slice(0, 50), loc: r.locationName, city: plan.city, source: plan.source,
            from: [r.lat, r.lng, r.geoPrecision], to: [best.hit[0], best.hit[1], best.hit[2]], query: best.query, km: Math.round(km * 10) / 10,
        });
        if (APPLY && await refreshEventPlace(r.url, r.locationName || best.query, best.hit[0], best.hit[1], best.query, true, best.hit[2] ?? null)) {
            written++;
        }
    }

    console.log(`\n=== ${APPLY ? 'Skrivet' : 'Skulle skrivas'} ===`);
    for (const [k, n] of [...stats].sort((a, b) => b[1] - a[1])) {
        const top = [...(byHost.get(k) ?? new Map())].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([hh, c]) => `${hh} ${c}`).join(', ');
        console.log(`  ${String(n).padStart(6)}  ${k.padEnd(18)} ${top}`);
    }
    if (APPLY) console.log(`  ${written} event skrivna (SQLite + Firestore)`);
    if (REPORT) {
        fs.writeFileSync(REPORT, JSON.stringify(report, null, 1));
        console.log(`Rapport: ${REPORT}`);
    }
    process.exit(0);
}

if (require.main === module) {
    main().catch(e => { console.error('Fatal:', e); process.exit(1); });
}
