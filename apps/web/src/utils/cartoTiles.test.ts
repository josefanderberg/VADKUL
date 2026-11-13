import { describe, it, expect } from 'vitest';
import { isCartoTileUrl, isVectorTileUrl, swapCartoVectorSources, tileSchemaOf, mvtLayerNames } from './cartoTiles';

// Licensvakten för stadssidornas kartbilder (#205). Släpper den igenom ett
// CARTO-kakel kan renderingen spara bilder ur deras kakel, vilket villkoren
// förbjuder (§9.c.iii).

describe('isCartoTileUrl', () => {
    it('fångar v2-kaklen som Voyager bytte till i oktober 2026', () => {
        expect(isCartoTileUrl('https://tiles.basemaps.cartocdn.com/v/20261026-01/vectortiles/carto.streets/v2/12/2253/1205.mvt')).toBe(true);
    });

    it('fångar de gamla v1-kaklen', () => {
        expect(isCartoTileUrl('https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/12/2253/1205.mvt')).toBe(true);
    });

    it('fångar rasterkakel och underdomäner', () => {
        expect(isCartoTileUrl('https://a.basemaps.cartocdn.com/rastertiles/voyager/12/2253/1205@2x.png')).toBe(true);
        expect(isCartoTileUrl('https://basemaps.cartocdn.com/light_all/5/17/9.png')).toBe(true);
    });

    it('fångar kakelmallar, så samma test hittar CARTO-källan i stilen', () => {
        expect(isCartoTileUrl('https://tiles.basemaps.cartocdn.com/v/20261026-01/vectortiles/carto.streets/v2/{z}/{x}/{y}.mvt')).toBe(true);
    });

    it('okända CARTO-adresser fäller vakten (den säkra riktningen)', () => {
        expect(isCartoTileUrl('https://tiles.basemaps.cartocdn.com/v/20270101-01/nyttformat/carto.streets/v3/tile?z=12&x=2253&y=1205')).toBe(true);
    });

    it('släpper stilens formgivning: style.json, sprite och typsnitt', () => {
        expect(isCartoTileUrl('https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json')).toBe(false);
        expect(isCartoTileUrl('https://tiles.basemaps.cartocdn.com/v/20261026-01/gl/voyager-gl-style/sprite@2x.png')).toBe(false);
        expect(isCartoTileUrl('https://tiles.basemaps.cartocdn.com/v/20261026-01/gl/voyager-gl-style/sprite.json')).toBe(false);
        expect(isCartoTileUrl('https://tiles.basemaps.cartocdn.com/v/20261026-01/fonts/Montserrat%20Regular,Open%20Sans%20Regular/0-255.pbf')).toBe(false);
        // Den gamla typsnittsadressen, som en gång fällde vakten på .pbf.
        expect(isCartoTileUrl('https://tiles.basemaps.cartocdn.com/fonts/Montserrat%20Regular/256-511.pbf')).toBe(false);
    });

    it('kakel i formgivningens mappar räknas ändå som kakel', () => {
        expect(isCartoTileUrl('https://tiles.basemaps.cartocdn.com/gl/12/2253/1205.mvt')).toBe(true);
    });

    it('egna kakel och andra värdar är fria', () => {
        expect(isCartoTileUrl('http://localhost:8099/12/2253/1205.mvt')).toBe(false);
        expect(isCartoTileUrl('https://tiles.openfreemap.org/planet/12/2253/1205.pbf')).toBe(false);
        expect(isCartoTileUrl('https://evilcartocdn.com/12/2253/1205.mvt')).toBe(false);
    });

    it('trasiga och relativa adresser är inga CARTO-kakel', () => {
        expect(isCartoTileUrl('/kartbilder/malmo.webp')).toBe(false);
        expect(isCartoTileUrl('inte en adress')).toBe(false);
    });
});

describe('isVectorTileUrl', () => {
    it('egna och andras vektorkakel', () => {
        expect(isVectorTileUrl('http://localhost:8099/12/2253/1205.pbf')).toBe(true);
        expect(isVectorTileUrl('https://tiles.basemaps.cartocdn.com/v/20261026-01/vectortiles/carto.streets/v2/12/2253/1205.mvt')).toBe(true);
    });

    it('inte typsnitt, rasterkakel eller mallar', () => {
        expect(isVectorTileUrl('https://tiles.basemaps.cartocdn.com/v/20261026-01/fonts/Montserrat%20Regular/0-255.pbf')).toBe(false);
        expect(isVectorTileUrl('https://tile.openstreetmap.org/12/2253/1205.png')).toBe(false);
        expect(isVectorTileUrl('http://localhost:8099/{z}/{x}/{y}.pbf')).toBe(false);
        expect(isVectorTileUrl('inte en adress')).toBe(false);
    });
});

