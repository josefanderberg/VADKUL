import { scrapeVaxjoCo } from './scrapers/vaxjoco';
import { scrapeUpplevVaxjo } from './scrapers/upplev';
import { scrapeTickster } from './scrapers/tickster';
import { scrapeEventbrite } from './scrapers/eventbrite';
import { scrapeFacebookEvents } from './scrapers/facebook/index';
import { scrapeBilletto } from './scrapers/billetto';
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
    await scrapeBilletto();      // Billetto: Sverige-brett, idag + 7 dagar
    await scrapeEventbrite();    // Eventbrite: 21 svenska städer, 7 dagar

    // 3. Meetup: Sverige-brett, idag + 7 dagar (community events)
    await scrapeMeetup();

    // 4. Facebook (ej inloggad, begränsad men täcker bredare sökord)
    await scrapeFacebookEvents();

    // 4. Lokala Växjö-scrapers
    await scrapeVaxjoCo();       // Växjö & Co (officiell evenemangsida)
    await scrapeUpplevVaxjo();   // Upplev Växjö (kommunens guide)

    console.log('--- ALL SCRAPERS FINISHED ---');
    process.exit(0);
}

runAllScrapers().catch(err => {
    console.error('Bot crashed:', err);
    process.exit(1);
});
