#!/usr/bin/env node
/**
 * city-map-region.mjs - skriver ut området kartbilderna behöver kakel för, som
 * GeoJSON (en ruta per stad). Används med `pmtiles extract --region=...` så
 * utdraget ur Protomaps bygge blir några tiotal MB i stället för hela Sverige
 * (se docs/kartbilder.md).
 *
 *   node scripts/city-map-region.mjs > stader.geojson
 *
 * Rutan är väl tilltagen: kartbilden är 630 x 318 px på MapLibre-zoom 11
 * (cirka 0,22 grader i öst-väst), och skyltpunkterna hämtas med marginal.
 */
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const src = await readFile(path.join(HERE, '..', 'src', 'utils', 'cityPages.ts'), 'utf8');
const cities = [...src.matchAll(/slug:\s*'([^']+)',\s*lat:\s*([\d.]+),\s*lng:\s*([\d.]+)/g)]
    .map(m => ({ slug: m[1], lat: Number(m[2]), lng: Number(m[3]) }));
if (cities.length < 10) {
    console.error(`Hittade bara ${cities.length} städer i cityPages.ts - har formatet ändrats?`);
    process.exit(1);
}
const DLNG = 0.2;
const DLAT = 0.1;
const coordinates = cities.map(c => [[
    [c.lng - DLNG, c.lat - DLAT], [c.lng + DLNG, c.lat - DLAT], [c.lng + DLNG, c.lat + DLAT],
    [c.lng - DLNG, c.lat + DLAT], [c.lng - DLNG, c.lat - DLAT],
]]);
process.stdout.write(JSON.stringify({ type: 'MultiPolygon', coordinates }));
console.error(`${cities.length} städer.`);
