import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LinkEvent } from '../types';

// Botar och bot-spärren i linkEventService mot STUBBAD fetch (inget nät,
// ingen Firebase). Bakgrund: efter 403-spärren 14/10 föll klienten vidare
// till de statiska helfilerna (/events-destinations.json + /events-cards.json,
// 1,8 + 1,1 MB br) för varje bot-rendering av kartan.
vi.mock('../lib/firebase', () => ({ db: null }));

const BOT_UA = 'Mozilla/5.0 (compatible; Baiduspider-render/2.0; +http://www.baidu.com/search/spider.html)';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
const sthlm = { id: 'https://a.se/sthlm', title: 'Stockholmsevent', time: '2026-10-04T16:00:00.000Z', lat: 59.33, lng: 18.07, category: 'music' };
const sthlmArea = { west: 17.0, south: 59.0, east: 19.1, north: 59.8 };
const STATIC_FULL = ['/events-destinations.json', '/events-cards.json'];

let calls: string[] = [];
type StubResponse = { ok: boolean; status: number; headers?: Headers; json: () => Promise<unknown> };
/** API:t svarar `apiStatus` på allt; statiska filerna finns (hela landet). */
function stubFetch(apiStatus: number, botHeader: boolean) {
    calls = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string): Promise<StubResponse> => {
        calls.push(url);
        const u = new URL(url, 'http://x');
        if (u.pathname.startsWith('/api/')) {
            return {
                ok: false,
                status: apiStatus,
                headers: new Headers(botHeader ? { 'x-vadkul-bot': '1' } : {}),
                json: async () => null,
            };
        }
        if (u.pathname === '/events-destinations.json' || u.pathname === '/events-cards.json') {
            return { ok: true, status: 200, json: async () => ({ events: [sthlm] }) };
        }
        return { ok: false, status: 404, json: async () => null };
    }));
}

async function freshService() {
    vi.resetModules();
    return (await import('./linkEventService')).linkEventService;
}

// Första testet betalar den färska modulimporten (vi.resetModules), som under
// full svit-last kan gå över vitests 5 s.
describe('botar får ingen eventdata', { timeout: 20000 }, () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('en bot-webbläsare hämtar ingenting - och kartan får ett definitivt tomt besked', async () => {
        vi.stubGlobal('navigator', { userAgent: BOT_UA });
        stubFetch(200, false);
        const svc = await freshService();
        let last: LinkEvent[] | null = null;
        let settled = false;
        const unsub = svc.subscribeToAll(true, (evts) => { last = evts; }, () => { settled = true; }, { area: true });
        svc.setDataArea(sthlmArea);
        void svc.requestCards();
        void svc.requestDescriptionFor(sthlm.id);
        await svc.ensureEvents(['https://b.se/gbg']);
        expect(await svc.fetchNationalDayCounts()).toBeNull();
        await vi.advanceTimersByTimeAsync(20000);
        expect(calls).toEqual([]);
        expect(last).toEqual([]);
        expect(settled).toBe(true);
        unsub();
    });

    it('bot-spärr från servern (UA:t syns inte i webbläsaren): aldrig de statiska helfilerna', async () => {
        vi.stubGlobal('navigator', { userAgent: IPHONE_UA });
        stubFetch(403, true);
        const svc = await freshService();
        const unsub = svc.subscribeToAll(true, () => {}, undefined, { area: true });
        svc.setDataArea(sthlmArea);
        void svc.requestCards();
        await vi.advanceTimersByTimeAsync(20000);
        expect(calls.some((c) => c.startsWith('/api/'))).toBe(true);
        expect(calls.filter((c) => STATIC_FULL.includes(c))).toEqual([]);
        // Spärren gäller resten av sidan: inga fler API-frågor efteråt.
        const before = calls.length;
        await svc.ensureEvents(['https://b.se/gbg']);
        void svc.requestDescriptionFor(sthlm.id);
        await vi.advanceTimersByTimeAsync(5000);
        expect(calls.length).toBe(before);
        unsub();
    });

    it('en vanlig 403 (t.ex. Cloud Run-behörighet efter deploy) räddas fortfarande av snapshoten', async () => {
        vi.stubGlobal('navigator', { userAgent: IPHONE_UA });
        stubFetch(403, false);
        const svc = await freshService();
        let last: LinkEvent[] = [];
        const unsub = svc.subscribeToAll(true, (evts) => { last = evts; }, undefined, { area: true });
        svc.setDataArea(sthlmArea);
        await vi.advanceTimersByTimeAsync(20000);
        expect(calls).toContain('/events-destinations.json');
        expect(last.map((e) => e.id)).toEqual([sthlm.id]);
        unsub();
    });
});
