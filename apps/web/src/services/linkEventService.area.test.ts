import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LinkEvent } from '../types';

// Rutläget i linkEventService mot en STUBBAD fetch (inget nät, ingen
// Firebase): vilka URL:er kartan ber om, och vad som når kartan.
vi.mock('../lib/firebase', () => ({ db: null }));

const sthlm = { id: 'https://a.se/sthlm', title: 'Stockholmsevent', time: '2026-10-04T16:00:00.000Z', lat: 59.33, lng: 18.07, category: 'music' };
const gbg = { id: 'https://b.se/gbg', title: 'Göteborgsevent', time: '2026-10-04T16:00:00.000Z', lat: 57.71, lng: 11.97, category: 'music' };

let calls: string[] = [];
function stubFetch() {
    calls = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        calls.push(url);
        const u = new URL(url, 'http://x');
        const json = (body: unknown) => ({ ok: true, json: async () => body });
        if (u.pathname === '/api/events/destinations') {
            const tile = u.searchParams.get('tile');
            if (tile === '118_18') return json({ events: [sthlm] });
            if (tile) return json({ events: [] });
            return json({ events: [sthlm, gbg] });   // hela landet
        }
        if (u.pathname === '/api/events/cards') return json({ events: [] });
        if (u.pathname === '/api/events/descriptions') {
            return json({ data: { [sthlm.id]: 'Beskrivningen.' } });
        }
        if (u.pathname === '/api/event') {
            const id = u.searchParams.get('id');
            if (id === gbg.id) return json({ event: gbg });
            return { ok: false, status: 404, json: async () => null };
        }
        return { ok: false, status: 404, json: async () => null };
    }));
}

const flush = async () => { for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0)); };

async function freshService() {
    vi.resetModules();
    return (await import('./linkEventService')).linkEventService;
}

// Stockholm: vyn + veckovyns 60 km-cirkel → en handfull rutor.
const sthlmArea = { west: 17.0, south: 59.0, east: 19.1, north: 59.8 };

