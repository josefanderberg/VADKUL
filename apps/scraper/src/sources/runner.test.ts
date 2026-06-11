/**
 * Runner-pipeline — integrationstester med fejk-engine och mockat IO.
 *
 * ALLT IO mockas: dbHelper (Firestore+SQLite), geocoding (Nominatim),
 * storage (Firebase), audit (Ollama). Testerna pinnar pipeline-semantiken:
 * validera → fönster → dedup → geocode → klassificera → skriv → run-historik.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/dbHelper', () => ({
    addEventToDb: vi.fn(async () => {}),
    eventExistsInDb: vi.fn(async () => false),
}));
vi.mock('../utils/venueCoordinates', () => ({
    geocodeVenueSweden: vi.fn(async () => null),
}));
vi.mock('../utils/classify', () => ({
    classifyEvent: vi.fn(() => 'community'),
}));
vi.mock('../utils/storageHelper', () => ({
    uploadEventImage: vi.fn(async () => 'https://storage.example/hosted.jpg'),
    isOurStorageUrl: vi.fn(() => false),
}));
vi.mock('../utils/sqliteHelper', () => ({
    recordScrapeRun: vi.fn(),
    setEventAudit: vi.fn(),
}));
vi.mock('../utils/llmAudit', () => ({
    auditEvent: vi.fn(),
    ollamaIsAvailable: vi.fn(async () => false),
}));

import { runSource, deriveHasSpecificTime, geocodeQueriesFor } from './runner';
import { Source, RawEvent, Engine } from './types';
import { addEventToDb, eventExistsInDb } from '../utils/dbHelper';
import { geocodeVenueSweden } from '../utils/venueCoordinates';
import { recordScrapeRun } from '../utils/sqliteHelper';

const addEventMock = vi.mocked(addEventToDb);
const existsMock = vi.mocked(eventExistsInDb);
const geocodeMock = vi.mocked(geocodeVenueSweden);
const recordRunMock = vi.mocked(recordScrapeRun);

/** Imorgon kl 19:00 lokal tid — alltid inne i 30-dagarsfönstret. */
function tomorrow19(): Date {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(19, 0, 0, 0);
    return d;
}

function makeSource(overrides: Partial<Source> = {}): Source {
    return {
        id: 'test-source',
        hostName: 'Testvärd',
        engine: 'sitemap',
        config: {},
        ...overrides,
    } as Source;
}

function makeEvent(overrides: Partial<RawEvent> = {}): RawEvent {
    return {
        title: 'Testevent',
        url: `https://example.se/e/${Math.random().toString(36).slice(2)}`,
        startDate: tomorrow19(),
        ...overrides,
    };
}

async function run(
    events: RawEvent[] | Engine,
    opts: { dryRun?: boolean } = {},
    sourceOverrides: Partial<Source> = {},
) {
    const engine: Engine = typeof events === 'function' ? events : async () => events;
    const source = makeSource(sourceOverrides);
    return runSource(source, { [source.engine]: engine }, opts);
}

beforeEach(() => {
    vi.clearAllMocks();
    existsMock.mockResolvedValue(false);
    geocodeMock.mockResolvedValue(null);
});

describe('runSource — grundpipeline', () => {
    it('sparar giltigt event med källans hostName, published-status och hostad bild', async () => {
        const e = makeEvent({ venueName: 'Folkets Hus', imageUrl: 'https://cdn.example/img.jpg' });
        const result = await run([e]);

        expect(result.saved).toBe(1);
        expect(addEventMock).toHaveBeenCalledTimes(1);
        const written = addEventMock.mock.calls[0][0];
        expect(written.hostName).toBe('Testvärd');
        expect(written.locationName).toBe('Folkets Hus');
        expect(written.status).toBe('published');       // AUDIT_ENABLED ej satt
        expect(written.price).toBeNull();
        expect(written.coverImage).toBe('https://storage.example/hosted.jpg');
        expect(written.hasSpecificTime).toBe(true);     // 19:00 ≠ midnatt
    });

    it('per-event hostName (paraply-källor) vinner över source.hostName', async () => {
        await run([makeEvent({ hostName: 'Sundbybergs församling' })]);
        expect(addEventMock.mock.calls[0][0].hostName).toBe('Sundbybergs församling');
    });

    it('skippar ogiltiga event (kort titel, saknad url, trasigt datum)', async () => {
        const result = await run([
            makeEvent({ title: 'x' }),
            makeEvent({ url: '' }),
            makeEvent({ startDate: new Date('not-a-date') }),
        ]);
        expect(result.saved).toBe(0);
        expect(result.skipped.invalid).toBe(3);
        expect(addEventMock).not.toHaveBeenCalled();
    });

    it('skippar event utanför fönstret (igår + bortom windowDays)', async () => {
        const yesterday = new Date(Date.now() - 24 * 3600_000);
        const farFuture = new Date(Date.now() + 40 * 24 * 3600_000);
        const result = await run(
            [makeEvent({ startDate: yesterday }), makeEvent({ startDate: farFuture })],
            {},
            { windowDays: 30 },
        );
        expect(result.skipped.outsideWindow).toBe(2);
        expect(result.saved).toBe(0);
    });

    it('skippar dubbletter utan att skriva', async () => {
        existsMock.mockResolvedValue(true);
        const result = await run([makeEvent()]);
        expect(result.skipped.duplicate).toBe(1);
        expect(addEventMock).not.toHaveBeenCalled();
    });

    it('dry-run skriver ingenting men räknar', async () => {
        const result = await run([makeEvent()], { dryRun: true });
        expect(result.saved).toBe(1);
        expect(addEventMock).not.toHaveBeenCalled();
        expect(geocodeMock).not.toHaveBeenCalled();
    });
});

