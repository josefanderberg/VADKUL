import { describe, expect, it } from 'vitest';
import { familyIsOptIn } from './familyFilter';

describe('familyIsOptIn', () => {
    it('göms för inloggad vuxen utan barn', () => {
        expect(familyIsOptIn({ age: 34 })).toBe(true);
        expect(familyIsOptIn({ age: 34, hasChildren: false })).toBe(true);
        expect(familyIsOptIn({ age: 18 })).toBe(true);
        expect(familyIsOptIn({ age: 72, hasChildren: false })).toBe(true);
    });

    it('göms aldrig för föräldrar', () => {
        expect(familyIsOptIn({ age: 34, hasChildren: true })).toBe(false);
        expect(familyIsOptIn({ hasChildren: true })).toBe(false);
    });

    it('göms aldrig utan profil (utloggad/anonym)', () => {
        expect(familyIsOptIn(null)).toBe(false);
        expect(familyIsOptIn(undefined)).toBe(false);
    });

    it('göms aldrig för unga användare (under 18)', () => {
        expect(familyIsOptIn({ age: 13 })).toBe(false);
        expect(familyIsOptIn({ age: 17 })).toBe(false);
    });

    it('göms aldrig när åldern saknas eller är ogiltig (gamla konton)', () => {
        expect(familyIsOptIn({})).toBe(false);
        expect(familyIsOptIn({ age: undefined })).toBe(false);
        expect(familyIsOptIn({ age: '34' })).toBe(false);
        expect(familyIsOptIn({ age: NaN })).toBe(false);
        expect(familyIsOptIn({ age: Infinity })).toBe(false);
    });

    it('hasChildren-skräpvärden räknas inte som barn', () => {
        // Bara ett uttryckligt true skyddar — annars gäller åldersregeln.
        expect(familyIsOptIn({ age: 34, hasChildren: 'ja' })).toBe(true);
        expect(familyIsOptIn({ age: 34, hasChildren: 1 })).toBe(true);
    });
});
