/**
 * Listing-engine — event ur en listsida UTAN detaljsidor: krogens "Event"-sida,
 * biografens "Evenemang", scenens program. Rubrik + datumrad + lite text, allt
 * på samma sida.
 *
 * Motorn hämtar sidan och låter utils/listingBlocks tolka den; där står också
 * reglerna för vad som räknas som en datumrad och en titel. Eventens adress är
 * listsidan med ett fragment ("…/evenemang/#2026-11-21-quiz-med-kalle") — url
 * är primärnyckel, och fragmentet gör varje tillfälle till sin egen rad.
 *
 * Config:
 *   urls:          string[]  — listsidorna
 *   defaultCity?:  string    — orten (sidan säger sällan sin egen)
 *   defaultVenue?: string    — stället självt; utan den hamnar eventen på ortens mittpunkt
 *   userAgent?:    string    — default 'VadKul/1.0 (+https://vadkul.se)'
 *   timeoutMs?:    number    — default 20000
 *
 * Källor av den här sorten hittas av snöbollens prob (bulk-probe, metoden
 * "listing-inline") och går genom samma rimlighetskontroll som alla andra.
 */

import { RawEvent, EngineContext } from '../types';
import { domainLimiter } from '../rateLimiter';
import { fetchWithRetry } from '../../utils/fetchWithRetry';
import { parseListing } from '../../utils/listingBlocks';
import { decodeHtmlBytes } from '../../utils/htmlCharset';

export interface ListingConfig {
    urls: string[];
    defaultCity?: string;
    defaultVenue?: string;
    userAgent?: string;
    timeoutMs?: number;
}

const DEFAULT_UA = 'VadKul/1.0 (+https://vadkul.se)';

async function fetchPage(url: string, cfg: ListingConfig, signal?: AbortSignal): Promise<string | null> {
    await domainLimiter.wait(url);
    try {
        const res = await fetchWithRetry(url, {
            headers: {
                'User-Agent': cfg.userAgent ?? DEFAULT_UA,
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
            },
        }, { signal, timeoutPerAttemptMs: cfg.timeoutMs ?? 20_000, label: url });
        if (!res.ok) return null;
        // Små sajter ligger ofta kvar på ISO-8859-1 — res.text() gör å/ä/ö till "�".
        return decodeHtmlBytes(new Uint8Array(await res.arrayBuffer()), res.headers.get('content-type'));
    } catch {
        return null;
    }
}

export async function listingEngine(config: ListingConfig, ctx: EngineContext): Promise<RawEvent[]> {
    const out: RawEvent[] = [];
    const seen = new Set<string>();
    for (const url of config.urls) {
        const html = await fetchPage(url, config, ctx.signal);
        if (!html) { ctx.log(`listing: kunde inte hämta ${url}`); continue; }
        const events = parseListing(html, url);
        ctx.log(`listing: ${events.length} event på ${url}`);
        for (const e of events) {
            if (seen.has(e.url)) continue;
            seen.add(e.url);
            out.push({
                title: e.title,
                startDate: e.start,
                endDate: e.end,
                url: e.url,
                venueName: config.defaultVenue || undefined,
                city: config.defaultCity || undefined,
                description: e.description || undefined,
                imageUrl: e.imageUrl,
                price: e.price,
                hasSpecificTime: e.hasTime,
            });
        }
    }
    return out;
}
