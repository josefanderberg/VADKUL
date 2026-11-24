import { describe, expect, it } from 'vitest';
import type * as maplibregl from 'maplibre-gl';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import {
    addPoiSigns, BAD_SIGN_LAYER_ID, BAD_SIGN_MIN_ZOOM, BAD_SIGN_SOURCE_ID, POI_SIGN_DEEP_MIN_ZOOM, POI_SIGN_DEEP_NAME_ZOOM, POI_SIGN_LAYER_ID, POI_SIGN_MIN_ZOOM,
    POI_SIGN_NAME_ZOOM, POI_SIGNS,
    POI_SIGN_CLOSE_LAYER_ID, POI_SIGN_CLOSE_MIN_ZOOM, POI_SIGN_HIT, POI_SIGN_LABELS, POI_SIGN_LAYER_IDS, POI_SIGN_NEAR_KEYS, POI_SIGN_NEAR_LAYER_ID, POI_SIGN_NEAR_MIN_ZOOM, pickPoiSignHit, poiSignInfo, poiSignKeyForKind,
    poiSignImageId, poiSignKeyFromImageId, type PoiSignKey,
} from './mapPoiSigns';
import { DEEP_POI_KINDS, DEEP_SOURCE_ID, deepLayersFor } from './deepTiles';
import { addZoomedOutLandcover } from './mapLandcover';
import { POI_SIGN_PICTOGRAMS } from './poiSignPictograms';

const FONT = ['Montserrat SemiBold', 'Open Sans Bold'];
// Voyager i miniatyr: etikettlagren i samma ordning som den riktiga stilen.
function voyagerLike(): maplibregl.StyleSpecification {
    return {
        version: 8,
        glyphs: 'https://example.invalid/{fontstack}/{range}.pbf',
        sources: { protomaps: { type: 'vector', tiles: ['https://example.invalid/{z}/{x}/{y}.mvt'] } },
        layers: [
            { id: 'background', type: 'background' },
            { id: 'water', type: 'fill', source: 'protomaps', 'source-layer': 'water' },
            { id: 'watername_lake', type: 'symbol', source: 'protomaps', 'source-layer': 'water', layout: { 'text-field': ['get', 'name'], 'text-font': FONT } },
            { id: 'place_hamlet', type: 'symbol', source: 'protomaps', 'source-layer': 'places', layout: { 'text-field': ['get', 'name'], 'text-font': FONT } },
            { id: 'place_town', type: 'symbol', source: 'protomaps', 'source-layer': 'places', layout: { 'text-field': ['get', 'name'], 'text-font': FONT } },
            { id: 'poi_park', type: 'symbol', source: 'protomaps', 'source-layer': 'pois', minzoom: 15, layout: { 'text-field': ['get', 'name'], 'text-font': FONT } },
            { id: 'roadname_minor', type: 'symbol', source: 'protomaps', 'source-layer': 'roads', layout: { 'text-field': ['get', 'name'], 'text-font': FONT } },
        ],
    };
}
const färdig = () => { const s = voyagerLike(); addPoiSigns(s); return s; };
const skyltlager = (s: maplibregl.StyleSpecification) =>
    s.layers.find(l => l.id === POI_SIGN_LAYER_ID) as maplibregl.SymbolLayerSpecification;
// Värdet ett match-uttryck ger en viss kind (grenarna är [kinds[], värde]-par).
function matchFor(uttryck: unknown, kind: string): unknown {
    const m = uttryck as unknown[];
    for (let i = 2; i < m.length - 1; i += 2) if ((m[i] as string[]).includes(kind)) return m[i + 1];
    return m[m.length - 1];
}

