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
import { scrapeKollektivetLivet } from './scrapers/kollektivetlivet';
import { scrapeUpplevStockholm } from './scrapers/upplev-stockholm';

// Nytt skalbart Sources-system — körs efter de stora bespoke-scrapers
import { runSources, summarize, scheduledForToday, summarizeSchedule, ENGINES } from './sources';
import { SOURCES } from './sources/registry';

/**
 * Kör en scraper isolerat: en krasch i en källa får aldrig stoppa de andra
 * eller den avslutande aggregeringen. Loggar felet och fortsätter.
 */
async function runStep(name: string, fn: () => Promise<unknown>): Promise<void> {
    try {
        await fn();
    } catch (err) {
        console.error(`⚠️ Scraper "${name}" kraschade — fortsätter med nästa källa:`, err);
    }
}

async function runAllScrapers() {
    console.log('--- VADKUL SCRAPER BOT STARTING ---');
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`Mode: Idag prioriterat, sedan kommande 7 dagar`);

    try {
        // 1. Idag-fokuserade scrapers (körs först för snabb täckning av dagens events)
        await runStep('today-sweden', scrapeTodaySweden);   // Nöjesguiden + Tickster-idag: Sverige-brett

        // 2. Rikstäckande vecko-scrapers
        await runStep('tickster', scrapeTickster);          // Tickster: Sverige-brett, 7 dagar
        await runStep('ticketmaster', scrapeTicketmaster);  // TicketMaster: Discovery API, SE, 7 dagar
        // scrapeBilletto — avstängd, billetto.se är dead (404)
        await runStep('eventbrite', scrapeEventbrite);      // Eventbrite: 14 städer, 7 dagar (Puppeteer, .se-events only)
        // scrapeEventim — avstängd, blockerad av Akamai WAF (0 events)

        // 3. Meetup: Sverige-brett, idag + 7 dagar (community events)
        await runStep('meetup', scrapeMeetup);

        // 4. Facebook (ej inloggad, begränsad men täcker bredare sökord)
        await runStep('facebook', scrapeFacebookEvents);

        // 4b. Stockholm-venyer (egen sajt, JS-renderad lista)
        await runStep('kollektivet-livet', scrapeKollektivetLivet);  // Kollektivet Livet: klubb/scen, Slussen/Söder
        await runStep('upplev-stockholm', scrapeUpplevStockholm);    // Upplev Stockholm: stadens parkprogram + Parkteatern

        // 5. Lokala Växjö-scrapers
        await runStep('vaxjo-co', scrapeVaxjoCo);           // Växjö & Co (officiell evenemangsida)
        await runStep('upplev-vaxjo', scrapeUpplevVaxjo);   // Upplev Växjö (kommunens guide)

        // 6. Nya skalbara Sources — respekterar updateFrequency så vi sprider ut
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
    } finally {
        // 7. Aggregera ALLTID — även om något ovan kraschade — så feeden uppdateras.
        try {
            const { runAggregation } = require('./scripts/aggregate-events');
            await runAggregation();
        } catch (aggErr) {
            console.error('⚠️ Det gick inte att köra aggregations-scriptet:', aggErr);
        }
    }

    console.log('--- ALL SCRAPERS FINISHED ---');
    process.exit(0);
}

runAllScrapers().catch(err => {
    console.error('Bot crashed:', err);
    process.exit(1);
});
