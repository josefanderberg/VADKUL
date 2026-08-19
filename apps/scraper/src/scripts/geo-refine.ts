/**
 * geo-refine.ts — förfina koordinater för event som klumpats på samma punkt.
 *
 * Symptom: geokodningen föll tillbaka på stads-centrum ("Försök 2/3" i
 * geocodeVenueSweden) → tiotals event på EXAKT samma koordinat trots olika
 * platser ("Cube of Art", "Cirkuscaféet", … alla på Linköpings mittpunkt).
 * Oftast finns en adress vi inte fångat: i extractedAddress, i beskrivningen
 * ("Plats: Storgatan 12"), eller i locationName ("Djulö IP, Hilding
 * Hjelmbergs väg, Katrineholm").
 *
 * Per natt:
 *   1. Hitta kluster: ≥5 framtida synliga event på identisk koordinat med
 *      ≥3 olika locationName (stads-fallback-signaturen) + alla o-geokodade.
 *   2. Per event: prova kandidater i ordning —
 *        a) svensk gatuadress ur extractedAddress / description / locationName
 *           (strukturerad Nominatim street+city-sökning, ingen fallback)
 *        b) locationName + stad (geocodeVenueSweden, cachad)
 *   3. Acceptera bara träffar som faktiskt FLYTTAR eventet (>150 m från
 *      klustret) men stannar i närområdet (<60 km) — annars är det samma
 *      stads-fallback igen eller en felmatchning i annan stad.
 *
 * Nominatim-budget: --limit (default 120) event-uppslag per körning, äldsta
 * event först. geocode_cache gör att samma venue bara kostar en gång.
 *
 * Användning:
 *   npm run geo-refine                  # dry-run
 *   npm run geo-refine -- --apply       # skriver SQLite + Firestore
 *   npm run geo-refine -- --limit=30
 */

import { db } from '../config/firebase';
import { sqlite, setEventCoords, bumpGeoRefineAttempts, upsertKnownVenue } from '../utils/sqliteHelper';
import { stamped } from '../utils/firestoreStamp';
import {
    geocodeVenueSwedenStrict, geocodeStreetSweden, reverseGeocode, isInNordic,
} from '../utils/venueCoordinates';

const APPLY = process.argv.includes('--apply');
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : 250;

/** Ge upp per event efter så här många resultatlösa nätter (geoRefineAttempts). */
const MAX_ATTEMPTS = 3;

/**
 * Platsnamn som ALDRIG ska in i known_venues: generiska ("Biblioteket" finns i
 * varje stad), platshållare ("plats meddelas") och rena stadsnamn (kollas
 * separat). Memo-återanvändning inom ett kluster är ändå ok — där delar
 * raderna stad — men tabellen är global och får inte förgiftas.
 */
const GENERIC_VENUE_NAME = /^(bibliotek(et)?|stadsbibliotek(et)?|kyrka(n)?|kapell(et)?|församlingshem(met)?|folkets hus|folkets park|hembygdsgård(en)?|bygdegård(en)?|scen(en)?|stora scenen|sporthall(en)?|ishall(en)?|simhall(en)?|torget|stora torget|centrum|park(en)?|stadspark(en)?|utomhus|ute|online|digitalt|zoom|teams|se beskrivning(en)?|plats meddelas( senare)?|vi återkommer.*|meddelas senare|hemma|tba|tbd)$/i;

/** Minsta klusterstorlek + minsta antal OLIKA platsnamn för fallback-signatur. */
const CLUSTER_MIN_EVENTS = 5;
const CLUSTER_MIN_DISTINCT_NAMES = 3;
/** Träffen måste flytta eventet — annars var det samma stads-fallback. */
const MIN_IMPROVEMENT_M = 150;
/** … men inte till en annan stad. */
const MAX_JUMP_KM = 60;

interface Row {
    url: string;
    firestoreId: string | null;
    title: string;
    locationName: string;
    geoRefineAttempts: number | null;
    extractedAddress: string | null;
    description: string | null;
    hostName: string | null;
    lat: number;
    lng: number;
}

