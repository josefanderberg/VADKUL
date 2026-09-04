/**
 * bestevent — Engine för Innocodes "BestEvent", kalenderplattformen bakom
 * `kalender.<kommun>.se` (Lerum, Hylte, Danderyd per 2026-08-26).
 *
 * Upptäckt under kommun-svans-svepet: Lerums kalender ligger på en egen
 * subdomän som kommunsajten knappt länkar till, och bakom den finns ett rent
 * JSON-API utan auth:
 *
 *   GET https://kalender.<kommun>.se/api/events?page=N
 *
 * FÄLLA — pagineringen är PER DAG, inte per resultatmängd. `page=1` är i dag,
 * `page=2` i morgon, och `total` är hela kalenderns storlek (inte dagens).
 * `start`/`end`/`per_page`/`interval` IGNORERAS tyst: svaret sätter alltid
 * `interval: "day"` för dygnet som `page` pekar ut. Ett 30-dagarsfönster
 * kräver alltså 30 anrop — den enda vägen. Tomma dagar ger `events: []`
 * och ska inte avbryta loopen (helger och lov är hålslagna).
 *
 * Fältkvalitet (Lerum, 289 event i kalendern):
 *   - eventTime/eventEndTime  ISO med offset — riktig lokal tid
 *   - location                venue-NAMN (ingen gatuadress, inga koordinater)
 *   - organizerName           arrangör, bra hostName för paraply-kalendern
 *   - posterUrl/posterUrls[]  bild när arrangören laddat upp en
 *   - categoryName            "Kultur & nöje", "Upplevelser", …
 *   - eventSlug               → https://kalender.<kommun>.se/events/<slug>
 *
 * `status` är "approved" för publicerade poster — allt annat filtreras.
 */

import { Engine, RawEvent } from '../sources/types';
import { cleanDescription } from '../utils/text';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MAX_DAYS = 60;

export interface BestEventConfig {
    /** Kalenderns bas, t.ex. https://kalender.lerum.se */
    baseUrl: string;
    defaultCity?: string;
}

interface BestEventItem {
    id?: number;
    title?: string;
    eventSlug?: string;
    status?: string;
    location?: string;
    organizerName?: string;
    eventTime?: string;       // "2026-08-26T10:00:00.000+02:00"
    eventEndTime?: string;
    startDate?: string;       // "2026-08-26"
    posterUrl?: string;
    posterUrls?: string[];
    categoryName?: string;
    description?: string;
}

/** Mappa en BestEvent-post → RawEvent. Exporterad för test. */
export function mapBestEvent(
    item: BestEventItem,
    cfg: BestEventConfig,
): RawEvent | null {
    const title = item.title?.trim();
    const slug = item.eventSlug?.trim();
    if (!title || !slug) return null;
    if (item.status && item.status !== 'approved') return null;

    const raw = item.eventTime || item.startDate;
    if (!raw) return null;
    const start = new Date(raw);
    if (isNaN(start.getTime())) return null;
    const end = item.eventEndTime ? new Date(item.eventEndTime) : null;

    // Heldagsposter kommer som exakt midnatt lokal tid — låt runnerns
    // midnatts-heuristik avgöra, sätt inte hasSpecificTime.
    const hasClock = !!item.eventTime && !/T00:00:00/.test(item.eventTime);

    return {
        externalId: item.id != null ? `${item.id}` : undefined,
        title,
        startDate: start,
        endDate: end && !isNaN(end.getTime()) && end > start ? end : undefined,
        url: `${cfg.baseUrl.replace(/\/$/, '')}/events/${slug}`,
        venueName: item.location?.trim() || undefined,
        city: cfg.defaultCity,
        description: cleanDescription(item.description || '') || undefined,
        imageUrl: item.posterUrl || item.posterUrls?.[0] || undefined,
        organizer: item.organizerName?.trim() || undefined,
        hostName: item.organizerName?.trim() || undefined,
        category: item.categoryName?.trim() || undefined,
        hasSpecificTime: hasClock ? true : undefined,
    };
}

export const bestEventEngine: Engine = async (config: BestEventConfig, ctx) => {
    const base = config.baseUrl.replace(/\/$/, '');
    const days = Math.min(
        MAX_DAYS,
        Math.ceil((ctx.windowEnd.getTime() - ctx.windowStart.getTime()) / 864e5),
    );
    const events: RawEvent[] = [];
    const seen = new Set<string>();
    let emptyDays = 0;

    // page = dygn framåt från i dag. Tomma dagar är normala — bryt inte.
    for (let page = 1; page <= days; page++) {
        let data: { events?: BestEventItem[] };
        try {
            const res = await fetch(`${base}/api/events?page=${page}`, {
                headers: { 'User-Agent': UA, Accept: 'application/json' },
                signal: ctx.signal ?? AbortSignal.timeout(20_000),
            });
            if (!res.ok) { ctx.log(`BestEvent HTTP ${res.status} (dag ${page})`); break; }
            data = await res.json();
        } catch (err) {
            ctx.log(`BestEvent-fel dag ${page}: ${(err as Error).message}`);
            break;
        }
        const items = data.events ?? [];
        if (!items.length) { emptyDays++; continue; }
        for (const it of items) {
            const ev = mapBestEvent(it, config);
            if (!ev || seen.has(ev.url)) continue;
            seen.add(ev.url);
            events.push(ev);
        }
    }

    ctx.log(`BestEvent: ${events.length} event över ${days} dagar (${emptyDays} tomma)`);
    return events;
};
