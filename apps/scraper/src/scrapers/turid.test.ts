import { describe, it, expect } from 'vitest';
import { parseTuridOccasion, parseTuridCoords, formatTuridPrice, mapTuridEvent } from './turid';

const CFG = {
    apiBase: 'https://turid.visitvarmland.com',
    siteBase: 'https://visitvarmland.com',
    defaultCity: 'Karlstad',
};

describe('parseTuridOccasion', () => {
    it('läser datum + klockslag', () => {
        const r = parseTuridOccasion({ date_start: '2026-08-26', time_start: '14:00:00' })!;
        expect(r.hasClock).toBe(true);
        expect(r.date.getFullYear()).toBe(2026);
        expect(r.date.getMonth()).toBe(7);
        expect(r.date.getDate()).toBe(26);
        expect(r.date.getHours()).toBe(14);
    });

    it('behandlar 00:00:00 som datum utan tid', () => {
        const r = parseTuridOccasion({ date_start: '2026-08-26', time_start: '00:00:00' })!;
        expect(r.hasClock).toBe(false);
        expect(r.date.getHours()).toBe(0);
    });

    it('klarar tillfällen helt utan tid', () => {
        const r = parseTuridOccasion({ date_start: '2026-08-26' })!;
        expect(r.hasClock).toBe(false);
    });

    it('avvisar skräp', () => {
        expect(parseTuridOccasion(undefined)).toBeNull();
        expect(parseTuridOccasion({ date_start: '' })).toBeNull();
        expect(parseTuridOccasion({ date_start: '26/08/2026' })).toBeNull();
    });
});

describe('parseTuridCoords', () => {
    it('konverterar strängkoordinater', () => {
        expect(parseTuridCoords({ latitude: '59.6577', longitude: '12.5942' })).toEqual([59.6577, 12.5942]);
    });

    it('avvisar 0,0 och koordinater utanför Norden', () => {
        expect(parseTuridCoords({ latitude: '0', longitude: '0' })).toBeUndefined();
        expect(parseTuridCoords({ latitude: '40.7', longitude: '-74.0' })).toBeUndefined();
    });

    it('avvisar tomma fält', () => {
        expect(parseTuridCoords(undefined)).toBeUndefined();
        expect(parseTuridCoords({ latitude: null as any, longitude: null as any })).toBeUndefined();
    });
});

describe('formatTuridPrice', () => {
    it('ett pris', () => expect(formatTuridPrice([{ price: '600' }])).toBe('600 kr'));
    it('flera priser → från-pris', () => expect(formatTuridPrice([{ price: '250' }, { price: '150' }])).toBe('Från 150 kr'));
    it('identiska priser räknas som ett', () => expect(formatTuridPrice([{ price: '150' }, { price: '150' }])).toBe('150 kr'));
    it('inget pris', () => {
        expect(formatTuridPrice([])).toBeUndefined();
        expect(formatTuridPrice(undefined)).toBeUndefined();
        expect(formatTuridPrice([{ price: '0' }])).toBeUndefined();
    });
});

describe('mapTuridEvent', () => {
    const EV = {
        id: 117250,
        title: 'Sketching-workshop: Vykort från Arvika',
        slug: 'evenemang/forelasning-och-workshop/sketching-workshop-vykort-fran-arvika',
        sales_text: 'Låt handen avbilda vad ögat ser.',
        occasions: [
            { date_start: '2026-08-26', date_end: '2026-08-26', time_start: '14:00:00', time_end: '17:00:00' },
            { date_start: '2026-08-30', date_end: '2026-08-30', time_start: '14:00:00', time_end: '17:00:00' },
        ],
        places: [{ title: 'Vykort från Arvika', latitude: '59.6577', longitude: '12.5942', address: { street_1: 'Storgatan 1', city: '' } }],
        organizers: [{ title: 'Sanne Pawelzyk', city: 'Arvika' }],
        prices: [{ price: '600', price_type: 'Pris per person' }],
        primary_image: { medium: 'https://img.turid.visitvarmland.com/medium/x.jpg', large: 'https://img.turid.visitvarmland.com/large/x.jpg' },
    };

    it('ger ett event per tillfälle', () => {
        expect(mapTuridEvent(EV, CFG)).toHaveLength(2);
    });

    it('bygger URL av siteBase + slug, unik per tillfälle', () => {
        const [a, b] = mapTuridEvent(EV, CFG);
        expect(a.url).toBe('https://visitvarmland.com/evenemang/forelasning-och-workshop/sketching-workshop-vykort-fran-arvika#2026-08-26');
        expect(b.url).toContain('#2026-08-30');
    });

    it('tar orten ur arrangören — place.address.city är alltid tom i TURID', () => {
        expect(mapTuridEvent(EV, CFG)[0].city).toBe('Arvika');
    });

    it('faller tillbaka på defaultCity när arrangören saknar stad', () => {
        const ev = { ...EV, organizers: [{ title: 'Okänd' }] };
        expect(mapTuridEvent(ev, CFG)[0].city).toBe('Karlstad');
    });

    it('bär koordinater, adress, bild, pris och arrangör', () => {
        const e = mapTuridEvent(EV, CFG)[0];
        expect(e.coords).toEqual([59.6577, 12.5942]);
        expect(e.address).toBe('Storgatan 1');
        expect(e.imageUrl).toContain('/large/');
        expect(e.price).toBe('600 kr');
        expect(e.hostName).toBe('Sanne Pawelzyk');
        expect(e.hasSpecificTime).toBe(true);
    });

    it('sätter endDate bara för flerdagarstillfällen', () => {
        expect(mapTuridEvent(EV, CFG)[0].endDate).toBeUndefined();
        const flerdags = { ...EV, occasions: [{ date_start: '2026-08-26', date_end: '2026-08-28', time_start: '10:00:00' }] };
        expect(mapTuridEvent(flerdags, CFG)[0].endDate).toBeDefined();
    });

    it('hoppar över poster utan titel, slug eller tillfällen', () => {
        expect(mapTuridEvent({ ...EV, title: '' }, CFG)).toEqual([]);
        expect(mapTuridEvent({ ...EV, slug: undefined }, CFG)).toEqual([]);
        expect(mapTuridEvent({ ...EV, occasions: [] }, CFG)).toEqual([]);
    });
});