/**
 * Kända biljett-/arrangörs-KONTORSADRESSER som läcker in som event-plats. Att
 * "förbättra" ett event till en sådan placerar det på fel ställe (Ticksters HQ
 * i stället för den riktiga scenen). Hoppa över dem som adress-kandidat.
 */
const KNOWN_OFFICE_ADDRESSES: RegExp[] = [
    /Magasinsgatan\s*8\b/i,   // Tickster AB, Göteborg
];

/**
 * hostName som geokodnings-kandidat? Bara när det troligen är en PLATS
 * (museum/teater/kyrka/scen), inte en organisation (ABF/Facebook/Korpen).
 * Många källor lägger venuet i hostName och brus i locationName
 * ("Göteborgs Stadsmuseum" som host, "Samling i foajén" som plats).
 */
const HOST_IS_VENUE = /(museum|museet|teater|konserthus|konsthall|bibliotek|kyrka|kapell|slott|scen|arena|hall|gård|saluhall|stadshus|folkets hus|bygdegård)/i;
const HOST_IS_ORG = /(facebook|eventbrite|kommun|förening|korpen|abf|studieförbund|riksteatern|rotary|röda korset|naturskydd|hembygd|pro\b|sensus|bilda|medborgarskolan)/i;

// ─── Svensk gatuadress-extraktion ────────────────────────────────────────────
// Bor i utils/swedishAddress (delas med sitemap-motorn); re-exporteras här
// för geo-refine.test.ts.
import { extractStreetAddress } from '../utils/swedishAddress';
export { extractStreetAddress };

// ─── Geometri ────────────────────────────────────────────────────────────────

function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6_371_000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

// ─── Huvudflöde ──────────────────────────────────────────────────────────────

interface Cluster {
    key: string;
    lat: number;
    lng: number;
    rows: Row[];
    distinctNames: number;
}

function findClusters(rows: Row[]): Cluster[] {
    const byCoord = new Map<string, Row[]>();
    for (const r of rows) {
        if (r.lat === 0 && r.lng === 0) continue;
        const key = `${r.lat.toFixed(5)},${r.lng.toFixed(5)}`;
        if (!byCoord.has(key)) byCoord.set(key, []);
        byCoord.get(key)!.push(r);
    }
    const clusters: Cluster[] = [];
    for (const [key, rs] of byCoord) {
        const names = new Set(rs.map(r => (r.locationName || '').toLowerCase().trim()));
        if (rs.length >= CLUSTER_MIN_EVENTS && names.size >= CLUSTER_MIN_DISTINCT_NAMES) {
            clusters.push({ key, lat: rs[0].lat, lng: rs[0].lng, rows: rs, distinctNames: names.size });
        }
    }
    // Största klustren först — mest synlig effekt per Nominatim-anrop.
    clusters.sort((a, b) => b.rows.length - a.rows.length);
    return clusters;
}

/**
 * Normalisera kommun-/stadsnamn från reverse-geocoding till orten Nominatim
 * känner igen som plats. Nominatim svarar ofta med den administrativa
 * enheten ("Göteborgs Stad", "Stockholms kommun", "Malmö stad") — geokodning
 * av "Bio Roy, Göteborgs Stad" missar, "Bio Roy, Göteborg" träffar.
 *   "Göteborgs Stad" → "Göteborg",  "Stockholms kommun" → "Stockholm",
 *   "Malmö stad" → "Malmö",  "Region Gotland" → "Gotland"
 */
export function cleanCityName(raw: string | null): string | null {
    if (!raw) return null;
    // Suffix-regexens `s?` slukar genitiv-s:et som bär suffixet
    // ("Göteborgs Stad" → "Göteborg", "Stockholms kommun" → "Stockholm")
    // UTAN att röra orter som genuint slutar på s (Borås, Höganäs, Degerfors).
    const c = raw.trim()
        .replace(/^region\s+/i, '')
        .replace(/s?\s+(kommun|stad|municipality|city)$/i, '');
    return c.trim() || null;
}

