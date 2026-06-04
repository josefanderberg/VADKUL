/**
 * Sitemap-probe — CMS-oberoende discovery via /sitemap.xml.
 *
 * Hypotesen: nästan alla kommunsajter publicerar en sitemap för SEO. Bland
 * URL:erna finns ofta event-detaljsidor i mönster:
 *   - /evenemang/<slug>
 *   - /event/<slug>
 *   - /kalender/<slug>
 *   - /aktivitet/<slug>
 *   - /arrangemang/<slug>
 *   - /upplev/<slug> (turismsajter)
 *
 * För varje kommun:
 *   1. Hitta sitemap-indexet — testa /sitemap.xml, /sitemap_index.xml, /sitemap1.xml
 *   2. Om det är ett sitemap-index, expandera till första några sub-sitemaps
 *   3. Räkna URLs som matchar EVENT_PATTERNS
 *   4. Sampla titlarna (sista path-segmentet) för debug
 *
 * Träff = ≥ 5 URLs som matchar mönster. Färre = troligen falskt positiv
 * (sidor som heter "evenemangskalender" men inte är detaljsidor).
 *
 * Output: live-tabell + sammanfattning + emit av Source-config för sitemap-engine.
 *
 * Användning:
 *   npm run probe-sitemap
 *   npm run probe-sitemap -- --concurrency=20
 *   npm run probe-sitemap -- --filter=ystad
 *   npm run probe-sitemap -- --threshold=10  # default 5
 */

import * as zlib from 'zlib';
import { promisify } from 'util';
import { KOMMUNER, Kommun } from '../sources/data/kommuner';

const gunzip = promisify(zlib.gunzip);

interface ProbeResult {
    kommun: string;
    host: string;
    sitemapUrl: string;
    pattern: string;          // vilket EVENT_PATTERN som vann
    matchCount: number;
    sampleUrls: string[];
    error?: string;
}

const SITEMAP_PATHS = [
    '/sitemap.xml',
    '/sitemap_index.xml',
    '/sitemap1.xml',
    '/sv/sitemap.xml',
    '/wp-sitemap.xml',
];

/**
 * Regex-mönster för event-detaljsidor. Mönstret måste ha minst ett "/" efter
 * nyckelordet för att INTE matcha lista-sidan (/evenemang).
 *
 * Vi rapporterar vilket mönster som vann så det är spårbart.
 */
const EVENT_PATTERNS: { name: string; re: RegExp }[] = [
    { name: 'evenemang', re: /\/(?:sv\/)?evenemang\/[^/]+\/?$/i },
    { name: 'event',     re: /\/(?:sv\/)?event\/[^/]+\/?$/i },
    { name: 'events',    re: /\/(?:sv\/)?events\/[^/]+\/?$/i },
    { name: 'kalender',  re: /\/(?:sv\/)?kalender\/[^/]+\/?$/i },
    { name: 'aktivitet', re: /\/(?:sv\/)?aktivitet(?:er)?\/[^/]+\/?$/i },
    { name: 'arrangemang', re: /\/(?:sv\/)?arrangemang\/[^/]+\/?$/i },
    { name: 'upplev',    re: /\/(?:sv\/)?upplev\/[^/]+\/?$/i },
    { name: 'tribe-events', re: /\/events\/event\/[^/]+\/?$/i },  // The Events Calendar
    { name: 'happening', re: /\/(?:sv\/)?happening\/[^/]+\/?$/i },
];

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const FETCH_TIMEOUT_MS = 12000;
const MAX_SUB_SITEMAPS = 5;   // expandera index till max så här många
const DEFAULT_THRESHOLD = 5;

function hostsFor(k: Kommun): string[] {
    const out = [`https://www.${k.domain}`, `https://${k.domain}`];
    if (k.tourismDomain) {
        out.push(`https://www.${k.tourismDomain}`);
        out.push(`https://${k.tourismDomain}`);
    }
    return out;
}

