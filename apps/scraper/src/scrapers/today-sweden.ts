/**
 * Scraper: Idag – hela Sverige
 * Hämtar events som händer IDAG från nationella källor.
 */

import * as cheerio from 'cheerio';
import { addEventToDb, eventExistsInDb } from '../utils/dbHelper';
import { geocodeVenue } from '../utils/venueCoordinates';

function getTodayStr(): string {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - (offset * 60 * 1000));
    return local.toISOString().split('T')[0];
}

function getTodayRange() {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    return { start, end };
}

function isToday(date: Date): boolean {
    const { start, end } = getTodayRange();
    return date >= start && date <= end;
}

function guessCategoryFromTitle(title: string): string {
    const t = title.toLowerCase();
    if (t.includes('fest') || t.includes('aw') || t.includes('klubb') || t.includes('party') || t.includes('dans')) return 'party';
    if (t.includes('musik') || t.includes('konsert') || t.includes('kör') || t.includes('live')) return 'music';
    if (t.includes('quiz') || t.includes('spel') || t.includes('bingo')) return 'game';
    if (t.includes('mat') || t.includes('öl') || t.includes('vin') || t.includes('provning')) return 'food';
    if (t.includes('barn') || t.includes('familj') || t.includes('lek')) return 'play';
    return 'other';
}

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
};

// ─── 1. NÖJESGUIDEN (NY!) ────────────────────────────────────────────────────
async function scrapeNojesguiden(): Promise<number> {
    const url = 'https://ng.se/kalendarium';
    console.log(`  [Nöjesguiden] Hämtar: ${url}`);
    let saved = 0;

    try {
        const res = await fetch(url, { headers: HEADERS });
        if (!res.ok) return 0;
        const $ = cheerio.load(await res.text());

        const eventElements = $('.event-list-item, .kalendarium-item');
        console.log(`  [Nöjesguiden] Hittade ${eventElements.length} i listan.`);

        for (const el of eventElements.toArray()) {
            const title = $(el).find('h2, h3').first().text().trim();
            const link = $(el).find('a').first().attr('href');
            const location = $(el).find('.venue, .location').first().text().trim() || 'Sverige';
            
            if (!title || !link) continue;
            const fullUrl = link.startsWith('http') ? link : `https://ng.se${link}`;
            
            if (await eventExistsInDb(fullUrl)) continue;

            await addEventToDb({
                title, url: fullUrl, time: new Date(), // NG visar ofta dagens direkt
                locationName: location, lat: 59.3293, lng: 18.0686,
                hostName: 'Nöjesguiden', category: guessCategoryFromTitle(title),
                createdAt: new Date(),
            });
            saved++;
        }
    } catch (e) { console.error('  [Nöjesguiden] Fel:', e); }
    return saved;
}

// ─── 2. TICKSTER ──────────────────────────────────────────────────────────────
async function scrapeTicksterToday(todayStr: string): Promise<number> {
    const url = `https://www.tickster.com/se/sv/events/search?q=&date_from=${todayStr}&date_to=${todayStr}`;
    console.log(`  [Tickster] Hämtar: ${url}`);
    let saved = 0;
    try {
        const res = await fetch(url, { headers: HEADERS });
        if (!res.ok) return 0;
        const $ = cheerio.load(await res.text());
        const links: string[] = [];
        $('a[href*="/events/"]').each((_, el) => {
            const href = $(el).attr('href') || '';
            if (href.includes(todayStr)) {
                const full = href.startsWith('http') ? href : `https://www.tickster.com${href}`;
                if (!links.includes(full)) links.push(full);
            }
        });
        for (const link of links) {
            if (await eventExistsInDb(link)) continue;
            await addEventToDb({
                title: 'Tickster Event', url: link, time: new Date(todayStr),
                locationName: 'Sverige', lat: 59.3293, lng: 18.0686,
                hostName: 'Tickster', category: 'other', createdAt: new Date()
            });
            saved++;
        }
    } catch (e) {}
    return saved;
}

// ─── HUVUD-EXPORT ─────────────────────────────────────────────────────────────
export async function scrapeTodaySweden(): Promise<void> {
    const todayStr = getTodayStr();
    console.log(`\n📅 Scraping events för idag (${todayStr}) – hela Sverige\n`);

    const n1 = await scrapeNojesguiden();
    const t1 = await scrapeTicksterToday(todayStr);

    const total = n1 + t1;
    console.log(`\n✅ Klar! Sparade ${total} nya event för idag.`);
    console.log(`   Nöjesguiden: ${n1}  |  Tickster: ${t1}`);

    // Aggregera all data till progressiva lager direkt efter insamling
    try {
        const { runAggregation } = require('../scripts/aggregate-events');
        await runAggregation();
    } catch (aggErr) {
        console.error('⚠️ Det gick inte att köra aggregations-scriptet:', aggErr);
    }
}
