import * as fs from 'fs';
import * as path from 'path';

// Define the type we expect to read
interface ScrapedEvent {
    url: string;
    title: string;
    [key: string]: any;
}

async function runRegressionTest() {
    console.log('🔍 Starting Secure Events Regression Test...\n');

    const goldenFilePath = path.join(__dirname, '../../secure-events/golden_fb_events.json');
    const newlyScrapedFilePath = path.join(__dirname, '../../../scraped_events.json');

    // 1. Load Golden Events
    if (!fs.existsSync(goldenFilePath)) {
        console.error('❌ Missing golden events file at:', goldenFilePath);
        process.exit(1);
    }
    const goldenEvents: ScrapedEvent[] = JSON.parse(fs.readFileSync(goldenFilePath, 'utf-8'));
    console.log(`✅ Loaded ${goldenEvents.length} golden (secure) events.`);

    // 2. Load Newly Scraped Events
    if (!fs.existsSync(newlyScrapedFilePath)) {
        console.error('❌ Missing newly scraped events file at:', newlyScrapedFilePath);
        console.error('Did you run the scraper first?');
        process.exit(1);
    }
    const newlyScrapedEvents: ScrapedEvent[] = JSON.parse(fs.readFileSync(newlyScrapedFilePath, 'utf-8'));
    console.log(`✅ Loaded ${newlyScrapedEvents.length} newly scraped events.`);

    // Create a Set of URLs from newly scraped events for O(1) lookup
    const newlyScrapedUrls = new Set(newlyScrapedEvents.map(e => e.url));

    // 3. Compare
    let missingCount = 0;
    const missingEvents: ScrapedEvent[] = [];

    for (const goldenEvent of goldenEvents) {
        if (!newlyScrapedUrls.has(goldenEvent.url)) {
            missingCount++;
            missingEvents.push(goldenEvent);
        }
    }

    // 4. Report
    console.log('\n--- REGRESSION TEST RESULTS ---');
    if (missingCount === 0) {
        console.log(`🎉 SUCCESS: All ${goldenEvents.length} secure events were successfully found in the new scrape!`);
        process.exit(0);
    } else {
        console.error(`❌ FAILED: ${missingCount} secure events are MISSING from the new scrape!`);
        console.error('Missing Events Details:');
        missingEvents.forEach((evt, idx) => {
            console.error(`  ${idx + 1}. ${evt.title}`);
            console.error(`     URL: ${evt.url}\n`);
        });
        process.exit(1);
    }
}

runRegressionTest().catch(err => {
    console.error('Unexpected error during regression test:', err);
    process.exit(1);
});
