import { describe, it, expect } from 'vitest';
import { mapRkContent, kommunFromUrl, prop } from './rodakorset';

const URL = 'https://www.rodakorset.se/ort/skane/ystads-kommun/kalendarium/sprakcafe/';
const baseContent = {
    contentType: ['Page', 'CalendarPage'],
    status: { value: 'Published' },
    startDateTime: { value: '2026-09-25T08:00:00Z' },
    heading: { value: 'Språkcafé' },
    addressLine1: { value: 'Stora Östergatan 12' },
    mainBody: { value: '<p>Alla är välkomna</p>' },
};

describe('prop', () => {
    it('packar upp EPiServers {value}-wrappade properties men släpper igenom råa', () => {
        expect(prop({ value: 'x' })).toBe('x');
        expect(prop('y')).toBe('y');
        expect(prop(undefined)).toBe('');
    });
});

describe('kommunFromUrl', () => {
    it('plockar kommun ur /ort/-segmentet och städar slug-formen', () => {
        expect(kommunFromUrl(URL)).toBe('Ystad');                       // "-kommun"-suffix + genitiv-s bort
        expect(kommunFromUrl('https://www.rodakorset.se/ort/stockholm/sodertalje/kalendarium/x/'))
            .toBe('Sodertalje');                                        // slug utan å/ä/ö — gissning för geocoding
        expect(kommunFromUrl('https://www.rodakorset.se/inget-ort-segment/')).toBe('');
    });
});

describe('mapRkContent', () => {
    it('mappar en komplett CalendarPage', () => {
        const e = mapRkContent(URL, baseContent)!;
        expect(e.title).toBe('Språkcafé');
        expect(e.url).toBe(URL);
        expect(e.startDate.toISOString()).toBe('2026-09-25T08:00:00.000Z');
        expect(e.venueName).toBe('Stora Östergatan 12, Ystad');
        expect(e.hostName).toBe('Röda Korset Ystad');
        expect(e.geocodeCandidates).toEqual(['Stora Östergatan 12, Ystad', 'Ystad']);
        expect(e.description).toBe('Alla är välkomna');
    });

    it('icke-CalendarPage och opublicerat innehåll hoppas över', () => {
        expect(mapRkContent(URL, { ...baseContent, contentType: ['Page', 'ArticlePage'] })).toBeNull();
        expect(mapRkContent(URL, { ...baseContent, status: { value: 'Draft' } })).toBeNull();
        expect(mapRkContent(URL, null)).toBeNull();
    });

    it('saknat datum eller titel → hoppas över', () => {
        expect(mapRkContent(URL, { ...baseContent, startDateTime: { value: '' } })).toBeNull();
        expect(mapRkContent(URL, { ...baseContent, heading: { value: '' }, name: '' })).toBeNull();
    });

    it('name används som titel-fallback när heading saknas', () => {
        const e = mapRkContent(URL, { ...baseContent, heading: { value: '' }, name: 'Insamling' })!;
        expect(e.title).toBe('Insamling');
    });

    it('utan adress blir kommunen venue', () => {
        const e = mapRkContent(URL, { ...baseContent, addressLine1: { value: '' } })!;
        expect(e.venueName).toBe('Ystad, Röda Korset');
        expect(e.geocodeCandidates).toEqual(['Ystad']);
    });
});
