/**
 * seed-tatorter-scb.ts — ladda SCB:s tätortsregister (CC0) till SQLite.
 *
 * Källa: geodata.scb.se WFS, Tatorter_2023 (2 017 tätorter med polygon,
 * kommun, län, befolkning) i SWEREF99 TM. Centroiden beräknas med shoelace
 * på största polygonens ytterring och konverteras till WGS84 (sweref99.ts).
 *
 * Ger geokodningskedjan deterministiska ortcentroider — "Gemla", "Vislanda",
 * "Rottne" slås upp lokalt i stället för att fråga Nominatim.
 *
 *   npx ts-node src/scripts/seed-tatorter-scb.ts            # dry-run + validering
 *   npx ts-node src/scripts/seed-tatorter-scb.ts --commit
 */
import { replaceTatorter, countTatorter, lookupTatortNear } from '../utils/sqliteHelper';
import { sweref99tmToWgs84 } from '../utils/sweref99';

const COMMIT = process.argv.includes('--commit');
const BASE = 'https://geodata.scb.se/geoserver/stat/wfs?service=WFS&REQUEST=GetFeature&version=2.0.0'
    + '&TYPENAMES=stat:Tatorter_2023&outputFormat=application/json';

/** Shoelace-centroid för en ring i planara koordinater [ [e,n], … ]. */
function ringCentroid(ring: [number, number][]): [number, number] {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < ring.length - 1; i++) {
        const cross = ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
        a += cross;
        cx += (ring[i][0] + ring[i + 1][0]) * cross;
        cy += (ring[i][1] + ring[i + 1][1]) * cross;
    }
    if (Math.abs(a) < 1e-9) return ring[0];
    return [cx / (3 * a), cy / (3 * a)];
}

/** Ytterringen i den största delpolygonen (MultiPolygon → mest area vinner). */
function centroidOfGeometry(geom: any): [number, number] | null {
    const polys: [number, number][][][] = geom.type === 'MultiPolygon' ? geom.coordinates
        : geom.type === 'Polygon' ? [geom.coordinates] : [];
    let best: { ring: [number, number][]; area: number } | null = null;
    for (const poly of polys) {
        const ring = poly[0];
        if (!ring || ring.length < 4) continue;
        let a = 0;
        for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
        const area = Math.abs(a / 2);
        if (!best || area > best.area) best = { ring, area };
    }
    return best ? ringCentroid(best.ring) : null;
}

async function main(): Promise<void> {
    console.log(COMMIT ? '🔧 COMMIT' : '🔍 DRY-RUN');
    const rows: { name: string; kommun: string; lan: string; lat: number; lng: number; bef: number }[] = [];

    for (let start = 0; start < 4000; start += 500) {
        const res = await fetch(`${BASE}&count=500&startIndex=${start}`, {
            headers: { 'User-Agent': 'VadkulScraperBot/1.0 (admin@vadkul.se)' },
        });
        if (!res.ok) { console.error(`⚠️ SCB WFS ${res.status} vid start=${start}`); break; }
        const data: any = await res.json();
        const feats = data.features ?? [];
        if (feats.length === 0) break;
        for (const f of feats) {
            const p = f.properties ?? {};
            const c = centroidOfGeometry(f.geometry ?? {});
            if (!c || !p.tatort) continue;
            // GeoJSON-ordning i EPSG:3006-svaret: [easting, northing]
            const [lat, lng] = sweref99tmToWgs84(c[1], c[0]);
            rows.push({ name: String(p.tatort).trim(), kommun: p.kommunnamn ?? '', lan: p.lannamn ?? '', lat, lng, bef: Number(p.bef) || 0 });
        }
        console.log(`  …${rows.length} tätorter`);
        await new Promise(r => setTimeout(r, 1000));
    }

    // Validering mot kända orter — fel här = trasig konvertering, skriv inget.
    const checks: [string, number, number][] = [
        ['Växjö', 56.88, 14.81], ['Vislanda', 56.79, 14.45], ['Gemla', 56.87, 14.64],
        ['Kiruna', 67.85, 20.22], ['Malmö', 55.58, 13.02],
    ];
    let valid = true;
    for (const [namn, elat, elng] of checks) {
        const hit = rows.filter(r => r.name === namn).sort((a, b) => b.bef - a.bef)[0];
        const ok = hit && Math.abs(hit.lat - elat) < 0.1 && Math.abs(hit.lng - elng) < 0.15;
        console.log(`  ${ok ? '✅' : '❌'} ${namn}: ${hit ? `${hit.lat.toFixed(4)}, ${hit.lng.toFixed(4)}` : 'SAKNAS'} (väntat ~${elat}, ${elng})`);
        if (!ok) valid = false;
    }
    if (!valid) { console.error('❌ valideringen föll — inget skrivet'); process.exit(1); }

    if (COMMIT) {
        replaceTatorter(rows);
        console.log(`✍️  ${countTatorter()} tätorter i registret`);
        const t = lookupTatortNear('Gemla', 56.88, 14.81);
        console.log(`   uppslag Gemla nära Växjö → ${t ? t.map(v => v.toFixed(4)).join(', ') : 'MISS'}`);
    } else {
        console.log(`(dry-run — ${rows.length} rader redo)`);
    }
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
