/**
 * seed-venues-bibdb.ts — seeda known_venues från KB:s biblioteksdatabas.
 *
 * bibdb.libris.kb.se är det NATIONELLA registret över alla folkbibliotek
 * inkl. filialer, med officiella koordinater (768 av 831) och gatuadresser.
 * Detta är exakt den platsklass OSM saknar (Tallgården-fallet 24/8) och som
 * dominerar de kommunala bibliotekssajternas centroid-event (~2 100 st).
 *
 * Vakter (samma som Overpass-seedningen): namn som förekommer flera gånger
 * >1 km isär hoppas (tvetydiga), generiska hoppas, befintliga rader skrivs
 * aldrig över. Rader utan koordinater gatugeokodas strukturerat (Nominatim).
 *
 *   npx ts-node src/scripts/seed-venues-bibdb.ts            # dry-run
 *   npx ts-node src/scripts/seed-venues-bibdb.ts --commit
 */
import { sqlite, upsertKnownVenue, countKnownVenues } from '../utils/sqliteHelper';
import { geocodeStreetSweden, isInNordic } from '../utils/venueCoordinates';

const COMMIT = process.argv.includes('--commit');
const API = 'https://bibdb.libris.kb.se/api/lib?library_type=folkbib&dump=true';

const GENERIC = /^(bibliotek(et)?|stadsbibliotek(et)?|huvudbibliotek(et)?|folkbibliotek(et)?|kommunbibliotek(et)?|biblioteken)$/i;

interface Lib { name: string; lat: number; lng: number; city: string; street: string }

async function fetchAll(): Promise<Lib[]> {
    const out: Lib[] = [];
    for (let start = 0; start < 4000; start += 200) {
        const res = await fetch(`${API}&start=${start}`, {
            headers: { Accept: 'application/json', 'User-Agent': 'VadkulScraperBot/1.0 (admin@vadkul.se)' },
        });
        if (!res.ok) { console.warn(`⚠️ bibdb ${res.status} vid start=${start}`); break; }
        const data: any = await res.json();
        const libs = data.libraries ?? [];
        if (libs.length === 0) break;
        for (const l of libs) {
            if (l.country_code !== 'se' || !l.alive) continue;
            const name = (l.name || '').trim();
            if (!name) continue;
            const gen = (l.address ?? []).find((a: any) => a.address_type === 'gen')
                ?? (l.address ?? [])[0] ?? {};
            out.push({
                name,
                lat: Number(l.latitude) || 0,
                lng: Number(l.longitude) || 0,
                city: (gen.city || '').trim(),
                street: (gen.street || '').trim(),
            });
        }
        await new Promise(r => setTimeout(r, 1000));
    }
    return out;
}

const toRad = (d: number) => (d * Math.PI) / 180;
const distKm = (a: number, b: number, x: number, y: number) => {
    const h = Math.sin(toRad(x - a) / 2) ** 2 + Math.cos(toRad(a)) * Math.cos(toRad(x)) * Math.sin(toRad(y - b) / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

async function main(): Promise<void> {
    console.log(COMMIT ? '🔧 COMMIT' : '🔍 DRY-RUN');
    const libs = await fetchAll();
    console.log(`${libs.length} svenska folkbibliotek i bibdb`);

    // Gatugeokoda de utan koordinater (strukturerat — ingen fallback).
    let streetGeocoded = 0;
    for (const l of libs) {
        if ((l.lat && l.lng) || !l.street || !l.city || /^box\s/i.test(l.street)) continue;
        const hit = await geocodeStreetSweden(l.street, l.city);
        if (hit) { l.lat = hit[0]; l.lng = hit[1]; streetGeocoded++; }
    }

    const byName = new Map<string, Lib[]>();
    for (const l of libs) {
        if (!l.lat || !l.lng || !isInNordic(l.lat, l.lng)) continue;
        const k = l.name.toLowerCase();
        if (!byName.has(k)) byName.set(k, []);
        byName.get(k)!.push(l);
    }

    const existsStmt = sqlite.prepare('SELECT 1 FROM known_venues WHERE LOWER(name) = LOWER(?)');
    let seeded = 0, ambiguous = 0, generic = 0, already = 0;
    for (const [, group] of byName) {
        const l = group[0];
        if (group.some(g => distKm(l.lat, l.lng, g.lat, g.lng) > 1)) { ambiguous++; continue; }
        if (l.name.length < 5 || GENERIC.test(l.name)) { generic++; continue; }
        if (existsStmt.get(l.name)) { already++; continue; }
        if (COMMIT) upsertKnownVenue(l.name, l.lat, l.lng, l.city, `bibdb-seed ${new Date().toISOString().slice(0, 10)}`);
        seeded++;
    }
    console.log(`${COMMIT ? 'Seedade' : 'Skulle seeda'}: ${seeded} (${streetGeocoded} gatugeokodade)`);
    console.log(`Hoppade: ${ambiguous} tvetydiga, ${generic} generiska/korta, ${already} fanns redan`);
    console.log(`known_venues totalt nu: ${countKnownVenues()}`);
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
