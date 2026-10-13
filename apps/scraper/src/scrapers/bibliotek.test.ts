import { describe, it, expect } from 'vitest';
import { mapAxiellEvent, branchCity, AxiellTenant } from './bibliotek';

// TZ=Europe/Stockholm via vitest.config — samma som nattkedjan på minin.
const tenant: AxiellTenant = {
    id: 'helsingborg', customerId: 'x', eventsUrl: 'https://www.bibliotekfh.se/evenemang',
    name: 'Bibliotek Familjen Helsingborg', cities: ['Helsingborg', 'Höganäs'],
};
const hit = (startDate: string, endDate: string) => ({
    id: '904ca5b8-1a96-4958-847a-1af9976f4d6f',
    event: {
        title: 'Lovaktivitet: skrivartävling', status: 'PUBLISHED', deleted: false,
        startDate, endDate, location: { value: 'Höganäs bibliotek' },
    },
});

describe('mapAxiellEvent — klockslag', () => {
    it('vanligt event behåller sitt klockslag', () => {
        const e = mapAxiellEvent(hit('2026-10-13T07:30:00.000Z', '2026-10-13T08:30:00.000Z'), tenant);
        expect(e?.hasSpecificTime).toBe(true);
        expect(e?.startDate.toISOString()).toBe('2026-10-13T07:30:00.000Z');
        expect(e?.url).toBe('https://www.bibliotekfh.se/evenemang#904ca5b8-1a96-4958-847a-1af9976f4d6f');
    });

    // Höganäs bibliotek 12/10: heldagsevent (start lokal midnatt, slut 23:59)
    // låg som "kl 00" på kartan — API:t saknar allDay-flagga.
    it('heldag med start lokal midnatt är bara datum (vintertid och sommartid)', () => {
        expect(mapAxiellEvent(hit('2026-10-25T23:00:00.000Z', '2026-10-26T22:59:00.000Z'), tenant)?.hasSpecificTime).toBe(false);
        expect(mapAxiellEvent(hit('2026-10-11T22:00:00.000Z', '2026-10-19T21:59:00.000Z'), tenant)?.hasSpecificTime).toBe(false);
    });

    it('heldag inlagd som 00:01 (Mölndal) är också bara datum', () => {
        expect(mapAxiellEvent(hit('2026-10-25T23:01:00.000Z', '2026-10-30T22:59:00.000Z'), tenant)?.hasSpecificTime).toBe(false);
    });

    it('UTC-midnatt mitt på dagen lokalt (01:00/02:00) är inget heldagsevent', () => {
        // 2026-10-26T00:00Z = 01:00 lokal vintertid — inte midnattstimmen
        expect(mapAxiellEvent(hit('2026-10-26T00:00:00.000Z', '2026-10-26T01:00:00.000Z'), tenant)?.hasSpecificTime).toBe(true);
    });
});

describe('branchCity', () => {
    it('genitiv-s strippas när basen är en medlemsort', () => {
        expect(branchCity('Höganäs bibliotek', ['Höganäs'])).toBe('Höganäs');
        expect(branchCity('Åstorps bibliotek', ['Åstorp'])).toBe('Åstorp');
        expect(branchCity('Sylte bibliotek', ['Trollhättan'])).toBeUndefined();
    });
});