/** Staden i ett kluster — reverse-geokodas EN gång per kluster (cachas i-körning). */
const clusterCityCache = new Map<string, string | null>();
async function cityOfCluster(c: Cluster): Promise<string | null> {
    if (!clusterCityCache.has(c.key)) {
        const rev = await reverseGeocode(c.lat, c.lng);
        clusterCityCache.set(c.key, cleanCityName(rev?.city ?? null));
    }
    return clusterCityCache.get(c.key) ?? null;
}

/**
 * Hitta bättre koordinater för ett event i ett kluster.
 * Returnerar [lat, lng, queryBeskrivning] eller null.
 */
async function refineEvent(r: Row, cluster: Cluster, city: string | null): Promise<[number, number, string] | null> {
    const loc = (r.locationName || '').trim();
    const locIsJustCity = !!city && loc.toLowerCase() === city.toLowerCase();

    // Kandidat 1–3: gatuadress ur extractedAddress → description → locationName.
    // Hoppa över kända kontorsadresser (Tickster HQ m.fl.) — de leder fel.
    const streets = [
        extractStreetAddress(r.extractedAddress),
        extractStreetAddress(r.description),
        extractStreetAddress(loc),
    ].filter((s): s is string => !!s)
     .filter((s) => !KNOWN_OFFICE_ADDRESSES.some((re) => re.test(s)));

    for (const street of [...new Set(streets)]) {
        if (!city) break;
        const hit = await geocodeStreetSweden(street, city);
        if (hit && acceptable(hit, cluster)) return [hit[0], hit[1], `${street}, ${city}`];
    }

    // Kandidat 4: venue-namn via STRIKT geokodning (ingen stads-fallback — den
    // hade bara gett ett nytt stadscentrum). Prova "venue, stad" först, sedan
    // "venue" ensamt (vissa POI:er matchar bara utan stads-suffix). Inte när
    // platsnamnet ÄR staden; då finns inget mer precist att fråga efter.
    // Distansvakten (acceptable: >150 m, <60 km från klustret) skyddar mot att
    // venue-ensamt-frågan landar i fel stad.
    if (loc && !locIsJustCity) {
        const variants = city && !loc.toLowerCase().includes(city.toLowerCase())
            ? [`${loc}, ${city}`, loc]
            : [loc];
        for (const q of [...new Set(variants)]) {
            const hit = await geocodeVenueSwedenStrict(q);
            if (hit && acceptable(hit, cluster)) return [hit[0], hit[1], q];
        }
    }

    // Kandidat 5: hostName som plats — bara när det ser ut som en venue
    // (museum/teater/kyrka …) och inte en organisation. Fångar fall där den
    // riktiga platsen ligger i värd-fältet och locationName är instruktionsbrus.
    const host = (r.hostName || '').trim();
    if (host && HOST_IS_VENUE.test(host) && !HOST_IS_ORG.test(host)) {
        const variants = city && !host.toLowerCase().includes(city.toLowerCase())
            ? [`${host}, ${city}`, host]
            : [host];
        for (const q of [...new Set(variants)]) {
            const hit = await geocodeVenueSwedenStrict(q);
            if (hit && acceptable(hit, cluster)) return [hit[0], hit[1], `värd: ${q}`];
        }
    }

    return null;
}

