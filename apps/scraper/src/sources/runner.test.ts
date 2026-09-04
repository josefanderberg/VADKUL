/**
 * Runner-pipeline — integrationstester med fejk-engine och mockat IO.
 *
 * ALLT IO mockas: dbHelper (Firestore+SQLite), geocoding (Nominatim),
 * storage (Firebase), audit (Ollama). Testerna pinnar pipeline-semantiken:
 * validera → fönster → dedup → geocode → klassificera → skriv → run-historik.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/dbHelper', () => ({
    addEventsBatch: vi.fn(async (evs: any[]) => ({ written: evs.length, errors: [] })),
    eventExistsInDb: vi.fn(async () => false),
    refreshEventTime: vi.fn(async () => false),
    refreshEventPlace: vi.fn(async () => false),
    refreshEventEndDate: vi.fn(async () => false),
    refreshEventContent: vi.fn(async () => false),
}));
vi.mock('../utils/venueCoordinates', () => ({
    geocodeVenueSweden: vi.fn(async () => null),
    // Nordisk bbox-validering — speglar den riktiga så koord-vakten i runnern
    // släpper igenom giltiga koords och kastar projicerade.
    isInNordic: (lat: number, lng: number) =>
        lat >= 54.5 && lat <= 71.5 && lng >= 4.5 && lng <= 31.5,
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
    getSqliteEvent: vi.fn(() => undefined),
    getSyncMeta: vi.fn(() => null),
    setSyncMeta: vi.fn(),
}));
// Var 4:e-körning-logiken är datum/hash-styrd — pinna av så testerna inte
// blir beroende av vilken dag de körs.
vi.mock('./schedule', () => ({
    isRefreshRun: vi.fn(() => false),
}));
vi.mock('../utils/llmAudit', () => ({
    auditEvent: vi.fn(),
    ollamaIsAvailable: vi.fn(async () => false),
}));

import { runSource, deriveHasSpecificTime, geocodeQueriesFor, CONTENT_SWEEP_VERSION } from './runner';
import { Source, RawEvent, Engine } from './types';
import { addEventsBatch, eventExistsInDb } from '../utils/dbHelper';
import { geocodeVenueSweden } from '../utils/venueCoordinates';
import { recordScrapeRun, getSyncMeta, setSyncMeta } from '../utils/sqliteHelper';

const batchMock = vi.mocked(addEventsBatch);
// Runnern batchar skrivningar: alla event från en körning kommer i ETT
// addEventsBatch(array)-anrop. Platta ut till "alla skrivna event" så testerna
// kan asserta på enskilda event oavsett batch-gruppering.
const writtenEvents = (): any[] => batchMock.mock.calls.flatMap((c) => c[0]);
const existsMock = vi.mocked(eventExistsInDb);
const geocodeMock = vi.mocked(geocodeVenueSweden);
const recordRunMock = vi.mocked(recordScrapeRun);
const syncMetaGetMock = vi.mocked(getSyncMeta);
const syncMetaSetMock = vi.mocked(setSyncMeta);

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
    // Default: svepet är redan gjort — övriga tester ska inte köra i refresh-läge.
    syncMetaGetMock.mockReturnValue(CONTENT_SWEEP_VERSION);
});

describe('runSource — innehålls-svep (engångs full-refresh per källa)', () => {
    const capture = () => {
        let seen: boolean | undefined;
        const engine: Engine = async (_cfg, ctx) => { seen = ctx.refreshKnown; return []; };
        return { engine, refreshKnown: () => seen };
    };

    it('ostämplad källa → full-refresh, stämplas efter genomförd körning', async () => {
        syncMetaGetMock.mockReturnValue(null);
        const c = capture();
        await run(c.engine);
        expect(c.refreshKnown()).toBe(true);
        expect(syncMetaSetMock).toHaveBeenCalledWith('contentSweep.test-source', CONTENT_SWEEP_VERSION);
    });

    it('gammal stämpel räknas som ostämplad', async () => {
        syncMetaGetMock.mockReturnValue('2026-01-01');
        const c = capture();
        await run(c.engine);
        expect(c.refreshKnown()).toBe(true);
        expect(syncMetaSetMock).toHaveBeenCalledTimes(1);
    });

    it('redan svept → ingen tvingad refresh, ingen ny stämpel', async () => {
        const c = capture();
        await run(c.engine);
        expect(c.refreshKnown()).toBe(false);
        expect(syncMetaSetMock).not.toHaveBeenCalled();
    });

    it('dry-run varken refreshar eller stämplar', async () => {
        syncMetaGetMock.mockReturnValue(null);
        const c = capture();
        await run(c.engine, { dryRun: true });
        expect(c.refreshKnown()).toBe(false);
        expect(syncMetaSetMock).not.toHaveBeenCalled();
    });

    it('motorkrasch stämplar inte — svepet försöks igen nästa körning', async () => {
        syncMetaGetMock.mockReturnValue(null);
        const result = await run(async () => { throw new Error('boom'); });
        expect(result.errors[0]).toContain('boom');
        expect(syncMetaSetMock).not.toHaveBeenCalled();
    });
});

describe('runSource — grundpipeline', () => {
    it('sparar giltigt event med källans hostName, published-status och hostad bild', async () => {
        const e = makeEvent({ venueName: 'Folkets Hus', imageUrl: 'https://cdn.example/img.jpg' });
        const result = await run([e]);

        expect(result.saved).toBe(1);
        expect(writtenEvents()).toHaveLength(1);
        const written = writtenEvents()[0];
        expect(written.hostName).toBe('Testvärd');
        expect(written.locationName).toBe('Folkets Hus');
        expect(written.status).toBe('published');       // AUDIT_ENABLED ej satt
        expect(written.price).toBeNull();
        expect(written.coverImage).toBe('https://storage.example/hosted.jpg');
        expect(written.hasSpecificTime).toBe(true);     // 19:00 ≠ midnatt
    });

    it('per-event hostName (paraply-källor) vinner över source.hostName', async () => {
        await run([makeEvent({ hostName: 'Sundbybergs församling' })]);
        expect(writtenEvents()[0].hostName).toBe('Sundbybergs församling');
    });

    it('skippar ogiltiga event (kort titel, saknad url, trasigt datum)', async () => {
        const result = await run([
            makeEvent({ title: 'x' }),
            makeEvent({ url: '' }),
            makeEvent({ startDate: new Date('not-a-date') }),
        ]);
        expect(result.saved).toBe(0);
        expect(result.skipped.invalid).toBe(3);
        expect(writtenEvents()).toHaveLength(0);
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
        expect(writtenEvents()).toHaveLength(0);
    });

    it('dry-run skriver ingenting men räknar', async () => {
        const result = await run([makeEvent()], { dryRun: true });
        expect(result.saved).toBe(1);
        expect(writtenEvents()).toHaveLength(0);
        expect(geocodeMock).not.toHaveBeenCalled();
    });
});

describe('runSource — geocoding', () => {
    it('engine-koordinater används utan geocoding', async () => {
        await run([makeEvent({ coords: [56.88, 14.81] })]);
        expect(geocodeMock).not.toHaveBeenCalled();
        const written = writtenEvents()[0];
        expect(written.lat).toBe(56.88);
        expect(written.isLocationVerified).toBe(true);
    });

    it('projicerade koordinater (SWEREF99/RT90) kastas och ersätts av geokodning', async () => {
        // lat=6129956 spränger WGS84 → ska INTE skrivas; geokodning tar över.
        geocodeMock.mockResolvedValueOnce([59.0, 18.0, 'poi']);
        await run([makeEvent({ coords: [6129956, 1703467], venueName: 'X', city: 'Y' })]);
        expect(geocodeMock).toHaveBeenCalled();
        const written = writtenEvents()[0];
        expect(written.lat).toBe(59.0);
        expect(written.lng).toBe(18.0);
    });

    it('giltig koord utanför Norden (utländsk) kastas också', async () => {
        geocodeMock.mockResolvedValueOnce(null);
        await run([makeEvent({ coords: [40.7, -74.0], venueName: 'NYC' })]);  // New York
        expect(geocodeMock).toHaveBeenCalled();   // koorden förkastades → fallback
        const written = writtenEvents()[0];
        expect(written.lat).toBe(0);
    });

    it('kandidat-kedjan provas i ordning, första träff vinner', async () => {
        geocodeMock
            .mockResolvedValueOnce(null)              // "Storkyrkan" → miss
            .mockResolvedValueOnce([59.32, 18.07, 'poi']);   // "Stockholms domkyrkoförsamling" → träff
        await run([makeEvent({
            geocodeCandidates: ['Storkyrkan', 'Stockholms domkyrkoförsamling', 'Stockholm'],
        })]);
        expect(geocodeMock).toHaveBeenCalledTimes(2);  // tredje kandidaten provas aldrig
        expect(geocodeMock.mock.calls.map(c => c[0]))
            .toEqual(['Storkyrkan', 'Stockholms domkyrkoförsamling']);
        expect(writtenEvents()[0].lat).toBe(59.32);
    });

    it('geo-cachen återanvänder svar inom körningen (paraply: samma församling × N event)', async () => {
        geocodeMock.mockResolvedValue([57.0, 15.0, 'poi']);
        await run([
            makeEvent({ geocodeCandidates: ['Växjö domkyrka'] }),
            makeEvent({ geocodeCandidates: ['Växjö domkyrka'] }),
        ]);
        expect(geocodeMock).toHaveBeenCalledTimes(1);
    });

    it('default-kedjan provar adress → venue+stad → stad, med nearCity-validering', () => {
        return run([makeEvent({ address: 'Storgatan 1', venueName: 'Folkets Hus', city: 'Växjö' })]).then(() => {
            // Känner källan staden skickas den som nearCity så Nominatim inte får
            // returnera en namne i fel stad (Örebro-buggen).
            expect(geocodeMock).toHaveBeenNthCalledWith(1, 'Storgatan 1, Växjö', { nearCity: 'Växjö' });
            expect(geocodeMock).toHaveBeenNthCalledWith(2, 'Folkets Hus, Växjö', { nearCity: 'Växjö' });
            expect(geocodeMock).toHaveBeenNthCalledWith(3, 'Växjö', { nearCity: 'Växjö' });
        });
    });

    it('utan stad skickas ingen nearCity (bakåtkompatibelt)', async () => {
        await run([makeEvent({ geocodeCandidates: ['Storkyrkan'] })]);
        expect(geocodeMock).toHaveBeenNthCalledWith(1, 'Storkyrkan', undefined);
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

    // SvK-floden 2026-06-11: en källa som plötsligt levererar mångdubbel volym
    // ska stanna vid taket och synas som fel — inte tyst dränka databasen.
    it('volym-säkringen stoppar vid maxSavedPerRun och rapporterar fel', async () => {
        const result = await run(
            Array.from({ length: 5 }, () => makeEvent()),
            {},
            { maxSavedPerRun: 2 },
        );
        expect(result.saved).toBe(2);
        expect(writtenEvents()).toHaveLength(2);
        expect(result.errors[0]).toContain('volym-säkring');
        expect(result.errors[0]).toContain('3 event osparade');
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
    it('salong-venue ("Saga - Bio 3:an") får byggnaden som kandidat före hela strängen', () => {
        const queries = geocodeQueriesFor({ title: 'x', url: 'u', startDate: new Date(), venueName: 'Saga - Bio 3:an', city: 'Piteå' });
        expect(queries.indexOf('Bio 3:an, Piteå')).toBeLessThan(queries.indexOf('Saga - Bio 3:an, Piteå'));
    });

    it('källans kandidater används när de finns, tomma/korta filtreras', () => {
        const queries = geocodeQueriesFor({
            title: 't', url: 'u', startDate: new Date(),
            geocodeCandidates: ['Storkyrkan', '', 'AB', 'Stockholm'],
        });
        expect(queries).toEqual(['Storkyrkan', 'Stockholm']);
    });

    it('faller tillbaka på "venueName, city" + ren stad', () => {
        expect(geocodeQueriesFor({
            title: 't', url: 'u', startDate: new Date(),
            venueName: 'Folkets Hus', city: 'Växjö',
        })).toEqual(['Folkets Hus, Växjö', 'Växjö']);
    });

    it('gatuadress prioriteras före venue-namn', () => {
        expect(geocodeQueriesFor({
            title: 't', url: 'u', startDate: new Date(),
            address: 'Storgatan 1', venueName: 'Folkets Hus', city: 'Växjö',
        })).toEqual(['Storgatan 1, Växjö', 'Folkets Hus, Växjö', 'Växjö']);
    });

    it('ingen platsinfo alls → inga frågor', () => {
        expect(geocodeQueriesFor({ title: 't', url: 'u', startDate: new Date() })).toEqual([]);
    });
});
