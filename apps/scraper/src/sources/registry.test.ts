/**
 * Registry-sanity — fångar felkonfig vid testkörning istället för i nattjobbet:
 * dubblerade ids, engine-namn utan implementation, ogiltiga statusar/frekvenser.
 */
import { describe, it, expect } from 'vitest';
import { SOURCES, ENGINES } from './index';

describe('source-registryt', () => {
    it('alla ids är unika', () => {
        const seen = new Map<string, number>();
        for (const s of SOURCES) seen.set(s.id, (seen.get(s.id) ?? 0) + 1);
        const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id);
        expect(dupes).toEqual([]);
    });

    it('varje source pekar på en engine som finns i ENGINES', () => {
        const known = new Set(Object.keys(ENGINES));
        const orphans = SOURCES.filter((s) => !known.has(s.engine)).map((s) => `${s.id} → ${s.engine}`);
        expect(orphans).toEqual([]);
    });

    it('status och updateFrequency håller sig till taxonomin', () => {
        const statuses = new Set(['active', 'experimental', 'dead', undefined]);
        const freqs = new Set(['hourly', 'daily', 'every-3d', 'weekly', undefined]);
        const badStatus = SOURCES.filter((s) => !statuses.has(s.status)).map((s) => s.id);
        const badFreq = SOURCES.filter((s) => !freqs.has(s.updateFrequency)).map((s) => s.id);
        expect(badStatus).toEqual([]);
        expect(badFreq).toEqual([]);
    });

    it('grundfält är ifyllda (id, hostName, config) och windowDays är rimligt', () => {
        for (const s of SOURCES) {
            expect(s.id, 'id saknas').toBeTruthy();
            expect(s.hostName, `${s.id}: hostName saknas`).toBeTruthy();
            expect(s.config, `${s.id}: config saknas`).toBeDefined();
            if (s.windowDays !== undefined) {
                expect(s.windowDays, `${s.id}: windowDays utanför 1–365`).toBeGreaterThan(0);
                expect(s.windowDays, `${s.id}: windowDays utanför 1–365`).toBeLessThanOrEqual(365);
            }
        }
    });

    it('nätverkskällorna (paraply-API:erna) finns och är aktiva', () => {
        const networks = ['hembygd', 'svenska-kyrkan', 'naturskyddsforeningen', 'rotary', 'roda-korset'];
        for (const id of networks) {
            const s = SOURCES.find((x) => x.id === id);
            expect(s, `${id} saknas i registryt`).toBeDefined();
            expect(s!.status).toBe('active');
        }
    });
});
