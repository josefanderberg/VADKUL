import { describe, it, expect } from 'vitest';
import { normalizeTitle, localDay, locationKey, dedupKey, scoreOf, buildDedupGroups } from './dedupe-cross-source';

const base = {
    url: 'https://example.se/e/1',
    title: 'Nationaldagsfirande i Gamla stan',
    time: '2026-06-06T12:00:00.000Z',
    locationName: 'Gamla stan, Falkenberg',
    coverImage: null as string | null,
    description: null as string | null,
    lat: 56.9055, lng: 12.4912,
    isLocationVerified: 0,
    hostName: 'Falkenberg Kommun',
    firestoreId: 'abc',
};

describe('normalizeTitle', () => {
    it('normaliserar åäö, skiljetecken och whitespace', () => {
        expect(normalizeTitle('KvartersLoppis - norra delen!')).toBe('kvartersloppis norra delen');
        expect(normalizeTitle('Västspels Onsdagsspel')).toBe(normalizeTitle('Västspels onsdagsspel'));
    });
});

describe('dedupKey', () => {
    it('samma event från två källor får samma nyckel trots koordinat-jitter', () => {
        const a = { ...base };
        const b = { ...base, title: 'Nationaldagsfirande i Gamla Stan', lat: 56.9162, lng: 12.4843 };  // ~1km bort
        expect(dedupKey(a)).toBe(dedupKey(b));
    });

    it('samma titel+dag på olika orter får OLIKA nycklar', () => {
        const horby = { ...base, title: 'Sommarfest', lat: 55.85, lng: 13.66 };
        const tranemo = { ...base, title: 'Sommarfest', lat: 57.48, lng: 13.35 };
        expect(dedupKey(horby)).not.toBe(dedupKey(tranemo));
    });

    it('olika dagar får olika nycklar', () => {
        expect(dedupKey(base)).not.toBe(dedupKey({ ...base, time: '2026-06-07T12:00:00.000Z' }));
    });

    it('UTC-tid mappas till svensk lokal-dag (kvällsevent över midnatt UTC)', () => {
        // 23:30 UTC 5/6 = 01:30 lokal 6/6 — ska räknas som 6 juni
        expect(localDay('2026-06-05T23:30:00.000Z')).toBe('2026-06-06');
    });
});

describe('locationKey', () => {
    it('koordinater vinner över locationName', () => {
        expect(locationKey(base)).toMatch(/^56\.\d{2},12\.\d{2}$/);
    });

    it('utan koordinater används normaliserat platsnamn', () => {
        expect(locationKey({ lat: 0, lng: 0, locationName: 'Gamla stan, Falkenberg' })).toBe('gamla stan falkenber');
    });

    it('varken koordinater eller namn → tom nyckel (eventet ska inte dedupas)', () => {
        expect(locationKey({ lat: 0, lng: 0, locationName: '' })).toBe('');
    });
});

describe('scoreOf — bästa kandidaten vinner', () => {
    it('event med bild i egen Storage + beskrivning slår FB-event utan', () => {
        const rik = scoreOf({
            ...base,
            coverImage: 'https://storage.googleapis.com/vadkul/img.jpg',
            description: 'En lång och utförlig beskrivning av firandet i Gamla stan i Falkenberg.',
            isLocationVerified: 1,
        });
        const fattig = scoreOf({ ...base, hostName: 'Facebook', coverImage: null });
        expect(rik).toBeGreaterThan(fattig);
    });

    it('geokodning ger poäng', () => {
        expect(scoreOf(base)).toBeGreaterThan(scoreOf({ ...base, lat: 0, lng: 0 }));
    });
});

describe('buildDedupGroups — tvilling-fästning', () => {
    const geocoded = { ...base, url: 'https://kommun.se/e/1' };
    const naked = { ...base, url: 'https://fb.com/e/2', lat: 0, lng: 0, locationName: '' };

    it('naken tvilling (ingen plats alls) fästs vid det enda geokodade klustret', () => {
        const { groups, attached } = buildDedupGroups([geocoded, naked] as any);
        expect(attached).toBe(1);
        expect(groups).toHaveLength(1);
        expect(groups[0]).toHaveLength(2);
    });

    it('namn-tvilling fästs när platsnamnet delar ord ("Babel" ↔ "Babel, Malmö")', () => {
        const a = { ...base, url: 'u1', locationName: 'Babel, Malmö', lat: 55.6, lng: 13.0 };
        const b = { ...base, url: 'u2', locationName: 'Babel', lat: 0, lng: 0 };
        const { groups, attached } = buildDedupGroups([a, b] as any);
        expect(attached).toBe(1);
        expect(groups).toHaveLength(1);
        expect(groups[0]).toHaveLength(2);
    });

    it('namn-tvilling utan ordöverlapp förblir egen grupp', () => {
        const a = { ...base, url: 'u1', locationName: 'Folkets Hus', lat: 55.6, lng: 13.0 };
        const b = { ...base, url: 'u2', locationName: 'Bygdegården Tranemo', lat: 0, lng: 0 };
        const { groups, attached } = buildDedupGroups([a, b] as any);
        expect(attached).toBe(0);
        expect(groups).toHaveLength(2);
    });

    it('flera geokodade kluster (generisk titel på många orter) → ingen fästning', () => {
        const horby = { ...base, url: 'u1', title: 'Midsommarfirande', lat: 55.85, lng: 13.66 };
        const tranemo = { ...base, url: 'u2', title: 'Midsommarfirande', lat: 57.48, lng: 13.35 };
        const lost = { ...base, url: 'u3', title: 'Midsommarfirande', lat: 0, lng: 0, locationName: '' };
        const { groups, attached, skippedNoLocation } = buildDedupGroups([horby, tranemo, lost] as any);
        expect(attached).toBe(0);
        expect(skippedNoLocation).toBe(1);
        expect(groups).toHaveLength(2);
    });

    it('olika dagar fästs aldrig ihop', () => {
        const other = { ...naked, time: '2026-06-07T12:00:00.000Z' };
        const { attached } = buildDedupGroups([geocoded, other] as any);
        expect(attached).toBe(0);
    });
});
