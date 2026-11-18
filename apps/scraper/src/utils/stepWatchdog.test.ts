import { describe, it, expect } from 'vitest';
import { watchdogVerdict, tapStreamActivity, runWithWatchdog } from './stepWatchdog';

const MIN = 60_000;
const base = { startedAt: 0, stallMs: 30 * MIN, maxMs: 14 * 60 * MIN };

describe('watchdogVerdict', () => {
    it('aktivt steg får fortsätta', () => {
        expect(watchdogVerdict({ ...base, now: 60 * MIN, lastActivityAt: 55 * MIN })).toBeNull();
    });

    it('tyst längre än stallMs = häng (17/11: tyst från 03:37)', () => {
        expect(watchdogVerdict({ ...base, now: 100 * MIN, lastActivityAt: 60 * MIN })).toBe('stall');
    });

    it('precis på gränsen räknas inte som häng', () => {
        expect(watchdogVerdict({ ...base, now: 90 * MIN, lastActivityAt: 60 * MIN })).toBeNull();
    });

    it('aktivitet före start räknas från starten, inte från gammal loggrad', () => {
        expect(watchdogVerdict({ ...base, startedAt: 100 * MIN, now: 110 * MIN, lastActivityAt: 0 })).toBeNull();
        expect(watchdogVerdict({ ...base, startedAt: 100 * MIN, now: 131 * MIN, lastActivityAt: 0 })).toBe('stall');
    });

    it('över taket = overtime även om steget loggar', () => {
        expect(watchdogVerdict({ ...base, now: 14 * 60 * MIN + 1, lastActivityAt: 14 * 60 * MIN })).toBe('overtime');
    });
});

describe('tapStreamActivity', () => {
    it('stämplar varje skrivning och skickar den vidare oförändrad', () => {
        const written: string[] = [];
        const stream = { write: (s: string) => { written.push(s); return true; } };
        let t = 1000;
        const tap = tapStreamActivity([stream], () => t);
        expect(tap.lastActivityAt()).toBe(1000);
        t = 5000;
        expect(stream.write('rad\n')).toBe(true);
        expect(tap.lastActivityAt()).toBe(5000);
        expect(written).toEqual(['rad\n']);
        tap.restore();
        t = 9000;
        stream.write('efter\n');
        expect(tap.lastActivityAt()).toBe(5000);
        expect(written).toEqual(['rad\n', 'efter\n']);
    });
});

describe('runWithWatchdog', () => {
    it('klart steg ger done', async () => {
        const out = await runWithWatchdog(async () => 'ok', {
            stallMs: 1000, maxMs: 10_000, lastActivityAt: () => Date.now(), checkEveryMs: 5,
        });
        expect(out).toBe('done');
    });

    it('löfte som aldrig löses släpps som stall', async () => {
        const silentSince = Date.now();
        const out = await runWithWatchdog(() => new Promise(() => {}), {
            stallMs: 20, maxMs: 10_000, lastActivityAt: () => silentSince, checkEveryMs: 5,
        });
        expect(out).toBe('stall');
    });

    it('steg som loggar men aldrig blir klart släpps som overtime', async () => {
        const out = await runWithWatchdog(() => new Promise(() => {}), {
            stallMs: 10_000, maxMs: 20, lastActivityAt: () => Date.now(), checkEveryMs: 5,
        });
        expect(out).toBe('overtime');
    });

    it('fel i steget bubblar vidare', async () => {
        await expect(runWithWatchdog(async () => { throw new Error('krasch'); }, {
            stallMs: 1000, maxMs: 10_000, lastActivityAt: () => Date.now(), checkEveryMs: 5,
        })).rejects.toThrow('krasch');
    });
});
