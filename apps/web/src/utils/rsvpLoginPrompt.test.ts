import { describe, expect, it } from 'vitest';
import {
    RSVP_LOGIN_PROMPT_COOLDOWN_MS, rsvpLoginPromptText, shouldPromptRsvpLogin, type RsvpLoginPromptInput,
} from './rsvpLoginPrompt';

const NU = Date.UTC(2026, 10, 13, 20, 0);
const bas: RsvpLoginPromptInput = { hasAccount: false, next: 'going', shownThisVisit: false, dismissedAt: null, now: NU };

// #214, Josef 13/11: "en popup som säger att man ska logga in för att spara
// sitt val och få notiser".
describe('shouldPromptRsvpLogin', () => {
    it('visas efter Kommer eller Intresserad utan konto', () => {
        expect(shouldPromptRsvpLogin(bas)).toBe(true);
        expect(shouldPromptRsvpLogin({ ...bas, next: 'interested' })).toBe(true);
    });

    it('aldrig för den som har ett konto', () => {
        expect(shouldPromptRsvpLogin({ ...bas, hasAccount: true })).toBe(false);
    });

    it('inte när svaret togs bort', () => {
        expect(shouldPromptRsvpLogin({ ...bas, next: null })).toBe(false);
    });

    it('högst en gång per besök', () => {
        expect(shouldPromptRsvpLogin({ ...bas, shownThisVisit: true })).toBe(false);
    });

    it('tyst i en vecka efter Inte nu, sedan tillbaka', () => {
        const nekad = (sedanMs: number) => shouldPromptRsvpLogin({ ...bas, dismissedAt: String(NU - sedanMs) });
        expect(nekad(60_000)).toBe(false);
        expect(nekad(RSVP_LOGIN_PROMPT_COOLDOWN_MS - 1)).toBe(false);
        expect(nekad(RSVP_LOGIN_PROMPT_COOLDOWN_MS)).toBe(true);
    });

    it('ett trasigt eller framtida sparat värde låser inte uppmaningen för gott', () => {
        expect(shouldPromptRsvpLogin({ ...bas, dismissedAt: 'x' })).toBe(true);
        expect(shouldPromptRsvpLogin({ ...bas, dismissedAt: String(NU + 1e12) })).toBe(true);
    });
});

describe('rsvpLoginPromptText', () => {
    it('lovar påminnelsen bara för Kommer (1 h-notisen går till Kommer-svar)', () => {
        expect(rsvpLoginPromptText('going')).toContain('påminnelse');
        expect(rsvpLoginPromptText('interested')).not.toContain('påminnelse');
        for (const t of [rsvpLoginPromptText('going'), rsvpLoginPromptText('interested')]) {
            expect(t).toContain('Logga in');
            expect(t).not.toMatch(/[–—]/);
        }
    });
});
