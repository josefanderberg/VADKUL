/**
 * bulk-probe.ts — Massprobning av kandidat-sajter för strukturerad event-data.
 *
 * Per kandidat testas i prioritetsordning:
 *   1. WP "The Events Calendar" REST  →  /wp-json/tribe/events/v1/events
 *   2. WP custom post type            →  /wp-json/wp/v2/event  (variant wp-v2)
 *   3. Sitemap                        →  /sitemap.xml, /wp-sitemap.xml, robots
 *        → leta event-sub-sitemap eller event-mönster-URLs, räkna,
 *          och kolla första detaljsidan för JSON-LD @type=Event + startDate.
 *
 * Verdict PASS om någon ger ≥ MIN_EVENTS strukturerade (framtida) events utan
 * bot-skydd. Dubletter mot befintliga registry-domäner flaggas (SKIP-dupe).
 *
 * Körning:
 *   npm run bulk-probe -- candidates.txt        # rad: name|region|baseUrl  (| valfritt)
 *   npm run bulk-probe -- candidates.txt --json suggestions.json
 *   (utan fil → inbyggd testlista)
 *
 * Ingen DB-skrivning, inga registry-ändringar — ren rekognosering.
 */

import fs from 'fs';
import path from 'path';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MIN_EVENTS = parseInt(process.env.BULK_MIN_EVENTS || '5', 10);
const CONCURRENCY = parseInt(process.env.BULK_CONCURRENCY || '24', 10);
const TIMEOUT_MS = 12_000;

interface Candidate { name: string; region: string; base: string; }
interface ProbeResult {
    cand: Candidate;
    verdict: 'PASS' | 'FAIL' | 'DUPE';
    engine?: 'wp-rest' | 'sitemap';
    method?: string;       // tribe | wp-v2 | sitemap-json-ld | sitemap-text
    count?: number;        // framtida/strukturerade events upptäckta
    detail?: string;       // bästa URL / sub-sitemap
    config?: Record<string, any>;
}

const today = () => new Date().toISOString().slice(0, 10);

async function fetchText(url: string): Promise<{ ok: boolean; status: number; body: string; ct: string }> {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
        const ct = res.headers.get('content-type') || '';
        const body = res.ok ? await res.text() : '';
        return { ok: res.ok, status: res.status, body, ct };
    } catch {
        return { ok: false, status: 0, body: '', ct: '' };
    }
}

function safeJson(s: string): any { try { return JSON.parse(s); } catch { return null; } }

// ── 1. Tribe (The Events Calendar) ───────────────────────────────────────────
async function probeTribe(base: string): Promise<{ count: number; sample: string } | null> {
    const url = `${base}/wp-json/tribe/events/v1/events?per_page=10&start_date=${today()}`;
    const r = await fetchText(url);
    if (!r.ok || !/json/i.test(r.ct)) return null;
    const j = safeJson(r.body);
    const events = j?.events;
    if (!Array.isArray(events) || events.length === 0) return null;
    const future = events.filter((e: any) => e?.start_date && e.start_date >= today());
    const total = typeof j?.total === 'number' ? j.total : future.length;
    if (total < MIN_EVENTS) return null;
    return { count: total, sample: events[0]?.title || events[0]?.url || '' };
}

// ── 2. WP custom post type /wp/v2/event ──────────────────────────────────────
async function probeWpV2(base: string): Promise<{ count: number; sample: string; postType: string } | null> {
    for (const pt of ['event', 'evenemang', 'events', 'tribe_events']) {
        const url = `${base}/wp-json/wp/v2/${pt}?per_page=20&_fields=id,link,title,date`;
        const r = await fetchText(url);
        if (!r.ok || !/json/i.test(r.ct)) continue;
        const j = safeJson(r.body);
        if (!Array.isArray(j) || j.length < MIN_EVENTS) continue;
        return { count: j.length, sample: `${pt}: ${j[0]?.link || j[0]?.title?.rendered || ''}`, postType: pt };
    }
    return null;
}

