import { describe, it, expect } from 'vitest';
import { timelineWindowRange, TIMELINE_WINDOW_DAYS } from './timelineWindow';

// Vitest kör med TZ=Europe/Stockholm (vitest.config) — precis som besökarna
// fönstret ska kvantiseras för.

describe('timelineWindowRange', () => {
    it('kvantiserar till lokal midnatt — alla besökare samma dag ger IDENTISKA strängar', () => {
        const morgon = timelineWindowRange(new Date('2026-09-12T06:13:00+02:00'));
        const kvall = timelineWindowRange(new Date('2026-09-12T23:58:00+02:00'));
        expect(morgon).toEqual(kvall);   // CDN:en får EN cache-nyckel per dygn
        expect(morgon.fromIso).toBe('2026-09-11T22:00:00.000Z');   // midnatt CEST
    });

    it('spänner exakt fönsterlängden, slut 23:59:59.999 sista dagen', () => {
        const r = timelineWindowRange(new Date('2026-09-12T12:00:00+02:00'));
        const spanMs = r.toMs - Date.parse(r.fromIso);
        expect(spanMs).toBe(TIMELINE_WINDOW_DAYS * 86_400_000 - 1);
        expect(r.toIso).toBe('2026-09-25T21:59:59.999Z');
    });

    it('håller sig under routens spann-vakt', () => {
        // SLICE_MAX_SPAN_MS i /api/events/[layer] är 16 dygn — fönstret får
        // aldrig växa förbi den utan att vakten höjs i samma commit.
        expect(TIMELINE_WINDOW_DAYS).toBeLessThanOrEqual(16);
    });

    it('formatet passerar routens ISO-regex (ms-del, Z-suffix)', () => {
        const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;   // kopia av routens
        const r = timelineWindowRange();
        expect(r.fromIso).toMatch(ISO_RE);
        expect(r.toIso).toMatch(ISO_RE);
    });

    it('nyårs- och sommartidsgränser ger fortfarande giltiga, växande fönster', () => {
        for (const d of ['2026-12-31T23:30:00+01:00', '2026-10-25T12:00:00+01:00', '2027-03-28T12:00:00+02:00']) {
            const r = timelineWindowRange(new Date(d));
            expect(r.toMs).toBeGreaterThan(Date.parse(r.fromIso));
        }
    });
});
