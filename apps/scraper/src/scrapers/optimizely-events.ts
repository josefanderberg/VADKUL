/**
 * optimizely-events — Engine för Optimizely/EPiServer-kommunernas
 * `/api/v1/eventsselection`-endpoint.
 *
 * Upptäckt 2026-08-26 på vallentuna.se: kalendersidan är en JS-vy som hämtar
 * hela kalendern i ETT anrop.
 *
 *   GET https://<kommun>.se/api/v1/eventsselection?CurrentPageId=<guid>
 *
 * Öppet, ingen auth, ingen paginering — 82 event i ett svar. `CurrentPageId`
 * är kalendersidans innehålls-GUID och står i sidans egen XHR.
 *
 * Fältkvalitet (Vallentuna, 82 event 2026-08-26):
 *   - Dates[]                 förekomstserie med StartDate/StopDate (ISO+offset)
 *   - Location                venue-namn
 *   - ImageUrl, Excerpt, Categories
 *   - Url                     relativ sidsökväg
 *
 * FÄLLA: toppnivåns `StartDate`/`StopDate` är NULL för återkommande event —
 * de riktiga datumen ligger bara i `Dates[]`. Läser man toppnivån tappar man
 * hela serien. `FirstStartOccurence` finns men pekar på seriens FÖRSTA
 * tillfälle, som ofta ligger i det förflutna.
 *
 * En rad per tillfälle → serie-dedup på (titel) behåller första kommande.
 */

import { Engine, RawEvent } from '../sources/types';
import { cleanDescription } from '../utils/text';
import { dedupeSeries } from './pro';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface OptimizelyEventsConfig {
    /** Sajtens bas, t.ex. https://www.vallentuna.se */
    baseUrl: string;
    /** Kalendersidans innehålls-GUID (ur sidans XHR) */
    currentPageId: string;
    defaultCity?: string;
}

interface OptiDate { StartDate?: string; StopDate?: string }
interface OptiEvent {
    Name?: string;
    Url?: string;
    Excerpt?: string;
    StartDate?: string | null;
    StopDate?: string | null;
    Dates?: OptiDate[];
    ImageUrl?: string;
    Location?: string;
    Categories?: string[];
}

/** Mappa en post → ett RawEvent per tillfälle. Exporterad för test. */
export function mapOptiEvent(
    e: OptiEvent,
    cfg: OptimizelyEventsConfig,
): RawEvent[] {
    const title = e.Name?.trim();
    const path = e.Url?.trim();
    if (!title || !path) return [];

    let url: string;
    try { url = new URL(path, cfg.baseUrl).toString(); } catch { return []; }

    // Dates[] är sanningen; toppnivåns StartDate är null för serier.
    const occs: OptiDate[] = e.Dates?.length
        ? e.Dates
        : (e.StartDate ? [{ StartDate: e.StartDate, StopDate: e.StopDate ?? undefined }] : []);
    if (!occs.length) return [];

    const description = cleanDescription(e.Excerpt || '') || undefined;
    const imageUrl = e.ImageUrl
        ? (() => { try { return new URL(e.ImageUrl!, cfg.baseUrl).toString(); } catch { return undefined; } })()
        : undefined;

    const out: RawEvent[] = [];
    for (const o of occs) {
        if (!o.StartDate) continue;
        const start = new Date(o.StartDate);
        if (isNaN(start.getTime())) continue;
        const stop = o.StopDate ? new Date(o.StopDate) : null;
        out.push({
            title,
            startDate: start,
            endDate: stop && !isNaN(stop.getTime()) && stop > start ? stop : undefined,
            url: `${url}#${o.StartDate.slice(0, 10)}`,
            venueName: e.Location?.trim() || undefined,
            city: cfg.defaultCity,
            description,
            imageUrl,
            category: e.Categories?.[0],
            hasSpecificTime: !/T00:00:00/.test(o.StartDate) ? true : undefined,
        });
    }
    return out;
}

export const optimizelyEventsEngine: Engine = async (config: OptimizelyEventsConfig, ctx) => {
    const url = `${config.baseUrl.replace(/\/$/, '')}/api/v1/eventsselection`
        + `?CurrentPageId=${encodeURIComponent(config.currentPageId)}`;
    let raw: unknown;
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': UA, Accept: 'application/json' },
            signal: ctx.signal ?? AbortSignal.timeout(30_000),
        });
        if (!res.ok) { ctx.log(`eventsselection HTTP ${res.status}`); return []; }
        raw = await res.json();
    } catch (err) {
        ctx.log(`eventsselection-fel: ${(err as Error).message}`);
        return [];
    }
    if (!Array.isArray(raw)) { ctx.log('eventsselection gav icke-lista'); return []; }

    const all: RawEvent[] = [];
    for (const e of raw as OptiEvent[]) all.push(...mapOptiEvent(e, config));
    const inWindow = all.filter((e) => e.startDate >= ctx.windowStart && e.startDate < ctx.windowEnd);
    const deduped = dedupeSeries(inWindow.sort((a, b) => a.startDate.getTime() - b.startDate.getTime()));
    ctx.log(`eventsselection: ${(raw as OptiEvent[]).length} poster → ${all.length} tillfällen → ${deduped.length} efter serie-dedup`);
    return deduped;
};
