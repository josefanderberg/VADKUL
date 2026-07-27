/**
 * WPGraphQL-engine — headless-WordPress-sajter som exponerar events via
 * WPGraphQL (upptäckt på boras.com 2026-07-27: Next.js-frontend, WP-backend
 * på cms.boras.com med öppen /graphql).
 *
 * Query-formen följer ACF-fältgruppen "acfEvents" (Borås TME:s schema):
 *   events(first: N, after: cursor) { nodes { title uri excerpt
 *     featuredImage { node { sourceUrl } }
 *     acfEvents { eventDateFrom eventDateTo eventTime eventPlace
 *                 eventVisitingAddress eventIngress } } }
 *
 * Fallgropar (verifierade på boras.com):
 *  - wp/v2-REST:en finns men acf:[] — datumen bor BARA i GraphQL/_next-data.
 *  - eventDateFrom är "YYYY-MM-DD", eventTime "HH:MM" (kan saknas).
 *  - uri är frontend-relativ ("/evenemang/<slug>/") → prefixas med eventBaseUrl.
 *  - excerpt är HTML — strippas; eventIngress föredras när den finns.
 *  - Passerade event trashas automatiskt av källan (publishpress_future),
 *    så listan är i praktiken självstädande.
 */

import { RawEvent, EngineContext } from '../types';
import { domainLimiter } from '../rateLimiter';
import { cleanDescription } from '../../utils/text';

const DEFAULT_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface WpGraphqlConfig {
    /** GraphQL-endpoint, t.ex. https://cms.boras.com/graphql */
    endpoint: string;
    /** Publika sajtens bas för event-URL:er, t.ex. https://www.boras.com */
    eventBaseUrl: string;
    defaultCity?: string;
    pageSize?: number;
    maxItems?: number;
    userAgent?: string;
    timeoutMs?: number;
}

interface AcfEventsNode {
    title?: string;
    uri?: string;
    excerpt?: string;
    featuredImage?: { node?: { sourceUrl?: string } };
    acfEvents?: {
        eventDateFrom?: string;   // "2026-08-01"
        eventDateTo?: string;
        eventTime?: string;       // "11:00"
        eventPlace?: string;
        eventVisitingAddress?: string;
        eventIngress?: string;
    };
}

const EVENTS_QUERY = `query VadkulEvents($first: Int!, $after: String) {
  events(first: $first, after: $after, where: { language: SV }) {
    pageInfo { hasNextPage endCursor }
    nodes {
      title
      uri
      excerpt
      featuredImage { node { sourceUrl } }
      acfEvents {
        eventDateFrom
        eventDateTo
        eventTime
        eventPlace
        eventVisitingAddress
        eventIngress
      }
    }
  }
}`;

/** "2026-08-01" + ev. "11:00" → lokal Date. Exporterad för test. */
export function parseAcfDate(
    date: string | undefined,
    time: string | undefined,
): { date: Date; hasClock: boolean } | null {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) return null;
    const [y, mo, da] = date.trim().split('-').map((n) => parseInt(n, 10));
    const clock = time && /^\d{1,2}[:.]\d{2}$/.test(time.trim())
        ? time.trim().replace('.', ':') : null;
    const [hh, mi] = clock ? clock.split(':').map((n) => parseInt(n, 10)) : [0, 0];
    const d = new Date(y, mo - 1, da, hh, mi);
    if (isNaN(d.getTime())) return null;
    return { date: d, hasClock: !!clock };
}

/** Mappa en GraphQL-nod → RawEvent. Exporterad för test. */
export function mapAcfEventsNode(
    node: AcfEventsNode,
    config: WpGraphqlConfig,
    windowStart: Date,
): RawEvent | null {
    const title = (node.title || '').trim();
    const uri = (node.uri || '').trim();
    if (!title || !uri) return null;
    const url = /^https?:\/\//.test(uri)
        ? uri
        : `${config.eventBaseUrl.replace(/\/$/, '')}${uri.startsWith('/') ? '' : '/'}${uri}`;

    const acf = node.acfEvents ?? {};
    let parsed = parseAcfDate(acf.eventDateFrom, acf.eventTime);
    if (!parsed) return null;

    // Pågående fleradagars-event (utställningar m.m.) ankras på windowStart så
    // de inte klipps av runnerns datumfönster.
    if (parsed.date < windowStart && acf.eventDateTo) {
        const end = parseAcfDate(acf.eventDateTo, undefined);
        if (end && end.date >= windowStart) {
            parsed = { date: new Date(windowStart), hasClock: false };
        }
    }

    const description = acf.eventIngress?.trim()
        || cleanDescription(node.excerpt || '')
        || undefined;

    return {
        title,
        startDate: parsed.date,
        url,
        venueName: acf.eventPlace?.trim() || undefined,
        address: acf.eventVisitingAddress?.trim() || undefined,
        city: config.defaultCity,
        description,
        imageUrl: node.featuredImage?.node?.sourceUrl || undefined,
        hasSpecificTime: parsed.hasClock ? true : undefined,
    };
}

async function postQuery(
    config: WpGraphqlConfig,
    variables: Record<string, unknown>,
    signal?: AbortSignal,
): Promise<any | null> {
    await domainLimiter.wait(config.endpoint);
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), config.timeoutMs ?? 20000);
    signal?.addEventListener('abort', () => ac.abort(), { once: true });
    try {
        const res = await fetch(config.endpoint, {
            method: 'POST',
            headers: {
                'User-Agent': config.userAgent ?? DEFAULT_UA,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ query: EVENTS_QUERY, variables }),
            signal: ac.signal,
        });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    } finally {
        clearTimeout(t);
    }
}

export const wpGraphqlEngine = async (
    config: WpGraphqlConfig,
    ctx: EngineContext,
): Promise<RawEvent[]> => {
    const pageSize = config.pageSize ?? 100;
    const cap = config.maxItems ?? 1000;
    const events: RawEvent[] = [];
    const seenUrls = new Set<string>();

    let after: string | null = null;
    for (let page = 0; page < 20 && events.length < cap; page++) {
        const body = await postQuery(config, { first: pageSize, after }, ctx.signal);
        const conn = body?.data?.events;
        if (!conn) {
            ctx.log(`graphql svarade utan events-data (sida ${page + 1})`
                + (body?.errors ? `: ${JSON.stringify(body.errors).slice(0, 200)}` : ''));
            break;
        }
        for (const node of conn.nodes ?? []) {
            const ev = mapAcfEventsNode(node, config, ctx.windowStart);
            if (!ev || seenUrls.has(ev.url)) continue;
            seenUrls.add(ev.url);
            events.push(ev);
        }
        if (!conn.pageInfo?.hasNextPage) break;
        after = conn.pageInfo.endCursor;
    }
    ctx.log(`wp-graphql: ${events.length} event`);
    return events;
};
