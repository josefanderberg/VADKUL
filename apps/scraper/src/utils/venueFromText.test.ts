/** Extraktorerna för PRO/SPF-fallet (Canasta i Vislanda, 24/8). */
import { describe, it, expect } from 'vitest';
import { extractVenueFromText, ortFromForeningsnamn } from './venueFromText';
import { venueBuildingOf, buildingCandidatesOf } from './venueFromText';

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

describe('venueBuildingOf', () => {
    it('plockar byggnaden ur "SALONG - BYGGNAD"', () => {
        expect(venueBuildingOf('Saga - Bio 3:an')).toBe('Bio 3:an');
        expect(venueBuildingOf('Röda Kvarn - Bio 3:an')).toBe('Bio 3:an');
        expect(venueBuildingOf('Metropol - Bio 3:an')).toBe('Bio 3:an');
        expect(venueBuildingOf('Salong Lillan - Garvaren Bio')).toBe('Garvaren Bio');
        expect(venueBuildingOf('Terassen - Vimmerby Bio')).toBe('Vimmerby Bio');
        expect(venueBuildingOf('Grand – Vimmerby Bio')).toBe('Vimmerby Bio');
    });
    it('lämnar byggnad-först, bindestreck i namn och salongslösa platser', () => {
        expect(venueBuildingOf('Kulturhuset - Stora scenen')).toBeNull();
        expect(venueBuildingOf('Bio 3:an - Saga')).toBeNull();
        expect(venueBuildingOf('Studio Acusticum, Black Box')).toBeNull();
        expect(venueBuildingOf('Storm Salong 1')).toBeNull();
        expect(venueBuildingOf('Musik i ruinen - S:t Nicolai')).toBeNull();
        expect(venueBuildingOf('')).toBeNull();
        expect(venueBuildingOf(undefined)).toBeNull();
    });
});

describe('buildingCandidatesOf (#247: Ticksters salonger på ortens mittpunkt)', () => {
    it('salongen åt ena eller andra hållet om strecket', () => {
        expect(buildingCandidatesOf('Saga - Bio 3:an')).toEqual(['Bio 3:an']);
        expect(buildingCandidatesOf('Nalen – Stora Salen')).toEqual(['Nalen']);
        expect(buildingCandidatesOf('Agens Kulturhus - Krusenstjernasalen')).toEqual(['Agens Kulturhus']);
        expect(buildingCandidatesOf('Kulturens Hus - Lilla salen')).toEqual(['Kulturens Hus']);
    });

    it('rum, byggnad med komma', () => {
        expect(buildingCandidatesOf('Unga Klara, Kulturhuset Stadsteatern')).toEqual(['Kulturhuset Stadsteatern']);
        expect(buildingCandidatesOf('Idun, Umeå Folkets Hus')).toEqual(['Umeå Folkets Hus']);
        expect(buildingCandidatesOf('Hantverksalen, Centralteatern')).toEqual(['Centralteatern']);
        expect(buildingCandidatesOf('Arena Varberg, Sparbankshallen')).toEqual(['Arena Varberg', 'Sparbankshallen']);
    });

    it('rummet sist i namnet', () => {
        expect(buildingCandidatesOf('Wermland Opera Stora Scen')).toEqual(['Wermland Opera']);
        expect(buildingCandidatesOf('Norrbottensteatern Scen 2')).toEqual(['Norrbottensteatern']);
        expect(buildingCandidatesOf('Sara Kulturhus Scen 4')).toEqual(['Sara Kulturhus']);
        expect(buildingCandidatesOf('Sara Kulturhus Hjortronet')).toEqual(['Sara Kulturhus']);
        expect(buildingCandidatesOf('Kino 2')).toEqual(['Kino']);
    });

    it('byggnaden själv eller bara ett rum: inget att prova', () => {
        expect(buildingCandidatesOf('Lund Stadsteater')).toEqual([]);
        expect(buildingCandidatesOf('Wermland Opera')).toEqual([]);
        expect(buildingCandidatesOf('Sal 2')).toEqual([]);
        expect(buildingCandidatesOf('Stora Scen')).toEqual([]);
        expect(buildingCandidatesOf('')).toEqual([]);
        expect(buildingCandidatesOf(null)).toEqual([]);
    });
});