async function fetchText(url: string): Promise<{ status: number; body: string | null; error?: string }> {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    const isGzUrl = url.toLowerCase().endsWith('.gz');
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': UA, 'Accept': 'application/xml,text/xml,application/gzip,*/*' },
            signal: ac.signal,
            redirect: 'follow',
        });
        if (!res.ok) return { status: res.status, body: null };
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        const ce = (res.headers.get('content-encoding') || '').toLowerCase();
        if (isGzUrl || ce.includes('gzip') || ct.includes('gzip')) {
            const buf = Buffer.from(await res.arrayBuffer());
            if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
                const decoded = await gunzip(buf);
                return { status: res.status, body: decoded.toString('utf8') };
            }
            return { status: res.status, body: buf.toString('utf8') };
        }
        const body = await res.text();
        return { status: res.status, body };
    } catch (e) {
        return { status: 0, body: null, error: (e as Error).name === 'AbortError' ? 'timeout' : (e as Error).message };
    } finally {
        clearTimeout(timeout);
    }
}

function extractLocs(xml: string): string[] {
    const out: string[] = [];
    // Robust nog för både <loc>X</loc> och whitespace, oavsett namespace-prefix
    const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) {
        out.push(m[1].trim());
    }
    return out;
}

function isSitemapIndex(xml: string): boolean {
    // Sitemap-index har <sitemapindex>...</sitemapindex>, vanliga sitemaps har <urlset>
    return /<sitemapindex[\s>]/i.test(xml);
}

/**
 * Hämta alla URL:er som verkar vara event-detaljsidor från sitemap-rotnoden.
 * Följer index-typ en nivå (max MAX_SUB_SITEMAPS sub-sitemaps).
 */
async function collectEventUrls(rootSitemapUrl: string): Promise<{ urls: string[]; rootBody: string | null }> {
    const root = await fetchText(rootSitemapUrl);
    if (!root.body) return { urls: [], rootBody: null };

    if (isSitemapIndex(root.body)) {
        // Plocka sub-sitemap-URL:er, expandera de N första
        const subs = extractLocs(root.body).slice(0, MAX_SUB_SITEMAPS);
        // Prioritera sub-sitemaps med "event"/"evenemang"/"kalender" i URL:en
        subs.sort((a, b) => {
            const score = (u: string) => /(event|evenemang|kalender|aktivitet|arrangemang)/i.test(u) ? 0 : 1;
            return score(a) - score(b);
        });
        const allLocs: string[] = [];
        for (const sub of subs) {
            const child = await fetchText(sub);
            if (child.body && !isSitemapIndex(child.body)) {
                allLocs.push(...extractLocs(child.body));
            }
        }
        return { urls: allLocs, rootBody: root.body };
    }

    return { urls: extractLocs(root.body), rootBody: root.body };
}

async function probeHost(kommun: string, host: string): Promise<ProbeResult | null> {
    for (const path of SITEMAP_PATHS) {
        const sitemapUrl = `${host}${path}`;
        const { urls } = await collectEventUrls(sitemapUrl);
        if (urls.length === 0) continue;

        // Hitta bästa mönster
        let best: ProbeResult | null = null;
        for (const { name, re } of EVENT_PATTERNS) {
            const matches = urls.filter(u => re.test(u));
            if (matches.length === 0) continue;
            if (!best || matches.length > best.matchCount) {
                best = {
                    kommun,
                    host,
                    sitemapUrl,
                    pattern: name,
                    matchCount: matches.length,
                    sampleUrls: matches.slice(0, 3),
                };
            }
        }
        if (best) return best;
    }
    return null;
}

async function probeKommun(k: Kommun, threshold: number): Promise<ProbeResult | null> {
    for (const host of hostsFor(k)) {
        const hit = await probeHost(k.name, host);
        if (hit && hit.matchCount >= threshold) return hit;
    }
    return null;
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

function parseArgs(): { concurrency: number; filter?: string; threshold: number } {
    const out: any = { concurrency: 12, threshold: DEFAULT_THRESHOLD };
    for (const a of process.argv.slice(2)) {
        const m = a.match(/^--([^=]+)=(.+)$/);
        if (!m) continue;
        if (m[1] === 'concurrency') out.concurrency = parseInt(m[2], 10);
        else if (m[1] === 'filter') out.filter = m[2];
        else if (m[1] === 'threshold') out.threshold = parseInt(m[2], 10);
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
    console.log('\n\n=== GENERERAD SOURCE-CONFIG (kopiera in i registry.ts, kräver sitemap-engine) ===\n');
    for (const h of hits) {
        const urlPatternRe = EVENT_PATTERNS.find(p => p.name === h.pattern)!.re;
        console.log(`    {`);
        console.log(`        id: '${slugify(h.kommun)}',`);
        console.log(`        hostName: '${h.kommun} Kommun',`);
        console.log(`        region: '${slugify(h.kommun)}',`);
        console.log(`        engine: 'sitemap',`);
        console.log(`        config: {`);
        console.log(`            sitemapUrl: '${h.sitemapUrl}',`);
        console.log(`            urlPatterns: [${urlPatternRe.toString()}],`);
        console.log(`            defaultCity: '${h.kommun}',`);
        console.log(`        },`);
        console.log(`        updateFrequency: 'every-3d',`);
        console.log(`        notes: 'Probe-sitemap ${new Date().toISOString().slice(0, 10)}: ${h.matchCount} event-URLs (${h.pattern}-mönster).',`);
        console.log(`    },`);
    }
}

async function main() {
    const { concurrency, filter, threshold } = parseArgs();
    const kommuner = filter
        ? KOMMUNER.filter((k) => k.name.toLowerCase().includes(filter.toLowerCase()))
        : KOMMUNER;

    console.log(`Probar ${kommuner.length} kommuner via sitemap.xml (threshold=${threshold}, concurrency=${concurrency})…\n`);
    const startedAt = Date.now();

    let done = 0;
    const allResults: (ProbeResult | null)[] = await runWithConcurrency(kommuner, concurrency, async (k) => {
        const hit = await probeKommun(k, threshold);
        done++;
        if (hit) {
            const sample = hit.sampleUrls[0] ? ` — ${hit.sampleUrls[0]}` : '';
            console.log(`✅ [${String(done).padStart(3)}/${kommuner.length}] ${k.name.padEnd(20)} ${hit.pattern.padEnd(12)} ${String(hit.matchCount).padStart(4)} URLs  ${hit.sitemapUrl}${sample}`);
        } else {
            console.log(`○  [${String(done).padStart(3)}/${kommuner.length}] ${k.name.padEnd(20)} (ingen sitemap-event)`);
        }
        return hit;
    });

    const hits = allResults.filter((r): r is ProbeResult => r !== null);
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

    console.log(`\n=== SAMMANFATTNING (${elapsed}s) ===`);
    console.log(`Probat: ${kommuner.length} kommuner`);
    console.log(`Hittade sitemap-event-URL:er: ${hits.length}`);
    if (hits.length > 0) {
        const totalEvents = hits.reduce((s, h) => s + h.matchCount, 0);
        console.log(`Totalt event-URLs bakom dessa: ~${totalEvents}`);
        const byPattern = hits.reduce<Record<string, number>>((acc, h) => {
            acc[h.pattern] = (acc[h.pattern] || 0) + 1;
            return acc;
        }, {});
        console.log(`Per mönster: ${Object.entries(byPattern).map(([k, v]) => `${k}=${v}`).join(', ')}`);
        emitSourceConfig(hits);
    } else {
        console.log('Inga träffar över tröskel. Sänk --threshold för att se svagare signaler.');
    }
    process.exit(0);
}

main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
});
