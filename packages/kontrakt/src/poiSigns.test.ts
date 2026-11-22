import { describe, expect, it } from 'vitest';
import {
    addPoiSignLayers, BAD_SIGN_LAYER_ID, BAD_SIGN_MIN_ZOOM, BAD_SIGN_SOURCE_ID, pickPoiSignHit, POI_SIGN_CLOSE_KEYS, POI_SIGN_CLOSE_LAYER_ID, POI_SIGN_CLOSE_MIN_ZOOM, POI_SIGN_HIT, POI_SIGN_KEYS, POI_SIGN_LABELS, POI_SIGN_LAYER_ID,
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
    it('har de fjorton skyltarna, var och en med namn i klartext och eget bild-id', () => {
        expect([...POI_SIGN_KEYS].sort()).toEqual(['arena', 'bad', 'bibliotek', 'bio', 'bollplan', 'golf', 'idrott', 'kafe', 'lekplats', 'museum', 'naturreservat', 'park', 'restaurang', 'teater']);
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
        expect(poiSignInfo('supermarket', 'Coop')).toBeNull();
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
    it('lägger matställenas, det nära och resmålens lager under ortsnamnen och gömmer Voyagers parknamn', () => {
        const s = voyagerLik();
        expect(addPoiSignLayers(s)).toBe(true);
        expect(s.layers!.map(l => l.id)).toEqual([
            'background', 'water', 'watername_lake', POI_SIGN_CLOSE_LAYER_ID, POI_SIGN_NEAR_LAYER_ID, POI_SIGN_LAYER_ID,
            'place_town', 'poi_park',
        ]);
        expect(lager(s, 'poi_park').layout?.visibility).toBe('none');
        // Trycket frågar alla lagren, även badlagret ur filen (#279).
        expect(POI_SIGN_LAYER_IDS).toEqual([BAD_SIGN_LAYER_ID, POI_SIGN_LAYER_ID, POI_SIGN_NEAR_LAYER_ID, POI_SIGN_CLOSE_LAYER_ID]);
        // Utan badfil: inget badlager, ingen källa - baden kommer ur kaklen som förut.
        expect(s.sources![BAD_SIGN_SOURCE_ID]).toBeUndefined();
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
        expect(kindsIn(near).sort()).toEqual(['ice_rink', 'park', 'pitch', 'playground', 'sports_centre', 'sports_hall']);
        expect([...POI_SIGN_NEAR_KEYS].sort()).toEqual(['bollplan', 'idrott', 'lekplats', 'park']);
        for (const nära of kindsIn(near)) expect(kindsIn(far)).not.toContain(nära);
        expect(matchFor(far.layout!['icon-image'], 'beach')).toBe(poiSignImageId('bad'));
        expect(matchFor(far.layout!['icon-image'], 'supermarket')).toBe('');
        // Badplatsen går före parken när två skyltar krockar.
        expect(matchFor(far.layout!['symbol-sort-key'], 'bathing_place'))
            .toBeLessThan(matchFor(far.layout!['symbol-sort-key'], 'park') as number);
    });

    // #231, Josef 14/11: "alla restauranger och sådana aktivitetställen också ...
    // så att man lätt hade kunnat se som sådana skyltar".
    it('aktivitetsställena: bio, teater och arena är resmål, idrottsanläggningarna tänds på kvartersnivå', () => {
        const s = voyagerLik();
        addPoiSignLayers(s);
        const kindsIn = (id: string) => (lager(s, id).filter as unknown[])[2] as string[];
        expect(kindsIn(POI_SIGN_LAYER_ID)).toEqual(expect.arrayContaining(['cinema', 'theatre', 'stadium']));
        // Josef 14/11 om idrottsanläggningarna: "Ja, nära lagret".
        for (const nära of ['sports_centre', 'sports_hall', 'ice_rink']) {
            expect(kindsIn(POI_SIGN_NEAR_LAYER_ID)).toContain(nära);
            expect(kindsIn(POI_SIGN_LAYER_ID)).not.toContain(nära);
        }
        expect(poiSignInfo('cinema', 'Palladium')).toEqual({ key: 'bio', type: 'Bio', name: 'Palladium' });
        expect(poiSignInfo('theatre', 'Växjö Teater')).toEqual({ key: 'teater', type: 'Teater', name: 'Växjö Teater' });
        expect(poiSignInfo('stadium', 'Ullevi')).toEqual({ key: 'arena', type: 'Arena', name: 'Ullevi' });
        // Ishallar, simhallar och klubblokaler ligger alla under samma skylt.
        expect(poiSignInfo('ice_rink', 'Växjö Ishall')).toEqual({ key: 'idrott', type: 'Idrottsanläggning', name: 'Växjö Ishall' });
        expect(poiSignKeyForKind('sports_centre')).toBe('idrott');
        expect(poiSignKeyForKind('sports_hall')).toBe('idrott');
        const bild = lager(s, POI_SIGN_NEAR_LAYER_ID).layout!['icon-image'];
        expect(matchFor(bild, 'sports_centre')).toBe(poiSignImageId('idrott'));
        // En namngiven idrottsanläggning vinner en krock mot lekplatsen bredvid,
        // och badplatsen går fortfarande före allt.
        const ordning = lager(s, POI_SIGN_NEAR_LAYER_ID).layout!['symbol-sort-key'];
        expect(matchFor(ordning, 'sports_centre')).toBeLessThan(matchFor(ordning, 'playground') as number);
        expect(matchFor(ordning, 'bathing_place')).toBeLessThan(matchFor(ordning, 'cinema') as number);
    });

    // #242, Josef 15/11 på frågan om restauranger och kaféer ska ut nu med
    // vanliga vägmärket från zoom 16: "Ja, lägg ut dem".
    it('matställena: restauranger och kaféer i ett tredje lager som tänds först vid zoom 16', () => {
        const s = voyagerLik();
        addPoiSignLayers(s);
        const kindsIn = (id: string) => (lager(s, id).filter as unknown[])[2] as string[];
        const close = lager(s, POI_SIGN_CLOSE_LAYER_ID);
        expect(close).toMatchObject({ type: 'symbol', source: 'protomaps', 'source-layer': 'pois', minzoom: POI_SIGN_CLOSE_MIN_ZOOM });
        expect(POI_SIGN_CLOSE_MIN_ZOOM).toBe(16);
        expect(POI_SIGN_CLOSE_MIN_ZOOM).toBeGreaterThan(POI_SIGN_NEAR_MIN_ZOOM);
        expect(kindsIn(POI_SIGN_CLOSE_LAYER_ID).sort()).toEqual(['cafe', 'fast_food', 'restaurant']);
        expect([...POI_SIGN_CLOSE_KEYS].sort()).toEqual(['kafe', 'restaurang']);
        // Inget matställe i de andra lagren - där hade de dränkt stadsvyn.
        for (const kind of ['cafe', 'fast_food', 'restaurant']) {
            expect(kindsIn(POI_SIGN_LAYER_ID)).not.toContain(kind);
            expect(kindsIn(POI_SIGN_NEAR_LAYER_ID)).not.toContain(kind);
        }
        // Namnet står under skylten direkt, och skylten har full storlek.
        expect((close.layout!['text-field'] as unknown[])[0]).toBe('coalesce');
        expect(close.layout!['icon-size']).toEqual(['interpolate', ['linear'], ['zoom'], 15, 0.8, 16, 1]);
        expect(poiSignInfo('restaurant', 'La Castellina')).toEqual({ key: 'restaurang', type: 'Restaurang', name: 'La Castellina' });
        // Snabbmaten (pizzerior, hamburgerkedjor) bär restaurangskylten.
        expect(poiSignInfo('fast_food', 'Max')).toEqual({ key: 'restaurang', type: 'Restaurang', name: 'Max' });
        expect(poiSignInfo('cafe', 'Askelyckan')).toEqual({ key: 'kafe', type: 'Kafé', name: 'Askelyckan' });
        expect(matchFor(close.layout!['icon-image'], 'cafe')).toBe(poiSignImageId('kafe'));
        // Allt annat vinner en krock mot ett matställe.
        const ordning = close.layout!['symbol-sort-key'];
        for (const kind of ['bathing_place', 'cinema', 'sports_centre', 'playground', 'park']) {
            expect(matchFor(ordning, kind)).toBeLessThan(matchFor(ordning, 'restaurant') as number);
        }
    });

    // #279, Josef 22/11: "badplatser syns bara när man zoomar in jättemycket.
    // Fixa så det är mycket högre upp synligt." Han valde zoom 9 med egen fil.
    it('badplatsfilen: eget lager från zoom 9 överst, och kakellagret slutar bära bad', () => {
        const s = voyagerLik();
        expect(addPoiSignLayers(s, { badData: 'https://vadkul.se/badplatser.json', iconScale: 0.5 })).toBe(true);
        expect(BAD_SIGN_MIN_ZOOM).toBe(9);
        expect(s.sources![BAD_SIGN_SOURCE_ID]).toEqual({ type: 'geojson', data: 'https://vadkul.se/badplatser.json' });
        expect(s.layers!.map(l => l.id)).toEqual([
            'background', 'water', 'watername_lake',
            POI_SIGN_CLOSE_LAYER_ID, POI_SIGN_NEAR_LAYER_ID, POI_SIGN_LAYER_ID, BAD_SIGN_LAYER_ID,
            'place_town', 'poi_park',
        ]);
        const bad = lager(s, BAD_SIGN_LAYER_ID);
        // GeoJSON-källan har inget source-layer.
        expect(bad).toMatchObject({ type: 'symbol', source: BAD_SIGN_SOURCE_ID, minzoom: 9 });
        expect(bad['source-layer']).toBeUndefined();
        const kindsIn = (id: string) => (lager(s, id).filter as unknown[])[2] as string[];
        expect(kindsIn(BAD_SIGN_LAYER_ID).sort()).toEqual(['bathing_place', 'beach', 'public_bath']);
        for (const kind of ['bathing_place', 'beach', 'public_bath']) expect(kindsIn(POI_SIGN_LAYER_ID)).not.toContain(kind);
        expect(kindsIn(POI_SIGN_LAYER_ID)).toEqual(expect.arrayContaining(['museum', 'nature_reserve', 'golf_course']));
        expect(matchFor(bad.layout!['icon-image'], 'beach')).toBe(poiSignImageId('bad'));
        // Mindre skylt långt ute, full storlek inzoomat; namnet som resmålens.
        expect(bad.layout!['icon-size']).toEqual(['interpolate', ['linear'], ['zoom'], 9, 0.6 * 0.5, 13, 0.8 * 0.5, 16, 0.5]);
        expect((bad.layout!['text-field'] as unknown[]).slice(0, 4)).toEqual(['step', ['zoom'], '', POI_SIGN_NAME_ZOOM]);
        // Resmålens lager är oförändrat i övrigt.
        expect(lager(s, POI_SIGN_LAYER_ID).minzoom).toBe(POI_SIGN_MIN_ZOOM);
        // Startzoomen går att flytta.
        const t = voyagerLik();
        addPoiSignLayers(t, { badData: 'https://vadkul.se/badplatser.json', badMinZoom: 8 });
        expect(lager(t, BAD_SIGN_LAYER_ID).minzoom).toBe(8);
    });

    it('barer, pubar och gym har ingen skylt', () => {
        for (const kind of ['bar', 'pub', 'nightclub', 'fitness_centre', 'supermarket']) {
            expect(poiSignKeyForKind(kind)).toBeNull();
        }
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
        expect(lager(w, POI_SIGN_NEAR_LAYER_ID).minzoom).toBe(POI_SIGN_NEAR_MIN_ZOOM);
        expect(lager(w, POI_SIGN_CLOSE_LAYER_ID).minzoom).toBe(POI_SIGN_CLOSE_MIN_ZOOM);
    });

    it('kvarterets och matställenas startzoom går att flytta (appen tänder dem ett steg tidigare, #251)', () => {
        const s = voyagerLik();
        addPoiSignLayers(s, { nearMinZoom: 14, closeMinZoom: 15 });
        const near = lager(s, POI_SIGN_NEAR_LAYER_ID);
        const close = lager(s, POI_SIGN_CLOSE_LAYER_ID);
        expect(near.minzoom).toBe(14);
        expect(close.minzoom).toBe(15);
        // Storleken växer från lagrets egen startzoom.
        expect(near.layout!['icon-size']).toEqual(['interpolate', ['linear'], ['zoom'], 14, 0.8, 16, 1]);
        expect(close.layout!['icon-size']).toEqual(['interpolate', ['linear'], ['zoom'], 15, 0.8, 16, 1]);
        // Resmålen rörs inte av valen.
        expect(lager(s, POI_SIGN_LAYER_ID).minzoom).toBe(POI_SIGN_MIN_ZOOM);
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
