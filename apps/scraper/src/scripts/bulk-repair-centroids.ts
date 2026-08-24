/**
 * bulk-repair-centroids.ts — NAMN-FÖRST-massreparation av centroid-event.
 *
 * Ägarbeslut 24/8 (kväll): "för många hamnar centralt — googlar jag hittar
 * jag platsen direkt". Nattliga geo-refine (350/natt) läker för långsamt:
 * 15 639 framtida event låg på stadscentroider, men bara ~3 400 UNIKA
 * platsnamn. Detta skript löser varje namn EN gång och applicerar på alla
 * event som delar namnet i samma kluster — kostnaden skalar med namn, inte
 * event.
 *
 * Kandidatstege per namn (samma vakter som geo-refine: >150 m flytt, <60 km):
 *   0. known_venues (exakt / huvud / av-genitiviserat) — gratis
 *   1. gatuadress ur extractedAddress/description/locationName (3 exempelrader)
 *   2. strikt Nominatim ("namn, stad" → "namn")
 *   3. Overpass fuzzy-namnsök (Tallgården-mekanismen)
 *   4. fulla kedjan geocodeVenueSweden (nearCity) — ort-centroid-vinster
 *      ("Gemla bibliotek" lämnar åtminstone Växjö centrum för Gemla)
 *
 * Drift: designad att köras EN gång som fristående process (nohup). Pausar
 * kl 00:10–04:30 så den inte krockar med nattkedjans Nominatim-användning
 * (429-incidenten 2026-07-02). Lockfil mot dubbelkörning. Avbrott är
 * billiga: alla uppslag cachas och lärda venues hamnar i known_venues.
 *
 *   npx ts-node src/scripts/bulk-repair-centroids.ts --limit-names=15   # provsmak, dry
 *   npx ts-node src/scripts/bulk-repair-centroids.ts --commit           # hela, skriver
 */
import fs from 'fs';
import { db } from '../config/firebase';
import { stamped } from '../utils/firestoreStamp';
import {
    sqlite, setEventCoords, bumpGeoRefineAttempts, upsertKnownVenue, lookupVenueSmart,
} from '../utils/sqliteHelper';
import {
    geocodeVenueSweden, geocodeVenueSwedenStrict, geocodeStreetSweden, reverseGeocode,
    isInNordic, deGenitiveFirstWord, distanceKm,
} from '../utils/venueCoordinates';
import { resolveVenueOverpass } from '../utils/overpassVenue';
import { extractStreetAddress } from '../utils/swedishAddress';
import { extractVenueFromText, ortFromForeningsnamn } from '../utils/venueFromText';
import { cleanCityName } from './geo-refine';

const COMMIT = process.argv.includes('--commit');
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit-names='));
const LIMIT_NAMES = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : Infinity;

const LOCK_FILE = '/tmp/vadkul-bulk-repair-centroids.lock';
const MIN_MOVE_M = 150;
const MAX_JUMP_KM = 60;

const GENERIC_VENUE_NAME = /^(bibliotek(et)?|stadsbibliotek(et)?|kyrka(n)?|kapell(et)?|församlingshem(met)?|folkets hus|folkets park|hembygdsgård(en)?|bygdegård(en)?|scen(en)?|sporthall(en)?|torget|centrum|park(en)?|utomhus|ute|online|digitalt|se beskrivning(en)?|plats meddelas( senare)?|hemma|tba|tbd|sverige)$/i;

interface Row {
    url: string; firestoreId: string | null; locationName: string;
    extractedAddress: string | null; description: string | null;
    lat: number; lng: number;
}

/** Sov igenom nattkedjans fönster (00:10–04:30) — dela aldrig Nominatim. */
async function nightPause(): Promise<void> {
    const h = new Date().getHours(), m = new Date().getMinutes();
    const inWindow = (h === 0 && m >= 10) || h === 1 || h === 2 || h === 3 || (h === 4 && m < 30);
    if (!inWindow) return;
    console.log(`[${new Date().toISOString()}] nattkedjans fönster — pausar till 04:30`);
    while (true) {
        await new Promise(r => setTimeout(r, 60_000));
        const now = new Date();
        if (now.getHours() === 4 && now.getMinutes() >= 30) break;
        if (now.getHours() > 4) break;
    }
    console.log(`[${new Date().toISOString()}] återupptar`);
}

