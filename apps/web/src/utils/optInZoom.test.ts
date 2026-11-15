import { describe, expect, it } from 'vitest';
import {
    INZOOM_SOURCE_KEYS,
    mapEventsFor,
    OPT_IN_MAP_MIN_ZOOM,
    optInSourcesOnMapAt,
    withInzoomSources,
} from './optInZoom';
import { classifySource, SOURCE_DEFS } from './sources';

describe('optInSourcesOnMapAt', () => {
    it('tänds från kvartersnivån och uppåt', () => {
        expect(optInSourcesOnMapAt(OPT_IN_MAP_MIN_ZOOM)).toBe(true);
        expect(optInSourcesOnMapAt(OPT_IN_MAP_MIN_ZOOM + 2.3)).toBe(true);
    });

    it('är släckt utzoomat och innan kartan rapporterat sin zoom', () => {
        expect(optInSourcesOnMapAt(OPT_IN_MAP_MIN_ZOOM - 0.01)).toBe(false);
        expect(optInSourcesOnMapAt(11)).toBe(false);
        expect(optInSourcesOnMapAt(null)).toBe(false);
    });

    it('gränsen ligger på 15 eller 16 som ticketen sa', () => {
        expect([15, 16]).toContain(OPT_IN_MAP_MIN_ZOOM);
    });
});

describe('INZOOM_SOURCE_KEYS', () => {
    it('är kyrkan, PRO och Korpen, och alla finns i SOURCE_DEFS', () => {
        expect([...INZOOM_SOURCE_KEYS].sort()).toEqual(['korpen', 'pro', 'svenskakyrkan']);
        const known = new Set(SOURCE_DEFS.map(d => d.key));
        for (const key of INZOOM_SOURCE_KEYS) expect(known.has(key)).toBe(true);
    });

    it('täcker varje källa som klassas, så ingen källa blir kvar dold inzoomat', () => {
        for (const url of [
            'https://www.svenskakyrkan.se/vaxjo/kalender?event=1',
            'https://pro.se/distrikt/kronoberg/aktiviteter/2',
            'https://www.korpen.se/stockholm/3',
        ]) {
            expect(INZOOM_SOURCE_KEYS).toContain(classifySource(url));
        }
    });
});

describe('withInzoomSources', () => {
    it('lägger till källorna utan att röra användarens övriga val', () => {
        const selected = new Set(['pro', 'family']);
        const out = withInzoomSources(selected);
        expect([...out].sort()).toEqual(['family', 'korpen', 'pro', 'svenskakyrkan']);
        expect([...selected].sort()).toEqual(['family', 'pro']);
    });
});

describe('mapEventsFor', () => {
    const list = [{ id: 'a' }, { id: 'c' }];
    const base = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const passes = (e: { id: string }) => e.id !== 'd';

    it('utzoomat är kartans lista samma referens som listans', () => {
        expect(mapEventsFor(optInSourcesOnMapAt(12), list, base, passes)).toBe(list);
        expect(mapEventsFor(optInSourcesOnMapAt(null), list, base, passes)).toBe(list);
    });

    it('inzoomat filtreras underlaget med inzoom-regeln, i underlagets ordning', () => {
        const inzoom = optInSourcesOnMapAt(OPT_IN_MAP_MIN_ZOOM);
        expect(mapEventsFor(inzoom, list, base, passes).map(e => e.id)).toEqual(['a', 'b', 'c']);
    });
});
