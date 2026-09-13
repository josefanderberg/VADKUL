import { describe, it, expect } from 'vitest';
import { shouldLandOnTomorrow } from './eveningLanding';
import type { LinkEvent } from '@/types';

// Kväll: 22:30 en vanlig dag.
const NOW = new Date(2026, 8, 13, 22, 30);

const evt = (hoursAt: number, extra: Partial<LinkEvent> = {}): LinkEvent => ({
    id: `e${hoursAt}`,
    url: `https://example.com/${hoursAt}`,
    title: `Event ${hoursAt}`,
    time: new Date(2026, 8, 13, hoursAt, 0),
    lat: 0, lng: 0,
    ...extra,
} as LinkEvent);

describe('shouldLandOnTomorrow', () => {
    it('byter när dagens alla event har varit', () => {
        expect(shouldLandOnTomorrow([evt(14), evt(19)], NOW)).toBe(true);
    });

    it('byter INTE när något event fortfarande är aktuellt ikväll', () => {
        // 22:00-konserten är aktuell till 23:00 (start + 1 h).
        expect(shouldLandOnTomorrow([evt(14), evt(22)], NOW)).toBe(false);
    });

    it('byter INTE på en helt tom dag — det är tom-promptens jobb', () => {
        expect(shouldLandOnTomorrow([], NOW)).toBe(false);
        // Bara morgondagens event laddade = dagens lista är tom.
        const tomorrow = evt(14);
        tomorrow.time = new Date(2026, 8, 14, 14, 0);
        expect(shouldLandOnTomorrow([tomorrow], NOW)).toBe(false);
    });

    it('event utan klockslag följer kl 20-klippet (delade regeln)', () => {
        const noTime = evt(0, { hasSpecificTime: false });
        // 22:30 — klippet kl 20 har passerat → har varit → byt.
        expect(shouldLandOnTomorrow([noTime], NOW)).toBe(true);
        // 18:00 — fortfarande aktuellt → byt inte.
        expect(shouldLandOnTomorrow([noTime], new Date(2026, 8, 13, 18, 0))).toBe(false);
    });

    it('gårdagens och morgondagens event påverkar inte bedömningen', () => {
        const yesterday = evt(14);
        yesterday.time = new Date(2026, 8, 12, 14, 0);
        const tomorrow = evt(15);
        tomorrow.time = new Date(2026, 8, 14, 15, 0);
        // Dagens enda event har varit → byt, trots aktuellt event imorgon.
        expect(shouldLandOnTomorrow([yesterday, evt(14), tomorrow], NOW)).toBe(true);
    });

    it('mitt på dagen med kommande event: byt inte', () => {
        expect(shouldLandOnTomorrow([evt(10), evt(19)], new Date(2026, 8, 13, 12, 0))).toBe(false);
    });
});
