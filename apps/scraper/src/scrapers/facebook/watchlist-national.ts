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
    { slug: 'LiveEventRadar', name: 'Live Event Radar' }, // 85 ev i juli, 8 synliga
    { slug: 'feverup', name: 'Fever', city: 'Stockholm' }, // 53 ev i juli, 8 synliga
    { slug: 'taystase', name: 'Taysta', city: 'Stockholm' }, // 42 ev i juli, 8 synliga
    { slug: 'TicketDealsEurope', name: 'Ticket Deals' }, // 41 ev i juli, 8 synliga
    { slug: 'laughseats', name: 'Laugh Seats' }, // 34 ev i juli, 8 synliga
    { slug: 'scensommar', name: 'Scensommar' }, // 29 ev i juli, 8 synliga
    { slug: 'Vaxjodyksport', name: 'Växjödyksport', city: 'Växjö' }, // 28 ev i juli, 8 synliga
    { slug: 'Campingkul', name: 'Campingkul', city: 'Lidköping' }, // 27 ev i juli, 8 synliga
    { slug: 'bioroy', name: 'Bio Roy' }, // 23 ev i juli, 8 synliga
    { slug: 'vadhanderistockholm', name: 'Vad som händer i Stockholm', city: 'Stockholm' }, // 23 ev i juli, 5 synliga
    { slug: 'medborgarskolanjamtland', name: 'Medborgarskolan' }, // 21 ev i juli, 8 synliga
    { slug: 'bohuslanguider', name: 'Bohusläns Guider' }, // 20 ev i juli, 8 synliga
    { slug: 'ABFsorm', name: 'ABF Sörmland', city: 'Eskilstuna' }, // 20 ev i juli, 8 synliga
    { slug: 'gronalundstivoli', name: 'Gröna Lund', city: 'Stockholm' }, // 19 ev i juli, 8 synliga
    { slug: 'lisebergab', name: 'Liseberg' }, // 18 ev i juli, 8 synliga
    { slug: 'vaniumeasida', name: 'Vän i Umeå' }, // 16 ev i juli, 6 synliga
    { slug: 'gretasgothenburg', name: 'Gretas Göteborg', city: 'Göteborg' }, // 16 ev i juli, 8 synliga
    { slug: 'jazzclubfasching', name: 'Fasching' }, // 15 ev i juli, 7 synliga
    { slug: 'ArrangemangLund', name: 'Arrangemang Lund', city: 'Lund' }, // 15 ev i juli, 5 synliga
    { slug: 'naturumSkrylle', name: 'naturum Skrylle' }, // 14 ev i juli, 3 synliga
    { slug: 'nfacademy', name: 'NF Academy' }, // 14 ev i juli, 6 synliga
    { slug: 'medeltidsmuseet', name: 'Medeltidsmuseet', city: 'Stockholm' }, // 14 ev i juli, 8 synliga
    { slug: 'klostretiystad', name: 'Klostret i Ystad', city: 'Ystad' }, // 14 ev i juli, 5 synliga
    { slug: 'gotlandsmuseum', name: 'Gotlands Museum', city: 'Visby' }, // 14 ev i juli, 7 synliga
    { slug: 'hets.nu', name: 'Hässleholm Centralstation', city: 'Hässleholm' }, // 13 ev i juli, 7 synliga
    { slug: 'atobeyondparkour', name: 'A-Beyond Parkour' }, // 13 ev i juli, 8 synliga
    { slug: 'ClassicCarWeek', name: 'Classic Car Week' }, // 12 ev i juli, 2 synliga
    { slug: 'hyltebiblioteken', name: 'Hyltebiblioteken' }, // 12 ev i juli, 8 synliga
    { slug: 'StNikolaikyrka', name: 'St Nikolai kyrka' }, // 11 ev i juli, 5 synliga
    { slug: 'HotellHulingen', name: 'Hotell Hulingen' }, // 11 ev i juli, 8 synliga
    { slug: 'Moveat.Sweden', name: 'Moveat', city: 'Stockholm' }, // 11 ev i juli, 8 synliga
    { slug: 'frimisorebro', name: 'Frimis' }, // 11 ev i juli, 8 synliga
    { slug: 'anebybibliotek', name: 'Aneby bibliotek' }, // 11 ev i juli, 4 synliga
    { slug: 'UpplevSkovde', name: 'Upplev Skövde', city: 'Skövde' }, // 10 ev i juli, 8 synliga
    { slug: 'solvesborgcsk', name: 'Stortorget Sölvesborg', city: 'Sölvesborg' }, // 10 ev i juli, 3 synliga
    { slug: 'kackelstugan', name: 'Kackelstugan' }, // 10 ev i juli, 8 synliga
    { slug: 'jtmtrio', name: 'JTM Trio' }, // 10 ev i juli, 8 synliga
    { slug: 'hotellbellevue', name: 'Hotell Bellevue' }, // 10 ev i juli, 4 synliga
    { slug: 'dalarnasmuseum', name: 'Dalarnas museum', city: 'Falun' }, // 10 ev i juli, 5 synliga
    { slug: 'Bipolarforeningen.Norge', name: 'https://www.facebook.com/groups/' }, // 9 ev i juli, 7 synliga
    { slug: 'tobbetrollkarl', name: 'Tobbe Trollkarl', city: 'Västerås' }, // 9 ev i juli, 8 synliga
    { slug: 'swedenrunners', name: 'Sweden Runners', city: 'Göteborg' }, // 9 ev i juli, 8 synliga
    { slug: 'ikanobostad', name: 'Ikano Bostad', city: 'Uppsala' }, // 9 ev i juli, 8 synliga
    { slug: 'Dansalliansen', name: 'Dansalliansen' }, // 9 ev i juli, 8 synliga
    { slug: 'redbullevents', name: 'Red Bull Events' }, // 9 ev i juli, 8 synliga
    { slug: 'hjartatshus', name: 'Hjärtats hus', city: 'Jönköping' }, // 9 ev i juli, 6 synliga
    { slug: 'caferosenhill', name: 'Café Rosenhill' }, // 9 ev i juli, 1 synliga
    { slug: 'baravanlig.se', name: 'Bara Vanlig', city: 'Lund' }, // 9 ev i juli, 6 synliga
    { slug: 'ABFKiruna', name: 'ABF Norr Kiruna', city: 'Kiruna' }, // 9 ev i juli, 8 synliga
    { slug: 'rixfmfestival', name: 'RIX FM Festival', city: 'Stockholm' }, // 8 ev i juli, 1 synliga
    { slug: 'vasterascity', name: 'Västerås City', city: 'Västerås' }, // 8 ev i juli, 5 synliga
    { slug: 'junisalvsborgdistrikt', name: 'Movendi Älvsborg', city: 'Alingsås' }, // 8 ev i juli, 6 synliga
    { slug: 'gamlahalmstad', name: 'Gamla Halmstad', city: 'Halmstad' }, // 8 ev i juli, 1 synliga
    { slug: 'alingsasparken', name: 'Alingsås Parken', city: 'Alingsås' }, // 8 ev i juli, 8 synliga
    { slug: 'susanne.swantesson', name: 'Alternativ-Mässa', city: 'Göteborg' }, // 8 ev i juli, 6 synliga
    { slug: 'varlokal', name: 'Vår lokal' }, // 7 ev i juli, 8 synliga
    { slug: 'stina.helmersson', name: 'Stina Helmersson', city: 'Sölvesborg' }, // 7 ev i juli, 8 synliga
    { slug: 'upplevalingsas', name: 'Upplev Alingsås', city: 'Alingsås' }, // 7 ev i juli, 2 synliga
    { slug: 'stenhusetgille', name: 'Stenhuset' }, // 7 ev i juli, 4 synliga
    { slug: 'spokguiden', name: 'Spökguiden' }, // 7 ev i juli, 5 synliga
    { slug: 'RewellMedical', name: 'Rewell Medical', city: 'Arvika' }, // 7 ev i juli, 4 synliga
    { slug: 'kavlingeoldtimespub', name: 'Old Times Pub' }, // 7 ev i juli, 6 synliga
    { slug: 'Molekylverkstan', name: 'Molekylverkstan' }, // 7 ev i juli, 1 synliga
    { slug: 'mejeriet', name: 'Mejeriet', city: 'Lund' }, // 7 ev i juli, 5 synliga
    { slug: 'VeloxSkane', name: 'Malmö airsoft Indoor Arena' }, // 7 ev i juli, 2 synliga
    { slug: 'HaboWolley', name: 'Habo Wolley' }, // 7 ev i juli, 4 synliga
    { slug: 'Faluguide', name: 'Faluguide', city: 'Falun' }, // 7 ev i juli, 1 synliga
    { slug: 'linkopingairswing', name: 'Dansbanan I Gamla Linköping', city: 'Linköping' }, // 7 ev i juli, 5 synliga
    { slug: 'apollonsolna', name: 'Apollon Solna FK' }, // 7 ev i juli, 6 synliga
    { slug: 'tandsticksmuseet', name: 'Tändsticksmuseet', city: 'Jönköping' }, // 6 ev i juli, 3 synliga
    { slug: 'Upplandsmuseet', name: 'Upplandsmuseet', city: 'Uppsala' }, // 6 ev i juli, 8 synliga
    { slug: 'ReStoredSE', name: 'RESTORED' }, // 6 ev i juli, 3 synliga
    { slug: 'Mordmysterium', name: 'Mordmysterium' }, // 6 ev i juli, 6 synliga
    { slug: 'KappaBarMalmo', name: 'Kappa Bar Malmö' }, // 6 ev i juli, 2 synliga
    { slug: 'jazzimalmo', name: 'Jazz i Malmö' }, // 6 ev i juli, 3 synliga
    { slug: 'hemfranderome', name: 'Hem från Derome', city: 'Varberg' }, // 6 ev i juli, 8 synliga
    { slug: 'boulognerskogenparkrun', name: 'Boulognerskogen, Gävle', city: 'Gävle' }, // 6 ev i juli, 5 synliga
    { slug: 'alvsbyn', name: 'Älvsbyn' }, // 5 ev i juli, 8 synliga
    { slug: 'vastanforsbandy', name: 'Västanforsbandy' }, // 5 ev i juli, 8 synliga
    { slug: 'TormekSharpeningInnovation', name: 'Tormek', city: 'Lindesberg' }, // 5 ev i juli, 2 synliga
    { slug: 'surfviken', name: 'Surfviken' }, // 5 ev i juli, 3 synliga
    { slug: 'mats.fuchs.9', name: 'Mats Fuchs' }, // 5 ev i juli, 1 synliga
    { slug: 'olearysgavle', name: 'O\'Learys Gävle', city: 'Gävle' }, // 5 ev i juli, 2 synliga
    { slug: 'LokalaHjalpenVasteras', name: 'Lokala Hjälpen', city: 'Västerås' }, // 5 ev i juli, 4 synliga
    { slug: 'sommarscen', name: 'Malmö Sommarscen' }, // 5 ev i juli, 5 synliga
    { slug: 'Ljudaborg', name: 'Ljudaborg' }, // 5 ev i juli, 8 synliga
    { slug: 'laila.amrouche', name: 'Laila Amrouche', city: 'Uddevalla' }, // 5 ev i juli, 8 synliga
    { slug: 'Kungalvsparken', name: 'Kungälvs Parken', city: 'Borås' }, // 5 ev i juli, 6 synliga
    { slug: 'HarrysStenungsund', name: 'Harrys', city: 'Hässleholm' }, // 5 ev i juli, 2 synliga
    { slug: 'Glimmingehus', name: 'Glimmingehus' }, // 5 ev i juli, 4 synliga
    { slug: 'frilandsmusset', name: 'Fiskartorpet' }, // 5 ev i juli, 3 synliga
    { slug: 'fchessleholm', name: 'FC Hessleholm', city: 'Hässleholm' }, // 5 ev i juli, 4 synliga
    { slug: 'Debasersthlm', name: 'Debaser', city: 'Stockholm' }, // 5 ev i juli, 7 synliga
    { slug: 'vaxjoloparklubb', name: 'Växjö Löparklubb' }, // 4 ev i juli, 1 synliga
    { slug: 'umefox', name: 'UmeFox' }, // 4 ev i juli, 4 synliga
    { slug: 'trivselhussverige', name: 'Trivselhus' }, // 4 ev i juli, 1 synliga
    { slug: 'trelleborgen', name: 'Trelleborgen', city: 'Trelleborg' }, // 4 ev i juli, 1 synliga
    { slug: 'taichichuanEFT', name: 'Tivoliparken, Kristianstad', city: 'Kristianstad' }, // 4 ev i juli, 5 synliga
    { slug: 'sapboden', name: 'Svartbygården' }, // 4 ev i juli, 4 synliga
    { slug: 'Alfredsspelobar', name: 'Stures Krog', city: 'Lidköping' }, // 4 ev i juli, 1 synliga
    { slug: 'teatersat', name: 'Teater SAT' }, // 4 ev i juli, 2 synliga
    { slug: 'stromtorpsik', name: 'Strömtorps IK' }, // 4 ev i juli, 1 synliga
    { slug: 'snackan.nu', name: 'Snäckan', city: 'Klintehamn' }, // 4 ev i juli, 1 synliga
    { slug: 'skovdekulturhus', name: 'Skövde Kulturhus', city: 'Skövde' }, // 4 ev i juli, 8 synliga
    { slug: 'silvenska', name: 'Silvénska villan' }, // 4 ev i juli, 3 synliga
    { slug: 'sagabioflen', name: 'Saga Bio, Flen' }, // 4 ev i juli, 2 synliga
    { slug: 'Smcostergotland', name: 'SMC Östergötland' }, // 4 ev i juli, 2 synliga
    { slug: 'Palmfestivalen', name: 'Palmfestivalen' }, // 4 ev i juli, 4 synliga
    { slug: 'Karlskronacity', name: 'Karlskrona City', city: 'Karlskrona' }, // 4 ev i juli, 3 synliga
    { slug: 'Droskan.se', name: 'DROSKAN' }, // 4 ev i juli, 4 synliga
    { slug: 'bradspelskafeet', name: 'Brädspelskaféet', city: 'Karlshamn' }, // 4 ev i juli, 3 synliga
    { slug: 'BrygganSMB', name: 'Bryggan' }, // 4 ev i juli, 1 synliga
    { slug: 'autismblekinge', name: 'Autism Blekinge', city: 'Olofström' }, // 4 ev i juli, 3 synliga
    { slug: 'almsgard', name: 'Alms Gård' }, // 4 ev i juli, 8 synliga
    { slug: 'ostgotamusiken', name: 'Östgötamusiken', city: 'Linköping' }, // 3 ev i juli, 8 synliga
    { slug: 'visitkumla', name: 'Visit Kumla' }, // 3 ev i juli, 2 synliga
    { slug: 'MalinNilssonMagician', name: 'Varieté Voljär', city: 'Simrishamn' }, // 3 ev i juli, 1 synliga
    { slug: 'meraloppis', name: 'Ulf Andersson' }, // 3 ev i juli, 2 synliga
    { slug: 'TillsammansHoor', name: 'Tillsammans Höör' }, // 3 ev i juli, 1 synliga
    { slug: 'TheTivoli', name: 'The Tivoli', city: 'Helsingborg' }, // 3 ev i juli, 8 synliga
    { slug: 'Tangokompaniet', name: 'Tangokompaniet' }, // 3 ev i juli, 6 synliga
    { slug: 'spiritofmansweden', name: 'Spirit of Man' }, // 3 ev i juli, 2 synliga
    { slug: 'stalpet', name: 'Stalpet' }, // 3 ev i juli, 2 synliga
    { slug: 'hedemorafolketspark', name: 'Sommar-Bingo Hedemora Folkets Park 2026' }, // 3 ev i juli, 8 synliga
    { slug: 'timrabhk', name: 'SBK mellannorrlands Unga med Hundar' }, // 3 ev i juli, 1 synliga
    { slug: 'quiztyreso', name: 'QUIZ - Tyresö' }, // 3 ev i juli, 1 synliga
    { slug: 'juan.c.diaz.906', name: 'Paddla SUP & Tälta i Sverige' }, // 3 ev i juli, 8 synliga
    { slug: 'nederlulea', name: 'Nederluleå kyrka' }, // 3 ev i juli, 5 synliga
    { slug: 'kulturfritidystad', name: 'Norra Promenaden Ystad', city: 'Ystad' }, // 3 ev i juli, 1 synliga
    { slug: 'movendimjolby', name: 'Movendi Mjölby', city: 'Mjölby' }, // 3 ev i juli, 3 synliga
    { slug: 'movehomesverige', name: 'Movehome', city: 'Sundsvall' }, // 3 ev i juli, 1 synliga
    { slug: 'malmomuseum', name: 'Malmö museum', city: 'Malmö' }, // 3 ev i juli, 2 synliga
    { slug: 'MittsverigebananHarnosand', name: 'Mittsverigebanan', city: 'Härnösand' }, // 3 ev i juli, 3 synliga
    { slug: 'LukeCombs', name: 'Luke Combs' }, // 3 ev i juli, 8 synliga
    { slug: 'lommaflotten', name: 'LommaFlotten' }, // 3 ev i juli, 2 synliga
    { slug: 'livironu', name: 'Liv-i-ro', city: 'Katrineholm' }, // 3 ev i juli, 2 synliga
    { slug: 'upplevlandskronaven', name: 'Landskrona Ven', city: 'Landskrona' }, // 3 ev i juli, 3 synliga
    { slug: 'konstmuseet', name: 'Konstmuseet', city: 'Skövde' }, // 3 ev i juli, 4 synliga
    { slug: 'inrenatur', name: 'Inre natur' }, // 3 ev i juli, 5 synliga
    { slug: '100063649326993', name: 'Golftillsammans' }, // 3 ev i juli, 8 synliga
    { slug: 'Furuviksparken', name: 'Furuviksparken' }, // 3 ev i juli, 3 synliga
    { slug: 'eslovplus', name: 'Eslöv+', city: 'Eslöv' }, // 3 ev i juli, 2 synliga
    { slug: 'Dahlenkullan', name: 'Dahlénkullan' }, // 3 ev i juli, 1 synliga
    { slug: 'munkbuggarna', name: 'DF Munkbuggarna' }, // 3 ev i juli, 1 synliga
    { slug: 'bunkerihjortsberga', name: 'Bunker Bar' }, // 3 ev i juli, 8 synliga
    { slug: 'brasserietboras', name: 'Brasseriet', city: 'Borås' }, // 3 ev i juli, 4 synliga
    { slug: 'borlangekommun', name: 'Borlänge kommun', city: 'Borlänge' }, // 3 ev i juli, 8 synliga
    { slug: 'arvikabibliotek', name: 'Arvika Bibliotek', city: 'Arvika' }, // 3 ev i juli, 1 synliga
    { slug: 'alltidtjorn', name: 'Alltid Tjörn' }, // 3 ev i juli, 1 synliga
    { slug: 'alexeklundofficial', name: 'Alex Eklund', city: 'Eskilstuna' }, // 3 ev i juli, 2 synliga
    { slug: 'VaerkstederiAbsalon', name: 'Absalon' }, // 3 ev i juli, 8 synliga
    { slug: 'orebroteater', name: 'Örebro Teater' }, // 2 ev i juli, 2 synliga
    { slug: 'jessica.yngvesson', name: 'Ängelholms hembygdspark' }, // 2 ev i juli, 8 synliga
    { slug: 'almhultsif', name: 'Älmhults IF' }, // 2 ev i juli, 1 synliga
    { slug: 'karlecafe', name: 'karl-e' }, // 2 ev i juli, 8 synliga
    { slug: 'wijtradgardar', name: 'Wij Trädgårdar' }, // 2 ev i juli, 1 synliga
    { slug: 'yogaheart.nu', name: 'Yogaheart' }, // 2 ev i juli, 1 synliga
    { slug: 'yoganovisen', name: 'YogaNovisen' }, // 2 ev i juli, 8 synliga
    { slug: 'varbergsolhall', name: 'Varbergs Ölhall', city: 'Varberg' }, // 2 ev i juli, 2 synliga
    { slug: 'NaturskyddsforeningenIVarberg', name: 'Varbergs torg' }, // 2 ev i juli, 8 synliga
    { slug: 'rockthenightfestival1', name: 'Ungdomsfältet' }, // 2 ev i juli, 8 synliga
    { slug: 'herrestadsaiffotbollherr', name: 'Undavallen' }, // 2 ev i juli, 8 synliga
    { slug: 'tunapark.se', name: 'Tuna Park', city: 'Eskilstuna' }, // 2 ev i juli, 2 synliga
    { slug: 'tradgardsresan', name: 'Trädgårdsresan' }, // 2 ev i juli, 2 synliga
    { slug: 'atomic.torsson', name: 'Torsson' }, // 2 ev i juli, 6 synliga
    { slug: 'jannee5656', name: 'Tibro' }, // 2 ev i juli, 1 synliga
    { slug: 'lena.lingensjo', name: 'Söndsvalls damer �', city: 'Sundsvall' }, // 2 ev i juli, 5 synliga
    { slug: 'sundbalans', name: 'Sund Balans' }, // 2 ev i juli, 2 synliga
    { slug: 'stalebo.ridklubb.official', name: 'Stålebo Ridklubb' }, // 2 ev i juli, 2 synliga
    { slug: 'Ifoodfestival', name: 'Stortorget, Östersund' }, // 2 ev i juli, 2 synliga
    { slug: 'Malaroschack', name: 'Stockholms län' }, // 2 ev i juli, 1 synliga
    { slug: 'SoulRelax.Motala', name: 'SoulRelax', city: 'Motala' }, // 2 ev i juli, 2 synliga
    { slug: 'sprangsten', name: 'Sprängsten' }, // 2 ev i juli, 8 synliga
    { slug: 'conventumorebro', name: 'Sommarlovskul.se' }, // 2 ev i juli, 8 synliga
    { slug: 'skovdeaik', name: 'Skövde AIK', city: 'Skövde' }, // 2 ev i juli, 1 synliga
    { slug: 'skillingeteater', name: 'Skillinge Teater' }, // 2 ev i juli, 5 synliga
    { slug: 'Skadibmt', name: 'Skadi' }, // 2 ev i juli, 8 synliga
    { slug: 'orebrolansmuseum', name: 'Siggebohyttans Bergsmansgård' }, // 2 ev i juli, 4 synliga
    { slug: 'scenosterlen', name: 'Scen Österlen', city: 'Simrishamn' }, // 2 ev i juli, 2 synliga
    { slug: 'sdknacken', name: 'SDK Näcken', city: 'Katrineholm' }, // 2 ev i juli, 2 synliga
    { slug: 'RonnbyTigers', name: 'Rönnby Tigers', city: 'Västerås' }, // 2 ev i juli, 8 synliga
    { slug: 'rotundan', name: 'Rotundan', city: 'Halmstad' }, // 2 ev i juli, 1 synliga
    { slug: 'rimboprastgard', name: 'Rimbo Prästgård' }, // 2 ev i juli, 8 synliga
    { slug: 'pinkprogramming', name: 'Pink Programming', city: 'Hässleholm' }, // 2 ev i juli, 1 synliga
    { slug: 'peterj0hanss0n', name: 'Peter Johansson' }, // 2 ev i juli, 3 synliga
    { slug: 'paula.gocko', name: 'Paula Gocko', city: 'Eskilstuna' }, // 2 ev i juli, 6 synliga
    { slug: 'rotundan.nynas', name: 'Partyrollers 2.0' }, // 2 ev i juli, 6 synliga
    { slug: 'pifdam', name: 'PIF Damfotboll' }, // 2 ev i juli, 8 synliga
    { slug: 'ola.pettersson.39', name: 'Ola Pettersson', city: 'Norrtälje' }, // 2 ev i juli, 2 synliga
    { slug: 'svenskaafghanhundklubben', name: 'Nykvarns Hundhall' }, // 2 ev i juli, 2 synliga
    { slug: 'norrvikenbastad', name: 'Norrviken' }, // 2 ev i juli, 1 synliga
    { slug: 'norrlandsoperan', name: 'Norrlandsoperan' }, // 2 ev i juli, 7 synliga
    { slug: 'nordicsociety.org', name: 'Nordic society' }, // 2 ev i juli, 3 synliga
    { slug: 'studieframjandetgastrikland', name: 'Naturskyddsföreningen Hofors - Torsåker' }, // 2 ev i juli, 2 synliga
    { slug: 'norabuggarna', name: 'Norabuggarna', city: 'Nora' }, // 2 ev i juli, 4 synliga
    { slug: '1mr.langos', name: 'Mr.Lángos', city: 'Kalmar' }, // 2 ev i juli, 8 synliga
    { slug: 'moppehultsfred', name: 'Moppehultsfred' }, // 2 ev i juli, 8 synliga
    { slug: 'monarkmuseum', name: 'Monarkmuseum', city: 'Falkenberg' }, // 2 ev i juli, 3 synliga
    { slug: 'mjolbykommun', name: 'Mjölby kommun', city: 'Mjölby' }, // 2 ev i juli, 3 synliga
    { slug: 'fridasrestaurang', name: 'Mats Westling', city: 'Simrishamn' }, // 2 ev i juli, 8 synliga
    { slug: 'Landskronastad', name: 'Landskrona stad', city: 'Landskrona' }, // 2 ev i juli, 4 synliga
    { slug: 'charlotta.dyall', name: 'Kvinnoakademin i Norberg' }, // 2 ev i juli, 2 synliga
    { slug: 'kulturisigma', name: 'Kultur i Sigma' }, // 2 ev i juli, 2 synliga
    { slug: 'roselandvisby', name: 'Kruttornet' }, // 2 ev i juli, 1 synliga
    { slug: 'kulturnoje', name: 'Kultur & Nöje' }, // 2 ev i juli, 8 synliga
    { slug: 'carina.grahnhellberg', name: 'Krokom, Jämtlands län' }, // 2 ev i juli, 2 synliga
    { slug: 'kalmarnationlund', name: 'Kalmar Nation', city: 'Lund' }, // 2 ev i juli, 6 synliga
    { slug: 'gospelgiz', name: 'Joy Singers', city: 'Ljungby' }, // 2 ev i juli, 8 synliga
    { slug: 'ikkongahalla1906', name: 'IK Kongahälla' }, // 2 ev i juli, 2 synliga
    { slug: 'AvrilPsychic', name: 'Höör, Skåne län' }, // 2 ev i juli, 1 synliga
    { slug: 'vadhanderiuppsala', name: 'Händer i Uppsala', city: 'Uppsala' }, // 2 ev i juli, 2 synliga
    { slug: 'EdvinBoyner', name: 'Hägernäs Strand' }, // 2 ev i juli, 1 synliga
    { slug: 'hundesenteretitrondheim', name: 'Hundesenteret' }, // 2 ev i juli, 8 synliga
    { slug: 'huddingeparkrun', name: 'Huddinge Parkrun' }, // 2 ev i juli, 8 synliga
    { slug: 'HotellHavanna', name: 'Hotell Havanna', city: 'Varberg' }, // 2 ev i juli, 1 synliga
    { slug: 'Hjaltevadshus', name: 'Hjältevadshus', city: 'Uppsala' }, // 2 ev i juli, 6 synliga
    { slug: 'gotams', name: 'Göta MS', city: 'Enköping' }, // 2 ev i juli, 2 synliga
    { slug: '61581592990656', name: 'Gustavs Skjul Orust' }, // 2 ev i juli, 7 synliga
    { slug: 'vastbosportdansklubb', name: 'Folkets Park Värnamo' }, // 2 ev i juli, 5 synliga
    { slug: 'fritidibjuv', name: 'Fritid i Bjuv' }, // 2 ev i juli, 2 synliga
    { slug: 'dressedtokissbandsweden', name: 'Dressed To KISS', city: 'Göteborg' }, // 2 ev i juli, 3 synliga
    { slug: 'classicmotor', name: 'Classic Motor' }, // 2 ev i juli, 8 synliga
    { slug: 'borjessonsbil', name: 'Börjessons Bil', city: 'Alingsås' }, // 2 ev i juli, 3 synliga
    { slug: 'Brannoforeningen', name: 'Brännöföreningen' }, // 2 ev i juli, 8 synliga
    { slug: 'skellefteamuseum', name: 'Bonnstan' }, // 2 ev i juli, 7 synliga
    { slug: 'rolfsbuss', name: 'Boulognerskogen' }, // 2 ev i juli, 1 synliga
    { slug: 'strawberryarena', name: 'Best Music' }, // 2 ev i juli, 8 synliga
    { slug: 'barnicentrum', name: 'Barn i centrum' }, // 2 ev i juli, 8 synliga
    { slug: 'BaraManVill', name: 'Bara man Vill' }, // 2 ev i juli, 1 synliga
    { slug: 'ArkenZooHalmstadStenalyckan', name: 'Arken Zoo', city: 'Halmstad' }, // 2 ev i juli, 1 synliga
    { slug: 'autismskane', name: 'Autism Skåne', city: 'Kristianstad' }, // 2 ev i juli, 4 synliga
    { slug: 'VuxenutbildningenFalkenberg', name: 'Argus, Falkenberg', city: 'Falkenberg' }, // 2 ev i juli, 2 synliga
    { slug: 'arenahagmyren', name: 'Arena Hagmyren', city: 'Hudiksvall' }, // 2 ev i juli, 1 synliga
    { slug: 'arbogabio', name: 'Arboga bio' }, // 2 ev i juli, 1 synliga
    { slug: 'antonshusautism', name: 'Antons Hus' }, // 2 ev i juli, 7 synliga
    { slug: 'anders.forss.7', name: 'Anders Forss' }, // 2 ev i juli, 1 synliga
    { slug: 'abfnorrtalje', name: 'ABF Norrtälje', city: 'Norrtälje' }, // 2 ev i juli, 8 synliga
    { slug: 'hasse.soderstrom.77', name: '4R challenge' }, // 2 ev i juli, 7 synliga
];
