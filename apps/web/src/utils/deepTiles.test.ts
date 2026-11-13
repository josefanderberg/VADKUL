import { describe, expect, it } from 'vitest';
import { VectorTile } from '@mapbox/vector-tile';
import { fromVectorTileJs, type VectorTileFeatureLike } from '@maplibre/vt-pbf';
import { PbfReader } from 'pbf';
import {
    childTileUrls, DEEP_EXTENT, DEEP_FAR_MAX_CHILD_ZOOM, DEEP_NEAR_MIN_CHILD_ZOOM, DEEP_PROTOCOL,
    deepLayersFor, deepTileError, deepTileTemplate, loadDeepTile, mergeChildTiles, type TileFetch,
} from './deepTiles';
import { isRetryableTileFetch } from '../components/v2/v2MapEngineHeal';

type Pt = [number, number];
type Geom = ReturnType<VectorTileFeatureLike['loadGeometry']>;

function feature(type: 1 | 2 | 3, properties: Record<string, string | number>, rings: Pt[][]): VectorTileFeatureLike {
    return {
        type, id: undefined, extent: 4096, properties,
        loadGeometry: () => rings.map(r => r.map(([x, y]) => ({ x, y }))) as unknown as Geom,
    };
}
// Ett litet barnkakel: lager -> features.
function tile(layers: Record<string, VectorTileFeatureLike[]>, extent = 4096): Uint8Array {
    return fromVectorTileJs({
        layers: Object.fromEntries(Object.entries(layers).map(([name, fs]) => [name, {
            version: 2, name, extent, length: fs.length, feature: (i: number) => fs[i],
        }])),
    });
}
const ruta = (x0: number, y0: number, x1: number, y1: number): Pt[] =>
    [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
const avkoda = (bytes: Uint8Array) => new VectorTile(new PbfReader(bytes));
const hörn = (f: { loadGeometry(): { x: number; y: number }[][] }) => f.loadGeometry()[0].map(p => [p.x, p.y]);

const MALL = 'https://tiles.example.invalid/v/20261026-01/vectortiles/carto.streets/v2/{z}/{x}/{y}.mvt';

describe('childTileUrls', () => {
    it('ger de fyra barnen ett zoomsteg djupare', () => {
        const url = deepTileTemplate(MALL).replace('{z}', '5').replace('{x}', '17').replace('{y}', '9');
        expect(url.startsWith(`${DEEP_PROTOCOL}://https://`)).toBe(true);
        expect(childTileUrls(url)).toEqual([
            { url: MALL.replace('{z}/{x}/{y}', '6/34/18'), z: 6, dx: 0, dy: 0 },
            { url: MALL.replace('{z}/{x}/{y}', '6/35/18'), z: 6, dx: 1, dy: 0 },
            { url: MALL.replace('{z}/{x}/{y}', '6/34/19'), z: 6, dx: 0, dy: 1 },
            { url: MALL.replace('{z}/{x}/{y}', '6/35/19'), z: 6, dx: 1, dy: 1 },
        ]);
    });

    it('rör inte siffror tidigare i adressen och behåller frågesträngen', () => {
        const barn = childTileUrls(`${DEEP_PROTOCOL}://https://a.invalid/v2/0/0/0.pbf?k=1`);
        expect(barn?.map(b => b.url)).toEqual([
            'https://a.invalid/v2/1/0/0.pbf?k=1', 'https://a.invalid/v2/1/1/0.pbf?k=1',
            'https://a.invalid/v2/1/0/1.pbf?k=1', 'https://a.invalid/v2/1/1/1.pbf?k=1',
        ]);
    });

    it('säger nej till adresser som inte är våra', () => {
        expect(childTileUrls('https://a.invalid/5/17/9.mvt')).toBeNull();
        expect(childTileUrls(`${DEEP_PROTOCOL}://https://a.invalid/style.json`)).toBeNull();
    });
});

describe('mergeChildTiles', () => {
    it('lägger varje barn i sin fjärdedel av ett kakel med dubbla utsträckningen', () => {
        const sjö = tile({ water: [feature(3, { kind: 'lake' }, [ruta(100, 200, 300, 400)])] });
        const ut = avkoda(mergeChildTiles([
            { data: sjö, dx: 0, dy: 0 },
            { data: sjö, dx: 1, dy: 0 },
            { data: sjö, dx: 0, dy: 1 },
            { data: sjö, dx: 1, dy: 1 },
        ]));
        const lager = ut.layers.water;
        expect(lager.extent).toBe(DEEP_EXTENT);
        expect(lager.length).toBe(4);
        expect(hörn(lager.feature(0))).toEqual(ruta(100, 200, 300, 400));
        expect(hörn(lager.feature(1))).toEqual(ruta(4196, 200, 4396, 400));
        expect(hörn(lager.feature(2))).toEqual(ruta(100, 4296, 300, 4496));
        expect(hörn(lager.feature(3))).toEqual(ruta(4196, 4296, 4396, 4496));
        expect(lager.feature(0).type).toBe(3);
    });

    it('behåller kind (det lagren färgar på) och släpper resten av attributen', () => {
        const ut = avkoda(mergeChildTiles([{
            data: tile({ landcover: [feature(3, { kind: 'farmland', sort_rank: 200, 'name:sv': 'x' }, [ruta(0, 0, 10, 10)])] }),
            dx: 0, dy: 0,
        }]));
        expect(ut.layers.landcover.feature(0).properties).toEqual({ kind: 'farmland' });
    });

    it('tar ytorna och älvarnas linjer ur de lager vi ritar - inga namnpunkter, bäckar, vägar eller orter', () => {
        const ut = avkoda(mergeChildTiles([{
            data: tile({
                water: [
                    feature(1, { kind: 'sea', name: 'Östersjön' }, [[[5, 5]]]),
                    feature(2, { kind: 'stream' }, [[[0, 0], [9, 9]]]),
                    feature(2, { kind: 'river' }, [[[10, 20], [30, 40], [50, 45]]]),
                    feature(3, { kind: 'ocean' }, [ruta(0, 0, 50, 50)]),
                ],
                roads: [feature(2, { kind: 'highway' }, [[[0, 0], [9, 9]]])],
                places: [feature(1, { kind: 'locality' }, [[[1, 1]]])],
            }),
            dx: 0, dy: 0,
        }]));
        expect(Object.keys(ut.layers)).toEqual(['water']);
        expect(ut.layers.water.length).toBe(2);
        const [älv, hav] = [ut.layers.water.feature(0), ut.layers.water.feature(1)];
        expect([älv.type, älv.properties.kind]).toEqual([2, 'river']);
        expect(hörn(älv)).toEqual([[10, 20], [30, 40], [50, 45]]);
        expect([hav.type, hav.properties.kind]).toEqual([3, 'ocean']);
    });

    // #222: inzoomat slås bara platsskyltarnas punkter ihop.
    describe('inzoomat: platsskyltarnas punkter', () => {
        const nära = deepLayersFor(DEEP_NEAR_MIN_CHILD_ZOOM);
        const barn = (dx: 0 | 1, dy: 0 | 1, pois: VectorTileFeatureLike[]) => ({ data: tile({ pois, water: [feature(3, { kind: 'lake' }, [ruta(0, 0, 9, 9)])] }), dx, dy });

        it('tar skyltarnas platstyper med namn, på rätt plats i fjärdedelen', () => {
            const ut = avkoda(mergeChildTiles([
                barn(1, 1, [
                    feature(1, { kind: 'bathing_place', name: 'Evedal', min_zoom: 14 }, [[[100, 200]]]),
                    feature(1, { kind: 'restaurant', name: 'Krogen' }, [[[5, 5]]]),
                    feature(1, { kind: 'museum', name: 'Smålands Museum' }, [[[4000, 10]]]),
                ]),
            ], nära));
            expect(Object.keys(ut.layers)).toEqual(['pois']);
            const l = ut.layers.pois;
            expect(l.length).toBe(2);
            expect(l.feature(0).properties).toEqual({ kind: 'bathing_place', name: 'Evedal' });
            expect(hörn(l.feature(0))).toEqual([[4196, 4296]]);
            expect(l.feature(1).properties.name).toBe('Smålands Museum');
        });

        it('en punkt i kaklets marginal tas inte med - den finns i grannbarnet och skulle stå två gånger', () => {
            const ut = avkoda(mergeChildTiles([
                barn(0, 0, [feature(1, { kind: 'park', name: 'Kant' }, [[[4100, 50]]]), feature(1, { kind: 'park', name: 'Inne' }, [[[4095, 50]]])]),
                barn(1, 0, [feature(1, { kind: 'park', name: 'Kant' }, [[[4, 50]]]), feature(1, { kind: 'park', name: 'Utanför' }, [[[-3, 50]]])]),
            ], nära));
            const namn = Array.from({ length: ut.layers.pois.length }, (_, i) => ut.layers.pois.feature(i).properties.name);
            expect(namn.sort()).toEqual(['Inne', 'Kant']);
        });
    });

    it('vad som slås ihop beror på barnkaklens zoom, och mellan lägena ingenting', () => {
        expect(Object.keys(deepLayersFor(6)).sort()).toEqual(['landcover', 'landuse', 'water']);
        expect(Object.keys(deepLayersFor(DEEP_FAR_MAX_CHILD_ZOOM)).sort()).toEqual(['landcover', 'landuse', 'water']);
        expect(Object.keys(deepLayersFor(DEEP_FAR_MAX_CHILD_ZOOM + 1))).toEqual([]);
        expect(Object.keys(deepLayersFor(DEEP_NEAR_MIN_CHILD_ZOOM - 1))).toEqual([]);
        expect(Object.keys(deepLayersFor(15))).toEqual(['pois']);
    });

    it('av landuse följer bara skogen med', () => {
        const ut = avkoda(mergeChildTiles([{
            data: tile({ landuse: [
                feature(3, { kind: 'forest' }, [ruta(0, 0, 9, 9)]),
                feature(3, { kind: 'military' }, [ruta(0, 0, 9, 9)]),
                feature(3, { kind: 'wood' }, [ruta(0, 0, 9, 9)]),
                feature(3, { kind: 'nature_reserve' }, [ruta(0, 0, 9, 9)]),
            ] }),
            dx: 0, dy: 0,
        }]));
        const l = ut.layers.landuse;
        expect([l.feature(0).properties.kind, l.feature(1).properties.kind]).toEqual(['forest', 'wood']);
        expect(l.length).toBe(2);
    });

    it('ytor i kaklets marginal (utanför 0-4096) följer med, så barnen överlappar sömlöst', () => {
        const ut = avkoda(mergeChildTiles([{
            data: tile({ water: [feature(3, { kind: 'lake' }, [ruta(-64, 4000, 4160, 4160)])] }),
            dx: 1, dy: 0,
        }]));
        expect(hörn(ut.layers.water.feature(0))).toEqual(ruta(4032, 4000, 8256, 4160));
    });

    it('räknar om barn med annan utsträckning', () => {
        const ut = avkoda(mergeChildTiles([{
            data: tile({ water: [feature(3, { kind: 'lake' }, [ruta(0, 0, 8192, 8192)])] }, 8192),
            dx: 1, dy: 1,
        }]));
        expect(hörn(ut.layers.water.feature(0))).toEqual(ruta(4096, 4096, 8192, 8192));
    });

    it('ett barn som saknas är en tom fjärdedel, och inga barn alls ger ett tomt kakel', () => {
        const sjö = tile({ water: [feature(3, { kind: 'lake' }, [ruta(1, 1, 2, 2)])] });
        const ut = avkoda(mergeChildTiles([
            { data: null, dx: 0, dy: 0 },
            { data: new Uint8Array(0), dx: 1, dy: 0 },
            { data: sjö, dx: 1, dy: 1 },
        ]));
        expect(ut.layers.water.length).toBe(1);
        expect(Object.keys(avkoda(mergeChildTiles([{ data: null, dx: 0, dy: 0 }])).layers)).toEqual([]);
    });
});

describe('loadDeepTile', () => {
    const url = `${DEEP_PROTOCOL}://https://a.invalid/v2/5/17/9.mvt`;
    const sjö = tile({ water: [feature(3, { kind: 'lake' }, [ruta(1, 1, 2, 2)])] });
    const svar = (status: number, data: Uint8Array = sjö) => ({
        ok: status >= 200 && status < 300, status, statusText: `status ${status}`,
        arrayBuffer: async () => data.slice().buffer,
    });

    it('hämtar de fyra barnen och slår ihop dem', async () => {
        const hämtade: string[] = [];
        const fetchTile: TileFetch = async u => { hämtade.push(u); return svar(200); };
        const ut = avkoda(await loadDeepTile(url, fetchTile));
        expect(hämtade.sort()).toEqual([
            'https://a.invalid/v2/6/34/18.mvt', 'https://a.invalid/v2/6/34/19.mvt',
            'https://a.invalid/v2/6/35/18.mvt', 'https://a.invalid/v2/6/35/19.mvt',
        ]);
        expect(ut.layers.water.length).toBe(4);
    });

    it('ett barn som inte finns (404) ger en tom fjärdedel i stället för ett fel', async () => {
        const fetchTile: TileFetch = async u => svar(u.endsWith('6/35/19.mvt') ? 404 : 200);
        expect(avkoda(await loadDeepTile(url, fetchTile)).layers.water.length).toBe(3);
    });

    it('serverfel och nätfel kastas i en form som kakel-omförsöken (#207) känner igen', async () => {
        const server: TileFetch = async u => svar(u.endsWith('6/34/18.mvt') ? 503 : 200);
        const e1 = await loadDeepTile(url, server).catch(e => e);
        expect(isRetryableTileFetch(e1)).toBe(true);
        const nät: TileFetch = async () => { throw new TypeError('Failed to fetch'); };
        const e2 = await loadDeepTile(url, nät).catch(e => e);
        expect(isRetryableTileFetch(e2)).toBe(true);
        expect(isRetryableTileFetch(deepTileError(403, 'Forbidden', 'x'))).toBe(false);
    });

    it('väljer lager efter barnkaklens zoom: inzoomat bara skyltarna', async () => {
        const allt = tile({
            water: [feature(3, { kind: 'lake' }, [ruta(1, 1, 2, 2)])],
            pois: [feature(1, { kind: 'library', name: 'Biblioteket' }, [[[10, 10]]])],
        });
        const fetchTile: TileFetch = async () => svar(200, allt);
        const nära = avkoda(await loadDeepTile(`${DEEP_PROTOCOL}://https://a.invalid/v2/13/4433/2470.mvt`, fetchTile));
        expect(Object.keys(nära.layers)).toEqual(['pois']);
        const långt = avkoda(await loadDeepTile(url, fetchTile));
        expect(Object.keys(långt.layers)).toEqual(['water']);
    });

    it('en avbruten hämtning (kaklet lämnade vyn) förblir ett avbrott, inget omförsök', async () => {
        const avbruten: TileFetch = async () => { throw new DOMException('aborted', 'AbortError'); };
        const e = await loadDeepTile(url, avbruten).catch(x => x);
        expect(e.name).toBe('AbortError');
        expect(isRetryableTileFetch(e)).toBe(false);
    });
});
