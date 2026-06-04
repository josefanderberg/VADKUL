/**
 * Drupal probe — letar efter event-endpoints på Drupal-baserade kommunsajter.
 *
 * Många mindre svenska kommuner kör Drupal (8/9/10). Vanliga sätt att hitta
 * deras evenemang programmatiskt:
 *
 *   1. **JSON:API** (Drupal 8.7+, ofta påslaget) — `/jsonapi/node/<type>`
 *      där `<type>` är content-type-machine-name. Returnerar JSON:API-format
 *      `{ data: [...], links, meta: { count } }`.
 *
 *   2. **REST + `?_format=json`** på en sida som listar events. Drupal
 *      serializear noden till JSON om man frågar med rätt format.
 *
 *   3. **Views REST export** (`/event-feed`, `/kalender/feed.json` etc) —
 *      konfig per sajt, svårare att gissa.
 *
 *   4. **RSS** på event-listan (`/evenemang/rss.xml`) — kan parsas som iCal-light.
 *
 * Vi probar #1 + #2 systematiskt. För varje kommun:
 *
 *   a) GET /jsonapi → om svar är JSON med `jsonapi.version` → det är Drupal-JSONAPI.
 *      Försök sedan `/jsonapi/node/<type>` för en lista av kandidat-typer.
 *   b) GET /<path>?_format=json där `<path>` är en kandidat-event-sida.
 *      Om Drupal returnerar JSON med node-data, det är en träff.
 *
 * Output:
 *   - Live-tabell på stdout (samma format som probe-wp)
 *   - Genererad Source-config — wp-rest-engine kan inte hantera Drupal JSON:API,
 *     så vi flaggar dem som behöver en ny 'drupal'-engine. Source-configs
 *     emitteras med engine: 'drupal' och variant: 'jsonapi'|'rest-format'.
 *
 * Användning:
 *   npm run probe-drupal
 *   npm run probe-drupal -- --concurrency=20
 *   npm run probe-drupal -- --filter=stockholm
 */

import { KOMMUNER, Kommun } from '../sources/data/kommuner';

interface ProbeResult {
    kommun: string;
    host: string;
    method: 'jsonapi' | 'rest-format';
    endpoint: string;
    httpStatus: number;
    eventCount?: number;
    sampleTitles: string[];
    error?: string;
}

/**
 * Vanliga Drupal-machine-names för event-content-types. Vi gissar tio första.
 * Svenska kommuner använder ofta CMS:et på svenska — därför både engelska och
 * svenska namn.
 */
const JSONAPI_TYPES = [
    'event',
    'events',
    'evenemang',
    'arrangemang',
    'aktivitet',
    'aktiviteter',
    'kalender',
    'kalenderhandelse',
    'evenemangskalender',
    'happening',
];

/**
 * Sidor som ofta exponerar event-listan när man tackar ?_format=json. Vi
 * provar varje för varje host.
 */
const REST_FORMAT_PATHS = [
    '/evenemang?_format=json',
    '/sv/evenemang?_format=json',
    '/kalender?_format=json',
    '/sv/kalender?_format=json',
    '/events?_format=json',
    '/aktiviteter?_format=json',
    '/arrangemang?_format=json',
];

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const FETCH_TIMEOUT_MS = 8000;

function hostsFor(k: Kommun): string[] {
    const out = [`https://www.${k.domain}`, `https://${k.domain}`];
    if (k.tourismDomain) {
        out.push(`https://www.${k.tourismDomain}`);
        out.push(`https://${k.tourismDomain}`);
    }
    return out;
}

