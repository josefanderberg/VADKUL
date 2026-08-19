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
    { slug: 'vaccin.sverige', name: 'Vaccin.nu', city: 'Vimmerby' }, // 49 ev i juli, 8 synliga
    { slug: 'taystase', name: 'Taysta', city: 'Stockholm' }, // 42 ev i juli, 8 synliga
    { slug: 'LiveEventRadar', name: 'Live Event Radar' }, // 41 ev i juli, 8 synliga
    { slug: 'scensommar', name: 'Scensommar', city: 'Ljungby' }, // 30 ev i juli, 8 synliga
    { slug: 'Campingkul', name: 'Campingkul', city: 'Lidköping' }, // 28 ev i juli, 8 synliga
    { slug: 'Vaxjodyksport', name: 'Växjödyksport', city: 'Växjö' }, // 24 ev i juli, 8 synliga
    { slug: 'feverup', name: 'Fever', city: 'Stockholm' }, // 24 ev i juli, 8 synliga
    { slug: 'bioroy', name: 'Bio Roy' }, // 23 ev i juli, 8 synliga
    { slug: 'bohuslanguider', name: 'Bohusläns Guider' }, // 21 ev i juli, 8 synliga
    { slug: 'laughseats', name: 'Laugh Seats' }, // 20 ev i juli, 8 synliga
    { slug: 'vadhanderistockholm', name: 'Vad som händer i Stockholm', city: 'Stockholm' }, // 18 ev i juli, 5 synliga
    { slug: 'medborgarskolanjamtland', name: 'Medborgarskolan' }, // 18 ev i juli, 8 synliga
    { slug: 'gronalundstivoli', name: 'Gröna Lund', city: 'Stockholm' }, // 16 ev i juli, 8 synliga
    { slug: 'nfacademy', name: 'NF Academy' }, // 15 ev i juli, 8 synliga
    { slug: 'gretasgothenburg', name: 'Gretas Göteborg', city: 'Göteborg' }, // 15 ev i juli, 8 synliga
    { slug: 'ClassicCarWeek', name: 'Classic Car Week' }, // 15 ev i juli, 4 synliga
    { slug: 'ArrangemangLund', name: 'Arrangemang Lund', city: 'Lund' }, // 14 ev i juli, 5 synliga
    { slug: 'medeltidsmuseet', name: 'Medeltidsmuseet', city: 'Stockholm' }, // 13 ev i juli, 8 synliga
    { slug: 'gotlandsmuseum', name: 'Gotlands Museum', city: 'Visby' }, // 13 ev i juli, 8 synliga
    { slug: 'lisebergab', name: 'Liseberg' }, // 13 ev i juli, 6 synliga
    { slug: 'vaniumeasida', name: 'Vän i Umeå' }, // 12 ev i juli, 7 synliga
    { slug: 'StNikolaikyrka', name: 'St Nikolai kyrka' }, // 11 ev i juli, 7 synliga
    { slug: 'ABFsorm', name: 'ABF Sörmland', city: 'Eskilstuna' }, // 11 ev i juli, 8 synliga
    { slug: 'jtmtrio', name: 'JTM Trio', city: 'Lycksele' }, // 11 ev i juli, 8 synliga
    { slug: 'naturumSkrylle', name: 'naturum Skrylle' }, // 10 ev i juli, 1 synliga
    { slug: 'redbullevents', name: 'Red Bull Events', city: 'Norrköping' }, // 10 ev i juli, 8 synliga
    { slug: 'klostretiystad', name: 'Klostret i Ystad', city: 'Ystad' }, // 10 ev i juli, 1 synliga
    { slug: 'kackelstugan', name: 'Kackelstugan' }, // 10 ev i juli, 3 synliga
    { slug: 'hotellbellevue', name: 'Hotell Bellevue' }, // 10 ev i juli, 6 synliga
    { slug: 'frimisorebro', name: 'Frimis' }, // 10 ev i juli, 8 synliga
    { slug: 'Faluguide', name: 'Faluguide', city: 'Falun' }, // 10 ev i juli, 1 synliga
    { slug: 'caferosenhill', name: 'Café Rosenhill' }, // 10 ev i juli, 3 synliga
    { slug: 'vasterascity', name: 'Västerås City', city: 'Västerås' }, // 9 ev i juli, 8 synliga
    { slug: 'swedenrunners', name: 'Sweden Runners', city: 'Göteborg' }, // 9 ev i juli, 4 synliga
    { slug: 'solvesborgcsk', name: 'Stortorget Sölvesborg', city: 'Sölvesborg' }, // 9 ev i juli, 8 synliga
    { slug: 'rixfmfestival', name: 'RIX FM Festival', city: 'Stockholm' }, // 9 ev i juli, 2 synliga
    { slug: 'linkopingairswing', name: 'Dansbanan I Gamla Linköping', city: 'Linköping' }, // 9 ev i juli, 6 synliga
    { slug: 'anebybibliotek', name: 'Aneby bibliotek' }, // 9 ev i juli, 5 synliga
    { slug: 'UpplevSkovde', name: 'Upplev Skövde', city: 'Skövde' }, // 8 ev i juli, 8 synliga
    { slug: 'tobbetrollkarl', name: 'Tobbe Trollkarl', city: 'Ystad' }, // 8 ev i juli, 8 synliga
    { slug: 'varlokal', name: 'Vår lokal' }, // 8 ev i juli, 8 synliga
    { slug: 'stina.helmersson', name: 'Stina Helmersson', city: 'Olofström' }, // 8 ev i juli, 8 synliga
    { slug: 'Moveat.Sweden', name: 'Moveat', city: 'Stockholm' }, // 8 ev i juli, 8 synliga
    { slug: 'gamlahalmstad', name: 'Gamla Halmstad', city: 'Halmstad' }, // 8 ev i juli, 3 synliga
    { slug: 'HotellHulingen', name: 'Hotell Hulingen' }, // 8 ev i juli, 8 synliga
    { slug: 'dalarnasmuseum', name: 'Dalarnas museum', city: 'Falun' }, // 8 ev i juli, 4 synliga
    { slug: 'susanne.swantesson', name: 'Alternativ-Mässa', city: 'Göteborg' }, // 8 ev i juli, 6 synliga
    { slug: 'alingsasparken', name: 'Alingsås Parken', city: 'Alingsås' }, // 8 ev i juli, 7 synliga
    { slug: 'tandsticksmuseet', name: 'Tändsticksmuseet', city: 'Jönköping' }, // 7 ev i juli, 4 synliga
    { slug: 'junisalvsborgdistrikt', name: 'Movendi Älvsborg', city: 'Borås' }, // 7 ev i juli, 3 synliga
    { slug: 'RewellMedical', name: 'Rewell Medical', city: 'Arvika' }, // 7 ev i juli, 5 synliga
    { slug: 'spokguiden', name: 'Spökguiden' }, // 7 ev i juli, 5 synliga
    { slug: 'sommarscen', name: 'Malmö Sommarscen' }, // 7 ev i juli, 5 synliga
    { slug: 'Molekylverkstan', name: 'Molekylverkstan' }, // 7 ev i juli, 4 synliga
    { slug: 'hyltebiblioteken', name: 'Hyltebiblioteken' }, // 7 ev i juli, 8 synliga
    { slug: 'HaboWolley', name: 'Habo Wolley' }, // 7 ev i juli, 4 synliga
    { slug: 'Bipolarforeningen.Norge', name: 'https://www.facebook.com/groups/' }, // 6 ev i juli, 7 synliga
    { slug: 'vastanforsbandy', name: 'Västanforsbandy' }, // 6 ev i juli, 1 synliga
    { slug: 'upplevalingsas', name: 'Upplev Alingsås', city: 'Alingsås' }, // 6 ev i juli, 3 synliga
    { slug: 'surfviken', name: 'Surfviken' }, // 6 ev i juli, 3 synliga
    { slug: 'olearysgavle', name: 'O\'Learys Gävle', city: 'Gävle' }, // 6 ev i juli, 2 synliga
    { slug: 'stenhusetgille', name: 'Stenhuset' }, // 6 ev i juli, 4 synliga
    { slug: 'VeloxSkane', name: 'Malmö airsoft Indoor Arena' }, // 6 ev i juli, 2 synliga
    { slug: 'laila.amrouche', name: 'Laila Amrouche', city: 'Uddevalla' }, // 6 ev i juli, 8 synliga
    { slug: 'jazzimalmo', name: 'Jazz i Malmö' }, // 6 ev i juli, 3 synliga
    { slug: 'Dansalliansen', name: 'Dansalliansen' }, // 6 ev i juli, 8 synliga
    { slug: 'boulognerskogenparkrun', name: 'Boulognerskogen, Gävle', city: 'Gävle' }, // 6 ev i juli, 5 synliga
    { slug: 'vaxjoloparklubb', name: 'Växjö Löparklubb' }, // 5 ev i juli, 2 synliga
    { slug: 'meraloppis', name: 'Ulf Andersson' }, // 5 ev i juli, 3 synliga
    { slug: 'trelleborgen', name: 'Trelleborgen', city: 'Trelleborg' }, // 5 ev i juli, 1 synliga
    { slug: 'Alfredsspelobar', name: 'Stures Krog', city: 'Lidköping' }, // 5 ev i juli, 1 synliga
    { slug: 'kavlingeoldtimespub', name: 'Old Times Pub' }, // 5 ev i juli, 8 synliga
    { slug: 'mats.fuchs.9', name: 'Mats Fuchs' }, // 5 ev i juli, 1 synliga
    { slug: 'LukeCombs', name: 'Luke Combs' }, // 5 ev i juli, 8 synliga
    { slug: 'Ljudaborg', name: 'Ljudaborg' }, // 5 ev i juli, 2 synliga
    { slug: 'frilandsmusset', name: 'Fiskartorpet' }, // 5 ev i juli, 4 synliga
    { slug: 'Kungalvsparken', name: 'Kungälvs Parken' }, // 5 ev i juli, 7 synliga
    { slug: 'fchessleholm', name: 'FC Hessleholm', city: 'Hässleholm' }, // 5 ev i juli, 4 synliga
    { slug: 'bradspelskafeet', name: 'Brädspelskaféet', city: 'Karlshamn' }, // 5 ev i juli, 3 synliga
    { slug: 'bally.love.1', name: 'Bally Love', city: 'Kalmar' }, // 5 ev i juli, 8 synliga
    { slug: 'alvsbyn', name: 'Älvsbyn' }, // 4 ev i juli, 3 synliga
    { slug: 'Upplandsmuseet', name: 'Upplandsmuseet', city: 'Uppsala' }, // 4 ev i juli, 7 synliga
    { slug: 'TormekSharpeningInnovation', name: 'Tormek', city: 'Lindesberg' }, // 4 ev i juli, 2 synliga
    { slug: 'Tangokompaniet', name: 'Tangokompaniet' }, // 4 ev i juli, 4 synliga
    { slug: 'teatersat', name: 'Teater SAT' }, // 4 ev i juli, 2 synliga
    { slug: 'upplevlandskronaven', name: 'Teaterparken' }, // 4 ev i juli, 2 synliga
    { slug: 'sapboden', name: 'Svartbygården' }, // 4 ev i juli, 6 synliga
    { slug: 'skovdekulturhus', name: 'Skövde Kulturhus', city: 'Skövde' }, // 4 ev i juli, 8 synliga
    { slug: 'sagabioflen', name: 'Saga Bio, Flen' }, // 4 ev i juli, 2 synliga
    { slug: 'ReStoredSE', name: 'RESTORED' }, // 4 ev i juli, 2 synliga
    { slug: 'Palmfestivalen', name: 'Palmfestivalen' }, // 4 ev i juli, 4 synliga
    { slug: 'nederlulea', name: 'Nederluleå kyrka' }, // 4 ev i juli, 4 synliga
    { slug: 'mejeriet', name: 'Mejeriet', city: 'Lund' }, // 4 ev i juli, 5 synliga
    { slug: 'Karlskronacity', name: 'Karlskrona City', city: 'Karlskrona' }, // 4 ev i juli, 2 synliga
    { slug: 'roselandvisby', name: 'Kruttornet' }, // 4 ev i juli, 1 synliga
    { slug: '100063649326993', name: 'Golftillsammans', city: 'Borås' }, // 4 ev i juli, 8 synliga
    { slug: 'engelholmsrevyn', name: 'Engelholmsrevyn' }, // 4 ev i juli, 8 synliga
    { slug: 'Dahlenkullan', name: 'Dahlénkullan' }, // 4 ev i juli, 1 synliga
    { slug: 'Droskan.se', name: 'DROSKAN' }, // 4 ev i juli, 4 synliga
    { slug: 'almsgard', name: 'Alms Gård' }, // 4 ev i juli, 2 synliga
    { slug: 'BrygganSMB', name: 'Bryggan' }, // 4 ev i juli, 1 synliga
    { slug: 'atobeyondparkour', name: 'A-Beyond Parkour' }, // 4 ev i juli, 8 synliga
    { slug: 'jessica.yngvesson', name: 'Ängelholms hembygdspark' }, // 3 ev i juli, 8 synliga
    { slug: 'yoganovisen', name: 'YogaNovisen' }, // 3 ev i juli, 8 synliga
    { slug: 'visitkumla', name: 'Visit Kumla' }, // 3 ev i juli, 2 synliga
    { slug: 'MalinNilssonMagician', name: 'Varieté Voljär', city: 'Simrishamn' }, // 3 ev i juli, 1 synliga
    { slug: 'trivselhussverige', name: 'Trivselhus' }, // 3 ev i juli, 2 synliga
    { slug: 'VadstenaAkademien', name: 'Vadstena klosterkyrka' }, // 3 ev i juli, 1 synliga
    { slug: 'TheTivoli', name: 'The Tivoli', city: 'Helsingborg' }, // 3 ev i juli, 8 synliga
    { slug: 'TillsammansHoor', name: 'Tillsammans Höör' }, // 3 ev i juli, 1 synliga
    { slug: 'stalpet', name: 'Stalpet' }, // 3 ev i juli, 3 synliga
    { slug: 'silvenska', name: 'Silvénska villan' }, // 3 ev i juli, 1 synliga
    { slug: 'snackan.nu', name: 'Snäckan', city: 'Klintehamn' }, // 3 ev i juli, 2 synliga
    { slug: 'juan.c.diaz.906', name: 'Paddla SUP & Tälta i Sverige' }, // 3 ev i juli, 8 synliga
    { slug: 'norrvikenbastad', name: 'Norrviken' }, // 3 ev i juli, 1 synliga
    { slug: 'kulturfritidystad', name: 'Norra Promenaden Ystad', city: 'Ystad' }, // 3 ev i juli, 2 synliga
    { slug: '1mr.langos', name: 'Mr.Lángos', city: 'Kalmar' }, // 3 ev i juli, 1 synliga
    { slug: 'movehomesverige', name: 'Movehome', city: 'Sundsvall' }, // 3 ev i juli, 1 synliga
    { slug: 'malmomuseum', name: 'Malmö museum', city: 'Malmö' }, // 3 ev i juli, 1 synliga
    { slug: 'konstmuseet', name: 'Konstmuseet', city: 'Skövde' }, // 3 ev i juli, 4 synliga
    { slug: 'Glimmingehus', name: 'Glimmingehus' }, // 3 ev i juli, 4 synliga
    { slug: 'ikanobostad', name: 'Ikano Bostad' }, // 3 ev i juli, 8 synliga
    { slug: 'Brannoforeningen', name: 'Brännöföreningen' }, // 3 ev i juli, 8 synliga
    { slug: 'rolfsbuss', name: 'Boulognerskogen' }, // 3 ev i juli, 1 synliga
    { slug: 'skellefteamuseum', name: 'Bonnstan' }, // 3 ev i juli, 2 synliga
    { slug: 'baravanlig.se', name: 'Bara Vanlig', city: 'Lund' }, // 3 ev i juli, 4 synliga
    { slug: 'apollonsolna', name: 'Apollon Solna FK' }, // 3 ev i juli, 7 synliga
    { slug: 'alltidtjorn', name: 'Alltid Tjörn' }, // 3 ev i juli, 3 synliga
    { slug: 'alexeklundofficial', name: 'Alex Eklund', city: 'Eskilstuna' }, // 3 ev i juli, 2 synliga
    { slug: 'wijtradgardar', name: 'Wij Trädgårdar' }, // 2 ev i juli, 1 synliga
    { slug: 'vendeltegelsmora', name: 'Vendels kyrka' }, // 2 ev i juli, 8 synliga
    { slug: 'ungitibro', name: 'UngiTibro' }, // 2 ev i juli, 1 synliga
    { slug: 'umefox', name: 'UmeFox' }, // 2 ev i juli, 3 synliga
    { slug: 'taichichuanEFT', name: 'Tivoliparken, Kristianstad', city: 'Kristianstad' }, // 2 ev i juli, 6 synliga
    { slug: 'sunneairsoft', name: 'Sunne Airsoft' }, // 2 ev i juli, 1 synliga
    { slug: 'TicketDealsEurope', name: 'Ticket Deals' }, // 2 ev i juli, 8 synliga
    { slug: 'stromtorpsik', name: 'Strömtorps IK' }, // 2 ev i juli, 1 synliga
    { slug: '3x3.se', name: 'Stora Torget, Borås', city: 'Borås' }, // 2 ev i juli, 8 synliga
    { slug: 'lucas.harrysson', name: 'Stensjöns Samhällsförening' }, // 2 ev i juli, 1 synliga
    { slug: 'steelhotelsmedjebacken', name: 'Steel Hotel' }, // 2 ev i juli, 4 synliga
    { slug: 'sprangsten', name: 'Sprängsten' }, // 2 ev i juli, 1 synliga
    { slug: 'spiritofmansweden', name: 'Spirit of Man' }, // 2 ev i juli, 3 synliga
    { slug: 'conventumorebro', name: 'Sommarlovskul.se' }, // 2 ev i juli, 8 synliga
    { slug: 'Skadibmt', name: 'Skadi' }, // 2 ev i juli, 8 synliga
    { slug: 'orebrolansmuseum', name: 'Siggebohyttans Bergsmansgård' }, // 2 ev i juli, 3 synliga
    { slug: 'scenosterlen', name: 'Scen Österlen', city: 'Simrishamn' }, // 2 ev i juli, 2 synliga
    { slug: 'Smcostergotland', name: 'SMC Östergötland' }, // 2 ev i juli, 2 synliga
    { slug: 'sdknacken', name: 'SDK Näcken', city: 'Katrineholm' }, // 2 ev i juli, 2 synliga
    { slug: 'timrabhk', name: 'SBK mellannorrlands Unga med Hundar' }, // 2 ev i juli, 8 synliga
    { slug: 'RonnbyTigers', name: 'Rönnby Tigers', city: 'Västerås' }, // 2 ev i juli, 8 synliga
    { slug: 'quiztyreso', name: 'QUIZ - Tyresö' }, // 2 ev i juli, 1 synliga
    { slug: 'pinkprogramming', name: 'Pink Programming', city: 'Hässleholm' }, // 2 ev i juli, 2 synliga
    { slug: 'peterj0hanss0n', name: 'Peter Johansson' }, // 2 ev i juli, 3 synliga
    { slug: 'rotundan.nynas', name: 'Partyrollers 2.0' }, // 2 ev i juli, 1 synliga
    { slug: 'ola.pettersson.39', name: 'Ola Pettersson', city: 'Norrtälje' }, // 2 ev i juli, 3 synliga
    { slug: 'norabuggarna', name: 'Norabuggarna', city: 'Nora' }, // 2 ev i juli, 4 synliga
    { slug: 'studieframjandetgastrikland', name: 'Naturskyddsföreningen Hofors - Torsåker' }, // 2 ev i juli, 4 synliga
    { slug: 'Mordmysterium', name: 'Mordmysterium' }, // 2 ev i juli, 6 synliga
    { slug: 'movendimjolby', name: 'Movendi Mjölby', city: 'Mjölby' }, // 2 ev i juli, 4 synliga
    { slug: 'moppehultsfred', name: 'Moppehultsfred' }, // 2 ev i juli, 1 synliga
    { slug: 'monarkmuseum', name: 'Monarkmuseum', city: 'Falkenberg' }, // 2 ev i juli, 1 synliga
    { slug: 'mjolbykommun', name: 'Mjölby kommun', city: 'Mjölby' }, // 2 ev i juli, 2 synliga
    { slug: 'MittsverigebananHarnosand', name: 'Mittsverigebanan', city: 'Härnösand' }, // 2 ev i juli, 3 synliga
    { slug: 'Mamasrestaurang', name: 'Mama’s' }, // 2 ev i juli, 5 synliga
    { slug: 'fridasrestaurang', name: 'Mats Westling', city: 'Simrishamn' }, // 2 ev i juli, 8 synliga
    { slug: 'malnhavochkrog', name: 'MALN Hav & Krog', city: 'Hudiksvall' }, // 2 ev i juli, 8 synliga
    { slug: 'teslaownerssweden', name: 'Lycksele, Västerbottens län', city: 'Lycksele' }, // 2 ev i juli, 8 synliga
    { slug: 'LokalaHjalpenVasteras', name: 'Lokala Hjälpen', city: 'Västerås' }, // 2 ev i juli, 4 synliga
    { slug: 'lommaflotten', name: 'LommaFlotten' }, // 2 ev i juli, 2 synliga
    { slug: 'kulturnoje', name: 'Kultur & Nöje' }, // 2 ev i juli, 1 synliga
    { slug: 'KappaBarMalmo', name: 'Kappa Bar Malmö' }, // 2 ev i juli, 4 synliga
    { slug: 'iamjuuth', name: 'Juuth' }, // 2 ev i juli, 1 synliga
    { slug: 'etologica', name: 'Härnösand, Västernorrlands län', city: 'Härnösand' }, // 2 ev i juli, 1 synliga
    { slug: 'hets.nu', name: 'Hässleholm Centralstation', city: 'Hässleholm' }, // 2 ev i juli, 8 synliga
    { slug: 'vadhanderiuppsala', name: 'Händer i Uppsala', city: 'Uppsala' }, // 2 ev i juli, 4 synliga
    { slug: 'EdvinBoyner', name: 'Hägernäs Strand' }, // 2 ev i juli, 1 synliga
    { slug: 'hjartatshus', name: 'Hjärtats hus', city: 'Jönköping' }, // 2 ev i juli, 6 synliga
    { slug: 'hemfranderome', name: 'Hem från Derome', city: 'Varberg' }, // 2 ev i juli, 1 synliga
    { slug: 'HarrysStenungsund', name: 'Harrys', city: 'Hässleholm' }, // 2 ev i juli, 3 synliga
    { slug: '61581592990656', name: 'Gustavs Skjul Orust' }, // 2 ev i juli, 7 synliga
    { slug: 'bortansikolympia', name: 'Gunnarskog, Värmland' }, // 2 ev i juli, 8 synliga
    { slug: 'fritidibjuv', name: 'Fritid i Bjuv' }, // 2 ev i juli, 2 synliga
    { slug: 'vastbosportdansklubb', name: 'Folkets Park Värnamo' }, // 2 ev i juli, 1 synliga
    { slug: 'jazzclubfasching', name: 'Fasching' }, // 2 ev i juli, 8 synliga
    { slug: 'eslovplus', name: 'Eslöv+', city: 'Eslöv' }, // 2 ev i juli, 5 synliga
    { slug: 'enkopingsmuseum', name: 'Enköpings museum', city: 'Enköping' }, // 2 ev i juli, 2 synliga
    { slug: 'Debasersthlm', name: 'Debaser', city: 'Stockholm' }, // 2 ev i juli, 6 synliga
    { slug: 'munkbuggarna', name: 'DF Munkbuggarna' }, // 2 ev i juli, 2 synliga
    { slug: 'borlangekommun', name: 'Borlänge kommun', city: 'Borlänge' }, // 2 ev i juli, 2 synliga
    { slug: 'ChubbyWaffleUmea', name: 'Chubby Waffle' }, // 2 ev i juli, 8 synliga
    { slug: 'bunkerihjortsberga', name: 'Bunker Bar' }, // 2 ev i juli, 8 synliga
    { slug: 'trivselbanan', name: 'Bollnästravet' }, // 2 ev i juli, 8 synliga
    { slug: 'barnicentrum', name: 'Barn i centrum' }, // 2 ev i juli, 1 synliga
    { slug: 'strawberryarena', name: 'Best Music' }, // 2 ev i juli, 8 synliga
    { slug: 'kfjamtland', name: 'Badhusparken Östersund' }, // 2 ev i juli, 7 synliga
    { slug: 'AvrilPsychic', name: 'Avril Intuitive' }, // 2 ev i juli, 1 synliga
    { slug: 'autismblekinge', name: 'Autism Blekinge', city: 'Karlshamn' }, // 2 ev i juli, 2 synliga
    { slug: 'AsaBygdegard', name: 'Asa Bygdegård' }, // 2 ev i juli, 4 synliga
    { slug: 'ArkenZooHalmstadStenalyckan', name: 'Arken Zoo', city: 'Halmstad' }, // 2 ev i juli, 1 synliga
    { slug: 'arenahagmyren', name: 'Arena Hagmyren', city: 'Hudiksvall' }, // 2 ev i juli, 2 synliga
    { slug: 'antonshusautism', name: 'Antons Hus' }, // 2 ev i juli, 7 synliga
    { slug: 'abfnorrtalje', name: 'ABF Norrtälje', city: 'Norrtälje' }, // 2 ev i juli, 8 synliga
    { slug: 'ABFKiruna', name: 'ABF Norr Kiruna', city: 'Kiruna' }, // 2 ev i juli, 8 synliga
];
