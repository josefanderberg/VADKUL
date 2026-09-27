import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { MAPLIBRE_WORKER_URL } from '../components/v2/v2MapBaseStyles';

// VAKT för prodstoppet 25/9: maplibre 6:s worker hostas som kopior i
// public/maplibre/<version>/ (webpack emitterar dem inte ur bundlen — utan
// kopiorna dör kartan i prod med "Worker failed to load"). Workern importerar
// "./maplibre-gl-shared.mjs" RELATIVT, så BÅDA filerna måste ligga i mappen
// under sina riktiga namn — versionen bärs av mappnamnet (cache-bust).
// Bumpas maplibre utan ny kopia (cp båda dist-filerna till
// public/maplibre/<ny version>/ + uppdatera MAPLIBRE_WORKER_URL) blir det
// rött HÄR i stället för död karta där ute.
describe('maplibre-workerns public-kopior', () => {
    const root = path.resolve(__dirname, '../..');
    const version = (JSON.parse(readFileSync(
        path.join(root, 'node_modules/maplibre-gl/package.json'), 'utf8',
    )) as { version: string }).version;

    it('URL:en pekar in i mappen för paketets version', () => {
        expect(MAPLIBRE_WORKER_URL).toBe(`/maplibre/${version}/maplibre-gl-worker.mjs`);
    });

    it.each(['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'])(
        '%s i public/ är byte-identisk med paketets',
        (fil) => {
            const dist = readFileSync(path.join(root, 'node_modules/maplibre-gl/dist', fil));
            const pub = readFileSync(path.join(root, 'public/maplibre', version, fil));
            expect(pub.equals(dist)).toBe(true);
        },
    );
});
