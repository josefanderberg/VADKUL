import { describe, it, expect } from 'vitest';
import {
    tileKeyFor, parseTileKey, tilesForBounds, boundsCoveredBy, descBucketFor, parseDescBucket,
    circleBounds, unionBounds, composeAreaRows, DESC_BUCKETS, MAX_AREA_TILES,
} from './eventTiles';

describe('tileKeyFor', () => {
    it('lägger städerna i fasta rutor (0,5° × 1°)', () => {
        expect(tileKeyFor(59.33, 18.07)).toBe('118_18');   // Stockholm
        expect(tileKeyFor(57.71, 11.97)).toBe('115_11');   // Göteborg
        expect(tileKeyFor(55.6, 13.0)).toBe('111_13');     // Malmö
    });

    it('rutkanten hör till rutan norr/öster om sig (floor)', () => {
        expect(tileKeyFor(59.5, 18)).toBe('119_18');
        expect(tileKeyFor(59.4999, 17.9999)).toBe('118_17');
    });

    it('oplacerat (0,0), ogiltigt och utanför rutområdet → null', () => {
        expect(tileKeyFor(0, 0)).toBeNull();
        expect(tileKeyFor(NaN, 18)).toBeNull();
        expect(tileKeyFor('59', 18)).toBeNull();
        expect(tileKeyFor(40, 18)).toBeNull();     // Medelhavet
        expect(tileKeyFor(59, -5)).toBeNull();     // väster om nollmeridianen
    });
});

describe('parseTileKey', () => {
    it('godtar kanoniska nycklar i rutområdet', () => {
        expect(parseTileKey('118_18')).toEqual({ latIdx: 118, lngIdx: 18 });
    });

    it('avvisar allt som skulle ge en EXTRA cache-nyckel för samma ruta', () => {
        expect(parseTileKey('0118_18')).toBeNull();
        expect(parseTileKey('118_018')).toBeNull();
        expect(parseTileKey(' 118_18')).toBeNull();
        expect(parseTileKey('118-18')).toBeNull();
    });

    it('avvisar rutor utanför rutområdet och skräp', () => {
        expect(parseTileKey('99_18')).toBeNull();
        expect(parseTileKey('118_40')).toBeNull();
        expect(parseTileKey('abc')).toBeNull();
        expect(parseTileKey(null)).toBeNull();
    });

    it('tileKeyFor och parseTileKey är varandras inverser', () => {
        const k = tileKeyFor(63.83, 20.26)!;   // Umeå
        const p = parseTileKey(k)!;
        expect(k).toBe(`${p.latIdx}_${p.lngIdx}`);
    });
});

describe('tilesForBounds', () => {
    // Stockholms innerstad på mobil, ungefär 8 × 12 km.
    const sthlm = { west: 17.98, south: 59.29, east: 18.13, north: 59.37 };

    it('en stadsvy ger en handfull rutor', () => {
        const t = tilesForBounds(sthlm)!;
        expect(t).toContain('118_18');
        expect(t.length).toBeGreaterThanOrEqual(1);
        expect(t.length).toBeLessThanOrEqual(4);
    });

    it('samma stad = samma rutor oavsett exakt vy (det är det CDN:en lever på)', () => {
        const nudged = { west: 18.0, south: 59.3, east: 18.12, north: 59.36 };
        expect(tilesForBounds(nudged)).toEqual(tilesForBounds(sthlm));
    });

    it('marginalen tar med grannrutan när vyn ligger nära kanten', () => {
        // Vy precis söder om 59,5-kanten: utan marginal en rutrad, med två.
        const nearEdge = { west: 18.2, south: 59.38, east: 18.4, north: 59.48 };
        expect(tilesForBounds(nearEdge, 0)).toEqual(['118_18']);
        expect(tilesForBounds(nearEdge)).toContain('119_18');
    });

    it('hela Sverige i bild → null (hämta landslagret)', () => {
        expect(tilesForBounds({ west: 10, south: 55, east: 24, north: 69 })).toBeNull();
    });

    it('precis vid taket: MAX_AREA_TILES rutor godtas, en till gör det inte', () => {
        // 5 × 5 rutor utan marginal.
        const b = { west: 14.01, south: 57.01, east: 18.99, north: 59.49 };
        expect(tilesForBounds(b, 0)!.length).toBe(MAX_AREA_TILES);
        expect(tilesForBounds(b, 0, MAX_AREA_TILES - 1)).toBeNull();
    });

    it('vy utanför rutområdet → inga rutor (inte "hela landet")', () => {
        expect(tilesForBounds({ west: -20, south: 30, east: -10, north: 35 })).toEqual([]);
    });

    it('ogiltig vy → null', () => {
        expect(tilesForBounds({ west: NaN, south: 59, east: 18, north: 60 })).toBeNull();
        expect(tilesForBounds({ west: 18, south: 60, east: 17, north: 59 })).toBeNull();
    });
});

