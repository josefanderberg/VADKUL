import { describe, it, expect } from 'vitest';
import { mapRotaryEvent, usDate } from './rotary';

const baseEvent = {
    Name: 'Vårlunch med föredrag',
    StartDate: '2026-06-25T12:00:00',   // lokal Stockholmstid, ingen TZ
    HasStartsAt: true,
    Url: 'https://rotary2325.se/event/123',
    ClubShortName: 'Växjö',
    Location: '<b>Teleborgs slott</b>',
    Description: '<p>Föredrag om &amp; lunch</p>',
};

describe('usDate', () => {
    it('formaterar "MMM d, yyyy" i gemener — ClubRunner-API:t KRÄVER detta (ISO ger 0 träffar)', () => {
        expect(usDate(new Date(2026, 5, 11))).toBe('jun 11, 2026');
        expect(usDate(new Date(2026, 11, 1))).toBe('dec 1, 2026');
    });
});

describe('mapRotaryEvent', () => {
    it('mappar ett komplett ClubRunner-event', () => {
        const e = mapRotaryEvent(baseEvent)!;
        expect(e.title).toBe('Vårlunch med föredrag');
        expect(e.url).toBe('https://rotary2325.se/event/123');
        expect(e.hasSpecificTime).toBe(true);
        expect(e.venueName).toBe('Teleborgs slott, Rotaryklubb Växjö');
        expect(e.hostName).toBe('Rotary Växjö');
        expect(e.geocodeCandidates).toEqual(['Teleborgs slott', 'Växjö, Sverige']);
        expect(e.startDate.getHours()).toBe(12);
    });

    it('HasStartsAt=false betyder datum-utan-klocka, oavsett parsead tid', () => {
        expect(mapRotaryEvent({ ...baseEvent, HasStartsAt: false })!.hasSpecificTime).toBe(false);
    });

    it('midnatt utan HasStartsAt-flagga = heldag', () => {
        expect(mapRotaryEvent({ ...baseEvent, StartDate: '2026-06-25T00:00:00' })!.hasSpecificTime).toBe(false);
    });

    it('RegistrationUrl används som fallback; helt utan URL hoppas eventet över', () => {
        expect(mapRotaryEvent({ ...baseEvent, Url: '', RegistrationUrl: 'https://reg.example/1' })!.url)
            .toBe('https://reg.example/1');
        expect(mapRotaryEvent({ ...baseEvent, Url: '', RegistrationUrl: '' })).toBeNull();
    });

    it('klubb utan plats → klubben blir venue och geocode-kandidat', () => {
        const e = mapRotaryEvent({ ...baseEvent, Location: '', LocationString: '' })!;
        expect(e.venueName).toBe('Rotaryklubb Växjö');
        expect(e.geocodeCandidates).toEqual(['Växjö, Sverige']);
    });
});
