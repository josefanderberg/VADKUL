import { describe, it, expect } from 'vitest';
import { parseKalendarietTime, mapKalendarietActivity, dedupeByParent } from './goteborgstad';
import { RawEvent } from '../sources/types';

const PAGE = 'https://goteborg.se/wps/portal/kalendarium/kalendarium-start';

describe('parseKalendarietTime', () => {
    it('lokal ISO utan offset → lokal Date med klocka', () => {
        const r = parseKalendarietTime('2026-07-23T10:30:00');
        expect(r?.date.getFullYear()).toBe(2026);
        expect(r?.date.getMonth()).toBe(6);
        expect(r?.date.getDate()).toBe(23);
        expect(r?.date.getHours()).toBe(10);
        expect(r?.date.getMinutes()).toBe(30);
        expect(r?.hasClock).toBe(true);
    });

    it('midnatt 00:00:00 → hasClock=false (heldag)', () => {
        const r = parseKalendarietTime('2026-07-23T00:00:00');
        expect(r?.hasClock).toBe(false);
    });

    it('skräp → null', () => {
        expect(parseKalendarietTime('2026-07-23')).toBeNull();
        expect(parseKalendarietTime(undefined)).toBeNull();
        expect(parseKalendarietTime('23/07/2026 10:30')).toBeNull();
    });
});

describe('mapKalendarietActivity', () => {
    const act = {
        id: '6f084fdf-a06e-420c-bdb4-ccd9dffcadfd',
        title: 'Sommar i positivparken',
        description: '<p>Pyssel &amp; sport.</p><ul><li>Läshörna</li></ul>',
        startTime: '2026-07-23T13:00:00',
        endTime: '2026-07-23T16:00:00',
        eventType: 'single',
        template: false,
        parent: '196ac282-e2de-4e13-994f-81862ae1c4a8',
        location: { name: 'Positivgatan 7', latitude: 57.6557, longitude: 11.9124 },
        image: { host: 'https://s3.eu-central-1.amazonaws.com/gbg.images/', path: '13a10e89.png' },
        unit: {
            name: 'Positivparken',
            address: { street: null, latitude: 57.6557, longitude: 11.9124 },
        },
    };

    it('full rad → komplett RawEvent', () => {
        const ev = mapKalendarietActivity(act, PAGE, 'Göteborg')!;
        expect(ev.externalId).toBe(act.id);
        expect(ev.title).toBe('Sommar i positivparken');
        expect(ev.startDate.getHours()).toBe(13);
        expect(ev.endDate?.getHours()).toBe(16);
        expect(ev.url).toBe(`${PAGE}?activityId=${act.id}`);
        expect(ev.venueName).toBe('Positivgatan 7');
        expect(ev.coords).toEqual([57.6557, 11.9124]);
        expect(ev.description).toBe('Pyssel & sport. Läshörna');
        expect(ev.imageUrl).toBe('https://s3.eu-central-1.amazonaws.com/gbg.images/13a10e89.png');
        expect(ev.hostName).toBe('Positivparken');
        expect(ev.hasSpecificTime).toBe(true);
    });

    it('koordinater utanför Göteborgsområdet förkastas, unit-fallback används', () => {
        const ev = mapKalendarietActivity(
            { ...act, location: { name: 'Fel', latitude: 59.33, longitude: 18.06 } },
            PAGE, 'Göteborg',
        )!;
        expect(ev.coords).toEqual([57.6557, 11.9124]); // unit.address-fallback
    });

    it('template-rad → null; titel-/id-/datumlös → null', () => {
        expect(mapKalendarietActivity({ ...act, template: true }, PAGE, 'Göteborg')).toBeNull();
        expect(mapKalendarietActivity({ ...act, title: '' }, PAGE, 'Göteborg')).toBeNull();
        expect(mapKalendarietActivity({ ...act, id: undefined }, PAGE, 'Göteborg')).toBeNull();
        expect(mapKalendarietActivity({ ...act, startTime: undefined }, PAGE, 'Göteborg')).toBeNull();
    });

    it('location saknas → unit.name som venue', () => {
        const ev = mapKalendarietActivity({ ...act, location: undefined }, PAGE, 'Göteborg')!;
        expect(ev.venueName).toBe('Positivparken');
        expect(ev.coords).toEqual([57.6557, 11.9124]);
    });
});

describe('dedupeByParent', () => {
    const mk = (title: string, day: number): RawEvent => ({
        title,
        startDate: new Date(2026, 6, day),
        url: `https://x/${title}/${day}`,
    });

    it('samma parent → tidigaste tillfället vinner; utan parent behålls alla', () => {
        const out = dedupeByParent([
            { ev: mk('Bokbuss', 25), parent: 'p1' },
            { ev: mk('Bokbuss', 23), parent: 'p1' },
            { ev: mk('Bokbuss', 29), parent: 'p1' },
            { ev: mk('Vernissage', 24) },
            { ev: mk('Konsert', 26), parent: 'p2' },
        ]);
        expect(out).toHaveLength(3);
        const bokbuss = out.find((e) => e.title === 'Bokbuss')!;
        expect(bokbuss.startDate.getDate()).toBe(23);
    });
});