// ── 3. Sitemap ───────────────────────────────────────────────────────────────
const EVENT_PAT = /(evenemang|\/events?\/|kalend|forestall|konsert|\/program\/|\/aktuellt\/kalendarium|\/whats-on\/)/i;
const SUBMAP_PAT = /(event|evenemang|kalend|tribe)/i;

async function probeSitemap(base: string): Promise<{ method: string; count: number; detail: string; pattern: string } | null> {
    // hitta sitemap-URL
    const robots = (await fetchText(`${base}/robots.txt`)).body;
    const fromRobots = robots.match(/sitemap:\s*(\S+)/i)?.[1];
    const candidates = [fromRobots, `${base}/sitemap.xml`, `${base}/wp-sitemap.xml`, `${base}/sitemap_index.xml`].filter(Boolean) as string[];

    for (const smUrl of candidates) {
        const r = await fetchText(smUrl);
        if (!r.ok || !/xml/i.test(r.ct + r.body.slice(0, 100))) continue;
        let body = r.body;
        let usedMap = smUrl;

        // sitemap-index → expandera event-relaterad sub-sitemap
        if (/<sitemapindex/i.test(body)) {
            const subs = Array.from(body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)).map((m) => m[1]);
            const evSub = subs.find((s) => SUBMAP_PAT.test(s)) || subs[0];
            if (!evSub) continue;
            const sr = await fetchText(evSub);
            if (!sr.ok) continue;
            body = sr.body;
            usedMap = evSub;
        }

        const locs = Array.from(body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)).map((m) => m[1]);
        const eventLocs = locs.filter((u) => EVENT_PAT.test(u) && !/\/(evenemang|events?|kalender|kalendarium|program)\/?$/i.test(u));
        if (eventLocs.length < MIN_EVENTS) continue;

        // härleda urlPattern ur exempel-URL
        const segMatch = eventLocs[0].match(/\/(evenemang|events?|kalender|kalendarium|forestallningar|konserter|program)\//i);
        const seg = segMatch ? segMatch[1] : 'evenemang';
        const pattern = `/\\/${seg}\\/[a-z0-9][a-z0-9-]{2,}/i`;

        // verifiera datum på upp till 3 detaljsidor: JSON-LD Event / "DD månad YYYY" / ISO datetime-attr
        let method = '';
        for (const u of eventLocs.slice(0, 3)) {
            const d = await fetchText(u);
            if (!d.ok) continue;
            const jsonLd = /"@type"\s*:\s*"Event"/i.test(d.body) && /"startDate"\s*:\s*"/i.test(d.body);
            const textDate = /\b\d{1,2}\s+(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)\s+20\d{2}\b/i.test(d.body);
            const isoAttr = /datetime="20\d{2}-\d{2}-\d{2}/i.test(d.body);
            if (jsonLd) { method = 'sitemap-json-ld'; break; }
            if (textDate || isoAttr) { method = 'sitemap-text'; break; }
        }
        if (!method) continue;

        return { method, count: eventLocs.length, detail: usedMap, pattern };
    }
    return null;
}

async function probeCandidate(cand: Candidate, existingDomains: Set<string>): Promise<ProbeResult> {
    const base = cand.base.replace(/\/$/, '');
    const domain = base.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
    if (existingDomains.has(domain)) return { cand, verdict: 'DUPE' };

    // 1. Tribe
    const tribe = await probeTribe(base);
    if (tribe) return {
        cand, verdict: 'PASS', engine: 'wp-rest', method: 'tribe', count: tribe.count, detail: tribe.sample,
        config: { baseUrl: base, variant: 'tribe', defaultCity: cand.name, fetchDetailPage: false, maxPages: 4 },
    };

    // 2. wp-v2
    const wpv2 = await probeWpV2(base);
    if (wpv2) return {
        cand, verdict: 'PASS', engine: 'wp-rest', method: 'wp-v2', count: wpv2.count, detail: wpv2.sample,
        config: {
            baseUrl: base, variant: 'wp-v2', defaultCity: cand.name, fetchDetailPage: true, maxPages: 5,
            ...(wpv2.postType !== 'event' ? { endpoint: `/wp-json/wp/v2/${wpv2.postType}` } : {}),
        },
    };

    // 3. Sitemap
    const sm = await probeSitemap(base);
    if (sm) return {
        cand, verdict: 'PASS', engine: 'sitemap', method: sm.method, count: sm.count, detail: sm.detail,
        config: { sitemapUrl: sm.detail, urlPatterns: [sm.pattern], defaultCity: cand.name, maxUrls: 200 },
    };

    return { cand, verdict: 'FAIL' };
}

