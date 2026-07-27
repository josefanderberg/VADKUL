/**
 * FB-sidbevakning: sidor vars /events-flik crawlas direkt, utan sök.
 *
 * Bakgrund (2026-07-27): FB stängde utloggad EVENTSÖK någon gång 23–26 juli
 * ("Vi hittade inte några resultat" + login-vägg på alla sökqueries, verifierat
 * headless). Event-DETALJSIDOR och sidors /events-flikar renderar dock
 * fortfarande utloggat — så discovery via bevakade sidor fungerar där söket
 * dött. Sid-slugs skördas ur arrangörernas egna webbplatser (gotland.com:s
 * företagskatalog för Gotland) och verifieras headless innan de läggs in:
 * sidan ska existera OCH ha en publik /events-flik.
 *
 * Riktlinjer:
 *  - slug = det som står efter facebook.com/ (case-känsligt OK, FB redirectar).
 *  - city = geokodningshint (samma roll som i sök-källorna).
 *  - Håll listan kuraterad — varje sida kostar ~10–15 s headless per körning.
 */

export interface FacebookPageWatch {
    slug: string;
    name: string;
    city: string;
}

export const FACEBOOK_PAGE_WATCHLIST: FacebookPageWatch[] = [
    // ── Gotland (maxningen 2026-07-27) ──────────────────────────────────
    // Skördade ur gotland.com:s företagskatalog (1653 sidor) + gissningar;
    // alla 30 verifierade headless 2026-07-27: sidan finns + /events-fliken
    // visar eventlänkar utloggat. OBS: fliken listar även TIDIGARE event —
    // extraktionsfasen datumfiltrerar. Medvetet EJ med: sidor vars arrangör
    // redan har egen källa (Gotlands Museum, Medeltidsveckan, ABF, hembygds-
    // föreningar, Bergmancenter, Region Gotland) och rena konstnärsportfolios.
    { slug: 'wisbystrand', name: 'Wisby Strand Congress & Event', city: 'Visby' },
    { slug: 'icamaxivisby', name: 'ICA Maxi Visby', city: 'Visby' },
    { slug: 'coopgotland', name: 'Coop Gotland', city: 'Visby' },
    { slug: 'visbycentrum', name: 'Visby Centrum', city: 'Visby' },
    { slug: 'kallisvisby', name: 'Kallis Beach Club', city: 'Visby' },
    { slug: 'surfersvisby', name: 'Surfers Visby', city: 'Visby' },
    { slug: 'pizzeriababbolina', name: 'Pizzeria Babbolina', city: 'Gotland' },
    { slug: 'elsiescafe', name: 'Elsies Café', city: 'Gotland' },
    { slug: 'bistroburs', name: 'Bistro Burs', city: 'Burs' },
    { slug: 'lindgardensvardshus', name: 'Lindgårdens Värdshus', city: 'Visby' },
    { slug: 'hamnkrogenherrvik', name: 'Hamnkrogen Herrvik', city: 'Katthammarsvik' },
    { slug: 'herrviksbrygga.se', name: 'Herrviks Brygga', city: 'Katthammarsvik' },
    { slug: 'Bageri-Bosarve-1738259703136974', name: 'Bageri Bosarve', city: 'Gotland' },
    { slug: 'burgsviksbryggeri', name: 'Burgsviks Bryggeri', city: 'Burgsvik' },
    { slug: 'storakarlso', name: 'Stora Karlsö', city: 'Klintehamn' },
    { slug: 'sudersandsbion', name: 'Sudersandsbiografen', city: 'Fårö' },
    { slug: 'musikiruinen', name: 'Musik i ruinen', city: 'Visby' },
    { slug: 'stclemenskammarkoer', name: 'S:t Clemens kammarkör', city: 'Visby' },
    { slug: 'gotlandsmusiken', name: 'Gotlandsmusiken', city: 'Visby' },
    { slug: 'gotlandsmusikalkompani', name: 'Gotlands MusikalKompani', city: 'Visby' },
    { slug: 'fenomenalen', name: 'Fenomenalen Science Center', city: 'Visby' },
    { slug: 'almedalsbiblioteket', name: 'Almedalsbiblioteket', city: 'Visby' },
    { slug: 'kulturvard', name: 'Kulturvård, Campus Gotland', city: 'Visby' },
    { slug: 'gotlandslanshemslojdsforbund', name: 'Gotlands läns Hemslöjdsförbund', city: 'Visby' },
    { slug: 'hjartfabriken', name: 'Hjärtfabriken keramik', city: 'Gotland' },
    { slug: 'VisbyAIK', name: 'Visby AIK', city: 'Visby' },
    { slug: 'Ka3If', name: 'KA 3 IF', city: 'Fårösund' },
    { slug: 'WisbyHFS', name: 'Wisby Historiska Fäktskola', city: 'Visby' },
    { slug: 'V%C3%A4stergarn-P%C3%A4rk-Varpa-199651444269140', name: 'Västergarn Pärk & Varpa', city: 'Gotland' },
    { slug: 'paraglidingfriendsgotland', name: 'Paragliding Friends Gotland', city: 'Gotland' },
];
