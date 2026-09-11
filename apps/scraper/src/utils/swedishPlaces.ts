/**
 * Svenska ortnamn — delade mellan FB-skrapan och nattvakterna.
 *
 * FB_SEARCH_CITIES är orterna FB-stadssöket frågar efter (`/events/search/?q=<ort>`).
 * Flyttad hit ur scrapers/facebook/index.ts 2026-09-11 så att nattvakten
 * (scripts/hide-foreign-misclassified.ts) känner igen samma orter — även de små
 * som SWEDISH_GEO_CITIES saknar (Strömstad, Sala, Mora …).
 */
import { SWEDISH_GEO_CITIES } from './venueCoordinates';
import { mentionsPlace } from './eventLanguage';

// Svenska städer — täcker 260+ orter för bred lokal spridning
export const FB_SEARCH_CITIES: readonly string[] = [
    // Topp 30 städer
    'Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Linköping',
    'Örebro', 'Helsingborg', 'Norrköping', 'Jönköping', 'Umeå',
    'Lund', 'Västerås', 'Sundsvall', 'Karlstad', 'Växjö', 'Gävle',
    'Borås', 'Eskilstuna', 'Halmstad', 'Östersund', 'Kalmar',
    'Trollhättan', 'Luleå', 'Skellefteå', 'Kristianstad', 'Falun',
    'Karlskrona', 'Skövde', 'Motala', 'Nyköping',
    // Nästa våg av städer
    'Örnsköldsvik', 'Varberg', 'Visby', 'Lidköping', 'Alingsås',
    'Borlänge', 'Trelleborg', 'Ystad', 'Västervik', 'Katrineholm',
    'Norrtälje', 'Enköping', 'Hässleholm', 'Piteå', 'Karlskoga',
    'Värnamo', 'Uddevalla', 'Kungsbacka', 'Falkenberg', 'Ängelholm',
    'Landskrona', 'Karlshamn', 'Ronneby', 'Oskarshamn', 'Vetlanda',
    'Nässjö', 'Tranås', 'Ljungby', 'Arvika', 'Kristinehamn',
    // Fler expansiva orter
    'Mariestad', 'Kumla', 'Hallsberg', 'Köping', 'Sala',
    'Fagersta', 'Ludvika', 'Mora', 'Sandviken', 'Bollnäs',
    'Söderhamn', 'Hudiksvall', 'Härnösand', 'Sollefteå', 'Kramfors',
    'Boden', 'Kiruna', 'Gällivare', 'Lycksele', 'Åre',
    // Skåne & Halland orter
    'Eslöv', 'Staffanstorp', 'Kävlinge', 'Vellinge', 'Höganäs',
    'Bromölla', 'Skanör', 'Falsterbo', 'Sjöbo', 'Simrishamn',
    'Laholm', 'Onsala', 'Åsa', 'Båstad',
    // Småland & Blekinge orter
    'Eksjö', 'Vimmerby', 'Hultsfred', 'Nybro', 'Sölvesborg',
    'Olofström', 'Lessebo', 'Alvesta', 'Tingsryd', 'Älmhult',
    // Mellansverige orter
    'Finspång', 'Mjölby', 'Söderköping', 'Åtvidaberg', 'Trosa',
    'Strängnäs', 'Flen', 'Nora', 'Lindesberg',

    // === UTÖKNING: ~150 nya orter för lokal täckning ===

    // Stockholmsregionen (förorter med stor befolkning)
    'Södertälje', 'Nacka', 'Huddinge', 'Järfälla', 'Botkyrka',
    'Haninge', 'Tyresö', 'Täby', 'Solna', 'Sundbyberg',
    'Upplands-Väsby', 'Lidingö', 'Sollentuna', 'Vallentuna',
    'Ekerö', 'Österåker', 'Salem', 'Sigtuna', 'Vaxholm', 'Nynäshamn',
    'Knivsta', 'Håbo', 'Upplands-Bro', 'Nykvarn',

    // Västra Götaland (kompletterande orter)
    'Mölndal', 'Lerum', 'Kungälv', 'Stenungsund', 'Vänersborg',
    'Ulricehamn', 'Falköping', 'Tidaholm', 'Kinna', 'Åmål',
    'Lysekil', 'Kungshamn', 'Munkedal', 'Skara', 'Tibro',
    'Hjo', 'Töreboda', 'Karlsborg', 'Tranemo', 'Bollebygd',
    'Nödinge', 'Herrljunga', 'Svenljunga', 'Vara', 'Grästorp',

    // Skåne (kompletterande orter)
    'Tomelilla', 'Skurup', 'Svedala', 'Höör', 'Hörby',
    'Örkelljunga', 'Osby', 'Perstorp', 'Klippan', 'Bjuv',
    'Burlöv', 'Åstorp',

    // Dalarna
    'Avesta', 'Hedemora', 'Rättvik', 'Leksand', 'Malung',
    'Säter', 'Orsa', 'Smedjebacken', 'Vansbro', 'Älvdalen',

    // Gästrikland & Hälsingland
    'Ockelbo', 'Hofors', 'Ljusdal', 'Ovanåker',

    // Västernorrland tillägg
    'Ånge', 'Timrå',

    // Jämtland tillägg
    'Strömsund', 'Krokom', 'Bräcke',

    // Norrbotten tillägg
    'Haparanda', 'Kalix', 'Arvidsjaur', 'Arjeplog', 'Jokkmokk',
    'Pajala', 'Överkalix', 'Övertorneå',

    // Västerbotten tillägg
    'Vilhelmina', 'Storuman', 'Vindeln', 'Robertsfors', 'Nordmaling',

    // Värmland tillägg
    'Sunne', 'Torsby', 'Säffle', 'Hagfors', 'Filipstad',
    'Hammarö', 'Kil', 'Munkfors',

    // Örebro tillägg
    'Askersund', 'Laxå', 'Degerfors',

    // Halland tillägg
    'Hyltebruk',

    // Småland tillägg
    'Vaggeryd', 'Gislaved', 'Gnosjö', 'Mullsjö', 'Aneby',
    'Markaryd', 'Emmaboda', 'Borgholm', 'Mönsterås', 'Torsås',

    // Östergötland tillägg
    'Vadstena', 'Valdemarsvik', 'Boxholm',

    // Södermanland tillägg
    'Gnesta', 'Oxelösund', 'Vingåker',

    // Uppland tillägg
    'Tierp', 'Rimbo',

    // Västra Götaland (kustorter & inland)
    'Strömstad', 'Tanum', 'Bengtsfors', 'Färgelanda', 'Dals-Ed',
    'Essunga', 'Götene', 'Mellerud',

    // Skåne (kranskommun Malmö)
    'Lomma',

    // Östergötland
    'Kinda', 'Ydre',

    // Västmanland tillägg
    'Norberg', 'Surahammar', 'Arboga',

    // Värmland tillägg
    'Storfors', 'Grums',

    // Jämtland / Västernorrland tillägg
    'Berg', 'Dorotea',

    // Västerbotten tillägg
    'Bjurholm', 'Malå',

    // Norrbotten: ytterligare orter
    'Älvsbyn',

    // Gotland-maxning 2026-07-27: hela ön, inte bara Visby.
    // 'Gotland' fångar öbrett taggade event; orterna fångar landsbygden.
    // OBS: Roma medvetet utelämnad som sökord (FB-brus från Rom/AS Roma) —
    // Romakloster täcker samma geografi.
    'Gotland', 'Hemse', 'Slite', 'Klintehamn', 'Fårösund',
    'Ljugarn', 'Burgsvik', 'Katthammarsvik', 'Lärbro', 'Stånga',
    'Havdhem', 'Tingstäde', 'Romakloster', 'Fårö',
];