async function fetchJson(url: string): Promise<{ status: number; body: any | null; error?: string }> {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': UA, 'Accept': 'application/vnd.api+json, application/json' },
            signal: ac.signal,
            redirect: 'follow',
        });
        if (!res.ok) return { status: res.status, body: null };
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('json')) return { status: res.status, body: null, error: 'non-json' };
        const body = await res.json();
        return { status: res.status, body };
    } catch (e) {
        return { status: 0, body: null, error: (e as Error).name === 'AbortError' ? 'timeout' : (e as Error).message };
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Är detta en Drupal JSON:API-rot? Drupal returnerar
 *   { jsonapi: { version, meta }, data?, links }
 */
function isJsonApiRoot(body: any): boolean {
    return body && typeof body === 'object' && body.jsonapi && body.jsonapi.version;
}

/**
 * Plocka titel ur Drupal JSON:API node-resource:
 *   { type: 'node--event', id, attributes: { title, ... } }
 */
function extractJsonApiTitles(body: any): string[] {
    const data = Array.isArray(body?.data) ? body.data : [];
    return data.slice(0, 3)
        .map((n: any) => String(n?.attributes?.title || n?.attributes?.label || '').trim())
        .filter(Boolean);
}

function extractJsonApiCount(body: any): number {
    const data = Array.isArray(body?.data) ? body.data : [];
    const metaCount = body?.meta?.count;
    return typeof metaCount === 'number' ? metaCount : data.length;
}

/**
 * Probar en host: först /jsonapi, sedan typ-listor, sedan rest-format-paths.
 * Returnerar vid första hit (snabbt).
 */
async function probeHost(kommun: string, host: string): Promise<ProbeResult[]> {
    const results: ProbeResult[] = [];

    // (1) Är /jsonapi över huvud taget aktivt?
    const rootUrl = `${host}/jsonapi`;
    const root = await fetchJson(rootUrl);
    if (root.status === 200 && isJsonApiRoot(root.body)) {
        for (const type of JSONAPI_TYPES) {
            const url = `${host}/jsonapi/node/${type}?page[limit]=5`;
            const r = await fetchJson(url);
            const result: ProbeResult = {
                kommun,
                host,
                method: 'jsonapi',
                endpoint: `/jsonapi/node/${type}`,
                httpStatus: r.status,
                sampleTitles: r.body ? extractJsonApiTitles(r.body) : [],
                error: r.error,
            };
            if (r.status === 200 && r.body && Array.isArray(r.body.data)) {
                result.eventCount = extractJsonApiCount(r.body);
                results.push(result);
                if (result.eventCount > 0) return results; // klar — har en träff
            }
        }
    }

    // (2) Prova ?_format=json på kandidat-paths
    for (const path of REST_FORMAT_PATHS) {
        const url = `${host}${path}`;
        const r = await fetchJson(url);
        if (r.status === 200 && r.body) {
            // Drupal REST-format-svar kan vara antingen array av noder eller {nodes:[]}
            // eller en HTML-render serialized som single-node — försök läsa items
            const items = Array.isArray(r.body) ? r.body
                : Array.isArray(r.body?.nodes) ? r.body.nodes
                : Array.isArray(r.body?.items) ? r.body.items
                : Array.isArray(r.body?.data) ? r.body.data
                : null;
            if (items && items.length > 0) {
                const sampleTitles = items.slice(0, 3)
                    .map((n: any) => String(n?.title?.[0]?.value || n?.title || n?.label || '').trim())
                    .filter(Boolean);
                results.push({
                    kommun,
                    host,
                    method: 'rest-format',
                    endpoint: path,
                    httpStatus: r.status,
                    eventCount: items.length, // ?_format=json ger sällan total
                    sampleTitles,
                });
                return results;
            }
        }
    }

    return results;
}

async function probeKommun(k: Kommun): Promise<ProbeResult[]> {
    const all: ProbeResult[] = [];
    for (const host of hostsFor(k)) {
        const hits = await probeHost(k.name, host);
        all.push(...hits);
        if (hits.some(h => (h.eventCount ?? 0) > 0)) break;
    }
    return all;
}

async function runWithConcurrency<T, R>(items: T[], n: number, fn: (i: T) => Promise<R>): Promise<R[]> {
    const queue = items.slice();
    const out: R[] = [];
    const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
        while (queue.length > 0) {
            const item = queue.shift();
            if (item === undefined) break;
            out.push(await fn(item));
        }
    });
    await Promise.all(workers);
    return out;
}

