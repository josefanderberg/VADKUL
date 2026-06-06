/**
 * Runner — kör en Source genom dess engine och tar hand om gemensam pipeline:
 *   1. Datum-filter (inom fönstret)
 *   2. Validering (har titel, har URL, har datum)
 *   3. Dedup mot DB
 *   4. Geocoding via venueCoordinates (om engine inte gav coords)
 *   5. Klassificering via classifyEvent (om engine inte gav category)
 *   6. Skrivning till DB
 *
 * Engines är "rena" — de gör bara extraction.
 */

import { Source, Engine, EngineContext, RawEvent, SourceRunResult } from './types';
import { addEventToDb, eventExistsInDb } from '../utils/dbHelper';
import { geocodeVenueSweden } from '../utils/venueCoordinates';
import { classifyEvent } from '../utils/classify';
import { uploadEventImage, isOurStorageUrl } from '../utils/storageHelper';
import { recordScrapeRun } from '../utils/sqliteHelper';

const DEFAULT_WINDOW_DAYS = parseInt(process.env.SCRAPE_WINDOW_DAYS || '30', 10);

function buildWindow(days: number): { windowStart: Date; windowEnd: Date } {
    const windowStart = new Date();
    windowStart.setHours(0, 0, 0, 0);
    const windowEnd = new Date(windowStart.getTime() + days * 24 * 60 * 60 * 1000);
    return { windowStart, windowEnd };
}

function isValidEvent(e: RawEvent): boolean {
    if (!e.title || e.title.trim().length < 2) return false;
    if (!e.url) return false;
    if (!e.startDate || isNaN(e.startDate.getTime())) return false;
    return true;
}

export async function runSource(
    source: Source,
    engines: Record<string, Engine>,
    opts: { dryRun?: boolean } = {},
): Promise<SourceRunResult> {
    const startedAt = Date.now();
    const result: SourceRunResult = {
        sourceId: source.id,
        durationMs: 0,
        found: 0,
        saved: 0,
        skipped: { duplicate: 0, outsideWindow: 0, invalid: 0 },
        errors: [],
    };

    if (source.disabled) {
        result.errors.push('source is disabled');
        result.durationMs = Date.now() - startedAt;
        return result;
    }

    const engine = engines[source.engine];
    if (!engine) {
        result.errors.push(`Unknown engine: ${source.engine}`);
        result.durationMs = Date.now() - startedAt;
        return result;
    }

    const { windowStart, windowEnd } = buildWindow(source.windowDays ?? DEFAULT_WINDOW_DAYS);
    const ctx: EngineContext = {
        windowStart,
        windowEnd,
        log: (msg) => console.log(`  [${source.id}] ${msg}`),
    };

    let rawEvents: RawEvent[];
    try {
        rawEvents = await engine(source.config, ctx);
    } catch (err) {
        result.errors.push(`engine threw: ${(err as Error).message}`);
        result.durationMs = Date.now() - startedAt;
        return result;
    }

    result.found = rawEvents.length;
    ctx.log(`engine returned ${rawEvents.length} events`);

    for (const e of rawEvents) {
        try {
            if (!isValidEvent(e)) {
                result.skipped.invalid++;
                continue;
            }
            if (e.startDate < windowStart || e.startDate >= windowEnd) {
                result.skipped.outsideWindow++;
                continue;
            }
            if (!opts.dryRun && await eventExistsInDb(e.url)) {
                result.skipped.duplicate++;
                continue;
            }

            // Geocoding: använd engine-koords om de finns, annars geocoda venue
            let lat = e.coords?.[0] ?? 0;
            let lng = e.coords?.[1] ?? 0;
            if (!opts.dryRun && !lat && !lng) {
                const q = [e.venueName, e.city].filter(Boolean).join(', ');
                if (q) {
                    const coords = await geocodeVenueSweden(q);
                    if (coords) { lat = coords[0]; lng = coords[1]; }
                }
            }

            const category = e.category || classifyEvent(e.title, e.description || '');

            if (opts.dryRun) {
                const fieldHealth = {
                    title: !!e.title,
                    date: !!e.startDate,
                    venue: !!e.venueName,
                    city: !!e.city,
                    desc: !!(e.description && e.description.length > 10),
                    img: !!e.imageUrl,
                };
                const filled = Object.values(fieldHealth).filter(Boolean).length;
                const flags = Object.entries(fieldHealth).map(([k,v]) => v ? k : `~${k}`).join(' ');
                ctx.log(`[DRY ${filled}/6] ${e.startDate.toISOString().slice(0,10)} | ${e.title.slice(0,50)} | ${e.venueName || e.city || '?'} | ${flags}`);
                result.saved++;
                continue;
            }

            // hasSpecificTime: false om tiden är midnatt i ANTINGEN UTC eller lokal tid.
            //  - Lokal midnatt: ParseSwedishDate skapar lokal Date(y,m,d) → CEST 00:00
            //  - UTC midnatt:   ISO "2026-06-06" parsas av JS som UTC midnatt → 02:00 CEST
            // Båda är "fake-tider" där källan bara hade ett datum, ingen klocka.
            const isMidnightLocal = e.startDate.getHours() === 0 && e.startDate.getMinutes() === 0;
            const isMidnightUtc   = e.startDate.getUTCHours() === 0 && e.startDate.getUTCMinutes() === 0;
            const hasSpecificTime = !(isMidnightLocal || isMidnightUtc);

            // Ladda upp bild till vår Storage — så vi inte är beroende av att
            // remote-URL inte expirar (typ FB CDN som expirar var 7:e dag).
            let finalImageUrl: string | null = e.imageUrl || null;
            if (finalImageUrl && !isOurStorageUrl(finalImageUrl)) {
                const hosted = await uploadEventImage(finalImageUrl, e.url);
                if (hosted) finalImageUrl = hosted;
                // Om upload misslyckas: behåll originalet (kanske funkar ett tag)
            }

            await addEventToDb({
                title: e.title,
                url: e.url,
                time: e.startDate,
                hasSpecificTime,
                locationName: e.venueName || e.city || 'Sverige',
                lat,
                lng,
                hostName: source.hostName,
                category,
                description: e.description || '',
                coverImage: finalImageUrl,
                price: e.price || '',
                createdAt: new Date(),
                isLocationVerified: lat !== 0 || lng !== 0,
            });
            result.saved++;
        } catch (err) {
            result.errors.push(`event "${e.title}": ${(err as Error).message}`);
        }
    }

    result.durationMs = Date.now() - startedAt;
    ctx.log(
        `done in ${result.durationMs}ms — saved ${result.saved}, ` +
        `dup ${result.skipped.duplicate}, outside ${result.skipped.outsideWindow}, ` +
        `invalid ${result.skipped.invalid}, errors ${result.errors.length}`,
    );

    // Persist run-history för observability
    recordScrapeRun({
        sourceId: source.id,
        hostName: source.hostName,
        startedAt: new Date(startedAt),
        durationMs: result.durationMs,
        found: result.found,
        saved: result.saved,
        skippedDuplicate: result.skipped.duplicate,
        skippedOutsideWindow: result.skipped.outsideWindow,
        skippedInvalid: result.skipped.invalid,
        errorCount: result.errors.length,
        firstError: result.errors[0]?.slice(0, 300),
        hiddenCount: 0,  // populated when LLM-audit is integrated into pipeline
        errors: result.errors.map(e => e.slice(0, 300)),
    });

    return result;
}

