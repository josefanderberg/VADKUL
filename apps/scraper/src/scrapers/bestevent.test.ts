import { describe, it, expect } from 'vitest';
import { mapBestEvent } from './bestevent';

const CFG = { baseUrl: 'https://kalender.lerum.se', defaultCity: 'Lerum' };

const ITEM = {
    id: 228689,
    title: 'Välkommen tillbaka',
    eventSlug: 'valkommen-tillbaka-MjI4Njg5LDIwMjYtMDgtMjYgMDg6MDA=',
    status: 'approved',
    location: 'Gamla postens mötesplats',
    organizerName: 'Mötesplats Gamla Posten',
    eventTime: '2026-08-26T10:00:00.000+02:00',
    eventEndTime: '2026-08-26T13:00:00.000+02:00',
    startDate: '2026-08-26',
    posterUrl: 'https://s3-bestevent-prod.innocode.dev/x.jpg',
    categoryName: 'Kultur & nöje',
};

describe('mapBestEvent', () => {
    it('bygger URL av bas + eventSlug', () => {
        expect(mapBestEvent(ITEM, CFG)!.url)
            .toBe('https://kalender.lerum.se/events/valkommen-tillbaka-MjI4Njg5LDIwMjYtMDgtMjYgMDg6MDA=');
    });

    it('tål avslutande slash i baseUrl', () => {
        expect(mapBestEvent(ITEM, { ...CFG, baseUrl: 'https://kalender.lerum.se/' })!.url)
            .toBe('https://kalender.lerum.se/events/valkommen-tillbaka-MjI4Njg5LDIwMjYtMDgtMjYgMDg6MDA=');
    });

    it('läser tid ur eventTime, inte startDate', () => {
        const e = mapBestEvent(ITEM, CFG)!;
        expect(e.startDate.toISOString()).toBe('2026-08-26T08:00:00.000Z');
        expect(e.hasSpecificTime).toBe(true);
        expect(e.endDate?.toISOString()).toBe('2026-08-26T11:00:00.000Z');
    });

    it('lämnar hasSpecificTime öppen för heldagsposter', () => {
        const e = mapBestEvent({ ...ITEM, eventTime: '2026-08-27T00:00:00.000+02:00', eventEndTime: undefined }, CFG)!;
        expect(e.hasSpecificTime).toBeUndefined();
    });

    it('sätter arrangören som hostName — kalendern är en paraplykälla', () => {
        const e = mapBestEvent(ITEM, CFG)!;
        expect(e.hostName).toBe('Mötesplats Gamla Posten');
        expect(e.venueName).toBe('Gamla postens mötesplats');
        expect(e.city).toBe('Lerum');
        expect(e.category).toBe('Kultur & nöje');
        expect(e.imageUrl).toContain('innocode.dev');
    });

    it('faller tillbaka på posterUrls när posterUrl saknas', () => {
        const e = mapBestEvent({ ...ITEM, posterUrl: undefined, posterUrls: ['https://x/a.jpg'] }, CFG)!;
        expect(e.imageUrl).toBe('https://x/a.jpg');
    });

    it('filtrerar bort icke-godkända poster', () => {
        expect(mapBestEvent({ ...ITEM, status: 'pending' }, CFG)).toBeNull();
        expect(mapBestEvent({ ...ITEM, status: 'rejected' }, CFG)).toBeNull();
    });

    it('avvisar poster utan titel, slug eller datum', () => {
        expect(mapBestEvent({ ...ITEM, title: '' }, CFG)).toBeNull();
        expect(mapBestEvent({ ...ITEM, eventSlug: undefined }, CFG)).toBeNull();
        expect(mapBestEvent({ ...ITEM, eventTime: undefined, startDate: undefined }, CFG)).toBeNull();
        expect(mapBestEvent({ ...ITEM, eventTime: 'inte-ett-datum', startDate: undefined }, CFG)).toBeNull();
    });

    it('ignorerar sluttid som ligger före starttid', () => {
        expect(mapBestEvent({ ...ITEM, eventEndTime: '2026-08-26T07:00:00.000+02:00' }, CFG)!.endDate).toBeUndefined();
    });
});
