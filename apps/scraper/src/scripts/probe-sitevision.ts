/**
 * SiteVision probe — testa alla 290 kommuner mot vanliga kalender-URL-mönster.
 *
 * Strategi:
 *   1. För varje kommun: prova en lista vanliga kalender-paths
 *   2. Kontrollera HTTP 200 + SiteVision-markörer + `<time datetime>`-element
 *   3. Räkna funna events
 *   4. Auto-generera Source-config
 *
 * Användning:
 *   npm run probe-sitevision
 *   npm run probe-sitevision -- --concurrency=20
 */

import { KOMMUNER, Kommun } from '../sources/data/kommuner';
import * as cheerio from 'cheerio';

const CALENDAR_PATHS = [
    '/evenemangskalender',
    '/uppleva-och-gora/evenemangskalender',
    '/uppleva-och-gora/evenemang',
    '/uppleva-och-gora/kalender',
    '/se-och-gora/evenemangskalender',
    '/se-och-gora/evenemang',
    '/kalender',
    '/evenemang',
    '/aktuellt/evenemangskalender',
    '/aktuellt/kalender',
];

const UA = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/124.0.0.0';
const TIMEOUT = 8000;

interface Hit {
    kommun: string;
    url: string;
    eventCount: number;
    sample: string;
}

async function probeUrl(url: string): Promise<{ ok: boolean; html?: string; status: number }> {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), TIMEOUT);
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'sv-SE,sv' },
            redirect: 'follow', signal: ac.signal,
        });
        if (!res.ok) return { ok: false, status: res.status };
        return { ok: true, html: await res.text(), status: res.status };
    } catch { return { ok: false, status: 0 }; }
    finally { clearTimeout(t); }
}

function countSiteVisionEvents(html: string): { count: number; sample: string } {
    // SiteVision-kalender har typiskt `<time datetime>`-element + sv-* attribut
    const hasSv = /sv-(?:layout|template|portlet|soleil)/.test(html);
    if (!hasSv) return { count: 0, sample: '' };

    const $ = cheerio.load(html);
    const timeEls = $('time[datetime]').toArray();
    if (timeEls.length === 0) return { count: 0, sample: '' };

    // Räkna events som ENBART de som har närliggande h2/h3/h4
    let count = 0;
    let sample = '';
    for (const t of timeEls) {
        const container = $(t).closest('article, li').first();
        const headline = container.find('h1, h2, h3, h4').first().text().trim();
        if (headline) {
            count++;
            if (!sample) sample = headline;
        }
    }
    return { count, sample };
}

async function probeKommun(k: Kommun): Promise<Hit | null> {
    const hosts = [`https://www.${k.domain}`, `https://${k.domain}`];
    for (const host of hosts) {
        for (const p of CALENDAR_PATHS) {
            const url = host + p;
            const { ok, html } = await probeUrl(url);
            if (!ok || !html) continue;
            const { count, sample } = countSiteVisionEvents(html);
            if (count >= 3) {  // minst 3 events → bedöms som riktig kalender
                return { kommun: k.name, url, eventCount: count, sample };
            }
        }
    }
    return null;
}

async function runConc<T, R>(items: T[], n: number, fn: (i: T) => Promise<R>): Promise<R[]> {
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

function slugify(s: string): string {
    return s.toLowerCase().replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function main() {
    const concurrency = parseInt(process.argv.find((a) => a.startsWith('--concurrency='))?.slice(14) || '12', 10);
    const filter = process.argv.find((a) => a.startsWith('--filter='))?.slice(9);
    const kommuner = filter ? KOMMUNER.filter((k) => k.name.toLowerCase().includes(filter.toLowerCase())) : KOMMUNER;

    console.log(`Probar ${kommuner.length} kommuner mot ${CALENDAR_PATHS.length} kalender-paths (concurrency=${concurrency})\n`);
    const started = Date.now();
    let done = 0;

    const hits: Hit[] = [];
    await runConc(kommuner, concurrency, async (k) => {
        const hit = await probeKommun(k);
        done++;
        if (hit) {
            hits.push(hit);
            console.log(`✅ [${String(done).padStart(3)}/${kommuner.length}] ${k.name.padEnd(18)} ${String(hit.eventCount).padStart(4)} events  ${hit.url}  — "${hit.sample.slice(0, 40)}"`);
        } else {
            console.log(`○  [${String(done).padStart(3)}/${kommuner.length}] ${k.name}`);
        }
    });

    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`\n=== SAMMANFATTNING (${elapsed}s) ===`);
    console.log(`Probat: ${kommuner.length}, träffar: ${hits.length}`);
    if (hits.length > 0) {
        console.log(`Totalt events: ~${hits.reduce((s, h) => s + h.eventCount, 0)}\n`);
        console.log('=== Source-config att kopiera in ===\n');
        for (const h of hits) {
            console.log(`    {`);
            console.log(`        id: '${slugify(h.kommun)}',`);
            console.log(`        hostName: '${h.kommun} Kommun',`);
            console.log(`        region: '${slugify(h.kommun)}',`);
            console.log(`        engine: 'sitevision',`);
            console.log(`        config: {`);
            console.log(`            urls: ['${h.url}'],`);
            console.log(`            defaultCity: '${h.kommun}',`);
            console.log(`        },`);
            console.log(`        updateFrequency: 'every-3d',`);
            console.log(`        notes: 'SiteVision probe ${new Date().toISOString().slice(0, 10)}: ${h.eventCount} events.',`);
            console.log(`    },`);
        }
    }
    process.exit(0);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
