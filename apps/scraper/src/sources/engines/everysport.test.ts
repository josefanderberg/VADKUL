import { describe, it, expect } from 'vitest';
import { mapEsEvent, rt90ToWgs84, EsEvent } from './everysport';

const BASE: EsEvent = {
    id: 5225541,
    startDate: '2026-09-13T15:00:00+02:00',
    round: 21,
    status: 'UPCOMING',
    homeTeam: { name: 'Mjällby AIF', arena: { name: 'Strandvallen', city: 'Hällevik', position: { lat: 56.0126, lng: 14.7079 } } },
    visitingTeam: { name: 'IFK Göteborg' },
    league: { name: 'Allsvenskan', sport: { name: 'Fotboll' } },
    facts: { arena: { name: 'Strandvallen', city: 'Hällevik', position: { lat: 56.0126, lng: 14.7079 } } },
};

describe('mapEsEvent', () => {
    it('mappar match med arena-koordinater, titel "Hemma – Borta"', () => {
        const ev = mapEsEvent(BASE)!;
        expect(ev.title).toBe('Mjällby AIF – IFK Göteborg');
        expect(ev.coords).toEqual([56.0126, 14.7079]);
        expect(ev.venueName).toBe('Strandvallen');
        expect(ev.city).toBe('Hällevik');
        expect(ev.category).toBe('sport');
        expect(ev.hasSpecificTime).toBe(true);
        expect(ev.description).toContain('Allsvenskan');
        expect(ev.url).toContain('5225541');
    });
    it('RT90-fallback när position saknas (koordinater konverteras, Norden-rimliga)', () => {
        // OBS: swagger-exemplets RT90-siffror motsvarar INTE Hammenhög geografiskt
        // (exempeldata) — vi asserterar konverterad rimlighet, inte orten.
        const e: EsEvent = { ...BASE, facts: { arena: { name: 'Hamondavallen', city: 'Hammenhög', rt90coordinates: { e: 1620898, n: 6582099 } } } };
        const ev = mapEsEvent(e)!;
        expect(ev.coords![0]).toBeGreaterThan(55); expect(ev.coords![0]).toBeLessThan(69);
        expect(ev.coords![1]).toBeGreaterThan(10); expect(ev.coords![1]).toBeLessThan(25);
        expect(ev.venueName).toBe('Hamondavallen');
    });
    it('hemmalagets arena som fallback; utan lag/datum → null', () => {
        const e: EsEvent = { ...BASE, facts: null };
        expect(mapEsEvent(e)!.venueName).toBe('Strandvallen');
        expect(mapEsEvent({ ...BASE, homeTeam: {} })).toBeNull();
        expect(mapEsEvent({ ...BASE, startDate: undefined })).toBeNull();
    });
});

describe('rt90ToWgs84', () => {
    it('Stockholms centralpunkt (RT90 6580994, 1628294) ≈ 59.33, 18.06', () => {
        const [lat, lng] = rt90ToWgs84(6580994, 1628294);
        expect(Math.abs(lat - 59.33)).toBeLessThan(0.02);
        expect(Math.abs(lng - 18.06)).toBeLessThan(0.03);
    });
});
