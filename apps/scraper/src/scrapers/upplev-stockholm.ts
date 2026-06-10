/**
 * upplev.stockholm — Stockholms stads publika evenemangssajt.
 *
 * Täcker stadens parkprogram (Tantolunden, Medborgarplatsen, Sergels torg …),
 * Parkteatern, parkkonserter, parklekar m.m. — plus event som aggregeras från
 * syster-sajterna (stadsmuseet.stockholm, medeltidsmuseet.stockholm,
 * ung.stockholm).
 *
 * Upptäckt (varför bespoke i.st.f. sitemap-engine):
 *   - Event-detaljsidor: /aktuellt/kalendarium/YYYY/MM/<slug>/ — server-renderade,
 *     "10 juni 2026" i text + datetime="17.00" + "Plats: …" + og:title/og:image.
 *   - Central listning /aktuellt/?t=event och månadsarkiven är HÅRDKAPADE till 9
 *     kurerade event; ingen load-more/paginering finns (knapp, scroll, URL-param —
 *     inget gav fler). Event-URL:erna ligger INTE i sitemap.xml.
 *   - Hela utbudet upptäcks istället genom att crawla sitemapens container-sidor
 *     (/platser/, /stockholms-parklekar/, kampanjsidor …) och samla deras
 *     /kalendarium/-länkar. Allt server-renderat → vanlig fetch, ingen Puppeteer.
 *
 * Fönster: kommande 30 dagar (matchar pipelinens SCRAPE_WINDOW_DAYS).
 */

import { addEventToDb, eventExistsInDb } from '../utils/dbHelper';
import { classifyEvent } from '../utils/classify';
import { geocodeVenue } from '../utils/venueCoordinates';

const SITEMAP_URL = 'https://upplev.stockholm/sitemap.xml';
const LIST_URL = 'https://upplev.stockholm/aktuellt/?t=event';
const UA = 'Mozilla/5.0 (Macintosh) Chrome/124.0.0.0 Safari/537.36';
const WINDOW_DAYS = parseInt(process.env.SCRAPE_WINDOW_DAYS || '30', 10);

// Detaljsidor på upplev + aggregerade syster-stockholm-sajter.
const DETAIL_RE = /https?:\/\/[a-z.]*stockholm\/aktuellt\/kalendarium\/20\d{2}\/\d{2}\/[a-z0-9-]+\/?|\/aktuellt\/kalendarium\/20\d{2}\/\d{2}\/[a-z0-9-]+\/?/gi;

const MONTHS: Record<string, number> = {
    januari: 0, februari: 1, mars: 2, april: 3, maj: 4, juni: 5,
    juli: 6, augusti: 7, september: 8, oktober: 9, november: 10, december: 11,
};

function decodeEntities(s: string): string {
    return s
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
        .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
        .trim();
}

async function fetchText(url: string): Promise<string> {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
        if (!res.ok) return '';
        return await res.text();
    } catch {
        return '';
    }
}

/** Liten samtidighets-pool. */
async function mapPool<T, R>(items: T[], limit: number, fn: (it: T) => Promise<R>): Promise<R[]> {
    const out: R[] = new Array(items.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (true) {
            const i = next++;
            if (i >= items.length) break;
            out[i] = await fn(items[i]);
        }
    }));
    return out;
}

interface ParsedEvent {
    title: string;
    when: Date;
    venue: string;
    description: string;
    image: string | null;
    url: string;
}

