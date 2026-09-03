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
import { addEventsBatch, eventExistsInDb, refreshEventTime, refreshEventPlace, refreshEventEndDate, refreshEventContent } from '../utils/dbHelper';
import { pickBetterDescription, pickBetterPrice } from '../utils/contentRefresh';
import { validEventEnd } from '../utils/eventEnd';
import { getSqliteEvent } from '../utils/sqliteHelper';
import { isRefreshRun } from './schedule';
import { geocodeVenueSweden, isInNordic, type GeoHit } from '../utils/venueCoordinates';
import { cleanLocationName } from '../utils/text';
import { classifyEvent } from '../utils/classify';
import { normalizeCategory } from '../utils/categoryNormalize';
import { normalizeRawEvent } from '../utils/normalizeEvent';
import { uploadEventImage, isOurStorageUrl } from '../utils/storageHelper';
import { isLikelyLogoOrPlaceholderImage, normalizeImagePort } from '../utils/imageFilter';
import { recordScrapeRun, setEventAudit, getSyncMeta, setSyncMeta } from '../utils/sqliteHelper';
import { auditEvent, ollamaIsAvailable } from '../utils/llmAudit';

const AUDIT_ENABLED = process.env.AUDIT_ENABLED === 'true';

/**
 * Innehålls-svep (2026-09-03): när tolkningen av beskrivning/pris ändras
 * (1500-tak i stället för 500, pris ur texten, contentRefresh) ska VARJE
 * källa göra EN full-refresh vid sin nästa körning så kända event läks
 * direkt — inte först vid var 4:e körning (upp till fyra veckor för
 * veckokällor). Stämplas per källa i sync_meta när motorn gått igenom;
 * dry-run och motorkrasch stämplar inte. Bumpa datumet när nästa sådan
 * ändring landar, så går svepet igen.
 */
export const CONTENT_SWEEP_VERSION = '2026-09-03';
const sweepKey = (sourceId: string): string => `contentSweep.${sourceId}`;

// 30 dagar. Håller databasen lean — events längre fram fångas ändå senare när
// de glider in i fönstret (och med färskare info då). Detalj-sidorna hämtas
// ändå för att FÅ event-datumet; fönstret avgör bara save/skip. Tillsammans
// med sitemap-datum-fixen (föredra framtida text-datum framför fel publicerings-
// datum) får near-term-events korrekt datum istället för att felaktigt
// filtreras bort. Override med SCRAPE_WINDOW_DAYS=N för bredare svep vid behov.
const DEFAULT_WINDOW_DAYS = parseInt(process.env.SCRAPE_WINDOW_DAYS || '30', 10);
/** Volym-säkring: max sparade event per källa & körning (override: source.maxSavedPerRun). */
const DEFAULT_SAVE_CAP = 3000;

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

/**
 * hasSpecificTime: källans explicita flagga vinner (engines som har t.ex.
 * isFullDayEvent VET). Annars heuristik: false om tiden är midnatt i ANTINGEN
 * UTC eller lokal tid.
 *  - Lokal midnatt: ParseSwedishDate skapar lokal Date(y,m,d) → CEST 00:00
 *  - UTC midnatt:   ISO "2026-06-06" parsas av JS som UTC midnatt → 02:00 CEST
 * Båda är "fake-tider" där källan bara hade ett datum, ingen klocka.
 */
export function deriveHasSpecificTime(startDate: Date, explicit?: boolean): boolean {
    if (explicit !== undefined) return explicit;
    const isMidnightLocal = startDate.getHours() === 0 && startDate.getMinutes() === 0;
    const isMidnightUtc   = startDate.getUTCHours() === 0 && startDate.getUTCMinutes() === 0;
    return !(isMidnightLocal || isMidnightUtc);
}

