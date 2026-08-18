/**
 * backfill-geocode.ts — geokoda om "null-island"-event (lat/lng ≈ 0,0).
 *
 * Bakgrund: ~6 700 framtida event ligger på (0,0) i Guineabukten för att deras
 * scrape inte hittade koordinater. De göms numera från kartan (mapUtils
 * isValidLatLng) men ligger kvar i DB:n med all sin venue-/adress-text intakt.
 * Många har en fullt geokodbar plats i locationName ("Äspö kyrka, Källstorps
 * församling") eller extractedAddress — vi har bara aldrig provat igen.
 *
 * Strategi per event (första träffen vinner, alla cachade via geocode_cache):
 *   1. extractedAddress  (om den finns och skiljer sig)
 *   2. locationName      (venue + ofta församling/stad)
 *   3. geocodedQuery     (den gamla frågan, sista chans)
 * geocodeVenueSweden() har inbyggd komma-tail- och stads-skanning, så en
 * stads-centrum-fallback är OK här: ANY giltig svensk koordinat slår (0,0),
 * och geo-refine kan senare flytta klustren till rätt POI.
 *
 * Endast träffar inom nordiska bbox (isInNordic) accepteras — annars hade en
 * felmatchning flyttat eventet utomlands.
 *
 * Nominatim-budget: 1,1 s mellan LIVE-anrop (cachen kostar inget). Använd
 * --limit för att dela upp i nätter; soonest-first så de mest akuta fixas.
 *
 * Användning:
 *   npm run backfill-geocode                 # dry-run, 200 event
 *   npm run backfill-geocode -- --apply
 *   npm run backfill-geocode -- --apply --limit=1500
 */

import { db } from '../config/firebase';
import { sqlite, setEventCoords } from '../utils/sqliteHelper';
import { stamped } from '../utils/firestoreStamp';
import { geocodeVenueSweden, isInNordic } from '../utils/venueCoordinates';

const APPLY = process.argv.includes('--apply');
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : (APPLY ? 99999 : 200);

interface Row {
    url: string;
    firestoreId: string | null;
    title: string;
    locationName: string | null;
    extractedAddress: string | null;
    geocodedQuery: string | null;
    hostName: string | null;
}

/**
 * För-generiska kandidater som geokodar till en slumpartad landspunkt i stället
 * för en plats — "Sverige" landar t.ex. i Värmland, "Online" träffar vad som
 * helst. En sådan pin är värre än ingen pin alls; hoppa över dem helt.
 */
const GENERIC_ONLY = new Set([
    'sverige', 'sweden', 'se', 'online', 'digitalt', 'digital', 'webben', 'zoom',
    'okänd plats', 'okänd', 'tba', 'plats meddelas', 'meddelas senare',
]);

/**
 * Distinkta, icke-tomma, icke-generiska geokodnings-kandidater i prioritetsordning.
 *
 * Kyrk-/PRO-svansen lagrar locationName som "<venue>, <församling>"
 * ("Äspö kyrka, Källstorps församling"). geocodeVenueSweden provar hela
 * strängen + SISTA komma-delen (församlingen, ogeokodbar) + stads-skanning
 * (församlingsorten saknas i stadslistan) → miss. Men FÖRSTA komma-delen är
 * själva platsen ("Äspö kyrka") och geokodar ofta direkt. Lägg därför till
 * varje komma-segment som egen kandidat, venue (första) först.
 */
