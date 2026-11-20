import { describe, expect, it } from 'vitest';
import { fromVectorTileJs, type VectorTileFeatureLike } from '@maplibre/vt-pbf';
import {
    HERO_POI_ICON_SIZE, HERO_POI_KEYS, HERO_POI_SOURCE_ID, HERO_POI_TILE_ZOOM,
    heroPoiFeatures, heroPoiSignLayer, heroPoiTiles, loadHeroPois, tileUrl,
} from './heroPoiSigns';

type Geom = ReturnType<VectorTileFeatureLike['loadGeometry']>;
const punkt = (kind: string, x: number, y: number, name?: string): VectorTileFeatureLike => ({
    type: 1, id: undefined, extent: 4096, properties: name ? { kind, name } : { kind },
    loadGeometry: () => [[{ x, y }]] as unknown as Geom,
});
const kakel = (features: VectorTileFeatureLike[], lager = 'pois'): Uint8Array => fromVectorTileJs({
    layers: { [lager]: { version: 2, name: lager, extent: 4096, length: features.length, feature: (i: number) => features[i] } },
});

const VAXJO = { lat: 56.88, lng: 14.81 };

describe('HERO_POI_KEYS', () => {
    it('är resmålen: inga lekplatser, parker eller matställen', () => {
        expect([...HERO_POI_KEYS].sort()).toEqual(['arena', 'bad', 'bibliotek', 'bio', 'golf', 'museum', 'naturreservat', 'teater']);
    });
});

describe('heroPoiTiles', () => {
    it('täcker kartrutan 630 x 318 på zoom 11 med marginal', () => {
        const tiles = heroPoiTiles(VAXJO, 11, 630, 318);
        // Ett z15-kakel är 32 px på MapLibre-zoom 11: (630+80)/32 x (318+80)/32.
        const xs = new Set(tiles.map(t => t.x));
        const ys = new Set(tiles.map(t => t.y));
        expect(xs.size).toBeGreaterThanOrEqual(22);
        expect(xs.size).toBeLessThanOrEqual(24);
        expect(ys.size).toBeGreaterThanOrEqual(12);
        expect(ys.size).toBeLessThanOrEqual(14);
        expect(tiles.every(t => t.z === HERO_POI_TILE_ZOOM)).toBe(true);
        expect(tiles.length).toBe(xs.size * ys.size);
    });

    it('har stadens mitt i rutnätets mitt', () => {
        const tiles = heroPoiTiles(VAXJO, 11, 630, 318);
        const n = 2 ** HERO_POI_TILE_ZOOM;
        const cx = Math.floor(((VAXJO.lng + 180) / 360) * n);
        const xs = tiles.map(t => t.x);
        expect(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - cx)).toBeLessThanOrEqual(1);
    });
});

describe('heroPoiFeatures', () => {
    const t = { z: 15, x: 17732, y: 9950 };

    it('tar bara resmålens punkter och räknar om dem till koordinater', () => {
        const fs = heroPoiFeatures(kakel([
            punkt('museum', 2048, 2048, 'Smålands museum'),
            punkt('playground', 100, 100),
            punkt('restaurant', 200, 200),
            punkt('beach', 0, 0),
        ]), t);
        expect(fs.map(f => f.properties.kind)).toEqual(['museum', 'beach']);
        expect(fs[0].properties.name).toBe('Smålands museum');
        // Kaklets mitt: halvvägs till nästa kakel i båda ledder.
        const n = 2 ** 15;
        expect(fs[0].geometry.coordinates[0]).toBeCloseTo(((t.x + 0.5) / n) * 360 - 180, 9);
        // Hörnet (0,0) är kaklets nordvästra hörn, alltså norr och väster om mitten.
        expect(fs[1].geometry.coordinates[0]).toBeLessThan(fs[0].geometry.coordinates[0]);
        expect(fs[1].geometry.coordinates[1]).toBeGreaterThan(fs[0].geometry.coordinates[1]);
        // Växjö-trakten.
        expect(fs[0].geometry.coordinates[0]).toBeGreaterThan(14);
        expect(fs[0].geometry.coordinates[0]).toBeLessThan(15.5);
        expect(fs[0].geometry.coordinates[1]).toBeGreaterThan(56);
        expect(fs[0].geometry.coordinates[1]).toBeLessThan(58);
    });

    it('hoppar över punkter i kaklets marginal (de finns i grannkaklet)', () => {
        const fs = heroPoiFeatures(kakel([punkt('museum', -20, 100), punkt('museum', 4096, 100), punkt('museum', 4095, 100)]), t);
        expect(fs).toHaveLength(1);
    });

    it('tomt kakel och kakel utan pois-lager ger inget', () => {
        expect(heroPoiFeatures(new Uint8Array(0), t)).toEqual([]);
        expect(heroPoiFeatures(kakel([punkt('museum', 1, 1)], 'places'), t)).toEqual([]);
    });
});

describe('tileUrl', () => {
    it('fyller i mallen och avvisar en adress utan platshållare', () => {
        expect(tileUrl('http://localhost:8099/stader/{z}/{x}/{y}.mvt', { z: 15, x: 1, y: 2 })).toBe('http://localhost:8099/stader/15/1/2.mvt');
        expect(tileUrl('http://localhost:8099/stader.json', { z: 15, x: 1, y: 2 })).toBeNull();
    });
});

describe('heroPoiSignLayer', () => {
    it('är stora kartans skyltlager ur GeoJSON-källan, utan zoomgräns och namn', () => {
        const layer = heroPoiSignLayer() as { source: string; type: string; layout: Record<string, unknown>; filter: unknown[] };
        expect(layer.type).toBe('symbol');
        expect(layer.source).toBe(HERO_POI_SOURCE_ID);
        expect('source-layer' in layer).toBe(false);
        expect('minzoom' in layer).toBe(false);
        expect(layer.layout['icon-size']).toBe(HERO_POI_ICON_SIZE);
        expect(layer.layout['text-field']).toBe('');
        expect(layer.layout['icon-anchor']).toBe('bottom');
        // Filtret släpper bara resmålens platstyper.
        const kinds = layer.filter[2] as string[];
        expect(kinds).toContain('museum');
        expect(kinds).not.toContain('playground');
        expect(kinds).not.toContain('cafe');
    });
});

describe('loadHeroPois', () => {
    it('slår ihop kaklen och tål kakel som saknas', async () => {
        const tiles = [{ z: 15, x: 1, y: 1 }, { z: 15, x: 2, y: 1 }];
        const fc = await loadHeroPois(tiles, async t => (t.x === 1 ? kakel([punkt('library', 5, 5)]) : null));
        expect(fc.type).toBe('FeatureCollection');
        expect(fc.features).toHaveLength(1);
    });
});
