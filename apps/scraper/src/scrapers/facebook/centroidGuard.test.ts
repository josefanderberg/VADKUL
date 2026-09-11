import { describe, it, expect } from 'vitest';
import { centroidFallbackRejection, storedForeignFbReason } from './centroidGuard';

const base = { fromSearch: true, description: '' };

describe('centroidFallbackRejection', () => {
    it('avvisar utländska sökträffar på ortsnamn (Sala 2026-09-11)', () => {
        expect(centroidFallbackRejection({
            ...base, city: 'Sala', title: 'Sala Rotonda - Castellanza', address: 'Sala Rotonda Castellanza',
            description: 'Gae & Mari della BluMovida Band vi aspettano per una serata tutta da vivere tra musica, emozioni e ballo! Una serata con la musica della band.',
        })).toMatch(/främmande språk/);
    });

    it('avvisar norsk text utan svensk ort', () => {
        expect(centroidFallbackRejection({
            ...base, fromSearch: false, city: 'Sala', title: 'TRENING I SAL', address: 'Volsdalen skole',
            description: 'Trening i sal og rolige bevegelser til musikk. Passer for alle. Påmelding hos Ellen, ikke medlem 800 kr.',
        })).toMatch(/norsk\/dansk/);
    });

    it('avvisar fuzzy sökträffar som inte nämner orten (Bergen ≠ Berg)', () => {
        expect(centroidFallbackRejection({
            ...base, city: 'Berg', title: 'Mannencirkel Bergen e.o.', address: 'Bergen (NH)',
        })).toMatch(/nämner inte Berg/);
    });

    it('avvisar engelska sökträffar på tvetydiga orter', () => {
        expect(centroidFallbackRejection({
            ...base, city: 'Tibro', title: 'Tibro First Timers', address: 'Mt Tibrogargan Circuit',
            description: 'Join us for the Tibro first timers walk. We will meet at the car park and you can see the view from the top.',
        })).toMatch(/tvetydigt/);
    });

    it('släpper igenom äkta svenska event (även på tvetydiga orter)', () => {
        expect(centroidFallbackRejection({
            ...base, city: 'Sala', title: 'Loppis i Folkets Hus', address: 'Folkets Hus, Sala',
            description: 'Välkommen till höstens loppis! Kläder, böcker och fika för alla. Fri entré.',
        })).toBeNull();
        expect(centroidFallbackRejection({
            ...base, city: 'Fårö', title: 'Bio på Fårö', address: 'Bergmancenter Fårö', description: '',
        })).toBeNull();
    });

    it('släpper igenom grannlandstext som nämner en svensk ort', () => {
        expect(centroidFallbackRejection({
            ...base, city: 'Strömstad', title: 'Velkommen til en herlig yogahelg i Strømstad', address: 'Strömstad',
            description: 'Vi gleder oss til å se deg og alle andre som vil være med på yoga og hvile. Påmelding til Kari.',
        })).toBeNull();
    });

    it('släpper igenom utländskspråkiga föreningsevent som nämner en svensk stad', () => {
        expect(centroidFallbackRejection({
            ...base, fromSearch: false, city: 'Stockholm', title: 'Atelier de Creatie Sezatoarea Stockholm',
            address: 'Kungsholmens Kulturhus',
            description: 'Vă așteptăm la atelierul de creație pentru copii și părinți, cu povești și jocuri în limba română.',
        })).toBeNull();
    });
});

describe('storedForeignFbReason (nattvakten)', () => {
    const fb = 'https://www.facebook.com/events/123/';
    const RO = 'Vă așteptăm la BEBE FEST, festivalul pentru copii și părinți, cu spectacole și ateliere în fiecare zi. Intrarea este liberă pentru toți cei care vin cu familia.';

    it('döljer utländska FB-event på gissad position eller på (0,0)', () => {
        expect(storedForeignFbReason({ url: fb, title: 'BEBE FEST', locationName: 'Calea Giulesti 16', description: RO, geoPrecision: 'ort-centroid', lat: 59.34, lng: 18.07 })).toMatch(/främmande/);
        expect(storedForeignFbReason({ url: fb, title: 'BEBE FEST', description: RO, geoPrecision: null, lat: 0, lng: 0 })).toMatch(/främmande/);
    });

    it('rör aldrig exakta positioner eller andra källor', () => {
        expect(storedForeignFbReason({ url: fb, title: 'BEBE FEST', description: RO, geoPrecision: 'poi', lat: 59.34, lng: 18.07 })).toBeNull();
        expect(storedForeignFbReason({ url: 'https://www.kommun.se/evenemang/1', title: 'BEBE FEST', description: RO, geoPrecision: 'stad-centroid', lat: 59.34, lng: 18.07 })).toBeNull();
    });

    it('sparar föreningsevent som nämner en svensk stad', () => {
        expect(storedForeignFbReason({ url: fb, title: 'Atelier de Creatie Sezatoarea Stockholm', locationName: 'Kungsholmens Kulturhus', description: RO, geoPrecision: null, lat: 59.33, lng: 18.07 })).toBeNull();
    });

    it('norska bara på svensk ortsmittpunkt, aldrig på riktiga grannlandsplatser', () => {
        const NO = 'Kirkeyoga i Bergen Domkirke. Velkommen til alle som vil være med, ikke nødvendig med påmelding. Ta med matte og godt humør.';
        expect(storedForeignFbReason({ url: fb, title: 'Kirkeyoga', locationName: 'Bergen Domkirke', description: NO, geoPrecision: 'stad-centroid', lat: 62.87, lng: 13.88 })).toMatch(/norsk/);
        expect(storedForeignFbReason({ url: fb, title: 'Kirkeyoga', locationName: 'Bergen Domkirke', description: NO, geoPrecision: 'ort-centroid', lat: 60.39, lng: 5.33 })).toBeNull();
    });
});
