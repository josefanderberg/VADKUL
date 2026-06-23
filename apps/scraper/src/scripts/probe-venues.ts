/**
 * Venue-sitemap-probe — testar en handkurerad lista av svenska
 * venues (teatrar, museer, arenor, konserthus, festivaler, regioner,
 * studieförbund) mot samma sitemap-mönster som probe-sitemap.ts.
 *
 *   npm run probe-venues
 *   npm run probe-venues -- --threshold=5 --concurrency=16 --filter=teater
 *
 * Output: kopierbar Source-config för registry.ts.
 */

import * as zlib from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);

interface Venue {
    name: string;
    domain: string;     // utan protokoll
    region?: string;
    city?: string;
    kind?: string;      // 'teater' | 'museum' | 'arena' | 'konserthus' | 'festival' | 'studieforbund' | 'venue'
}

// ─── KANDIDATER ───────────────────────────────────────────────────────────
// Endast venues vi INTE redan har i registry.ts. Sortera grovt på sannolikhet.
const VENUES: Venue[] = [
    // ─── Stora museer (Stockholm) ─────────────────────────────────────────
    { name: 'Nationalmuseum',          domain: 'nationalmuseum.se',     region: 'stockholm', city: 'Stockholm', kind: 'museum' },
    { name: 'Moderna Museet',          domain: 'modernamuseet.se',      region: 'stockholm', city: 'Stockholm', kind: 'museum' },
    { name: 'Nordiska Museet',         domain: 'nordiskamuseet.se',     region: 'stockholm', city: 'Stockholm', kind: 'museum' },
    { name: 'Vasamuseet',              domain: 'vasamuseet.se',         region: 'stockholm', city: 'Stockholm', kind: 'museum' },
    { name: 'Naturhistoriska Riksmuseet', domain: 'nrm.se',             region: 'stockholm', city: 'Stockholm', kind: 'museum' },
    { name: 'Historiska Museet',       domain: 'historiska.se',         region: 'stockholm', city: 'Stockholm', kind: 'museum' },
    { name: 'Östasiatiska Museet',     domain: 'ostasiatiskamuseet.se', region: 'stockholm', city: 'Stockholm', kind: 'museum' },
    { name: 'Medelhavsmuseet',         domain: 'medelhavsmuseet.se',    region: 'stockholm', city: 'Stockholm', kind: 'museum' },
    { name: 'Världskulturmuseerna',    domain: 'varldskulturmuseerna.se', region: 'national', kind: 'museum' },
    { name: 'Fotografiska',            domain: 'fotografiska.com',      region: 'stockholm', city: 'Stockholm', kind: 'museum' },
    { name: 'Spritmuseum',             domain: 'spritmuseum.se',        region: 'stockholm', city: 'Stockholm', kind: 'museum' },
    { name: 'ABBA The Museum',         domain: 'abbathemuseum.com',     region: 'stockholm', city: 'Stockholm', kind: 'museum' },
    { name: 'Junibacken',              domain: 'junibacken.se',         region: 'stockholm', city: 'Stockholm', kind: 'amusement' },
    { name: 'Skansen',                 domain: 'skansen.se',            region: 'stockholm', city: 'Stockholm', kind: 'amusement' },
    { name: 'Bonniers Konsthall',      domain: 'bonnierskonsthall.se',  region: 'stockholm', city: 'Stockholm', kind: 'museum' },
    { name: 'Magasin III',             domain: 'magasin3.com',          region: 'stockholm', city: 'Stockholm', kind: 'museum' },
    { name: 'Millesgården',            domain: 'millesgarden.se',       region: 'stockholm', city: 'Lidingö', kind: 'museum' },
    { name: 'Artipelag',               domain: 'artipelag.se',          region: 'stockholm', city: 'Värmdö', kind: 'museum' },
    { name: 'Prins Eugens Waldemarsudde', domain: 'waldemarsudde.se',   region: 'stockholm', city: 'Stockholm', kind: 'museum' },
    { name: 'Sven-Harrys',             domain: 'sven-harrys.se',        region: 'stockholm', city: 'Stockholm', kind: 'museum' },

    // ─── Museer (Göteborg/Malmö/övriga) ──────────────────────────────────
    { name: 'Göteborgs Konstmuseum',   domain: 'goteborgskonstmuseum.se', region: 'goteborg', city: 'Göteborg', kind: 'museum' },
    { name: 'Världskulturmuseet',      domain: 'varldskulturmuseet.se', region: 'goteborg', city: 'Göteborg', kind: 'museum' },
    { name: 'Universeum',              domain: 'universeum.se',         region: 'goteborg', city: 'Göteborg', kind: 'museum' },
    { name: 'Göteborgs Stadsmuseum',   domain: 'goteborgsstadsmuseum.se', region: 'goteborg', city: 'Göteborg', kind: 'museum' },
    { name: 'Sjöfartsmuseet Akvariet', domain: 'sjofartsmuseet.goteborg.se', region: 'goteborg', city: 'Göteborg', kind: 'museum' },
    { name: 'Röhsska Museet',          domain: 'rohsska.se',            region: 'goteborg', city: 'Göteborg', kind: 'museum' },
    { name: 'Malmö Konsthall',         domain: 'malmokonsthall.se',     region: 'malmo', city: 'Malmö', kind: 'museum' },
    { name: 'Malmö Konstmuseum',       domain: 'malmokonstmuseum.se',   region: 'malmo', city: 'Malmö', kind: 'museum' },
    { name: 'Malmö Museer',            domain: 'malmo.se/museer',       region: 'malmo', city: 'Malmö', kind: 'museum' },
    { name: 'Form/Design Center',      domain: 'formdesigncenter.com',  region: 'malmo', city: 'Malmö', kind: 'museum' },
    { name: 'Moderna Museet Malmö',    domain: 'modernamuseet.se/malmo', region: 'malmo', city: 'Malmö', kind: 'museum' },

    // ─── Teatrar ─────────────────────────────────────────────────────────
    { name: 'Dramaten',                domain: 'dramaten.se',           region: 'stockholm', city: 'Stockholm', kind: 'teater' },
    { name: 'Kungliga Operan',         domain: 'operan.se',             region: 'stockholm', city: 'Stockholm', kind: 'teater' },
    { name: 'Kulturhuset Stadsteatern', domain: 'kulturhusetstadsteatern.se', region: 'stockholm', city: 'Stockholm', kind: 'teater' },
    { name: 'Stockholms Stadsteater',  domain: 'stadsteatern.stockholm.se', region: 'stockholm', city: 'Stockholm', kind: 'teater' },
    { name: 'Göta Lejon',              domain: 'gotalejon.se',          region: 'stockholm', city: 'Stockholm', kind: 'teater' },
    { name: 'China Teatern',           domain: 'chinateatern.se',       region: 'stockholm', city: 'Stockholm', kind: 'teater' },
    { name: 'Vasateatern',             domain: 'vasateatern.se',        region: 'stockholm', city: 'Stockholm', kind: 'teater' },
    { name: 'Maximteatern',            domain: 'maximteatern.se',       region: 'stockholm', city: 'Stockholm', kind: 'teater' },
    { name: 'Oscarsteatern',           domain: 'oscarsteatern.se',      region: 'stockholm', city: 'Stockholm', kind: 'teater' },
    { name: 'Intiman',                 domain: 'intiman.com',           region: 'stockholm', city: 'Stockholm', kind: 'teater' },
    { name: 'Cirkusbyggnaden',         domain: 'cirkusbyggnaden.se',    region: 'stockholm', city: 'Stockholm', kind: 'teater' },
    { name: 'Folkoperan',              domain: 'folkoperan.se',         region: 'stockholm', city: 'Stockholm', kind: 'teater' },
    { name: 'Orionteatern',            domain: 'orionteatern.se',       region: 'stockholm', city: 'Stockholm', kind: 'teater' },
    { name: 'Göteborgs Stadsteater',   domain: 'stadsteatern.goteborg.se', region: 'goteborg', city: 'Göteborg', kind: 'teater' },
    { name: 'Göteborgsoperan',         domain: 'opera.se',              region: 'goteborg', city: 'Göteborg', kind: 'teater' },
    { name: 'Lorensbergsteatern',      domain: 'lorensbergsteatern.se', region: 'goteborg', city: 'Göteborg', kind: 'teater' },
    { name: 'Hagateatern',             domain: 'hagateatern.se',        region: 'goteborg', city: 'Göteborg', kind: 'teater' },
    { name: 'Backa Teater',            domain: 'backateater.se',        region: 'goteborg', city: 'Göteborg', kind: 'teater' },
    { name: 'Folkteatern Göteborg',    domain: 'folkteatern.se',        region: 'goteborg', city: 'Göteborg', kind: 'teater' },
    { name: 'Angereds Teater',         domain: 'angeredsteater.se',     region: 'goteborg', city: 'Göteborg', kind: 'teater' },
    { name: 'Malmö Opera',             domain: 'malmoopera.se',         region: 'malmo', city: 'Malmö', kind: 'teater' },
    { name: 'Malmö Stadsteater',       domain: 'malmostadsteater.se',   region: 'malmo', city: 'Malmö', kind: 'teater' },
    { name: 'Skånes Dansteater',       domain: 'skanesdansteater.se',   region: 'malmo', city: 'Malmö', kind: 'teater' },
    { name: 'Norrlandsoperan',         domain: 'norrlandsoperan.se',    region: 'umea', city: 'Umeå', kind: 'teater' },
    { name: 'Norrbottensteatern',      domain: 'norrbottensteatern.se', region: 'lulea', city: 'Luleå', kind: 'teater' },
    { name: 'Västerbottensteatern',    domain: 'vasterbottensteatern.se', region: 'skelleftea', city: 'Skellefteå', kind: 'teater' },
    { name: 'Östgötateatern',          domain: 'ostgotateatern.se',     region: 'norrkoping', city: 'Norrköping', kind: 'teater' },
    { name: 'Regionteater Väst',       domain: 'regionteatervast.se',   region: 'goteborg', kind: 'teater' },
    { name: 'Riksteatern',             domain: 'riksteatern.se',        region: 'national', kind: 'teater' },
    { name: 'Folkets Hus och Parker',  domain: 'folketshusochparker.se', region: 'national', kind: 'venue' },

    // ─── Konserthus ──────────────────────────────────────────────────────
    { name: 'Konserthuset Stockholm',  domain: 'konserthuset.se',       region: 'stockholm', city: 'Stockholm', kind: 'konserthus' },
    { name: 'Berwaldhallen',           domain: 'berwaldhallen.se',      region: 'stockholm', city: 'Stockholm', kind: 'konserthus' },
    { name: 'Göteborgs Konserthus',    domain: 'konserthuset.goteborg.se', region: 'goteborg', city: 'Göteborg', kind: 'konserthus' },
    { name: 'Malmö Live',              domain: 'malmolive.se',          region: 'malmo', city: 'Malmö', kind: 'konserthus' },
    { name: 'Helsingborgs Konserthus', domain: 'helsingborgskonserthus.se', region: 'helsingborg', city: 'Helsingborg', kind: 'konserthus' },
    { name: 'Uppsala Konsert & Kongress', domain: 'ukk.se',             region: 'uppsala', city: 'Uppsala', kind: 'konserthus' },
    { name: 'Vara Konserthus',         domain: 'varakonserthus.se',     region: 'vara', city: 'Vara', kind: 'konserthus' },
    { name: 'Linköpings Konsert & Kongress', domain: 'konsertkongress.se', region: 'linkoping', city: 'Linköping', kind: 'konserthus' },
    { name: 'Spira Jönköping',         domain: 'kulturhusetspira.se',   region: 'jonkoping', city: 'Jönköping', kind: 'konserthus' },
    { name: 'Gävle Konserthus',        domain: 'gavlekonserthus.se',    region: 'gavle', city: 'Gävle', kind: 'konserthus' },
    { name: 'Konserthuset Karlstad',   domain: 'karlstadcongressculture.se', region: 'karlstad', city: 'Karlstad', kind: 'konserthus' },

    // ─── Arenor ──────────────────────────────────────────────────────────
    { name: 'Avicii Arena',            domain: 'aviciiarena.se',        region: 'stockholm', city: 'Stockholm', kind: 'arena' },
    { name: 'Friends Arena',           domain: 'friendsarena.se',       region: 'stockholm', city: 'Solna', kind: 'arena' },
    { name: 'Tele2 Arena',             domain: 'tele2arena.se',         region: 'stockholm', city: 'Stockholm', kind: 'arena' },
    { name: 'Hovet',                   domain: 'hovet.se',              region: 'stockholm', city: 'Stockholm', kind: 'arena' },
    { name: 'Annexet',                 domain: 'annexet.se',            region: 'stockholm', city: 'Stockholm', kind: 'arena' },
    { name: 'Scandinavium',            domain: 'scandinavium.se',       region: 'goteborg', city: 'Göteborg', kind: 'arena' },
    { name: 'Ullevi',                  domain: 'ullevi.se',             region: 'goteborg', city: 'Göteborg', kind: 'arena' },
    { name: 'Frölundaborg',            domain: 'frolundaborg.se',       region: 'goteborg', city: 'Göteborg', kind: 'arena' },
    { name: 'Partille Arena',          domain: 'partillearena.se',      region: 'partille', city: 'Partille', kind: 'arena' },
    { name: 'Saab Arena',              domain: 'saabarena.com',         region: 'linkoping', city: 'Linköping', kind: 'arena' },
    { name: 'Malmö Arena',             domain: 'malmoarena.com',        region: 'malmo', city: 'Malmö', kind: 'arena' },
    { name: 'Husqvarna Garden',        domain: 'husqvarnagarden.se',    region: 'jonkoping', city: 'Jönköping', kind: 'arena' },
    { name: 'Coop Norrbotten Arena',   domain: 'coopnorrbottenarena.se', region: 'lulea', city: 'Luleå', kind: 'arena' },
    { name: 'Vida Arena',              domain: 'vidaarena.se',          region: 'vaxjo', city: 'Växjö', kind: 'arena' },
    { name: 'Behrn Arena',             domain: 'behrnarena.se',         region: 'orebro', city: 'Örebro', kind: 'arena' },
    { name: 'Sparbanken Lidköping Arena', domain: 'sparbankenlidkopingarena.se', region: 'lidkoping', city: 'Lidköping', kind: 'arena' },

    // ─── Festivaler ──────────────────────────────────────────────────────
    { name: 'Way Out West',            domain: 'wayoutwest.se',         region: 'goteborg', city: 'Göteborg', kind: 'festival' },
    { name: 'Sweden Rock',             domain: 'swedenrock.com',        region: 'solvesborg', city: 'Sölvesborg', kind: 'festival' },
    { name: 'Summerburst',             domain: 'summerburst.se',        region: 'goteborg', city: 'Göteborg', kind: 'festival' },
    { name: 'Brännbollsyran',          domain: 'brannbollsyran.se',     region: 'umea', city: 'Umeå', kind: 'festival' },
    { name: 'Göteborgs Kulturkalas',   domain: 'kulturkalaset.se',      region: 'goteborg', city: 'Göteborg', kind: 'festival' },
    { name: 'Putte i Parken',          domain: 'putteiparken.se',       region: 'karlstad', city: 'Karlstad', kind: 'festival' },
    { name: 'Storsjöyran',             domain: 'storsjoyran.se',        region: 'ostersund', city: 'Östersund', kind: 'festival' },
    { name: 'Diggiloo',                domain: 'diggiloo.se',           region: 'national', kind: 'festival' },
    { name: 'Furuviksparken',          domain: 'furuvik.se',            region: 'gavle', city: 'Gävle', kind: 'amusement' },
    { name: 'Liseberg',                domain: 'liseberg.se',           region: 'goteborg', city: 'Göteborg', kind: 'venue' },
    { name: 'Gröna Lund',              domain: 'gronalund.com',         region: 'stockholm', city: 'Stockholm', kind: 'amusement' },
    { name: 'Skara Sommarland',        domain: 'sommarland.se',         region: 'skara', city: 'Skara', kind: 'amusement' },

    // ─── Studieförbund (riks) ────────────────────────────────────────────
    { name: 'ABF',                     domain: 'abf.se',                region: 'national', kind: 'studieforbund' },
    { name: 'Folkuniversitetet',       domain: 'folkuniversitetet.se',  region: 'national', kind: 'studieforbund' },
    { name: 'Medborgarskolan',         domain: 'medborgarskolan.se',    region: 'national', kind: 'studieforbund' },
    { name: 'Sensus',                  domain: 'sensus.se',             region: 'national', kind: 'studieforbund' },
    { name: 'Studieförbundet Vuxenskolan', domain: 'sv.se',             region: 'national', kind: 'studieforbund' },
    { name: 'Ibn Rushd',               domain: 'ibnrushd.se',           region: 'national', kind: 'studieforbund' },
    { name: 'Kulturens Bildningsverksamhet', domain: 'kulturens.se',    region: 'national', kind: 'studieforbund' },

    // ─── Konsthallar / övriga venues ─────────────────────────────────────
    { name: 'Färgfabriken',            domain: 'fargfabriken.se',       region: 'stockholm', city: 'Stockholm', kind: 'museum' },
    { name: 'Tensta Konsthall',        domain: 'tenstakonsthall.se',    region: 'stockholm', city: 'Stockholm', kind: 'museum' },
    { name: 'Index',                   domain: 'indexfoundation.se',    region: 'stockholm', city: 'Stockholm', kind: 'museum' },
    { name: 'Marabouparken',           domain: 'marabouparken.se',      region: 'stockholm', city: 'Sundbyberg', kind: 'museum' },
    { name: 'Färgateljén',             domain: 'fargateljen.se',        region: 'stockholm', city: 'Stockholm', kind: 'museum' },
    { name: 'Boras Konstmuseum',       domain: 'boraskonstmuseum.se',   region: 'boras', city: 'Borås', kind: 'museum' },
    { name: 'Norrköpings Konstmuseum', domain: 'norrkopingskonstmuseum.se', region: 'norrkoping', city: 'Norrköping', kind: 'museum' },
    { name: 'Bildmuseet Umeå',         domain: 'bildmuseet.umu.se',     region: 'umea', city: 'Umeå', kind: 'museum' },
    { name: 'Havremagasinet',          domain: 'havremagasinet.se',     region: 'boden', city: 'Boden', kind: 'museum' },
    { name: 'Picasso Lund',            domain: 'sparbankspilot.se',     region: 'lund', city: 'Lund', kind: 'venue' },

    // ─── Övrigt — bibliotek, hus, gallerier ──────────────────────────────
    { name: 'Stockholms Stadsbibliotek', domain: 'biblioteket.stockholm.se', region: 'stockholm', city: 'Stockholm', kind: 'bibliotek' },
    { name: 'Göteborgs Stadsbibliotek', domain: 'goteborg.se/stadsbiblioteket', region: 'goteborg', city: 'Göteborg', kind: 'bibliotek' },

    // ─── Stora kyrkor (musikevenemang) ───────────────────────────────────
    { name: 'Storkyrkan',              domain: 'svenskakyrkan.se/storkyrkoforsamlingen', region: 'stockholm', city: 'Stockholm', kind: 'kyrka' },

    // ─── Mässor / kongresshallar ─────────────────────────────────────────
    { name: 'Stockholmsmässan',        domain: 'stockholmsmassan.se',   region: 'stockholm', city: 'Stockholm', kind: 'venue' },
    { name: 'Svenska Mässan',          domain: 'svenskamassan.se',      region: 'goteborg', city: 'Göteborg', kind: 'venue' },
    { name: 'Kistamässan',             domain: 'kistamassan.se',        region: 'stockholm', city: 'Stockholm', kind: 'venue' },

    // ─── BATCH 2 (2026-06-09): live-musik, klubbar, sommarscener, familj ──
    // Kategorier med daterade föreställningar i fönstret — bättre än perm. museer.
    // ── Live-musik / klubbar ──
    { name: 'Nalen',                   domain: 'nalen.com',             region: 'stockholm', city: 'Stockholm', kind: 'livemusik' },
    { name: 'Fasching',                domain: 'fasching.se',           region: 'stockholm', city: 'Stockholm', kind: 'livemusik' },
    { name: 'Debaser',                 domain: 'debaser.se',            region: 'stockholm', city: 'Stockholm', kind: 'livemusik' },
    { name: 'Slaktkyrkan',             domain: 'slaktkyrkan.se',        region: 'stockholm', city: 'Stockholm', kind: 'livemusik' },
    { name: 'Münchenbryggeriet',       domain: 'munchenbryggeriet.se',  region: 'stockholm', city: 'Stockholm', kind: 'livemusik' },
    { name: 'Berns',                   domain: 'berns.se',              region: 'stockholm', city: 'Stockholm', kind: 'livemusik' },
    { name: 'Göta Källare',            domain: 'gotakallare.com',       region: 'stockholm', city: 'Stockholm', kind: 'livemusik' },
    { name: 'Pustervik',               domain: 'pustervik.se',          region: 'goteborg', city: 'Göteborg', kind: 'livemusik' },
    { name: "Trädgår'n",               domain: 'tradgarn.se',           region: 'goteborg', city: 'Göteborg', kind: 'livemusik' },
    { name: 'Brewhouse',               domain: 'brewhouse.se',          region: 'goteborg', city: 'Göteborg', kind: 'livemusik' },
    { name: 'Pustervik Rondo',         domain: 'rondo.se',              region: 'goteborg', city: 'Göteborg', kind: 'livemusik' },
    { name: 'Kulturbolaget (KB)',      domain: 'kulturbolaget.se',      region: 'skane',     city: 'Malmö', kind: 'livemusik' },
    { name: 'Babel',                   domain: 'babel.se',              region: 'skane',     city: 'Malmö', kind: 'livemusik' },
    { name: 'Plan B',                  domain: 'planbmalmo.se',         region: 'skane',     city: 'Malmö', kind: 'livemusik' },
    { name: 'Inkonst',                 domain: 'inkonst.com',           region: 'skane',     city: 'Malmö', kind: 'livemusik' },
    { name: 'Slagthuset',              domain: 'slagthuset.se',         region: 'skane',     city: 'Malmö', kind: 'livemusik' },
    { name: 'Katalin',                 domain: 'katalin.com',           region: 'uppsala',   city: 'Uppsala', kind: 'livemusik' },
    // ── Sommarscener / slott (utomhus, daterade konserter) ──
    { name: 'Dalhalla',                domain: 'dalhalla.se',           region: 'dalarna',   city: 'Rättvik', kind: 'sommarscen' },
    { name: 'Läckö Slott',             domain: 'lackoslott.se',         region: 'vastra-gotaland', city: 'Lidköping', kind: 'sommarscen' },
    { name: 'Sofiero',                 domain: 'sofiero.se',            region: 'skane',     city: 'Helsingborg', kind: 'sommarscen' },
    { name: 'Cirkus',                  domain: 'cirkus.se',             region: 'stockholm', city: 'Stockholm', kind: 'sommarscen' },
    { name: 'Hamburger Börs',          domain: 'hamburgerbors.se',      region: 'stockholm', city: 'Stockholm', kind: 'sommarscen' },
    { name: 'Rival',                   domain: 'rival.se',              region: 'stockholm', city: 'Stockholm', kind: 'sommarscen' },
    // ── Nöjespark / familj / science ──
    { name: 'Kolmården',               domain: 'kolmarden.com',         region: 'ostergotland', city: 'Norrköping', kind: 'amusement' },
    { name: 'Parken Zoo',              domain: 'parkenzoo.se',          region: 'sodermanland', city: 'Eskilstuna', kind: 'familj' },
    { name: 'Borås Djurpark',          domain: 'boraszoo.se',           region: 'vastra-gotaland', city: 'Borås', kind: 'familj' },
    { name: 'Tom Tits Experiment',     domain: 'tomtit.se',             region: 'stockholm', city: 'Södertälje', kind: 'familj' },
    { name: 'Teknikens Hus',           domain: 'teknikenshus.se',       region: 'norrbotten', city: 'Luleå', kind: 'familj' },

    // ─── BATCH 3 (2026-06-09): Stockholm-området, scener/klubbar/konsert ──
    // Unik kind 'sthlm2' så --filter=sthlm2 probar exakt denna batch.
    { name: 'Södra Teatern',           domain: 'sodrateatern.com',      region: 'stockholm', city: 'Stockholm', kind: 'sthlm2' },
    { name: 'Dansens Hus',             domain: 'dansenshus.se',         region: 'stockholm', city: 'Stockholm', kind: 'sthlm2' },
    { name: 'Musikaliska Kvarteret',   domain: 'musikaliska.se',        region: 'stockholm', city: 'Stockholm', kind: 'sthlm2' },
    { name: 'Dieselverkstaden',        domain: 'dieselverkstaden.se',   region: 'stockholm', city: 'Nacka', kind: 'sthlm2' },
    { name: 'Stallet (Världens musik)', domain: 'stallet.se',           region: 'stockholm', city: 'Stockholm', kind: 'sthlm2' },
    { name: 'Boulevardteatern',        domain: 'boulevardteatern.se',   region: 'stockholm', city: 'Stockholm', kind: 'sthlm2' },
    { name: 'Thielska Galleriet',      domain: 'thielskagalleriet.se',  region: 'stockholm', city: 'Stockholm', kind: 'sthlm2' },
    { name: 'Confidencen',             domain: 'confidencen.se',        region: 'stockholm', city: 'Solna', kind: 'sthlm2' },
    { name: 'Subtopia',                domain: 'subtopia.se',           region: 'stockholm', city: 'Botkyrka', kind: 'sthlm2' },
    { name: 'Cirkus Cirkör',           domain: 'cirkor.se',             region: 'stockholm', city: 'Botkyrka', kind: 'sthlm2' },
    { name: 'Unga Klara',              domain: 'ungaklara.se',          region: 'stockholm', city: 'Stockholm', kind: 'sthlm2' },
    { name: 'Teater Brunnsgatan Fyra', domain: 'brunnsgatanfyra.se',    region: 'stockholm', city: 'Stockholm', kind: 'sthlm2' },
    { name: 'Under Bron / Trädgården', domain: 'underbron.com',         region: 'stockholm', city: 'Stockholm', kind: 'sthlm2' },
    { name: 'Playhouse Teater',        domain: 'playhouseteater.se',    region: 'stockholm', city: 'Stockholm', kind: 'sthlm2' },
    { name: 'Eric Ericsonhallen',      domain: 'ericericsonhallen.se',  region: 'stockholm', city: 'Stockholm', kind: 'sthlm2' },
    { name: 'Hallwylska Museet',       domain: 'hallwylskamuseet.se',   region: 'stockholm', city: 'Stockholm', kind: 'sthlm2' },
    { name: 'Turteatern',              domain: 'turteatern.se',         region: 'stockholm', city: 'Kärrtorp', kind: 'sthlm2' },
    { name: 'Teater Galeasen',         domain: 'galeasen.se',           region: 'stockholm', city: 'Stockholm', kind: 'sthlm2' },

    // ─── BATCH 4 (2026-06-09): regionteatrar, live-musik (Gbg/Malmö/mellanstora), arthouse-bio ──
    // Unik kind 'batch4' → --filter=batch4.
    // Live-musik Göteborg
    { name: 'Nefertiti',               domain: 'nefertiti.se',          region: 'goteborg', city: 'Göteborg', kind: 'batch4' },
    { name: 'Oceanen',                 domain: 'oceanen.com',           region: 'goteborg', city: 'Göteborg', kind: 'batch4' },
    { name: 'Musikens Hus',            domain: 'musikenshus.se',        region: 'goteborg', city: 'Göteborg', kind: 'batch4' },
    { name: 'Sticky Fingers',          domain: 'stickyfingers.se',      region: 'goteborg', city: 'Göteborg', kind: 'batch4' },
    // Live-musik Malmö/Lund/Umeå
    { name: 'Mejeriet',                domain: 'mejeriet.com',          region: 'skane', city: 'Lund', kind: 'batch4' },
    { name: 'Palladium Malmö',         domain: 'palladiummalmo.se',     region: 'skane', city: 'Malmö', kind: 'batch4' },
    { name: 'Moriska Paviljongen',     domain: 'moriskan.com',          region: 'skane', city: 'Malmö', kind: 'batch4' },
    { name: 'Scharinska',              domain: 'scharinska.se',         region: 'vasterbotten', city: 'Umeå', kind: 'batch4' },
    { name: 'Reginateatern',           domain: 'reginateatern.se',      region: 'uppsala', city: 'Uppsala', kind: 'batch4' },
    // Regionteatrar / länsteatrar
    { name: 'Helsingborgs Stadsteater', domain: 'helsingborgsstadsteater.se', region: 'skane', city: 'Helsingborg', kind: 'batch4' },
    { name: 'Uppsala Stadsteater',     domain: 'uppsalastadsteater.se', region: 'uppsala', city: 'Uppsala', kind: 'batch4' },
    { name: 'Dalateatern',             domain: 'dalateatern.se',        region: 'dalarna', city: 'Falun', kind: 'batch4' },
    { name: 'Wermland Opera',          domain: 'wermlandopera.se',      region: 'varmland', city: 'Karlstad', kind: 'batch4' },
    { name: 'Smålands Musik & Teater', domain: 'smot.se',               region: 'jonkoping', city: 'Jönköping', kind: 'batch4' },
    { name: 'Byteatern Kalmar',        domain: 'byteatern.se',          region: 'kalmar', city: 'Kalmar', kind: 'batch4' },
    { name: 'Estrad Norr',             domain: 'estradnorr.se',         region: 'jamtland', city: 'Östersund', kind: 'batch4' },
    { name: 'Regionteatern Blekinge Kronoberg', domain: 'regionteatern.se', region: 'kronoberg', city: 'Växjö', kind: 'batch4' },
    { name: 'Scenkonst Sörmland',      domain: 'scenkonstsormland.se',  region: 'sodermanland', city: 'Eskilstuna', kind: 'batch4' },
    // Konserthus (övriga städer)
    { name: 'Louis De Geer',           domain: 'louisdegeer.se',        region: 'ostergotland', city: 'Norrköping', kind: 'batch4' },
    { name: 'Tonhallen Sundsvall',     domain: 'tonhallen.se',          region: 'vasternorrland', city: 'Sundsvall', kind: 'batch4' },
    // Arthouse-bio (screening-kalendrar)
    { name: 'Bio Roy',                 domain: 'bioroy.se',             region: 'goteborg', city: 'Göteborg', kind: 'batch4' },
    { name: 'Hagabion',                domain: 'hagabion.se',           region: 'goteborg', city: 'Göteborg', kind: 'batch4' },
    { name: 'Zita Folkets Bio',        domain: 'zita.se',               region: 'stockholm', city: 'Stockholm', kind: 'batch4' },
    { name: 'Bio Rio',                 domain: 'biorio.se',             region: 'stockholm', city: 'Stockholm', kind: 'batch4' },
    { name: 'Spegeln Malmö',           domain: 'spegeln.nu',            region: 'skane', city: 'Malmö', kind: 'batch4' },

    // ─── BATCH 5 (2026-06-09): regionala turism/visit-sajter (aggregerar lokala events) ──
    // Unik kind 'visit5'. Sommar → festival/utomhus-events i fönstret nu.
    { name: 'Västsverige',             domain: 'vastsverige.com',       region: 'vastra-gotaland', kind: 'visit5' },
    { name: 'Visit Skåne',             domain: 'visitskane.com',        region: 'skane', kind: 'visit5' },
    { name: 'Visit Värmland',          domain: 'visitvarmland.se',      region: 'varmland', kind: 'visit5' },
    { name: 'Visit Dalarna',           domain: 'visitdalarna.se',       region: 'dalarna', kind: 'visit5' },
    { name: 'Visit Småland',           domain: 'visitsmaland.se',       region: 'smaland', kind: 'visit5' },
    { name: 'Visit Östergötland',      domain: 'visitostergotland.se',  region: 'ostergotland', kind: 'visit5' },
    { name: 'Swedish Lapland',         domain: 'swedishlapland.com',    region: 'norrbotten', kind: 'visit5' },
    { name: 'Visit Halland',           domain: 'visithalland.com',      region: 'halland', kind: 'visit5' },
    { name: 'Visit Blekinge',          domain: 'visitblekinge.se',      region: 'blekinge', kind: 'visit5' },
    { name: 'Destination Uppsala',     domain: 'destinationuppsala.se', region: 'uppsala', city: 'Uppsala', kind: 'visit5' },
    { name: 'Visit Kalmar',            domain: 'visitkalmar.se',        region: 'kalmar', city: 'Kalmar', kind: 'visit5' },
    { name: 'Visit Varberg',           domain: 'visitvarberg.se',       region: 'halland', city: 'Varberg', kind: 'visit5' },
    { name: 'Visit Luleå',             domain: 'visitlulea.se',         region: 'norrbotten', city: 'Luleå', kind: 'visit5' },
    { name: 'Visit Umeå',              domain: 'visitumea.se',          region: 'vasterbotten', city: 'Umeå', kind: 'visit5' },
    { name: 'Visit Västerås',          domain: 'visitvasteras.se',      region: 'vastmanland', city: 'Västerås', kind: 'visit5' },
    { name: 'Visit Vimmerby',          domain: 'visitvimmerby.se',      region: 'kalmar', city: 'Vimmerby', kind: 'visit5' },
    { name: 'Visit Helsingborg',       domain: 'visithelsingborg.com',  region: 'skane', city: 'Helsingborg', kind: 'visit5' },
    { name: 'Visit Norrköping',        domain: 'visitnorrkoping.se',    region: 'ostergotland', city: 'Norrköping', kind: 'visit5' },
    { name: 'Visit Linköping',         domain: 'visitlinkoping.se',     region: 'ostergotland', city: 'Linköping', kind: 'visit5' },
    { name: 'Visit Trollhättan',       domain: 'visittrollhattanvanersborg.se', region: 'vastra-gotaland', city: 'Trollhättan', kind: 'visit5' },
    { name: 'Visit Karlstad',          domain: 'visitkarlstad.se',      region: 'varmland', city: 'Karlstad', kind: 'visit5' },
    { name: 'Visit Sälen',             domain: 'visitsalen.se',         region: 'dalarna', city: 'Sälen', kind: 'visit5' },

    // ─── BATCH 6 (2026-06-09): mellanstora kulturhus, slott/herrgård (sommar), botaniska, domkyrkor ──
    // Unik kind 'batch6'.
    // Mellanstora städers kulturhus / teatrar / konserthus
    { name: 'Sara Kulturhus',          domain: 'sarakulturhus.se',      region: 'vasterbotten', city: 'Skellefteå', kind: 'batch6' },
    { name: 'Kulturens Hus Luleå',     domain: 'kulturenshus.com',      region: 'norrbotten', city: 'Luleå', kind: 'batch6' },
    { name: 'Storsjöteatern',          domain: 'storsjoteatern.se',     region: 'jamtland', city: 'Östersund', kind: 'batch6' },
    { name: 'Halmstads Teater',        domain: 'halmstadsteater.se',    region: 'halland', city: 'Halmstad', kind: 'batch6' },
    { name: 'Konserthusteatern Karlskrona', domain: 'konserthusteatern.se', region: 'blekinge', city: 'Karlskrona', kind: 'batch6' },
    { name: 'Kalmarsalen',             domain: 'kalmarsalen.se',        region: 'kalmar', city: 'Kalmar', kind: 'batch6' },
    { name: 'Wisby Strand',            domain: 'wisbystrand.se',        region: 'gotland', city: 'Visby', kind: 'batch6' },
    { name: 'Folkteatern Gävleborg',   domain: 'folkteatergavleborg.se', region: 'gavleborg', city: 'Gävle', kind: 'batch6' },
    { name: 'Teater Halland',          domain: 'teaterhalland.se',      region: 'halland', city: 'Varberg', kind: 'batch6' },
    { name: 'Kulturkvarteret Kristianstad', domain: 'kulturkvarteret.com', region: 'skane', city: 'Kristianstad', kind: 'batch6' },
    // Slott / herrgård (sommarprogram)
    { name: 'Tjolöholms Slott',        domain: 'tjoloholm.se',          region: 'halland', city: 'Kungsbacka', kind: 'batch6' },
    { name: 'Gunnebo Slott',           domain: 'gunneboslott.se',       region: 'vastra-gotaland', city: 'Mölndal', kind: 'batch6' },
    { name: 'Wanås Konst',             domain: 'wanas.se',              region: 'skane', city: 'Knislinge', kind: 'batch6' },
    { name: 'Drottningholms Slottsteater', domain: 'dtm.se',            region: 'stockholm', city: 'Drottningholm', kind: 'batch6' },
    { name: 'Rosendals Trädgård',      domain: 'rosendalstradgard.se',  region: 'stockholm', city: 'Stockholm', kind: 'batch6' },
    { name: 'Läckö Slott',             domain: 'lackoslott.se',         region: 'vastra-gotaland', city: 'Lidköping', kind: 'batch6' },
    // Botaniska trädgårdar
    { name: 'Bergianska Trädgården',   domain: 'bergianska.se',         region: 'stockholm', city: 'Stockholm', kind: 'batch6' },
    { name: 'Göteborgs Botaniska',     domain: 'botaniska.se',          region: 'goteborg', city: 'Göteborg', kind: 'batch6' },
    // Domkyrkor / kyrkomusik
    { name: 'Lunds Domkyrka',          domain: 'lundsdomkyrka.se',      region: 'skane', city: 'Lund', kind: 'batch6' },
    { name: 'Uppsala Domkyrka',        domain: 'uppsaladomkyrka.se',    region: 'uppsala', city: 'Uppsala', kind: 'batch6' },
    // Science / family
    { name: '2047 Science Center',     domain: '2047.nu',               region: 'dalarna', city: 'Borlänge', kind: 'batch6' },
    { name: 'Curiosum',                domain: 'curiosum.umu.se',       region: 'vasterbotten', city: 'Umeå', kind: 'batch6' },
    // Fler live-musik
    { name: 'Pustervik Brewhouse',     domain: 'brewhouse.se',          region: 'goteborg', city: 'Göteborg', kind: 'batch6' },
    { name: 'Kraken Live',             domain: 'krakenlive.se',         region: 'skane', city: 'Malmö', kind: 'batch6' },
    { name: 'Folk Göteborg',           domain: 'folkgbg.se',            region: 'goteborg', city: 'Göteborg', kind: 'batch6' },
    { name: 'Gamla Stans Teater',      domain: 'gamlastansteater.se',   region: 'stockholm', city: 'Stockholm', kind: 'batch6' },

    // ─── BATCH 7 (2026-06-23): nöjesfält / familjeparker (kind 'amusement') ──
    // Sammanför nöjesparkerna under en gemensam kind så --filter=amusement
    // probar exakt dem. Befintliga (Liseberg, Universeum) utelämnade — redan i
    // registry. Furuvik/Gröna Lund/Skara Sommarland/Kolmården/Skansen/Junibacken
    // fick kind='amusement' ovan; här de som saknades helt:
    { name: 'Tosselilla',              domain: 'tosselilla.se',         region: 'skane', city: 'Tomelilla', kind: 'amusement' },
    { name: 'Astrid Lindgrens Värld',  domain: 'alv.se',                region: 'kalmar', city: 'Vimmerby', kind: 'amusement' },
    { name: 'High Chaparral',          domain: 'highchaparral.se',      region: 'jonkoping', city: 'Hillerstorp', kind: 'amusement' },
];

