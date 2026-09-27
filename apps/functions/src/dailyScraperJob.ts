/** Daily Scraper Bot — kör Tickster + Eventbrite 06:00 Stockholm-tid. */
import { region } from './shared';
import { scrapeTickster } from './scrapers/tickster';
import { scrapeEventbrite } from './scrapers/eventbrite';

/**
 * Daily Scraper Bot
 * Runs every day at 06:00 Stockholm time
 */
export const dailyScraper = region.pubsub
    .schedule('0 6 * * *')
    .timeZone('Europe/Stockholm')
    .onRun(async (context) => {
        console.log('--- DAILY SCRAPER BOT STARTING ---');
        console.log(`Time: ${new Date().toISOString()}`);

        try {
            // Run scrapers that don't require a browser
            console.log('Running Tickster Scraper...');
            await scrapeTickster();

            console.log('Running Eventbrite Scraper...');
            await scrapeEventbrite();

            console.log('--- DAILY SCRAPER BOT FINISHED ---');
        } catch (error) {
            console.error('Scraper Bot encountered an error:', error);
        }
        return null;
    });
