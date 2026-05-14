/**
 * Facebook Scraper Entry Point
 * Redirects to the refactored modular version.
 */
import { scrapeFacebookEvents } from './facebook/index';

export { scrapeFacebookEvents };

// Execute if run directly
if (require.main === module) {
    scrapeFacebookEvents().catch(console.error);
}
