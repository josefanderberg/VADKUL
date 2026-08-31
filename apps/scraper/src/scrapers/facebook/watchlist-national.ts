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
    { slug: 'LiveEventRadar', name: 'Live Event Radar' }, // 112 ev i juli, 8 synliga
    { slug: 'laughseats', name: 'Laugh Seats' }, // 65 ev i juli, 8 synliga
    { slug: 'feverup', name: 'Fever', city: 'Stockholm' }, // 59 ev i juli, 8 synliga
    { slug: 'taystase', name: 'Taysta', city: 'Göteborg' }, // 39 ev i juli, 8 synliga
    { slug: 'kalixfolketshus', name: 'Kalix Kommun' }, // 30 ev i juli, 8 synliga
    { slug: 'medborgarskolanjamtland', name: 'Medborgarskolan' }, // 24 ev i juli, 8 synliga
    { slug: 'vadhanderistockholm', name: 'Vad som händer i Stockholm', city: 'Stockholm' }, // 24 ev i juli, 6 synliga
    { slug: 'ABFsorm', name: 'ABF Sörmland', city: 'Eskilstuna' }, // 23 ev i juli, 8 synliga
    { slug: 'Vaxjodyksport', name: 'Växjödyksport', city: 'Växjö' }, // 22 ev i juli, 8 synliga
    { slug: 'varjesteg', name: 'VarjeSteg' }, // 21 ev i juli, 8 synliga
    { slug: 'jazzclubfasching', name: 'Fasching' }, // 20 ev i juli, 7 synliga
    { slug: 'bioroy', name: 'Bio Roy' }, // 19 ev i juli, 8 synliga
    { slug: 'lisebergab', name: 'Liseberg' }, // 18 ev i juli, 3 synliga
    { slug: 'Moveat.Sweden', name: 'Moveat', city: 'Stockholm' }, // 17 ev i juli, 8 synliga
    { slug: 'gotlandsmuseum', name: 'Gotlands Museum', city: 'Visby' }, // 17 ev i juli, 6 synliga
    { slug: 'vaniumeasida', name: 'Vän i Umeå' }, // 15 ev i juli, 6 synliga
    { slug: 'hundesenteretitrondheim', name: 'Hundesenteret' }, // 15 ev i juli, 8 synliga
    { slug: 'dalarnasmuseum', name: 'Dalarnas museum', city: 'Falun' }, // 15 ev i juli, 8 synliga
    { slug: 'bohuslanguider', name: 'Bohusläns Guider' }, // 15 ev i juli, 6 synliga
    { slug: 'atobeyondparkour', name: 'A-Beyond Parkour' }, // 15 ev i juli, 5 synliga
    { slug: 'KappaBarMalmo', name: 'Kappa Bar Malmö' }, // 14 ev i juli, 8 synliga
    { slug: 'HotellHulingen', name: 'Hotell Hulingen' }, // 14 ev i juli, 8 synliga
    { slug: 'UpplevSkovde', name: 'Upplev Skövde', city: 'Skövde' }, // 13 ev i juli, 8 synliga
    { slug: 'tobbetrollkarl', name: 'Tobbe Trollkarl', city: 'Västerås' }, // 13 ev i juli, 8 synliga
    { slug: 'hets.nu', name: 'Hässleholm Centralstation', city: 'Hässleholm' }, // 13 ev i juli, 8 synliga
    { slug: 'hyltebiblioteken', name: 'Hyltebiblioteken' }, // 13 ev i juli, 8 synliga
    { slug: 'hemfranderome', name: 'Hem från Derome', city: 'Varberg' }, // 12 ev i juli, 5 synliga
    { slug: 'Victoriateatern', name: 'https://www.facebook.com/groups/' }, // 12 ev i juli, 7 synliga
    { slug: 'scensommar', name: 'Scensommar' }, // 11 ev i juli, 8 synliga
    { slug: 'junisalvsborgdistrikt', name: 'Movendi Älvsborg', city: 'Borås' }, // 11 ev i juli, 8 synliga
    { slug: 'baravanlig.se', name: 'Bara Vanlig', city: 'Lund' }, // 11 ev i juli, 7 synliga
    { slug: 'hjartatshus', name: 'Hjärtats hus', city: 'Jönköping' }, // 11 ev i juli, 5 synliga
    { slug: 'medeltidsmuseet', name: 'Medeltidsmuseet', city: 'Stockholm' }, // 10 ev i juli, 5 synliga
    { slug: 'gronalundstivoli', name: 'Gröna Lund', city: 'Stockholm' }, // 10 ev i juli, 6 synliga
    { slug: 'gretasgothenburg', name: 'Gretas Göteborg', city: 'Göteborg' }, // 10 ev i juli, 8 synliga
    { slug: 'Dansalliansen', name: 'Dansalliansen' }, // 10 ev i juli, 8 synliga
    { slug: 'swedenrunners', name: 'Sweden Runners', city: 'Göteborg' }, // 9 ev i juli, 8 synliga
    { slug: 'solvesborgcsk', name: 'Stortorget Sölvesborg', city: 'Sölvesborg' }, // 9 ev i juli, 4 synliga
    { slug: 'StNikolaikyrka', name: 'St Nikolai kyrka' }, // 9 ev i juli, 3 synliga
    { slug: 'norrlandsoperan', name: 'Norrlandsoperan' }, // 9 ev i juli, 5 synliga
    { slug: 'rimboprastgard', name: 'Rimbo Prästgård' }, // 9 ev i juli, 8 synliga
    { slug: 'mejeriet', name: 'Mejeriet', city: 'Lund' }, // 9 ev i juli, 6 synliga
    { slug: 'ikanobostad', name: 'Ikano Bostad', city: 'Uppsala' }, // 9 ev i juli, 8 synliga
    { slug: 'Hjaltevadshus', name: 'Hjältevadshus', city: 'Eskilstuna' }, // 9 ev i juli, 6 synliga
    { slug: 'klostretiystad', name: 'Klostret i Ystad', city: 'Ystad' }, // 9 ev i juli, 5 synliga
    { slug: 'HarrysStenungsund', name: 'Harrys', city: 'Hässleholm' }, // 9 ev i juli, 5 synliga
    { slug: 'gamlahalmstad', name: 'Gamla Halmstad', city: 'Halmstad' }, // 9 ev i juli, 4 synliga
    { slug: 'alingsasparken', name: 'Alingsås Parken', city: 'Alingsås' }, // 9 ev i juli, 6 synliga
    { slug: 'varlokal', name: 'Vår lokal' }, // 8 ev i juli, 8 synliga
    { slug: 'vasterascity', name: 'Västerås City', city: 'Västerås' }, // 8 ev i juli, 3 synliga
    { slug: 'trivselhussverige', name: 'Trivselhus', city: 'Helsingborg' }, // 8 ev i juli, 4 synliga
    { slug: 'nfacademy', name: 'NF Academy' }, // 8 ev i juli, 8 synliga
    { slug: 'fagerstakommun', name: 'Skinnskattebergs Kommun' }, // 8 ev i juli, 1 synliga
    { slug: 'kavlingeoldtimespub', name: 'Old Times Pub' }, // 8 ev i juli, 6 synliga
    { slug: 'Mordmysterium', name: 'Mordmysterium' }, // 8 ev i juli, 6 synliga
    { slug: 'Debasersthlm', name: 'Debaser', city: 'Stockholm' }, // 8 ev i juli, 7 synliga
    { slug: 'apollonsolna', name: 'Apollon Solna FK' }, // 8 ev i juli, 5 synliga
    { slug: 'anebybibliotek', name: 'Aneby bibliotek' }, // 8 ev i juli, 3 synliga
    { slug: 'alvsbyn', name: 'Älvsbyn' }, // 7 ev i juli, 8 synliga
    { slug: 'karlecafe', name: 'karl-e' }, // 7 ev i juli, 7 synliga
    { slug: 'upplevalingsas', name: 'Upplev Alingsås', city: 'Alingsås' }, // 7 ev i juli, 1 synliga
    { slug: 'lena.lingensjo', name: 'Söndsvalls damer �', city: 'Sundsvall' }, // 7 ev i juli, 5 synliga
    { slug: 'RewellMedical', name: 'Rewell Medical', city: 'Arvika' }, // 7 ev i juli, 3 synliga
    { slug: 'HaboWolley', name: 'Habo Wolley' }, // 7 ev i juli, 1 synliga
    { slug: 'Faluguide', name: 'Faluguide', city: 'Falun' }, // 7 ev i juli, 1 synliga
    { slug: 'Campingkul', name: 'Campingkul', city: 'Karlskrona' }, // 7 ev i juli, 8 synliga
    { slug: 'brasserietboras', name: 'Brasseriet', city: 'Borås' }, // 7 ev i juli, 4 synliga
    { slug: 'naturumSkrylle', name: 'naturum Skrylle' }, // 6 ev i juli, 3 synliga
    { slug: 'silvenska', name: 'Silvénska villan' }, // 6 ev i juli, 3 synliga
    { slug: 'spokguiden', name: 'Spökguiden' }, // 6 ev i juli, 8 synliga
    { slug: 'redbullevents', name: 'Red Bull Events' }, // 6 ev i juli, 8 synliga
    { slug: 'ReStoredSE', name: 'RESTORED' }, // 6 ev i juli, 2 synliga
    { slug: 'Molekylverkstan', name: 'Molekylverkstan' }, // 6 ev i juli, 2 synliga
    { slug: 'LokalaHjalpenVasteras', name: 'Lokala Hjälpen', city: 'Västerås' }, // 6 ev i juli, 4 synliga
    { slug: 'laila.amrouche', name: 'Laila Amrouche', city: 'Uddevalla' }, // 6 ev i juli, 7 synliga
    { slug: 'kalmarnationlund', name: 'Kalmar Nation', city: 'Lund' }, // 6 ev i juli, 1 synliga
    { slug: 'jazzimalmo', name: 'Jazz i Malmö' }, // 6 ev i juli, 6 synliga
    { slug: 'frimisorebro', name: 'Frimis' }, // 6 ev i juli, 5 synliga
    { slug: 'fchessleholm', name: 'FC Hessleholm', city: 'Hässleholm' }, // 6 ev i juli, 3 synliga
    { slug: 'borjessonsbil', name: 'Börjessons Bil', city: 'Karlskrona' }, // 6 ev i juli, 3 synliga
    { slug: 'arvikabibliotek', name: 'Arvika Bibliotek', city: 'Arvika' }, // 6 ev i juli, 4 synliga
    { slug: 'ostgotamusiken', name: 'Östgötamusiken', city: 'Linköping' }, // 5 ev i juli, 8 synliga
    { slug: 'yoganatur.se', name: 'YogaNatur' }, // 5 ev i juli, 8 synliga
    { slug: 'vaxjoloparklubb', name: 'Växjö Löparklubb' }, // 5 ev i juli, 2 synliga
    { slug: 'TormekSharpeningInnovation', name: 'Tormek', city: 'Lindesberg' }, // 5 ev i juli, 2 synliga
    { slug: 'stromtorpsik', name: 'Strömtorps IK' }, // 5 ev i juli, 1 synliga
    { slug: 'paula.gocko', name: 'Paula Gocko', city: 'Eskilstuna' }, // 5 ev i juli, 3 synliga
    { slug: 'mats.fuchs.9', name: 'Mats Fuchs' }, // 5 ev i juli, 2 synliga
    { slug: 'nordicsociety.org', name: 'Nordic society', city: 'Stockholm' }, // 5 ev i juli, 3 synliga
    { slug: 'movehomesverige', name: 'Movehome', city: 'Sundsvall' }, // 5 ev i juli, 2 synliga
    { slug: 'malmomuseum', name: 'Malmö museum', city: 'Malmö' }, // 5 ev i juli, 5 synliga
    { slug: 'Ljudaborg', name: 'Ljudaborg' }, // 5 ev i juli, 8 synliga
    { slug: 'VeloxSkane', name: 'Malmö airsoft Indoor Arena' }, // 5 ev i juli, 1 synliga
    { slug: 'inrenatur', name: 'Inre natur' }, // 5 ev i juli, 4 synliga
    { slug: 'Glimmingehus', name: 'Glimmingehus' }, // 5 ev i juli, 3 synliga
    { slug: 'boulognerskogenparkrun', name: 'Boulognerskogen, Gävle', city: 'Gävle' }, // 5 ev i juli, 6 synliga
    { slug: 'ArrangemangLund', name: 'Arrangemang Lund', city: 'Lund' }, // 5 ev i juli, 5 synliga
    { slug: 'orebroteater', name: 'Örebro Teater' }, // 4 ev i juli, 2 synliga
    { slug: 'umefox', name: 'UmeFox' }, // 4 ev i juli, 4 synliga
    { slug: 'meraloppis', name: 'Ulf Andersson' }, // 4 ev i juli, 5 synliga
    { slug: 'tunapark.se', name: 'Tuna Park', city: 'Eskilstuna' }, // 4 ev i juli, 2 synliga
    { slug: 'taichichuanEFT', name: 'Tivoliparken, Kristianstad', city: 'Kristianstad' }, // 4 ev i juli, 4 synliga
    { slug: 'teatersat', name: 'Teater SAT' }, // 4 ev i juli, 2 synliga
    { slug: 'sapboden', name: 'Svartbygården' }, // 4 ev i juli, 5 synliga
    { slug: 'sundbalans', name: 'Sund Balans' }, // 4 ev i juli, 3 synliga
    { slug: 'spiritofmansweden', name: 'Spirit of Man' }, // 4 ev i juli, 2 synliga
    { slug: 'hedemorafolketspark', name: 'Sommar-Bingo Hedemora Folkets Park 2026' }, // 4 ev i juli, 8 synliga
    { slug: 'snackan.nu', name: 'Snäckan', city: 'Klintehamn' }, // 4 ev i juli, 1 synliga
    { slug: 'sagabioflen', name: 'Saga Bio, Flen' }, // 4 ev i juli, 1 synliga
    { slug: 'Salemcover', name: 'Salem 2.0' }, // 4 ev i juli, 8 synliga
    { slug: 'Smcostergotland', name: 'SMC Östergötland' }, // 4 ev i juli, 8 synliga
    { slug: 'quiztyreso', name: 'QUIZ - Tyresö' }, // 4 ev i juli, 1 synliga
    { slug: 'pinkprogramming', name: 'Pink Programming', city: 'Hässleholm' }, // 4 ev i juli, 2 synliga
    { slug: 'movendimjolby', name: 'Movendi Mjölby', city: 'Mjölby' }, // 4 ev i juli, 3 synliga
    { slug: 'mjolbykommun', name: 'Mjölby kommun', city: 'Mjölby' }, // 4 ev i juli, 4 synliga
    { slug: 'livironu', name: 'Liv-i-ro', city: 'Katrineholm' }, // 4 ev i juli, 2 synliga
    { slug: 'Karlskronacity', name: 'Karlskrona City', city: 'Karlskrona' }, // 4 ev i juli, 3 synliga
    { slug: 'Furuviksparken', name: 'Furuviksparken' }, // 4 ev i juli, 2 synliga
    { slug: 'eslovplus', name: 'Eslöv+', city: 'Eslöv' }, // 4 ev i juli, 2 synliga
    { slug: 'linkopingairswing', name: 'Dansbanan gamla Linköping', city: 'Linköping' }, // 4 ev i juli, 4 synliga
    { slug: 'ZumbaFunFinn', name: 'Dansbanan I Gamla Linköping', city: 'Linköping' }, // 4 ev i juli, 1 synliga
    { slug: 'autismblekinge', name: 'Autism Blekinge', city: 'Olofström' }, // 4 ev i juli, 2 synliga
    { slug: 'borlangekommun', name: 'Borlänge kommun', city: 'Borlänge' }, // 4 ev i juli, 1 synliga
    { slug: 'alltidtjorn', name: 'Alltid Tjörn' }, // 4 ev i juli, 1 synliga
    { slug: 'almsgard', name: 'Alms Gård' }, // 4 ev i juli, 8 synliga
    { slug: 'StreetRollerHockeyLeague', name: 'https://www.facebook.com/share/g/', city: 'Eslöv' }, // 3 ev i juli, 1 synliga
    { slug: 'varbergsolhall', name: 'Varbergs Ölhall', city: 'Varberg' }, // 3 ev i juli, 1 synliga
    { slug: 'trailtourumea', name: 'Umeå Trail' }, // 3 ev i juli, 2 synliga
    { slug: 'tandsticksmuseet', name: 'Tändsticksmuseet', city: 'Jönköping' }, // 3 ev i juli, 1 synliga
    { slug: 'TillsammansHoor', name: 'Tillsammans Höör' }, // 3 ev i juli, 2 synliga
    { slug: 'tradgardsresan', name: 'Trädgårdsresan' }, // 3 ev i juli, 1 synliga
    { slug: 'tangovarberg', name: 'Tango Varberg', city: 'Varberg' }, // 3 ev i juli, 3 synliga
    { slug: 'surfviken', name: 'Surfviken' }, // 3 ev i juli, 2 synliga
    { slug: 'stalpet', name: 'Stalpet' }, // 3 ev i juli, 8 synliga
    { slug: 'SoulRelax.Motala', name: 'SoulRelax', city: 'Motala' }, // 3 ev i juli, 2 synliga
    { slug: 'skovdekulturhus', name: 'Skövde Kulturhus', city: 'Skövde' }, // 3 ev i juli, 8 synliga
    { slug: 'skovdeaik', name: 'Skövde AIK', city: 'Skövde' }, // 3 ev i juli, 8 synliga
    { slug: 'timrabhk', name: 'SBK mellannorrlands Unga med Hundar' }, // 3 ev i juli, 8 synliga
    { slug: 'norrvikenbastad', name: 'Norrviken' }, // 3 ev i juli, 1 synliga
    { slug: 'monarkmuseum', name: 'Monarkmuseum', city: 'Falkenberg' }, // 3 ev i juli, 1 synliga
    { slug: 'lommaflotten', name: 'LommaFlotten' }, // 3 ev i juli, 2 synliga
    { slug: 'motorklubbentandstiftet', name: 'Malmö Stad' }, // 3 ev i juli, 7 synliga
    { slug: 'LandskronaFoto', name: 'Landskrona Foto', city: 'Landskrona' }, // 3 ev i juli, 5 synliga
    { slug: 'Kungalvsparken', name: 'Kungälvs Parken', city: 'Borås' }, // 3 ev i juli, 8 synliga
    { slug: 'jtmtrio', name: 'JTM Trio' }, // 3 ev i juli, 8 synliga
    { slug: 'huddingeparkrun', name: 'Huddinge Parkrun' }, // 3 ev i juli, 8 synliga
    { slug: 'HotellHavanna', name: 'Hotell Havanna', city: 'Varberg' }, // 3 ev i juli, 2 synliga
    { slug: 'hotellbellevue', name: 'Hotell Bellevue' }, // 3 ev i juli, 8 synliga
    { slug: 'kulturisigma', name: 'Kultur i Sigma' }, // 3 ev i juli, 1 synliga
    { slug: 'hotelskansenoland', name: 'Hotel Skansen' }, // 3 ev i juli, 8 synliga
    { slug: '100063649326993', name: 'Golftillsammans' }, // 3 ev i juli, 8 synliga
    { slug: 'Dahlenkullan', name: 'Dahlénkullan' }, // 3 ev i juli, 1 synliga
    { slug: 'Droskan.se', name: 'DROSKAN' }, // 3 ev i juli, 4 synliga
    { slug: 'munkbuggarna', name: 'DF Munkbuggarna' }, // 3 ev i juli, 5 synliga
    { slug: 'bunkerihjortsberga', name: 'Bunker Bar' }, // 3 ev i juli, 8 synliga
    { slug: 'AvrilPsychic', name: 'Avril Intuitive' }, // 3 ev i juli, 2 synliga
    { slug: 'alexeklundofficial', name: 'Alex Eklund', city: 'Eskilstuna' }, // 3 ev i juli, 8 synliga
    { slug: 'antonshusautism', name: 'Antons Hus' }, // 3 ev i juli, 8 synliga
    { slug: 'hasse.soderstrom.77', name: '4R challenge' }, // 3 ev i juli, 7 synliga
    { slug: 'almhultsif', name: 'Älmhults IF' }, // 2 ev i juli, 8 synliga
    { slug: 'sdbollebygd', name: 'torget i Bollebygd' }, // 2 ev i juli, 8 synliga
    { slug: 'SossarLudvika', name: 'stadsparken Ludvika' }, // 2 ev i juli, 8 synliga
    { slug: 'zatancruisers', name: 'Zatan Cruisers', city: 'Laholm' }, // 2 ev i juli, 8 synliga
    { slug: 'YogaZonBorgholm', name: 'YogaZon' }, // 2 ev i juli, 1 synliga
    { slug: 'wijtradgardar', name: 'Wij Trädgårdar' }, // 2 ev i juli, 1 synliga
    { slug: 'VastragotalandsParasportforbund', name: 'Västra Götalands Parasportförbund - Skaraborg', city: 'Skövde' }, // 2 ev i juli, 1 synliga
    { slug: 'yogaheart.nu', name: 'Yogaheart' }, // 2 ev i juli, 1 synliga
    { slug: 'varldensminsta', name: 'Världens Minsta' }, // 2 ev i juli, 3 synliga
    { slug: 'vastanforsbandy', name: 'Västanforsbandy' }, // 2 ev i juli, 8 synliga
    { slug: 'NaturskyddsforeningenIVarberg', name: 'Varbergs torg' }, // 2 ev i juli, 4 synliga
    { slug: 'Upplandsmuseet', name: 'Upplandsmuseet', city: 'Uppsala' }, // 2 ev i juli, 8 synliga
    { slug: 'herrestadsaiffotbollherr', name: 'Undavallen' }, // 2 ev i juli, 8 synliga
    { slug: 'Bonanderfriskvard', name: 'Uddevalla, Västra Götalands län', city: 'Uddevalla' }, // 2 ev i juli, 3 synliga
    { slug: 'typ1festival', name: 'Typ1Festival', city: 'Hässleholm' }, // 2 ev i juli, 1 synliga
    { slug: 'torsebrosvamp', name: 'Torsebro Svamp', city: 'Kristianstad' }, // 2 ev i juli, 8 synliga
    { slug: 'naasdk', name: 'Tingshuset Lerum' }, // 2 ev i juli, 3 synliga
    { slug: 'atomic.torsson', name: 'Torsson' }, // 2 ev i juli, 7 synliga
    { slug: 'jointhestudentlife', name: 'The Student Life', city: 'Uppsala' }, // 2 ev i juli, 8 synliga
    { slug: 'thabelatravel', name: 'Thabela Travel' }, // 2 ev i juli, 4 synliga
    { slug: 'tangojamt', name: 'TangoJamt' }, // 2 ev i juli, 3 synliga
    { slug: 'steamhotel', name: 'The Steam Hotel', city: 'Västerås' }, // 2 ev i juli, 4 synliga
    { slug: 'studioexpress.se', name: 'Studioexpress.se', city: 'Jönköping' }, // 2 ev i juli, 8 synliga
    { slug: 'stalebo.ridklubb.official', name: 'Stålebo Ridklubb' }, // 2 ev i juli, 8 synliga
    { slug: 'Ifoodfestival', name: 'Stortorget, Östersund' }, // 2 ev i juli, 6 synliga
    { slug: 'Malaroschack', name: 'Stockholms län' }, // 2 ev i juli, 2 synliga
    { slug: 'stormspakhus', name: 'Storms Pakhus' }, // 2 ev i juli, 6 synliga
    { slug: 'stenhusetgille', name: 'Stenhuset' }, // 2 ev i juli, 4 synliga
    { slug: 'svkalmarlan', name: 'Sporthallen Nybro', city: 'Nybro' }, // 2 ev i juli, 8 synliga
    { slug: 'NaturStark.se', name: 'Sollentuna, Stockholms län' }, // 2 ev i juli, 8 synliga
    { slug: 'lindasolacer', name: 'Solacer', city: 'Karlstad' }, // 2 ev i juli, 4 synliga
    { slug: 'SkaraLoppis', name: 'Skara Loppis' }, // 2 ev i juli, 8 synliga
    { slug: 'skarahf', name: 'Skara HF' }, // 2 ev i juli, 8 synliga
    { slug: 'Esso36', name: 'SO36' }, // 2 ev i juli, 8 synliga
    { slug: 'rotundan', name: 'Rotundan', city: 'Halmstad' }, // 2 ev i juli, 1 synliga
    { slug: 'orebrolansmuseum', name: 'Siggebohyttans Bergsmansgård' }, // 2 ev i juli, 4 synliga
    { slug: 'RonnbyTigers', name: 'Rönnby Tigers', city: 'Västerås' }, // 2 ev i juli, 8 synliga
    { slug: 'pluskatrineholm', name: 'Plus Katrineholm', city: 'Katrineholm' }, // 2 ev i juli, 1 synliga
    { slug: 'peterj0hanss0n', name: 'Peter Johansson' }, // 2 ev i juli, 3 synliga
    { slug: 'rotundan.nynas', name: 'Partyrollers 2.0' }, // 2 ev i juli, 6 synliga
    { slug: 'juan.c.diaz.906', name: 'Paddla SUP & Tälta i Sverige' }, // 2 ev i juli, 8 synliga
    { slug: 'pifdam', name: 'PIF Damfotboll' }, // 2 ev i juli, 8 synliga
    { slug: 'ola.pettersson.39', name: 'Ola Pettersson', city: 'Norrtälje' }, // 2 ev i juli, 2 synliga
    { slug: 'obosisverige', name: 'OBOS i Sverige' }, // 2 ev i juli, 3 synliga
    { slug: 'svenskaafghanhundklubben', name: 'Nykvarns Hundhall' }, // 2 ev i juli, 1 synliga
    { slug: 'norabuggarna', name: 'Norabuggarna', city: 'Nora' }, // 2 ev i juli, 4 synliga
    { slug: 'kulturfritidystad', name: 'Norra Promenaden Ystad', city: 'Ystad' }, // 2 ev i juli, 8 synliga
    { slug: 'naturumblekinge', name: 'Naturum Blekinge', city: 'Ronneby' }, // 2 ev i juli, 3 synliga
    { slug: 'NatureTRIBEsweden', name: 'Nature TRIBE' }, // 2 ev i juli, 3 synliga
    { slug: 'studieframjandetgastrikland', name: 'Naturskyddsföreningen Hofors - Torsåker' }, // 2 ev i juli, 6 synliga
    { slug: '1mr.langos', name: 'Mr.Lángos', city: 'Kalmar' }, // 2 ev i juli, 8 synliga
    { slug: 'midnattsloppet', name: 'Midnattsloppet', city: 'Göteborg' }, // 2 ev i juli, 1 synliga
    { slug: 'michaelvogensen.dk', name: 'Michael Vogensen' }, // 2 ev i juli, 5 synliga
    { slug: 'fridasrestaurang', name: 'Mats Westling', city: 'Simrishamn' }, // 2 ev i juli, 8 synliga
    { slug: 'LiveAlmhult', name: 'Live Älmhult' }, // 2 ev i juli, 4 synliga
    { slug: 'Landskronastad', name: 'Landskrona stad', city: 'Landskrona' }, // 2 ev i juli, 4 synliga
    { slug: 'perry.mason.14', name: 'Lasse Nilsson' }, // 2 ev i juli, 3 synliga
    { slug: 'charlotta.dyall', name: 'Kvinnoakademin i Norberg' }, // 2 ev i juli, 8 synliga
    { slug: 'kulturitranemo', name: 'Kultur i Tranemo' }, // 2 ev i juli, 1 synliga
    { slug: 'kulturnoje', name: 'Kultur & Nöje' }, // 2 ev i juli, 8 synliga
    { slug: 'carina.grahnhellberg', name: 'Krokom, Jämtlands län' }, // 2 ev i juli, 8 synliga
    { slug: 'karlskronabibliotek', name: 'Karlskrona Stadsbibliotek', city: 'Karlskrona' }, // 2 ev i juli, 5 synliga
    { slug: 'karlskogapride', name: 'Karlskoga, Örebro län' }, // 2 ev i juli, 8 synliga
    { slug: 'Kajmanpite', name: 'Kajman' }, // 2 ev i juli, 4 synliga
    { slug: 'gospelgiz', name: 'Joy Singers', city: 'Ljungby' }, // 2 ev i juli, 8 synliga
    { slug: 'BritaStina', name: 'Jokkmokk, Norrbottens län' }, // 2 ev i juli, 8 synliga
    { slug: 'scenit', name: 'IVOR Club & Crew' }, // 2 ev i juli, 8 synliga
    { slug: 'ikeaumea', name: 'IKEA', city: 'Sundsvall' }, // 2 ev i juli, 8 synliga
    { slug: 'ikoskarshamn', name: 'IK Oskarshamn', city: 'Oskarshamn' }, // 2 ev i juli, 1 synliga
    { slug: 'Honggymnastikforening', name: 'Høng GF' }, // 2 ev i juli, 8 synliga
    { slug: 'EdvinBoyner', name: 'Hägernäs Strand' }, // 2 ev i juli, 1 synliga
    { slug: 'SwinginHepTown', name: 'HepTown' }, // 2 ev i juli, 8 synliga
    { slug: 'hcamarathon', name: 'HCA Marathon' }, // 2 ev i juli, 5 synliga
    { slug: 'gbgmarvels', name: 'Göteborg Marvels', city: 'Göteborg' }, // 2 ev i juli, 8 synliga
    { slug: '61581592990656', name: 'Gustavs Skjul Orust' }, // 2 ev i juli, 1 synliga
    { slug: 'gotams', name: 'Göta MS', city: 'Enköping' }, // 2 ev i juli, 8 synliga
    { slug: 'Glasorama', name: 'Glasorama', city: 'Landskrona' }, // 2 ev i juli, 1 synliga
    { slug: 'FriskaViljorFC', name: 'Friska Viljor FC' }, // 2 ev i juli, 8 synliga
    { slug: 'FjordCadenza', name: 'Fjord Cadenza' }, // 2 ev i juli, 8 synliga
    { slug: 'FNPt.pb', name: 'Fear No Pain(t)', city: 'Karlshamn' }, // 2 ev i juli, 8 synliga
    { slug: 'dressedtokissbandsweden', name: 'Dressed To KISS', city: 'Göteborg' }, // 2 ev i juli, 2 synliga
    { slug: 'dalarasten', name: 'Dalarasten' }, // 2 ev i juli, 1 synliga
    { slug: 'lerumsbibliotek', name: 'Dergårdsteatern, Lerum' }, // 2 ev i juli, 8 synliga
    { slug: 'bradspelskafeet', name: 'Brädspelskaféet', city: 'Karlshamn' }, // 2 ev i juli, 4 synliga
    { slug: 'classicmotor', name: 'Classic Motor' }, // 2 ev i juli, 8 synliga
    { slug: 'cirkusmuseet', name: 'Cirkusmuseet' }, // 2 ev i juli, 3 synliga
    { slug: 'skellefteamuseum', name: 'Bonnstan' }, // 2 ev i juli, 6 synliga
    { slug: 'trivselbanan', name: 'Bollnästravet' }, // 2 ev i juli, 8 synliga
    { slug: 'boca.vasteras', name: 'Boca Västerås', city: 'Västerås' }, // 2 ev i juli, 2 synliga
    { slug: 'bjuvsbibliotek', name: 'Bjuvs bibliotek' }, // 2 ev i juli, 4 synliga
    { slug: 'strawberryarena', name: 'Best Music' }, // 2 ev i juli, 8 synliga
    { slug: 'bergsakers', name: 'Bergsåker', city: 'Sundsvall' }, // 2 ev i juli, 1 synliga
    { slug: 'BaraManVill', name: 'Bara man Vill' }, // 2 ev i juli, 2 synliga
    { slug: 'barnicentrum', name: 'Barn i centrum' }, // 2 ev i juli, 8 synliga
    { slug: 'autismskane', name: 'Autism Skåne', city: 'Kristianstad' }, // 2 ev i juli, 1 synliga
    { slug: 'arenahagmyren', name: 'Arena Hagmyren', city: 'Hudiksvall' }, // 2 ev i juli, 1 synliga
    { slug: 'VuxenutbildningenFalkenberg', name: 'Argus, Falkenberg', city: 'Falkenberg' }, // 2 ev i juli, 8 synliga
    { slug: 'arbogabio', name: 'Arboga bio' }, // 2 ev i juli, 8 synliga
    { slug: 'arbisnkpg', name: 'Arbis' }, // 2 ev i juli, 8 synliga
    { slug: 'anders.forss.7', name: 'Anders Forss' }, // 2 ev i juli, 3 synliga
    { slug: 'amplifiedvast', name: 'Amplified Väst', city: 'Borås' }, // 2 ev i juli, 3 synliga
    { slug: 'susanne.swantesson', name: 'Alternativ-Mässa', city: 'Göteborg' }, // 2 ev i juli, 6 synliga
    { slug: 'absaloncph', name: 'Absalon' }, // 2 ev i juli, 8 synliga
    { slug: 'ABFsodertorn', name: 'ABF Södertörn' }, // 2 ev i juli, 7 synliga
    { slug: 'abfmalmo', name: 'ABF Malmö' }, // 2 ev i juli, 8 synliga
];