async function resolveName(
    name: string, city: string | null, rows: Row[], cLat: number, cLng: number,
): Promise<[number, number, string, string] | null> {
    const ok = (h: [number, number] | null): h is [number, number] =>
        !!h && isInNordic(h[0], h[1])
        && distanceKm(h[0], h[1], cLat, cLng) * 1000 > MIN_MOVE_M
        && distanceKm(h[0], h[1], cLat, cLng) < MAX_JUMP_KM;

    const head = name.split(',')[0].trim();
    const deGen = deGenitiveFirstWord(head);

    // 0. Registret
    const kv = lookupVenueSmart(name, city ?? undefined)
        ?? lookupVenueSmart(head, city ?? undefined)
        ?? (deGen ? lookupVenueSmart(deGen, city ?? undefined) : null);
    if (ok(kv)) return [kv[0], kv[1], `venue-register: ${head.slice(0, 50)}`, 'poi'];

    // 1. Gatuadress ur upp till tre exempelrader
    if (city) {
        const streets = new Set<string>();
        for (const r of rows.slice(0, 3)) {
            for (const src of [r.extractedAddress, r.description, r.locationName]) {
                const s = extractStreetAddress(src);
                if (s && !/Magasinsgatan\s*8\b/i.test(s)) streets.add(s);
            }
        }
        for (const s of streets) {
            const hit = await geocodeStreetSweden(s, city);
            if (ok(hit)) return [hit[0], hit[1], `${s}, ${city}`, 'gata'];
        }
    }

    // 1b. Venue ur beskrivningen ("Vi spelar i Folkets Hus …") — Canasta-
    //     fallet: platsen står i texten, orten i föreningsnamnet.
    const descVenue = rows.slice(0, 3)
        .map(r => extractVenueFromText(r.description))
        .find((v): v is string => !!v) ?? null;
    if (descVenue && city && descVenue.toLowerCase() !== name.toLowerCase()) {
        const hit = await geocodeVenueSwedenStrict(`${descVenue}, ${city}`);
        if (ok(hit)) return [hit[0], hit[1], `${descVenue}, ${city}`, 'poi'];
    }

    // 2. Strikt Nominatim
    const strictQs = city && !name.toLowerCase().includes(city.toLowerCase())
        ? [`${name}, ${city}`, name] : [name];
    for (const q of strictQs) {
        const hit = await geocodeVenueSwedenStrict(q);
        if (ok(hit)) return [hit[0], hit[1], q, 'poi'];
    }

    // 3. Overpass fuzzy
    const op = await resolveVenueOverpass(head, cLat, cLng);
    if (ok(op)) return [op[0], op[1], `overpass: ${head.slice(0, 50)}`, 'poi'];

    // 3b. Föreningsorten ("PRO Vislanda" → Vislanda): hitta byn, och leta
    //     sedan beskrivnings-venuet SNÄVT inom byn (Folkets Hus i Vislanda,
    //     inte kommunens tre andra). Utan venue: bycentroiden slår kommunens.
    const fort = ortFromForeningsnamn(head);
    if (fort) {
        const fortHit = await geocodeVenueSwedenStrict(`${fort}`);
        if (ok(fortHit)) {
            if (descVenue) {
                const op2 = await resolveVenueOverpass(descVenue, fortHit[0], fortHit[1], 4000);
                if (ok(op2)) return [op2[0], op2[1], `overpass: ${descVenue}, ${fort}`, 'poi'];
                const sv = await geocodeVenueSwedenStrict(`${descVenue}, ${fort}`);
                if (ok(sv)) return [sv[0], sv[1], `${descVenue}, ${fort}`, 'poi'];
            }
            return [fortHit[0], fortHit[1], `föreningsort: ${fort}`, 'ort-centroid'];
        }
    }

    // 4. Fulla kedjan — ort-centroid-flyttar räknas (byn slår kommunen)
    if (city) {
        const full = await geocodeVenueSweden(name, { nearCity: city });
        if (full && ok([full[0], full[1]])) {
            return [full[0], full[1], `${name} (kedjan)`, full[2] ?? 'ort-centroid'];
        }
    }
    return null;
}

