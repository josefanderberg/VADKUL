import { describe, it, expect } from 'vitest';
import { mapOptiEvent } from './optimizely-events';

const CFG = { baseUrl: 'https://www.vallentuna.se', currentPageId: 'c36b6e1a', defaultCity: 'Vallentuna' };

const E = {
    Name: 'KUBenStories',
    Url: '/evenemang-och-upplevelser/evenemangskalender/2026/01/kubenstories/',
    Excerpt: 'Varje onsdag på KUBen i Karby. Från årskurs 6.',
    StartDate: null,
    StopDate: null,
    Dates: [
        { StartDate: '2026-01-14T16:00:00+01:00', StopDate: '2026-01-14T17:00:00+01:00' },
        { StartDate: '2026-01-21T16:00:00+01:00', StopDate: '2026-01-21T17:00:00+01:00' },
    ],
    ImageUrl: '/globalassets/kuben.jpg',
    Location: 'KUBen i Karby',
    Categories: ['Barn och unga'],
};

describe('mapOptiEvent', () => {
    it('läser Dates[] även när toppnivåns StartDate är null', () => {
        const evs = mapOptiEvent(E, CFG);
        expect(evs).toHaveLength(2);
        expect(evs[0].startDate.toISOString()).toBe('2026-01-14T15:00:00.000Z');
    });

    it('gör URL och bild absoluta, med tillfället i fragmentet', () => {
        const e = mapOptiEvent(E, CFG)[0];
        expect(e.url).toBe('https://www.vallentuna.se/evenemang-och-upplevelser/evenemangskalender/2026/01/kubenstories/#2026-01-14');
        expect(e.imageUrl).toBe('https://www.vallentuna.se/globalassets/kuben.jpg');
    });

    it('faller tillbaka på toppnivåns StartDate när Dates saknas', () => {
        const evs = mapOptiEvent({ ...E, Dates: [], StartDate: '2026-03-01T10:00:00+01:00' }, CFG);
        expect(evs).toHaveLength(1);
        expect(evs[0].startDate.toISOString()).toBe('2026-03-01T09:00:00.000Z');
    });

    it('bär plats och kategori', () => {
        const e = mapOptiEvent(E, CFG)[0];
        expect(e.venueName).toBe('KUBen i Karby');
        expect(e.category).toBe('Barn och unga');
        expect(e.city).toBe('Vallentuna');
        expect(e.hasSpecificTime).toBe(true);
    });

    it('lämnar hasSpecificTime öppen för heldagsposter', () => {
        const evs = mapOptiEvent({ ...E, Dates: [{ StartDate: '2026-03-01T00:00:00+01:00' }] }, CFG);
        expect(evs[0].hasSpecificTime).toBeUndefined();
    });

    it('avvisar poster utan namn, url eller datum alls', () => {
        expect(mapOptiEvent({ ...E, Name: '' }, CFG)).toEqual([]);
        expect(mapOptiEvent({ ...E, Url: undefined }, CFG)).toEqual([]);
        expect(mapOptiEvent({ ...E, Dates: [], StartDate: null }, CFG)).toEqual([]);
    });
});
