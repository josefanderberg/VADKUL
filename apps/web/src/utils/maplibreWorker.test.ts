import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { MAPLIBRE_WORKER_URL } from '../components/v2/v2MapBaseStyles';

// VAKT för prodstoppet 25/9: maplibre 6:s worker hostas som kopia i public/
// (webpack emitterar den inte ur bundlen — utan kopian dör kartan i prod med
// "Worker failed to load"). Testet låser att kopian är BYTE-IDENTISK med
// paketets dist-fil och att URL:en pekar på den. Bumpas maplibre utan att
// kopian förnyas (cp node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs
// public/maplibre-gl-worker-<version>.mjs + uppdatera MAPLIBRE_WORKER_URL)
// blir det rött HÄR i stället för död karta där ute.
describe('maplibre-workerns public-kopia', () => {
    const root = path.resolve(__dirname, '../..');

    it('URL:en pekar på en fil som finns i public/ och bär paketets version', () => {
        const version = (JSON.parse(readFileSync(
            path.join(root, 'node_modules/maplibre-gl/package.json'), 'utf8',
        )) as { version: string }).version;
        expect(MAPLIBRE_WORKER_URL).toBe(`/maplibre-gl-worker-${version}.mjs`);
    });

    it('kopian i public/ är byte-identisk med paketets worker', () => {
        const dist = readFileSync(path.join(root, 'node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs'));
        const pub = readFileSync(path.join(root, 'public', MAPLIBRE_WORKER_URL.slice(1)));
        expect(pub.equals(dist)).toBe(true);
    });
});
