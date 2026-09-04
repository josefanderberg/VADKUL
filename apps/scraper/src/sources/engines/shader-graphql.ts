/**
 * Shader-CMS-engine — scenkonsthus på cms.shader.build (upptäckt via
 * ostgotateatern.se 2026-09-04: Nuxt-frontend, öppen GraphQL per tenant på
 * https://cms.shader.build/<tenant>/graphql).
 *
 * Schemat är gemensamt för tenants (Scenkonst Öst-familjen): Östgötateatern
 * och Östgötamusiken kör båda `scenkonstOtPerformanceEvents` (typ TixEvent —
 * tillfällen ur biljettsystemet Tix) + `scenkonstOtPerformances` (innehåll).
 *
 * Fallgropar (verifierade 2026-09-04):
 *  - Introspektion är BLOCKAD ("Unauthorized introspection query") men vanliga
 *    queries är öppna; fel fältnamn ger "Did you mean …"-förslag.
 *  - Frontendens proxy (/api/graphql) svarar {"error":"input is invalid type"}
 *    på curl-POST — gå direkt mot cms.shader.build.
 *  - startDate på tillfällen är ISO med offset och RIKTIG tid; performances
 *    egna startDate/endDate är bara spelperiodens datum (00:00).
 *  - locationStage är en fri sträng som oftast bär scen + stad
 *    ("Stora Teatern - Linköping", "Crusellhallen, Linköping") men ibland
 *    varken eller ("Annan spelplats", "På turné").
 *  - Alla tillfällen i en serie delar performance.pageUrl (= vår url-nyckel):
 *    motorn dedupar per url och behåller nästa kommande tillfälle, annars
 *    ratchetar refresh-körningar tiden till seriens SISTA föreställning.
 */

import { RawEvent, EngineContext } from '../types';
import { domainLimiter } from '../rateLimiter';
import { cleanDescription, truncateAtBoundary, DEFAULT_DESCRIPTION_MAX } from '../../utils/text';

const DEFAULT_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface ShaderGraphqlConfig {
    /** GraphQL-endpoint, t.ex. https://cms.shader.build/ostgotateatern/graphql */
    endpoint: string;
    /** Publika sajtens bas för pageUrl, t.ex. https://www.ostgotateatern.se */
    eventBaseUrl: string;
    /**
     * Städer som locationStage kan bära ("Linköping", "Norrköping").
     * Träff sätter city OCH rensas ur venue-namnet.
     */
    cities: string[];
    /**
     * Stad när locationStage inte bär någon ("Winden", "Wallenbergsalen" hos
     * Östgötamusiken = deras hus i Linköping). UTELÄMNAD ⇒ tillfällen utan
     * stad SLOPAS — hellre bortfall än fel ort (Östgötateatern spelar i två
     * städer, så en gissning vore fel hälften av gångerna).
     */
    defaultCity?: string;
    userAgent?: string;
    timeoutMs?: number;
    maxItems?: number;
}

interface TixEventNode {
    id?: string;
    startDate?: string;      // "2026-09-05T15:00:00+02:00" — riktig tid
    endDate?: string;
    purchaseUrl?: string | null;
    locationStage?: string | null;
    performance?: {
        id?: string;
        title?: string;
        subtitle?: string | null;
        pageUrl?: string;    // frontend-relativ, delas av seriens tillfällen
    } | null;
}

const EVENTS_QUERY = `query VadkulEvents {
  scenkonstOtPerformanceEvents {
    id
    startDate
    endDate
    purchaseUrl
    locationStage
    performance { id title subtitle pageUrl }
  }
}`;

const PERFORMANCES_QUERY = `query VadkulPerformances {
  scenkonstOtPerformances(archived: false, limit: 200) {
    id
    about
    image { variant { url } }
  }
}`;

/**
 * "Stora Teatern - Linköping" → { venueName: "Stora Teatern", city: "Linköping" }.
 * Staden kan även ligga inbakad i scennamnet ("Stora Teatern Linköping -
 * onumrerad"). Exporterad för test.
 */
export function parseLocationStage(
    stage: string | null | undefined,
    cities: string[],
): { venueName?: string; city?: string } {
    const raw = (stage || '').replace(/\s+/g, ' ').trim();
    if (!raw) return {};

    let city: string | undefined;
    for (const c of cities) {
        if (new RegExp(`(^|[\\s,–-])${c}($|[\\s,–-])`, 'i').test(raw)) { city = c; break; }
    }

    // Venue = första segmentet, med ev. stadsnamn bortrensat.
    let venue = raw.split(/\s*[,–]\s*|\s+-\s+/)[0] ?? '';
    if (city) venue = venue.replace(new RegExp(`\\s*${city}\\s*`, 'i'), ' ').trim();
    venue = venue.replace(/\s+/g, ' ').trim();

    return { venueName: venue || undefined, city };
}

