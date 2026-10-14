import { describe, it, expect, vi } from 'vitest';
import { TODAY_SLICE_BOOT } from './todaySliceBoot';

// Kör den RIKTIGA skriptsträngen (som layouten inlinar) mot stubbade globaler.
function runBoot(userAgent: string, search = '') {
    const fetchStub = vi.fn(() => Promise.resolve({ ok: true, json: async () => ({}) }));
    const win: Record<string, unknown> = {};
    new Function('window', 'navigator', 'fetch', 'location', TODAY_SLICE_BOOT)(
        win, { userAgent }, fetchStub, { search },
    );
    return { urls: fetchStub.mock.calls.map((c: unknown[]) => String(c[0])), win };
}

describe('kartans boot-script', () => {
    it('startar dagsfilen, dagsslicen och djuplänkens event för en vanlig webbläsare', () => {
        const { urls, win } = runBoot(
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
            '?event=https%3A%2F%2Fa.se%2Fx',
        );
        expect(urls[0]).toBe('/events-today.json');
        expect(urls[1]).toMatch(/^\/api\/events\/destinations\?from=.+&to=.+/);
        expect(urls[2]).toBe('/api/event?id=https%3A%2F%2Fa.se%2Fx');
        expect(win.__vadkulTodayStatic).toBeInstanceOf(Promise);
        expect(typeof win.__vadkulTodaySliceDay).toBe('string');
    });

    it('en bot (samma regel som API-vakten) hämtar ingenting', () => {
        for (const ua of [
            'Mozilla/5.0 (compatible; Baiduspider-render/2.0; +http://www.baidu.com/search/spider.html)',
            'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Reflectionbot/1.0; +https://reflection.ai/bot) Chrome/151.0.0.0 Safari/537.36',
        ]) {
            const { urls, win } = runBoot(ua, '?event=https%3A%2F%2Fa.se%2Fx');
            expect(urls).toEqual([]);
            expect(win).toEqual({});
        }
    });

    it('headless-verktyg (studion spelar in kartan) räknas inte som bot', () => {
        const { urls } = runBoot('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/122.0.6261.128 Safari/537.36');
        expect(urls).toHaveLength(2);
    });
});
