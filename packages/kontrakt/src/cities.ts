/**
 * STADSLISTAN är kontrakt (flyttad hit från webbens cityUtils.ts, fas 2-stöd
 * 25/9): region-slugarna pekar ut appflödets lager (/api/events/app-<region>),
 * och appens regionval behöver samma lista som webben. cityUtils behåller
 * FUNKTIONERNA (slugify, closestCity …) och re-exporterar datat härifrån.
 *
 * OBS: scraperns appFeed regex-läser DEN HÄR filen som text (samma trick som
 * seed-venues-overpass — scrapern kan inte importera workspace-paket). Radernas
 * form { slug: '…', name: '…', lat: N, lng: N, region: '…' } är alltså ett
 * kontrakt i sig; scraperns test mot filen fångar drift.
 */
export interface City {
    slug: string;
    name: string;
    lat: number;
    lng: number;
    region: string;  // län
    population?: number;
}

export const CITIES: City[] = [
    // ─── 25 störst (~3.5M+ invånare totalt) ──────────────────────────────────
    { slug: 'stockholm',     name: 'Stockholm',     lat: 59.3293, lng: 18.0686, region: 'stockholm', population: 980000 },
    { slug: 'goteborg',      name: 'Göteborg',      lat: 57.7089, lng: 11.9746, region: 'vastra-gotaland', population: 590000 },
    { slug: 'malmo',         name: 'Malmö',         lat: 55.6049, lng: 13.0038, region: 'skane', population: 350000 },
    { slug: 'uppsala',       name: 'Uppsala',       lat: 59.8586, lng: 17.6389, region: 'uppsala', population: 240000 },
    { slug: 'vasteras',      name: 'Västerås',      lat: 59.6099, lng: 16.5448, region: 'vastmanland', population: 160000 },
    { slug: 'orebro',        name: 'Örebro',        lat: 59.2741, lng: 15.2066, region: 'orebro', population: 160000 },
    { slug: 'linkoping',     name: 'Linköping',     lat: 58.4108, lng: 15.6214, region: 'ostergotland', population: 165000 },
    { slug: 'helsingborg',   name: 'Helsingborg',   lat: 56.0465, lng: 12.6945, region: 'skane', population: 150000 },
    { slug: 'jonkoping',     name: 'Jönköping',     lat: 57.7826, lng: 14.1618, region: 'jonkoping', population: 145000 },
    { slug: 'norrkoping',    name: 'Norrköping',    lat: 58.5877, lng: 16.1924, region: 'ostergotland', population: 145000 },
    { slug: 'lund',          name: 'Lund',          lat: 55.7058, lng: 13.1932, region: 'skane', population: 130000 },
    { slug: 'umea',          name: 'Umeå',          lat: 63.8258, lng: 20.2630, region: 'vasterbotten', population: 135000 },
    { slug: 'gavle',         name: 'Gävle',         lat: 60.6749, lng: 17.1413, region: 'gavleborg', population: 105000 },
    { slug: 'boras',         name: 'Borås',         lat: 57.7210, lng: 12.9401, region: 'vastra-gotaland', population: 115000 },
    { slug: 'sodertalje',    name: 'Södertälje',    lat: 59.1955, lng: 17.6253, region: 'stockholm', population: 100000 },
    { slug: 'eskilstuna',    name: 'Eskilstuna',    lat: 59.3705, lng: 16.5092, region: 'sodermanland', population: 110000 },
    { slug: 'halmstad',      name: 'Halmstad',      lat: 56.6745, lng: 12.8578, region: 'halland', population: 105000 },
    { slug: 'sundsvall',     name: 'Sundsvall',     lat: 62.3908, lng: 17.3069, region: 'vasternorrland', population: 100000 },
    { slug: 'vaxjo',         name: 'Växjö',         lat: 56.8777, lng: 14.8094, region: 'kronoberg', population: 95000 },
    { slug: 'karlstad',      name: 'Karlstad',      lat: 59.3793, lng: 13.5036, region: 'varmland', population: 95000 },
    { slug: 'kristianstad',  name: 'Kristianstad',  lat: 56.0294, lng: 14.1567, region: 'skane', population: 85000 },
    { slug: 'lulea',         name: 'Luleå',         lat: 65.5848, lng: 22.1547, region: 'norrbotten', population: 80000 },
    { slug: 'molndal',       name: 'Mölndal',       lat: 57.6554, lng: 12.0140, region: 'vastra-gotaland', population: 70000 },
    { slug: 'kalmar',        name: 'Kalmar',        lat: 56.6634, lng: 16.3613, region: 'kalmar', population: 72000 },
    { slug: 'falun',         name: 'Falun',         lat: 60.6066, lng: 15.6355, region: 'dalarna', population: 60000 },
    // Andra med dedikerad källa eller hög event-volym
    { slug: 'skelleftea',    name: 'Skellefteå',    lat: 64.7507, lng: 20.9528, region: 'vasterbotten', population: 75000 },
    { slug: 'karlskrona',    name: 'Karlskrona',    lat: 56.1612, lng: 15.5869, region: 'blekinge', population: 67000 },
    { slug: 'trollhattan',   name: 'Trollhättan',   lat: 58.2837, lng: 12.2886, region: 'vastra-gotaland', population: 60000 },
    { slug: 'ostersund',     name: 'Östersund',     lat: 63.1792, lng: 14.6357, region: 'jamtland', population: 50000 },
    { slug: 'uddevalla',     name: 'Uddevalla',     lat: 58.3498, lng: 11.9419, region: 'vastra-gotaland', population: 56000 },
    { slug: 'borlange',      name: 'Borlänge',      lat: 60.4858, lng: 15.4371, region: 'dalarna', population: 53000 },
    { slug: 'motala',        name: 'Motala',        lat: 58.5371, lng: 15.0366, region: 'ostergotland', population: 45000 },
    { slug: 'landskrona',    name: 'Landskrona',    lat: 55.8703, lng: 12.8307, region: 'skane', population: 47000 },
    { slug: 'nykoping',      name: 'Nyköping',      lat: 58.7531, lng: 17.0085, region: 'sodermanland', population: 60000 },
    { slug: 'falkenberg',    name: 'Falkenberg',    lat: 56.9055, lng: 12.4912, region: 'halland', population: 47000 },
    { slug: 'alingsas',      name: 'Alingsås',      lat: 57.9295, lng: 12.5333, region: 'vastra-gotaland', population: 43000 },
    { slug: 'pitea',         name: 'Piteå',         lat: 65.3170, lng: 21.4795, region: 'norrbotten', population: 43000 },
    { slug: 'katrineholm',   name: 'Katrineholm',   lat: 58.9967, lng: 16.2089, region: 'sodermanland', population: 35000 },
    { slug: 'karlshamn',     name: 'Karlshamn',     lat: 56.1706, lng: 14.8630, region: 'blekinge', population: 32000 },
    { slug: 'monsteras',     name: 'Mönsterås',     lat: 57.0394, lng: 16.4421, region: 'kalmar', population: 13000 },
    // Efterfrågad av medlem vid registrering (12/9) — listan är också konto-
    // väljarens städer (AuthModal/ProfilePanel), inte bara segmentering.
    { slug: 'leksand',       name: 'Leksand',       lat: 60.7305, lng: 14.9970, region: 'dalarna', population: 16000 },
    // ─── Alla orter med stadssida (webbens utils/cityPages) — 30/9 ──────────
    // En Tranåsbo hittade inte sin ort vid registreringen, fast Tranås har en
    // egen stadssida; närmaste i listan låg 56 km bort, och helgtipset räknar
    // bara event inom 10 km. Varje stadssida ska gå att välja som ort — web-
    // testet cityPagesCoverage vaktar det. Koordinater + folkmängd därifrån.
    { slug: 'visby',         name: 'Visby',         lat: 57.64, lng: 18.30, region: 'gotland', population: 61000 },
    { slug: 'skovde',        name: 'Skövde',        lat: 58.39, lng: 13.85, region: 'vastra-gotaland', population: 58000 },
    { slug: 'kungsbacka',    name: 'Kungsbacka',    lat: 57.49, lng: 12.08, region: 'halland', population: 87000 },
    { slug: 'varberg',       name: 'Varberg',       lat: 57.11, lng: 12.25, region: 'halland', population: 67000 },
    { slug: 'norrtalje',     name: 'Norrtälje',     lat: 59.76, lng: 18.70, region: 'stockholm', population: 65000 },
    { slug: 'marsta',        name: 'Märsta',        lat: 59.62, lng: 17.86, region: 'stockholm', population: 51000 },
    { slug: 'akersberga',    name: 'Åkersberga',    lat: 59.48, lng: 18.30, region: 'stockholm', population: 48000 },
    { slug: 'upplands-vasby', name: 'Upplands Väsby', lat: 59.52, lng: 17.91, region: 'stockholm', population: 48000 },
    { slug: 'enkoping',      name: 'Enköping',      lat: 59.64, lng: 17.08, region: 'uppsala', population: 48000 },
    { slug: 'angelholm',     name: 'Ängelholm',     lat: 56.25, lng: 12.86, region: 'skane', population: 44000 },
    { slug: 'strangnas',     name: 'Strängnäs',     lat: 59.38, lng: 17.03, region: 'sodermanland', population: 40000 },
    { slug: 'vastervik',     name: 'Västervik',     lat: 57.76, lng: 16.64, region: 'kalmar', population: 37000 },
    { slug: 'kinna',         name: 'Kinna',         lat: 57.51, lng: 12.69, region: 'vastra-gotaland', population: 35000 },
    { slug: 'varnamo',       name: 'Värnamo',       lat: 57.19, lng: 14.04, region: 'jonkoping', population: 35000 },
    { slug: 'vallentuna',    name: 'Vallentuna',    lat: 59.53, lng: 18.08, region: 'stockholm', population: 34000 },
    { slug: 'nodinge',       name: 'Nödinge',       lat: 57.90, lng: 12.05, region: 'vastra-gotaland', population: 33000 },
    { slug: 'kungsangen',    name: 'Kungsängen',    lat: 59.48, lng: 17.75, region: 'stockholm', population: 32000 },
    { slug: 'ystad',         name: 'Ystad',         lat: 55.43, lng: 13.82, region: 'skane', population: 31000 },
    { slug: 'ljungby',       name: 'Ljungby',       lat: 56.83, lng: 13.94, region: 'kronoberg', population: 29000 },
    { slug: 'stenungsund',   name: 'Stenungsund',   lat: 58.07, lng: 11.82, region: 'vastra-gotaland', population: 27000 },
    { slug: 'laholm',        name: 'Laholm',        lat: 56.51, lng: 13.04, region: 'halland', population: 26000 },
    { slug: 'arvika',        name: 'Arvika',        lat: 59.65, lng: 12.59, region: 'varmland', population: 25000 },
    { slug: 'osthammar',     name: 'Östhammar',     lat: 60.26, lng: 18.37, region: 'uppsala', population: 22000 },
    { slug: 'sjobo',         name: 'Sjöbo',         lat: 55.63, lng: 13.70, region: 'skane', population: 20000 },
    { slug: 'tranas',        name: 'Tranås',        lat: 58.03, lng: 14.98, region: 'jonkoping', population: 19000 },
    { slug: 'almhult',       name: 'Älmhult',       lat: 56.55, lng: 14.14, region: 'kronoberg', population: 18000 },
    { slug: 'hoor',          name: 'Höör',          lat: 55.93, lng: 13.54, region: 'skane', population: 17000 },
    { slug: 'solvesborg',    name: 'Sölvesborg',    lat: 56.05, lng: 14.58, region: 'blekinge', population: 17000 },
    { slug: 'vimmerby',      name: 'Vimmerby',      lat: 57.67, lng: 15.86, region: 'kalmar', population: 15000 },
    { slug: 'saffle',        name: 'Säffle',        lat: 59.13, lng: 12.92, region: 'varmland', population: 15000 },
    { slug: 'trosa',         name: 'Trosa',         lat: 58.90, lng: 17.55, region: 'sodermanland', population: 14000 },
    { slug: 'arboga',        name: 'Arboga',        lat: 59.39, lng: 15.84, region: 'vastmanland', population: 14000 },
    { slug: 'olofstrom',     name: 'Olofström',     lat: 56.28, lng: 14.53, region: 'blekinge', population: 13000 },
    { slug: 'borgholm',      name: 'Borgholm',      lat: 56.88, lng: 16.66, region: 'kalmar', population: 11000 },
    { slug: 'markaryd',      name: 'Markaryd',      lat: 56.46, lng: 13.60, region: 'kronoberg', population: 10000 },
    { slug: 'mullsjo',       name: 'Mullsjö',       lat: 57.92, lng: 13.88, region: 'jonkoping', population: 7000 },
];

export const CITY_BY_SLUG = new Map(CITIES.map(c => [c.slug, c]));