function acceptable(hit: [number, number], cluster: Cluster): boolean {
    if (!isInNordic(hit[0], hit[1])) return false;
    const d = distanceM(hit[0], hit[1], cluster.lat, cluster.lng);
    return d > MIN_IMPROVEMENT_M && d < MAX_JUMP_KM * 1000;
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
    console.log(APPLY ? '🔧 APPLY' : '🔍 DRY-RUN');
    const rows = sqlite.prepare(`
        SELECT url, firestoreId, title, locationName, geoRefineAttempts, extractedAddress, description, hostName, lat, lng
        FROM link_events
        WHERE hidden = 0 AND time >= datetime('now')
    `).all() as Row[];

    const clusters = findClusters(rows);
    const clusterEvents = clusters.reduce((s, c) => s + c.rows.length, 0);
    console.log(`${clusters.length} fallback-kluster (${clusterEvents} event), topp 5:`);
    for (const c of clusters.slice(0, 5)) {
        console.log(`  ${c.key}  ${String(c.rows.length).padStart(3)} event, ${c.distinctNames} platsnamn  (ex: ${c.rows[0].locationName.slice(0, 40)})`);
    }

    let attempted = 0, refined = 0, noBetter = 0, reused = 0, gaveUp = 0, learnedVenues = 0;
    outer: for (const c of clusters) {
        const city = await cityOfCluster(c);
        // Memo per (kluster, platsnamn): "Årby bibliotek" × 15 event = ETT
        // Nominatim-uppslag; träffen (eller misslyckandet) återanvänds gratis
        // för resten av namnets rader utan att konsumera budgeten.
        const nameMemo = new Map<string, [number, number, string] | null>();
        for (const r of c.rows) {
            if (attempted >= LIMIT) break outer;
            // Ge upp efter MAX_ATTEMPTS resultatlösa nätter — annars äter samma
            // hopplösa rader hela budgeten varje natt och kön rör sig aldrig.
            if ((r.geoRefineAttempts ?? 0) >= MAX_ATTEMPTS) { gaveUp++; continue; }
            // Rena stadsnamns-rader utan adress i text har inget att förfina på.
            const hasAnyLead = r.extractedAddress || r.description || (r.locationName && r.locationName.toLowerCase() !== (city ?? '').toLowerCase());
            if (!hasAnyLead) continue;

            const nameKey = (r.locationName || '').trim().toLowerCase();
            const memoKey = nameKey.length >= 4 ? nameKey : null;

            let hit: [number, number, string] | null;
            if (memoKey && nameMemo.has(memoKey)) {
                hit = nameMemo.get(memoKey)!;
                if (hit) reused++;
            } else {
                attempted++;
                hit = await refineEvent(r, c, city);
                if (memoKey) nameMemo.set(memoKey, hit);
            }

            if (!hit) {
                noBetter++;
                if (APPLY) bumpGeoRefineAttempts(r.url);
                continue;
            }
            const [lat, lng, query] = hit;
            const dist = Math.round(distanceM(lat, lng, c.lat, c.lng));
            console.log(`  📍 ${r.title.slice(0, 45).padEnd(45)} → ${query.slice(0, 45)} (${dist} m från klustret)`);
            refined++;
            if (APPLY) {
                await applyCoords(r, lat, lng, query);
                // Lär systemet permanent: venue-namn + stad → known_venues, som
                // geokodningskedjan numera kollar FÖRST (steg 0). Nästa skrapning
                // av samma venue landar rätt direkt — gratis. Generiska namn
                // ("Biblioteket") och rena stadsnamn hålls ute ur den globala
                // tabellen; kravet på stad gör namnet entydigt.
                const name = (r.locationName || '').trim();
                if (city && name.length >= 5 && !GENERIC_VENUE_NAME.test(name)
                    && name.toLowerCase() !== city.toLowerCase()) {
                    upsertKnownVenue(name, lat, lng, city, `geo-refine ${new Date().toISOString().slice(0, 10)}`);
                    learnedVenues++;
                }
            }
        }
    }

    console.log('\n=== Klart ===');
    console.log(`  🔎 Försökta:       ${attempted}`);
    console.log(`  📍 Förfinade:      ${refined}`);
    console.log(`  ♻️ Memo-återanvända: ${reused}`);
    console.log(`  🏛️ Lärda venues:    ${learnedVenues}`);
    console.log(`  ○ Ingen bättre:    ${noBetter}`);
    console.log(`  ✋ Uppgivna (≥${MAX_ATTEMPTS} försök): ${gaveUp}`);
    if (!APPLY) console.log('\n(dry-run — kör med --apply för att skriva)');
    process.exit(0);
}

if (require.main === module) {
    main().catch(e => { console.error('Fatal:', e); process.exit(1); });
}
