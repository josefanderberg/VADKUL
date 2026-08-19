import { describe, expect, it } from 'vitest';
import { boostedUntilLabel } from './boostLabel';

describe('boostedUntilLabel', () => {
    const now = new Date('2026-08-19T12:00:00');

    it('samma år → dag + kort månad, inget årtal', () => {
        expect(boostedUntilLabel(new Date('2026-08-27T09:00:00'), now)).toBe('27 aug.');
        expect(boostedUntilLabel(new Date('2026-12-31T23:00:00'), now)).toBe('31 dec.');
    });

    it('annat år (boost över årsskiftet) → årtalet med', () => {
        const label = boostedUntilLabel(new Date('2027-01-04T09:00:00'), new Date('2026-12-30T12:00:00'));
        expect(label).toContain('jan');
        expect(label).toContain('2027');
    });
});
