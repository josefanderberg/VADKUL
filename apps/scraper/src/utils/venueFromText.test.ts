/** Extraktorerna för PRO/SPF-fallet (Canasta i Vislanda, 24/8). */
import { describe, it, expect } from 'vitest';
import { extractVenueFromText, ortFromForeningsnamn } from './venueFromText';

describe('extractVenueFromText', () => {
    it('ägarens exempel: Canasta-beskrivningen ger Folkets Hus', () => {
        expect(extractVenueFromText(
            'Vi spelar i Folkets Hus, Caféet, på tisdagar mellan 13 - 17. Start 18/8 till 8/12. Kontakta Erene Lindahl telefon 0705928829',
        )).toBe('Folkets Hus');
    });

    it('ort + byggnad i samma fras', () => {
        expect(extractVenueFromText('Träning i Vislanda Folkets Hus varje onsdag'))
            .toBe('Vislanda Folkets Hus');
        expect(extractVenueFromText('Vi träffas på Sundborns församlingsgård kl 14'))
            .toBe('Sundborns församlingsgård');
    });

    it('"på tisdagar" och gemena fraser triggar inte', () => {
        expect(extractVenueFromText('Vi ses på tisdagar och torsdagar')).toBeNull();
        expect(extractVenueFromText('spela boule i parken vid ån')).toBeNull();
    });

    it('tom/None-text ger null', () => {
        expect(extractVenueFromText('')).toBeNull();
        expect(extractVenueFromText(null)).toBeNull();
    });
});

describe('ortFromForeningsnamn', () => {
    it('PRO-orter, även bindestrecksdubblar', () => {
        expect(ortFromForeningsnamn('PRO Vislanda')).toBe('Vislanda');
        expect(ortFromForeningsnamn('PRO Vislanda-Blädinge')).toBe('Vislanda');
        expect(ortFromForeningsnamn('SPF Seniorerna Alvesta')).toBe('Alvesta');
        expect(ortFromForeningsnamn('PRO Södra Sandby')).toBeNull();   // stoppord hellre än gissning
    });

    it('icke-orter ger null', () => {
        expect(ortFromForeningsnamn('PRO Kultur')).toBeNull();
        expect(ortFromForeningsnamn('PRO Samorganisation Växjö')).toBeNull();
        expect(ortFromForeningsnamn('Hembygdsföreningen')).toBeNull();
        expect(ortFromForeningsnamn(null)).toBeNull();
    });
});
