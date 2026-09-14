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
    { slug: 'jubelAB', name: 'Visit Örebro' }, // 371 ev i juli, 8 synliga
    { slug: 'LiveEventRadar', name: 'Live Event Radar' }, // 117 ev i juli, 8 synliga
    { slug: 'kalixfolketshus', name: 'Kalix Kommun' }, // 79 ev i juli, 8 synliga
    { slug: 'TicketDealsEurope', name: 'Ticket Deals' }, // 69 ev i juli, 8 synliga
    { slug: 'laughseats', name: 'Laugh Seats' }, // 61 ev i juli, 8 synliga
    { slug: 'feverup', name: 'Fever' }, // 57 ev i juli, 8 synliga
    { slug: 'varjesteg', name: 'VarjeSteg' }, // 51 ev i juli, 8 synliga
    { slug: 'jazzclubfasching', name: 'Fasching' }, // 26 ev i juli, 8 synliga
    { slug: 'vaccin.sverige', name: 'Vaccin.nu', city: 'Lund' }, // 24 ev i juli, 8 synliga
    { slug: 'ABFsorm', name: 'ABF Sörmland', city: 'Eskilstuna' }, // 22 ev i juli, 8 synliga
    { slug: 'Moveat.Sweden', name: 'Moveat', city: 'Stockholm' }, // 21 ev i juli, 8 synliga
    { slug: 'taystase', name: 'Taysta', city: 'Uppsala' }, // 21 ev i juli, 8 synliga
    { slug: 'hundesenteretitrondheim', name: 'Hundesenteret' }, // 20 ev i juli, 8 synliga
    { slug: 'vaniumeasida', name: 'Vän i Umeå' }, // 19 ev i juli, 8 synliga
    { slug: 'hemfranderome', name: 'Hem från Derome', city: 'Varberg' }, // 19 ev i juli, 8 synliga
    { slug: 'Vaxjodyksport', name: 'Växjödyksport', city: 'Växjö' }, // 18 ev i juli, 8 synliga
    { slug: 'vadhanderistockholm', name: 'Vad som händer i Stockholm', city: 'Stockholm' }, // 18 ev i juli, 6 synliga
    { slug: 'atobeyondparkour', name: 'A-Beyond Parkour' }, // 16 ev i juli, 8 synliga
    { slug: 'medborgarskolanjamtland', name: 'Medborgarskolan' }, // 15 ev i juli, 8 synliga
    { slug: 'Hjaltevadshus', name: 'Hjältevadshus', city: 'Uppsala' }, // 15 ev i juli, 3 synliga
    { slug: 'gotlandsmuseum', name: 'Gotlands Museum', city: 'Visby' }, // 15 ev i juli, 5 synliga
    { slug: 'baravanlig.se', name: 'Bara Vanlig', city: 'Lund' }, // 15 ev i juli, 8 synliga
    { slug: 'bioroy', name: 'Bio Roy' }, // 14 ev i juli, 8 synliga
    { slug: 'fagerstakommun', name: 'Skinnskattebergs Kommun' }, // 14 ev i juli, 1 synliga
    { slug: 'hets.nu', name: 'Hässleholm Centralstation', city: 'Hässleholm' }, // 13 ev i juli, 8 synliga
    { slug: 'trivselhussverige', name: 'Trivselhus', city: 'Helsingborg' }, // 12 ev i juli, 1 synliga
    { slug: 'KappaBarMalmo', name: 'Kappa Bar Malmö' }, // 12 ev i juli, 5 synliga
    { slug: 'kalmarnationlund', name: 'Kalmar Nation', city: 'Lund' }, // 11 ev i juli, 6 synliga
    { slug: 'hjartatshus', name: 'Hjärtats hus', city: 'Jönköping' }, // 11 ev i juli, 5 synliga
    { slug: 'Victoriateatern', name: 'https://www.facebook.com/groups/', city: 'Västerås' }, // 10 ev i juli, 8 synliga
    { slug: 'norrlandsoperan', name: 'Norrlandsoperan' }, // 10 ev i juli, 3 synliga
    { slug: 'tangovarberg', name: 'Tango Varberg', city: 'Varberg' }, // 10 ev i juli, 5 synliga
    { slug: 'HarrysStenungsund', name: 'Harrys' }, // 10 ev i juli, 5 synliga
    { slug: 'rimboprastgard', name: 'Rimbo Prästgård' }, // 9 ev i juli, 8 synliga
    { slug: 'junisalvsborgdistrikt', name: 'Movendi Älvsborg', city: 'Alingsås' }, // 9 ev i juli, 8 synliga
    { slug: 'ikanobostad', name: 'Ikano Bostad', city: 'Uppsala' }, // 9 ev i juli, 8 synliga
    { slug: 'inrenatur', name: 'Inre natur' }, // 9 ev i juli, 7 synliga
    { slug: 'hyltebiblioteken', name: 'Hyltebiblioteken' }, // 9 ev i juli, 6 synliga
    { slug: 'HotellHulingen', name: 'Hotell Hulingen' }, // 9 ev i juli, 8 synliga
    { slug: 'eastvillecomedy', name: 'Event Vesta - KC' }, // 9 ev i juli, 1 synliga
    { slug: 'dalarnasmuseum', name: 'Dalarnas museum', city: 'Falun' }, // 9 ev i juli, 6 synliga
    { slug: 'arvikabibliotek', name: 'Arvika Bibliotek', city: 'Arvika' }, // 9 ev i juli, 6 synliga
    { slug: 'ArrangemangLund', name: 'Arrangemang Lund', city: 'Lund' }, // 9 ev i juli, 8 synliga
    { slug: 'anebybibliotek', name: 'Aneby bibliotek' }, // 9 ev i juli, 5 synliga
    { slug: 'varlokal', name: 'Vår lokal' }, // 8 ev i juli, 8 synliga
    { slug: 'UpplevSkovde', name: 'Upplev Skövde', city: 'Skövde' }, // 8 ev i juli, 5 synliga
    { slug: 'solvesborgcsk', name: 'Stortorget Sölvesborg', city: 'Sölvesborg' }, // 8 ev i juli, 4 synliga
    { slug: 'Mordmysterium', name: 'Mordmysterium' }, // 8 ev i juli, 6 synliga
    { slug: 'varbergsolhall', name: 'Varbergs Ölhall', city: 'Varberg' }, // 8 ev i juli, 8 synliga
    { slug: 'mejeriet', name: 'Mejeriet', city: 'Lund' }, // 8 ev i juli, 8 synliga
    { slug: 'lisebergab', name: 'Liseberg' }, // 8 ev i juli, 2 synliga
    { slug: 'Eskilstunastadsbibliotek', name: 'Eskilstuna stadsbibliotek', city: 'Eskilstuna' }, // 8 ev i juli, 8 synliga
    { slug: 'brasserietboras', name: 'Brasseriet', city: 'Borås' }, // 8 ev i juli, 4 synliga
    { slug: 'karlecafe', name: 'karl-e' }, // 7 ev i juli, 6 synliga
    { slug: 'lena.lingensjo', name: 'Söndsvalls damer �', city: 'Sundsvall' }, // 7 ev i juli, 7 synliga
    { slug: 'StudieforbundetVuxenskolanVast', name: 'Studieförbundet Vuxenskolan Väst', city: 'Uddevalla' }, // 7 ev i juli, 6 synliga
    { slug: 'movehomesverige', name: 'Movehome', city: 'Nyköping' }, // 7 ev i juli, 3 synliga
    { slug: 'medeltidsmuseet', name: 'Medeltidsmuseet', city: 'Stockholm' }, // 7 ev i juli, 5 synliga
    { slug: 'malmomuseum', name: 'Malmö museum', city: 'Malmö' }, // 7 ev i juli, 7 synliga
    { slug: 'kramforsbibliotek', name: 'Kramfors bibliotek' }, // 7 ev i juli, 8 synliga
    { slug: 'Debasersthlm', name: 'Debaser', city: 'Stockholm' }, // 7 ev i juli, 7 synliga
    { slug: 'Dansalliansen', name: 'Dansalliansen' }, // 7 ev i juli, 7 synliga
    { slug: 'gallivarekultur', name: 'Gällivare Kultur', city: 'Gällivare' }, // 7 ev i juli, 2 synliga
    { slug: 'apollonsolna', name: 'Apollon Solna FK' }, // 7 ev i juli, 3 synliga
    { slug: 'naturumSkrylle', name: 'naturum Skrylle' }, // 6 ev i juli, 2 synliga
    { slug: 'StreetRollerHockeyLeague', name: 'https://www.facebook.com/share/g/', city: 'Eslöv' }, // 6 ev i juli, 1 synliga
    { slug: 'YogaZonBorgholm', name: 'YogaZon' }, // 6 ev i juli, 1 synliga
    { slug: 'yoganatur.se', name: 'YogaNatur' }, // 6 ev i juli, 8 synliga
    { slug: 'gunnesgard', name: 'Vikingagården Gunnes gård' }, // 6 ev i juli, 7 synliga
    { slug: 'meraloppis', name: 'Ulf Andersson' }, // 6 ev i juli, 5 synliga
    { slug: 'tunapark.se', name: 'Tuna Park', city: 'Eskilstuna' }, // 6 ev i juli, 3 synliga
    { slug: 'tobbetrollkarl', name: 'Tobbe Trollkarl', city: 'Västerås' }, // 6 ev i juli, 8 synliga
    { slug: 'spokguiden', name: 'Spökguiden' }, // 6 ev i juli, 8 synliga
    { slug: '1mr.langos', name: 'Mr.Lángos', city: 'Uppsala' }, // 6 ev i juli, 3 synliga
    { slug: 'norrvikenbastad', name: 'Norrviken' }, // 6 ev i juli, 2 synliga
    { slug: 'mats.fuchs.9', name: 'Mats Fuchs' }, // 6 ev i juli, 1 synliga
    { slug: 'LokalaHjalpenVasteras', name: 'Lokala Hjälpen', city: 'Västerås' }, // 6 ev i juli, 3 synliga
    { slug: 'gretasgothenburg', name: 'Gretas Göteborg', city: 'Göteborg' }, // 6 ev i juli, 4 synliga
    { slug: 'kristinehamnsbibliotek', name: 'Kristinehamns bibliotek', city: 'Kristinehamn' }, // 6 ev i juli, 4 synliga
    { slug: 'Faluguide', name: 'Faluguide', city: 'Falun' }, // 6 ev i juli, 8 synliga
    { slug: 'bibliotekenihalmstad', name: 'Biblioteken i Halmstad', city: 'Halmstad' }, // 6 ev i juli, 8 synliga
    { slug: 'alingsasparken', name: 'Alingsås Parken', city: 'Alingsås' }, // 6 ev i juli, 4 synliga
    { slug: 'ostgotamusiken', name: 'Östgötamusiken', city: 'Linköping' }, // 5 ev i juli, 8 synliga
    { slug: 'ulrikabeijeryoga', name: 'UB Yoga, Sång & Ceremoni', city: 'Hudiksvall' }, // 5 ev i juli, 6 synliga
    { slug: 'TillsammansHoor', name: 'Tillsammans Höör' }, // 5 ev i juli, 2 synliga
    { slug: 'stormspakhus', name: 'Storms Pakhus' }, // 5 ev i juli, 7 synliga
    { slug: 'pinkprogramming', name: 'Pink Programming', city: 'Hässleholm' }, // 5 ev i juli, 3 synliga
    { slug: 'paula.gocko', name: 'Paula Gocko', city: 'Eskilstuna' }, // 5 ev i juli, 2 synliga
    { slug: 'quiztyreso', name: 'QUIZ - Tyresö' }, // 5 ev i juli, 1 synliga
    { slug: 'northeventAB', name: 'Northevent AB', city: 'Mjölby' }, // 5 ev i juli, 8 synliga
    { slug: 'nordicsociety.org', name: 'Nordic society', city: 'Stockholm' }, // 5 ev i juli, 3 synliga
    { slug: 'nfacademy', name: 'NF Academy' }, // 5 ev i juli, 8 synliga
    { slug: 'musikidalarna', name: 'Musik i Dalarna', city: 'Falun' }, // 5 ev i juli, 8 synliga
    { slug: 'mjolbykommun', name: 'Mjölby kommun', city: 'Mjölby' }, // 5 ev i juli, 5 synliga
    { slug: 'linkopingairswing', name: 'Linköping Air Swing', city: 'Linköping' }, // 5 ev i juli, 8 synliga
    { slug: 'LandskronaBK', name: 'Landskrona Brukshundklubb', city: 'Landskrona' }, // 5 ev i juli, 1 synliga
    { slug: 'Kungalvsparken', name: 'Kungälvs Parken', city: 'Borås' }, // 5 ev i juli, 8 synliga
    { slug: 'kristianstadskommun', name: 'Kristianstads kommun', city: 'Kristianstad' }, // 5 ev i juli, 2 synliga
    { slug: 'klostretiystad', name: 'Klostret i Ystad', city: 'Ystad' }, // 5 ev i juli, 2 synliga
    { slug: 'krallentertainment', name: 'Krall Entertainment', city: 'Sundsvall' }, // 5 ev i juli, 7 synliga
    { slug: 'karlskronabibliotek', name: 'Karlskrona Stadsbibliotek', city: 'Karlskrona' }, // 5 ev i juli, 8 synliga
    { slug: 'HotellHavanna', name: 'Hotell Havanna', city: 'Varberg' }, // 5 ev i juli, 3 synliga
    { slug: 'gronalundstivoli', name: 'Gröna Lund', city: 'Stockholm' }, // 5 ev i juli, 1 synliga
    { slug: 'borjessonsbil', name: 'Börjessons Bil', city: 'Karlskrona' }, // 5 ev i juli, 5 synliga
    { slug: 'Blojupproret', name: 'Blöjupproret, Sveriges förening för EC och tygblöjor' }, // 5 ev i juli, 2 synliga
    { slug: 'attentionmolndal', name: 'Attention Mölndal' }, // 5 ev i juli, 8 synliga
    { slug: 'amplifiedvast', name: 'Amplified Väst', city: 'Borås' }, // 5 ev i juli, 4 synliga
    { slug: 'ABFsodertorn', name: 'ABF Södertörn' }, // 5 ev i juli, 8 synliga
    { slug: 'orebroteater', name: 'Örebro Teater' }, // 4 ev i juli, 1 synliga
    { slug: 'angebibliotek', name: 'Ånge centralbibliotek' }, // 4 ev i juli, 3 synliga
    { slug: 'alvsbyn', name: 'Älvsbyn' }, // 4 ev i juli, 7 synliga
    { slug: 'willhemab', name: 'Willhem AB', city: 'Linköping' }, // 4 ev i juli, 1 synliga
    { slug: 'vadstenabibliotek', name: 'Vadstena bibliotek' }, // 4 ev i juli, 6 synliga
    { slug: 'UppsalaBudoklubb', name: 'Uppsala Budoklubb', city: 'Uppsala' }, // 4 ev i juli, 6 synliga
    { slug: 'riksteaternhultsfred', name: 'Valhall Hultsfred' }, // 4 ev i juli, 1 synliga
    { slug: 'torsebrosvamp', name: 'Torsebro Svamp', city: 'Kristianstad' }, // 4 ev i juli, 8 synliga
    { slug: 'taichichuanEFT', name: 'Tivoliparken, Kristianstad', city: 'Kristianstad' }, // 4 ev i juli, 2 synliga
    { slug: 'steamhotel', name: 'The Steam Hotel', city: 'Västerås' }, // 4 ev i juli, 6 synliga
    { slug: 'TheTivoli', name: 'The Tivoli', city: 'Helsingborg' }, // 4 ev i juli, 8 synliga
    { slug: 'sodertaljestadsscen', name: 'Södertälje stadsscen' }, // 4 ev i juli, 8 synliga
    { slug: 'Transportnorrbotten', name: 'Svenska Transportarbetareförbundet Avdelning 26', city: 'Kiruna' }, // 4 ev i juli, 8 synliga
    { slug: 'svdalsland', name: 'Studieförbundet Vuxenskolan i Dalsland' }, // 4 ev i juli, 8 synliga
    { slug: 'stromtorpsik', name: 'Strömtorps IK' }, // 4 ev i juli, 1 synliga
    { slug: 'svorebrolan', name: 'Studieförbundet Vuxenskolan Örebro Län', city: 'Lindesberg' }, // 4 ev i juli, 8 synliga
    { slug: 'spiritofmansweden', name: 'Spirit of Man' }, // 4 ev i juli, 2 synliga
    { slug: 'SoulRelax.Motala', name: 'SoulRelax', city: 'Motala' }, // 4 ev i juli, 4 synliga
    { slug: 'skovdeaik', name: 'Skövde AIK', city: 'Skövde' }, // 4 ev i juli, 1 synliga
    { slug: 'Sjoangen', name: 'Sjöängen i Askersund' }, // 4 ev i juli, 5 synliga
    { slug: 'Salemcover', name: 'Salem 2.0' }, // 4 ev i juli, 8 synliga
    { slug: 'pifdam', name: 'PIF Damfotboll' }, // 4 ev i juli, 8 synliga
    { slug: 'kavlingeoldtimespub', name: 'Old Times Pub' }, // 4 ev i juli, 4 synliga
    { slug: 'molndalsdansskola', name: 'Mölndals Dansskola' }, // 4 ev i juli, 8 synliga
    { slug: 'naturskyddsforeningen.vanersborg', name: 'Naturskyddsföreningen Vänersborg' }, // 4 ev i juli, 8 synliga
    { slug: 'lommafolketshus', name: 'Lomma Folkets Hus' }, // 4 ev i juli, 4 synliga
    { slug: 'lerumsbibliotek', name: 'Kultur och bibliotek i Lerum' }, // 4 ev i juli, 8 synliga
    { slug: 'kristianstadjudo', name: 'Kristianstad Judoklubb', city: 'Kristianstad' }, // 4 ev i juli, 5 synliga
    { slug: 'Marknadsplatskarlskoga', name: 'Karlskoga, Örebro län' }, // 4 ev i juli, 1 synliga
    { slug: 'Ifoodfestival', name: 'International Food Festival', city: 'Göteborg' }, // 4 ev i juli, 4 synliga
    { slug: 'hcamarathon', name: 'HCA Marathon' }, // 4 ev i juli, 7 synliga
    { slug: 'huddingeparkrun', name: 'Huddinge Parkrun' }, // 4 ev i juli, 8 synliga
    { slug: 'gamlahalmstad', name: 'Gamla Halmstad', city: 'Halmstad' }, // 4 ev i juli, 2 synliga
    { slug: 'frimisorebro', name: 'Frimis' }, // 4 ev i juli, 7 synliga
    { slug: 'folkuniversitetetregionsyd', name: 'Folkuniversitetet Syd', city: 'Lund' }, // 4 ev i juli, 8 synliga
    { slug: 'eslovplus', name: 'Eslöv+', city: 'Eslöv' }, // 4 ev i juli, 2 synliga
    { slug: 'eksjobibliotek', name: 'Eksjö stadsbibliotek' }, // 4 ev i juli, 7 synliga
    { slug: 'DanshusetDkBuggie', name: 'Dansklubben Buggie i Ulricehamn' }, // 4 ev i juli, 5 synliga
    { slug: 'dansinordnya', name: 'Dans i Nord nya' }, // 4 ev i juli, 8 synliga
    { slug: 'Cafebiografen', name: 'Cafe biografen' }, // 4 ev i juli, 8 synliga
    { slug: 'bohuslanguider', name: 'Bohusläns Guider' }, // 4 ev i juli, 4 synliga
    { slug: 'bjuvsbibliotek', name: 'Bjuvs bibliotek' }, // 4 ev i juli, 6 synliga
    { slug: 'bergsakers', name: 'Bergsåker', city: 'Sundsvall' }, // 4 ev i juli, 2 synliga
    { slug: 'BibliotekeniKalmarkommun', name: 'Biblioteken i Kalmar kommun', city: 'Kalmar' }, // 4 ev i juli, 8 synliga
    { slug: 'arenahagmyren', name: 'Arena Hagmyren', city: 'Hudiksvall' }, // 4 ev i juli, 5 synliga
    { slug: 'alltidtjorn', name: 'Alltid Tjörn' }, // 4 ev i juli, 3 synliga
    { slug: 'hasse.soderstrom.77', name: '4R challenge' }, // 4 ev i juli, 5 synliga
    { slug: 'orebrobibliotek', name: 'Örebro bibliotek' }, // 3 ev i juli, 8 synliga
    { slug: 'orebro.salsafriends.9', name: 'Örebro Salsafriends' }, // 3 ev i juli, 5 synliga
    { slug: 'almhultsif', name: 'Älmhults IF' }, // 3 ev i juli, 8 synliga
    { slug: 'vaxjobibliotek', name: 'Växjö bibliotek' }, // 3 ev i juli, 8 synliga
    { slug: 'vaxjoloparklubb', name: 'Växjö Löparklubb' }, // 3 ev i juli, 1 synliga
    { slug: 'vasterasbibliotek', name: 'Västerås bibliotek', city: 'Västerås' }, // 3 ev i juli, 7 synliga
    { slug: 'litensmula', name: 'Vita Huset - En Liten Smula', city: 'Norrtälje' }, // 3 ev i juli, 8 synliga
    { slug: 'vallentunakulturhus', name: 'Vallentuna Kulturhus och Bibliotek' }, // 3 ev i juli, 5 synliga
    { slug: 'vallentunadans', name: 'Vallentuna Dans' }, // 3 ev i juli, 7 synliga
    { slug: 'herrestadsaiffotbollherr', name: 'Undavallen' }, // 3 ev i juli, 8 synliga
    { slug: 'trailtourumea', name: 'Umeå Trail' }, // 3 ev i juli, 8 synliga
    { slug: 'Bonanderfriskvard', name: 'Uddevalla, Västra Götalands län', city: 'Uddevalla' }, // 3 ev i juli, 5 synliga
    { slug: 'TyresoRoyalCrowns', name: 'Tyresö Royal Crowns' }, // 3 ev i juli, 3 synliga
    { slug: 'tradgardsresan', name: 'Trädgårdsresan' }, // 3 ev i juli, 8 synliga
    { slug: 'TormekSharpeningInnovation', name: 'Tormek', city: 'Lindesberg' }, // 3 ev i juli, 2 synliga
    { slug: 'teaterhalland', name: 'Teater Halland', city: 'Varberg' }, // 3 ev i juli, 3 synliga
    { slug: 'TeaterDictat', name: 'Teater Dictat' }, // 3 ev i juli, 3 synliga
    { slug: 'tangojamt', name: 'TangoJamt' }, // 3 ev i juli, 2 synliga
    { slug: 'Tangokompaniet', name: 'Tangokompaniet' }, // 3 ev i juli, 8 synliga
    { slug: 'swingum400', name: 'Swingum' }, // 3 ev i juli, 4 synliga
    { slug: 'swinginmotionab', name: 'Swing in motion', city: 'Borås' }, // 3 ev i juli, 8 synliga
    { slug: 'SundsvallsStadsbibliotek', name: 'Sundsvalls Stadsbibliotek', city: 'Sundsvall' }, // 3 ev i juli, 5 synliga
    { slug: 'sundbalans', name: 'Sund Balans' }, // 3 ev i juli, 3 synliga
    { slug: 'studioexpress.se', name: 'Studioexpress.se', city: 'Nyköping' }, // 3 ev i juli, 8 synliga
    { slug: 'Studieframjandetjamtlandharjedalen', name: 'Studiefrämjandet Jämtland/Härjedalen' }, // 3 ev i juli, 5 synliga
    { slug: 'svkalingsas', name: 'Stora Torget Alingsås', city: 'Alingsås' }, // 3 ev i juli, 8 synliga
    { slug: 'stenhusetgille', name: 'Stenhuset' }, // 3 ev i juli, 5 synliga
    { slug: 'hedemorafolketspark', name: 'Sommar-Bingo Hedemora Folkets Park 2026' }, // 3 ev i juli, 8 synliga
    { slug: 'lindasolacer', name: 'Solacer' }, // 3 ev i juli, 2 synliga
    { slug: 'skarahf', name: 'Skara HF' }, // 3 ev i juli, 8 synliga
    { slug: 'silvenska', name: 'Silvénska villan' }, // 3 ev i juli, 3 synliga
    { slug: 'Scalateatern', name: 'Scalateatern i Karlstad', city: 'Karlstad' }, // 3 ev i juli, 6 synliga
    { slug: 'naringslivsoderhamn', name: 'Näringsliv Söderhamns kommun', city: 'Söderhamn' }, // 3 ev i juli, 3 synliga
    { slug: 'mastersgalleri', name: 'Mästers Galleri - SKHF Skurupsbygdens konst- och hantverksförening' }, // 3 ev i juli, 1 synliga
    { slug: 'obosisverige', name: 'OBOS i Sverige' }, // 3 ev i juli, 1 synliga
    { slug: 'monarkmuseum', name: 'Monarkmuseum', city: 'Falkenberg' }, // 3 ev i juli, 1 synliga
    { slug: 'movendimjolby', name: 'Movendi Mjölby', city: 'Mjölby' }, // 3 ev i juli, 3 synliga
    { slug: 'loparfesten', name: 'Löparfesten Skanör-Falsterbo' }, // 3 ev i juli, 1 synliga
    { slug: 'malmo.zouk', name: 'Malmö, Skåne län' }, // 3 ev i juli, 1 synliga
    { slug: 'livironu', name: 'Liv-i-ro', city: 'Katrineholm' }, // 3 ev i juli, 2 synliga
    { slug: 'liveatheart', name: 'LIVE AT HEART' }, // 3 ev i juli, 1 synliga
    { slug: 'LandskronaFoto', name: 'Landskrona Foto', city: 'Landskrona' }, // 3 ev i juli, 8 synliga
    { slug: 'KulturcentrumSandviken', name: 'Kulturcentrum Sandviken', city: 'Sandviken' }, // 3 ev i juli, 5 synliga
    { slug: 'kulturkvarteret', name: 'Kulturkvarteret Kristianstad', city: 'Kristianstad' }, // 3 ev i juli, 7 synliga
    { slug: 'kulturisigma', name: 'Kultur i Sigma' }, // 3 ev i juli, 1 synliga
    { slug: 'konstmuseet', name: 'Konstmuseet', city: 'Skövde' }, // 3 ev i juli, 7 synliga
    { slug: 'JyskRejsebureau', name: 'Jysk Rejsebureau' }, // 3 ev i juli, 8 synliga
    { slug: 'Honggymnastikforening', name: 'Høng GF' }, // 3 ev i juli, 8 synliga
    { slug: 'Huddingekommun', name: 'Huddinge kommun' }, // 3 ev i juli, 8 synliga
    { slug: 'hotelskansenoland', name: 'Hotel Skansen' }, // 3 ev i juli, 8 synliga
    { slug: 'SwinginHepTown', name: 'HepTown' }, // 3 ev i juli, 8 synliga
    { slug: 'gnestakommun', name: 'Gnesta kommun', city: 'Strängnäs' }, // 3 ev i juli, 2 synliga
    { slug: 'Furuviksparken', name: 'Furuviksparken' }, // 3 ev i juli, 1 synliga
    { slug: 'FrokenLarssonHandelsbod', name: 'Fröken Larsson Vintage, Antikt & Secondhand' }, // 3 ev i juli, 2 synliga
    { slug: 'ericbergstroom', name: 'Eric Bergström', city: 'Jönköping' }, // 3 ev i juli, 5 synliga
    { slug: 'FriskaViljorFC', name: 'Friska Viljor FC' }, // 3 ev i juli, 8 synliga
    { slug: 'doroteabibliotek', name: 'Dorotea bibliotek / Kraapohken gærjagåetie' }, // 3 ev i juli, 5 synliga
    { slug: 'caferosenhill', name: 'Café Rosenhill' }, // 3 ev i juli, 1 synliga
    { slug: 'cafehelaideella', name: 'Café HELA ideella Landskrona', city: 'Landskrona' }, // 3 ev i juli, 2 synliga
    { slug: 'cufskaane', name: 'CUF Skåne' }, // 3 ev i juli, 8 synliga
    { slug: 'bradspelskafeet', name: 'Brädspelskaféet', city: 'Karlshamn' }, // 3 ev i juli, 5 synliga
    { slug: 'borlangekommun', name: 'Borlänge kommun', city: 'Borlänge' }, // 3 ev i juli, 2 synliga
    { slug: 'BorlangeDance', name: 'Borlänge Dance', city: 'Borlänge' }, // 3 ev i juli, 5 synliga
    { slug: 'bibliotekenilaholm', name: 'Biblioteken i Laholm', city: 'Laholm' }, // 3 ev i juli, 7 synliga
    { slug: 'bibliotekeniboras', name: 'Biblioteken i Borås', city: 'Borås' }, // 3 ev i juli, 7 synliga
    { slug: 'avensbylapland', name: 'Avens by Nature / Västerås Reiki Center', city: 'Västerås' }, // 3 ev i juli, 5 synliga
    { slug: 'autismblekinge', name: 'Autism Blekinge', city: 'Olofström' }, // 3 ev i juli, 1 synliga
    { slug: 'arbisnkpg', name: 'Arbis' }, // 3 ev i juli, 8 synliga
    { slug: 'alltpascen', name: 'Allt På Scen & Mycke Nöje', city: 'Lycksele' }, // 3 ev i juli, 8 synliga
    { slug: 'AlingsasDansklubb', name: 'Alingsås Dansklubb', city: 'Alingsås' }, // 3 ev i juli, 3 synliga
    { slug: 'alexhermanssonshow', name: 'Alex Hermansson' }, // 3 ev i juli, 8 synliga
    { slug: 'oviklatinodans', name: 'Övik Latinodans' }, // 2 ev i juli, 4 synliga
    { slug: 'destinationostersund', name: 'Östersund, Jämtland, Sweden' }, // 2 ev i juli, 8 synliga
    { slug: 'ObackaJazz', name: 'Öbacka Jazz&Blues Härnösand', city: 'Härnösand' }, // 2 ev i juli, 8 synliga
    { slug: 'almhultsbibliotek', name: 'Älmhults bibliotek' }, // 2 ev i juli, 6 synliga
    { slug: 'sdbollebygd', name: 'torget i Bollebygd' }, // 2 ev i juli, 8 synliga
    { slug: 'SossarLudvika', name: 'stadsparken Ludvika' }, // 2 ev i juli, 8 synliga
    { slug: 'medleymalmo', name: 'medley malmö' }, // 2 ev i juli, 8 synliga
    { slug: 'ColdFusionComedy', name: 'https://linktr.ee/Coldfusioncomedy' }, // 2 ev i juli, 2 synliga
    { slug: 'zatancruisers', name: 'Zatan Cruisers', city: 'Laholm' }, // 2 ev i juli, 8 synliga
    { slug: 'ystadsbibliotek', name: 'Ystads bibliotek', city: 'Ystad' }, // 2 ev i juli, 8 synliga
    { slug: 'yogaheart.nu', name: 'Yogaheart' }, // 2 ev i juli, 2 synliga
    { slug: 'YogaHusetFalun', name: 'Yogahuset Falun', city: 'Falun' }, // 2 ev i juli, 8 synliga
    { slug: 'WermlandOpera', name: 'Wermland Opera', city: 'Karlstad' }, // 2 ev i juli, 4 synliga
    { slug: 'studieframjandetmusikuppsala', name: 'Walmstedtska Gården' }, // 2 ev i juli, 8 synliga
    { slug: 'welcomehubhaugalandet', name: 'Welcome Hub Haugalandet' }, // 2 ev i juli, 2 synliga
    { slug: 'wafabbil', name: 'Wafab Bil', city: 'Arvika' }, // 2 ev i juli, 3 synliga
    { slug: 'vatterhemofficiell', name: 'Vätterhem', city: 'Jönköping' }, // 2 ev i juli, 1 synliga
    { slug: 'vasbykonsthall', name: 'Väsby Konsthall' }, // 2 ev i juli, 1 synliga
    { slug: 'varnamobibliotekochkultur', name: 'Värnamo bibliotek och kultur' }, // 2 ev i juli, 8 synliga
    { slug: 'vasbybk', name: 'Väsby Brukshundsklubb' }, // 2 ev i juli, 8 synliga
    { slug: 'varnamocity', name: 'Värnamo City' }, // 2 ev i juli, 5 synliga
    { slug: 'varldskulturmuseet', name: 'Världskulturmuseet' }, // 2 ev i juli, 6 synliga
    { slug: 'villalidkopingbk', name: 'Villa Lidköping BK', city: 'Lidköping' }, // 2 ev i juli, 2 synliga
    { slug: 'Voories1951', name: 'Voorbereidingskool George Preparatory School' }, // 2 ev i juli, 2 synliga
    { slug: 'bibliotekoupplevelser', name: 'Vingåkers bibliotek' }, // 2 ev i juli, 5 synliga
    { slug: 'VXOevent', name: 'VXO event' }, // 2 ev i juli, 1 synliga
    { slug: 'Upplandsmuseet', name: 'Upplandsmuseet', city: 'Uppsala' }, // 2 ev i juli, 8 synliga
    { slug: 'umefox', name: 'UmeFox' }, // 2 ev i juli, 3 synliga
    { slug: 'Uddevallakassetten', name: 'Uddevallakassetten', city: 'Uddevalla' }, // 2 ev i juli, 8 synliga
    { slug: 'tandsticksmuseet', name: 'Tändsticksmuseet', city: 'Jönköping' }, // 2 ev i juli, 1 synliga
    { slug: 'typ1festival', name: 'Typ1Festival', city: 'Hässleholm' }, // 2 ev i juli, 1 synliga
    { slug: 'dalarodyksallskap', name: 'Torvalla sporthall' }, // 2 ev i juli, 5 synliga
    { slug: 'naasdk', name: 'Tingshuset Lerum' }, // 2 ev i juli, 2 synliga
    { slug: 'TornsIF', name: 'Torns IF', city: 'Lund' }, // 2 ev i juli, 8 synliga
    { slug: 'tibrobibliotek', name: 'Tibro bibliotek' }, // 2 ev i juli, 4 synliga
    { slug: 'Thimouryoga', name: 'Thimour Yoga', city: 'Borås' }, // 2 ev i juli, 2 synliga
    { slug: 'jointhestudentlife', name: 'The Student Life', city: 'Uppsala' }, // 2 ev i juli, 8 synliga
    { slug: 'ThePulsebar2023', name: 'The Pulse' }, // 2 ev i juli, 4 synliga
    { slug: 'thabelatravel', name: 'Thabela Travel' }, // 2 ev i juli, 8 synliga
    { slug: 'tgsportbar', name: 'TG Sportbar & Restaurang', city: 'Staffanstorp' }, // 2 ev i juli, 1 synliga
    { slug: 'svartebyalag', name: 'Svarte' }, // 2 ev i juli, 3 synliga
    { slug: 'surfviken', name: 'Surfviken' }, // 2 ev i juli, 1 synliga
    { slug: 'stalebo.ridklubb.official', name: 'Stålebo Ridklubb' }, // 2 ev i juli, 8 synliga
    { slug: 'streetfoodskandinavia', name: 'Street Food Skandinavia', city: 'Hudiksvall' }, // 2 ev i juli, 3 synliga
    { slug: 'Storlihytta', name: 'Storlihytta' }, // 2 ev i juli, 8 synliga
    { slug: 'Malaroschack', name: 'Stockholms län' }, // 2 ev i juli, 2 synliga
    { slug: 'mpvetlanda', name: 'Stortorget' }, // 2 ev i juli, 2 synliga
    { slug: 'anders.sundstrom.73', name: 'Stavaträsk' }, // 2 ev i juli, 8 synliga
    { slug: 'stadshallen', name: 'Stadshallen' }, // 2 ev i juli, 6 synliga
    { slug: 'malmostadsbibliotek', name: 'Stadsbiblioteket i Malmö' }, // 2 ev i juli, 8 synliga
    { slug: 'SpangaHockey', name: 'Spånga Hockey' }, // 2 ev i juli, 2 synliga
    { slug: 'svkalmarlan', name: 'Sporthallen Nybro', city: 'Nybro' }, // 2 ev i juli, 8 synliga
    { slug: 'royal.roland.5623', name: 'SoundTrack Roland' }, // 2 ev i juli, 2 synliga
    { slug: 'sommarparadisetsandviken', name: 'Sommarparadiset Sandviken', city: 'Sandviken' }, // 2 ev i juli, 8 synliga
    { slug: 'NaturStark.se', name: 'Sollentuna, Stockholms län' }, // 2 ev i juli, 8 synliga
    { slug: 'Solidaritet.Ornskoldsvik', name: 'Solidaritet Örnsköldsvik' }, // 2 ev i juli, 1 synliga
    { slug: 'snackan.nu', name: 'Snäckan' }, // 2 ev i juli, 8 synliga
    { slug: 'smalandsuppsala', name: 'Smålands nation', city: 'Uppsala' }, // 2 ev i juli, 5 synliga
    { slug: 'Snapphanarnasrf', name: 'Snapphanarnas Ryttarförening', city: 'Sölvesborg' }, // 2 ev i juli, 8 synliga
    { slug: 'Smalands', name: 'Smålands Nation', city: 'Lund' }, // 2 ev i juli, 5 synliga
    { slug: 'slagelsebib', name: 'Slagelse Bibliotekerne' }, // 2 ev i juli, 8 synliga
    { slug: 'skanskabyggvaror', name: 'Skånska Byggvaror', city: 'Göteborg' }, // 2 ev i juli, 8 synliga
    { slug: 'MUFenkoping', name: 'Skolparken i Enköping', city: 'Enköping' }, // 2 ev i juli, 8 synliga
    { slug: 'skogskraft.nu', name: 'SkogsKraft.nu', city: 'Stockholm' }, // 2 ev i juli, 1 synliga
    { slug: 'skistarsverige', name: 'SkiStar', city: 'Helsingborg' }, // 2 ev i juli, 2 synliga
    { slug: 'sigtunastiftelsen', name: 'Sigtunastiftelsen' }, // 2 ev i juli, 5 synliga
    { slug: 'shrekraveofficial', name: 'Shrek Rave' }, // 2 ev i juli, 8 synliga
    { slug: 'SalemStavanger', name: 'Salem Stavanger' }, // 2 ev i juli, 2 synliga
    { slug: 'SsdkKarlshamn', name: 'SSDK Karlshamn', city: 'Karlshamn' }, // 2 ev i juli, 2 synliga
    { slug: 'Esso36', name: 'SO36' }, // 2 ev i juli, 8 synliga
    { slug: 'Smcostergotland', name: 'SMC Östergötland' }, // 2 ev i juli, 8 synliga
    { slug: 'satssverige', name: 'SATS Sverige', city: 'Helsingborg' }, // 2 ev i juli, 2 synliga
    { slug: 'miguel.delgado.3998', name: 'SALSA i VARBERG', city: 'Varberg' }, // 2 ev i juli, 3 synliga
    { slug: 'lottamarkhester', name: 'Reikicentrum Oskarshamn', city: 'Oskarshamn' }, // 2 ev i juli, 2 synliga
    { slug: 'reisdegkomikerklubb', name: 'Reis Deg Komikerklubb' }, // 2 ev i juli, 4 synliga
    { slug: 'rehnsbk', name: 'Rehns BK' }, // 2 ev i juli, 2 synliga
    { slug: 'regionmuseetskane', name: 'Regionmuseet Skåne', city: 'Kristianstad' }, // 2 ev i juli, 3 synliga
    { slug: 'rfsisu.norrbotten', name: 'RF - SISU Norrbotten' }, // 2 ev i juli, 3 synliga
    { slug: 'rfsisuvn', name: 'RF - SISU Västernorrland', city: 'Härnösand' }, // 2 ev i juli, 7 synliga
    { slug: 'ReStoredSE', name: 'RESTORED' }, // 2 ev i juli, 1 synliga
    { slug: 'punkfestsoderhamn', name: 'Punkfest Söderhamn', city: 'Söderhamn' }, // 2 ev i juli, 1 synliga
    { slug: 'CDMortenSteen', name: 'PADI Course Director Morten Steen' }, // 2 ev i juli, 8 synliga
    { slug: 'oxiebiblioteket', name: 'Oxiebiblioteket' }, // 2 ev i juli, 5 synliga
    { slug: 'gronklitt', name: 'Orsa Grönklitt' }, // 2 ev i juli, 1 synliga
    { slug: 'skogsvargarna', name: 'OK Skogsvargarna', city: 'Lidköping' }, // 2 ev i juli, 4 synliga
    { slug: 'nordboetnorrkoping', name: 'Nördboet', city: 'Norrköping' }, // 2 ev i juli, 1 synliga
    { slug: 'svenskaafghanhundklubben', name: 'Nykvarns Hundhall' }, // 2 ev i juli, 1 synliga
    { slug: 'norskamatorteaterforbund', name: 'Norsk Amatørteaterforbund' }, // 2 ev i juli, 8 synliga
    { slug: 'NorrlandTulpaner', name: 'Norrlands Tulpan Trädgård', city: 'Hudiksvall' }, // 2 ev i juli, 5 synliga
    { slug: 'nieuscene', name: 'Nieu Torshov' }, // 2 ev i juli, 7 synliga
    { slug: 'stadshotelletnora', name: 'Nora Bokhandel', city: 'Nora' }, // 2 ev i juli, 8 synliga
    { slug: 'nerikesbikers', name: 'Nerikes Bikers' }, // 2 ev i juli, 1 synliga
    { slug: 'naturumblekinge', name: 'Naturum Blekinge', city: 'Ronneby' }, // 2 ev i juli, 2 synliga
    { slug: 'nfharnosand', name: 'Naturskyddsföreningen Härnösand', city: 'Härnösand' }, // 2 ev i juli, 1 synliga
    { slug: 'natminkulturhus', name: 'Nationella minoriteters kulturhus' }, // 2 ev i juli, 6 synliga
    { slug: 'nackalokalhistoriska', name: 'Nacka lokalhistoriska arkiv' }, // 2 ev i juli, 1 synliga
    { slug: 'mollerstivoli', name: 'Möllers Tivoli', city: 'Helsingborg' }, // 2 ev i juli, 1 synliga
    { slug: 'nbvost', name: 'NBV Öst' }, // 2 ev i juli, 3 synliga
    { slug: 'monica.karlsson.399', name: 'Motala biologiska förening', city: 'Motala' }, // 2 ev i juli, 3 synliga
    { slug: 'MotalaBasket', name: 'Motala Basket - W72', city: 'Motala' }, // 2 ev i juli, 1 synliga
    { slug: 'mormorsgruvan', name: 'Mormorsgruvans byalag' }, // 2 ev i juli, 8 synliga
    { slug: 'Molekylverkstan', name: 'Molekylverkstan' }, // 2 ev i juli, 4 synliga
    { slug: 'Midsommargarden', name: 'Midsommargården' }, // 2 ev i juli, 8 synliga
    { slug: 'michaelvogensen.dk', name: 'Michael Vogensen' }, // 2 ev i juli, 5 synliga
    { slug: 'Megascope', name: 'Megascope' }, // 2 ev i juli, 8 synliga
    { slug: 'bodyandsoulmovement', name: 'Maria Slättorp' }, // 2 ev i juli, 4 synliga
    { slug: 'malmocityskaters', name: 'Malmö City Skaters' }, // 2 ev i juli, 7 synliga
    { slug: 'malmolive', name: 'Malmö Live' }, // 2 ev i juli, 6 synliga
    { slug: 'motorklubbentandstiftet', name: 'Malmö Stad' }, // 2 ev i juli, 7 synliga
    { slug: 'Lakarmissionen', name: 'Läkarmissionen' }, // 2 ev i juli, 8 synliga
    { slug: '100064821650850', name: 'Lundansarna', city: 'Lund' }, // 2 ev i juli, 8 synliga
    { slug: 'liverestaurangen', name: 'Luleå Energi Arena' }, // 2 ev i juli, 8 synliga
    { slug: 'norrkoping.symphony', name: 'Louis De Geer-hallen Norrköping', city: 'Norrköping' }, // 2 ev i juli, 8 synliga
    { slug: 'LottasOmtanke', name: 'Lottas Omtanke', city: 'Oskarshamn' }, // 2 ev i juli, 2 synliga
    { slug: 'ludvikakommun', name: 'Ludvika kommun' }, // 2 ev i juli, 1 synliga
    { slug: 'Ljudaborg', name: 'Ljudaborg' }, // 2 ev i juli, 8 synliga
    { slug: 'LiveAlmhult', name: 'Live Älmhult' }, // 2 ev i juli, 5 synliga
    { slug: 'lillaedetskommun', name: 'Lilla Edets kommun' }, // 2 ev i juli, 4 synliga
    { slug: 'Linkoepingslistan', name: 'Linköpingslistan', city: 'Linköping' }, // 2 ev i juli, 8 synliga
    { slug: 'LiljansHaxbod', name: 'Liljans häxbod' }, // 2 ev i juli, 1 synliga
    { slug: 'lidingostad', name: 'Lidingö stad' }, // 2 ev i juli, 1 synliga
    { slug: 'perry.mason.14', name: 'Lasse Nilsson' }, // 2 ev i juli, 1 synliga
    { slug: 'Landskronastad', name: 'Landskrona stad', city: 'Landskrona' }, // 2 ev i juli, 2 synliga
    { slug: 'lantmannenmaskinochlantbruk', name: 'Lantmännen Maskin och Lantmännen Lantbruk' }, // 2 ev i juli, 8 synliga
    { slug: 'landskronasurfcenter', name: 'Landskrona SurfCenter', city: 'Landskrona' }, // 2 ev i juli, 3 synliga
    { slug: 'laila.amrouche', name: 'Laila Amrouche', city: 'Uddevalla' }, // 2 ev i juli, 5 synliga
    { slug: 'kungalvskommun', name: 'Kungälvs kommun' }, // 2 ev i juli, 1 synliga
    { slug: 'KBASQUARE', name: 'Kungsbacka Square Dancers', city: 'Kungsbacka' }, // 2 ev i juli, 3 synliga
    { slug: 'Kulturenshus', name: 'Kulturens hus Luleå' }, // 2 ev i juli, 8 synliga
    { slug: 'kulturaktiebolaget', name: 'Kulturaktiebolaget', city: 'Karlstad' }, // 2 ev i juli, 8 synliga
    { slug: 'kulturiale', name: 'Kultur i Ale' }, // 2 ev i juli, 5 synliga
    { slug: 'carina.grahnhellberg', name: 'Krokom, Jämtlands län' }, // 2 ev i juli, 8 synliga
    { slug: 'kulturitranemo', name: 'Kultur i Tranemo' }, // 2 ev i juli, 1 synliga
    { slug: 'kristnaregnbagsrorelsen', name: 'Kristna regnbågsrörelsen - Riksförbundet EKHO' }, // 2 ev i juli, 7 synliga
    { slug: 'MimersKulturhus', name: 'Kongahällaleden' }, // 2 ev i juli, 8 synliga
    { slug: 'klingsbergsforlagab', name: 'Klingsbergs Förlag AB', city: 'Norrköping' }, // 2 ev i juli, 6 synliga
    { slug: 'KSHHealing', name: 'KSH Healing', city: 'Kalmar' }, // 2 ev i juli, 4 synliga
    { slug: 'koijkonsthantverk', name: 'KOiJ Konsthantverk i Jönköping', city: 'Jönköping' }, // 2 ev i juli, 8 synliga
    { slug: 'jkpglm', name: 'Jönköpings läns museum' }, // 2 ev i juli, 5 synliga
    { slug: 'kdoxelosund', name: 'Järntorget Oxelösund' }, // 2 ev i juli, 2 synliga
    { slug: 'gospelgiz', name: 'Joy Singers', city: 'Ljungby' }, // 2 ev i juli, 8 synliga
    { slug: 'BritaStina', name: 'Jokkmokk, Norrbottens län' }, // 2 ev i juli, 8 synliga
    { slug: 'jagvagarstuffa', name: 'Jag vågar stuffa', city: 'Karlshamn' }, // 2 ev i juli, 8 synliga
    { slug: 'JCIHalmstad', name: 'JCI Halmstad', city: 'Halmstad' }, // 2 ev i juli, 1 synliga
    { slug: 'HoforsHockey', name: 'Ishallen Hofors' }, // 2 ev i juli, 1 synliga
    { slug: 'inger.ericson.7', name: 'Inger Ericson', city: 'Borlänge' }, // 2 ev i juli, 6 synliga
    { slug: 'michael.haggmark.1', name: 'JLS Jämtlands Lokalhistoriker och Släktforskare' }, // 2 ev i juli, 4 synliga
    { slug: 'ikeaumea', name: 'IKEA', city: 'Sundsvall' }, // 2 ev i juli, 8 synliga
    { slug: 'IFKKristianstad', name: 'IFK Kristianstad', city: 'Kristianstad' }, // 2 ev i juli, 1 synliga
    { slug: '100063537131403', name: 'Hårdrockskören', city: 'Gävle' }, // 2 ev i juli, 8 synliga
    { slug: 'borgmastarvilla', name: 'Hotell Humbla', city: 'Sölvesborg' }, // 2 ev i juli, 2 synliga
    { slug: 'ginanykvist', name: 'Hojkompisar Stockholm med omnejd', city: 'Stockholm' }, // 2 ev i juli, 2 synliga
    { slug: 'Hedenstedbibliotekerne', name: 'Hedensted Bibliotekerne' }, // 2 ev i juli, 8 synliga
    { slug: 'headstompproductions', name: 'Headstomp Productions' }, // 2 ev i juli, 8 synliga
    { slug: 'assistanspoolen', name: 'Hedera Assistans Region Syd', city: 'Helsingborg' }, // 2 ev i juli, 8 synliga
    { slug: 'sfrgotland', name: 'Hantverkshuset Burgsvik', city: 'Burgsvik' }, // 2 ev i juli, 8 synliga
    { slug: 'malinstang.se', name: 'Hamra Trail Run' }, // 2 ev i juli, 1 synliga
    { slug: 'kraniosakralterapihastochmanniska', name: 'Göteborg', city: 'Göteborg' }, // 2 ev i juli, 2 synliga
    { slug: 'gbgmarvels', name: 'Göteborg Marvels', city: 'Göteborg' }, // 2 ev i juli, 8 synliga
    { slug: 'gallivare.se', name: 'Gällivare kommun', city: 'Gällivare' }, // 2 ev i juli, 6 synliga
    { slug: 'gotams', name: 'Göta MS', city: 'Enköping' }, // 2 ev i juli, 8 synliga
    { slug: 'GrastorpsBygdegardsforening', name: 'Grästorps Bygdegårdsförening' }, // 2 ev i juli, 5 synliga
    { slug: '61581592990656', name: 'Gustavs Skjul Orust' }, // 2 ev i juli, 2 synliga
    { slug: 'Glimmingehus', name: 'Glimmingehus' }, // 2 ev i juli, 2 synliga
    { slug: 'gemenskapikungsor', name: 'Gemenskap i Kungsör' }, // 2 ev i juli, 8 synliga
    { slug: 'gellerasenkarlskoga', name: 'Gelleråsen, Karlskoga' }, // 2 ev i juli, 5 synliga
    { slug: 'Gardenoffeathers', name: 'Garden of Feathers', city: 'Staffanstorp' }, // 2 ev i juli, 8 synliga
    { slug: 'foreningensm', name: 'Föreningen Söderhamns Museum', city: 'Söderhamn' }, // 2 ev i juli, 2 synliga
    { slug: 'FylgjaHelandeHarmoni', name: 'Fylgja - helande harmoni' }, // 2 ev i juli, 6 synliga
    { slug: 'claes.toyra.9', name: 'Fyristorg' }, // 2 ev i juli, 8 synliga
    { slug: 'frirumsandviken', name: 'Frirum Sandviken', city: 'Sandviken' }, // 2 ev i juli, 2 synliga
    { slug: 'freemoveyogastudio.nu', name: 'Freemove Yogastudio' }, // 2 ev i juli, 7 synliga
    { slug: 'fjarasaik', name: 'Fjärås AIK, FAIK' }, // 2 ev i juli, 1 synliga
    { slug: 'FjordCadenza', name: 'Fjord Cadenza' }, // 2 ev i juli, 8 synliga
    { slug: 'fagerstascouterna', name: 'Fagersta Scoutkår' }, // 2 ev i juli, 2 synliga
    { slug: 'estrad.norr', name: 'Estrad Norr' }, // 2 ev i juli, 6 synliga
    { slug: 'enkopingsmassan', name: 'Enköpingsmässan', city: 'Enköping' }, // 2 ev i juli, 4 synliga
    { slug: 'energiheaxorna', name: 'Energihäxorna' }, // 2 ev i juli, 3 synliga
    { slug: 'EnaBuggSwing', name: 'Ena Bugg & Swing', city: 'Enköping' }, // 2 ev i juli, 8 synliga
    { slug: 'dragonflystudioavesta', name: 'Dragonfly Studio' }, // 2 ev i juli, 2 synliga
    { slug: 'Discaid', name: 'Discaid' }, // 2 ev i juli, 6 synliga
    { slug: 'dismitt', name: 'Dis-Mitt' }, // 2 ev i juli, 1 synliga
    { slug: 'diamondsdirectstore', name: 'Diamonds Direct' }, // 2 ev i juli, 8 synliga
    { slug: 'DestinationSundsvall', name: 'Destination Sundsvall', city: 'Sundsvall' }, // 2 ev i juli, 5 synliga
    { slug: 'denvitaliljan', name: 'Den Vita Liljan' }, // 2 ev i juli, 2 synliga
    { slug: 'dansofolkton', name: 'Dans & Folkton' }, // 2 ev i juli, 8 synliga
    { slug: 'dalarasten', name: 'Dalarasten' }, // 2 ev i juli, 8 synliga
    { slug: 'Droskan.se', name: 'DROSKAN' }, // 2 ev i juli, 8 synliga
    { slug: 'munkbuggarna', name: 'DF Munkbuggarna' }, // 2 ev i juli, 5 synliga
    { slug: 'WheelsOfCarlshamn', name: 'Cykelklubben Wheels Of Carlshamn' }, // 2 ev i juli, 1 synliga
    { slug: 'CooperativaCovibar', name: 'Covibar' }, // 2 ev i juli, 4 synliga
    { slug: 'classicmotor', name: 'Classic Motor' }, // 2 ev i juli, 8 synliga
    { slug: 'ClassicCarWeek', name: 'Classic Car Week' }, // 2 ev i juli, 3 synliga
    { slug: 'clarionsundsvall', name: 'Clarion Hotel Sundsvall', city: 'Sundsvall' }, // 2 ev i juli, 3 synliga
    { slug: 'cirkusmuseet', name: 'Cirkusmuseet' }, // 2 ev i juli, 1 synliga
    { slug: 'centrumhusbiografen', name: 'Centrumhusbiografen' }, // 2 ev i juli, 8 synliga
    { slug: 'CirkusStavanger', name: 'CIRKUS' }, // 2 ev i juli, 8 synliga
    { slug: 'charlottepolsonkonsert', name: 'Charlotte Polson - konsert', city: 'Ljungby' }, // 2 ev i juli, 1 synliga
    { slug: 'boulognerskogenparkrun', name: 'Boulognerskogen, Gävle', city: 'Gävle' }, // 2 ev i juli, 4 synliga
    { slug: 'JonkopingsLansKonstforening', name: 'Borås, Västra Götalands län', city: 'Borås' }, // 2 ev i juli, 1 synliga
    { slug: 'BorasDansforening', name: 'Borås Dansförening', city: 'Borås' }, // 2 ev i juli, 4 synliga
    { slug: 'BollebygdsRidklubb', name: 'Bollebygds Ridklubb' }, // 2 ev i juli, 1 synliga
    { slug: 'MuseetBollnasKonsthall', name: 'Bollnäs Museum & Konsthall' }, // 2 ev i juli, 2 synliga
    { slug: 'boca.vasteras', name: 'Boca Västerås', city: 'Västerås' }, // 2 ev i juli, 2 synliga
    { slug: 'Studieforbundetbildanord', name: 'Björkstalaget' }, // 2 ev i juli, 7 synliga
    { slug: 'bohusfastning', name: 'Bohus Fästning' }, // 2 ev i juli, 7 synliga
    { slug: 'biokontrastiggesund', name: 'Bio Kontrast - Folkets Hus Iggesund' }, // 2 ev i juli, 2 synliga
    { slug: 'Bipolarforeningen.Norge', name: 'Bipolarforeningen Norge' }, // 2 ev i juli, 8 synliga
    { slug: 'BaraManVill', name: 'Bara man Vill' }, // 2 ev i juli, 2 synliga
    { slug: 'backtobiblecommunity', name: 'Back to Bible Community Church', city: 'Lund' }, // 2 ev i juli, 2 synliga
    { slug: 'autismskane', name: 'Autism Skåne', city: 'Kristianstad' }, // 2 ev i juli, 1 synliga
    { slug: 'Askelabben', name: 'Askelabben Hundesenter' }, // 2 ev i juli, 4 synliga
    { slug: 'arttourssthlm', name: 'Art Tours Sthlm', city: 'Stockholm' }, // 2 ev i juli, 5 synliga
    { slug: 'arbogabio', name: 'Arboga bio' }, // 2 ev i juli, 8 synliga
    { slug: 'anders.forss.7', name: 'Anders Forss' }, // 2 ev i juli, 3 synliga
    { slug: 'AlingsasHK', name: 'Alingsås HK', city: 'Alingsås' }, // 2 ev i juli, 8 synliga
    { slug: 'ungdomsgardentimra', name: 'Aktivitetshuset Pangea' }, // 2 ev i juli, 5 synliga
    { slug: 'Hjovidvattern', name: 'Ahlins Gasmix' }, // 2 ev i juli, 2 synliga
    { slug: 'aabendans', name: 'Aaben Dans' }, // 2 ev i juli, 6 synliga
    { slug: 'dalarna.abf', name: 'ABF Dalarna', city: 'Falun' }, // 2 ev i juli, 2 synliga
    { slug: 'abfmalmo', name: 'ABF Malmö' }, // 2 ev i juli, 8 synliga
    { slug: '73ansloppis', name: '73ans loppis' }, // 2 ev i juli, 8 synliga
];
