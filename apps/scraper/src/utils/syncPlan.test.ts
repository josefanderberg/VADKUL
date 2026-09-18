/**
 * planSync — pinnar reglerna som avgör när synken får vara inkrementell:
 * cursorn krävs, hel sync var 7:e dag som självläkning, och överlappet
 * bakåt så klockskev/samtidiga skrivningar aldrig tappas.
 */
import { describe, it, expect } from 'vitest';
import { planSync, syncSkipReason, CURSOR_OVERLAP_MS, FULL_SYNC_INTERVAL_DAYS } from './syncPlan';

const NOW = new Date('2026-08-17T00:30:00.000Z');
const YESTERDAY = '2026-08-16T00:30:00.000Z';

describe('planSync', () => {
    it('--full tvingar hel sync', () => {
        const p = planSync({ now: NOW, lastSyncAt: YESTERDAY, lastFullSyncAt: YESTERDAY, forceFull: true });
        expect(p.mode).toBe('full');
    });

    it('ingen cursor → hel sync (första körningen)', () => {
        expect(planSync({ now: NOW, lastSyncAt: null, lastFullSyncAt: null }).mode).toBe('full');
    });

    it('ogiltig cursor → hel sync', () => {
        expect(planSync({ now: NOW, lastSyncAt: 'trasig', lastFullSyncAt: YESTERDAY }).mode).toBe('full');
    });

    it('färsk cursor + färsk hel-sync → inkrementell med överlapp', () => {
        const p = planSync({ now: NOW, lastSyncAt: YESTERDAY, lastFullSyncAt: YESTERDAY });
        expect(p.mode).toBe('incremental');
        expect(p.since!.getTime()).toBe(new Date(YESTERDAY).getTime() - CURSOR_OVERLAP_MS);
    });

    it('hel-sync äldre än intervallet → hel sync (självläkning)', () => {
        const old = new Date(NOW.getTime() - (FULL_SYNC_INTERVAL_DAYS + 1) * 86_400_000).toISOString();
        const p = planSync({ now: NOW, lastSyncAt: YESTERDAY, lastFullSyncAt: old });
        expect(p.mode).toBe('full');
    });

    it('cursor finns men hel-sync saknas → hel sync', () => {
        expect(planSync({ now: NOW, lastSyncAt: YESTERDAY, lastFullSyncAt: null }).mode).toBe('full');
    });
});

describe('syncSkipReason', () => {
    it('släpper igenom skrapade event med url', () => {
        expect(syncSkipReason({ url: 'https://example.se/event/1' })).toBeNull();
        expect(syncSkipReason({ url: 'https://example.se/event/1', userCreated: false })).toBeNull();
    });

    it('hoppar över länklösa event (tom primärnyckel)', () => {
        expect(syncSkipReason({ url: '' })).toBe('noUrl');
        expect(syncSkipReason({})).toBe('noUrl');
    });

    it('hoppar över TIPS — användarskapade MED url (dubblettbuggen 18/9)', () => {
        expect(syncSkipReason({ url: 'https://sinclairs.se/stockholm/maskeradfest/', userCreated: true })).toBe('userCreated');
    });

    it('hoppar över VADKUL-värdade event som användarskapade, inte som länklösa', () => {
        expect(syncSkipReason({ url: '', userCreated: true })).toBe('userCreated');
    });
});
