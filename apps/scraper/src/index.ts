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
// Paraply-nätverken (Hembygd, Svenska kyrkan, Naturskydd, Rotary, Röda Korset)
// körs numera som engines via Sources-systemet — se registry.ts "NÄTVERK".

// Nytt skalbart Sources-system — körs efter de stora bespoke-scrapers
import { runSources, summarize, scheduledForToday, summarizeSchedule, ENGINES } from './sources';
import { SOURCES } from './sources/registry';
import { runWithWatchdog, tapStreamActivity } from './utils/stepWatchdog';

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

/**
 * Facebook-steget bakom en stegvakt (#259): 17/11 hängde det tyst i 35 h och
 * blockerade nästa natt. 30 min utan en enda loggrad = häng; 16 h = tak, så
 * efterstegen hinner klart före nästa natts 00:30. Utfallet loggas som
 * `❌ [häng]` — run-daily.sh lyfter raden till Telegram-rapportens "Att kolla".
 */
const FB_STALL_MS = 30 * 60_000;
const FB_MAX_MS = 16 * 60 * 60_000;

async function runFacebookGuarded(): Promise<void> {
    const tap = tapStreamActivity();
    try {
        const outcome = await runWithWatchdog(scrapeFacebookEvents, {
            stallMs: FB_STALL_MS,
            maxMs: FB_MAX_MS,
            lastActivityAt: tap.lastActivityAt,
        });
        if (outcome === 'stall') {
            console.log(`❌ [häng] facebook: ingen loggrad på ${FB_STALL_MS / 60_000} min — steget släpps så kedjan går vidare`);
        } else if (outcome === 'overtime') {
            console.log(`❌ [häng] facebook: över ${FB_MAX_MS / 3_600_000} h — steget släpps så kedjan går vidare`);
        }
    } finally {
        tap.restore();
    }
}

/** Aggregera SQLite → Firestore + web-JSON. Körs både direkt efter Facebook
 *  (snabb publicering av dagens färskaste) och en sista gång på slutet. */
async function aggregate(label: string): Promise<void> {
    await runStep(label, async () => {
        const { runAggregation } = require('./scripts/aggregate-events');
        await runAggregation();
    });
}

async function runAllScrapers() {
    console.log('--- VADKUL SCRAPER BOT STARTING ---');
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`Mode: webbkällor först, publicera, sedan Facebook sist`);

    try {
        // Ordning (ändrad 28/9 2026): FB körde FÖRST och tog 10–16 h (sökets
        // död i juli + växande seed-fil), så övriga källor nådde kartan först
        // på kvällen. Nu går webbkällorna först och publiceras, FB sist — kartan
        // är färsk på morgonen oavsett hur lång FB-svansen blir.

        // 1. Idag-/vecko-scrapers (bespoke).
        await runStep('today-sweden', scrapeTodaySweden);   // Nöjesguiden + Tickster-idag: Sverige-brett
        await runStep('tickster', scrapeTickster);          // Tickster: Sverige-brett, 7 dagar
        await runStep('ticketmaster', scrapeTicketmaster);  // TicketMaster: Discovery API, SE, 7 dagar
        // scrapeBilletto — avstängd, billetto.se är dead (404)
        await runStep('eventbrite', scrapeEventbrite);      // Eventbrite: 14 städer, 7 dagar (Puppeteer, .se-events only)
        // scrapeEventim — avstängd, blockerad av Akamai WAF (0 events)
        await runStep('meetup', scrapeMeetup);              // Meetup: Sverige-brett, idag + 7 dagar
        await runStep('kollektivet-livet', scrapeKollektivetLivet);  // Kollektivet Livet: klubb/scen, Slussen/Söder
        await runStep('upplev-stockholm', scrapeUpplevStockholm);    // Upplev Stockholm: stadens parkprogram + Parkteatern
        await runStep('vaxjo-co', scrapeVaxjoCo);           // Växjö & Co (officiell evenemangsida)
        await runStep('upplev-vaxjo', scrapeUpplevVaxjo);   // Upplev Växjö (kommunens guide)

        // 2. Skalbara Sources — respekterar updateFrequency så vi sprider ut
        //    körningar över veckan (kommunsajter/venyer behöver inte hamras dagligen).
        try {
            console.log('\n--- SOURCES (nytt skalbart system) ---');
            console.log(summarizeSchedule(SOURCES.filter((s) => !s.disabled)));
            const dueToday = scheduledForToday(SOURCES);
            if (dueToday.length > 0) {
                const results = await runSources(dueToday, ENGINES, { concurrency: 6 });
                summarize(results);
            } else {
                console.log('Inga sources schemalagda för idag.');
            }
        } catch (srcErr) {
            console.error('⚠️ Sources-systemet crashade:', srcErr);
        }

        // 3. Publicera webbkällorna innan FB-svansen.
        await aggregate('aggregate-efter-webbkallor');

        // 4. Facebook sist — sidbevakning + seed-fil (söket avstängt, se facebook/index.ts).
        await runStep('facebook', runFacebookGuarded);
    } finally {
        // 5. Aggregera ALLTID — även om något ovan kraschade — så feeden uppdateras.
        await aggregate('aggregate-final');
    }

    console.log('--- ALL SCRAPERS FINISHED ---');
    process.exit(0);
}

runAllScrapers().catch(err => {
    console.error('Bot crashed:', err);
    process.exit(1);
});
