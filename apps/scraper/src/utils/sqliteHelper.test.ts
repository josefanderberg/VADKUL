/**
 * SQLite-upsertens semantik — körs mot :memory: (via vitest.config env).
 * Pinnar reglerna som resten av pipelinen lutar sig mot:
 *   - status sätts vid INSERT men bevaras vid re-scrape (ändras bara via setEventStatus)
 *   - price '' skriver ALDRIG över ett sparat värde (LLM-extraherade priser överlever)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
    upsertEvent, sqliteEventExists, getSqliteEvent, setEventStatus,
    recordScrapeRun, getRunsBySource, upsertKnownVenue, lookupVenueExact, lookupVenueSmart, lookupVenueNear,
    getSyncMeta, setSyncMeta, deleteEventsByFirestoreIds,
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

describe('lookupVenueNear — registerträff på närhet när stadsnamnen inte går att jämföra', () => {
    // Botkyrkas mittpunkt (Tumba) — dit eventen föll.
    const BOTKYRKA: [number, number] = [59.2006, 17.8343];

    it('kommunen i frågan, postorten i registret: Fittja bibliotek hittas', () => {
        upsertKnownVenue('Fittja Bibliotek', 59.2484, 17.8604, 'Norsborg');
        expect(lookupVenueSmart('Fittja bibliotek', 'Botkyrka')).toBeNull();          // stadskravet missar
        expect(lookupVenueNear('Fittja bibliotek', ...BOTKYRKA, 25)).toEqual([59.2484, 17.8604]);
    });

    it('en namne i en annan del av landet godtas inte', () => {
        upsertKnownVenue('Sagabiografen Testort', 65.32, 21.47, 'Piteå');
        expect(lookupVenueNear('Sagabiografen Testort', ...BOTKYRKA, 25)).toBeNull();
    });

    it('generiska namn matchas aldrig på närhet — grannkommunens ligger också inom radien', () => {
        upsertKnownVenue('Stadsbiblioteket', 59.2001, 17.8301, 'Tumba');
        expect(lookupVenueNear('Stadsbiblioteket', ...BOTKYRKA, 25)).toBeNull();
        expect(lookupVenueNear('Bio', ...BOTKYRKA, 25)).toBeNull();                    // för kort
    });

    it('rums- och scennamn är delar av en lokal, inte en plats', () => {
        upsertKnownVenue('Stora Scen', 59.21, 17.84, 'Tumba');
        upsertKnownVenue('Hörsalen', 59.21, 17.84, 'Tumba');
        upsertKnownVenue('Scen 2', 59.21, 17.84, 'Tumba');
        expect(lookupVenueNear('Stora Scen', ...BOTKYRKA, 25)).toBeNull();
        expect(lookupVenueNear('Hörsalen', ...BOTKYRKA, 25)).toBeNull();
        expect(lookupVenueNear('Scen 2', ...BOTKYRKA, 25)).toBeNull();
        expect(lookupVenueNear('Huvudbiblioteket', ...BOTKYRKA, 25)).toBeNull();
    });

    it('föreningsnamn är ingen plats', () => {
        upsertKnownVenue('PRO Tumba', 59.2100, 17.8400, 'Tumba');
        expect(lookupVenueNear('PRO Tumba', ...BOTKYRKA, 25)).toBeNull();
    });

    it('rena ortnamn är mittpunkten själv, och kyrkonamn kräver snävare radie', () => {
        // Kräver tätortstabellen — tom i testdatabasen, så ortsspärren prövas
        // här bara genom att ett vanligt namn INTE spärras av misstag.
        upsertKnownVenue('S:t Mikaels kyrka', 59.3300, 17.9600, 'Ekerö');              // 16 km från Tumba
        expect(lookupVenueNear('S:t Mikaels kyrka', ...BOTKYRKA, 25)).toBeNull();
        upsertKnownVenue('Tumba kyrka', 59.2050, 17.8200, 'Tumba');                    // 1 km
        expect(lookupVenueNear('Tumba kyrka', ...BOTKYRKA, 25)).toEqual([59.2050, 17.8200]);
    });

    it('två rader med samma namn: samma plats godtas, olika platser är tvetydigt', () => {
        upsertKnownVenue('Hallunda Kulturhus', 59.2440, 17.8250, 'Norsborg');
        upsertKnownVenue('Hallunda kulturhus', 59.2441, 17.8251, 'Botkyrka');          // samma hus, annan seed
        expect(lookupVenueNear('Hallunda kulturhus', ...BOTKYRKA, 25)).toEqual([59.2440, 17.8250]);
        upsertKnownVenue('Bygdegården Testby', 59.25, 17.80, 'Norsborg');
        upsertKnownVenue('bygdegården testby', 59.15, 17.95, 'Tumba');                 // 14 km bort
        expect(lookupVenueNear('Bygdegården Testby', ...BOTKYRKA, 25)).toBeNull();
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

describe('deleteEventsByFirestoreIds', () => {
    it('raderar på Firestore-id (inte url) och lämnar övriga rader orörda', () => {
        upsertEvent(ev('https://t.se/tips-1', { firestoreId: 'tipsDocA' }));
        upsertEvent(ev('https://t.se/tips-2', { firestoreId: 'tipsDocB' }));
        upsertEvent(ev('https://t.se/skrapat', { firestoreId: 'skrapatDoc' }));
        expect(deleteEventsByFirestoreIds(['tipsDocA', 'tipsDocB', 'finnsInte'])).toBe(2);
        expect(sqliteEventExists('https://t.se/tips-1')).toBe(false);
        expect(sqliteEventExists('https://t.se/tips-2')).toBe(false);
        expect(sqliteEventExists('https://t.se/skrapat')).toBe(true);
    });

    it('tom lista är en no-op', () => {
        expect(deleteEventsByFirestoreIds([])).toBe(0);
    });
});
