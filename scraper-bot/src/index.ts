import { scrapeVaxjoCo } from './scrapers/vaxjoco';
import { scrapeUpplevVaxjo } from './scrapers/upplev';
import { scrapeTickster } from './scrapers/tickster';

async function runAllScrapers() {
    console.log('--- VADKUL SCRAPER BOT STARTING ---');
    console.log(`Time: ${new Date().toISOString()}`);

    // Kör skrapor sekventiellt (eller med Promise.all för parallellt)
    await scrapeTickster();
    await scrapeVaxjoCo();
    await scrapeUpplevVaxjo();

    console.log('--- ALL SCRAPERS FINISHED ---');
    process.exit(0);
}

runAllScrapers().catch(err => {
    console.error('Bot crashed:', err);
    process.exit(1);
});
