import { describe, it, expect } from 'vitest';
import { AuditBackoff, BACKOFF_MAX_MS, backoffMs } from './auditBackoff';

const MIN = 60_000;
const rad = (url: string) => ({ url });

describe('backoffMs', () => {
    it('30 min, 2 h, 8 h, sedan taket ett dygn', () => {
        expect(backoffMs(1)).toBe(30 * MIN);
        expect(backoffMs(2)).toBe(120 * MIN);
        expect(backoffMs(3)).toBe(480 * MIN);
        expect(backoffMs(4)).toBe(BACKOFF_MAX_MS);
        expect(backoffMs(40)).toBe(BACKOFF_MAX_MS);
    });
});

describe('AuditBackoff', () => {
    it('ett fallerat event väntar och kommer tillbaka när tiden gått', () => {
        const b = new AuditBackoff();
        expect(b.failed('a', 0)).toBe(30 * MIN);
        expect(b.waiting('a', 29 * MIN)).toBe(true);
        expect(b.waiting('a', 30 * MIN)).toBe(false);
        expect(b.failed('a', 30 * MIN)).toBe(120 * MIN); // andra gången längre
    });

    it('lyckat försök släpper eventet helt', () => {
        const b = new AuditBackoff();
        b.failed('a', 0);
        b.failed('a', 0);
        b.succeeded('a');
        expect(b.waiting('a', 0)).toBe(false);
        expect(b.failed('a', 0)).toBe(30 * MIN); // räknas från början igen
    });

    it('kön 30/10: de fallerade först i kön hoppas över, nästa i tur fyller batchen', () => {
        const b = new AuditBackoff();
        const kö = ['match1', 'match2', 'match3', 'konsert', 'loppis', 'quiz'].map(rad);
        b.failed('match1', 0);
        b.failed('match2', 0);
        b.failed('match3', 0);
        expect(b.waitingCount(MIN)).toBe(3);
        expect(b.pick(kö, 2, MIN).map(r => r.url)).toEqual(['konsert', 'loppis']);
        // när väntan är över står matcherna först igen
        expect(b.pick(kö, 2, 31 * MIN).map(r => r.url)).toEqual(['match1', 'match2']);
        expect(b.waitingCount(31 * MIN)).toBe(0);
    });
});
