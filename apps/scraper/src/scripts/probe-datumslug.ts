/**
 * probe-datumslug.ts — hittar källor som läser FEL SIDA.
 *
 * Buggen (funnen 2026-09-07/08 på Ljungby, Enköping, Växjö, Vetlanda, Nässjö,
 * Eksjö, Kalmar): kommunernas event ligger inte på `/evenemang/<slug>` utan
 * djupt i arkivet med DATUM-PREFIXAD slug — `…/evenemang/ÅÅÅÅ-MM-DD-slug`,
 * ibland med `.html`, ofta på en underwebb. Källans gamla urlPattern matchar då
 * kommunens INFO-sidor om evenemang i stället för eventen, och källan ser
 * 0-6 event där det finns 50-200.
 *
 * Skriptet hämtar varje källas sitemap och jämför hur många URL:er som matchar
 * a) källans EGNA mönster mot b) datum-slug-formen. Är b >> a läser vi fel sida.
 *
 *   npm run probe-datumslug            # alla sitemap-/sitevision-källor
 *   npm run probe-datumslug -- --json
 *
 * Ren rekognosering: ingen DB, inga registry-ändringar.
 */

import * as zlib from 'zlib';
import { SOURCES } from '../sources/registry';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
    + '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/** Formen vi letar efter — samma som de fem lagade källorna fick. */
const DATE_SLUG = /\/evenemang[^/]*\/\d{4}-\d{2}-\d{2}-[^/]+(?:\.html)?$/i;

interface Row {
    id: string; host: string; sitemap: string; mode: string;
    own: number; dateSlug: number; future: number; total: number; sample?: string;
}

/** Datumet ligger i URL:en — så framtida event kan räknas utan en enda hämtning. */
function urlDate(u: string): Date | null {
    const m = u.match(/\/(\d{4})-(\d{2})-(\d{2})-/);
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Hur källan faktiskt extraherar. API-lägena (itemsApi/restApi/…) läser inte
 * URL-mönster alls — deras `own: 0` är inget fel, och de ska INTE flaggas.
 */
function extractionMode(cfg: any): string {
    if (cfg.itemsApi) return 'itemsApi';
    if (cfg.restApi) return 'restApi';
    if (cfg.eventSearchApi) return 'eventSearchApi';
    if (cfg.guideApi) return 'guideApi';
    if (cfg.searchAppApi) return 'searchAppApi';
    if (cfg.pageApi) return 'pageApi';
    if (cfg.eventServiceApi) return 'eventServiceApi';
    if (cfg.urlPatterns) return 'urlPatterns';
    return 'html';
}

async function fetchMaybeGz(url: string): Promise<string> {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return '';
    const buf = Buffer.from(await res.arrayBuffer());
    if (url.endsWith('.gz') || (buf[0] === 0x1f && buf[1] === 0x8b)) {
        try { return zlib.gunzipSync(buf).toString('utf8'); } catch { return ''; }
    }
    return buf.toString('utf8');
}

const locs = (xml: string) => [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map(m => m[1]);

/** Hämtar sitemapen och expanderar EN nivå av sitemap-index. */
async function collectUrls(sitemapUrl: string): Promise<string[]> {
    const root = await fetchMaybeGz(sitemapUrl);
    if (!root) return [];
    if (!/<sitemapindex/i.test(root)) return locs(root);
    const subs = locs(root).slice(0, 12);
    const out: string[] = [];
    for (const sub of subs) {
        const child = await fetchMaybeGz(sub);
        if (child && !/<sitemapindex/i.test(child)) out.push(...locs(child));
    }
    return out;
}

/** Källans sitemap — sitemap-motorn har den; sitevision-källor får origin/sitemap.xml. */
function sitemapFor(s: any): string | null {
    const cfg = s.config || {};
    if (typeof cfg.sitemapUrl === 'string') {
        // isHtmlCatalog = listsida, inte sitemap — hoppa.
        if (cfg.isHtmlCatalog) return null;
        return cfg.sitemapUrl;
    }
    const first = Array.isArray(cfg.urls) ? cfg.urls[0] : null;
    if (typeof first === 'string') {
        try { return `${new URL(first).origin}/sitemap.xml`; } catch { return null; }
    }
    return null;
}

async function main() {
    const asJson = process.argv.includes('--json');
    const cands = SOURCES.filter(s => !s.disabled && (s.engine === 'sitemap' || s.engine === 'sitevision'));
    const rows: Row[] = [];
    const CONC = 6;
    let idx = 0;

    async function worker() {
        while (idx < cands.length) {
            const s: any = cands[idx++];
            const sm = sitemapFor(s);
            if (!sm) continue;
            let urls: string[] = [];
            try { urls = await collectUrls(sm); } catch { continue; }
            if (!urls.length) continue;

            const own = Array.isArray(s.config?.urlPatterns)
                ? urls.filter(u => s.config.urlPatterns.some((re: RegExp) => re.test(u))).length
                : 0;
            const ds = urls.filter(u => DATE_SLUG.test(u));
            if (ds.length === 0) continue;
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const future = ds.filter(u => { const d = urlDate(u); return d !== null && d >= today; });
            rows.push({
                id: s.id, host: s.hostName, sitemap: sm, mode: extractionMode(s.config || {}),
                own, dateSlug: ds.length, future: future.length, total: urls.length,
                sample: future[0] ?? ds[0],
            });
            if (!asJson) process.stderr.write(`  ${rows.length} träffar / ${idx} probade\r`);
        }
    }
    await Promise.all(Array.from({ length: CONC }, worker));

    // Misstänkta = datum-slug-formen ger MYCKET mer än källans eget mönster.
    // Bara KOMMANDE event räknas — arkiven är fulla av gamla. Och API-lägena
    // flaggas aldrig: de läser inte urlPatterns, så deras own=0 betyder inget.
    const API_MODE = /Api$/;
    const suspects = rows.filter(r => !API_MODE.test(r.mode) && r.future >= 10 && r.future > r.own * 3)
        .sort((a, b) => b.future - a.future);

    if (asJson) { console.log(JSON.stringify({ probed: cands.length, rows, suspects }, null, 2)); return; }
    console.log(`\n\nProbade ${cands.length} sitemap-/sitevision-källor. ${rows.length} har datum-slug-URL:er.\n`);
    console.log('LÄSER SANNOLIKT FEL SIDA (datum-slug ≫ källans eget mönster):\n');
    console.log('id                        läge     eget  KOMMANDE  totalt(arkiv)');
    console.log('─'.repeat(78));
    for (const r of suspects) {
        console.log(
            r.id.padEnd(26), r.mode.padEnd(8), String(r.own).padStart(4),
            String(r.future).padStart(9), String(r.dateSlug).padStart(14),
        );
        console.log(`      ${r.sample?.slice(0, 100)}`);
    }
    console.log(`\n${suspects.length} misstänkta.`);
}

main();