async function mapPool<T, R>(items: T[], limit: number, fn: (it: T, i: number) => Promise<R>): Promise<R[]> {
    const out: R[] = new Array(items.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (true) {
            const i = next++;
            if (i >= items.length) break;
            out[i] = await fn(items[i], i);
        }
    }));
    return out;
}

function loadExistingDomains(): Set<string> {
    const reg = fs.readFileSync(path.resolve(__dirname, '../sources/registry.ts'), 'utf8');
    const domains = new Set<string>();
    for (const m of reg.matchAll(/https?:\/\/(?:www\.)?([a-z0-9.-]+)/gi)) domains.add(m[1].split('/')[0].toLowerCase());
    return domains;
}

function parseCandidates(file: string): Candidate[] {
    const lines = fs.readFileSync(file, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    return lines.map((l) => {
        const parts = l.split('|').map((p) => p.trim());
        if (parts.length >= 3) return { name: parts[0], region: parts[1], base: parts[2] };
        const base = parts[parts.length - 1];
        const name = base.replace(/^https?:\/\/(www\.)?/, '').split('.')[0];
        return { name, region: name, base };
    });
}

async function main() {
    const args = process.argv.slice(2);
    const file = args.find((a) => !a.startsWith('--'));
    const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;

    const candidates: Candidate[] = file ? parseCandidates(file) : [
        { name: 'Uppsala', region: 'uppsala', base: 'https://www.destinationuppsala.se' },
        { name: 'Östersund', region: 'ostersund', base: 'https://visitostersund.se' },
        { name: 'Karlstad', region: 'karlstad', base: 'https://visitkarlstad.se' },
    ];

    const existing = loadExistingDomains();
    console.log(`bulk-probe: ${candidates.length} kandidater, ${existing.size} befintliga domäner, MIN_EVENTS=${MIN_EVENTS}, concurrency=${CONCURRENCY}\n`);

    let done = 0;
    const results = await mapPool(candidates, CONCURRENCY, async (c) => {
        const r = await probeCandidate(c, existing);
        done++;
        if (r.verdict === 'PASS') console.log(`  [${String(done).padStart(4)}/${candidates.length}] ✅ ${r.cand.name.padEnd(22)} ${r.engine}/${r.method} (${r.count}) ${r.detail?.slice(0, 50) || ''}`);
        else if (done % 25 === 0) console.log(`  [${String(done).padStart(4)}/${candidates.length}] …`);
        return r;
    });

    const pass = results.filter((r) => r.verdict === 'PASS');
    const dupe = results.filter((r) => r.verdict === 'DUPE');
    console.log(`\n══════ RESULTAT ══════`);
    console.log(`  PASS: ${pass.length}  |  DUPE: ${dupe.length}  |  FAIL: ${results.length - pass.length - dupe.length}`);
    const byEngine: Record<string, number> = {};
    pass.forEach((r) => { byEngine[`${r.engine}/${r.method}`] = (byEngine[`${r.engine}/${r.method}`] || 0) + 1; });
    console.log('  Per metod:', JSON.stringify(byEngine));

    // skriv ut förslag på registry-rader (kommenterade)
    if (jsonOut) {
        fs.writeFileSync(jsonOut, JSON.stringify(pass.map((r) => ({
            id: r.cand.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            hostName: r.cand.name,
            region: r.cand.region,
            engine: r.engine,
            config: r.config,
            count: r.count,
            method: r.method,
        })), null, 2));
        console.log(`\n  → ${pass.length} förslag skrivna till ${jsonOut}`);
    }
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