function candidates(r: Row): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    const add = (v: string) => {
        const t = v.trim();
        if (t.length < 3) return;
        const key = t.toLowerCase();
        if (seen.has(key) || GENERIC_ONLY.has(key)) return;
        seen.add(key);
        out.push(t);
    };
    // Härled ortsnamn ur organisations-/församlingsnamn: orten är ofta inbäddad
    // ("Sigtuna församling" → Sigtuna, "PRO Skultorp" → Skultorp). Stadsskanningen
    // i geocodeVenueSweden missar dem (suffix/prefix + saknas i stadslistan).
    const ORG_SUFFIX = /\s+(församling|kyrkoförsamling|pastorat|distrikt|krets|avdelning|hembygdsförening|förening)$/i;
    const ORG_PREFIX = /^(PRO|SPF|PRO:s)\s+/i;
    const derivePlace = (seg: string) => {
        let p = seg.replace(ORG_PREFIX, '').replace(ORG_SUFFIX, '').trim();
        if (p && p !== seg) {
            add(p);
            // Genitiv: "Källstorps" → "Källstorp", "Falköpings" → "Falköping".
            if (/[a-zåäö]s$/i.test(p)) add(p.slice(0, -1));
        }
    };

    for (const raw of [r.extractedAddress, r.locationName, r.geocodedQuery]) {
        const v = (raw || '').trim();
        if (!v) continue;
        add(v);                                   // hela strängen
        const segs = v.includes(',') ? v.split(',') : [v];
        for (const seg of segs) {                 // + varje segment (venue först)
            add(seg);
            derivePlace(seg);                     // + härledd ort (sist, lägst prio)
        }
    }
    return out;
}

async function applyCoords(r: Row, lat: number, lng: number, query: string): Promise<void> {
    setEventCoords(r.url, lat, lng, query);
    if (db && r.firestoreId) {
        try {
            await db.collection('linkEvents').doc(r.firestoreId).update(stamped({ lat, lng, isLocationVerified: true }));
        } catch (e: any) {
            if (e?.code !== 5) console.error(`  ❌ Firestore fail ${r.url.slice(0, 50)}: ${e?.message}`);
        }
    }
}

async function main() {
    console.log(APPLY ? '🔧 APPLY' : '🔍 DRY-RUN', `(limit ${LIMIT})`);

    const rows = sqlite.prepare(`
        SELECT url, firestoreId, title, locationName, extractedAddress, geocodedQuery, hostName
        FROM link_events
        WHERE (ABS(lat) < 0.01 AND ABS(lng) < 0.01)
          AND time >= datetime('now')
        ORDER BY time ASC
    `).all() as Row[];

    console.log(`${rows.length} framtida null-island-event totalt.\n`);

    interface Stat { ok: number; fail: number }
    const perHost = new Map<string, Stat>();
    const bump = (host: string, key: 'ok' | 'fail') => {
        const s = perHost.get(host) || { ok: 0, fail: 0 };
        s[key]++;
        perHost.set(host, s);
    };

    let attempted = 0, fixed = 0, failed = 0, skipped = 0;
    for (const r of rows) {
        if (attempted >= LIMIT) break;
        const host = r.hostName || '(okänd)';
        const cands = candidates(r);
        if (cands.length === 0) { skipped++; continue; }

        attempted++;
        let hit: [number, number] | null = null;
        let usedQuery = '';
        for (const q of cands) {
            const res = await geocodeVenueSweden(q);
            if (res && isInNordic(res[0], res[1])) { hit = res; usedQuery = q; break; }
        }

        if (hit) {
            fixed++;
            bump(host, 'ok');
            console.log(`  📍 ${r.title.slice(0, 42).padEnd(42)} → "${usedQuery.slice(0, 40)}" [${hit[0].toFixed(4)}, ${hit[1].toFixed(4)}]`);
            if (APPLY) await applyCoords(r, hit[0], hit[1], usedQuery);
        } else {
            failed++;
            bump(host, 'fail');
        }
    }

    console.log('\n=== Per host (lyckade / misslyckade) ===');
    const sorted = [...perHost.entries()].sort((a, b) => (b[1].ok + b[1].fail) - (a[1].ok + a[1].fail));
    for (const [host, s] of sorted) {
        console.log(`  ${host.slice(0, 40).padEnd(40)}  ✓${String(s.ok).padStart(3)}  ✗${String(s.fail).padStart(3)}`);
    }

    console.log('\n=== Klart ===');
    console.log(`  🔎 Försökta:    ${attempted}`);
    console.log(`  📍 Geokodade:   ${fixed}`);
    console.log(`  ○ Misslyckade: ${failed}`);
    console.log(`  ⏭  Utan ledtråd: ${skipped}`);
    if (!APPLY) console.log('\n(dry-run — kör med --apply för att skriva)');
    process.exit(0);
}

if (require.main === module) {
    main().catch(e => { console.error('Fatal:', e); process.exit(1); });
}