function parseDetail(html: string, url: string): ParsedEvent | null {
    if (!html) return null;
    const meta = (prop: string) => {
        const m = html.match(new RegExp(`property="og:${prop}"\\s+content="([^"]*)"`, 'i'))
            || html.match(new RegExp(`name="${prop}"\\s+content="([^"]*)"`, 'i'));
        return m ? decodeEntities(m[1]) : '';
    };

    let title = meta('title').replace(/\s*[-–]\s*(Upplev Stockholm|Stockholms stad|Stadsmuseet|Medeltidsmuseet|Ung Stockholm)\s*$/i, '').trim();
    if (!title) return null;

    // Datum: "10 juni 2026"
    const dm = html.match(/\b(\d{1,2})\s+(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)\s+(20\d{2})\b/i);
    if (!dm) return null;
    const day = parseInt(dm[1], 10);
    const month = MONTHS[dm[2].toLowerCase()];
    const year = parseInt(dm[3], 10);

    // Starttid: första datetime="HH.MM" (klockslag, inte ISO-datum)
    const tm = html.match(/datetime="(\d{1,2})[.:](\d{2})"/);
    const hour = tm ? parseInt(tm[1], 10) : 0;
    const min = tm ? parseInt(tm[2], 10) : 0;
    const when = new Date(year, month, day, hour, min, 0);
    if (isNaN(when.getTime())) return null;

    // Plats: "<span ...>Plats:</span> Medborgarplatsen, Södermalm</p>"
    const pm = html.match(/Plats:?\s*<\/span>\s*([^<]+)</i);
    const venue = pm ? decodeEntities(pm[1]).replace(/\s+/g, ' ').trim() : '';

    return {
        title,
        when,
        venue,
        description: meta('description'),
        image: meta('image') || null,
        url: url.replace(/\/$/, '/'),
    };
}

export async function scrapeUpplevStockholm(): Promise<number> {
    console.log('[Upplev Stockholm] Startar — crawlar container-sidor för event-länkar…');

    // 1. Sitemap → alla container-sidor (+ central listning).
    const sm = await fetchText(SITEMAP_URL);
    const pages = Array.from(new Set([
        LIST_URL,
        ...Array.from(sm.matchAll(/<loc>([^<]+)<\/loc>/gi)).map((m) => m[1]),
    ]));
    console.log(`[Upplev Stockholm] ${pages.length} container-sidor att skanna`);

    // 2. Samla unika detalj-URL:er.
    const found = new Set<string>();
    const htmls = await mapPool(pages, 8, fetchText);
    for (const html of htmls) {
        for (const m of html.matchAll(DETAIL_RE)) {
            let u = m[0];
            if (u.startsWith('/')) u = 'https://upplev.stockholm' + u;
            if (!u.endsWith('/')) u += '/';
            found.add(u);
        }
    }
    const detailUrls = Array.from(found);
    console.log(`[Upplev Stockholm] ${detailUrls.length} unika event-sidor hittade`);

    // 3. Hämta + parsa varje detaljsida.
    const parsed = (await mapPool(detailUrls, 8, async (u) => parseDetail(await fetchText(u), u)))
        .filter((e): e is ParsedEvent => !!e);

    // 4. Fönster-filtrering + spara.
    const now = Date.now();
    const windowEnd = now + WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const geoCache = new Map<string, [number, number] | null>();
    let saved = 0, outside = 0;

    for (const e of parsed) {
        try {
            if (e.when.getTime() < now - 12 * 60 * 60 * 1000 || e.when.getTime() > windowEnd) { outside++; continue; }
            if (await eventExistsInDb(e.url)) continue;

            const venueQuery = e.venue ? `${e.venue}, Stockholm` : 'Stockholm';
            if (!geoCache.has(venueQuery)) geoCache.set(venueQuery, await geocodeVenue(venueQuery));
            const coords = geoCache.get(venueQuery) ?? null;
            const lat = coords ? coords[0] : 59.3293;
            const lng = coords ? coords[1] : 18.0686;

            await addEventToDb({
                title: e.title,
                url: e.url,
                time: e.when,
                hasSpecificTime: !(e.when.getHours() === 0 && e.when.getMinutes() === 0),
                locationName: e.venue || 'Stockholm',
                lat,
                lng,
                hostName: 'Upplev Stockholm',
                category: classifyEvent(e.title, e.description),
                createdAt: new Date(),
                coverImage: e.image,
                price: '',
                description: e.description,
                isLocationVerified: !!coords,
            });
            saved++;
            console.log(`  ✅ ${e.when.toISOString().slice(0, 16)} | ${e.title.slice(0, 40)} | ${e.venue}`);
        } catch (err) {
            console.error(`  [Upplev Stockholm] fel på "${e.title}":`, (err as Error).message);
        }
    }

    console.log(`[Upplev Stockholm] Klar — ${saved} nya events sparade (${outside} utanför fönstret, ${parsed.length} totalt parsade).`);
    return saved;
}