describe('rutläget', () => {
    beforeEach(() => stubFetch());

    it('hämtar bara rutorna runt området — aldrig hela landet', async () => {
        const svc = await freshService();
        let last: LinkEvent[] = [];
        const unsub = svc.subscribeToAll(true, (evts) => { last = evts; }, undefined, { area: true });
        svc.setDataArea(sthlmArea);
        await flush();
        const dest = calls.filter((c) => c.startsWith('/api/events/destinations'));
        expect(dest.length).toBeGreaterThan(0);
        expect(dest.every((c) => c.includes('tile='))).toBe(true);
        expect(calls.some((c) => c.startsWith('/api/events/cards'))).toBe(false);   // kortlagret inte begärt
        expect(last.map((e) => e.id)).toEqual([sthlm.id]);
        expect(svc.isAreaLoaded({ west: 18.0, south: 59.3, east: 18.1, north: 59.4 })).toBe(true);
        expect(svc.isAreaLoaded({ west: 11.9, south: 57.6, east: 12.0, north: 57.8 })).toBe(false);   // Göteborg
        expect(svc.isNationwide()).toBe(false);
        unsub();
    });

    it('kortlagret hämtas per ruta när ett kort öppnas', async () => {
        const svc = await freshService();
        const unsub = svc.subscribeToAll(true, () => {}, undefined, { area: true });
        svc.setDataArea(sthlmArea);
        await flush();
        void svc.requestCards();
        await flush();
        const cards = calls.filter((c) => c.startsWith('/api/events/cards'));
        expect(cards.length).toBeGreaterThan(0);
        expect(cards.every((c) => c.includes('tile='))).toBe(true);
        unsub();
    });

    it('requestNationwide (sökning) tar landslagret — och då gäller hela landet som laddat', async () => {
        const svc = await freshService();
        let last: LinkEvent[] = [];
        const unsub = svc.subscribeToAll(true, (evts) => { last = evts; }, undefined, { area: true });
        svc.setDataArea(sthlmArea);
        await flush();
        svc.releaseHeavyLayers();   // kartan har målat (annars väntar kortsteget ut säkerhetsnätet)
        await svc.requestNationwide();
        await flush();
        expect(calls.some((c) => c.startsWith('/api/events/destinations') && !c.includes('tile='))).toBe(true);
        expect(last.map((e) => e.id).sort()).toEqual([gbg.id, sthlm.id].sort());
        expect(svc.isNationwide()).toBe(true);
        expect(svc.isAreaLoaded({ west: 11.9, south: 57.6, east: 12.0, north: 57.8 })).toBe(true);
        unsub();
    });

    it('en för bred vy laddar INTE landet direkt (första besökets Sverige-vy innan GPS-hoppet)', async () => {
        const svc = await freshService();
        const unsub = svc.subscribeToAll(true, () => {}, undefined, { area: true });
        svc.setDataArea({ west: 10, south: 55, east: 24, north: 69 });
        await flush();
        expect(calls.some((c) => c.startsWith('/api/events/destinations') && !c.includes('?'))).toBe(false);
        // Hoppet landar i en stad innan pausen gått ut → bara rutor.
        svc.setDataArea(sthlmArea);
        await flush();
        expect(calls.filter((c) => c.startsWith('/api/events/destinations')).every((c) => c.includes('tile='))).toBe(true);
        unsub();
    });

    it('seedArea (första besöket): rutorna förhämtas och tyst-fallbacken tar aldrig hela landet', async () => {
        vi.useFakeTimers();
        try {
            const svc = await freshService();
            // Samma ordning som sidan: prenumerationen startar (tyst-timern
            // armeras), sedan förhämtar mount-effekten blindstartsstaden.
            const unsub = svc.subscribeToAll(true, () => {}, undefined, { area: true });
            svc.seedArea(sthlmArea);
            // Långt förbi AREA_SILENCE_MS - kartan har ännu inte rapporterat
            // någon vy (långsam mobil), men rutorna är begärda så landet ska
            // INTE hämtas.
            await vi.advanceTimersByTimeAsync(10000);
            const dest = calls.filter((c) => c.startsWith('/api/events/destinations'));
            expect(dest.length).toBeGreaterThan(0);
            expect(dest.every((c) => c.includes('tile='))).toBe(true);
            expect(svc.isNationwide()).toBe(false);
            unsub();
        } finally {
            vi.useRealTimers();
        }
    });

    it('seedArea rör inte wide-fallbackens frist: Sverige-vyn efter en seed väntar fortfarande', async () => {
        vi.useFakeTimers();
        try {
            const svc = await freshService();
            const unsub = svc.subscribeToAll(true, () => {}, undefined, { area: true });
            svc.seedArea(sthlmArea);
            // Kartan laddar klart och rapporterar Sverige-översikten (första
            // besökets startvy). Blindhoppet landar inom ~2,5 s - fristen för
            // första vyn (4 s) får inte ha kortats av seeden.
            svc.setDataArea({ west: 10, south: 55, east: 24, north: 69 });
            await vi.advanceTimersByTimeAsync(2500);
            expect(svc.isNationwide()).toBe(false);
            // Stadshoppet landar -> bara rutor, wide-timern töms.
            svc.setDataArea(sthlmArea);
            await vi.advanceTimersByTimeAsync(10000);
            expect(svc.isNationwide()).toBe(false);
            expect(calls.filter((c) => c.startsWith('/api/events/destinations')).every((c) => c.includes('tile='))).toBe(true);
            unsub();
        } finally {
            vi.useRealTimers();
        }
    });

    it('beskrivningen hämtas som EN hink och mergas in i eventet', async () => {
        const svc = await freshService();
        let last: LinkEvent[] = [];
        const unsub = svc.subscribeToAll(true, (evts) => { last = evts; }, undefined, { area: true });
        svc.setDataArea(sthlmArea);
        await flush();
        expect(svc.descriptionSettledFor(sthlm.id)).toBe(false);
        await svc.requestDescriptionFor(sthlm.id);
        await flush();
        expect(calls.filter((c) => c.startsWith('/api/events/descriptions'))).toHaveLength(1);
        expect(calls.find((c) => c.startsWith('/api/events/descriptions'))).toMatch(/\?bucket=\d+$/);
        expect(svc.descriptionSettledFor(sthlm.id)).toBe(true);
        expect(last.find((e) => e.id === sthlm.id)?.description).toBe('Beskrivningen.');
        // Samma hink igen: ingen ny hämtning.
        await svc.requestDescriptionFor(sthlm.id);
        expect(calls.filter((c) => c.startsWith('/api/events/descriptions'))).toHaveLength(1);
        unsub();
    });

    it('ensureEvents: ett sparat event i en annan stad hämtas styckvis och syns', async () => {
        const svc = await freshService();
        let last: LinkEvent[] = [];
        const unsub = svc.subscribeToAll(true, (evts) => { last = evts; }, undefined, { area: true });
        svc.setDataArea(sthlmArea);
        await flush();
        const found = await svc.ensureEvents([gbg.id, sthlm.id, 'https://finns.inte/x']);
        await flush();
        // Stockholmseventet var redan känt → inget uppslag; Göteborg hämtat,
        // missen frågad EN gång (404 = definitivt, inget omtag).
        expect(calls.filter((c) => c.startsWith('/api/event?'))).toHaveLength(2);
        expect([...found.keys()]).toEqual([gbg.id]);
        expect(last.map((e) => e.id).sort()).toEqual([gbg.id, sthlm.id].sort());
        // En miss frågas inte om.
        await svc.ensureEvents(['https://finns.inte/x']);
        expect(calls.filter((c) => c.startsWith('/api/event?'))).toHaveLength(2);
        unsub();
    });

    it('utan rutläget: gamla vägen (landets tidsfönster), rutvakten säger alltid laddat', async () => {
        const svc = await freshService();
        const unsub = svc.subscribeToAll(true, () => {});
        await flush();
        expect(calls.some((c) => c.startsWith('/api/events/destinations?from='))).toBe(true);
        expect(calls.some((c) => c.includes('tile='))).toBe(false);
        expect(svc.isAreaLoaded({ west: 11.9, south: 57.6, east: 12.0, north: 57.8 })).toBe(true);
        unsub();
    });
});
