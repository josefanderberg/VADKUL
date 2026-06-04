import { scrapeVaxjoCo } from './scrapers/vaxjoco';
import { scrapeUpplevVaxjo } from './scrapers/upplev';
import { scrapeTickster } from './scrapers/tickster';
import { scrapeTicketmaster } from './scrapers/ticketmaster';
import { scrapeEventbrite } from './scrapers/eventbrite';
// import { scrapeEventim } from './scrapers/eventim';  // Eventim.se → blockerad av Akamai WAF (HTTP 000)
import { scrapeFacebookEvents } from './scrapers/facebook/index';
// import { scrapeBilletto } from './scrapers/billetto'; // Billetto.se → 404 (dead domain 2026)
import { scrapeMeetup } from './scrapers/meetup';
import { scrapeTodaySweden } from './scrapers/today-sweden';

// Nytt skalbart Sources-system — körs efter de stora bespoke-scrapers
import { runSources, summarize, scheduledForToday, summarizeSchedule, ENGINES } from './sources';
import { SOURCES } from './sources/registry';

async function runAllScrapers() {
    console.log('--- VADKUL SCRAPER BOT STARTING ---');
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`Mode: Idag prioriterat, sedan kommande 7 dagar`);

    // 1. Idag-fokuserade scrapers (körs först för snabb täckning av dagens events)
    await scrapeTodaySweden();   // Nöjesguiden + Tickster-idag: Sverige-brett

    // 2. Rikstäckande vecko-scrapers
    await scrapeTickster();      // Tickster: Sverige-brett, 7 dagar
    await scrapeTicketmaster();  // TicketMaster: Discovery API, SE, 7 dagar
    // scrapeBilletto — avstängd, billetto.se är dead (404)
    await scrapeEventbrite();    // Eventbrite: 14 städer, 7 dagar (Puppeteer, .se-events only)
    // scrapeEventim — avstängd, blockerad av Akamai WAF (0 events)

    // 3. Meetup: Sverige-brett, idag + 7 dagar (community events)
    await scrapeMeetup();

    // 4. Facebook (ej inloggad, begränsad men täcker bredare sökord)
    await scrapeFacebookEvents();

    // 4. Lokala Växjö-scrapers
    await scrapeVaxjoCo();       // Växjö & Co (officiell evenemangsida)
    await scrapeUpplevVaxjo();   // Upplev Växjö (kommunens guide)

    // 5. Nya skalbara Sources — respekterar updateFrequency så vi sprider ut
    //    körningar över veckan (kommunsajter behöver inte hamras dagligen).
    try {
        console.log('\n--- SOURCES (nytt skalbart system) ---');
        console.log(summarizeSchedule(SOURCES.filter((s) => !s.disabled)));
        const dueToday = scheduledForToday(SOURCES);
        if (dueToday.length > 0) {
            const results = await runSources(dueToday, ENGINES, { concurrency: 3 });
            summarize(results);
        } else {
            console.log('Inga sources schemalagda för idag.');
        }
    } catch (srcErr) {
        console.error('⚠️ Sources-systemet crashade:', srcErr);
    }

    // 6. Aggregera all data till progressiva lager
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
