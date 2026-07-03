import { describe, it, expect } from 'vitest';
import { mapSvkEvent, isPublicSvkEvent, deriveTown } from './svenskakyrkan';

const baseEvent = {
    id: 'abc123',
    title: 'Sommarkonsert i domkyrkan',
    start: '2026-06-23T11:00:00+02:00',
    isFullDayEvent: false,
    startLocalTime: { time: '11:00:00' },
    owner: { name: 'Uppsala pastorat', type: 'Församling' },
    place: { name: 'Uppsala domkyrka' },
    eventType: { konstOchKultur: {} },
    attendanceMode: { offline: {} },
    description: '<p>Välkommen &amp; varmt välkommen</p>',
};

describe('mapSvkEvent', () => {
    it('mappar ett komplett API-event', () => {
        const e = mapSvkEvent(baseEvent)!;
        expect(e.url).toBe('https://www.svenskakyrkan.se/kalender?event=abc123');
        expect(e.title).toBe('Sommarkonsert i domkyrkan');
        expect(e.hasSpecificTime).toBe(true);
        expect(e.venueName).toBe('Uppsala domkyrka, Uppsala pastorat');
        expect(e.hostName).toBe('Uppsala pastorat');
        expect(e.description).toBe('Välkommen varmt välkommen');
        expect(e.startDate.toISOString()).toBe('2026-06-23T09:00:00.000Z'); // +02:00 → UTC
    });

    it('geocode-kedjan: ankrat först, bare kyrkonamn sist', () => {
        const e = mapSvkEvent({
            ...baseEvent,
            owner: { name: 'Sundbybergs församling', type: 'Församling' },
            place: { name: 'Sundbybergs kyrka' },
        })!;
        // Kyrkonamnet innehåller redan "Sundbyberg" → ingen separat ", ort"-ankring,
        // men bare kyrkonamn hamnar SIST (inte först som förr).
        expect(e.geocodeCandidates).toEqual([
            'Sundbybergs kyrka, Sundbybergs församling',
            'Sundbybergs församling',
            'Sundbyberg',
            'Sundbybergs kyrka',
        ]);
        expect(e.city).toBe('Sundbyberg');
    });

    it('Örebro-buggen: kyrka i annan stad ankras med orten FÖRST', () => {
        // "S:t Nikolai kyrka" ensamt gav Örebros Nikolai-koordinater för Halmstad-event.
        const e = mapSvkEvent({
            ...baseEvent,
            owner: { name: 'Halmstads församling', type: 'Församling' },
            place: { name: 'S:t Nikolai kyrka' },
        })!;
        const cands = e.geocodeCandidates!;
        expect(cands[0]).toBe('S:t Nikolai kyrka, Halmstad');
        expect(cands[cands.length - 1]).toBe('S:t Nikolai kyrka');
        expect(e.city).toBe('Halmstad');
    });

    it('äkta -s-ort korrumperas inte av genitiv-strip (Västerås)', () => {
        const e = mapSvkEvent({
            ...baseEvent,
            owner: { name: 'Västerås domkyrkoförsamling', type: 'Församling' },
            place: { name: 'Västerås domkyrka' },
        })!;
        expect(e.city).toBe('Västerås');   // INTE "Västerå"
    });

    it('flerords-församling faller tillbaka på staden (Göteborgs Vasa)', () => {
        const e = mapSvkEvent({
            ...baseEvent,
            owner: { name: 'Göteborgs Vasa församling', type: 'Församling' },
            place: { name: 'Vasa kyrka' },
        })!;
        expect(e.city).toBe('Göteborg');
        expect(e.geocodeCandidates![0]).toBe('Vasa kyrka, Göteborg');
    });

    it('deriveTown normaliserar genitiv men skyddar kända -s-orter', () => {
        expect(deriveTown('Halmstads')).toBe('Halmstad');
        expect(deriveTown('Sundbybergs')).toBe('Sundbyberg');
        expect(deriveTown('Västerås')).toBe('Västerås');
        expect(deriveTown('Borås')).toBe('Borås');
        expect(deriveTown('Höganäs')).toBe('Höganäs');
        expect(deriveTown('Göteborgs Vasa')).toBe('Göteborg');
    });

    it('SKUT-församlingar utomlands hoppas över (Sverige-only)', () => {
        expect(mapSvkEvent({ ...baseEvent, owner: { name: 'Svenska kyrkan i London', type: 'Utlandet' } })).toBeNull();
    });

    it('heldagsmarkeringar ger hasSpecificTime=false', () => {
        expect(mapSvkEvent({ ...baseEvent, isFullDayEvent: true })!.hasSpecificTime).toBe(false);
        expect(mapSvkEvent({ ...baseEvent, startLocalTime: { time: '00:00:00' } })!.hasSpecificTime).toBe(false);
        expect(mapSvkEvent({ ...baseEvent, startLocalTime: {} })!.hasSpecificTime).toBe(false);
    });

    it('event utan titel, startdatum eller id hoppas över', () => {
        expect(mapSvkEvent({ ...baseEvent, title: '  ' })).toBeNull();
        expect(mapSvkEvent({ ...baseEvent, start: undefined })).toBeNull();
        expect(mapSvkEvent({ ...baseEvent, start: 'trasigt' })).toBeNull();
        expect(mapSvkEvent({ ...baseEvent, id: undefined })).toBeNull();   // url blir annars "?event=undefined"
    });

    it('plats saknas → församlingen blir venue', () => {
        const e = mapSvkEvent({ ...baseEvent, place: {} })!;
        expect(e.venueName).toBe('Uppsala pastorat');
    });

    it('icke-publika event (gudstjänster) returnerar null hela vägen', () => {
        expect(mapSvkEvent({ ...baseEvent, title: 'Högmässa', eventType: { gudstjanstOchMassa: {} } })).toBeNull();
    });
});

