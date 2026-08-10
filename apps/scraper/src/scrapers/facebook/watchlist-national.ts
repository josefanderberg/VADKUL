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
    { slug: 'vaccin.sverige', name: 'Vaccin.nu', city: 'Lund' }, // 42 ev i juli, 8 synliga
    { slug: 'scensommar', name: 'Scensommar', city: 'Ljungby' }, // 30 ev i juli, 2 synliga
    { slug: 'Campingkul', name: 'Campingkul', city: 'Lidköping' }, // 30 ev i juli, 8 synliga
    { slug: 'taystase', name: 'Taysta', city: 'Stockholm' }, // 29 ev i juli, 8 synliga
    { slug: 'Vaxjodyksport', name: 'Växjödyksport', city: 'Växjö' }, // 17 ev i juli, 8 synliga
    { slug: 'ClassicCarWeek', name: 'Classic Car Week' }, // 17 ev i juli, 2 synliga
    { slug: 'ArrangemangLund', name: 'Arrangemang Lund', city: 'Lund' }, // 17 ev i juli, 5 synliga
    { slug: 'bohuslanguider', name: 'Bohusläns Guider' }, // 16 ev i juli, 8 synliga
    { slug: 'bioroy', name: 'Bio Roy' }, // 16 ev i juli, 8 synliga
    { slug: 'nfacademy', name: 'NF Academy' }, // 15 ev i juli, 4 synliga
    { slug: 'medeltidsmuseet', name: 'Medeltidsmuseet', city: 'Stockholm' }, // 14 ev i juli, 8 synliga
    { slug: 'gretasgothenburg', name: 'Gretas Göteborg', city: 'Göteborg' }, // 14 ev i juli, 8 synliga
    { slug: 'gronalundstivoli', name: 'Gröna Lund', city: 'Stockholm' }, // 14 ev i juli, 8 synliga
    { slug: 'HotellHulingen', name: 'Hotell Hulingen' }, // 12 ev i juli, 8 synliga
    { slug: 'naturumSkrylle', name: 'naturum Skrylle' }, // 11 ev i juli, 3 synliga
    { slug: 'StNikolaikyrka', name: 'St Nikolai kyrka' }, // 11 ev i juli, 8 synliga
    { slug: 'sommarscen', name: 'Malmö Sommarscen' }, // 11 ev i juli, 5 synliga
    { slug: 'hotellbellevue', name: 'Hotell Bellevue' }, // 11 ev i juli, 7 synliga
    { slug: 'frimisorebro', name: 'Frimis' }, // 11 ev i juli, 8 synliga
    { slug: 'Faluguide', name: 'Faluguide', city: 'Falun' }, // 11 ev i juli, 1 synliga
    { slug: 'laughseats', name: 'Laugh Seats' }, // 11 ev i juli, 8 synliga
    { slug: 'caferosenhill', name: 'Café Rosenhill' }, // 11 ev i juli, 5 synliga
    { slug: 'kackelstugan', name: 'Kackelstugan' }, // 10 ev i juli, 3 synliga
    { slug: 'linkopingairswing', name: 'Dansbanan I Gamla Linköping', city: 'Linköping' }, // 10 ev i juli, 5 synliga
    { slug: 'rixfmfestival', name: 'RIX FM Festival', city: 'Stockholm' }, // 9 ev i juli, 5 synliga
    { slug: 'gamlahalmstad', name: 'Gamla Halmstad', city: 'Halmstad' }, // 9 ev i juli, 5 synliga
    { slug: 'vaniumeasida', name: 'Vän i Umeå' }, // 8 ev i juli, 7 synliga
    { slug: 'surfviken', name: 'Surfviken' }, // 8 ev i juli, 4 synliga
    { slug: 'solvesborgcsk', name: 'Stortorget Sölvesborg', city: 'Sölvesborg' }, // 8 ev i juli, 6 synliga
    { slug: 'vadhanderistockholm', name: 'Vad som händer i Stockholm', city: 'Stockholm' }, // 8 ev i juli, 6 synliga
    { slug: 'stenhusetgille', name: 'Stenhuset' }, // 8 ev i juli, 3 synliga
    { slug: 'stina.helmersson', name: 'Stina Helmersson', city: 'Olofström' }, // 8 ev i juli, 2 synliga
    { slug: 'rattvikbutchers', name: 'Rättvik Butchers' }, // 8 ev i juli, 3 synliga
    { slug: 'olearysgavle', name: 'O\'Learys Gävle', city: 'Gävle' }, // 8 ev i juli, 2 synliga
    { slug: 'redbullevents', name: 'Red Bull Events', city: 'Göteborg' }, // 8 ev i juli, 8 synliga
    { slug: 'klostretiystad', name: 'Klostret i Ystad', city: 'Ystad' }, // 8 ev i juli, 6 synliga
    { slug: 'susanne.swantesson', name: 'Alternativ-Mässa', city: 'Göteborg' }, // 8 ev i juli, 6 synliga
    { slug: 'jtmtrio', name: 'JTM Trio', city: 'Lycksele' }, // 8 ev i juli, 8 synliga
    { slug: 'tandsticksmuseet', name: 'Tändsticksmuseet', city: 'Jönköping' }, // 7 ev i juli, 4 synliga
    { slug: 'varlokal', name: 'Vår lokal' }, // 7 ev i juli, 8 synliga
    { slug: 'spokguiden', name: 'Spökguiden' }, // 7 ev i juli, 2 synliga
    { slug: 'trelleborgen', name: 'Trelleborgen', city: 'Trelleborg' }, // 7 ev i juli, 1 synliga
    { slug: 'Molekylverkstan', name: 'Molekylverkstan' }, // 7 ev i juli, 4 synliga
    { slug: 'anebybibliotek', name: 'Aneby bibliotek' }, // 7 ev i juli, 3 synliga
    { slug: 'vastanforsbandy', name: 'Västanforsbandy' }, // 6 ev i juli, 1 synliga
    { slug: 'upplevlandskronaven', name: 'Teaterparken' }, // 6 ev i juli, 2 synliga
    { slug: 'Alfredsspelobar', name: 'Stures Krog', city: 'Lidköping' }, // 6 ev i juli, 8 synliga
    { slug: 'tobbetrollkarl', name: 'Tobbe Trollkarl', city: 'Ystad' }, // 6 ev i juli, 8 synliga
    { slug: 'medborgarskolanjamtland', name: 'Medborgarskolan' }, // 6 ev i juli, 8 synliga
    { slug: 'frilandsmusset', name: 'Fiskartorpet' }, // 6 ev i juli, 4 synliga
    { slug: 'engelholmsrevyn', name: 'Engelholmsrevyn' }, // 6 ev i juli, 8 synliga
    { slug: 'vasterascity', name: 'Västerås City', city: 'Västerås' }, // 5 ev i juli, 7 synliga
    { slug: 'Upplandsmuseet', name: 'Upplandsmuseet', city: 'Uppsala' }, // 5 ev i juli, 8 synliga
    { slug: 'visitkumla', name: 'Visit Kumla' }, // 5 ev i juli, 1 synliga
    { slug: 'junisalvsborgdistrikt', name: 'Movendi Älvsborg', city: 'Borås' }, // 5 ev i juli, 1 synliga
    { slug: 'mats.fuchs.9', name: 'Mats Fuchs' }, // 5 ev i juli, 1 synliga
    { slug: 'VeloxSkane', name: 'Malmö airsoft Indoor Arena' }, // 5 ev i juli, 2 synliga
    { slug: 'LukeCombs', name: 'Luke Combs' }, // 5 ev i juli, 8 synliga
    { slug: 'Kungalvsparken', name: 'Kungälvs Parken' }, // 5 ev i juli, 8 synliga
    { slug: 'roselandvisby', name: 'Kruttornet' }, // 5 ev i juli, 1 synliga
    { slug: 'konstmuseet', name: 'Konstmuseet', city: 'Skövde' }, // 5 ev i juli, 4 synliga
    { slug: 'boulognerskogenparkrun', name: 'Boulognerskogen, Gävle', city: 'Gävle' }, // 5 ev i juli, 5 synliga
    { slug: 'bally.love.1', name: 'Bally Love', city: 'Kalmar' }, // 5 ev i juli, 8 synliga
    { slug: 'MalinNilssonMagician', name: 'Varieté Voljär', city: 'Simrishamn' }, // 4 ev i juli, 1 synliga
    { slug: 'yoganovisen', name: 'YogaNovisen' }, // 4 ev i juli, 8 synliga
    { slug: 'meraloppis', name: 'Ulf Andersson' }, // 4 ev i juli, 3 synliga
    { slug: 'Tangokompaniet', name: 'Tangokompaniet' }, // 4 ev i juli, 5 synliga
    { slug: 'swedenrunners', name: 'Sweden Runners', city: 'Borlänge' }, // 4 ev i juli, 8 synliga
    { slug: 'steelhotelsmedjebacken', name: 'Steel Hotel' }, // 4 ev i juli, 4 synliga
    { slug: 'skovdekulturhus', name: 'Skövde Kulturhus', city: 'Skövde' }, // 4 ev i juli, 8 synliga
    { slug: 'Palmfestivalen', name: 'Palmfestivalen' }, // 4 ev i juli, 4 synliga
    { slug: 'juan.c.diaz.906', name: 'Paddla SUP & Tälta i Sverige' }, // 4 ev i juli, 8 synliga
    { slug: 'nederlulea', name: 'Nederluleå kyrka' }, // 4 ev i juli, 6 synliga
    { slug: 'vadhanderiuppsala', name: 'Händer i Uppsala', city: 'Uppsala' }, // 4 ev i juli, 7 synliga
    { slug: 'Droskan.se', name: 'DROSKAN' }, // 4 ev i juli, 4 synliga
    { slug: 'BrygganSMB', name: 'Bryggan' }, // 4 ev i juli, 1 synliga
    { slug: 'bradspelskafeet', name: 'Brädspelskaféet', city: 'Karlshamn' }, // 4 ev i juli, 3 synliga
    { slug: 'rolfsbuss', name: 'Boulognerskogen' }, // 4 ev i juli, 4 synliga
    { slug: 'jessica.yngvesson', name: 'Ängelholms hembygdspark' }, // 3 ev i juli, 8 synliga
    { slug: 'wijtradgardar', name: 'Wij Trädgårdar' }, // 3 ev i juli, 2 synliga
    { slug: 'vaxjoloparklubb', name: 'Växjö Löparklubb' }, // 3 ev i juli, 1 synliga
    { slug: 'VadstenaAkademien', name: 'Vadstena klosterkyrka' }, // 3 ev i juli, 2 synliga
    { slug: 'ungitibro', name: 'UngiTibro' }, // 3 ev i juli, 2 synliga
    { slug: 'TillsammansHoor', name: 'Tillsammans Höör' }, // 3 ev i juli, 6 synliga
    { slug: 'TheTivoli', name: 'The Tivoli', city: 'Helsingborg' }, // 3 ev i juli, 8 synliga
    { slug: 'soderkopingsbio', name: 'Söderköpings Bio' }, // 3 ev i juli, 2 synliga
    { slug: 'stalpet', name: 'Stalpet' }, // 3 ev i juli, 4 synliga
    { slug: 'kulturfritidtrelleborg', name: 'Stadsparken Trelleborg', city: 'Trelleborg' }, // 3 ev i juli, 3 synliga
    { slug: 'conventumorebro', name: 'Sommarlovskul.se' }, // 3 ev i juli, 8 synliga
    { slug: 'silvenska', name: 'Silvénska villan' }, // 3 ev i juli, 1 synliga
    { slug: 'RewellMedical', name: 'Rewell Medical', city: 'Vimmerby' }, // 3 ev i juli, 7 synliga
    { slug: 'norrvikenbastad', name: 'Norrviken' }, // 3 ev i juli, 1 synliga
    { slug: 'kulturfritidystad', name: 'Norra Promenaden Ystad', city: 'Ystad' }, // 3 ev i juli, 5 synliga
    { slug: 'movehomesverige', name: 'Movehome', city: 'Sundsvall' }, // 3 ev i juli, 2 synliga
    { slug: '1mr.langos', name: 'Mr.Lángos', city: 'Kalmar' }, // 3 ev i juli, 8 synliga
    { slug: 'MittsverigebananHarnosand', name: 'Mittsverigebanan', city: 'Härnösand' }, // 3 ev i juli, 3 synliga
    { slug: 'Mamasrestaurang', name: 'Mama’s' }, // 3 ev i juli, 5 synliga
    { slug: 'malmomuseum', name: 'Malmö museum', city: 'Malmö' }, // 3 ev i juli, 2 synliga
    { slug: 'mkrs.se', name: 'MKRS' }, // 3 ev i juli, 8 synliga
    { slug: 'malnhavochkrog', name: 'MALN Hav & Krog', city: 'Hudiksvall' }, // 3 ev i juli, 8 synliga
    { slug: 'lotti.lundblad', name: 'Lotti Lundblad' }, // 3 ev i juli, 8 synliga
    { slug: 'laila.amrouche', name: 'Laila Amrouche', city: 'Uddevalla' }, // 3 ev i juli, 8 synliga
    { slug: 'LiveEventRadar', name: 'Live Event Radar' }, // 3 ev i juli, 8 synliga
    { slug: 'Karlskronacity', name: 'Karlskrona City', city: 'Karlskrona' }, // 3 ev i juli, 3 synliga
    { slug: 'GavleRave', name: 'Gävle, Gävleborgs län', city: 'Gävle' }, // 3 ev i juli, 6 synliga
    { slug: 'bortansikolympia', name: 'Gunnarskog, Värmland' }, // 3 ev i juli, 8 synliga
    { slug: 'HaboWolley', name: 'Habo Wolley' }, // 3 ev i juli, 6 synliga
    { slug: 'gotlandsmuseum', name: 'Gotlands Museum', city: 'Visby' }, // 3 ev i juli, 6 synliga
    { slug: 'vastbosportdansklubb', name: 'Folkets Park Värnamo' }, // 3 ev i juli, 1 synliga
    { slug: 'Brannoforeningen', name: 'Brännöföreningen' }, // 3 ev i juli, 8 synliga
    { slug: 'alvsbyn', name: 'Älvsbyn' }, // 2 ev i juli, 1 synliga
    { slug: 'christian.andersson.3150', name: 'Östergötlands Rc trail sällskap' }, // 2 ev i juli, 8 synliga
    { slug: 'Bipolarforeningen.Norge', name: 'https://www.facebook.com/groups/' }, // 2 ev i juli, 8 synliga
    { slug: 'webnode.se', name: 'YogaKajsa', city: 'Eslöv' }, // 2 ev i juli, 8 synliga
    { slug: 'vatmoro', name: 'Våt Moro' }, // 2 ev i juli, 1 synliga
    { slug: 'vendeltegelsmora', name: 'Vendels kyrka' }, // 2 ev i juli, 8 synliga
    { slug: 'UpplevSkovde', name: 'Upplev Skövde', city: 'Skövde' }, // 2 ev i juli, 8 synliga
    { slug: 'upplevalingsas', name: 'Upplev Alingsås', city: 'Alingsås' }, // 2 ev i juli, 4 synliga
    { slug: 'trivselhussverige', name: 'Trivselhus' }, // 2 ev i juli, 2 synliga
    { slug: 'TormekSharpeningInnovation', name: 'Tormek', city: 'Lindesberg' }, // 2 ev i juli, 2 synliga
    { slug: 'teatersat', name: 'Teater SAT' }, // 2 ev i juli, 2 synliga
    { slug: 'Tarabband', name: 'TARABBAND', city: 'Stockholm' }, // 2 ev i juli, 2 synliga
    { slug: 'sapboden', name: 'Svartbygården' }, // 2 ev i juli, 8 synliga
    { slug: 'hotellkarlshamn', name: 'Stortorget Karlshamn', city: 'Karlshamn' }, // 2 ev i juli, 8 synliga
    { slug: '3x3.se', name: 'Stora Torget, Borås', city: 'Borås' }, // 2 ev i juli, 2 synliga
    { slug: 'stromstadkommun', name: 'Stadsparken' }, // 2 ev i juli, 5 synliga
    { slug: 'sprangsten', name: 'Sprängsten' }, // 2 ev i juli, 2 synliga
    { slug: 'Skadibmt', name: 'Skadi' }, // 2 ev i juli, 8 synliga
    { slug: 'scenosterlen', name: 'Scen Österlen', city: 'Simrishamn' }, // 2 ev i juli, 2 synliga
    { slug: 'sagabioflen', name: 'Saga Bio, Flen' }, // 2 ev i juli, 1 synliga
    { slug: 'sdknacken', name: 'SDK Näcken', city: 'Katrineholm' }, // 2 ev i juli, 2 synliga
    { slug: 'timrabhk', name: 'SBK mellannorrlands Unga med Hundar' }, // 2 ev i juli, 8 synliga
    { slug: 'ReStoredSE', name: 'RESTORED' }, // 2 ev i juli, 4 synliga
    { slug: 'pumpenairsoft', name: 'Pumpen Airsoft', city: 'Nybro' }, // 2 ev i juli, 1 synliga
    { slug: 'Lillagasthamnen', name: 'Partyrollers 2.0' }, // 2 ev i juli, 8 synliga
    { slug: 'kavlingeoldtimespub', name: 'Old Times Pub' }, // 2 ev i juli, 7 synliga
    { slug: 'norabuggarna', name: 'Norabuggarna', city: 'Nora' }, // 2 ev i juli, 1 synliga
    { slug: 'anders.djerf', name: 'Norrtälje - Vad händer på byn?', city: 'Norrtälje' }, // 2 ev i juli, 6 synliga
    { slug: 'nipyran', name: 'Nipyran' }, // 2 ev i juli, 8 synliga
    { slug: 'Moveat.Sweden', name: 'Moveat', city: 'Stockholm' }, // 2 ev i juli, 8 synliga
    { slug: 'mjolbykommun', name: 'Mjölby kommun', city: 'Mjölby' }, // 2 ev i juli, 1 synliga
    { slug: 'teslaownerssweden', name: 'Lycksele, Västerbottens län', city: 'Lycksele' }, // 2 ev i juli, 8 synliga
    { slug: 'lisebergab', name: 'Liseberg' }, // 2 ev i juli, 7 synliga
    { slug: 'kulturnoje', name: 'Kultur & Nöje' }, // 2 ev i juli, 2 synliga
    { slug: 'kraxagarden', name: 'Kraxagården' }, // 2 ev i juli, 8 synliga
    { slug: 'bjorkholmensbyalag', name: 'Karlskrona, Blekinge län', city: 'Karlskrona' }, // 2 ev i juli, 1 synliga
    { slug: 'karlskronabibliotek', name: 'Karlskrona Stadsbibliotek', city: 'Karlskrona' }, // 2 ev i juli, 3 synliga
    { slug: 'jallsjo', name: 'Jällsjö Gård' }, // 2 ev i juli, 1 synliga
    { slug: 'iamjuuth', name: 'Juuth' }, // 2 ev i juli, 1 synliga
    { slug: 'jazzimalmo', name: 'Jazz i Malmö' }, // 2 ev i juli, 8 synliga
    { slug: 'AvrilPsychic', name: 'Höör, Skåne län' }, // 2 ev i juli, 1 synliga
    { slug: 'etologica', name: 'Härnösand, Västernorrlands län', city: 'Härnösand' }, // 2 ev i juli, 1 synliga
    { slug: 'hyltebiblioteken', name: 'Hyltebiblioteken' }, // 2 ev i juli, 5 synliga
    { slug: 'fritidibjuv', name: 'Fritid i Bjuv' }, // 2 ev i juli, 2 synliga
    { slug: 'FeverUpES', name: 'Fever', city: 'Stockholm' }, // 2 ev i juli, 8 synliga
    { slug: 'fchessleholm', name: 'FC Hessleholm', city: 'Hässleholm' }, // 2 ev i juli, 5 synliga
    { slug: 'eriksvik.finnkroken', name: 'Eriksvik' }, // 2 ev i juli, 5 synliga
    { slug: 'Dansalliansen', name: 'Dansalliansen' }, // 2 ev i juli, 8 synliga
    { slug: 'Dahlenkullan', name: 'Dahlénkullan' }, // 2 ev i juli, 1 synliga
    { slug: 'dalarnasmuseum', name: 'Dalarnas museum', city: 'Falun' }, // 2 ev i juli, 5 synliga
    { slug: 'skellefteamuseum', name: 'Bonnstan' }, // 2 ev i juli, 3 synliga
    { slug: 'strawberryarena', name: 'Best Music' }, // 2 ev i juli, 8 synliga
    { slug: 'kfjamtland', name: 'Badhusparken Östersund' }, // 2 ev i juli, 7 synliga
    { slug: 'aspobygdegard', name: 'Aspö Bygdegård', city: 'Strängnäs' }, // 2 ev i juli, 8 synliga
    { slug: 'AsaBygdegard', name: 'Asa Bygdegård' }, // 2 ev i juli, 4 synliga
    { slug: 'arbogabio', name: 'Arboga bio' }, // 2 ev i juli, 1 synliga
    { slug: 'SvenskaDvarghundsklubben', name: 'Apalby IP' }, // 2 ev i juli, 2 synliga
    { slug: 'ArkenZooHalmstadStenalyckan', name: 'Arken Zoo', city: 'Halmstad' }, // 2 ev i juli, 1 synliga
    { slug: 'antonshusautism', name: 'Antons Hus' }, // 2 ev i juli, 7 synliga
    { slug: 'alltidtjorn', name: 'Alltid Tjörn' }, // 2 ev i juli, 1 synliga
    { slug: 'almsgard', name: 'Alms Gård' }, // 2 ev i juli, 2 synliga
    { slug: 'alingsasparken', name: 'Alingsås Parken', city: 'Alingsås' }, // 2 ev i juli, 7 synliga
    { slug: 'ABFsorm', name: 'ABF Sörmland', city: 'Katrineholm' }, // 2 ev i juli, 8 synliga
    { slug: 'alexeklundofficial', name: 'Alex Eklund', city: 'Eskilstuna' }, // 2 ev i juli, 3 synliga
    { slug: 'abfnorrtalje', name: 'ABF Norrtälje', city: 'Norrtälje' }, // 2 ev i juli, 6 synliga
];
