/**
 * GENERERAD FIL — nationell FB-sidbevakning ur snöbollsrundan 2026-07-27.
 *
 * Pipeline (scratchpad-skript, kör om vid behov):
 *   snowball.cjs        — en eventsida per återkommande arrangör (≥2 event
 *                         senaste månaden i DB) → arrangörens sid-slug
 *   probe-national.cjs  — verifierar att sidan finns och att /events-fliken
 *                         visar eventlänkar utloggat
 *   generate-watchlist.cjs — skriver denna fil
 *
 * Stadshint = vanligaste kända stad i arrangörens historiska event-adresser
 * (utelämnad när ingen känd stad hittades — geokodningen skannar då
 * eventadressen själv). Redigera hellre kurerade poster i watchlist.ts;
 * denna fil skrivs över vid regenerering.
 */

import { FacebookPageWatch } from './watchlist';

export const FACEBOOK_PAGE_WATCHLIST_NATIONAL: FacebookPageWatch[] = [
    { slug: 'taystase', name: 'Taysta', city: 'Uppsala' }, // 12 ev i juli, 8 synliga
    { slug: 'Dundermarknaden', name: 'Dundermarknaden' }, // 12 ev i juli, 7 synliga
    { slug: 'sommarscen', name: 'Malmö Sommarscen' }, // 10 ev i juli, 3 synliga
    { slug: 'ClassicCarWeek', name: 'Classic Car Week' }, // 9 ev i juli, 8 synliga
    { slug: 'soderkopingsbio', name: 'Söderköpings Bio' }, // 8 ev i juli, 1 synliga
    { slug: 'Faluguide', name: 'Faluguide', city: 'Falun' }, // 8 ev i juli, 1 synliga
    { slug: 'surfviken', name: 'Surfviken' }, // 7 ev i juli, 8 synliga
    { slug: 'engelholmsrevyn', name: 'Engelholmsrevyn' }, // 7 ev i juli, 8 synliga
    { slug: 'Campingkul', name: 'Evedals Camping' }, // 6 ev i juli, 8 synliga
    { slug: 'ZumbaFunFinn', name: 'Dansbanan I Gamla Linköping', city: 'Linköping' }, // 6 ev i juli, 8 synliga
    { slug: 'bioroy', name: 'Bio Roy' }, // 6 ev i juli, 8 synliga
    { slug: 'ArrangemangLund', name: 'Arrangemang Lund', city: 'Lund' }, // 6 ev i juli, 8 synliga
    { slug: 'trelleborgen', name: 'Trelleborgen', city: 'Trelleborg' }, // 5 ev i juli, 4 synliga
    { slug: 'tandsticksmuseet', name: 'Tändsticksmuseet', city: 'Jönköping' }, // 5 ev i juli, 5 synliga
    { slug: 'upplevlandskronaven', name: 'Teaterparken' }, // 5 ev i juli, 3 synliga
    { slug: 'scensommar', name: 'Scensommar', city: 'Ljungby' }, // 5 ev i juli, 8 synliga
    { slug: 'mjolbykommun', name: 'Mjölby kommun', city: 'Mjölby' }, // 5 ev i juli, 1 synliga
    { slug: 'roselandvisby', name: 'Kruttornet' }, // 5 ev i juli, 2 synliga
    { slug: 'caferosenhill', name: 'Café Rosenhill' }, // 5 ev i juli, 8 synliga
    { slug: 'bally.love.1', name: 'Bally Love', city: 'Kalmar' }, // 5 ev i juli, 8 synliga
    { slug: 'solvesborgcsk', name: 'Stortorget Sölvesborg', city: 'Sölvesborg' }, // 4 ev i juli, 8 synliga
    { slug: 'kulturfritidtrelleborg', name: 'Stadsparken' }, // 4 ev i juli, 2 synliga
    { slug: 'Skadibmt', name: 'Skadi' }, // 4 ev i juli, 2 synliga
    { slug: 'norrvikenbastad', name: 'Norrviken' }, // 4 ev i juli, 2 synliga
    { slug: 'olearysgavle', name: 'O\'Learys Gävle', city: 'Gävle' }, // 4 ev i juli, 8 synliga
    { slug: 'Molekylverkstan', name: 'Molekylverkstan' }, // 4 ev i juli, 4 synliga
    { slug: 'kraxagarden', name: 'Kraxagården' }, // 4 ev i juli, 8 synliga
    { slug: 'GavleRave', name: 'Gävle, Gävleborgs län', city: 'Gävle' }, // 4 ev i juli, 6 synliga
    { slug: 'laneloge.se', name: 'Lane Loge', city: 'Uddevalla' }, // 4 ev i juli, 3 synliga
    { slug: 'Droskan.se', name: 'DROSKAN' }, // 4 ev i juli, 4 synliga
    { slug: 'bohuslanguider', name: 'Bohusläns Guider' }, // 4 ev i juli, 6 synliga
    { slug: 'Samrong.sombat.mt', name: 'ACAPOEIRA SWEDEN' }, // 4 ev i juli, 1 synliga
    { slug: 'webnode.se', name: 'YogaKajsa', city: 'Eslöv' }, // 3 ev i juli, 8 synliga
    { slug: 'yoganovisen', name: 'YogaNovisen' }, // 3 ev i juli, 2 synliga
    { slug: 'Vaxjodyksport', name: 'Växjödyksport', city: 'Växjö' }, // 3 ev i juli, 8 synliga
    { slug: 'vaniumeasida', name: 'Vän i Umeå' }, // 3 ev i juli, 6 synliga
    { slug: 'meraloppis', name: 'Ulf Andersson' }, // 3 ev i juli, 8 synliga
    { slug: 'TheTivoli', name: 'The Tivoli', city: 'Helsingborg' }, // 3 ev i juli, 8 synliga
    { slug: '100090173421423', name: 'Studio Koxa' }, // 3 ev i juli, 2 synliga
    { slug: 'stenhusetgille', name: 'Stenhuset' }, // 3 ev i juli, 5 synliga
    { slug: 'Alfredsspelobar', name: 'Stures Krog', city: 'Lidköping' }, // 3 ev i juli, 4 synliga
    { slug: 'steelhotelsmedjebacken', name: 'Steel Hotel' }, // 3 ev i juli, 2 synliga
    { slug: 'scenosterlen', name: 'Scen Österlen', city: 'Simrishamn' }, // 3 ev i juli, 2 synliga
    { slug: 'spokguiden', name: 'Spökguiden' }, // 3 ev i juli, 7 synliga
    { slug: 'juan.c.diaz.906', name: 'Paddla SUP & Tälta i Sverige' }, // 3 ev i juli, 8 synliga
    { slug: 'mats.fuchs.9', name: 'Mats Fuchs' }, // 3 ev i juli, 1 synliga
    { slug: 'MittsverigebananHarnosand', name: 'Mittsverigebanan', city: 'Härnösand' }, // 3 ev i juli, 3 synliga
    { slug: 'medeltidsmuseet', name: 'Medeltidsmuseet', city: 'Stockholm' }, // 3 ev i juli, 8 synliga
    { slug: 'malnhavochkrog', name: 'MALN Hav & Krog', city: 'Hudiksvall' }, // 3 ev i juli, 1 synliga
    { slug: 'mkrs.se', name: 'MKRS' }, // 3 ev i juli, 2 synliga
    { slug: 'laughseats', name: 'Laugh Seats' }, // 3 ev i juli, 8 synliga
    { slug: 'Kungalvsparken', name: 'Kungälvs Parken' }, // 3 ev i juli, 8 synliga
    { slug: 'kackelstugan', name: 'Kackelstugan' }, // 3 ev i juli, 8 synliga
    { slug: 'hotellbellevue', name: 'Hotell Bellevue' }, // 3 ev i juli, 8 synliga
    { slug: 'fritidibjuv', name: 'Fritid i Bjuv' }, // 3 ev i juli, 3 synliga
    { slug: 'bortansikolympia', name: 'Gunnarskog, Värmland' }, // 3 ev i juli, 1 synliga
    { slug: 'frilandsmusset', name: 'Fiskartorpet' }, // 3 ev i juli, 4 synliga
    { slug: 'frimisorebro', name: 'Frimis' }, // 3 ev i juli, 8 synliga
    { slug: 'BrygganSMB', name: 'Bryggan' }, // 3 ev i juli, 3 synliga
    { slug: 'boulognerskogenparkrun', name: 'Boulognerskogen' }, // 3 ev i juli, 1 synliga
    { slug: 'anebybibliotek', name: 'Aneby bibliotek' }, // 3 ev i juli, 4 synliga
    { slug: 'susanne.swantesson', name: 'Alternativ-Mässa', city: 'Göteborg' }, // 3 ev i juli, 6 synliga
    { slug: 'christian.andersson.3150', name: 'Östergötlands Rc trail sällskap' }, // 2 ev i juli, 8 synliga
    { slug: 'naturumSkrylle', name: 'naturum Skrylle' }, // 2 ev i juli, 5 synliga
    { slug: 'wijtradgardar', name: 'Wij Trädgårdar' }, // 2 ev i juli, 8 synliga
    { slug: 'vatmoro', name: 'Våt Moro' }, // 2 ev i juli, 1 synliga
    { slug: 'vastanforsbandy', name: 'Västanforsbandy' }, // 2 ev i juli, 2 synliga
    { slug: 'vaxjoloparklubb', name: 'Växjö Löparklubb' }, // 2 ev i juli, 8 synliga
    { slug: 'varlokal', name: 'Vår lokal' }, // 2 ev i juli, 8 synliga
    { slug: 'visitkumla', name: 'Visit Kumla' }, // 2 ev i juli, 3 synliga
    { slug: 'horisont.ycs', name: 'Visby, Gotland Island, Sweden', city: 'Visby' }, // 2 ev i juli, 8 synliga
    { slug: 'sommarrocksvedala', name: 'Vad händer i Skåne' }, // 2 ev i juli, 8 synliga
    { slug: 'ungitibro', name: 'UngiTibro' }, // 2 ev i juli, 2 synliga
    { slug: 'Upplandsmuseet', name: 'Upplandsmuseet', city: 'Uppsala' }, // 2 ev i juli, 2 synliga
    { slug: 'Torreby.Castle', name: 'Torreby Slott' }, // 2 ev i juli, 8 synliga
    { slug: 'TillsammansHoor', name: 'Tillsammans Höör' }, // 2 ev i juli, 2 synliga
    { slug: 'Tangokompaniet', name: 'Tangokompaniet' }, // 2 ev i juli, 3 synliga
    { slug: 'tfsigurd', name: 'Sörmlandsgården' }, // 2 ev i juli, 8 synliga
    { slug: 'Tarabband', name: 'TARABBAND', city: 'Kristianstad' }, // 2 ev i juli, 1 synliga
    { slug: 'svaneholmsslott', name: 'Svaneholms slott' }, // 2 ev i juli, 8 synliga
    { slug: 'sundsvallpride', name: 'Sundsvall Pride', city: 'Sundsvall' }, // 2 ev i juli, 8 synliga
    { slug: 'hotellkarlshamn', name: 'Stortorget Karlshamn', city: 'Karlshamn' }, // 2 ev i juli, 1 synliga
    { slug: 'mandagsrorelseilkpg', name: 'Stora torget Linköping', city: 'Linköping' }, // 2 ev i juli, 1 synliga
    { slug: 'borascity', name: 'Stora Torget, Borås', city: 'Borås' }, // 2 ev i juli, 8 synliga
    { slug: 'stina.helmersson', name: 'Stina Helmersson' }, // 2 ev i juli, 6 synliga
    { slug: 'stalpet', name: 'Stalpet' }, // 2 ev i juli, 2 synliga
    { slug: 'CountryPopLovers', name: 'Solna, Stockholm, Sweden', city: 'Stockholm' }, // 2 ev i juli, 7 synliga
    { slug: 'sprangsten', name: 'Sprängsten' }, // 2 ev i juli, 2 synliga
    { slug: 'skovdekulturhus', name: 'Skövde Kulturhus', city: 'Skövde' }, // 2 ev i juli, 8 synliga
    { slug: 'skugganscafe', name: 'Skuggans Gröna', city: 'Enköping' }, // 2 ev i juli, 8 synliga
    { slug: 'sagateaterboras', name: 'Sagateatern', city: 'Borås' }, // 2 ev i juli, 8 synliga
    { slug: 'sdknacken', name: 'SDK Näcken', city: 'Katrineholm' }, // 2 ev i juli, 2 synliga
    { slug: 'Roslagsmuseet', name: 'Roslagsmuseet', city: 'Norrtälje' }, // 2 ev i juli, 2 synliga
    { slug: 'rattvikbutchers', name: 'Rättvik Butchers' }, // 2 ev i juli, 7 synliga
    { slug: 'soderkopingsanktanna', name: 'S:t Laurentii Kyrka' }, // 2 ev i juli, 8 synliga
    { slug: 'revivefalkoping', name: 'Revive Falköping' }, // 2 ev i juli, 8 synliga
    { slug: 'rixfmfestival', name: 'RIX FM Festival', city: 'Sundsvall' }, // 2 ev i juli, 8 synliga
    { slug: 'redbullevents', name: 'Red Bull Events', city: 'Göteborg' }, // 2 ev i juli, 8 synliga
    { slug: 'ullakarinbella.johansson', name: 'Oxelösund' }, // 2 ev i juli, 6 synliga
    { slug: 'Orsayran', name: 'Orsayran' }, // 2 ev i juli, 8 synliga
    { slug: 'anders.djerf', name: 'Norrtälje - Vad händer på byn?', city: 'Norrtälje' }, // 2 ev i juli, 6 synliga
    { slug: 'nipyran', name: 'Nipyran' }, // 2 ev i juli, 8 synliga
    { slug: 'nfacademy', name: 'NF Academy' }, // 2 ev i juli, 8 synliga
    { slug: 'nederlulea', name: 'Nederluleå kyrka' }, // 2 ev i juli, 4 synliga
    { slug: 'nattsuddbar', name: 'Nattsudd' }, // 2 ev i juli, 1 synliga
    { slug: 'fincha.carter', name: 'Mönsterås, Kalmar län', city: 'Kalmar' }, // 2 ev i juli, 8 synliga
    { slug: 'strawberryarena', name: 'Music Play' }, // 2 ev i juli, 8 synliga
    { slug: '1mr.langos', name: 'Mr.Lángos', city: 'Uddevalla' }, // 2 ev i juli, 8 synliga
    { slug: 'junisalvsborgdistrikt', name: 'Movendi Älvsborg', city: 'Borås' }, // 2 ev i juli, 2 synliga
    { slug: 'Mamasrestaurang', name: 'Mama’s' }, // 2 ev i juli, 5 synliga
    { slug: 'teslaownerssweden', name: 'Lycksele, Västerbottens län', city: 'Lycksele' }, // 2 ev i juli, 8 synliga
    { slug: 'LukeCombs', name: 'Luke Combs' }, // 2 ev i juli, 6 synliga
    { slug: 'lotti.lundblad', name: 'Lotti Lundblad' }, // 2 ev i juli, 2 synliga
    { slug: 'historierfranhalsingland', name: 'Ljusdals hembygdsgård' }, // 2 ev i juli, 4 synliga
    { slug: 'konstmuseet', name: 'Konstmuseet', city: 'Skövde' }, // 2 ev i juli, 4 synliga
    { slug: 'karlskronabibliotek', name: 'Karlskrona Stadsbibliotek', city: 'Karlskrona' }, // 2 ev i juli, 5 synliga
    { slug: 'klostretiystad', name: 'Klostret i Ystad', city: 'Ystad' }, // 2 ev i juli, 6 synliga
    { slug: 'karlskogakonsertforening', name: 'Karlskoga, Örebro län' }, // 2 ev i juli, 4 synliga
    { slug: 'jungbogard', name: 'Jungbo Gård', city: 'Enköping' }, // 2 ev i juli, 8 synliga
    { slug: 'jtmtrio', name: 'JTM Trio', city: 'Lycksele' }, // 2 ev i juli, 8 synliga
    { slug: 'GamlaUlleviArena', name: 'Jerry Olsson' }, // 2 ev i juli, 2 synliga
    { slug: 'vadhanderiuppsala', name: 'Händer i Uppsala', city: 'Uppsala' }, // 2 ev i juli, 6 synliga
    { slug: 'Hot.Events.Page.USA', name: 'Hot Events.' }, // 2 ev i juli, 8 synliga
    { slug: 'gretasgothenburg', name: 'Gretas Göteborg', city: 'Göteborg' }, // 2 ev i juli, 8 synliga
    { slug: 'CoopTorvalla', name: 'Happyrun -Trail - Östersund löpargrupp' }, // 2 ev i juli, 8 synliga
    { slug: 'gamlahalmstad', name: 'Gamla Halmstad', city: 'Halmstad' }, // 2 ev i juli, 3 synliga
    { slug: 'ayoshka.sun', name: 'Gnesta/Järna/Trosa DRUM CIRCLES' }, // 2 ev i juli, 8 synliga
    { slug: 'vastbosportdansklubb', name: 'Folkets Park Värnamo' }, // 2 ev i juli, 1 synliga
    { slug: 'eriksvik.finnkroken', name: 'Eriksvik' }, // 2 ev i juli, 5 synliga
    { slug: 'cecilia.arlebo', name: 'Cissi Ärlebo' }, // 2 ev i juli, 4 synliga
    { slug: 'Brannoforeningen', name: 'Brännöföreningen' }, // 2 ev i juli, 7 synliga
    { slug: 'bradspelskafeet', name: 'Brädspelskaféet', city: 'Karlshamn' }, // 2 ev i juli, 5 synliga
    { slug: 'GavleborgTaxklubb', name: 'Boulognerskogen, Gävle', city: 'Gävle' }, // 2 ev i juli, 8 synliga
    { slug: 'kfjamtland', name: 'Badhusparken Östersund' }, // 2 ev i juli, 7 synliga
    { slug: 'trivselbanan', name: 'Bollnästravet' }, // 2 ev i juli, 8 synliga
    { slug: 'gronalundstivoli', name: 'Bachata Uppsala', city: 'Lund' }, // 2 ev i juli, 8 synliga
    { slug: 'aspobygdegard', name: 'Aspö Bygdegård', city: 'Strängnäs' }, // 2 ev i juli, 8 synliga
    { slug: 'ArkenZooHalmstadStenalyckan', name: 'Arken Zoo', city: 'Halmstad' }, // 2 ev i juli, 2 synliga
    { slug: 'AsaBygdegard', name: 'Asa Bygdegård' }, // 2 ev i juli, 4 synliga
    { slug: 'arbogabio', name: 'Arboga bio' }, // 2 ev i juli, 2 synliga
    { slug: 'SvenskaDvarghundsklubben', name: 'Apalby IP' }, // 2 ev i juli, 2 synliga
];
