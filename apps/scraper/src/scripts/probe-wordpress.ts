/**
 * WordPress REST probe — leta efter event-endpoints på ~50 kommunsajter.
 *
 * För varje (kommun × host-variant × endpoint), gör en HEAD/GET och kolla:
 *   - HTTP 200?
 *   - JSON med events i sig?
 *   - Hur många events ligger där?
 *
 * Output:
 *   1. Live-tabell på stdout
 *   2. Sammanfattning: hur många sajter hade WP-REST som funkade
 *   3. Genererad Source-config för aktiva endpoints — kan klistras in i registry.ts
 *
 * Användning:
 *   npm run probe-wp
 *   npm run probe-wp -- --concurrency=20    # default 12
 *   npm run probe-wp -- --filter=stockholm  # bara sajter som matchar
 *
 * Endpoint-mönster vi testar (i prioritetsordning):
 *   1. /wp-json/tribe/events/v1/events      ← The Events Calendar (guldstandard)
 *   2. /wp-json/wp/v2/event                  ← generisk custom post type
 *   3. /wp-json/wp/v2/tribe_events           ← Tribe via wp/v2
 *   4. /wp-json/wp/v2/evenemang              ← svensk CPT
 */

import { KOMMUNER, Kommun } from '../sources/data/kommuner';

interface ProbeResult {
    kommun: string;
    host: string;            // full URL utan endpoint
    endpoint: string;
    httpStatus: number;
    eventCount?: number;     // hur många events i svaret (om JSON parsade)
    variant: 'tribe' | 'wp-v2';
    sampleTitles: string[];
    error?: string;
}

const ENDPOINTS: { path: string; variant: 'tribe' | 'wp-v2' }[] = [
    // Tribe Events Calendar — guldstandarden, har riktiga start_date
    { path: '/wp-json/tribe/events/v1/events?per_page=5',     variant: 'tribe' },
    // WordPress custom post types — vanligaste namnen
    { path: '/wp-json/wp/v2/event?per_page=5',                variant: 'wp-v2' },
    { path: '/wp-json/wp/v2/tribe_events?per_page=5',         variant: 'wp-v2' },
    { path: '/wp-json/wp/v2/evenemang?per_page=5',            variant: 'wp-v2' },
    { path: '/wp-json/wp/v2/events?per_page=5',               variant: 'wp-v2' },
    { path: '/wp-json/wp/v2/kalender?per_page=5',             variant: 'wp-v2' },
    // Modern Events Calendar (MEC) — utbredd WP-plugin
    { path: '/wp-json/wp/v2/mec-events?per_page=5',           variant: 'wp-v2' },
    // Eventin — annan WP-plugin
    { path: '/wp-json/wp/v2/eventin?per_page=5',              variant: 'wp-v2' },
    // EventOn — yet another plugin
    { path: '/wp-json/wp/v2/ajde_events?per_page=5',          variant: 'wp-v2' },
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

async function probe(host: string, endpoint: { path: string; variant: 'tribe' | 'wp-v2' }): Promise<Partial<ProbeResult>> {
    const url = `${host}${endpoint.path}`;
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': UA, 'Accept': 'application/json' },
            signal: ac.signal,
            redirect: 'follow',
        });
        if (!res.ok) {
            return { httpStatus: res.status, variant: endpoint.variant, endpoint: endpoint.path };
        }
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('json')) {
            // Sajten gav 200 på okänd path — antagligen en HTML-fallback
            return { httpStatus: res.status, variant: endpoint.variant, endpoint: endpoint.path, error: 'non-json' };
        }
        const data: any = await res.json();
        let eventCount = 0;
        let sampleTitles: string[] = [];
        if (endpoint.variant === 'tribe') {
            const events = Array.isArray(data?.events) ? data.events : [];
            eventCount = data?.total ?? events.length;
            sampleTitles = events.slice(0, 3).map((e: any) => String(e?.title || '').trim()).filter(Boolean);
        } else {
            const arr = Array.isArray(data) ? data : [];
            eventCount = arr.length; // wp-v2 ger ingen total i body, bara X-WP-Total-header
            const headerTotal = parseInt(res.headers.get('x-wp-total') || '0', 10);
            if (headerTotal > 0) eventCount = headerTotal;
            sampleTitles = arr.slice(0, 3)
                .map((e: any) => String(e?.title?.rendered || e?.title || '').trim())
                .filter(Boolean);
        }
        return {
            httpStatus: res.status,
            variant: endpoint.variant,
            endpoint: endpoint.path,
            eventCount,
            sampleTitles,
        };
    } catch (e) {
        return {
            httpStatus: 0,
            variant: endpoint.variant,
            endpoint: endpoint.path,
            error: (e as Error).name === 'AbortError' ? 'timeout' : (e as Error).message,
        };
    } finally {
        clearTimeout(timeout);
    }
}