describe('boundsCoveredBy', () => {
    const view = { west: 17.9, south: 59.3, east: 18.2, north: 59.4 };

    it('täckt först när VARJE ruta vyn rör är laddad', () => {
        expect(boundsCoveredBy(view, new Set(['118_18']))).toBe(false);   // 17,9 ligger i 118_17
        expect(boundsCoveredBy(view, new Set(['118_17', '118_18']))).toBe(true);
    });

    it('inget laddat → inte täckt', () => {
        expect(boundsCoveredBy(view, new Set())).toBe(false);
    });
});

describe('descBucketFor / parseDescBucket', () => {
    it('hinken är stabil och inom [0, DESC_BUCKETS)', () => {
        const id = 'https://www.example.se/evenemang/konsert-1';
        const b = descBucketFor(id);
        expect(b).toBe(descBucketFor(id));
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThan(DESC_BUCKETS);
    });

    it('sprider eventen jämnt nog — ingen hink blir ett nytt helt lager', () => {
        const counts = new Array(DESC_BUCKETS).fill(0);
        for (let i = 0; i < 50_000; i++) counts[descBucketFor(`https://kalender.se/e/${i}`)]++;
        const mean = 50_000 / DESC_BUCKETS;
        expect(Math.max(...counts)).toBeLessThan(mean * 1.6);
        expect(Math.min(...counts)).toBeGreaterThan(mean * 0.5);
    });

    it('parseDescBucket godtar bara kanoniska heltal i intervallet', () => {
        expect(parseDescBucket('0')).toBe(0);
        expect(parseDescBucket('511')).toBe(511);
        expect(parseDescBucket(String(DESC_BUCKETS))).toBeNull();
        expect(parseDescBucket('007')).toBeNull();
        expect(parseDescBucket('-1')).toBeNull();
        expect(parseDescBucket('1.5')).toBeNull();
        expect(parseDescBucket(undefined)).toBeNull();
    });
});

describe('circleBounds / unionBounds', () => {
    it('60 km runt Stockholm ger ±0,54° lat och bredare i lng (meridianerna möts)', () => {
        const b = circleBounds(59.33, 18.07, 60);
        expect(b.north - 59.33).toBeCloseTo(0.539, 2);
        expect(b.east - 18.07).toBeGreaterThan(1);
        expect(b.east - 18.07).toBeLessThan(1.1);
    });

    it('veckocirkeln runt en stad ryms i rutläget (inte landslagret)', () => {
        for (const [lat, lng] of [[59.33, 18.07], [57.71, 11.97], [55.6, 13.0], [65.58, 22.15], [67.86, 20.23]]) {
            expect(tilesForBounds(circleBounds(lat, lng, 60), 0)).not.toBeNull();
        }
    });

    it('unionBounds rymmer båda', () => {
        expect(unionBounds({ west: 1, south: 2, east: 3, north: 4 }, { west: 0, south: 3, east: 5, north: 3.5 }))
            .toEqual({ west: 0, south: 2, east: 5, north: 4 });
    });
});

describe('composeAreaRows', () => {
    type Row = { id?: string; time: string; lat?: number; lng?: number; title?: string };
    const sthlmToday: Row = { id: 's1', time: '2026-10-03T16:00:00.000Z', lat: 59.33, lng: 18.07, title: 'gammal' };
    const gbgToday: Row = { id: 'g1', time: '2026-10-03T15:00:00.000Z', lat: 57.71, lng: 11.97 };
    const sthlmTile: Row[] = [
        { id: 's1', time: '2026-10-03T16:00:00.000Z', lat: 59.33, lng: 18.07, title: 'färsk' },
        { id: 's2', time: '2026-10-05T16:00:00.000Z', lat: 59.33, lng: 18.07 },
    ];

    it('rutans rader ersätter dagsslicen INOM rutan; dagens prickar utanför ligger kvar', () => {
        const out = composeAreaRows([sthlmToday, gbgToday], [['118_18', sthlmTile]]);
        expect(out.map((r) => r.id)).toEqual(['g1', 's1', 's2']);
        expect(out.find((r) => r.id === 's1')?.title).toBe('färsk');
    });

    it('en tom laddad ruta tar bort dagsslicens rader där (rutan är sanningen)', () => {
        const out = composeAreaRows([sthlmToday, gbgToday], [['118_18', []]]);
        expect(out.map((r) => r.id)).toEqual(['g1']);
    });

    it('samma event i två rutsvar (gammal server ignorerar ?tile=) räknas en gång', () => {
        const out = composeAreaRows([], [['118_18', sthlmTile], ['118_17', sthlmTile]]);
        expect(out.map((r) => r.id)).toEqual(['s1', 's2']);
    });

    it('rader utan id hoppas över', () => {
        expect(composeAreaRows([{ time: 'x' }], [])).toEqual([]);
    });
});