// #216, Josef 13/11: "bollplaner, parker, lekplatser, naturreservat, bibliotek,
// museer, golfbanor ... badplatser också ... tecknade vägskyltar som visas när
// man zoomar in ganska nära".
describe('platsskyltarna', () => {
    it('har en skylt för var och en av platstyperna Josef räknade upp', () => {
        // Plus aktivitetsställena från #231 (bio, teater, arena, idrottsanläggning)
        // och matställena från #242 (restaurang, kafé).
        expect(Object.keys(POI_SIGNS).sort()).toEqual(['arena', 'bad', 'bibliotek', 'bio', 'bollplan', 'golf', 'idrott', 'kafe', 'lekplats', 'museum', 'naturreservat', 'park', 'restaurang', 'teater']);
        // Badplatser finns under flera namn i kaklen.
        expect(POI_SIGNS.bad.kinds).toEqual(expect.arrayContaining(['bathing_place', 'public_bath', 'beach']));
    });

    it('ingen kind hör till två skyltar och varje skylt har en egen symbol', () => {
        const kinds = Object.values(POI_SIGNS).flatMap(s => [...s.kinds]);
        expect(new Set(kinds).size).toBe(kinds.length);
        // #225: vägmärkenas svarta motiv, inga emojier.
        expect(Object.keys(POI_SIGN_PICTOGRAMS).sort()).toEqual(Object.keys(POI_SIGNS).sort());
        const motiv = Object.values(POI_SIGN_PICTOGRAMS).map(p => JSON.stringify(p.shapes));
        expect(new Set(motiv).size).toBe(motiv.length);
        for (const p of Object.values(POI_SIGN_PICTOGRAMS)) {
            expect(p.box[2]).toBeGreaterThan(0);
            expect(p.shapes.length).toBeGreaterThan(0);
            // Varje bana börjar med en förflyttning inom motivets ruta (det vita fältet).
            for (const shape of p.shapes) {
                const start = /^[Mm]\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/.exec(shape.d);
                expect(start).not.toBeNull();
                const [x, y] = [Number(start![1]), Number(start![2])];
                expect(x).toBeGreaterThanOrEqual(p.box[0]);
                expect(x).toBeLessThanOrEqual(p.box[0] + p.box[2]);
                expect(y).toBeGreaterThanOrEqual(p.box[1]);
                expect(y).toBeLessThanOrEqual(p.box[1] + p.box[2]);
            }
        }
    });

    it('badplats, golfbana, sevärdhet och friluftsområde bär vägmärkenas egna motiv', () => {
        // Josef 13/11: "det ska ju vara exakt kopior" - rita inte om dem för hand.
        expect(POI_SIGN_PICTOGRAMS.bad.original).toBe('H15');
        expect(POI_SIGN_PICTOGRAMS.naturreservat.original).toBe('H16');
        expect(POI_SIGN_PICTOGRAMS.golf.original).toBe('H20');
        expect(POI_SIGN_PICTOGRAMS.museum.original).toBe('H22');
        // #242: restaurang och servering (kafé) finns också som servicemärken.
        expect(POI_SIGN_PICTOGRAMS.restaurang.original).toBe('H6');
        expect(POI_SIGN_PICTOGRAMS.kafe.original).toBe('H5');
        // Alla original ligger i vägmärkesfilernas gemensamma vita fält.
        for (const p of Object.values(POI_SIGN_PICTOGRAMS)) {
            if (p.original) expect(p.box).toEqual(POI_SIGN_PICTOGRAMS.bad.box);
        }
    });

    it('aktivitetsställena har egna motiv i samma stil, inga påhittade vägmärken (#231)', () => {
        // Bio, teater, arena och idrottsanläggning finns inte bland servicemärkena.
        for (const key of ['bio', 'teater', 'arena', 'idrott'] as const) {
            expect(POI_SIGN_PICTOGRAMS[key].original).toBeUndefined();
            expect(POI_SIGN_PICTOGRAMS[key].box).toEqual([0, 0, 24]);
            expect(POI_SIGN_LABELS[key]).toBeTruthy();
        }
        expect(POI_SIGN_LABELS.idrott).toBe('Idrottsanläggning');
        expect(POI_SIGNS.idrott.kinds).toEqual(expect.arrayContaining(['sports_centre', 'sports_hall', 'ice_rink']));
    });

    it('bild-id:t går att läsa tillbaka, och främmande bilder är inte våra', () => {
        for (const key of Object.keys(POI_SIGNS) as PoiSignKey[]) {
            expect(poiSignKeyFromImageId(poiSignImageId(key))).toBe(key);
        }
        expect(poiSignKeyFromImageId('circle-11')).toBeNull();
        expect(poiSignKeyFromImageId('vadkul-skylt-okänd')).toBeNull();
    });
});

