import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startVisiblePoll, type VisibilitySource } from './visiblePoll';

function fakeDoc(initial: 'visible' | 'hidden') {
    const listeners = new Set<() => void>();
    const doc = {
        visibilityState: initial as string,
        addEventListener: (_: 'visibilitychange', fn: () => void) => { listeners.add(fn); },
        removeEventListener: (_: 'visibilitychange', fn: () => void) => { listeners.delete(fn); },
    };
    const set = (state: 'visible' | 'hidden') => {
        doc.visibilityState = state;
        for (const fn of [...listeners]) fn();
    };
    return { doc: doc as VisibilitySource, set, listenerCount: () => listeners.size };
}

const MIN = 60_000;

describe('startVisiblePoll', () => {
    beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
    afterEach(() => { vi.useRealTimers(); });

    it('hämtar direkt och sedan en gång per intervall medan fliken syns', () => {
        const f = fakeDoc('visible');
        const run = vi.fn();
        startVisiblePoll(run, 5 * MIN, f.doc);
        expect(run).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(15 * MIN);
        expect(run).toHaveBeenCalledTimes(4);
    });

    it('dold flik kostar ingenting, hur länge den än ligger', () => {
        const f = fakeDoc('visible');
        const run = vi.fn();
        startVisiblePoll(run, 30_000, f.doc);
        f.set('hidden');
        run.mockClear();
        vi.advanceTimersByTime(24 * 60 * MIN);
        expect(run).not.toHaveBeenCalled();
    });

    it('sida som startar dold hämtar först när den syns', () => {
        const f = fakeDoc('hidden');
        const run = vi.fn();
        startVisiblePoll(run, 5 * MIN, f.doc);
        expect(run).not.toHaveBeenCalled();
        vi.advanceTimersByTime(2 * MIN);
        f.set('visible');
        expect(run).toHaveBeenCalledTimes(1);
    });

    it('åter till fliken efter länge: hämtar direkt i stället för att vänta ut varvet', () => {
        const f = fakeDoc('visible');
        const run = vi.fn();
        startVisiblePoll(run, 5 * MIN, f.doc);
        f.set('hidden');
        vi.advanceTimersByTime(60 * MIN);
        run.mockClear();
        f.set('visible');
        expect(run).toHaveBeenCalledTimes(1);
    });

    it('snabba flikbyten kostar inga extra varv', () => {
        const f = fakeDoc('visible');
        const run = vi.fn();
        startVisiblePoll(run, 5 * MIN, f.doc);
        for (let i = 0; i < 10; i++) {
            vi.advanceTimersByTime(10_000);
            f.set('hidden');
            f.set('visible');
        }
        expect(run).toHaveBeenCalledTimes(1);
    });

    it('stopp: inga fler varv och lyssnaren tas bort', () => {
        const f = fakeDoc('visible');
        const run = vi.fn();
        const stop = startVisiblePoll(run, 30_000, f.doc);
        stop();
        expect(f.listenerCount()).toBe(0);
        vi.advanceTimersByTime(10 * MIN);
        expect(run).toHaveBeenCalledTimes(1);
    });

    it('utan dokument (server/tester) räknas fliken som synlig', () => {
        const run = vi.fn();
        const stop = startVisiblePoll(run, MIN, undefined);
        vi.advanceTimersByTime(3 * MIN);
        expect(run).toHaveBeenCalledTimes(4);
        stop();
    });
});
