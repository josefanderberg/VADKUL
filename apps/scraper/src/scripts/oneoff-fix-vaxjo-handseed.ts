/**
 * oneoff-fix-vaxjo-handseed.ts — synka de OSM-rättade VAXJO_VENUES till
 * known_venues (ägarrapport 2/10: "domkyrkan, konserthuset och teatern står
 * inte där markören är").
 *
 * Juni-seedens 73 rader var handskrivna gissningar klumpade runt Stortorget
 * (200 m–4 km fel). Seedningen körs bara mot en TOM tabell, så rättelserna i
 * venueCoordinates.ts når inte minins databas av sig själva. Per rad:
 *   1. handseed-rad (notes IS NULL, skapad 2026-06-06) vars namn har ny punkt
 *      i VAXJO_VENUES → uppdateras (notes märks); namn som tagits bort ur
 *      tabellen (Hovshaga Arena, Quality Hotel Ekoxen i "Växjö") → raderas.
 *   2. geocode_cache-rader som bär en GAMMAL punkt → raderas (nästa uppslag
 *      går via registret).
 *   3. kommande event som står på en gammal punkt OCH heter som en av
 *      punktens namn → flyttas (SQLite + Firestore via stamped). De stora
 *      husen flyttas även av venueFixes; det här tar resten.
 *   4. Regionteatern Blekinge Kronobergs Växjöscen (Västergatan 22–24 enligt
 *      teaterns sajt) — källan skriver bara "Regionteatern" + ort, så eventen
 *      låg på stadscentroiden. OSM saknar husnumret; Nominatim ger gatu-
 *      segmentet (Hovskulle), ~100 m noggrannhet → märks 'gata'. Registret
 *      får "Regionteatern, Växjö" (stadsbunden — Karlshamnsscenen påverkas
 *      inte; bare "Regionteatern" vore stadsblint i venueFixes).
 *
 *   npx ts-node src/scripts/oneoff-fix-vaxjo-handseed.ts            # torrkörning
 *   npx ts-node src/scripts/oneoff-fix-vaxjo-handseed.ts --apply
 *
 * Läser bara SQLite; Firestore rörs enbart med punkt-updates per firestoreId.
 */

import { db } from '../config/firebase';
import { stamped } from '../utils/firestoreStamp';
import { sqlite, setEventCoords, upsertKnownVenue } from '../utils/sqliteHelper';
import { VAXJO_VENUES, distanceKm } from '../utils/venueCoordinates';

const APPLY = process.argv.includes('--apply');
const NOTE = 'osm-verifierad 2026-10-02 (handseed-rättning)';

interface KvRow { id: number; name: string; lat: number; lng: number; city: string | null }
interface EvRow { url: string; firestoreId: string | null; title: string | null; locationName: string | null; lat: number; lng: number }

const key4 = (lat: number, lng: number) => `${lat.toFixed(4)},${lng.toFixed(4)}`;

