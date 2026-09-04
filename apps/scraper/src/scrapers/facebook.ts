/**
 * Facebook Scraper Entry Point
 * Redirects to the refactored modular version.
 *
 *   npm run scrape-fb                    # hela svepet (nattkedjan)
 *   npm run scrape-fb -- --city=Piteå    # bara en stad: stadssök + dess sidbevakningar
 */
import { scrapeFacebookEvents } from './facebook/index';
import { parseCityArg } from './facebook/scope';

export { scrapeFacebookEvents };

// Execute if run directly
if (require.main === module) {
    scrapeFacebookEvents({ onlyCity: parseCityArg(process.argv.slice(2)) }).catch(console.error);
}
