/**
 * overpassVenue.ts — fuzzy namn-uppslag av en venue mot OSM via Overpass.
 *
 * Nominatims fritextsök hittar inte små POI:er ("Tallgårdens bibliotek,
 * Växjö" → 0 träffar) trots att byggnaden finns i OSM under snarlikt namn
 * ("Tallgården"). Overpass kan regex-söka namn inom en radie — samma sak
 * som att googla platsen, fast deterministiskt och gratis.
 *
 * Används av geo-refine (kandidat 4.5). Svar cachas i geocode_cache med
 * 'overpass:'-nyckel (träff 90 d / miss 14 d) och egen artighetspaus —
 * Overpass har hårdare kvoter än Nominatim, därav retries + spegel.
 */
import { geocodeCacheGet, geocodeCacheSet } from './sqliteHelper';
import { isInNordic, deGenitiveFirstWord } from './venueCoordinates';

const OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
];
const OVERPASS_DELAY_MS = parseInt(process.env.OVERPASS_DELAY_MS || '5000', 10);

/** Generiska verksamhetssuffix — OSM-objektet heter ofta bara byggnaden. */
const ACTIVITY_SUFFIX = /^(bibliotek(et)?|församlingshem(met)?|folkhögskola(n)?|skola(n)?|kyrka(n)?|museum|museet)$/i;

/**
 * Namnvarianter att prova mot OSM, mest specifik först:
 *   "Tallgårdens bibliotek" → ["Tallgårdens bibliotek", "Tallgården bibliotek", "Tallgården"]
 * Sista varianten (huvudordet, av-genitiviserat) fångar OSM-objekt som heter
 * byggnaden ("Tallgården") snarare än verksamheten. Max tre varianter.
 */
export function overpassNameVariants(name: string): string[] {
    const n = name.trim().replace(/\s+/g, ' ');
    if (!n) return [];
    const out = [n];
    const deGen = deGenitiveFirstWord(n);
    if (deGen) out.push(deGen);
    const words = n.split(' ');
    if (words.length >= 2 && ACTIVITY_SUFFIX.test(words[words.length - 1])) {
        const head = words.slice(0, -1).join(' ');
        // Enords-huvud av-genitiviseras ("Tallgårdens" → "Tallgården");
        // flerords-huvud används som det är ("Söraby gamla" osv.).
        const single = !head.includes(' ') && /s$/i.test(head) && !/(ss|ås|us|es)$/i.test(head) && head.length >= 6
            ? head.slice(0, -1)
            : head;
        if (single.length >= 5) out.push(single);
    }
    return [...new Set(out)].slice(0, 3);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Circuit breaker: Overpass får kosta max ~2 min strul per körning.
 *  Lärdom 25/8: retry-backoffs à 20 s × blandade fel gjorde geo-refine
 *  timslång — räkna TOTALA missar (inte bara raka) och stäng av tidigt. */
let totalFailures = 0;
const BREAKER_LIMIT = 8;

async function overpassQuery(q: string): Promise<any | null> {
    if (totalFailures >= BREAKER_LIMIT) return null;
    for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 10_000));
        const endpoint = OVERPASS_ENDPOINTS[attempt % OVERPASS_ENDPOINTS.length];
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'VadkulScraperBot/1.0 (admin@vadkul.se)' },
                body: 'data=' + encodeURIComponent(q),
                signal: AbortSignal.timeout(35_000),
            });
            if (res.ok) return await res.json();
        } catch { /* nätfel/timeout → nästa försök */ }
    }
    totalFailures++;
    if (totalFailures === BREAKER_LIMIT) {
        console.warn(`[Overpass] ${BREAKER_LIMIT} totalmissar — uppslaget avstängt för resten av körningen`);
    }
    return null;   // transient — cachas INTE som miss av anroparen
}

/**
 * Slå upp en venue nära en ankarpunkt (stadscentroid/kluster). Returnerar
 * [lat, lng] eller null. Tvetydiga träffar (>1 km isär) avvisas.
 * Transienta Overpass-fel cachas inte; äkta "finns inte" cachas 14 dagar.
 */
export async function resolveVenueOverpass(
    name: string,
    anchorLat: number,
    anchorLng: number,
    radiusM = 20_000,
): Promise<[number, number] | null> {
    const n = name.trim();
    if (n.length < 5) return null;

    const key = `overpass:${n.toLowerCase()}|${anchorLat.toFixed(2)},${anchorLng.toFixed(2)}`;
    const cached = geocodeCacheGet(key);
    if (cached && (cached.ok ? cached.ageDays < 90 : cached.ageDays < 14)) {
        return cached.ok ? [cached.lat, cached.lng] : null;
    }

    let transientFail = false;
    for (const variant of overpassNameVariants(n)) {
        await new Promise(r => setTimeout(r, OVERPASS_DELAY_MS));
        const data = await overpassQuery(
            `[out:json][timeout:30];nwr["name"~"^${escapeRe(variant)}$",i](around:${radiusM},${anchorLat},${anchorLng});out center 8;`,
        );
        if (data === null) { transientFail = true; continue; }
        const hits: [number, number][] = [];
        for (const el of data.elements ?? []) {
            const lat = el.lat ?? el.center?.lat;
            const lng = el.lon ?? el.center?.lon;
            if (typeof lat === 'number' && typeof lng === 'number' && isInNordic(lat, lng)) hits.push([lat, lng]);
        }
        if (hits.length === 0) continue;
        const [base] = hits;
        const spreadKm = Math.max(...hits.map(h =>
            Math.hypot((h[0] - base[0]) * 111.32, (h[1] - base[1]) * 111.32 * Math.cos((base[0] * Math.PI) / 180))));
        if (spreadKm > 1) continue;   // flera olika platser med samma namn → tvetydigt
        geocodeCacheSet(key, [base[0], base[1], 'poi']);
        return base;
    }

    if (!transientFail) geocodeCacheSet(key, null);
    return null;
}
