import { describe, it, expect } from 'vitest';
import { validEventEnd, sanitizeEndDate, MAX_EVENT_SPAN_MS } from './eventEnd';

const start = new Date('2026-09-02T10:00:00Z'); // Live at Heart ons 2/9

describe('validEventEnd', () => {
    it('flerdagarsfestival (ons–lör) släpps igenom', () => {
        const end = new Date('2026-09-05T23:00:00Z');
        expect(validEventEnd(start, end)).toBe(end);
    });

    it('sluttid samma dag släpps igenom (konsert 18–23)', () => {
        const s = new Date('2026-09-02T18:00:00Z');
        const end = new Date('2026-09-02T23:00:00Z');
        expect(validEventEnd(s, end)).toBe(end);
    });

    it('slut före eller samtidigt som start → null (API:er ekar startDate)', () => {
        expect(validEventEnd(start, new Date(start))).toBeNull();
        expect(validEventEnd(start, new Date(start.getTime() - 3_600_000))).toBeNull();
    });

    it('längre än 30 dygn → null (utställningar/säsonger är inte pågående event)', () => {
        expect(validEventEnd(start, new Date(start.getTime() + MAX_EVENT_SPAN_MS + 1))).toBeNull();
        // Exakt på gränsen är ok.
        expect(validEventEnd(start, new Date(start.getTime() + MAX_EVENT_SPAN_MS))).not.toBeNull();
    });

    it('sanitizeEndDate tål ISO-strängar och skräp (legacy-anropare)', () => {
        expect(sanitizeEndDate('2026-09-02T18:00:00Z', '2026-09-05T23:00:00Z')?.toISOString())
            .toBe('2026-09-05T23:00:00.000Z');
        expect(sanitizeEndDate(new Date('2026-09-02T18:00:00Z'), '2026-09-01T23:00:00Z')).toBeNull();
        expect(sanitizeEndDate('2026-09-02', 'inte ett datum')).toBeNull();
        expect(sanitizeEndDate('2026-09-02', undefined)).toBeNull();
        expect(sanitizeEndDate(undefined, '2026-09-05')).toBeNull();
        expect(sanitizeEndDate('2026-09-02', 42)).toBeNull();
    });

    it('saknade/ogiltiga värden → null', () => {
        expect(validEventEnd(start, null)).toBeNull();
        expect(validEventEnd(start, undefined)).toBeNull();
        expect(validEventEnd(start, new Date('skräp'))).toBeNull();
        expect(validEventEnd(undefined, new Date())).toBeNull();
        expect(validEventEnd(new Date('skräp'), new Date())).toBeNull();
    });
});