describe('swapCartoVectorSources', () => {
    const voyager = () => ({
        sources: {
            protomaps: {
                type: 'vector',
                tiles: ['https://tiles.basemaps.cartocdn.com/v/20261026-01/vectortiles/carto.streets/v2/{z}/{x}/{y}.mvt'],
                minzoom: 0,
                maxzoom: 15,
            },
        } as Record<string, { type?: string; url?: string; tiles?: string[]; minzoom?: number; maxzoom?: number }>,
    });

    it('byter CARTO-källan oavsett namn och behåller id och zoomspann', () => {
        const style = voyager();
        expect(swapCartoVectorSources(style, 'http://localhost:8099/{z}/{x}/{y}.mvt')).toEqual(['protomaps']);
        expect(style.sources.protomaps).toEqual({ type: 'vector', tiles: ['http://localhost:8099/{z}/{x}/{y}.mvt'], minzoom: 0, maxzoom: 15 });
    });

    it('en TileJSON-adress blir url i stället för tiles', () => {
        const style = voyager();
        swapCartoVectorSources(style, 'http://localhost:8099/sweden.json');
        expect(style.sources.protomaps).toEqual({ type: 'vector', url: 'http://localhost:8099/sweden.json' });
    });

    it('hittar också den gamla carto-källan med TileJSON-url', () => {
        const style = { sources: { carto: { type: 'vector', url: 'https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/tiles.json' } } };
        expect(swapCartoVectorSources(style, 'http://localhost:8099/{z}/{x}/{y}.mvt')).toEqual(['carto']);
    });

    it('rör inte andra källor', () => {
        const style = voyager();
        style.sources.egen = { type: 'vector', tiles: ['https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf'] };
        style.sources.dem = { type: 'raster-dem', tiles: ['https://tiles.basemaps.cartocdn.com/dem/{z}/{x}/{y}.png'] };
        expect(swapCartoVectorSources(style, 'http://localhost:8099/{z}/{x}/{y}.mvt')).toEqual(['protomaps']);
        expect(style.sources.egen.tiles).toEqual(['https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf']);
        expect(style.sources.dem.type).toBe('raster-dem');
    });

    it('stil utan källor ger inga byten', () => {
        expect(swapCartoVectorSources({}, 'http://localhost:8099/{z}/{x}/{y}.mvt')).toEqual([]);
    });
});

describe('tileSchemaOf', () => {
    it('känner igen Protomaps (CARTO v2 och Protomaps eget bygge)', () => {
        expect(tileSchemaOf(['buildings', 'earth', 'landuse', 'places', 'pois', 'roads', 'water'])).toBe('protomaps');
    });

    it('känner igen OpenMapTiles (planetilers gamla sweden.pmtiles)', () => {
        expect(tileSchemaOf(['boundary', 'landcover', 'landuse', 'place', 'transportation', 'water'])).toBe('openmaptiles');
    });

    it('lager som båda schemana har avgör ingenting', () => {
        expect(tileSchemaOf(['water', 'landcover', 'landuse'])).toBe('okänt');
        expect(tileSchemaOf([])).toBe('okänt');
    });
});

// Minimal MVT-kodare för testet: Tile { repeated Layer layers = 3 },
// Layer { required string name = 1; uint32 version = 15; uint32 extent = 5 }.
function varint(n: number): number[] {
    const out: number[] = [];
    while (n >= 0x80) {
        out.push((n % 128) | 0x80);
        n = Math.floor(n / 128);
    }
    out.push(n);
    return out;
}
function lengthField(field: number, bytes: number[]): number[] {
    return [...varint(field * 8 + 2), ...varint(bytes.length), ...bytes];
}
function layer(name: string, versionFirst = true): number[] {
    const version = [...varint(15 * 8), 2];
    const extent = [...varint(5 * 8), ...varint(4096)];
    const nameField = lengthField(1, [...new TextEncoder().encode(name)]);
    return versionFirst ? [...version, ...nameField, ...extent] : [...nameField, ...version, ...extent];
}
function tile(...layers: number[][]): Uint8Array {
    return new Uint8Array(layers.flatMap(l => lengthField(3, l)));
}

describe('mvtLayerNames', () => {
    it('läser lagernamnen i ordning, var i lagret namnet än ligger', () => {
        expect(mvtLayerNames(tile(layer('earth'), layer('roads', false), layer('places')))).toEqual(['earth', 'roads', 'places']);
    });

    it('klarar långa lager (längd över 127 byte)', () => {
        const lång = [...layer('water'), ...lengthField(3, Array(300).fill(97))];
        expect(mvtLayerNames(tile(lång, layer('transportation')))).toEqual(['water', 'transportation']);
    });

    it('tomt kakel har inga lager', () => {
        expect(mvtLayerNames(new Uint8Array())).toEqual([]);
    });

    it('avkapat eller packat kakel ger ett fel i stället för skräpnamn', () => {
        const hel = tile(layer('earth'));
        expect(() => mvtLayerNames(hel.subarray(0, hel.length - 3))).toThrow();
        // gzip-huvudet 1f 8b: wire-typ 7 finns inte i protobuf.
        expect(() => mvtLayerNames(new Uint8Array([0x1f, 0x8b, 0x08, 0x00]))).toThrow();
    });
});
