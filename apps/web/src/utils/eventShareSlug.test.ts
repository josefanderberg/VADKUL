import { describe, it, expect } from 'vitest';
import { eventShareSlug } from './eventShareSlug';

// GULDTEST: dessa värden är LÅSTA. /e/<slug>-länkar är delade och indexerade —
// ändras algoritmen slutar varje gammal länk fungera (se kommentaren i
// eventShareSlug.ts). Går detta test rött har du brutit alla delade länkar:
// backa ändringen, hitta en annan väg.
describe('eventShareSlug', () => {
    it('ger exakt samma hash som alltid (frysta guldvärden)', () => {
        expect(eventShareSlug('https://www.ticketmaster.se/event/123')).toBe('a7dc327fb4e63ab1');
        expect(eventShareSlug('https://kulturbolaget.se/evenemang/test')).toBe('c8a332eb29581ebd');
        expect(eventShareSlug('abc')).toBe('1a47e90bea894dc5');
        expect(eventShareSlug('')).toBe('811c9dc57ee3623b');
    });

    it('är alltid 16 hex-tecken, även när hasharna börjar på 0', () => {
        // padStart-regressionen: utan padding blir vissa slugs 15 tecken och
        // server-uppslaget missar dem.
        for (let i = 0; i < 500; i++) {
            const slug = eventShareSlug(`https://example.se/event/${i}`);
            expect(slug).toMatch(/^[0-9a-f]{16}$/);
        }
    });

    it('olika id → olika slug (ingen trivial kollision)', () => {
        expect(eventShareSlug('https://a.se/1')).not.toBe(eventShareSlug('https://a.se/2'));
    });
});