describe('addPoiSigns', () => {
    it('lägger skyltarna under ortsnamnen (som vinner en krock) och över sjönamnen', () => {
        expect(färdig().layers.map(l => l.id)).toEqual([
            'background', 'water', 'watername_lake', POI_SIGN_CLOSE_LAYER_ID, POI_SIGN_NEAR_LAYER_ID, POI_SIGN_LAYER_ID,
            'place_hamlet', 'place_town', 'poi_park', 'roadname_minor',
        ]);
    });

    it('ritar ur baskartans pois-lager, först när man zoomat in nära', () => {
        const l = skyltlager(färdig());
        expect(l).toMatchObject({ type: 'symbol', source: 'protomaps', 'source-layer': 'pois', minzoom: POI_SIGN_MIN_ZOOM });
        // Stadslandningen (~10,5) och stadssidornas kartor (11) har inga skyltar.
        expect(POI_SIGN_MIN_ZOOM).toBeGreaterThanOrEqual(12.5);
    });

    it('filtret släpper bara igenom platstyperna med skylt', () => {
        const s = färdig();
        // Utan badplatsfil (servern, testerna) finns inget badlager - baden kommer ur kaklen.
        const kinds = POI_SIGN_LAYER_IDS.filter(id => s.layers.some(l => l.id === id)).flatMap(id => {
            const filter = (s.layers.find(l => l.id === id) as maplibregl.SymbolLayerSpecification).filter as unknown[];
            // ['match', ['get', 'kind'], [kinds], true, false] (kontraktets poiSigns).
            return filter[2] as string[];
        });
        expect(kinds.sort()).toEqual(Object.values(POI_SIGNS).flatMap(s => [...s.kinds]).sort());
        for (const inte of ['bar', 'supermarket', 'crossing', 'parking', 'school']) expect(kinds).not.toContain(inte);
    });

    it('lekplatser, idrottsplaner, parker och idrottsanläggningar tänds först på kvartersnivå (#225, #231)', () => {
        // Josef 13/11: "eller brir det för stökigt med massa skyltar?"
        const s = färdig();
        const kindsIn = (id: string) => ((s.layers.find(l => l.id === id) as maplibregl.SymbolLayerSpecification).filter as unknown[])[2] as string[];
        // Idrottsanläggningarna kom med i #231 (Josef 14/11: "Ja, nära lagret").
        const nära = ['ice_rink', 'park', 'pitch', 'playground', 'sports_centre', 'sports_hall'];
        expect(kindsIn(POI_SIGN_NEAR_LAYER_ID).sort()).toEqual(nära);
        for (const kind of nära) expect(kindsIn(POI_SIGN_LAYER_ID)).not.toContain(kind);
        expect(kindsIn(POI_SIGN_LAYER_ID)).toEqual(expect.arrayContaining(
            ['bathing_place', 'nature_reserve', 'golf_course', 'museum', 'library', 'cinema', 'theatre', 'stadium']));
        const near = s.layers.find(l => l.id === POI_SIGN_NEAR_LAYER_ID) as maplibregl.SymbolLayerSpecification;
        expect(near.minzoom).toBe(POI_SIGN_NEAR_MIN_ZOOM);
        expect(POI_SIGN_NEAR_MIN_ZOOM).toBeGreaterThan(POI_SIGN_MIN_ZOOM);
        expect([...POI_SIGN_NEAR_KEYS].sort()).toEqual(['bollplan', 'idrott', 'lekplats', 'park']);
        expect(POI_SIGN_LAYER_IDS).toEqual([BAD_SIGN_LAYER_ID, POI_SIGN_LAYER_ID, POI_SIGN_NEAR_LAYER_ID, POI_SIGN_CLOSE_LAYER_ID]);
    });

    it('restauranger och kaféer tänds först på gatunivå, zoom 16 (#242)', () => {
        // Josef 15/11: "Ja, lägg ut dem" - med vanliga vägmärket, från zoom 16.
        const s = färdig();
        const close = s.layers.find(l => l.id === POI_SIGN_CLOSE_LAYER_ID) as maplibregl.SymbolLayerSpecification;
        expect(close).toMatchObject({ type: 'symbol', source: 'protomaps', 'source-layer': 'pois', minzoom: POI_SIGN_CLOSE_MIN_ZOOM });
        expect(POI_SIGN_CLOSE_MIN_ZOOM).toBe(16);
        expect(((close.filter as unknown[])[2] as string[]).sort()).toEqual(['cafe', 'fast_food', 'restaurant']);
        // Kartans källa slutar vid kakelzoom 15, där matställena finns.
        expect(matchFor(close.layout?.['icon-image'], 'restaurant')).toBe(poiSignImageId('restaurang'));
        expect(matchFor(close.layout?.['icon-image'], 'fast_food')).toBe(poiSignImageId('restaurang'));
        expect(matchFor(close.layout?.['icon-image'], 'cafe')).toBe(poiSignImageId('kafe'));
    });

    it('varje platstyp får sin egen skyltbild', () => {
        const bild = skyltlager(färdig()).layout?.['icon-image'];
        expect(matchFor(bild, 'bathing_place')).toBe(poiSignImageId('bad'));
        expect(matchFor(bild, 'beach')).toBe(poiSignImageId('bad'));
        expect(matchFor(bild, 'museum')).toBe(poiSignImageId('museum'));
        expect(matchFor(bild, 'playground')).toBe(poiSignImageId('lekplats'));
        expect(matchFor(bild, 'cinema')).toBe(poiSignImageId('bio'));
        expect(matchFor(bild, 'theatre')).toBe(poiSignImageId('teater'));
        expect(matchFor(bild, 'stadium')).toBe(poiSignImageId('arena'));
        expect(matchFor(bild, 'ice_rink')).toBe(poiSignImageId('idrott'));
        expect(matchFor(bild, 'supermarket')).toBe('');
    });

    it('badplatsen går före parken när två skyltar krockar', () => {
        const ordning = skyltlager(färdig()).layout?.['symbol-sort-key'];
        expect(matchFor(ordning, 'bathing_place')).toBeLessThan(matchFor(ordning, 'park') as number);
    });

    it('namnet kommer först närmare in, och skylten står kvar om namnet inte får plats', () => {
        const layout = skyltlager(färdig()).layout!;
        const text = layout['text-field'] as unknown[];
        expect(text.slice(0, 4)).toEqual(['step', ['zoom'], '', POI_SIGN_NAME_ZOOM]);
        expect(POI_SIGN_NAME_ZOOM).toBeGreaterThan(POI_SIGN_MIN_ZOOM);
        expect(layout['text-optional']).toBe(true);
        expect(layout['text-font']).toEqual(FONT);
    });

    it('Voyagers egna parknamn göms - skylten bär namnet', () => {
        const park = färdig().layers.find(l => l.id === 'poi_park') as maplibregl.SymbolLayerSpecification;
        expect(park.layout?.visibility).toBe('none');
    });

    it('ger en giltig stil, läggs inte till två gånger och rör inget utan vektorkälla', () => {
        const s = färdig();
        expect(validateStyleMin(s)).toEqual([]);
        addPoiSigns(s);
        expect(s.layers.filter(l => l.id === POI_SIGN_LAYER_ID)).toHaveLength(1);
        const tom: maplibregl.StyleSpecification = { version: 8, sources: {}, layers: [{ id: 'background', type: 'background' }] };
        addPoiSigns(tom);
        expect(tom.layers).toHaveLength(1);
    });
});

