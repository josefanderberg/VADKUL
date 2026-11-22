import { describe, expect, it } from 'vitest';
import { dedupeBadplatser, parseOverpass, toBadplatsGeoJSON, type Badplats } from './badplatser';

describe('parseOverpass', () => {
    it('läser noder, ytor (center) och de tre platstyperna', () => {
        const list = parseOverpass({
            elements: [
                { type: 'node', id: 1, lat: 56.87, lon: 14.8, tags: { leisure: 'bathing_place', name: ' Evedal ' } },
                { type: 'way', id: 2, center: { lat: 56.0, lon: 12.7 }, tags: { natural: 'beach' } },
                { type: 'relation', id: 3, center: { lat: 59.3, lon: 18.0 }, tags: { amenity: 'public_bath', name: 'Centralbadet' } },
            ],
        });
        expect(list).toEqual([
            { id: 'n1', kind: 'bathing_place', name: 'Evedal', lat: 56.87, lon: 14.8 },
            { id: 'w2', kind: 'beach', name: null, lat: 56.0, lon: 12.7 },
            { id: 'r3', kind: 'public_bath', name: 'Centralbadet', lat: 59.3, lon: 18.0 },
        ]);
    });

    it('hoppar över element utan plats eller utan badtyp, och trasiga svar', () => {
        expect(parseOverpass({
            elements: [
                { type: 'way', id: 4, tags: { natural: 'beach' } },
                { type: 'node', id: 5, lat: 56, lon: 14, tags: { leisure: 'park' } },
                { type: 'node', id: 6, lat: NaN, lon: 14, tags: { natural: 'beach' } },
            ],
        })).toEqual([]);
        expect(parseOverpass(null)).toEqual([]);
        expect(parseOverpass({ remark: 'runtime error: timeout' })).toEqual([]);
    });
});

const plats = (id: string, kind: Badplats['kind'], name: string | null, lat: number, lon: number): Badplats =>
    ({ id, kind, name, lat, lon });

describe('dedupeBadplatser', () => {
    it('slår ihop en strand och badplatsnoden på den, namnet vinner', () => {
        const kvar = dedupeBadplatser([
            plats('w10', 'beach', null, 56.87, 14.8),
            plats('n11', 'bathing_place', 'Evedal', 56.8705, 14.8005),
        ]);
        expect(kvar.map(p => p.id)).toEqual(['n11']);
    });

    it('utan namn går badplats före strand före badhus', () => {
        const kvar = dedupeBadplatser([
            plats('r1', 'public_bath', null, 57, 15),
            plats('w2', 'beach', null, 57.0003, 15),
            plats('n3', 'bathing_place', null, 57, 15.0003),
        ]);
        expect(kvar.map(p => p.id)).toEqual(['n3']);
    });

    it('låter bad längre isär än gränsen stå var för sig', () => {
        const kvar = dedupeBadplatser([
            plats('n1', 'bathing_place', 'A', 56.87, 14.8),
            plats('n2', 'bathing_place', 'B', 56.873, 14.8), // ~330 m norrut
        ]);
        expect(kvar).toHaveLength(2);
    });

    it('hittar grannar i öst-väst även långt norrut', () => {
        // 120 m isär på 68 grader N = drygt 0,0028 longitudgrader.
        const kvar = dedupeBadplatser([
            plats('n1', 'bathing_place', 'Kiruna', 67.85, 20.2),
            plats('n2', 'beach', null, 67.85, 20.2 + 120 / (111000 * Math.cos(67.85 * Math.PI / 180))),
        ]);
        expect(kvar.map(p => p.id)).toEqual(['n1']);
    });

    it('ger samma fil oavsett ordningen i svaret', () => {
        const list = [
            plats('n9', 'bathing_place', null, 58, 16),
            plats('n2', 'beach', 'X', 59, 17),
            plats('w5', 'beach', null, 58.0001, 16.0001),
        ];
        expect(dedupeBadplatser(list)).toEqual(dedupeBadplatser([...list].reverse()));
    });
});

describe('toBadplatsGeoJSON', () => {
    it('skriver kaklens egenskaper och avrundar till fem decimaler', () => {
        expect(toBadplatsGeoJSON([
            plats('n1', 'bathing_place', 'Evedal', 56.8712345678, 14.80000001),
            plats('w2', 'beach', null, 56, 12.7),
        ])).toEqual({
            type: 'FeatureCollection',
            features: [
                { type: 'Feature', geometry: { type: 'Point', coordinates: [14.8, 56.87123] }, properties: { kind: 'bathing_place', name: 'Evedal' } },
                { type: 'Feature', geometry: { type: 'Point', coordinates: [12.7, 56] }, properties: { kind: 'beach' } },
            ],
        });
    });
});
