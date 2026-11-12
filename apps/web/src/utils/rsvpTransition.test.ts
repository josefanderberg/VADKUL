import { describe, expect, it } from 'vitest';
import { eventShareSlug } from './eventShareSlug';
import { inviteUrl, nextRsvp, rsvpCountDeltas, rsvpShareId, hostedAttendeeAction, hostedRegisterAction, outlinkRsvpPress } from './rsvpTransition';

describe('nextRsvp', () => {
    it('tomt läge + tryck = valet', () => {
        expect(nextRsvp(null, 'going')).toBe('going');
        expect(nextRsvp(null, 'interested')).toBe('interested');
    });
    it('samma tryck togglar av', () => {
        expect(nextRsvp('going', 'going')).toBeNull();
        expect(nextRsvp('interested', 'interested')).toBeNull();
    });
    it('andra knappen byter', () => {
        expect(nextRsvp('going', 'interested')).toBe('interested');
        expect(nextRsvp('interested', 'going')).toBe('going');
    });
});

describe('rsvpCountDeltas', () => {
    it('på: +1 på fältet', () => {
        expect(rsvpCountDeltas(null, 'going')).toEqual({ going: 1, interested: 0 });
    });
    it('av: -1 på fältet', () => {
        expect(rsvpCountDeltas('interested', null)).toEqual({ going: 0, interested: -1 });
    });
    it('byte: -1 på gamla, +1 på nya', () => {
        expect(rsvpCountDeltas('going', 'interested')).toEqual({ going: -1, interested: 1 });
    });
    it('oförändrat: nolldeltan', () => {
        expect(rsvpCountDeltas('going', 'going')).toEqual({ going: 0, interested: 0 });
        expect(rsvpCountDeltas(null, null)).toEqual({ going: 0, interested: 0 });
    });
});

describe('rsvpShareId', () => {
    it('veckoserietillfälle svarar på seriens dokument', () => {
        expect(rsvpShareId('abc123__2026-09-18', true)).toBe('abc123');
    });
    it('skrapade event (URL-id med __) kapas inte', () => {
        expect(rsvpShareId('https://ex.se/a__b', false)).toBe('https://ex.se/a__b');
    });
});

describe('inviteUrl', () => {
    it('bygger /e/-länken med inb=1 och inbjudarens uid', () => {
        const url = inviteUrl('https://vadkul.se', 'https://ex.se/event/1', false, 'abc 123');
        expect(url).toBe(`https://vadkul.se/e/${eventShareSlug('https://ex.se/event/1')}?inb=1&fran=abc%20123`);
    });
    it('utelämnar fran för utloggade', () => {
        expect(inviteUrl('https://vadkul.se', 'x', false, null)).toBe(`https://vadkul.se/e/${eventShareSlug('x')}?inb=1`);
    });
    it('bjuder på seriens dokument för veckoserietillfällen', () => {
        expect(inviteUrl('o', 'doc1__2026-09-18', true, null)).toBe(`o/e/${eventShareSlug('doc1')}?inb=1`);
    });
});

describe('hostedAttendeeAction (Kommer = Anmäl dig på värdade event, 4/11)', () => {
    it('Kommer på → anmäl; Kommer av eller byte till Intresserad → avanmäl', () => {
        expect(hostedAttendeeAction(null, 'going')).toBe('register');
        expect(hostedAttendeeAction('interested', 'going')).toBe('register');
        expect(hostedAttendeeAction('going', null)).toBe('cancel');
        expect(hostedAttendeeAction('going', 'interested')).toBe('cancel');
    });
    it('Intresserad fram och tillbaka rör inte anmälan', () => {
        expect(hostedAttendeeAction(null, 'interested')).toBeNull();
        expect(hostedAttendeeAction('interested', null)).toBeNull();
        expect(hostedAttendeeAction('going', 'going')).toBeNull();
    });
});

describe('hostedRegisterAction (ANMÄL DIG-knappen)', () => {
    it('inte anmäld: trycker Kommer när svaret inte är Kommer, annars bara anmälan', () => {
        expect(hostedRegisterAction(false, null)).toBe('press');
        expect(hostedRegisterAction(false, 'interested')).toBe('press');
        expect(hostedRegisterAction(false, 'going')).toBe('register');
    });
    it('anmäld: släpper Kommer när svaret är Kommer, annars bara avanmälan', () => {
        expect(hostedRegisterAction(true, 'going')).toBe('press');
        expect(hostedRegisterAction(true, null)).toBe('cancel');
        expect(hostedRegisterAction(true, 'interested')).toBe('cancel');
    });
});

describe('outlinkRsvpPress (ANMÄL på skrapade event sätter Kommer, 7/11)', () => {
    it('inget svar eller Intresserad → tryck Kommer', () => {
        expect(outlinkRsvpPress(null)).toBe('going');
        expect(outlinkRsvpPress('interested')).toBe('going');
    });
    it('redan Kommer → inget tryck (klicket får aldrig stänga av svaret)', () => {
        expect(outlinkRsvpPress('going')).toBeNull();
    });
});