async function probeKommun(k: Kommun): Promise<ProbeResult[]> {
    const results: ProbeResult[] = [];
    for (const host of hostsFor(k)) {
        // Sluta så fort vi hittat en host som funkar — slipper hamra tomma värdar
        let foundHere = false;
        for (const ep of ENDPOINTS) {
            const r = await probe(host, ep);
            const result: ProbeResult = {
                kommun: k.name,
                host,
                endpoint: r.endpoint || ep.path,
                httpStatus: r.httpStatus || 0,
                eventCount: r.eventCount,
                variant: ep.variant,
                sampleTitles: r.sampleTitles || [],
                error: r.error,
            };
            results.push(result);
            if (result.httpStatus === 200 && typeof result.eventCount === 'number' && result.eventCount >= 0 && !result.error) {
                foundHere = true;
            }
            // Skippa övriga endpoints på denna host om vi redan fått 200 + data
            if (foundHere) break;
        }
        if (foundHere) break; // slipper testa fler host-varianter
    }
    return results;
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
    console.log('\n\n=== GENERERAD SOURCE-CONFIG (kopiera in i registry.ts) ===\n');
    for (const h of hits) {
        const baseUrl = h.host;
        console.log(`    {`);
        console.log(`        id: '${slugify(h.kommun)}',`);
        console.log(`        hostName: '${h.kommun}',`);
        console.log(`        region: '${slugify(h.kommun)}',`);
        console.log(`        engine: 'wp-rest',`);
        console.log(`        config: {`);
        console.log(`            baseUrl: '${baseUrl}',`);
        console.log(`            variant: '${h.variant}',`);
        if (h.endpoint !== '/wp-json/tribe/events/v1/events?per_page=5' &&
            h.endpoint !== '/wp-json/wp/v2/event?per_page=5') {
            // Strip query string för Source-config — vi pagginerar i motorn
            const ep = h.endpoint.split('?')[0];
            console.log(`            endpoint: '${ep}',`);
        }
        console.log(`        },`);
        console.log(`        notes: 'Auto-genererad ${new Date().toISOString().slice(0, 10)}: ${h.eventCount} events vid probe.',`);
        console.log(`    },`);
    }
}

async function main() {
    const { concurrency, filter } = parseArgs();
    const kommuner = filter
        ? KOMMUNER.filter((k) => k.name.toLowerCase().includes(filter.toLowerCase()))
        : KOMMUNER;

    console.log(`Probar ${kommuner.length} kommuner mot ${ENDPOINTS.length} endpoints (concurrency=${concurrency})...\n`);
    const startedAt = Date.now();

    let done = 0;
    const allResults = await runWithConcurrency(kommuner, concurrency, async (k) => {
        const results = await probeKommun(k);
        done++;
        const win = results.find((r) => r.httpStatus === 200 && typeof r.eventCount === 'number' && !r.error);
        if (win) {
            const sample = win.sampleTitles[0] ? ` — "${win.sampleTitles[0]}"` : '';
            console.log(`✅ [${String(done).padStart(2)}/${kommuner.length}] ${k.name.padEnd(20)} ${win.variant.padEnd(6)} ${String(win.eventCount).padStart(4)} events  ${win.host}${sample}`);
        } else {
            console.log(`○  [${String(done).padStart(2)}/${kommuner.length}] ${k.name.padEnd(20)} (no WP-REST)`);
        }
        return results;
    });

    const flat = allResults.flat();
    const hits = flat.filter((r) => r.httpStatus === 200 && typeof r.eventCount === 'number' && !r.error && (r.eventCount ?? 0) > 0);
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

    console.log(`\n=== SAMMANFATTNING (${elapsed}s) ===`);
    console.log(`Probat: ${kommuner.length} kommuner`);
    console.log(`Hittade WP-REST event-endpoint: ${hits.length}`);
    if (hits.length > 0) {
        const totalEvents = hits.reduce((s, h) => s + (h.eventCount || 0), 0);
        console.log(`Totalt events bakom dessa: ~${totalEvents}`);
        emitSourceConfig(hits);
    } else {
        console.log('Inga träffar. Övervägd nästa steg: prova fler endpoint-mönster eller bygg en discovery via sitemap.xml.');
    }
    process.exit(0);
}

main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
});