/**
 * Enkel parallell-pool utan extra deps. Kör upp till `concurrency` källor
 * samtidigt; nästa hämtas från kön när en blir klar.
 */
async function runWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    fn: (item: T) => Promise<R>,
): Promise<R[]> {
    const queue = items.slice();
    const results: R[] = [];
    const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
        while (queue.length > 0) {
            const item = queue.shift();
            if (item === undefined) break;
            const r = await fn(item);
            results.push(r);
        }
    });
    await Promise.all(workers);
    return results;
}

export interface RunSourcesOptions {
    /** Hur många källor som körs parallellt (default 4). */
    concurrency?: number;
    /** Om true: hämta + validera men SKRIV INTE till DB. Bra för testning. */
    dryRun?: boolean;
}

/**
 * Kör flera källor parallellt (begränsat antal samtidigt).
 *
 * OBS: per-domän rate limiting sköts inom motorerna när det behövs. Nominatim
 * (geocoding) är fortfarande seriellt eftersom de delar global throttle inne
 * i `geocodeVenueSweden`.
 */
export async function runSources(
    sources: Source[],
    engines: Record<string, Engine>,
    opts: RunSourcesOptions = {},
): Promise<SourceRunResult[]> {
    const concurrency = opts.concurrency ?? 4;
    console.log(`\n[Sources] Running ${sources.length} sources, concurrency=${concurrency}\n`);

    return runWithConcurrency(sources, concurrency, async (src) => {
        console.log(`=== ${src.id} (${src.engine}) START ===`);
        const r = await runSource(src, engines, { dryRun: opts.dryRun });
        console.log(`=== ${src.id} END — ${opts.dryRun ? 'would save' : 'saved'} ${r.saved}/${r.found} in ${r.durationMs}ms ===`);
        return r;
    });
}

/**
 * Sammanställ resultat efter en körning — tabell + totaler.
 */
export function summarize(results: SourceRunResult[]): void {
    console.log('\n=== SOURCES SUMMARY ===');
    let totalSaved = 0;
    let totalFound = 0;
    let totalErrors = 0;
    for (const r of results) {
        totalSaved += r.saved;
        totalFound += r.found;
        totalErrors += r.errors.length;
        const status = r.errors.length > 0 ? '⚠️' : (r.saved > 0 ? '✅' : '○');
        console.log(
            `${status} ${r.sourceId.padEnd(28)} ` +
            `saved=${String(r.saved).padStart(4)}  ` +
            `found=${String(r.found).padStart(4)}  ` +
            `dup=${String(r.skipped.duplicate).padStart(3)}  ` +
            `outside=${String(r.skipped.outsideWindow).padStart(3)}  ` +
            `err=${r.errors.length}  ` +
            `${r.durationMs}ms`,
        );
    }
    console.log('─'.repeat(50));
    console.log(`TOTAL: saved=${totalSaved}, found=${totalFound}, errors=${totalErrors}\n`);
}
