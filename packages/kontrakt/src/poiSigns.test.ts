import { describe, expect, it } from 'vitest';
import {
    addPoiSignLayers, pickPoiSignHit, POI_SIGN_HIT, POI_SIGN_KEYS, POI_SIGN_LABELS, POI_SIGN_LAYER_ID,
    POI_SIGN_LAYER_IDS, POI_SIGN_MIN_ZOOM, POI_SIGN_NAME_ZOOM, POI_SIGN_NEAR_KEYS, POI_SIGN_NEAR_LAYER_ID,
    POI_SIGN_NEAR_MIN_ZOOM, POI_SIGNS, poiSignImageId, poiSignInfo, poiSignKeyForKind, poiSignKeyFromImageId,
    type PoiSignStyle, type PoiSignStyleLayer,
} from './poiSigns';

// Skyltarna delas av webben och appen (#234). Lagrens form valideras dessutom
// mot MapLibres stilspec i webbens apps/web/src/utils/mapPoiSigns.test.ts.

const FONT = ['Montserrat SemiBold', 'Open Sans Bold'];
// Voyager i miniatyr: etikettlagren i samma ordning som den riktiga stilen.
function voyagerLik(): PoiSignStyle {
    return {
        sources: { protomaps: { type: 'vector' } },
        layers: [
            { id: 'background', type: 'background' },
            { id: 'water', type: 'fill', source: 'protomaps', 'source-layer': 'water' },
            { id: 'watername_lake', type: 'symbol', source: 'protomaps', 'source-layer': 'water', layout: { 'text-font': FONT } },
            { id: 'place_town', type: 'symbol', source: 'protomaps', 'source-layer': 'places', layout: { 'text-font': FONT } },
            { id: 'poi_park', type: 'symbol', source: 'protomaps', 'source-layer': 'pois', layout: { 'text-font': FONT } },
        ],
    };
}
const lager = (s: PoiSignStyle, id: string) => s.layers!.find(l => l.id === id) as PoiSignStyleLayer;
// Värdet ett match-uttryck ger en viss kind (grenarna är [kinds[], värde]-par).
function matchFor(uttryck: unknown, kind: string): unknown {
    const m = uttryck as unknown[];
    for (let i = 2; i < m.length - 1; i += 2) if ((m[i] as string[]).includes(kind)) return m[i + 1];
    return m[m.length - 1];
}

describe('platsskyltarna i kontraktet', () => {
    it('har de åtta skyltarna, var och en med namn i klartext och eget bild-id', () => {
        expect([...POI_SIGN_KEYS].sort()).toEqual(
            ['bad', 'bibliotek', 'bollplan', 'golf', 'lekplats', 'museum', 'naturreservat', 'park'].sort());
        expect(Object.keys(POI_SIGN_LABELS).sort()).toEqual([...POI_SIGN_KEYS].sort());
        for (const key of POI_SIGN_KEYS) expect(poiSignKeyFromImageId(poiSignImageId(key))).toBe(key);
        expect(poiSignKeyFromImageId('circle-11')).toBeNull();
        // Ingen kind hör till två skyltar.
        const kinds = Object.values(POI_SIGNS).flatMap(s => [...s.kinds]);
        expect(new Set(kinds).size).toBe(kinds.length);
    });

    it('kind ur kaklen blir platstyp och namn, namnlösa får bara typen', () => {
        expect(poiSignInfo('beach', ' Evedal ')).toEqual({ key: 'bad', type: 'Badplats', name: 'Evedal' });
        expect(poiSignInfo('playground', undefined)).toEqual({ key: 'lekplats', type: 'Lekplats', name: null });
        expect(poiSignInfo('restaurant', 'Pizzeria')).toBeNull();
        expect(poiSignKeyForKind('golf_course')).toBe('golf');
        expect(poiSignKeyForKind(7)).toBeNull();
    });

    it('trycket träffar skylten ovanför foten, och av två vinner den närmaste plattan', () => {
        const foot = { x: 100, y: 200 };
        expect(pickPoiSignHit([foot], { x: 100, y: 175 })).toBe(0);
        expect(pickPoiSignHit([foot], { x: 100 + POI_SIGN_HIT.halfWidth + 1, y: 175 })).toBeNull();
        expect(pickPoiSignHit([foot], { x: 100, y: 200 - POI_SIGN_HIT.above - 1 })).toBeNull();
        expect(pickPoiSignHit([foot], { x: 100, y: 200 + POI_SIGN_HIT.below + 1 })).toBeNull();
        expect(pickPoiSignHit([foot, { x: 130, y: 205 }], { x: 128, y: 180 })).toBe(1);
        expect(pickPoiSignHit([], { x: 100, y: 175 })).toBeNull();
    });
});