// #222, Josef 13/11: "så man ser mer detaljer när man zoomar ut än man
// vanligtvis hade gjort" - skyltarna ett zoomsteg tidigare via djupare kakel.
describe('skyltarna ur de djupare kaklen', () => {
    const medDjupKälla = () => {
        const s = voyagerLike();
        s.layers.splice(1, 0, { id: 'landuse', type: 'fill', source: 'protomaps', 'source-layer': 'landuse' });
        addZoomedOutLandcover(s);
        addPoiSigns(s);
        return s;
    };

    it('finns den djupa källan hämtas skyltarna därifrån och syns ett zoomsteg tidigare', () => {
        const s = medDjupKälla();
        expect(s.sources[DEEP_SOURCE_ID]).toBeDefined();
        const l = skyltlager(s);
        expect(l).toMatchObject({ source: DEEP_SOURCE_ID, 'source-layer': 'pois', minzoom: POI_SIGN_DEEP_MIN_ZOOM });
        expect(POI_SIGN_DEEP_MIN_ZOOM).toBe(POI_SIGN_MIN_ZOOM - 1);
        expect((l.layout!['text-field'] as unknown[])[3]).toBe(POI_SIGN_DEEP_NAME_ZOOM);
        expect(validateStyleMin(s)).toEqual([]);
    });

    it('kaklen som hämtas vid skyltarnas startzoom bär platserna', () => {
        // Kartzoom 12 -> källkakel z12 -> barn z13.
        expect(Object.keys(deepLayersFor(POI_SIGN_DEEP_MIN_ZOOM + 1))).toEqual(['pois']);
    });

    it('det hopslagna kaklet har exakt skyltarnas platstyper', () => {
        expect([...DEEP_POI_KINDS].sort()).toEqual(Object.values(POI_SIGNS).flatMap(x => [...x.kinds]).sort());
    });

    it('utan djup källa ritas skyltarna ur baskartan från zoom 13, som förut', () => {
        expect(skyltlager(färdig())).toMatchObject({ source: 'protomaps', minzoom: POI_SIGN_MIN_ZOOM });
        expect((skyltlager(färdig()).layout!['text-field'] as unknown[])[3]).toBe(POI_SIGN_NAME_ZOOM);
    });

describe('tryck på en skylt (#225)', () => {
    it('namnlösa platser får platstypen under skylten', () => {
        const style = { version: 8, sources: { bas: { type: 'vector', tiles: ['https://x/{z}/{x}/{y}.mvt'] } }, layers: [
            { id: 'water', type: 'fill', source: 'bas', 'source-layer': 'water' },
        ] } as unknown as maplibregl.StyleSpecification;
        addPoiSigns(style);
        const layer = style.layers.find(l => l.id === POI_SIGN_LAYER_ID) as maplibregl.SymbolLayerSpecification;
        const field = JSON.stringify(layer.layout?.['text-field']);
        expect(field).toContain('["coalesce",["get","name"],["match",["get","kind"]');
        for (const label of Object.values(POI_SIGN_LABELS)) expect(field).toContain(label);
    });

    it('varje skylt har ett namn i klartext', () => {
        expect(Object.keys(POI_SIGN_LABELS).sort()).toEqual(Object.keys(POI_SIGNS).sort());
        expect(POI_SIGN_LABELS.bad).toBe('Badplats');
        expect(POI_SIGN_LABELS.naturreservat).toBe('Naturreservat');
    });

    it('kind ur kaklen blir platstyp och namn, namnlösa får bara typen', () => {
        expect(poiSignInfo('beach', ' Evedal ')).toEqual({ key: 'bad', type: 'Badplats', name: 'Evedal' });
        expect(poiSignInfo('nature_reserve', 'Bokhultet')).toEqual({ key: 'naturreservat', type: 'Naturreservat', name: 'Bokhultet' });
        expect(poiSignInfo('playground', undefined)).toEqual({ key: 'lekplats', type: 'Lekplats', name: null });
        expect(poiSignInfo('playground', '  ')?.name).toBeNull();
        expect(poiSignInfo('restaurant', 'Pizzeria')).toEqual({ key: 'restaurang', type: 'Restaurang', name: 'Pizzeria' });
        expect(poiSignInfo('supermarket', 'Coop')).toBeNull();
        expect(poiSignInfo(undefined, 'x')).toBeNull();
        expect(poiSignKeyForKind('golf_course')).toBe('golf');
    });

    it('trycket träffar skylten ovanför foten, inte långt vid sidan eller under', () => {
        const foot = { x: 100, y: 200 };
        expect(pickPoiSignHit([foot], { x: 100, y: 175 })).toBe(0); // mitt på plattan
        expect(pickPoiSignHit([foot], { x: 100, y: 210 })).toBe(0); // på namnet under
        expect(pickPoiSignHit([foot], { x: 100 + POI_SIGN_HIT.halfWidth + 1, y: 175 })).toBeNull();
        expect(pickPoiSignHit([foot], { x: 100, y: 200 - POI_SIGN_HIT.above - 1 })).toBeNull();
        expect(pickPoiSignHit([foot], { x: 100, y: 200 + POI_SIGN_HIT.below + 1 })).toBeNull();
        expect(pickPoiSignHit([], { x: 100, y: 175 })).toBeNull();
    });

    it('av två skyltar vinner den vars platta ligger närmast, skräpträffar långt bort räknas inte', () => {
        const feet = [{ x: 100, y: 200 }, { x: 130, y: 205 }, { x: 900, y: 40 }];
        expect(pickPoiSignHit(feet, { x: 104, y: 178 })).toBe(0);
        expect(pickPoiSignHit(feet, { x: 128, y: 180 })).toBe(1);
        expect(pickPoiSignHit([{ x: 900, y: 40 }], { x: 104, y: 178 })).toBeNull();
    });
});
});

