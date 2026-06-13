import { describe, it, expect } from 'vitest';
import { parseAssociations, parsePosition, parseZoeziTime, mapWorkout } from './korpen';

const CATALOG_SNIPPET = `
<a href="/sok/" rel="" target="_self">Sök</a>
<a class="" href="/orter/" rel="" target="_self">Orter</a>
<li><a href="/korpenfalun" rel="" target="_self"><span class="double">Falun<span class="secondary chevron chevron--tight">Korpförening Falun</span></span></a></li>
<li><a href="/korpenlund" rel="" target="_self"><span class="double">Lund<span class="secondary">Korpen Bjärred-Lund</span></span></a></li>
<li><a href="/kalmar-pickleballklubb" rel="" target="_self"><span class="double">Kalmar<span class="secondary">Kalmar Pickleballklubb</span></span></a></li>
`;

describe('parseAssociations', () => {
    it('extraherar slugs + namn, hoppar nav-länkar (trailing slash)', () => {
        const assocs = parseAssociations(CATALOG_SNIPPET);
        expect(assocs.map((a) => a.slug)).toEqual(['korpenfalun', 'korpenlund', 'kalmar-pickleballklubb']);
    });

    it('korpen*-slugs får brand-namn "Korpen <Ort>", fristående klubbar sitt eget', () => {
        const bynamn = Object.fromEntries(parseAssociations(CATALOG_SNIPPET).map((a) => [a.slug, a.name]));
        expect(bynamn['korpenfalun']).toBe('Korpen Falun');
        expect(bynamn['kalmar-pickleballklubb']).toBe('Kalmar Pickleballklubb');
    });

    it('orten följer med för stads-fallback', () => {
        const falun = parseAssociations(CATALOG_SNIPPET).find((a) => a.slug === 'korpenfalun');
        expect(falun?.ort).toBe('Falun');
    });
});

describe('parsePosition', () => {
    it('parsas som "lat,lng" — LATITUD FÖRST', () => {
        expect(parsePosition('55.6963695,13.201382200000012')).toEqual([55.6963695, 13.201382200000012]);
    });

    it('0,0 och skräp → null', () => {
        expect(parsePosition('0,0')).toBeNull();
        expect(parsePosition('abc')).toBeNull();
        expect(parsePosition(undefined)).toBeNull();
    });
});

describe('parseZoeziTime', () => {
    it('lokal väggtid utan offset → Date i processens tidszon', () => {
        const d = parseZoeziTime('2026-06-15 17:30:00');
        expect(d?.getHours()).toBe(17);
        expect(d?.getMinutes()).toBe(30);
    });
});

describe('mapWorkout', () => {
    const assoc = { slug: 'korpenlund', name: 'Korpen Bjärred-Lund', ort: 'Bjärred-Lund' };
    const workout = {
        id: 22452,
        workoutType: { name: 'Fotboll' },
        startTime: '2026-06-15 17:30:00',
        endTime: '2026-06-15 18:30:00',
        status: 'Ok',
        extra_title: 'Dynans FF - FC Bärselona',
        resources: [{
            lastname: 'Korpvallen 1', resourceType: 'location',
            position: '55.6963695,13.2013822', address: 'Västanväg', city: 'Lund',
        }],
    };

    it('mappar komplett pass', () => {
        const e = mapWorkout(workout as any, assoc);
        expect(e?.title).toBe('Dynans FF - FC Bärselona');
        expect(e?.venueName).toBe('Korpvallen 1');
        expect(e?.coords?.[0]).toBeCloseTo(55.696, 2);
        expect(e?.city).toBe('Lund');
        expect(e?.hostName).toBe('Korpen Bjärred-Lund');
        expect(e?.hasSpecificTime).toBe(true);
        expect(e?.url).toBe('https://korpenlund.zoezi.se/schema#pass-22452');
        expect(e?.category).toBe('sport');
    });

    it('Cancelled filtreras', () => {
        expect(mapWorkout({ ...workout, status: 'Cancelled' } as any, assoc)).toBeNull();
    });

    it('utan extra_title används passnamnet', () => {
        const e = mapWorkout({ ...workout, extra_title: null } as any, assoc);
        expect(e?.title).toBe('Fotboll');
    });

    it('VERSAL-stad snyggas till', () => {
        const w = { ...workout, resources: [{ ...workout.resources[0], city: 'GÄVLE' }] };
        expect(mapWorkout(w as any, assoc)?.city).toBe('Gävle');
    });

    it('pass utan plats-resurs faller tillbaka på föreningens ort (första delen)', () => {
        const e = mapWorkout({ ...workout, resources: [] } as any, assoc);
        expect(e?.city).toBe('Bjärred');
        expect(e?.coords).toBeUndefined();
    });
});