const SITEMAP_PATHS = [
    '/sitemap.xml',
    '/sitemap_index.xml',
    '/wp-sitemap.xml',
    '/sitemap1.xml',
    '/event-sitemap.xml',
    '/events-sitemap.xml',
    '/tribe_events-sitemap.xml',
    '/sv/sitemap.xml',
];

const EVENT_PATTERNS: { name: string; re: RegExp }[] = [
    { name: 'evenemang',    re: /\/(?:sv\/)?evenemang\/[^/]+\/?$/i },
    { name: 'event',        re: /\/(?:sv\/)?event\/[^/]+\/?$/i },
    { name: 'events',       re: /\/(?:sv\/)?events\/[^/]+\/?$/i },
    { name: 'kalender',     re: /\/(?:sv\/)?kalender\/[^/]+\/?$/i },
    { name: 'aktivitet',    re: /\/(?:sv\/)?aktivitet(?:er)?\/[^/]+\/?$/i },
    { name: 'arrangemang',  re: /\/(?:sv\/)?arrangemang\/[^/]+\/?$/i },
    { name: 'program',      re: /\/(?:sv\/)?program\/[^/]+\/?$/i },
    { name: 'forestallning', re: /\/(?:sv\/)?forestallning(?:ar)?\/[^/]+\/?$/i },
    { name: 'pa-gang',      re: /\/(?:sv\/)?pa-gang\/[^/]+\/?$/i },
    { name: 'shows',        re: /\/(?:sv\/)?shows?\/[^/]+\/?$/i },
    { name: 'tribe-events', re: /\/events\/event\/[^/]+\/?$/i },
    { name: 'utstallning',  re: /\/(?:sv\/)?utstallning(?:ar)?\/[^/]+\/?$/i },
    { name: 'konsert',      re: /\/(?:sv\/)?konsert(?:er)?\/[^/]+\/?$/i },
];

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const FETCH_TIMEOUT_MS = 10000;
const MAX_SUB_SITEMAPS = 5;

