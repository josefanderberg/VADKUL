import { describe, it, expect } from 'vitest';
import { shouldAutoShowWelcome, WELCOME_RESUME_MS } from './welcomeGate';

// Välkomstrutan får inte dyka upp igen när mobilen laddar om sidan mitt i ett
// besök (iOS slänger bakgrundsfliken, tillbaka från arrangörssidan …).
const NOW = 1_759_900_000_000;

describe('shouldAutoShowWelcome', () => {
    it('första besöket (inget lagrat) får rutan', () => {
        expect(shouldAutoShowWelcome(null, NOW)).toBe(true);
        expect(shouldAutoShowWelcome('', NOW)).toBe(true);
    });

    it('omladdning strax efter att sidan var aktiv hoppar över rutan', () => {
        expect(shouldAutoShowWelcome(String(NOW - 5_000), NOW)).toBe(false);
        expect(shouldAutoShowWelcome(String(NOW - 10 * 60 * 1000), NOW)).toBe(false);
        expect(shouldAutoShowWelcome(String(NOW - WELCOME_RESUME_MS), NOW)).toBe(false);
    });

    it('ett nytt besök efter pausen får rutan igen', () => {
        expect(shouldAutoShowWelcome(String(NOW - WELCOME_RESUME_MS - 1), NOW)).toBe(true);
        expect(shouldAutoShowWelcome(String(NOW - 24 * 60 * 60 * 1000), NOW)).toBe(true);
    });

    it('trasigt värde räknas som nytt besök', () => {
        expect(shouldAutoShowWelcome('nej', NOW)).toBe(true);
        expect(shouldAutoShowWelcome('0', NOW)).toBe(true);
        expect(shouldAutoShowWelcome('-5', NOW)).toBe(true);
    });

    it('framtida tidsstämpel (flyttad klocka) räknas som samma besök', () => {
        expect(shouldAutoShowWelcome(String(NOW + 60_000), NOW)).toBe(false);
    });
});