/**
 * Svenska ortnamn som stavas exakt som vanliga ord eller orter utomlands.
 * FB-söket på dem ger världen över-träffar ("Sala" = sal på spanska/
 * italienska/rumänska, "Vara" = sommar på rumänska och ort på Azorerna,
 * "Boden" = mark på tyska, "Mora"/"Salem" i Ungern/USA, "Berg" på tyska/
 * nederländska, norska "sunne"/"åre"). En träff på namnet är därför INTE bevis
 * för att eventet är i Sverige. Accentade namn (Fårö, Malå, Ånge) behövs inte
 * här — utländska Faro/Mala/Ange stavas annorlunda och fångas av exakt jämförelse.
 */
export const AMBIGUOUS_PLACE_NAMES: ReadonlySet<string> = new Set([
    'Sala', 'Mora', 'Vara', 'Berg', 'Boden', 'Salem', 'Nora', 'Orsa', 'Kinda',
    'Kil', 'Åsa', 'Sunne', 'Åre', 'Tanum', 'Tibro',
]);

const ALL_PLACES = [...new Set([...SWEDISH_GEO_CITIES, ...FB_SEARCH_CITIES])];
const UNAMBIGUOUS_PLACES = ALL_PLACES.filter((p) => !AMBIGUOUS_PLACE_NAMES.has(p));

/**
 * Nämner texten en ENTYDIGT svensk ort (som eget ord; norsk/dansk stavning
 * och genitiv-s räknas, se mentionsPlace)? Tvetydiga namn (Sala, Mora …)
 * räknas inte — de är just det FB-söket blandar ihop med utlandet.
 */
export function mentionsSwedishPlace(text: string): boolean {
    return UNAMBIGUOUS_PLACES.some((p) => mentionsPlace(text, p));
}