describe('addPoiSignLayers', () => {
    it('lägger det nära lagret och resmålens lager under ortsnamnen och gömmer Voyagers parknamn', () => {
        const s = voyagerLik();
        expect(addPoiSignLayers(s)).toBe(true);
        expect(s.layers!.map(l => l.id)).toEqual([
            'background', 'water', 'watername_lake', POI_SIGN_NEAR_LAYER_ID, POI_SIGN_LAYER_ID, 'place_town', 'poi_park',
        ]);
        expect(lager(s, 'poi_park').layout?.visibility).toBe('none');
        expect(POI_SIGN_LAYER_IDS).toEqual([POI_SIGN_LAYER_ID, POI_SIGN_NEAR_LAYER_ID]);
    });

    it('resmålen tänds vid zoom 13 med namn från 14,5, lekplats, plan och park först vid 15', () => {
        const s = voyagerLik();
        addPoiSignLayers(s);
        const far = lager(s, POI_SIGN_LAYER_ID);
        const near = lager(s, POI_SIGN_NEAR_LAYER_ID);
        expect(far).toMatchObject({ type: 'symbol', source: 'protomaps', 'source-layer': 'pois', minzoom: POI_SIGN_MIN_ZOOM });
        expect((far.layout!['text-field'] as unknown[]).slice(0, 4)).toEqual(['step', ['zoom'], '', POI_SIGN_NAME_ZOOM]);
        expect(far.layout!['text-font']).toEqual(FONT);
        expect(near.minzoom).toBe(POI_SIGN_NEAR_MIN_ZOOM);
        // Filtret är ett match-uttryck: ['match', ['get', 'kind'], [kinds], true, false].
        const kindsIn = (l: PoiSignStyleLayer) => (l.filter as unknown[])[2] as string[];
        expect((far.filter as unknown[]).slice(0, 2)).toEqual(['match', ['get', 'kind']]);
        expect((far.filter as unknown[]).slice(3)).toEqual([true, false]);
        expect(kindsIn(near).sort()).toEqual(['park', 'pitch', 'playground']);
        expect([...POI_SIGN_NEAR_KEYS].sort()).toEqual(['bollplan', 'lekplats', 'park']);
        for (const nära of kindsIn(near)) expect(kindsIn(far)).not.toContain(nära);
        expect(matchFor(far.layout!['icon-image'], 'beach')).toBe(poiSignImageId('bad'));
        expect(matchFor(far.layout!['icon-image'], 'restaurant')).toBe('');
        // Badplatsen går före parken när två skyltar krockar.
        expect(matchFor(far.layout!['symbol-sort-key'], 'bathing_place'))
            .toBeLessThan(matchFor(far.layout!['symbol-sort-key'], 'park') as number);
    });

    it('källa, zoomsteg och bildskala går att styra (webbens djupa kakel, appens bakade bilder)', () => {
        const s = voyagerLik();
        addPoiSignLayers(s, { source: 'djup', minZoom: 12, nameZoom: 13.5, iconScale: 0.4 });
        const far = lager(s, POI_SIGN_LAYER_ID);
        expect(far).toMatchObject({ source: 'djup', minzoom: 12 });
        expect((far.layout!['text-field'] as unknown[])[3]).toBe(13.5);
        expect(far.layout!['icon-size']).toEqual(['interpolate', ['linear'], ['zoom'], 12, 0.8 * 0.4, 16, 0.4]);
        // Utan skala: webbens mått.
        const w = voyagerLik();
        addPoiSignLayers(w);
        expect(lager(w, POI_SIGN_LAYER_ID).layout!['icon-size']).toEqual(['interpolate', ['linear'], ['zoom'], 13, 0.8, 16, 1]);
        expect(lager(w, POI_SIGN_NEAR_LAYER_ID).layout!['icon-size']).toEqual(['interpolate', ['linear'], ['zoom'], 15, 0.8, 16, 1]);
    });

    it('läggs inte till två gånger och rör inget utan vektorkälla', () => {
        const s = voyagerLik();
        addPoiSignLayers(s);
        expect(addPoiSignLayers(s)).toBe(false);
        expect(s.layers!.filter(l => l.id === POI_SIGN_LAYER_ID)).toHaveLength(1);
        const tom: PoiSignStyle = { sources: {}, layers: [{ id: 'background', type: 'background' }] };
        expect(addPoiSignLayers(tom)).toBe(false);
        expect(tom.layers).toHaveLength(1);
    });
});
