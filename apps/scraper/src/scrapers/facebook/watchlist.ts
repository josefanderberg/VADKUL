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
    /** Geokodningshint. Utelämnad → geokodningen skannar eventadressen. */
    city?: string;
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
    // Egen förfrågan i FB-kommentar 2026-07-27 ("lägg gärna till våra
    // konserter"). Sid-slug = numeriskt ID (ingen vanity-URL). Events-fliken
    // visade 0 publika event vid inläggning — deras konserter flödar redan
    // via gotland.com-källan; bevakningen fångar framtida FB-event.
    { slug: '375356275853238', name: 'Roma Kungsgård (Föreningen Roma Kungsgårds framtid)', city: 'Romakloster' },
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

    // ── Norrköping (maxningen 2026-08-09) ───────────────────────────────
    // Alla verifierade headless 2026-08-09: sidan finns + /events-fliken
    // visar eventlänkar utloggat. Urvalet är komplementet till den nya
    // 'visit-norrkoping'-källan (kommunens evenemangskalender, 356 event):
    // BARA arrangörer vars utbud INTE når turistkalendern. Medvetet EJ med
    // trots publika event — Augustifesten (45 träffar i visit-källan),
    // Kulturnatten (17), Östgötateatern (6), Arbetets museum,
    // Visualiseringscenter C, stadsmuseet — de dubblerar bara.
    // Norrköping Dolphins provades på båda slug-varianterna: 0 publika event.
    { slug: 'palacenorrkoping', name: 'Palace Norrköping', city: 'Norrköping' },      // nattklubb
    { slug: 'harrysnorrkoping', name: 'Harrys Norrköping', city: 'Norrköping' },      // pub/livemusik
    { slug: 'knappingsborg', name: 'Knäppingsborg', city: 'Norrköping' },             // kvarter, mat/marknad
    { slug: 'ingelstashopping', name: 'Ingelsta shopping', city: 'Norrköping' },
    { slug: 'ifknorrkoping', name: 'IFK Norrköping', city: 'Norrköping' },            // allsvenskan
    { slug: 'vitahasten', name: 'Vita Hästen', city: 'Norrköping' },                  // hockeyallsvenskan
    { slug: 'kolmarden', name: 'Kolmårdens djurpark', city: 'Kolmården' },
];
