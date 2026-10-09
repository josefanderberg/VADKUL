/**
 * repair-tickster-office-address.ts — läk Tickster-event som geokodades på
 * Tickster AB:s kontorsadress (Magasinsgatan 8) i stället för sitt venue.
 *
 * Orsak (2/10, Växjö-rapporten): Tickster-sidor UTAN kartlänk fick sidfotens
 * kontorsadress som adress-fallback; runnern geokodade "Magasinsgatan 8,
 * <stad>" FÖRST och nöjde sig med första träffen. Utfall bland 1 445
 * kommande event: 550 låg på en riktig Magasinsgatan i fel del av stan
 * ('gata'), 635 på stadscentroiden, resten utan märkning — och alla visade
 * "Magasinsgatan 8" som eventets adress. Motorn och runnern är fixade;
 * skip-känt gör att nattkörningen aldrig rör de lagrade eventen igen.
 *
 * Per event: kandidater = byggnad + ort, venue + ort ("Saga - Bio 3:an" →
 * byggnaden först), samma ordning som runnern. Läkt eventet får venuets
 * punkt; utan venue-träff hamnar det ärligt på stadscentroiden. Adressfältet
 * töms alltid (det var aldrig eventets).
 *
 *   npm run repair-tickster-office                 # torrkörning, bara registret
 *   npm run repair-tickster-office -- --apply      # skriver, bara registret (Nominatim-fritt)
 *   npm run repair-tickster-office -- --online --apply
 *        # + fulla kedjan (Nominatim) — vägrar köra medan nattkedjan kör
 *
 * Skriver SQLite + Firestore (stamped, punkt-updates per firestoreId) —
 * ALLA ändrade fält går till Firestore, annars återställer nästa
 * inkrementella sync SQLite-raden.
 */

import { execSync } from 'child_process';
import { db } from '../config/firebase';
import { stamped } from '../utils/firestoreStamp';
import { sqlite, setEventCoords, lookupVenueSmart } from '../utils/sqliteHelper';
import { geocodeVenueSweden, geocodeCityCentroid, deGenitiveFirstWord, distanceKm, type GeoHit } from '../utils/venueCoordinates';
import { firstPreciseHit } from '../utils/geocodeChain';
import { matchVenueFix } from '../data/venueFixes';
import { TICKSTER_OFFICE as OFFICE, cityFromOfficeQuery, venueQueries } from '../utils/ticksterOffice';

const APPLY = process.argv.includes('--apply');
const ONLINE = process.argv.includes('--online');
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : Infinity;


interface Row {
    url: string; firestoreId: string | null; title: string | null;
    locationName: string | null; extractedAddress: string | null; geocodedQuery: string | null;
    lat: number | null; lng: number | null; geoPrecision: string | null;
}

/** Registret (known_venues + venueFixes) utan nätverk — steg 0 i kedjan. */
function registryHit(q: string, city: string): GeoHit | null {
    const fix = matchVenueFix(q) ?? matchVenueFix(q.split(',')[0]);
    if (fix) return [fix.lat, fix.lng, 'poi'];
    const head = q.split(',')[0].trim();
    const deGen = deGenitiveFirstWord(head);
    const kv = lookupVenueSmart(q, city) ?? lookupVenueSmart(head, city) ?? (deGen ? lookupVenueSmart(deGen, city) : null);
    return kv ? [kv[0], kv[1], 'poi'] : null;
}

function nightChainRunning(): boolean {
    try {
        // Egen process-argv innehåller inte strängen → ingen självträff.
        return execSync('pgrep -f "scripts/run-daily.sh" || true').toString().trim().length > 0;
    } catch { return false; }
}