/**
 * Geocoding-frågor i prioritetsordning för ett event: källans egna kandidater
 * om de finns (paraply-källors fallback-kedjor). Annars: gatuadress först
 * (mest precis när källan gav en — JSON-LD streetAddress t.ex.), sedan
 * "venueName, city", sist bara staden.
 */
export function geocodeQueriesFor(e: RawEvent): string[] {
    const candidates = e.geocodeCandidates?.length
        ? e.geocodeCandidates
        : [
            e.address ? [e.address, e.city].filter(Boolean).join(', ') : '',
            e.venueName ? [e.venueName, e.city].filter(Boolean).join(', ') : '',
            e.city ?? '',
        ];
    // Dedupa (address kan vara identisk med venueName) och släng korta/tomma.
    return [...new Set(candidates)].filter((q) => q && q.trim().length > 2);
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
        updated: 0,
        skipped: { duplicate: 0, outsideWindow: 0, invalid: 0 },
        errors: [],
        audited: 0,
        autoHidden: 0,
    };

    // Kontrollera Ollama-tillgänglighet en gång per source-körning (inte per event).
    // Om nere: stäng av audit för hela denna körning och logga en warning.
    let auditAvailable = false;
    if (AUDIT_ENABLED && !opts.dryRun) {
        auditAvailable = await ollamaIsAvailable();
        if (!auditAvailable) {
            console.warn(`  [${source.id}] ⚠️  AUDIT_ENABLED men Ollama svarar inte — audit hoppas över`);
        }
    }

    if (source.disabled || source.status === 'dead') {
        // Inget körförsök — registreras avsiktligt INTE i run-historiken.
        result.errors.push(source.status === 'dead' ? 'source is dead' : 'source is disabled');
        result.durationMs = Date.now() - startedAt;
        return result;
    }

    const engine = engines[source.engine];
    if (!engine) {
        result.errors.push(`Unknown engine: ${source.engine}`);
        result.durationMs = Date.now() - startedAt;
        if (!opts.dryRun) persistRun(source, startedAt, result);   // felkonfig ska synas i daily-report
        return result;
    }

    const { windowStart, windowEnd } = buildWindow(source.windowDays ?? DEFAULT_WINDOW_DAYS);
    // Var 4:e körning per källa är en full-refresh: skip-känt-optimeringen
    // stängs av så ändrade/flyttade event på kända URL:er fångas upp.
    // SCRAPE_FORCE_REFRESH=1 tvingar refresh (reparationer efter motorfixar).
    const sweepDue = !opts.dryRun && getSyncMeta(sweepKey(source.id)) !== CONTENT_SWEEP_VERSION;
    const refreshKnown = !opts.dryRun && (isRefreshRun(source) || process.env.SCRAPE_FORCE_REFRESH === '1' || sweepDue);
    const ctx: EngineContext = {
        windowStart,
        windowEnd,
        log: (msg) => console.log(`  [${source.id}] ${msg}`),
        // Kostnadsoptimering för engines med dyra per-event-hämtningar.
        // I dry-run svarar vi alltid "okänd" så hela flödet syns i utskriften.
        isKnownUrl: opts.dryRun ? async () => false : (url) => eventExistsInDb(url),
        refreshKnown,
    };
    if (refreshKnown) ctx.log(sweepDue ? `full-refresh-körning (innehålls-svep ${CONTENT_SWEEP_VERSION}): kända URL:er re-fetchas` : 'full-refresh-körning: kända URL:er re-fetchas');

    // Geocode-cache per källkörning — paraplyn återanvänder samma församling/
    // klubb/ort många gånger; spara Nominatim-anropen.
    const geoCache = new Map<string, GeoHit | null>();

    let rawEvents: RawEvent[];
    try {
        rawEvents = await engine(source.config, ctx);
    } catch (err) {
        result.errors.push(`engine threw: ${(err as Error).message}`);
        result.durationMs = Date.now() - startedAt;
        if (!opts.dryRun) persistRun(source, startedAt, result);   // krascher ska synas i run-historiken
        return result;
    }

    result.found = rawEvents.length;
    ctx.log(`engine returned ${rawEvents.length} events`);

    // Volym-säkring (lärdom från SvK-floden 2026-06-11: ~19 700 ofiltrerade event
    // autopublicerades tills jobbet stoppades manuellt). En källa som plötsligt
    // levererar mångdubbel volym ska stanna vid taket och SYNAS som fel i
    // daily-report — inte tyst dränka databasen. Per-källa-override i registryt.
    const saveCap = source.maxSavedPerRun ?? DEFAULT_SAVE_CAP;

    // Firestore-skrivningar samlas och committas batchat efter loopen (i stället
    // för en `.add()` per event) — skonar Firestore vid stora körningar.
    const pendingWrites: any[] = [];

    for (const e of rawEvents) {
        if (result.saved >= saveCap) {
            const unprocessed = rawEvents.length - result.saved - result.skipped.duplicate
                - result.skipped.outsideWindow - result.skipped.invalid - result.autoHidden;
            result.errors.push(`volym-säkring: maxSavedPerRun=${saveCap} nått — ${unprocessed} event osparade (källan levererar onormalt mycket?)`);
            ctx.log(`🛑 ${result.errors[result.errors.length - 1]}`);
            break;
        }
        try {
            if (!isValidEvent(e)) {
                result.skipped.invalid++;
                continue;
            }
            // Central städning (normalizeEvent.ts): entiteter/taggar i titel,
            // beskrivning och platsnamn, FB-sidfot som beskrivning, arrangörs-
            // prefix "11/9 …" och " | VENUE"-suffix i titlar, flerradiga
            // platsnamn → venue + address. Revisionen 2026-08-20 visade att
            // per-engine-städning missade på 4 ställen — en plats, för alla.
            normalizeRawEvent(e, source.hostName);
            if (e.startDate < windowStart || e.startDate >= windowEnd) {
                result.skipped.outsideWindow++;
                continue;
            }
            if (!opts.dryRun && await eventExistsInDb(e.url)) {
                // Refresh-körning: uppdatera tiden om källan nu säger något
                // annat (flyttat datum, eller klockslag publicerat i efterhand).
                if (refreshKnown) {
                    const changed = await refreshEventTime(
                        e.url, e.startDate, deriveHasSpecificTime(e.startDate, e.hasSpecificTime),
                    );
                    if (changed) {
                        result.updated++;
                        ctx.log(`  🔄 tid uppdaterad: ${e.title.slice(0, 50)} → ${e.startDate.toISOString()}`);
                    }
                    // Plats: källan ger nu en venue medan det sparade bara var
                    // stads-fallbacken (defaultCity) → geokoda och flytta.
                    const storedRow = getSqliteEvent(e.url);
                    const storedLoc = (storedRow?.locationName ?? '').trim().toLowerCase();
                    const storedUngeocoded = !(storedRow?.lat) || !(storedRow?.lng);
                    const cityLower = (e.city ?? '').trim().toLowerCase();
                    // Källan levererar nu EGNA koordinater medan det sparade bara
                    // var stadscentroid/ogeokodat → flytta eventet dit. Utan detta
                    // fastnar event som sparades innan källans koordinat-join
                    // började täcka dem på centroiden för alltid (oland.se 2026-08-31).
                    if (e.coords && (storedUngeocoded || storedRow?.geoPrecision === 'stad-centroid')) {
                        const loc = storedRow?.locationName || e.venueName || e.city || '';
                        if (await refreshEventPlace(e.url, loc, e.coords[0], e.coords[1], 'källans egna koordinater', true, 'kallkoordinat')) {
                            result.updated++;
                            ctx.log(`  📍 koordinater från källan: ${e.title.slice(0, 50)}`);
                        }
                    } else if (e.venueName && cityLower && (storedLoc === cityLower || storedLoc === '' || storedLoc === 'sverige' || storedUngeocoded)) {
                        const q = `${e.venueName}, ${e.city}`;
                        // Kandidatkedjan (t.ex. bibliotekskonsortiers medlemsorter) först, annars venue+stad.
                        let hit: GeoHit | null = e.coords ? [e.coords[0], e.coords[1], 'kallkoordinat'] : null;
                        for (const cand of (e.geocodeCandidates ?? [])) {
                            if (hit) break;
                            hit = await geocodeVenueSweden(cand, { nearCity: e.city! });
                        }
                        if (!hit) hit = await geocodeVenueSweden(q, { nearCity: e.city! });
                        // Sista utväg för OGEOKODADE: stadscentrum (synligt på kartan, och
                        // geo-refine-klustren tar det vidare) — men märk som overifierat.
                        let verified = true;
                        if (!hit && storedUngeocoded) {
                            hit = await geocodeVenueSweden(e.city!);
                            verified = false;
                            if (hit) hit = [hit[0], hit[1], 'stad-centroid'];
                        }
                        if (hit && await refreshEventPlace(e.url, q, hit[0], hit[1], e.coords ? 'källans egna koordinater' : (verified ? q : `stad: ${e.city}`), verified, hit[2])) {
                            result.updated++;
                            ctx.log(`  📍 plats uppdaterad: ${e.title.slice(0, 50)} → ${q}`);
                        }
                    }
                    // Slutdatum: kända event fylls på när källan ger ett
                    // GILTIGT (slut > start, max 30 dygn) — så flerdagars-
                    // festivaler som redan låg i DB (Live at Heart) får sitt
                    // spann utan re-skrapning från noll.
                    const validEnd = validEventEnd(e.startDate, e.endDate);
                    if (validEnd && await refreshEventEndDate(e.url, validEnd.toISOString())) {
                        result.updated++;
                        ctx.log(`  📅 slutdatum satt: ${e.title.slice(0, 50)} → ${validEnd.toISOString().slice(0, 10)}`);
                    }
                    // Innehåll: byt beskrivning BARA när källan nu bevisligen ger
                    // bättre (hel text där den sparade kapades vid gammalt tak,
                    // återfunna å/ä/ö, borttaget �, platshållare → riktig text —
                    // se utils/contentRefresh). Pris fylls bara på där det saknas;
                    // normalizeRawEvent har redan plockat pris ur texten om källan
                    // inte gav något. Utan detta låg 1 509 kapade och 159 å/ä/ö-
                    // lösa beskrivningar kvar för alltid (kända URL:er hoppas över).
                    const betterDesc = pickBetterDescription(storedRow?.description, e.description);
                    const betterPrice = pickBetterPrice(storedRow?.price, e.price);
                    if ((betterDesc || betterPrice) && await refreshEventContent(e.url, {
                        ...(betterDesc ? { description: betterDesc } : {}),
                        ...(betterPrice ? { price: betterPrice } : {}),
                    })) {
                        result.updated++;
                        const what = [betterDesc ? 'beskrivning' : '', betterPrice ? `pris ${betterPrice}` : ''].filter(Boolean).join(' + ');
                        ctx.log(`  📝 ${what} uppdaterad: ${e.title.slice(0, 50)}`);
                    }
                }
                result.skipped.duplicate++;
                continue;
            }

            // Geocoding: använd engine-koords om de finns, annars prova källans
            // kandidat-kedja (default: adress → venue+stad → stad) tills träff.
            // geocodedQuery sparas i DB så geo-refine/admin ser provenansen.
            let lat = e.coords?.[0] ?? 0;
            let lng = e.coords?.[1] ?? 0;
            let geocodedQuery = e.coords ? 'källans egna koordinater' : '';
            let geoPrecision: string | null = e.coords ? 'kallkoordinat' : null;
            // Validera källans koordinater: paraply-API:er (Naturskydd/Hembygd)
            // levererar ibland PROJICERADE koordinater (SWEREF99/RT90, t.ex.
            // lat=6129956) som spränger WGS84-intervallet och kraschar kartan.
            // Lita bara på koords inom nordiska bounds; annars kasta + geokoda.
            if ((lat || lng) && !isInNordic(lat, lng)) {
                ctx.log(`⚠️ ogiltiga koords [${lat},${lng}] från källan för "${e.title.slice(0, 40)}" — geokodar på namn`);
                lat = 0; lng = 0; geocodedQuery = ''; geoPrecision = null;
            }
            if (!opts.dryRun && !lat && !lng) {
                for (const q of geocodeQueriesFor(e)) {
                    // nearCity-validering: känner källan till staden får Nominatim
                    // inte returnera en namne i fel stad ("S:t Nikolai kyrka" →
                    // Örebro för Halmstad-event). Cache-nyckeln MÅSTE inkludera
                    // staden — samma fråga kan ge olika svar för olika städer.
                    const cacheKey = e.city ? `${q}|near:${e.city}` : q;
                    if (!geoCache.has(cacheKey)) {
                        geoCache.set(cacheKey, await geocodeVenueSweden(q, e.city ? { nearCity: e.city } : undefined));
                    }
                    const coords = geoCache.get(cacheKey);
                    if (coords) { lat = coords[0]; lng = coords[1]; geocodedQuery = q; geoPrecision = coords[2] ?? null; break; }
                }
            }

            const category = normalizeCategory(e.category || classifyEvent(e.title, e.description || ''));

            // ── LLM-audit (opt-in, kräver AUDIT_ENABLED=true + Ollama uppe) ──
            let auditVerdict: string | undefined;
            let auditConfidence: string | undefined;
            if (auditAvailable) {
                try {
                    const auditResult = await auditEvent({
                        title: e.title,
                        locationName: cleanLocationName(e.venueName || e.city),
                        extractedAddress: e.address,
                        description: e.description,
                        hostName: source.hostName,
                        url: e.url,
                    });
                    result.audited++;
                    auditVerdict    = auditResult.verdict;
                    auditConfidence = auditResult.confidence;

                    if (auditResult.verdict === 'junk' && auditResult.confidence === 'high') {
                        result.autoHidden++;
                        ctx.log(`  🗑️  auto-hide (junk/high): ${e.title.slice(0, 60)}`);
                        continue;
                    }
                } catch (auditErr) {
                    // Audit-fel bryter aldrig pipeline — logga och gå vidare.
                    ctx.log(`  ⚠️  audit-fel på "${e.title.slice(0, 40)}": ${(auditErr as Error).message}`);
                }
            }

            // Port-mismatch ("https://…:80/", Axiell-sajterna) lagas INNAN
            // logo-filtret och Storage-uppladdningen — fetch mot :80 över TLS
            // kan aldrig lyckas, så bilden blev annars kvar som död remote-URL.
            if (e.imageUrl) e.imageUrl = normalizeImagePort(e.imageUrl);
            // Loggor/platshållare (kommunsajters generiska og:image) blir
            // hellre bildlöst kort än en stadssida full av samma logga.
            if (isLikelyLogoOrPlaceholderImage(e.imageUrl)) e.imageUrl = undefined;

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

            const hasSpecificTime = deriveHasSpecificTime(e.startDate, e.hasSpecificTime);

            // Ladda upp bild till vår Storage — så vi inte är beroende av att
            // remote-URL inte expirar (typ FB CDN som expirar var 7:e dag).
            let finalImageUrl: string | null = e.imageUrl || null;
            if (finalImageUrl && !isOurStorageUrl(finalImageUrl)) {
                const hosted = await uploadEventImage(finalImageUrl, e.url);
                if (hosted) finalImageUrl = hosted;
                // Om upload misslyckas: behåll originalet (kanske funkar ett tag)
            }

            // Slutdatum bara när källan ger ett GILTIGT (slut > start, max
            // 30 dygn — utils/eventEnd); annars utelämnat helt så Firestore-
            // dokumentet inte bär ett null-fält i onödan.
            const validEnd = validEventEnd(e.startDate, e.endDate);

            pendingWrites.push({
                title: e.title,
                url: e.url,
                time: e.startDate,
                ...(validEnd ? { endDate: validEnd } : {}),
                hasSpecificTime,
                locationName: cleanLocationName(e.venueName || e.city || 'Sverige') || 'Sverige',
                extractedAddress: e.address || '',
                geocodedQuery,
                lat,
                lng,
                geoPrecision,
                // Paraply-källor (församling/klubb/krets) sätter värd per event.
                hostName: e.hostName || source.hostName,
                category,
                description: e.description || '',
                coverImage: finalImageUrl,
                // null (ej undefined) när pris saknas: Firestore vägrar undefined,
                // och SQLite-upsert COALESCE:ar null → bevarar LLM-extraherat pris.
                price: e.price || null,
                createdAt: new Date(),
                // OBS: betyder "har koordinater" (även stad-centroid) — kvalitets-
                // sanningen bor i geoPrecision. Semantiken låst av konsumenterna
                // (stadsinlägg/digest/aggregat filtrerar på flaggan).
                isLocationVerified: lat !== 0 || lng !== 0,
                // 'raw' när audit är på så eventet väntar på granskning;
                // 'published' direkt annars — annars syns det inte i webben.
                status: process.env.AUDIT_ENABLED === 'true' ? 'raw' : 'published',
            });
            result.saved++;

            if (auditVerdict && auditConfidence) {
                setEventAudit(e.url, auditVerdict, auditConfidence);
            }
        } catch (err) {
            result.errors.push(`event "${e.title}": ${(err as Error).message}`);
        }
    }

    // Flusha alla nya event i batchade Firestore-skrivningar (SQLite skrivs alltid,
    // även om en commit fallerar). Dedup mot existerande är redan gjord i loopen.
    if (!opts.dryRun && pendingWrites.length > 0) {
        const { written, errors } = await addEventsBatch(pendingWrites);
        errors.forEach((er) => result.errors.push(er));
        ctx.log(`batch: ${written}/${pendingWrites.length} event skrivna till Firestore`);
    }

    result.durationMs = Date.now() - startedAt;
    const auditSuffix = result.audited > 0
        ? `, audited ${result.audited}, auto-hidden ${result.autoHidden}`
        : '';
    const updatedSuffix = result.updated > 0 ? `, updated ${result.updated}` : '';
    ctx.log(
        `done in ${result.durationMs}ms — saved ${result.saved}${updatedSuffix}, ` +
        `dup ${result.skipped.duplicate}, outside ${result.skipped.outsideWindow}, ` +
        `invalid ${result.skipped.invalid}, errors ${result.errors.length}${auditSuffix}`,
    );

    // Dry-run lämnar inga spår: en "would save 19686"-rad i scrape_runs skulle
    // förgifta daily-report och expectedMinEvents-regressionen.
    if (!opts.dryRun) persistRun(source, startedAt, result);
    // Motorn gick igenom → svepet är gjort för den här källan (per-event-fel
    // hindrar inte; en motorkrasch returnerar tidigare och stämplar inte).
    if (sweepDue) setSyncMeta(sweepKey(source.id), CONTENT_SWEEP_VERSION);
    return result;
}

/** Persist run-history för observability — anropas även vid engine-krasch/felkonfig. */
function persistRun(source: Source, startedAt: number, result: SourceRunResult): void {
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
        hiddenCount: 0,
        errors: result.errors.map(e => e.slice(0, 300)),
        auditedCount: result.audited,
        autoHiddenCount: result.autoHidden,
    });
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
