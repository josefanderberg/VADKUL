/**
 * iCal probe — leta efter publika .ics-flöden på alla 290 kommuner.
 *
 * Testar vanliga URL-mönster + plockar `<link rel="alternate" type="text/calendar">`
 * från hemsidans HTML (autodiscovery).
 *
 * Användning:
 *   npm run probe-ical
 *   npm run probe-ical -- --concurrency=24
 *   npm run probe-ical -- --filter=stockholm
 *
 * Output: tabell + genererad Source-config för fungerande flöden.
 */

import { KOMMUNER, Kommun } from '../sources/data/kommuner';

interface IcalHit {
    kommun: string;
    host: string;
    icsUrl: string;
    veventCount: number;
    sampleTitles: string[];
    error?: string;
}

const ICS_PATHS = [
    '/kalender.ics',
    '/calendar.ics',
    '/events.ics',
    '/evenemang.ics',
    '/feed.ics',
    '/?ical=1',                                 // Tribe Events Calendar
    '/events/?ical=1',
    '/kalender/?ical=1',
    '/wp-json/tribe/events/v1/events.ics',
];

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const TIMEOUT_MS = 8000;

function hostsFor(k: Kommun): string[] {
    const out = [`https://www.${k.domain}`, `https://${k.domain}`];
    if (k.tourismDomain) {
        out.push(`https://www.${k.tourismDomain}`);
        out.push(`https://${k.tourismDomain}`);
    }
    return out;
}

async function fetchText(url: string, accept: string): Promise<{ text: string | null; ct: string }> {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': UA, Accept: accept },
            redirect: 'follow',
            signal: ac.signal,
        });
        const ct = res.headers.get('content-type') || '';
        if (!res.ok) return { text: null, ct };
        return { text: await res.text(), ct };
    } catch {
        return { text: null, ct: '' };
    } finally {
        clearTimeout(timeout);
    }
}

/** Validera att en respons faktiskt är iCal (inte HTML 404-sida). */
function looksLikeIcs(text: string, ct: string): boolean {
    if (/text\/calendar/i.test(ct)) return true;
    return text.includes('BEGIN:VCALENDAR') && text.includes('BEGIN:VEVENT');
}

/** Räkna VEVENTs + plocka första par titlar. */
function parseIcsSummary(ics: string): { count: number; titles: string[] } {
    const events = ics.split('BEGIN:VEVENT').slice(1);
    const titles: string[] = [];
    for (const ev of events.slice(0, 3)) {
        const m = ev.match(/^SUMMARY[^:]*:(.+?)$/m);
        if (m) titles.push(m[1].trim());
    }
    return { count: events.length, titles };
}

/** Leta efter `<link rel="alternate" type="text/calendar" href="...">` på hemsidan. */
function findCalendarLinkInHtml(html: string, baseUrl: string): string | null {
    // Acceptera båda attribut-ordningar
    const patterns = [
        /<link[^>]+rel=["']alternate["'][^>]+type=["']text\/calendar["'][^>]+href=["']([^"']+)["']/i,
        /<link[^>]+type=["']text\/calendar["'][^>]+href=["']([^"']+)["']/i,
        /<link[^>]+href=["']([^"']+)["'][^>]+type=["']text\/calendar["']/i,
    ];
    for (const p of patterns) {
        const m = html.match(p);
        if (m) {
            try { return new URL(m[1], baseUrl).toString(); } catch { return null; }
        }
    }
    return null;
}

async function probeKommun(k: Kommun): Promise<IcalHit | null> {
    for (const host of hostsFor(k)) {
        // 1. Prova kända .ics-paths
        for (const p of ICS_PATHS) {
            const url = host + p;
            const { text, ct } = await fetchText(url, 'text/calendar,application/calendar');
            if (text && looksLikeIcs(text, ct)) {
                const { count, titles } = parseIcsSummary(text);
                if (count > 0) {
                    return { kommun: k.name, host, icsUrl: url, veventCount: count, sampleTitles: titles };
                }
            }
        }
        // 2. Autodiscovery: hämta hemsidan och leta <link rel="alternate" type="text/calendar">
        const { text: html } = await fetchText(host + '/', 'text/html');
        if (html) {
            const link = findCalendarLinkInHtml(html, host);
            if (link) {
                const { text: ics, ct } = await fetchText(link, 'text/calendar');
                if (ics && looksLikeIcs(ics, ct)) {
                    const { count, titles } = parseIcsSummary(ics);
                    if (count > 0) {
                        return { kommun: k.name, host, icsUrl: link, veventCount: count, sampleTitles: titles };
                    }
                }
            }
        }
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

function emitSourceConfig(hits: IcalHit[]): void {
    if (hits.length === 0) return;
    console.log('\n\n=== GENERERAD SOURCE-CONFIG (kopiera in i registry.ts) ===\n');
    for (const h of hits) {
        console.log(`    {`);
        console.log(`        id: '${slugify(h.kommun)}-ical',`);
        console.log(`        hostName: '${h.kommun}',`);
        console.log(`        region: '${slugify(h.kommun)}',`);
        console.log(`        engine: 'ical',`);
        console.log(`        config: {`);
        console.log(`            urls: ['${h.icsUrl}'],`);
        console.log(`        },`);
        console.log(`        updateFrequency: 'every-3d',`);
        console.log(`        notes: 'iCal-probe ${new Date().toISOString().slice(0, 10)}: ${h.veventCount} VEVENTs.',`);
        console.log(`    },`);
    }
}

async function main() {
    const { concurrency, filter } = parseArgs();
    const kommuner = filter
        ? KOMMUNER.filter((k) => k.name.toLowerCase().includes(filter.toLowerCase()))
        : KOMMUNER;

    console.log(`Probar ${kommuner.length} kommuner efter .ics-flöden (concurrency=${concurrency})…\n`);
    const startedAt = Date.now();
    let done = 0;
    const hits: IcalHit[] = [];

    await runWithConcurrency(kommuner, concurrency, async (k) => {
        const hit = await probeKommun(k);
        done++;
        if (hit) {
            const sample = hit.sampleTitles[0] ? ` — "${hit.sampleTitles[0].slice(0, 40)}"` : '';
            console.log(`✅ [${String(done).padStart(3)}/${kommuner.length}] ${k.name.padEnd(20)} ${String(hit.veventCount).padStart(4)} VEVENTs  ${hit.icsUrl}${sample}`);
            hits.push(hit);
        } else {
            console.log(`○  [${String(done).padStart(3)}/${kommuner.length}] ${k.name.padEnd(20)} (no .ics)`);
        }
        return hit;
    });

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`\n=== SAMMANFATTNING (${elapsed}s) ===`);
    console.log(`Probat: ${kommuner.length} kommuner`);
    console.log(`Hittade iCal-flöden: ${hits.length}`);
    if (hits.length > 0) {
        const total = hits.reduce((s, h) => s + h.veventCount, 0);
        console.log(`Totalt VEVENTs bakom dessa: ~${total}`);
        emitSourceConfig(hits);
    } else {
        console.log('Inga träffar.');
    }
    process.exit(0);
}

main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
});
