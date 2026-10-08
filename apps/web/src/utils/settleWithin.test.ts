import { describe, it, expect, vi } from 'vitest';
import { settleWithin } from './settleWithin';

describe('settleWithin', () => {
    it('ger löftets värde när det hinner', async () => {
        await expect(settleWithin(Promise.resolve(42), 1000)).resolves.toBe(42);
    });

    it('går vidare med timeout när löftet aldrig löser sig', async () => {
        vi.useFakeTimers();
        const p = settleWithin(new Promise(() => {}), 6000);
        await vi.advanceTimersByTimeAsync(6000);
        await expect(p).resolves.toBe('timeout');
        vi.useRealTimers();
    });

    it('fel i löftet bubblar som vanligt', async () => {
        await expect(settleWithin(Promise.reject(new Error('nej')), 1000)).rejects.toThrow('nej');
    });
});
