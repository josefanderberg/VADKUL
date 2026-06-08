/**
 * Scraper: Idag – hela Sverige
 *
 * Kör de källor som har URL-baserat dag-filter snabbt först, så att audit-
 * och pris-extraktion hinner med innan användare öppnar sidan på dagen.
 *
 * Aktiva källor:
 *   1. Tickster (todayOnly)     — JSON-LD med pris vid scrape-tid, snabb (Puppeteer)
 *   2. Facebook (filter='idag') — bredast täckning för dagens lokala events
 *
 * Avstängda källor (historiskt här, finns inte längre):
 *   - Nöjesguiden: ng.se/kalendarium → 404 sedan 2026, sajten är artikel-tidning nu.
 *   - Billetto:    billetto.se/se/events → 404, sajten är SPA via /search nu och
 *                  exponerar inga events i HTML. Kräver Puppeteer-refactor.
 *
 * Full-jobbet (kvällen) sveper veckan + alla källor utan dag-filter.
 */

// ─── HUVUD-EXPORT ─────────────────────────────────────────────────────────────
export async function scrapeTodaySweden(): Promise<void> {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    console.log(`\n📅 Scraping events för idag (${todayStr}) – hela Sverige\n`);

    let ticksterErr = false, fbErr = false;

    // Tickster — JSON-LD pris direkt, halv-volym med todayOnly.
    try {
        console.log(`🎟️  Tickster (idag)…`);
        const { scrapeTickster } = require('./tickster');
        await scrapeTickster({ todayOnly: true });
    } catch (e) {
        ticksterErr = true;
        console.error('⚠️ Tickster-idag misslyckades — fortsätter ändå:', e);
    }

    // Facebook med BARA 'idag'-filtret. Halverar query-volymen mot full-svepet
    // (som kör idag + denna veckan) men ger dagens events ~3 timmar tidigare
    // — kritiskt så audit + aggregate hinner publicera priser/kategorier för
    // dagens events innan användare kollar webben.
    try {
        console.log(`\n👥 Facebook (filter: idag)…`);
        const { scrapeFacebookEvents } = require('./facebook');
        await scrapeFacebookEvents({ filters: ['idag'] });
    } catch (e) {
        fbErr = true;
        console.error('⚠️ FB-idag-skrapan misslyckades — fortsätter ändå:', e);
    }

    console.log(`\n✅ Klar med dag-fokuserade källor.`);
    console.log(`   Tickster (idag):    ${ticksterErr ? 'FEL' : 'se logg ovan'}`);
    console.log(`   Facebook (idag):    ${fbErr ? 'FEL' : 'se logg ovan'}`);

    // Aggregera all data till progressiva lager direkt efter insamling
    try {
        const { runAggregation } = require('../scripts/aggregate-events');
        await runAggregation();
    } catch (aggErr) {
        console.error('⚠️ Det gick inte att köra aggregations-scriptet:', aggErr);
    }
}
