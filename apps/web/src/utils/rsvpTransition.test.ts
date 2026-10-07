import { describe, it, expect } from 'vitest';
import { eventShareSlug } from './eventShareSlug';
import { inviteUrl, nextRsvp, rsvpCountDeltas, rsvpShareId } from './rsvpTransition';

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