async function fetchText(url: string): Promise<{ status: number; body: string | null; error?: string }> {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    const isGzUrl = url.toLowerCase().endsWith('.gz');
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': UA, 'Accept': 'application/xml,text/xml,*/*' },
            signal: ac.signal,
            redirect: 'follow',
        });
        if (!res.ok) return { status: res.status, body: null };
        const ce = (res.headers.get('content-encoding') || '').toLowerCase();
        if (isGzUrl || ce.includes('gzip')) {
            const buf = Buffer.from(await res.arrayBuffer());
            if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
                const decoded = await gunzip(buf);
                return { status: res.status, body: decoded.toString('utf8') };
            }
            return { status: res.status, body: buf.toString('utf8') };
        }
        return { status: res.status, body: await res.text() };
    } catch (e) {
        return { status: 0, body: null, error: (e as Error).name === 'AbortError' ? 'timeout' : (e as Error).message };
    } finally {
        clearTimeout(timeout);
    }
}

const extractLocs = (xml: string): string[] => {
    const out: string[] = [];
    const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) out.push(m[1].trim());
    return out;
};

const isSitemapIndex = (xml: string) => /<sitemapindex[\s>]/i.test(xml);

async function collectEventUrls(rootUrl: string): Promise<string[]> {
    const root = await fetchText(rootUrl);
    if (!root.body) return [];
    if (isSitemapIndex(root.body)) {
        const subs = extractLocs(root.body).slice(0, MAX_SUB_SITEMAPS);
        subs.sort((a, b) => {
            const score = (u: string) => /(event|evenemang|kalender|aktivitet|arrangemang|program|forestallning|pa-gang|show|utstallning|konsert)/i.test(u) ? 0 : 1;
            return score(a) - score(b);
        });
        const all: string[] = [];
        for (const sub of subs) {
            const child = await fetchText(sub);
            if (child.body && !isSitemapIndex(child.body)) all.push(...extractLocs(child.body));
        }
        return all;
    }
    return extractLocs(root.body);
}

interface Hit {
    venue: Venue;
    sitemapUrl: string;
    pattern: string;
    matchCount: number;
    sampleUrl: string;
}

async function probeVenue(v: Venue): Promise<Hit | null> {
    const hosts = [`https://www.${v.domain.split('/')[0]}`, `https://${v.domain.split('/')[0]}`];
    for (const host of hosts) {
        for (const path of SITEMAP_PATHS) {
            const sitemapUrl = `${host}${path}`;
            const urls = await collectEventUrls(sitemapUrl);
            if (urls.length === 0) continue;
            let best: Hit | null = null;
            for (const { name, re } of EVENT_PATTERNS) {
                const matches = urls.filter(u => re.test(u));
                if (matches.length === 0) continue;
                if (!best || matches.length > best.matchCount) {
                    best = { venue: v, sitemapUrl, pattern: name, matchCount: matches.length, sampleUrl: matches[0] };
                }
            }
            if (best && best.matchCount >= 2) return best;
        }
    }
    return null;
}

async function runWithConcurrency<T, R>(items: T[], n: number, fn: (i: T) => Promise<R>): Promise<R[]> {
    const queue = items.slice();
    const out: R[] = [];
    const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
        while (queue.length > 0) {
            const item = queue.shift();
            if (item === undefined) break;
            out.push(await fn(item));
        }
    });
    await Promise.all(workers);
    return out;
}

function parseArgs(): { concurrency: number; filter?: string; threshold: number } {
    const out: any = { concurrency: 12, threshold: 5 };
    for (const a of process.argv.slice(2)) {
        const m = a.match(/^--([^=]+)=(.+)$/);
        if (!m) continue;
        if (m[1] === 'concurrency') out.concurrency = parseInt(m[2], 10);
        else if (m[1] === 'filter') out.filter = m[2];
        else if (m[1] === 'threshold') out.threshold = parseInt(m[2], 10);
    }
    return out;
}

function slugify(s: string): string {
    return s.toLowerCase()
        .replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function emitConfig(hits: Hit[]): void {
    if (hits.length === 0) return;
    console.log('\n\n=== GENERERAD SOURCE-CONFIG (kopiera in i registry.ts) ===\n');
    for (const h of hits) {
        const re = EVENT_PATTERNS.find(p => p.name === h.pattern)!.re;
        const city = h.venue.city ? `\n            defaultCity: '${h.venue.city}',` : '';
        console.log(`    {`);
        console.log(`        id: '${slugify(h.venue.name)}',`);
        console.log(`        hostName: '${h.venue.name}',`);
        console.log(`        region: '${h.venue.region || 'national'}',`);
        console.log(`        engine: 'sitemap',`);
        console.log(`        config: {`);
        console.log(`            sitemapUrl: '${h.sitemapUrl}',`);
        console.log(`            urlPatterns: [${re.toString()}],${city}`);
        console.log(`        },`);
        console.log(`        updateFrequency: 'daily',`);
        console.log(`        notes: 'Probe-venues ${new Date().toISOString().slice(0, 10)}: ${h.matchCount} event-URLs (${h.pattern}-mönster) — ${h.venue.kind || 'venue'}.',`);
        console.log(`        lastVerified: '${new Date().toISOString().slice(0, 10)}',`);
        console.log(`    },`);
    }
}

async function main() {
    const { concurrency, filter, threshold } = parseArgs();
    const venues = filter
        ? VENUES.filter(v => v.name.toLowerCase().includes(filter.toLowerCase()) || v.kind?.includes(filter.toLowerCase()))
        : VENUES;

    console.log(`Probar ${venues.length} venues via sitemap.xml (threshold=${threshold}, concurrency=${concurrency})…\n`);
    const startedAt = Date.now();
    let done = 0;

    const all = await runWithConcurrency(venues, concurrency, async (v) => {
        const hit = await probeVenue(v);
        done++;
        if (hit && hit.matchCount >= threshold) {
            const sample = ` — ${hit.sampleUrl}`;
            console.log(`✅ [${String(done).padStart(3)}/${venues.length}] ${v.name.padEnd(36)} ${hit.pattern.padEnd(12)} ${String(hit.matchCount).padStart(4)} URLs  ${hit.sitemapUrl}${sample}`);
        } else if (hit) {
            console.log(`~  [${String(done).padStart(3)}/${venues.length}] ${v.name.padEnd(36)} ${hit.pattern.padEnd(12)} ${String(hit.matchCount).padStart(4)} URLs  (under tröskel)`);
        } else {
            console.log(`○  [${String(done).padStart(3)}/${venues.length}] ${v.name.padEnd(36)} (ingen sitemap-event)`);
        }
        return hit && hit.matchCount >= threshold ? hit : null;
    });

    const hits = all.filter((h): h is Hit => h !== null);
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

    console.log(`\n=== SAMMANFATTNING (${elapsed}s) ===`);
    console.log(`Probat: ${venues.length} venues`);
    console.log(`Träffar (≥${threshold} URLs): ${hits.length}`);
    if (hits.length > 0) {
        const total = hits.reduce((s, h) => s + h.matchCount, 0);
        console.log(`Totalt event-URLs: ~${total}`);
        emitConfig(hits);
    }
    process.exit(0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