describe('isPublicSvkEvent — hårt filter (beslut 2026-06-11)', () => {
    const typed = (eventType: any, title = 'Något event') => ({ title, eventType, attendanceMode: { offline: {} } });

    it('gudstjanstOchMassa filtreras bort — oavsett titel', () => {
        expect(isPublicSvkEvent(typed({ gudstjanstOchMassa: {} }, 'Sommarkonsert'))).toBe(false);
    });

    it('stodOchOmsorg (sorgegrupper/samtalsstöd) filtreras bort', () => {
        expect(isPublicSvkEvent(typed({ stodOchOmsorg: {} }))).toBe(false);
        expect(isPublicSvkEvent(typed({ stodOchOmsorg: {}, dropIn: {} }))).toBe(false);
    });

    it('blandtyp med gudstjänst-tagg filtreras bort (hård linje)', () => {
        expect(isPublicSvkEvent(typed({ gudstjanstOchMassa: {}, konstOchKultur: {} }))).toBe(false);
    });

    it('publika typer behålls: konst/kultur, träffar, kropp&själ, barn', () => {
        expect(isPublicSvkEvent(typed({ konstOchKultur: {} }))).toBe(true);
        expect(isPublicSvkEvent(typed({ motasOchUmgas: {}, dropIn: {} }))).toBe(true);
        expect(isPublicSvkEvent(typed({ kroppOchSjal: {} }))).toBe(true);
        expect(isPublicSvkEvent(typed({ barnverksamhet: {} }))).toBe(true);
    });

    it('typlösa event bedöms på titeln — ceremonier och gudstjänstord bort', () => {
        for (const junk of [
            'Dopgudstjänst', 'Dop', 'Vigselgudstjänst', 'Konfirmationsmässa', 'Konfirmation sommar 1',
            'Begravningsgudstjänst', 'Högmässa', 'Stilla mässa', 'Andakt', 'Vesper', 'Bön',
            'Helgmålsbön', 'Helgsmålsbön', 'Helgmålsringning på Falbygden', 'Helgsmål', 'Helgmålsandakt',
        ]) {
            expect(isPublicSvkEvent({ title: junk }), junk).toBe(false);
        }
    });

    it('typlösa event med publika titlar behålls — sammansättningar överlever ordfiltret', () => {
        for (const ok of [
            'Sommarkonsert med Arnökören', 'Presenningsikoner Mats Hermansson', 'Sommarcafé',
            'Musikgudstjänst', 'Julmässa på kyrkbacken', 'Guidning av Hagby kyrka', 'Klädloppis',
        ]) {
            expect(isPublicSvkEvent({ title: ok }), ok).toBe(true);
        }
    });

    it('öppettids- och stängningsnotiser filtreras bort oavsett typ', () => {
        expect(isPublicSvkEvent(typed({ konstOchKultur: {} }, 'Öppet 14.00-19.00'))).toBe(false);
        expect(isPublicSvkEvent(typed({ motasOchUmgas: {} }, 'Enåkers kyrka sommaröppen klockan 10-16'))).toBe(false);
        expect(isPublicSvkEvent({ title: 'Pastorsexpeditionen stängd idag.' })).toBe(false);
    });

    it('digitala event utan fysisk plats filtreras bort (kartprodukt)', () => {
        expect(isPublicSvkEvent({ title: 'Podd om bönens historia', eventType: { konstOchKultur: {} }, attendanceMode: { online: {} } })).toBe(false);
        // hybrid (online+offline) behålls
        expect(isPublicSvkEvent({ title: 'Konsert', eventType: { konstOchKultur: {} }, attendanceMode: { online: {}, offline: {} } })).toBe(true);
    });
});