// #279, Josef 22/11: "badplatser syns bara när man zoomar in jättemycket. Fixa
// så det är mycket högre upp synligt." - egen fil, badskylten från zoom 12
// (zoom 9 först, 10 den 23/11 i #281, 12 som resmålen 24/11 i #284).
describe('badplatserna ur badplatsfilen', () => {
    const medFil = (djup: boolean) => {
        const s = voyagerLike();
        if (djup) {
            s.layers.splice(1, 0, { id: 'landuse', type: 'fill', source: 'protomaps', 'source-layer': 'landuse' });
            addZoomedOutLandcover(s);
        }
        addPoiSigns(s, 'https://vadkul.se');
        return s;
    };
    const lagret = (s: maplibregl.StyleSpecification, id: string) =>
        s.layers.find(l => l.id === id) as maplibregl.SymbolLayerSpecification;
    const kindsIn = (s: maplibregl.StyleSpecification, id: string) => (lagret(s, id).filter as unknown[])[2] as string[];

    it('hämtar filen med hel adress och tänder badskylten från zoom 12, samma som resmålen', () => {
        const s = medFil(false);
        expect(s.sources[BAD_SIGN_SOURCE_ID]).toEqual({ type: 'geojson', data: 'https://vadkul.se/badplatser.json' });
        expect(lagret(s, BAD_SIGN_LAYER_ID)).toMatchObject({ type: 'symbol', source: BAD_SIGN_SOURCE_ID, minzoom: 12 });
        expect(BAD_SIGN_MIN_ZOOM).toBe(POI_SIGN_DEEP_MIN_ZOOM);
        expect(validateStyleMin(s)).toEqual([]);
    });

    it('kaklen bär inga bad när filen används, med eller utan djup källa - aldrig två skyltar på samma bad', () => {
        for (const djup of [false, true]) {
            const s = medFil(djup);
            for (const kind of ['bathing_place', 'beach', 'public_bath']) {
                expect(kindsIn(s, POI_SIGN_LAYER_ID)).not.toContain(kind);
                expect(kindsIn(s, BAD_SIGN_LAYER_ID)).toContain(kind);
            }
            // Alla platstyper finns fortfarande i exakt ett lager.
            const alla = POI_SIGN_LAYER_IDS.flatMap(id => kindsIn(s, id));
            expect(alla.sort()).toEqual(Object.values(POI_SIGNS).flatMap(x => [...x.kinds]).sort());
            expect(validateStyleMin(s)).toEqual([]);
        }
    });

    it('badlagret ligger överst bland skyltarna och under ortsnamnen', () => {
        const ids = medFil(false).layers.map(l => l.id);
        expect(ids.indexOf(BAD_SIGN_LAYER_ID)).toBe(ids.indexOf(POI_SIGN_LAYER_ID) + 1);
        expect(ids.indexOf(BAD_SIGN_LAYER_ID)).toBeLessThan(ids.indexOf('place_hamlet'));
    });
});