describe('runSource — geocoding', () => {
    it('engine-koordinater används utan geocoding', async () => {
        await run([makeEvent({ coords: [56.88, 14.81] })]);
        expect(geocodeMock).not.toHaveBeenCalled();
        const written = addEventMock.mock.calls[0][0];
        expect(written.lat).toBe(56.88);
        expect(written.isLocationVerified).toBe(true);
    });

    it('kandidat-kedjan provas i ordning, första träff vinner', async () => {
        geocodeMock
            .mockResolvedValueOnce(null)              // "Storkyrkan" → miss
            .mockResolvedValueOnce([59.32, 18.07]);   // "Stockholms domkyrkoförsamling" → träff
        await run([makeEvent({
            geocodeCandidates: ['Storkyrkan', 'Stockholms domkyrkoförsamling', 'Stockholm'],
        })]);
        expect(geocodeMock).toHaveBeenCalledTimes(2);  // tredje kandidaten provas aldrig
        expect(geocodeMock.mock.calls.map(c => c[0]))
            .toEqual(['Storkyrkan', 'Stockholms domkyrkoförsamling']);
        expect(addEventMock.mock.calls[0][0].lat).toBe(59.32);
    });

    it('geo-cachen återanvänder svar inom körningen (paraply: samma församling × N event)', async () => {
        geocodeMock.mockResolvedValue([57.0, 15.0]);
        await run([
            makeEvent({ geocodeCandidates: ['Växjö domkyrka'] }),
            makeEvent({ geocodeCandidates: ['Växjö domkyrka'] }),
        ]);
        expect(geocodeMock).toHaveBeenCalledTimes(1);
    });

    it('default-frågan är "venueName, city" när kandidater saknas', async () => {
        await run([makeEvent({ venueName: 'Folkets Hus', city: 'Växjö' })]);
        expect(geocodeMock).toHaveBeenCalledWith('Folkets Hus, Växjö');
    });
});

describe('runSource — fel & run-historik', () => {
    it('engine-krasch registreras i run-historiken', async () => {
        const result = await run(async () => { throw new Error('boom'); });
        expect(result.errors[0]).toContain('boom');
        expect(recordRunMock).toHaveBeenCalledTimes(1);
        expect(recordRunMock.mock.calls[0][0].errorCount).toBe(1);
    });

    it('okänd engine registreras i run-historiken', async () => {
        const source = makeSource({ engine: 'finns-inte' as any });
        const result = await runSource(source, {});
        expect(result.errors[0]).toContain('Unknown engine');
        expect(recordRunMock).toHaveBeenCalledTimes(1);
    });

    it('dead source hoppar över utan run-historik (inget körförsök)', async () => {
        const result = await run([makeEvent()], {}, { status: 'dead' });
        expect(result.saved).toBe(0);
        expect(recordRunMock).not.toHaveBeenCalled();
    });

    it('lyckad körning registrerar totaler', async () => {
        existsMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
        await run([makeEvent(), makeEvent()]);
        const row = recordRunMock.mock.calls[0][0];
        expect(row.found).toBe(2);
        expect(row.saved).toBe(1);
        expect(row.skippedDuplicate).toBe(1);
    });

    // Incident 2026-06-11: en dry-run skrev "saved 19686" till scrape_runs och
    // förgiftade daily-report/regressionsdata. Dry-run får ALDRIG lämna spår.
    it('dry-run registrerar INGET i run-historiken — varken lyckad körning eller krasch', async () => {
        await run([makeEvent()], { dryRun: true });
        const crashed = await run(async () => { throw new Error('boom'); }, { dryRun: true });
        expect(crashed.errors[0]).toContain('boom');   // felet rapporteras ändå i resultatet
        expect(recordRunMock).not.toHaveBeenCalled();
    });
});

describe('deriveHasSpecificTime', () => {
    it('explicit flagga vinner alltid (källan VET)', () => {
        const at19 = new Date(2026, 5, 15, 19, 0);
        expect(deriveHasSpecificTime(at19, false)).toBe(false);   // HasStartsAt=false
        const atMidnight = new Date(2026, 5, 15, 0, 0);
        expect(deriveHasSpecificTime(atMidnight, true)).toBe(true);
    });

    it('lokal midnatt = heldag', () => {
        expect(deriveHasSpecificTime(new Date(2026, 5, 15, 0, 0))).toBe(false);
    });

    it('UTC-midnatt = heldag ("2026-06-15" parsas som 02:00 CEST)', () => {
        expect(deriveHasSpecificTime(new Date('2026-06-15T00:00:00Z'))).toBe(false);
    });

    it('riktig klocktid = specifik', () => {
        expect(deriveHasSpecificTime(new Date(2026, 5, 15, 19, 30))).toBe(true);
    });
});

describe('geocodeQueriesFor', () => {
    it('källans kandidater används när de finns, tomma/korta filtreras', () => {
        const queries = geocodeQueriesFor({
            title: 't', url: 'u', startDate: new Date(),
            geocodeCandidates: ['Storkyrkan', '', 'AB', 'Stockholm'],
        });
        expect(queries).toEqual(['Storkyrkan', 'Stockholm']);
    });

    it('faller tillbaka på "venueName, city"', () => {
        expect(geocodeQueriesFor({
            title: 't', url: 'u', startDate: new Date(),
            venueName: 'Folkets Hus', city: 'Växjö',
        })).toEqual(['Folkets Hus, Växjö']);
    });

    it('ingen platsinfo alls → inga frågor', () => {
        expect(geocodeQueriesFor({ title: 't', url: 'u', startDate: new Date() })).toEqual([]);
    });
});
