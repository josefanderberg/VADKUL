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
    let skippedNoTitleOrLink = 0;
    let skippedDuplicate = 0;

    try {
        const res = await fetch(url, { headers: HEADERS });
        console.log(`  [Nöjesguiden] HTTP ${res.status} (${res.headers.get('content-type') || '?'})`);
        if (!res.ok) return 0;
        const html = await res.text();
        const $ = cheerio.load(html);

        const eventElements = $('.event-list-item, .kalendarium-item');
        console.log(`  [Nöjesguiden] Selektor-träffar: ${eventElements.length} (HTML ${html.length} bytes)`);

        for (const el of eventElements.toArray()) {
            const title = $(el).find('h2, h3').first().text().trim();
            const link = $(el).find('a').first().attr('href');
            const location = $(el).find('.venue, .location').first().text().trim() || 'Sverige';

            if (!title || !link) { skippedNoTitleOrLink++; continue; }
            const fullUrl = link.startsWith('http') ? link : `https://ng.se${link}`;

            if (await eventExistsInDb(fullUrl)) { skippedDuplicate++; continue; }

            await addEventToDb({
                title, url: fullUrl, time: new Date(), // NG visar ofta dagens direkt
                locationName: location, lat: 59.3293, lng: 18.0686,
                hostName: 'Nöjesguiden', category: guessCategoryFromTitle(title),
                createdAt: new Date(),
            });
            saved++;
        }
        console.log(`  [Nöjesguiden] Sparade ${saved}, hoppade ${skippedDuplicate} dubblett, ${skippedNoTitleOrLink} utan titel/länk.`);
    } catch (e) { console.error('  [Nöjesguiden] Fel:', e); }
    return saved;
}

// Tidigare hade vi en scrapeTicksterToday här som matchade `href.includes(todayStr)`.
// Det matchade söklistans EGEN URL (?date_from=YYYY-MM-DD) och sparade
// listsidor som event med titeln "Tickster Event". 8 skräpevents i DB innan vi
// tog bort. tickster.ts täcker idag-fönstret korrekt. Se docs/scrapers/inaktiva.md.

// ─── HUVUD-EXPORT ─────────────────────────────────────────────────────────────
export async function scrapeTodaySweden(): Promise<void> {
    const todayStr = getTodayStr();
    console.log(`\n📅 Scraping events för idag (${todayStr}) – hela Sverige\n`);

    const n1 = await scrapeNojesguiden();

    // Källor med URL-baserat dag-filter, kallas med todayOnly=true så bara
    // dagens URLs hämtas (skippar veckan/kategori-URLs som full-jobbet ändå
    // sveper senare). JSON-LD från Tickster/Billetto ger ofta pris direkt
    // utan att vänta på LLM-audit.
    let billettoErr = false, ticksterErr = false, fbErr = false;
    try {
        console.log(`\n🎫 Billetto (idag)…`);
        const { scrapeBilletto } = require('./billetto');
        await scrapeBilletto({ todayOnly: true });
    } catch (e) {
        billettoErr = true;
        console.error('⚠️ Billetto-idag misslyckades — fortsätter ändå:', e);
    }

    try {
        console.log(`\n🎟️  Tickster (idag)…`);
        const { scrapeTickster } = require('./tickster');
        await scrapeTickster({ todayOnly: true });
    } catch (e) {
        ticksterErr = true;
        console.error('⚠️ Tickster-idag misslyckades — fortsätter ändå:', e);
    }

    // Facebook med BARA 'idag'-filtret. Halverar query-volymen mot full-svepet
    // (som kör idag + denna veckan) men ger dagens events ~3 timmar tidigare
    // — kritiskt så audit + aggregate hinner publicera priser/kategorier för
    // dagens events innan användare kollar webben.
    try {
        console.log(`\n👥 Facebook (filter: idag)…`);
        const { scrapeFacebookEvents } = require('./facebook');
        await scrapeFacebookEvents({ filters: ['idag'] });
    } catch (e) {
        fbErr = true;
        console.error('⚠️ FB-idag-skrapan misslyckades — fortsätter ändå:', e);
    }

    console.log(`\n✅ Klar med dag-fokuserade källor.`);
    console.log(`   Nöjesguiden:        ${n1} nya`);
    console.log(`   Billetto (idag):    ${billettoErr ? 'FEL' : 'se logg ovan'}`);
    console.log(`   Tickster (idag):    ${ticksterErr ? 'FEL' : 'se logg ovan'}`);
    console.log(`   Facebook (idag):    ${fbErr ? 'FEL' : 'se logg ovan'}`);

    // Aggregera all data till progressiva lager direkt efter insamling
    try {
        const { runAggregation } = require('../scripts/aggregate-events');
        await runAggregation();
    } catch (aggErr) {
        console.error('⚠️ Det gick inte att köra aggregations-scriptet:', aggErr);
    }
}