async function main(): Promise<void> {
    console.log(APPLY ? '🔧 APPLY' : '🔍 DRY-RUN (inget skrivs — kör med --apply)');

    const table = new Map<string, [number, number]>();
    for (const [name, c] of Object.entries(VAXJO_VENUES)) {
        if (name !== 'DEFAULT') table.set(name.toLowerCase(), c);
    }

    const seedRows = sqlite.prepare(`
        SELECT id, name, lat, lng, city FROM known_venues
        WHERE notes IS NULL AND created_at LIKE '2026-06-06%'
          AND (city = 'Växjö' OR city IS NULL)   -- "Stortorget" är redan omflyttad till Kalmar
    `).all() as KvRow[];

    // gammal punkt → { ny punkt, namn som pekade dit }
    const moves = new Map<string, { to: [number, number]; names: Set<string> }>();
    let updated = 0, deleted = 0;
    for (const r of seedRows) {
        const next = table.get(r.name.toLowerCase());
        if (!next) {
            console.log(`  🗑️  ${r.name} (${r.lat}, ${r.lng}) — borttagen ur VAXJO_VENUES`);
            if (APPLY) sqlite.prepare('DELETE FROM known_venues WHERE id = ?').run(r.id);
            deleted++;
            continue;
        }
        const dM = distanceKm(r.lat, r.lng, next[0], next[1]) * 1000;
        if (dM < 25) continue;
        console.log(`  📍 ${r.name.padEnd(34)} ${Math.round(dM).toString().padStart(5)} m → ${next[0]}, ${next[1]}`);
        if (APPLY) sqlite.prepare('UPDATE known_venues SET lat = ?, lng = ?, notes = ? WHERE id = ?').run(next[0], next[1], NOTE, r.id);
        updated++;
        const k = key4(r.lat, r.lng);
        if (!moves.has(k)) moves.set(k, { to: next, names: new Set() });
        moves.get(k)!.names.add(r.name.toLowerCase());
    }
    console.log(`known_venues: ${updated} rättade, ${deleted} raderade`);

    // 2. Cachen — rader som bär en gammal punkt.
    let purged = 0;
    for (const k of moves.keys()) {
        const [la, lo] = k.split(',').map(Number);
        const n = (sqlite.prepare('SELECT COUNT(*) AS n FROM geocode_cache WHERE ok = 1 AND round(lat, 4) = ? AND round(lng, 4) = ?').get(la, lo) as { n: number }).n;
        if (n > 0 && APPLY) sqlite.prepare('DELETE FROM geocode_cache WHERE ok = 1 AND round(lat, 4) = ? AND round(lng, 4) = ?').run(la, lo);
        purged += n;
    }
    console.log(`geocode_cache: ${purged} rader med gamla punkter ${APPLY ? 'rensade' : 'skulle rensas'}`);

    // 3. Kommande event på en gammal punkt med matchande namn.
    const events = sqlite.prepare(`
        SELECT url, firestoreId, title, locationName, lat, lng FROM link_events
        WHERE (hidden IS NULL OR hidden = 0) AND datetime(time) >= datetime('now')
          AND lat BETWEEN 56.80 AND 56.95 AND lng BETWEEN 14.65 AND 14.95
    `).all() as EvRow[];
    let movedEv = 0;
    for (const e of events) {
        const m = moves.get(key4(e.lat, e.lng));
        if (!m) continue;
        const loc = (e.locationName ?? '').trim().toLowerCase();
        const head = loc.split(',')[0].trim();
        if (!m.names.has(loc) && !m.names.has(head)) continue;
        console.log(`  🔧 ${(e.title ?? '').slice(0, 40).padEnd(40)} | ${e.locationName}`);
        movedEv++;
        if (!APPLY) continue;
        setEventCoords(e.url, m.to[0], m.to[1], `venue-register: ${e.locationName}`, 'poi');
        if (db && e.firestoreId) {
            try {
                await db.collection('linkEvents').doc(e.firestoreId).update(stamped({
                    lat: m.to[0], lng: m.to[1], isLocationVerified: true, geoPrecision: 'poi',
                }));
            } catch (err: any) {
                if (err?.code !== 5) console.error(`  ⚠️ Firestore ${e.url}: ${err?.message}`);
            }
        }
    }
    console.log(`✅ ${movedEv} kommande event ${APPLY ? 'flyttade' : 'skulle flyttas'}`);

    // 4. Regionteatern, Växjö — gatusegmentet Västergatan (Hovskulle, 352 31).
    const RT: [number, number] = [56.88274, 14.8045];
    if (APPLY) upsertKnownVenue('Regionteatern, Växjö', RT[0], RT[1], 'Växjö', 'Västergatan 22–24 (gatunivå, Nominatim) 2026-10-02');
    const vxoCentroid = { lat: 56.87872, lng: 14.80944 };
    const rtRows = sqlite.prepare(`
        SELECT url, firestoreId, title, locationName, lat, lng FROM link_events
        WHERE (hidden IS NULL OR hidden = 0) AND datetime(time) >= datetime('now')
          AND lower(trim(locationName)) IN ('regionteatern', 'regionteatern, växjö', 'regionteatern blekinge kronoberg',
                                            'regionteatern blekinge kronoberg, scenen, växjö', 'regionteatern blekinge kronoberg, växjö')
    `).all() as EvRow[];
    let rtMoved = 0;
    for (const e of rtRows) {
        // Bara Växjö-eventen: de som står på stadens centroid/Stortorget-punkten.
        if (distanceKm(e.lat, e.lng, vxoCentroid.lat, vxoCentroid.lng) > 0.3) continue;
        console.log(`  🎭 ${(e.title ?? '').slice(0, 40).padEnd(40)} | ${e.locationName}`);
        rtMoved++;
        if (!APPLY) continue;
        setEventCoords(e.url, RT[0], RT[1], 'Regionteatern, Västergatan 22, Växjö', 'gata');
        if (db && e.firestoreId) {
            try {
                await db.collection('linkEvents').doc(e.firestoreId).update(stamped({
                    lat: RT[0], lng: RT[1], isLocationVerified: true, geoPrecision: 'gata',
                    geocodedQuery: 'Regionteatern, Västergatan 22, Växjö',
                }));
            } catch (err: any) {
                if (err?.code !== 5) console.error(`  ⚠️ Firestore ${e.url}: ${err?.message}`);
            }
        }
    }
    console.log(`✅ Regionteatern: ${rtMoved} Växjö-event ${APPLY ? 'flyttade' : 'skulle flyttas'} till Västergatan`);
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