async function main(): Promise<void> {
    if (ONLINE && nightChainRunning() && !process.argv.includes('--force')) {
        console.error('❌ Nattkedjan kör — två Nominatim-konsumenter samtidigt ger 429 (incidenten 2/7). Kör utan --online, eller vänta.');
        process.exit(2);
    }
    console.log(`${APPLY ? '🔧 APPLY' : '🔍 DRY-RUN'} · ${ONLINE ? 'online (fulla kedjan)' : 'offline (bara registret)'}`);

    const rows = sqlite.prepare(`
        SELECT url, firestoreId, title, locationName, extractedAddress, geocodedQuery, lat, lng, geoPrecision
        FROM link_events
        WHERE (hidden IS NULL OR hidden = 0) AND datetime(time) >= datetime('now')
          AND url LIKE '%tickster.com%'
          AND (geocodedQuery LIKE 'Magasinsgatan 8,%' OR extractedAddress LIKE 'Magasinsgatan 8%')
    `).all() as Row[];
    console.log(`${rows.length} kommande Tickster-event med kontorsadressen`);

    const clearAddrUpd = sqlite.prepare(`UPDATE link_events SET extractedAddress = '' WHERE url = ?`);
    const geoCache = new Map<string, GeoHit | null>();
    const fsUpdates: { id: string; data: Record<string, unknown> }[] = [];
    let moved = 0, toCentroid = 0, addrOnly = 0, pending = 0, done = 0;

    for (const r of rows) {
        if (done >= LIMIT) break;
        done++;
        const poisonedQuery = OFFICE.test(r.geocodedQuery ?? '');
        const city = cityFromOfficeQuery(r.geocodedQuery);
        const fsData: Record<string, unknown> = {};
        if (OFFICE.test(r.extractedAddress ?? '')) fsData.extractedAddress = '';

        if (poisonedQuery && city) {
            const qs = venueQueries(r.locationName, city);
            const best = await firstPreciseHit(qs, async (q) => {
                const key = `${q}|${city}|${ONLINE}`;
                if (!geoCache.has(key)) {
                    geoCache.set(key, registryHit(q, city) ?? (ONLINE ? await geocodeVenueSweden(q, { nearCity: city }) : null));
                }
                return geoCache.get(key);
            });
            let target: { lat: number; lng: number; query: string; precision: string } | null = null;
            if (best && best.hit[2] !== 'stad-centroid') {
                target = { lat: best.hit[0], lng: best.hit[1], query: best.query, precision: best.hit[2] ?? 'poi' };
            } else if (ONLINE && r.geoPrecision !== 'stad-centroid') {
                // Ingen venue-träff: 'gata'/'poi' på en främmande Magasinsgatan
                // är värre än ärlig stadscentroid.
                const c = await geocodeCityCentroid(city);
                if (c) target = { lat: c[0], lng: c[1], query: `stad: ${city}`, precision: 'stad-centroid' };
            }

            if (target) {
                const dKm = distanceKm(r.lat ?? 0, r.lng ?? 0, target.lat, target.lng);
                if (target.precision === 'stad-centroid') toCentroid++; else moved++;
                console.log(`  ${target.precision === 'stad-centroid' ? '🏙️' : '📍'} ${(r.title ?? '').slice(0, 38).padEnd(38)} | ${(r.locationName ?? '').slice(0, 30).padEnd(30)} → ${target.query.slice(0, 40)} (${dKm.toFixed(1)} km)`);
                if (APPLY) setEventCoords(r.url, target.lat, target.lng, target.query, target.precision);
                Object.assign(fsData, {
                    lat: target.lat, lng: target.lng, geocodedQuery: target.query,
                    geoPrecision: target.precision, isLocationVerified: true,
                });
            } else {
                pending++;
            }
        }

        if (Object.keys(fsData).length === 0) continue;
        if (!poisonedQuery) addrOnly++;
        if (APPLY && 'extractedAddress' in fsData) clearAddrUpd.run(r.url);
        if (APPLY && r.firestoreId) fsUpdates.push({ id: r.firestoreId, data: fsData });
    }

    if (APPLY && db && fsUpdates.length > 0) {
        let fsErr = 0;
        for (let i = 0; i < fsUpdates.length; i += 400) {
            const batch = db.batch();
            for (const u of fsUpdates.slice(i, i + 400)) {
                batch.update(db.collection('linkEvents').doc(u.id), stamped(u.data));
            }
            try { await batch.commit(); } catch (e: any) {
                // En raderad doc fäller hela batchen — ta dem en och en.
                for (const u of fsUpdates.slice(i, i + 400)) {
                    try { await db.collection('linkEvents').doc(u.id).update(stamped(u.data)); }
                    catch (e2: any) { if (e2?.code !== 5) { fsErr++; console.error(`  ⚠️ Firestore ${u.id}: ${e2?.message}`); } }
                }
                if (fsErr === 0) console.warn(`  (batch föll på ${e?.message} — togs en och en)`);
            }
        }
        console.log(`Firestore: ${fsUpdates.length} punkt-updates${fsErr ? `, ${fsErr} fel` : ''}`);
    }

    console.log(`\n✅ ${moved} till venuet, ${toCentroid} till ärlig stadscentroid, ${addrOnly} bara adressfältet tömt, ${pending} väntar på --online`);
    process.exit(0);
}

if (require.main === module) {
    main().catch(e => { console.error(e); process.exit(1); });
}