async function main(): Promise<void> {
    if (fs.existsSync(LOCK_FILE)) { console.error('lockfil finns — kör redan?'); process.exit(1); }
    fs.writeFileSync(LOCK_FILE, String(process.pid));
    process.on('exit', () => { try { fs.unlinkSync(LOCK_FILE); } catch { /* ok */ } });

    console.log(`${COMMIT ? '🔧 COMMIT' : '🔍 DRY-RUN'} — namn-först-massreparation`);
    const rows = sqlite.prepare(`
        SELECT url, firestoreId, locationName, extractedAddress, description, lat, lng
        FROM link_events
        WHERE geoPrecision = 'stad-centroid' AND (hidden IS NULL OR hidden = 0)
          AND datetime(time) >= datetime('now') AND NOT (lat = 0 AND lng = 0)
    `).all() as Row[];

    // Kluster → namngrupper
    const clusters = new Map<string, { lat: number; lng: number; byName: Map<string, Row[]> }>();
    for (const r of rows) {
        const key = `${r.lat.toFixed(5)},${r.lng.toFixed(5)}`;
        if (!clusters.has(key)) clusters.set(key, { lat: r.lat, lng: r.lng, byName: new Map() });
        const name = (r.locationName || '').trim();
        if (name.length < 5 || GENERIC_VENUE_NAME.test(name)) continue;
        const nk = name.toLowerCase();
        const c = clusters.get(key)!;
        if (!c.byName.has(nk)) c.byName.set(nk, []);
        c.byName.get(nk)!.push(r);
    }
    const totalNames = [...clusters.values()].reduce((s, c) => s + c.byName.size, 0);
    console.log(`${rows.length} event, ${clusters.size} kluster, ${totalNames} namngrupper att lösa`);

    let namesTried = 0, namesHit = 0, eventsMoved = 0, learned = 0;
    const t0 = Date.now();

    for (const [, c] of clusters) {
        if (namesTried >= LIMIT_NAMES) break;
        let city: string | null | undefined;
        for (const [, nameRows] of c.byName) {
            if (namesTried >= LIMIT_NAMES) break;
            await nightPause();
            if (city === undefined) city = cleanCityName((await reverseGeocode(c.lat, c.lng))?.city ?? null);
            const name = (nameRows[0].locationName || '').trim();
            if (city && name.toLowerCase() === city.toLowerCase()) continue;

            namesTried++;
            const hit = await resolveName(name, city, nameRows, c.lat, c.lng);
            if (!hit) {
                if (COMMIT) for (const r of nameRows) bumpGeoRefineAttempts(r.url);
                continue;
            }
            namesHit++;
            const [lat, lng, query, precision] = hit;
            const dKm = distanceKm(lat, lng, c.lat, c.lng).toFixed(1);
            console.log(`  📍 ${name.slice(0, 45).padEnd(45)} → ${query.slice(0, 45)} (${nameRows.length} event, ${dKm} km, ${precision})`);
            if (!COMMIT) continue;

            for (const r of nameRows) setEventCoords(r.url, lat, lng, query, precision);
            eventsMoved += nameRows.length;
            if (db) {
                const withId = nameRows.filter(r => r.firestoreId);
                for (let i = 0; i < withId.length; i += 400) {
                    const batch = db.batch();
                    for (const r of withId.slice(i, i + 400)) {
                        batch.update(db.collection('linkEvents').doc(r.firestoreId!),
                            stamped({ lat, lng, isLocationVerified: true, geoPrecision: precision }));
                    }
                    try { await batch.commit(); } catch (e: any) { console.error(`  ⚠️ Firestore-batch: ${e?.message}`); }
                }
            }
            if (city && precision === 'poi' && name.length >= 5 && !GENERIC_VENUE_NAME.test(name)) {
                upsertKnownVenue(name, lat, lng, city, `bulk-repair ${new Date().toISOString().slice(0, 10)}`);
                learned++;
            }
        }
    }

    const mins = ((Date.now() - t0) / 60000).toFixed(1);
    console.log(`\n=== Klart (${mins} min) ===`);
    console.log(`  namn provade: ${namesTried}  träffade: ${namesHit}`);
    console.log(`  event flyttade: ${eventsMoved}  lärda venues: ${learned}`);
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
