import { describe, it, expect } from 'vitest';
import {
    parseNotisBannerMemory,
    recordNotisBannerDismissal,
    shouldOfferNotisBanner,
    notisBannerCity,
    NOTIS_BANNER_SNOOZE_MS,
    NOTIS_BANNER_MAX_DISMISSALS,
    type NotisBannerGate,
} from './notisBanner';

const NOW = Date.parse('2026-09-21T12:00:00Z');
const fresh: NotisBannerGate = { standalone: true, status: 'default', memory: { dismissals: 0, lastDismissedAt: 0 } };

describe('shouldOfferNotisBanner', () => {
    it('visas i hemskärmsappen när webbläsaren aldrig fått frågan', () => {
        expect(shouldOfferNotisBanner(fresh, NOW)).toBe(true);
    });

    it('aldrig i vanlig webbläsarflik (första versionen: bara hemskärmsappen)', () => {
        expect(shouldOfferNotisBanner({ ...fresh, standalone: false }, NOW)).toBe(false);
    });

    it('aldrig när frågan redan är besvarad eller notiserna stängts av själv', () => {
        for (const status of ['granted', 'denied', 'off', 'unsupported', 'ios-needs-pwa'] as const) {
            expect(shouldOfferNotisBanner({ ...fresh, status }, NOW)).toBe(false);
        }
    });

    it('"Inte nu" snoozar i 14 dagar', () => {
        const memory = recordNotisBannerDismissal(fresh.memory, NOW);
        expect(shouldOfferNotisBanner({ ...fresh, memory }, NOW + NOTIS_BANNER_SNOOZE_MS - 1)).toBe(false);
        expect(shouldOfferNotisBanner({ ...fresh, memory }, NOW + NOTIS_BANNER_SNOOZE_MS)).toBe(true);
    });

    it('efter två nej visas den aldrig mer', () => {
        let memory = fresh.memory;
        for (let i = 0; i < NOTIS_BANNER_MAX_DISMISSALS; i++) memory = recordNotisBannerDismissal(memory, NOW);
        expect(shouldOfferNotisBanner({ ...fresh, memory }, NOW + 10 * NOTIS_BANNER_SNOOZE_MS)).toBe(false);
    });
});

describe('parseNotisBannerMemory', () => {
    it('saknat eller trasigt värde = aldrig avfärdad', () => {
        expect(parseNotisBannerMemory(null)).toEqual({ dismissals: 0, lastDismissedAt: 0 });
        expect(parseNotisBannerMemory('inte json')).toEqual({ dismissals: 0, lastDismissedAt: 0 });
        expect(parseNotisBannerMemory('{"dismissals":"x","lastDismissedAt":-5}')).toEqual({ dismissals: 0, lastDismissedAt: 0 });
    });

    it('läser tillbaka det som sparats', () => {
        const mem = recordNotisBannerDismissal({ dismissals: 0, lastDismissedAt: 0 }, NOW);
        expect(parseNotisBannerMemory(JSON.stringify(mem))).toEqual(mem);
    });
});

describe('notisBannerCity', () => {
    const cities = { vaxjo: { name: 'Växjö', slug: 'vaxjo' }, malmo: { name: 'Malmö', slug: 'malmo' } };
    const lookup = (slug: string) => cities[slug as keyof typeof cities] ?? null;

    it('kontots sparade stad vinner - det är den helgtipset skickas för', () => {
        expect(notisBannerCity('vaxjo', lookup, cities.malmo)).toEqual({ city: cities.vaxjo, saved: true });
    });

    it('utan sparad stad: kartans stad, markerad som osparad', () => {
        expect(notisBannerCity(null, lookup, cities.malmo)).toEqual({ city: cities.malmo, saved: false });
        expect(notisBannerCity('okand-ort', lookup, cities.malmo)).toEqual({ city: cities.malmo, saved: false });
    });

    it('ingen stad alls → null', () => {
        expect(notisBannerCity(undefined, lookup, null)).toBeNull();
    });
});
