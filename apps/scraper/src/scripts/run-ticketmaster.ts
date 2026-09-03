/**
 * Kör BARA Ticketmaster-scrapern (nya event + berikning av kända).
 *
 *   npm run scrape-ticketmaster
 *
 * Nattkedjan kör den via src/index.ts; det här är för riktade körningar,
 * t.ex. berikningen 2026-09-04 av de ~860 DK/NO/SE-event som låg med
 * "Music Pop" som beskrivning och "TicketMaster" som värd.
 */
import { scrapeTicketmaster } from '../scrapers/ticketmaster';

scrapeTicketmaster()
    .then((n) => { console.log(`Klart — ${n} nya.`); process.exit(0); })
    .catch((err) => { console.error(err); process.exit(1); });
