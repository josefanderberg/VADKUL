/**
 * SQLite-upsertens semantik — körs mot :memory: (via vitest.config env).
 * Pinnar reglerna som resten av pipelinen lutar sig mot:
 *   - status sätts vid INSERT men bevaras vid re-scrape (ändras bara via setEventStatus)
 *   - price '' skriver ALDRIG över ett sparat värde (LLM-extraherade priser överlever)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
    upsertEvent, sqliteEventExists, getSqliteEvent, setEventStatus,
    recordScrapeRun, getRunsBySource, upsertKnownVenue, lookupVenueExact,
    getSyncMeta, setSyncMeta,
} from './sqliteHelper';

beforeAll(() => {
    // Säkerhetsbälte: vitest.config sätter SCRAPER_SQLITE_PATH=':memory:'.
    expect(process.env.SCRAPER_SQLITE_PATH).toBe(':memory:');
});

function ev(url: string, overrides: Record<string, unknown> = {}) {
    return {
        url,
        title: 'Testevent',
        time: new Date('2026-06-20T18:00:00Z'),
        ...overrides,
    };
}

describe('upsertEvent', () => {
    it('insert + exists + läsning fungerar, default-status är published', () => {
        upsertEvent(ev('https://t.se/1'));
        expect(sqliteEventExists('https://t.se/1')).toBe(true);
        const row = getSqliteEvent('https://t.se/1');
        expect(row.status).toBe('published');
        expect(row.category).toBe('other');   // default
    });

    it('status bevaras vid re-scrape — bara setEventStatus ändrar den', () => {
        upsertEvent(ev('https://t.se/2', { status: 'raw' }));
        upsertEvent(ev('https://t.se/2', { status: 'published', title: 'Uppdaterad' }));
        const row = getSqliteEvent('https://t.se/2');
        expect(row.title).toBe('Uppdaterad');     // övriga fält uppdateras...
        expect(row.status).toBe('raw');           // ...men status rörs inte

        setEventStatus('https://t.se/2', 'published');
        expect(getSqliteEvent('https://t.se/2').status).toBe('published');
    });

    it("price '' skriver inte över sparat pris (LLM-extraherat överlever re-scrape)", () => {
        upsertEvent(ev('https://t.se/3', { price: '150 kr' }));
        upsertEvent(ev('https://t.se/3', { price: '' }));
        expect(getSqliteEvent('https://t.se/3').price).toBe('150 kr');

        upsertEvent(ev('https://t.se/3', { price: '200 kr' }));   // riktigt värde uppdaterar
        expect(getSqliteEvent('https://t.se/3').price).toBe('200 kr');
    });

    it('firestoreId bevaras när senare skrivningar saknar den', () => {
        upsertEvent(ev('https://t.se/4', { firestoreId: 'fs-abc' }));
        upsertEvent(ev('https://t.se/4'));
        expect(getSqliteEvent('https://t.se/4').firestoreId).toBe('fs-abc');
    });
});

describe('recordScrapeRun', () => {
    it('skriver och läser run-historik per källa', () => {
        recordScrapeRun({
            sourceId: 'test-src', hostName: 'Test', startedAt: new Date(),
            durationMs: 1234, found: 10, saved: 7,
            skippedDuplicate: 2, skippedOutsideWindow: 1, skippedInvalid: 0,
            errorCount: 1, firstError: 'engine threw: boom',
        });
        const runs = getRunsBySource('test-src');
        expect(runs).toHaveLength(1);
        expect(runs[0].saved).toBe(7);
        expect(runs[0].first_error).toBe('engine threw: boom');
    });
});

describe('known_venues', () => {
    it('upsert + exakt uppslag', () => {
        upsertKnownVenue('Vida Arena', 56.8797, 14.7736, 'Växjö');
        expect(lookupVenueExact('Vida Arena')).toEqual([56.8797, 14.7736]);
        expect(lookupVenueExact('Okänd Arena')).toBeNull();
    });
});

describe('sync_meta', () => {
    it('okänd nyckel → null; set + överskrivning fungerar', () => {
        expect(getSyncMeta('test.cursor')).toBeNull();
        setSyncMeta('test.cursor', '2026-08-17T00:30:00.000Z');
        expect(getSyncMeta('test.cursor')).toBe('2026-08-17T00:30:00.000Z');
        setSyncMeta('test.cursor', '2026-08-18T00:30:00.000Z');
        expect(getSyncMeta('test.cursor')).toBe('2026-08-18T00:30:00.000Z');
    });
});