/** Mappa ett Tix-tillfälle → RawEvent. Exporterad för test. */
export function mapTixEventNode(
    node: TixEventNode,
    config: ShaderGraphqlConfig,
    descriptions: Map<string, string>,
    images: Map<string, string> = new Map(),
): RawEvent | null {
    const title = (node.performance?.title || '').replace(/\s+/g, ' ').trim();
    const pageUrl = (node.performance?.pageUrl || '').trim();
    const startRaw = node.startDate;
    if (!title || !pageUrl || !startRaw) return null;

    const start = new Date(startRaw);
    if (isNaN(start.getTime())) return null;
    const end = node.endDate ? new Date(node.endDate) : undefined;

    const { venueName, city } = parseLocationStage(node.locationStage, config.cities);
    const resolvedCity = city ?? config.defaultCity;
    if (!resolvedCity) return null; // hellre bortfall än fel ort

    const url = /^https?:\/\//.test(pageUrl)
        ? pageUrl
        : `${config.eventBaseUrl.replace(/\/$/, '')}${pageUrl.startsWith('/') ? '' : '/'}${pageUrl}`;

    const perfId = node.performance?.id;
    const about = perfId ? descriptions.get(perfId) : undefined;
    const subtitle = node.performance?.subtitle?.trim() || undefined;

    return {
        externalId: node.id,
        title,
        startDate: start,
        endDate: end && !isNaN(end.getTime()) && end > start ? end : undefined,
        url,
        venueName,
        city: resolvedCity,
        description: about || subtitle,
        imageUrl: perfId ? images.get(perfId) : undefined,
        hasSpecificTime: true, // Tix-tillfällen bär alltid klockslag
    };
}

async function postGraphql(
    config: ShaderGraphqlConfig,
    query: string,
): Promise<Record<string, unknown> | null> {
    await domainLimiter.wait(config.endpoint);
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), config.timeoutMs ?? 20000);
    try {
        const res = await fetch(config.endpoint, {
            method: 'POST',
            headers: {
                'User-Agent': config.userAgent ?? DEFAULT_UA,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query }),
            signal: ac.signal,
        });
        if (!res.ok) return null;
        const json = await res.json() as { data?: Record<string, unknown> };
        return json.data ?? null;
    } catch {
        return null;
    } finally {
        clearTimeout(t);
    }
}

export const shaderGraphqlEngine = async (
    config: ShaderGraphqlConfig,
    ctx: EngineContext,
): Promise<RawEvent[]> => {
    const data = await postGraphql(config, EVENTS_QUERY);
    const nodes = (data?.scenkonstOtPerformanceEvents ?? []) as TixEventNode[];
    if (nodes.length === 0) {
        ctx.log('inga tillfällen från GraphQL');
        return [];
    }

    // Beskrivningar (about-HTML) + bild per performance-id — ett extra anrop totalt.
    const descriptions = new Map<string, string>();
    const images = new Map<string, string>();
    const perfData = await postGraphql(config, PERFORMANCES_QUERY);
    const perfs = (perfData?.scenkonstOtPerformances ?? []) as Array<{
        id?: string; about?: string; image?: { variant?: { url?: string } };
    }>;
    for (const p of perfs) {
        if (!p.id) continue;
        if (p.about) {
            const clean = cleanDescription(p.about);
            if (clean) descriptions.set(p.id, truncateAtBoundary(clean, DEFAULT_DESCRIPTION_MAX));
        }
        if (p.image?.variant?.url) images.set(p.id, p.image.variant.url);
    }

    const cap = config.maxItems ?? 1000;
    const events: RawEvent[] = [];
    let dropped = 0;
    for (const node of nodes) {
        const ev = mapTixEventNode(node, config, descriptions, images);
        if (ev) events.push(ev); else dropped++;
        if (events.length >= cap) break;
    }

    // Serier delar url — behåll nästa kommande tillfälle (första ≥ windowStart),
    // annars ratchetar refresh-körningar tiden till seriens sista datum.
    events.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    const byUrl = new Map<string, RawEvent>();
    for (const ev of events) {
        const kept = byUrl.get(ev.url);
        if (!kept) { byUrl.set(ev.url, ev); continue; }
        if (kept.startDate < ctx.windowStart && ev.startDate >= ctx.windowStart) {
            byUrl.set(ev.url, ev);
        }
    }

    const out = [...byUrl.values()];
    ctx.log(`shader-graphql: ${nodes.length} tillfällen → ${out.length} unika event`
        + (dropped ? ` (${dropped} slopade: stad/fält saknas)` : ''));
    return out;
};