function parseArgs(): { concurrency: number; filter?: string } {
    const out: any = { concurrency: 12 };
    for (const a of process.argv.slice(2)) {
        const m = a.match(/^--([^=]+)=(.+)$/);
        if (!m) continue;
        if (m[1] === 'concurrency') out.concurrency = parseInt(m[2], 10);
        else if (m[1] === 'filter') out.filter = m[2];
    }
    return out;
}

function slugify(name: string): string {
    return name.toLowerCase()
        .replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function emitSourceConfig(hits: ProbeResult[]): void {
    if (hits.length === 0) return;
    console.log('\n\n=== GENERERAD SOURCE-CONFIG (kopiera in i registry.ts, kräver drupal-engine) ===\n');
    for (const h of hits) {
        console.log(`    {`);
        console.log(`        id: '${slugify(h.kommun)}',`);
        console.log(`        hostName: '${h.kommun} Kommun',`);
        console.log(`        region: '${slugify(h.kommun)}',`);
        console.log(`        engine: 'drupal',`);
        console.log(`        config: {`);
        console.log(`            baseUrl: '${h.host}',`);
        console.log(`            variant: '${h.method}',`);
        console.log(`            endpoint: '${h.endpoint}',`);
        console.log(`            defaultCity: '${h.kommun}',`);
        console.log(`        },`);
        console.log(`        updateFrequency: 'every-3d',`);
        console.log(`        notes: 'Probe-drupal ${new Date().toISOString().slice(0, 10)}: ${h.eventCount} events.',`);
        console.log(`    },`);
    }
}

async function main() {
    const { concurrency, filter } = parseArgs();
    const kommuner = filter
        ? KOMMUNER.filter((k) => k.name.toLowerCase().includes(filter.toLowerCase()))
        : KOMMUNER;

    console.log(`Probar ${kommuner.length} kommuner för Drupal (JSON:API + ?_format=json), concurrency=${concurrency}…\n`);
    const startedAt = Date.now();

    let done = 0;
    const allResults = await runWithConcurrency(kommuner, concurrency, async (k) => {
        const results = await probeKommun(k);
        done++;
        const win = results.find((r) => r.httpStatus === 200 && (r.eventCount ?? 0) > 0);
        if (win) {
            const sample = win.sampleTitles[0] ? ` — "${win.sampleTitles[0]}"` : '';
            console.log(`✅ [${String(done).padStart(2)}/${kommuner.length}] ${k.name.padEnd(20)} ${win.method.padEnd(12)} ${String(win.eventCount).padStart(4)} events  ${win.host}${win.endpoint}${sample}`);
        } else {
            console.log(`○  [${String(done).padStart(2)}/${kommuner.length}] ${k.name.padEnd(20)} (no Drupal)`);
        }
        return results;
    });

    const flat = allResults.flat();
    const hits = flat.filter((r) => r.httpStatus === 200 && (r.eventCount ?? 0) > 0);
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

    console.log(`\n=== SAMMANFATTNING (${elapsed}s) ===`);
    console.log(`Probat: ${kommuner.length} kommuner`);
    console.log(`Hittade Drupal event-endpoint: ${hits.length}`);
    if (hits.length > 0) {
        const totalEvents = hits.reduce((s, h) => s + (h.eventCount || 0), 0);
        console.log(`Totalt events bakom dessa: ~${totalEvents}`);
        const byMethod = hits.reduce<Record<string, number>>((acc, h) => {
            acc[h.method] = (acc[h.method] || 0) + 1;
            return acc;
        }, {});
        console.log(`Per metod: ${Object.entries(byMethod).map(([k, v]) => `${k}=${v}`).join(', ')}`);
        emitSourceConfig(hits);
    } else {
        console.log('Inga Drupal-träffar. Pröva nästa probetyp (sitemap-mining, generic JSON-LD).');
    }
    process.exit(0);
}

main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
});
