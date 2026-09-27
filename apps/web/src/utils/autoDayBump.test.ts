import { describe, expect, it } from 'vitest';
import type { LinkEvent } from '../types';
import { shouldAutoBumpDay, todayIsSpent } from './autoDayBump';

const ev = (iso: string, hasSpecificTime = true): LinkEvent =>
    ({ id: iso, time: new Date(iso), hasSpecificTime } as unknown as LinkEvent);

const at = (iso: string) => new Date(iso).getTime();

describe('todayIsSpent', () => {
    it('tom dag dagtid → inte slut (tom-promptens jobb)', () => {
        expect(todayIsSpent([], at('2026-09-24T10:00:00'))).toBe(false);
    });

    it('tom dag på kvällen → slut', () => {
        expect(todayIsSpent([], at('2026-09-24T19:00:00'))).toBe(true);
    });

    it('allt har varit (start + 1 h passerat) → slut', () => {
        const today = [ev('2026-09-24T12:00:00'), ev('2026-09-24T18:00:00')];
        expect(todayIsSpent(today, at('2026-09-24T21:30:00'))).toBe(true);
    });

    it('ett kvällsevent kvar → inte slut', () => {
        const today = [ev('2026-09-24T12:00:00'), ev('2026-09-24T21:00:00')];
        expect(todayIsSpent(today, at('2026-09-24T20:30:00'))).toBe(false);
    });

    it('bara heldagsposter kvar på kvällen → slut', () => {
        const today = [ev('2026-09-24T00:00:00', false)];
        expect(todayIsSpent(today, at('2026-09-24T18:00:00'))).toBe(true);
    });

    it('heldagsposter på förmiddagen håller kvar idag', () => {
        const today = [ev('2026-09-24T00:00:00', false)];
        expect(todayIsSpent(today, at('2026-09-24T10:00:00'))).toBe(false);
    });
});

describe('shouldAutoBumpDay', () => {
    const tomorrow = [ev('2026-09-25T19:00:00')];

    it('idag slut + imorgon har event → hoppa', () => {
        expect(shouldAutoBumpDay([ev('2026-09-24T12:00:00')], tomorrow, at('2026-09-24T22:00:00'))).toBe(true);
    });

    it('imorgon tom → stanna (tom-prompten svarar)', () => {
        expect(shouldAutoBumpDay([], [], at('2026-09-24T22:00:00'))).toBe(false);
    });

    it('något kvar idag → stanna', () => {
        expect(shouldAutoBumpDay([ev('2026-09-24T21:00:00')], tomorrow, at('2026-09-24T20:00:00'))).toBe(false);
    });
});
