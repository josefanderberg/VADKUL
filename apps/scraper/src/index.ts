import { scrapeVaxjoCo } from './scrapers/vaxjoco';
import { scrapeUpplevVaxjo } from './scrapers/upplev';
import { scrapeTickster } from './scrapers/tickster';
import { scrapeEventbrite } from './scrapers/eventbrite';
import { scrapeEventim } from './scrapers/eventim';
import { scrapeFacebookEvents } from './scrapers/facebook/index';
// import { scrapeBilletto } from './scrapers/billetto'; // Billetto.se → 404 (dead domain 2026)
import { scrapeMeetup } from './scrapers/meetup';
import { scrapeTodaySweden } from './scrapers/today-sweden';

async function runAllScrapers() {
    console.log('--- VADKUL SCRAPER BOT STARTING ---');
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`Mode: Idag prioriterat, sedan kommande 7 dagar`);

    // 1. Idag-fokuserade scrapers (körs först för snabb täckning av dagens events)
    await scrapeTodaySweden();   // Nöjesguiden + Tickster-idag: Sverige-brett

    // 2. Rikstäckande vecko-scrapers
    await scrapeTickster();      // Tickster: Sverige-brett, 7 dagar
    // scrapeBilletto — avstängd, billetto.se är dead (404)
    await scrapeEventbrite();    // Eventbrite: 14 städer, 30 dagar (Puppeteer)
    await scrapeEventim();       // Eventim: alla kategorier, 30 dagar (JSON-LD)

    // 3. Meetup: Sverige-brett, idag + 7 dagar (community events)
    await scrapeMeetup();

    // 4. Facebook (ej inloggad, begränsad men täcker bredare sökord)
    await scrapeFacebookEvents();

    // 4. Lokala Växjö-scrapers
    await scrapeVaxjoCo();       // Växjö & Co (officiell evenemangsida)
    await scrapeUpplevVaxjo();   // Upplev Växjö (kommunens guide)

    // 5. Aggregera all data till progressiva lager
    try {
        const { runAggregation } = require('./scripts/aggregate-events');
        await runAggregation();
    } catch (aggErr) {
        console.error('⚠️ Det gick inte att köra aggregations-scriptet:', aggErr);
    }

    console.log('--- ALL SCRAPERS FINISHED ---');
    process.exit(0);
}

runAllScrapers().catch(err => {
    console.error('Bot crashed:', err);
    process.exit(1);
});
