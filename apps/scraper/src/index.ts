import { scrapeVaxjoCo } from './scrapers/vaxjoco';
import { scrapeUpplevVaxjo } from './scrapers/upplev';
import { scrapeTickster } from './scrapers/tickster';
import { scrapeEventbrite } from './scrapers/eventbrite';

async function runAllScrapers() {
    console.log('--- VADKUL SCRAPER BOT STARTING ---');
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`Mode: Kommande 7 dagar, maximalt antal event`);

    // Kör skrapor sekventiellt för att undvika rate limiting
    await scrapeTickster();      // Tickster: Växjö, Kronoberg, Alvesta, Ljungby, Älmhult
    await scrapeVaxjoCo();       // Växjö & Co (officiell evenemangsida)
    await scrapeUpplevVaxjo();   // Upplev Växjö (kommunens guide)
    await scrapeEventbrite();    // Eventbrite: Växjö & Kronoberg

    console.log('--- ALL SCRAPERS FINISHED ---');
    process.exit(0);
}

runAllScrapers().catch(err => {
    console.error('Bot crashed:', err);
    process.exit(1);
});
