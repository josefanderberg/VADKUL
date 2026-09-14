import { describe, it, expect } from 'vitest';
import { firstSeenExport, FIRST_SEEN_EXPORT_DAYS } from './firstSeenExport';

/** Fast "nu" så testerna aldrig blir tidsbomber. */
const NOW = Date.parse('2026-09-14T12:00:00.000Z');
const DAY_MS = 86_400_000;

describe('firstSeenExport', () => {
    it('exporterar UTC-dagen för ett nyligen först-sett event', () => {
        expect(firstSeenExport('2026-09-12T08:30:00.000Z', NOW)).toBe('2026-09-12');
    });

    it('normaliserar till UTC-dag även för icke-ISO men parsbart format', () => {
        // Date.parse-tolkbar sträng utan Z — dagen ska ändå komma ur den
        // parsade tidpunkten, inte ur en slice av rå-strängen.
        expect(firstSeenExport(new Date(NOW - 2 * DAY_MS).toString(), NOW)).toBe('2026-09-12');
    });

    it('utelämnar event äldre än exportfönstret', () => {
        const old = new Date(NOW - (FIRST_SEEN_EXPORT_DAYS + 1) * DAY_MS).toISOString();
        expect(firstSeenExport(old, NOW)).toBeUndefined();
    });

    it('tar med exakt på fönstergränsen', () => {
        const edge = new Date(NOW - FIRST_SEEN_EXPORT_DAYS * DAY_MS).toISOString();
        expect(firstSeenExport(edge, NOW)).toBe('2026-08-31');
    });

    it('tolererar upp till ett dygns framtida klockskev', () => {
        // 12:00Z + 12 h = midnatt 15/9 UTC — dagen som exporteras är
        // stämpelns egen UTC-dag, inte "nu"-dagen.
        expect(firstSeenExport(new Date(NOW + DAY_MS / 2).toISOString(), NOW)).toBe('2026-09-15');
    });

    it('utelämnar stämplar längre fram i tiden än ett dygn (trasig data)', () => {
        expect(firstSeenExport(new Date(NOW + 2 * DAY_MS).toISOString(), NOW)).toBeUndefined();
    });

    it('utelämnar saknade och oparsbara värden', () => {
        expect(firstSeenExport(undefined, NOW)).toBeUndefined();
        expect(firstSeenExport(null, NOW)).toBeUndefined();
        expect(firstSeenExport('', NOW)).toBeUndefined();
        expect(firstSeenExport('inte ett datum', NOW)).toBeUndefined();
        expect(firstSeenExport(1234567890, NOW)).toBeUndefined();
    });
});
