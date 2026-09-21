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
    { slug: 'jubelAB', name: 'Visit Örebro' }, // 409 ev i juli, 8 synliga
    { slug: 'LiveEventRadar', name: 'Live Event Radar' }, // 113 ev i juli, 8 synliga
    { slug: 'kalixfolketshus', name: 'Kalix Kommun' }, // 94 ev i juli, 8 synliga
    { slug: 'varjesteg', name: 'VarjeSteg' }, // 51 ev i juli, 8 synliga
    { slug: 'feverup', name: 'Fever', city: 'Stockholm' }, // 47 ev i juli, 8 synliga
    { slug: 'laughseats', name: 'Laugh Seats' }, // 47 ev i juli, 8 synliga
    { slug: 'TicketDealsEurope', name: 'Ticket Deals' }, // 38 ev i juli, 8 synliga
    { slug: 'hundesenteretitrondheim', name: 'Hundesenteret' }, // 31 ev i juli, 8 synliga
    { slug: 'ABFsorm', name: 'ABF Sörmland', city: 'Eskilstuna' }, // 31 ev i juli, 8 synliga
    { slug: 'Moveat.Sweden', name: 'Moveat', city: 'Stockholm' }, // 29 ev i juli, 8 synliga
    { slug: 'nieuscene', name: 'Nieu Torshov' }, // 26 ev i juli, 7 synliga
    { slug: 'Vaxjodyksport', name: 'Växjödyksport', city: 'Växjö' }, // 24 ev i juli, 8 synliga
    { slug: 'vaccin.sverige', name: 'Vaccin.nu', city: 'Hässleholm' }, // 23 ev i juli, 8 synliga
    { slug: 'StudieforbundetVuxenskolanVast', name: 'Studieförbundet Vuxenskolan Väst', city: 'Uddevalla' }, // 23 ev i juli, 6 synliga
    { slug: 'vaxjobibliotek', name: 'Växjö bibliotek' }, // 22 ev i juli, 8 synliga
    { slug: 'vaniumeasida', name: 'Vän i Umeå' }, // 22 ev i juli, 8 synliga
    { slug: 'hemfranderome', name: 'Hem från Derome', city: 'Varberg' }, // 22 ev i juli, 6 synliga
    { slug: 'jazzclubfasching', name: 'Fasching' }, // 22 ev i juli, 7 synliga
    { slug: 'medborgarskolanjamtland', name: 'Medborgarskolan' }, // 21 ev i juli, 8 synliga
    { slug: 'fagerstakommun', name: 'Skinnskattebergs Kommun' }, // 19 ev i juli, 1 synliga
    { slug: 'molndalsdansskola', name: 'Mölndals Dansskola' }, // 19 ev i juli, 8 synliga
    { slug: 'Honggymnastikforening', name: 'Høng GF' }, // 18 ev i juli, 8 synliga
    { slug: 'northeventAB', name: 'Northevent AB', city: 'Karlstad' }, // 18 ev i juli, 8 synliga
    { slug: 'Eskilstunastadsbibliotek', name: 'Eskilstuna stadsbibliotek', city: 'Eskilstuna' }, // 18 ev i juli, 8 synliga
    { slug: 'diamondsdirectstore', name: 'Diamonds Direct' }, // 18 ev i juli, 8 synliga
    { slug: 'bioroy', name: 'Bio Roy' }, // 17 ev i juli, 8 synliga
    { slug: 'trivselhussverige', name: 'Trivselhus', city: 'Helsingborg' }, // 16 ev i juli, 4 synliga
    { slug: 'taystase', name: 'Taysta', city: 'Jönköping' }, // 16 ev i juli, 8 synliga
    { slug: 'bibliotekenihalmstad', name: 'Biblioteken i Halmstad', city: 'Halmstad' }, // 16 ev i juli, 8 synliga
    { slug: 'jointhestudentlife', name: 'The Student Life', city: 'Uppsala' }, // 15 ev i juli, 8 synliga
    { slug: 'kalmarnationlund', name: 'Kalmar Nation', city: 'Lund' }, // 15 ev i juli, 6 synliga
    { slug: 'hotelskansenoland', name: 'Hotel Skansen', city: 'Kalmar' }, // 15 ev i juli, 8 synliga
    { slug: 'Hjaltevadshus', name: 'Hjältevadshus', city: 'Eskilstuna' }, // 15 ev i juli, 4 synliga
    { slug: 'Cafebiografen', name: 'Cafe biografen' }, // 15 ev i juli, 8 synliga
    { slug: 'stormspakhus', name: 'Storms Pakhus' }, // 14 ev i juli, 7 synliga
    { slug: 'Scalateatern', name: 'Scalateatern i Karlstad', city: 'Karlstad' }, // 14 ev i juli, 8 synliga
    { slug: 'Megascope', name: 'Megascope' }, // 14 ev i juli, 8 synliga
    { slug: 'kulturaktiebolaget', name: 'Kulturaktiebolaget', city: 'Karlstad' }, // 14 ev i juli, 8 synliga
    { slug: 'lerumsbibliotek', name: 'Kultur och bibliotek i Lerum' }, // 14 ev i juli, 7 synliga
    { slug: 'kulturiale', name: 'Kultur i Ale' }, // 14 ev i juli, 7 synliga
    { slug: 'attentionmolndal', name: 'Attention Mölndal' }, // 14 ev i juli, 8 synliga
    { slug: 'medleymalmo', name: 'medley malmö' }, // 13 ev i juli, 8 synliga
    { slug: 'Tangokompaniet', name: 'Tangokompaniet', city: 'Lund' }, // 13 ev i juli, 8 synliga
    { slug: 'vadhanderistockholm', name: 'Vad som händer i Stockholm', city: 'Stockholm' }, // 13 ev i juli, 6 synliga
    { slug: 'norrlandsoperan', name: 'Norrlandsoperan' }, // 13 ev i juli, 5 synliga
    { slug: 'studioexpress.se', name: 'Studioexpress.se', city: 'Nyköping' }, // 13 ev i juli, 8 synliga
    { slug: 'musikidalarna', name: 'Musik i Dalarna', city: 'Falun' }, // 13 ev i juli, 7 synliga
    { slug: 'kulturkvarteret', name: 'Kulturkvarteret Kristianstad', city: 'Kristianstad' }, // 13 ev i juli, 8 synliga
    { slug: 'folkuniversitetetregionsyd', name: 'Folkuniversitetet Syd', city: 'Lund' }, // 13 ev i juli, 8 synliga
    { slug: 'KulturcentrumSandviken', name: 'Kulturcentrum Sandviken', city: 'Sandviken' }, // 13 ev i juli, 6 synliga
    { slug: 'baravanlig.se', name: 'Bara Vanlig', city: 'Lund' }, // 13 ev i juli, 8 synliga
    { slug: 'varnamobibliotekochkultur', name: 'Värnamo bibliotek och kultur' }, // 12 ev i juli, 8 synliga
    { slug: 'litensmula', name: 'Vita Huset - En Liten Smula', city: 'Norrtälje' }, // 12 ev i juli, 8 synliga
    { slug: 'junisalvsborgdistrikt', name: 'Movendi Älvsborg', city: 'Alingsås' }, // 12 ev i juli, 8 synliga
    { slug: 'svdalsland', name: 'Studieförbundet Vuxenskolan i Dalsland' }, // 12 ev i juli, 8 synliga
    { slug: 'SundsvallsStadsbibliotek', name: 'Sundsvalls Stadsbibliotek', city: 'Sundsvall' }, // 12 ev i juli, 8 synliga
    { slug: 'movehomesverige', name: 'Movehome', city: 'Motala' }, // 12 ev i juli, 4 synliga
    { slug: 'gotlandsmuseum', name: 'Gotlands Museum', city: 'Tingstäde' }, // 12 ev i juli, 5 synliga
    { slug: 'Debasersthlm', name: 'Debaser', city: 'Stockholm' }, // 12 ev i juli, 7 synliga
    { slug: 'dalarnasmuseum', name: 'Dalarnas museum', city: 'Falun' }, // 12 ev i juli, 3 synliga
    { slug: 'BorlangeDance', name: 'Borlänge Dance', city: 'Borlänge' }, // 12 ev i juli, 6 synliga
    { slug: 'Victoriateatern', name: 'Victoriateatern Malmö' }, // 11 ev i juli, 8 synliga
    { slug: 'vallentunadans', name: 'Vallentuna Dans' }, // 11 ev i juli, 8 synliga
    { slug: 'ulrikabeijeryoga', name: 'UB Yoga, Sång & Ceremoni', city: 'Hudiksvall' }, // 11 ev i juli, 5 synliga
    { slug: 'lena.lingensjo', name: 'Söndsvalls damer �', city: 'Sundsvall' }, // 11 ev i juli, 5 synliga
    { slug: 'Esso36', name: 'SO36' }, // 11 ev i juli, 8 synliga
    { slug: 'sodertaljestadsscen', name: 'Södertälje stadsscen' }, // 11 ev i juli, 8 synliga
    { slug: 'Midsommargarden', name: 'Midsommargården' }, // 11 ev i juli, 8 synliga
    { slug: 'mejeriet', name: 'Mejeriet', city: 'Lund' }, // 11 ev i juli, 8 synliga
    { slug: 'Kulturenshus', name: 'Kulturens hus Luleå' }, // 11 ev i juli, 8 synliga
    { slug: 'kristinehamnsbibliotek', name: 'Kristinehamns bibliotek', city: 'Kristinehamn' }, // 11 ev i juli, 6 synliga
    { slug: 'Hedenstedbibliotekerne', name: 'Hedensted Bibliotekerne' }, // 11 ev i juli, 8 synliga
    { slug: 'HarrysStenungsund', name: 'Harrys' }, // 11 ev i juli, 5 synliga
    { slug: 'gemenskapikungsor', name: 'Gemenskap i Kungsör' }, // 11 ev i juli, 8 synliga
    { slug: 'bibliotekenilaholm', name: 'Biblioteken i Laholm', city: 'Laholm' }, // 11 ev i juli, 7 synliga
    { slug: 'eksjobibliotek', name: 'Eksjö stadsbibliotek' }, // 11 ev i juli, 7 synliga
    { slug: 'bjuvsbibliotek', name: 'Bjuvs bibliotek' }, // 11 ev i juli, 7 synliga
    { slug: 'alltpascen', name: 'Allt På Scen & Mycke Nöje', city: 'Linköping' }, // 11 ev i juli, 8 synliga
    { slug: 'ABFsodertorn', name: 'ABF Södertörn' }, // 11 ev i juli, 8 synliga
    { slug: 'varlokal', name: 'Vår lokal' }, // 10 ev i juli, 8 synliga
    { slug: 'svorebrolan', name: 'Studieförbundet Vuxenskolan Örebro Län', city: 'Nora' }, // 10 ev i juli, 8 synliga
    { slug: 'malmostadsbibliotek', name: 'Stadsbiblioteket i Malmö' }, // 10 ev i juli, 8 synliga
    { slug: 'Smalands', name: 'Smålands Nation', city: 'Lund' }, // 10 ev i juli, 3 synliga
    { slug: 'shrekraveofficial', name: 'Shrek Rave' }, // 10 ev i juli, 8 synliga
    { slug: 'linkopingairswing', name: 'Linköping Air Swing', city: 'Linköping' }, // 10 ev i juli, 8 synliga
    { slug: 'lantmannenmaskinochlantbruk', name: 'Lantmännen Maskin och Lantmännen Lantbruk', city: 'Kristianstad' }, // 10 ev i juli, 8 synliga
    { slug: 'kramforsbibliotek', name: 'Kramfors bibliotek' }, // 10 ev i juli, 4 synliga
    { slug: 'SwinginHepTown', name: 'HepTown', city: 'Lund' }, // 10 ev i juli, 8 synliga
    { slug: 'Gardenoffeathers', name: 'Garden of Feathers', city: 'Staffanstorp' }, // 10 ev i juli, 8 synliga
    { slug: 'freemoveyogastudio.nu', name: 'Freemove Yogastudio' }, // 10 ev i juli, 8 synliga
    { slug: 'bibliotekeniboras', name: 'Biblioteken i Borås', city: 'Borås' }, // 10 ev i juli, 8 synliga
    { slug: 'arvikabibliotek', name: 'Arvika Bibliotek', city: 'Arvika' }, // 10 ev i juli, 7 synliga
    { slug: 'orebrobibliotek', name: 'Örebro bibliotek' }, // 9 ev i juli, 8 synliga
    { slug: 'karlecafe', name: 'karl-e' }, // 9 ev i juli, 5 synliga
    { slug: 'YogaHusetFalun', name: 'Yogahuset Falun', city: 'Falun' }, // 9 ev i juli, 8 synliga
    { slug: 'ystadsbibliotek', name: 'Ystads bibliotek', city: 'Ystad' }, // 9 ev i juli, 8 synliga
    { slug: 'vasterasbibliotek', name: 'Västerås bibliotek', city: 'Västerås' }, // 9 ev i juli, 6 synliga
    { slug: 'bibliotekoupplevelser', name: 'Vingåkers bibliotek' }, // 9 ev i juli, 6 synliga
    { slug: 'UpplevSkovde', name: 'Upplev Skövde', city: 'Skövde' }, // 9 ev i juli, 3 synliga
    { slug: 'gunnesgard', name: 'Vikingagården Gunnes gård' }, // 9 ev i juli, 6 synliga
    { slug: 'Uddevallakassetten', name: 'Uddevallakassetten', city: 'Uddevalla' }, // 9 ev i juli, 8 synliga
    { slug: 'tangovarberg', name: 'Tango Varberg', city: 'Varberg' }, // 9 ev i juli, 3 synliga
    { slug: 'svkalmarlan', name: 'Studieförbundet Vuxenskolan Kalmar län', city: 'Nybro' }, // 9 ev i juli, 8 synliga
    { slug: 'Storlihytta', name: 'Storlihytta' }, // 9 ev i juli, 8 synliga
    { slug: 'rimboprastgard', name: 'Rimbo Prästgård' }, // 9 ev i juli, 7 synliga
    { slug: 'naturskyddsforeningen.vanersborg', name: 'Naturskyddsföreningen Vänersborg' }, // 9 ev i juli, 6 synliga
    { slug: 'krallentertainment', name: 'Krall Entertainment', city: 'Uppsala' }, // 9 ev i juli, 8 synliga
    { slug: 'inrenatur', name: 'Inre natur' }, // 9 ev i juli, 6 synliga
    { slug: 'hyltebiblioteken', name: 'Hyltebiblioteken' }, // 9 ev i juli, 7 synliga
    { slug: 'hjartatshus', name: 'Hjärtats hus', city: 'Jönköping' }, // 9 ev i juli, 6 synliga
    { slug: 'BibliotekeniKalmarkommun', name: 'Biblioteken i Kalmar kommun', city: 'Kalmar' }, // 9 ev i juli, 8 synliga
    { slug: 'ArrangemangLund', name: 'Arrangemang Lund', city: 'Lund' }, // 9 ev i juli, 6 synliga
    { slug: 'almhultsbibliotek', name: 'Älmhults bibliotek' }, // 8 ev i juli, 6 synliga
    { slug: 'WermlandOpera', name: 'Wermland Opera', city: 'Karlstad' }, // 8 ev i juli, 6 synliga
    { slug: 'varldskulturmuseet', name: 'Världskulturmuseet' }, // 8 ev i juli, 7 synliga
    { slug: 'varbergsolhall', name: 'Varbergs Ölhall', city: 'Varberg' }, // 8 ev i juli, 6 synliga
    { slug: 'vrakdykarpensionatet', name: 'Vrakdykarpensionatet' }, // 8 ev i juli, 8 synliga
    { slug: 'TillsammansHoor', name: 'Tillsammans Höör' }, // 8 ev i juli, 2 synliga
    { slug: 'tobbetrollkarl', name: 'Tobbe Trollkarl', city: 'Borlänge' }, // 8 ev i juli, 8 synliga
    { slug: 'tibrobibliotek', name: 'Tibro bibliotek' }, // 8 ev i juli, 5 synliga
    { slug: 'TheTivoli', name: 'The Tivoli', city: 'Helsingborg' }, // 8 ev i juli, 8 synliga
    { slug: 'slagelsebib', name: 'Slagelse Bibliotekerne' }, // 8 ev i juli, 8 synliga
    { slug: 'skogsvargarna', name: 'OK Skogsvargarna', city: 'Lidköping' }, // 8 ev i juli, 4 synliga
    { slug: 'oxiebiblioteket', name: 'Oxiebiblioteket' }, // 8 ev i juli, 7 synliga
    { slug: 'norskamatorteaterforbund', name: 'Norsk Amatørteaterforbund' }, // 8 ev i juli, 8 synliga
    { slug: 'natminkulturhus', name: 'Nationella minoriteters kulturhus' }, // 8 ev i juli, 6 synliga
    { slug: 'malmocityskaters', name: 'Malmö City Skaters', city: 'Lund' }, // 8 ev i juli, 3 synliga
    { slug: 'nfacademy', name: 'NF Academy' }, // 8 ev i juli, 8 synliga
    { slug: 'mjolbykommun', name: 'Mjölby kommun', city: 'Mjölby' }, // 8 ev i juli, 4 synliga
    { slug: 'norrkoping.symphony', name: 'Louis De Geer-hallen Norrköping', city: 'Norrköping' }, // 8 ev i juli, 8 synliga
    { slug: 'lommafolketshus', name: 'Lomma Folkets Hus' }, // 8 ev i juli, 4 synliga
    { slug: 'lisebergab', name: 'Liseberg' }, // 8 ev i juli, 2 synliga
    { slug: 'konstmuseet', name: 'Konstmuseet', city: 'Skövde' }, // 8 ev i juli, 6 synliga
    { slug: 'KappaBarMalmo', name: 'Kappa Bar Malmö' }, // 8 ev i juli, 3 synliga
    { slug: 'jkpglm', name: 'Jönköpings läns museum', city: 'Jönköping' }, // 8 ev i juli, 2 synliga
    { slug: 'gospelgiz', name: 'Joy Singers', city: 'Ljungby' }, // 8 ev i juli, 8 synliga
    { slug: 'eastvillecomedy', name: 'Event Vesta - KC' }, // 8 ev i juli, 1 synliga
    { slug: 'dismitt', name: 'Dis-Mitt', city: 'Gävle' }, // 8 ev i juli, 1 synliga
    { slug: 'CooperativaCovibar', name: 'Covibar' }, // 8 ev i juli, 4 synliga
    { slug: 'Askelabben', name: 'Askelabben Hundesenter' }, // 8 ev i juli, 4 synliga
    { slug: 'borjessonsbil', name: 'Börjessons Bil', city: 'Karlskrona' }, // 8 ev i juli, 8 synliga
    { slug: 'arbisnkpg', name: 'Arbis' }, // 8 ev i juli, 8 synliga
    { slug: 'absaloncph', name: 'Absalon' }, // 8 ev i juli, 8 synliga
    { slug: 'aabendans', name: 'Aaben Dans' }, // 8 ev i juli, 4 synliga
    { slug: 'ostgotamusiken', name: 'Östgötamusiken', city: 'Linköping' }, // 7 ev i juli, 8 synliga
    { slug: 'angebibliotek', name: 'Ånge centralbibliotek' }, // 7 ev i juli, 7 synliga
    { slug: 'vadstenabibliotek', name: 'Vadstena bibliotek' }, // 7 ev i juli, 4 synliga
    { slug: 'YogaZonBorgholm', name: 'YogaZon' }, // 7 ev i juli, 1 synliga
    { slug: 'steamhotel', name: 'The Steam Hotel', city: 'Västerås' }, // 7 ev i juli, 5 synliga
    { slug: 'UppsalaBudoklubb', name: 'Uppsala Budoklubb', city: 'Uppsala' }, // 7 ev i juli, 6 synliga
    { slug: 'Studieframjandetjamtlandharjedalen', name: 'Studiefrämjandet Jämtland/Härjedalen' }, // 7 ev i juli, 5 synliga
    { slug: 'solvesborgcsk', name: 'Stortorget Sölvesborg', city: 'Sölvesborg' }, // 7 ev i juli, 3 synliga
    { slug: 'smalandsuppsala', name: 'Smålands nation', city: 'Uppsala' }, // 7 ev i juli, 5 synliga
    { slug: 'silvenska', name: 'Silvénska villan' }, // 7 ev i juli, 2 synliga
    { slug: 'paula.gocko', name: 'Paula Gocko', city: 'Eskilstuna' }, // 7 ev i juli, 2 synliga
    { slug: 'medeltidsmuseet', name: 'Medeltidsmuseet', city: 'Stockholm' }, // 7 ev i juli, 4 synliga
    { slug: 'malmomuseum', name: 'Malmö museum', city: 'Malmö' }, // 7 ev i juli, 7 synliga
    { slug: 'KSHHealing', name: 'KSH Healing', city: 'Kalmar' }, // 7 ev i juli, 1 synliga
    { slug: 'karlskronabibliotek', name: 'Karlskrona Stadsbibliotek', city: 'Karlskrona' }, // 7 ev i juli, 8 synliga
    { slug: 'JyskRejsebureau', name: 'Jysk Rejsebureau' }, // 7 ev i juli, 3 synliga
    { slug: 'jagvagarstuffa', name: 'Jag vågar stuffa', city: 'Karlshamn' }, // 7 ev i juli, 8 synliga
    { slug: 'inger.ericson.7', name: 'Inger Ericson', city: 'Stockholm' }, // 7 ev i juli, 5 synliga
    { slug: 'gallivarekultur', name: 'Gällivare Kultur', city: 'Gällivare' }, // 7 ev i juli, 3 synliga
    { slug: 'DanshusetDkBuggie', name: 'Dansklubben Buggie i Ulricehamn' }, // 7 ev i juli, 4 synliga
    { slug: 'Dansalliansen', name: 'Dansalliansen' }, // 7 ev i juli, 6 synliga
    { slug: 'dansinordnya', name: 'Dans i Nord nya', city: 'Gällivare' }, // 7 ev i juli, 8 synliga
    { slug: 'brasserietboras', name: 'Brasseriet', city: 'Borås' }, // 7 ev i juli, 4 synliga
    { slug: 'ungdomsgardentimra', name: 'Aktivitetshuset Pangea' }, // 7 ev i juli, 4 synliga
    { slug: 'orebro.salsafriends.9', name: 'Örebro Salsafriends' }, // 6 ev i juli, 5 synliga
    { slug: 'ObackaJazz', name: 'Öbacka Jazz&Blues Härnösand', city: 'Härnösand' }, // 6 ev i juli, 8 synliga
    { slug: 'almhultsif', name: 'Älmhults IF' }, // 6 ev i juli, 8 synliga
    { slug: 'naturumSkrylle', name: 'naturum Skrylle' }, // 6 ev i juli, 1 synliga
    { slug: 'StreetRollerHockeyLeague', name: 'https://www.facebook.com/share/g/', city: 'Eslöv' }, // 6 ev i juli, 1 synliga
    { slug: 'yoganatur.se', name: 'YogaNatur' }, // 6 ev i juli, 8 synliga
    { slug: 'meraloppis', name: 'Ulf Andersson' }, // 6 ev i juli, 3 synliga
    { slug: 'tunapark.se', name: 'Tuna Park', city: 'Eskilstuna' }, // 6 ev i juli, 3 synliga
    { slug: 'ThePulsebar2023', name: 'The Pulse' }, // 6 ev i juli, 4 synliga
    { slug: 'tangojamt', name: 'TangoJamt' }, // 6 ev i juli, 1 synliga
    { slug: 'stadshallen', name: 'Stadshallen', city: 'Lund' }, // 6 ev i juli, 6 synliga
    { slug: 'spokguiden', name: 'Spökguiden' }, // 6 ev i juli, 3 synliga
    { slug: 'Sjoangen', name: 'Sjöängen i Askersund' }, // 6 ev i juli, 5 synliga
    { slug: 'sigtunastiftelsen', name: 'Sigtunastiftelsen' }, // 6 ev i juli, 6 synliga
    { slug: 'regionmuseetskane', name: 'Regionmuseet Skåne', city: 'Kristianstad' }, // 6 ev i juli, 3 synliga
    { slug: 'naringslivsoderhamn', name: 'Näringsliv Söderhamns kommun', city: 'Söderhamn' }, // 6 ev i juli, 2 synliga
    { slug: 'norrvikenbastad', name: 'Norrviken' }, // 6 ev i juli, 2 synliga
    { slug: '1mr.langos', name: 'Mr.Lángos', city: 'Uppsala' }, // 6 ev i juli, 2 synliga
    { slug: 'malmolive', name: 'Malmö Live' }, // 6 ev i juli, 6 synliga
    { slug: 'Lakarmissionen', name: 'Läkarmissionen' }, // 6 ev i juli, 3 synliga
    { slug: 'LandskronaBK', name: 'Landskrona Brukshundklubb', city: 'Landskrona' }, // 6 ev i juli, 1 synliga
    { slug: 'Kungalvsparken', name: 'Kungälvs Parken', city: 'Trollhättan' }, // 6 ev i juli, 8 synliga
    { slug: 'Ifoodfestival', name: 'International Food Festival', city: 'Göteborg' }, // 6 ev i juli, 3 synliga
    { slug: 'HotellHulingen', name: 'Hotell Hulingen' }, // 6 ev i juli, 8 synliga
    { slug: 'hcamarathon', name: 'HCA Marathon' }, // 6 ev i juli, 6 synliga
    { slug: 'estrad.norr', name: 'Estrad Norr' }, // 6 ev i juli, 7 synliga
    { slug: 'Discaid', name: 'Discaid', city: 'Borlänge' }, // 6 ev i juli, 6 synliga
    { slug: 'dansofolkton', name: 'Dans & Folkton' }, // 6 ev i juli, 8 synliga
    { slug: 'BorasDansforening', name: 'Borås Dansförening', city: 'Borås' }, // 6 ev i juli, 5 synliga
    { slug: 'Blojupproret', name: 'Blöjupproret, Sveriges förening för EC och tygblöjor', city: 'Lund' }, // 6 ev i juli, 8 synliga
    { slug: 'avensbylapland', name: 'Avens by Nature / Västerås Reiki Center', city: 'Västerås' }, // 6 ev i juli, 4 synliga
    { slug: 'anebybibliotek', name: 'Aneby bibliotek' }, // 6 ev i juli, 5 synliga
    { slug: 'amplifiedvast', name: 'Amplified Väst', city: 'Borås' }, // 6 ev i juli, 5 synliga
    { slug: 'atobeyondparkour', name: 'A-Beyond Parkour' }, // 6 ev i juli, 8 synliga
    { slug: 'willhemab', name: 'Willhem AB', city: 'Göteborg' }, // 5 ev i juli, 8 synliga
    { slug: 'teaterhalland', name: 'Teater Halland', city: 'Varberg' }, // 5 ev i juli, 3 synliga
    { slug: 'riksteaternhultsfred', name: 'Valhall Hultsfred' }, // 5 ev i juli, 1 synliga
    { slug: 'TeaterDictat', name: 'Teater Dictat' }, // 5 ev i juli, 2 synliga
    { slug: 'swingum400', name: 'Swingum' }, // 5 ev i juli, 5 synliga
    { slug: 'Transportnorrbotten', name: 'Svenska Transportarbetareförbundet Avdelning 26', city: 'Kiruna' }, // 5 ev i juli, 8 synliga
    { slug: 'swinginmotionab', name: 'Swing in motion', city: 'Borås' }, // 5 ev i juli, 7 synliga
    { slug: 'Sundsvallsmuseum', name: 'Sundsvalls museum', city: 'Sundsvall' }, // 5 ev i juli, 4 synliga
    { slug: 'reisdegkomikerklubb', name: 'Reis Deg Komikerklubb' }, // 5 ev i juli, 3 synliga
    { slug: 'rfsisuvn', name: 'RF - SISU Västernorrland', city: 'Härnösand' }, // 5 ev i juli, 3 synliga
    { slug: 'quiztyreso', name: 'QUIZ - Tyresö' }, // 5 ev i juli, 1 synliga
    { slug: 'nordicsociety.org', name: 'Nordic society', city: 'Stockholm' }, // 5 ev i juli, 3 synliga
    { slug: 'nbvost', name: 'NBV Öst', city: 'Nyköping' }, // 5 ev i juli, 3 synliga
    { slug: 'Mordmysterium', name: 'Mordmysterium' }, // 5 ev i juli, 6 synliga
    { slug: 'monica.karlsson.399', name: 'Motala biologiska förening', city: 'Motala' }, // 5 ev i juli, 1 synliga
    { slug: 'mats.fuchs.9', name: 'Mats Fuchs' }, // 5 ev i juli, 1 synliga
    { slug: 'landskronasurfcenter', name: 'Landskrona SurfCenter', city: 'Landskrona' }, // 5 ev i juli, 2 synliga
    { slug: 'mittlandplus', name: 'Kultur i Ånge Kommun' }, // 5 ev i juli, 3 synliga
    { slug: 'kristianstadskommun', name: 'Kristianstads kommun', city: 'Kristianstad' }, // 5 ev i juli, 2 synliga
    { slug: 'kollektivetlivetbar', name: 'Kollektivet Livet' }, // 5 ev i juli, 8 synliga
    { slug: 'borgmastarvilla', name: 'Hotell Humbla', city: 'Sölvesborg' }, // 5 ev i juli, 2 synliga
    { slug: 'gellerasenkarlskoga', name: 'Gelleråsen, Karlskoga' }, // 5 ev i juli, 4 synliga
    { slug: 'FylgjaHelandeHarmoni', name: 'Fylgja - helande harmoni', city: 'Sundsvall' }, // 5 ev i juli, 5 synliga
    { slug: 'ericbergstroom', name: 'Eric Bergström', city: 'Jönköping' }, // 5 ev i juli, 3 synliga
    { slug: 'Faluguide', name: 'Faluguide', city: 'Falun' }, // 5 ev i juli, 8 synliga
    { slug: 'WheelsOfCarlshamn', name: 'Cykelklubben Wheels Of Carlshamn', city: 'Karlshamn' }, // 5 ev i juli, 1 synliga
    { slug: 'clarionsundsvall', name: 'Clarion Hotel Sundsvall', city: 'Sundsvall' }, // 5 ev i juli, 2 synliga
    { slug: 'CirkusStavanger', name: 'CIRKUS' }, // 5 ev i juli, 6 synliga
    { slug: 'bergsakers', name: 'Bergsåker', city: 'Sundsvall' }, // 5 ev i juli, 2 synliga
    { slug: 'arttourssthlm', name: 'Art Tours Sthlm', city: 'Stockholm' }, // 5 ev i juli, 4 synliga
    { slug: 'arenahagmyren', name: 'Arena Hagmyren', city: 'Hudiksvall' }, // 5 ev i juli, 6 synliga
    { slug: 'alltidtjorn', name: 'Alltid Tjörn' }, // 5 ev i juli, 3 synliga
    { slug: 'AlingsasDansklubb', name: 'Alingsås Dansklubb', city: 'Alingsås' }, // 5 ev i juli, 4 synliga
    { slug: 'ABFKiruna', name: 'ABF Norr Kiruna', city: 'Kiruna' }, // 5 ev i juli, 8 synliga
    { slug: 'vaxjokommun', name: 'Växjö kommun' }, // 4 ev i juli, 3 synliga
    { slug: 'varnamocity', name: 'Värnamo City' }, // 4 ev i juli, 4 synliga
    { slug: 'oviklatinodans', name: 'Övik Latinodans' }, // 4 ev i juli, 4 synliga
    { slug: 'villalidkopingbk', name: 'Villa Lidköping BK', city: 'Lidköping' }, // 4 ev i juli, 8 synliga
    { slug: 'Upplandsmuseet', name: 'Upplandsmuseet', city: 'Uppsala' }, // 4 ev i juli, 8 synliga
    { slug: 'TyresoRoyalCrowns', name: 'Tyresö Royal Crowns' }, // 4 ev i juli, 8 synliga
    { slug: 'torsebrosvamp', name: 'Torsebro Svamp', city: 'Kristianstad' }, // 4 ev i juli, 8 synliga
    { slug: 'svartebyalag', name: 'Svarte' }, // 4 ev i juli, 1 synliga
    { slug: 'SoulRelax.Motala', name: 'SoulRelax', city: 'Motala' }, // 4 ev i juli, 3 synliga
    { slug: 'skovdeaik', name: 'Skövde AIK', city: 'Skövde' }, // 4 ev i juli, 8 synliga
    { slug: 'SsdkKarlshamn', name: 'SSDK Karlshamn', city: 'Karlshamn' }, // 4 ev i juli, 2 synliga
    { slug: 'miguel.delgado.3998', name: 'SALSA i VARBERG', city: 'Varberg' }, // 4 ev i juli, 2 synliga
    { slug: 'nordboetnorrkoping', name: 'Nördboet', city: 'Norrköping' }, // 4 ev i juli, 8 synliga
    { slug: 'naturumblekinge', name: 'Naturum Blekinge', city: 'Ronneby' }, // 4 ev i juli, 2 synliga
    { slug: 'NorrlandTulpaner', name: 'Norrlands Tulpan Trädgård', city: 'Hudiksvall' }, // 4 ev i juli, 6 synliga
    { slug: 'mastersgalleri', name: 'Mästers Galleri - SKHF Skurupsbygdens konst- och hantverksförening' }, // 4 ev i juli, 8 synliga
    { slug: 'Molekylverkstan', name: 'Molekylverkstan' }, // 4 ev i juli, 4 synliga
    { slug: 'bodyandsoulmovement', name: 'Maria Slättorp - Body & Soul Movement' }, // 4 ev i juli, 5 synliga
    { slug: 'LottasOmtanke', name: 'Lottas Omtanke', city: 'Oskarshamn' }, // 4 ev i juli, 2 synliga
    { slug: 'KBASQUARE', name: 'Kungsbacka Square Dancers', city: 'Kungsbacka' }, // 4 ev i juli, 2 synliga
    { slug: 'kristnaregnbagsrorelsen', name: 'Kristna regnbågsrörelsen - Riksförbundet EKHO', city: 'Göteborg' }, // 4 ev i juli, 5 synliga
    { slug: 'klostretiystad', name: 'Klostret i Ystad', city: 'Ystad' }, // 4 ev i juli, 6 synliga
    { slug: 'klingsbergsforlagab', name: 'Klingsbergs Förlag AB', city: 'Norrköping' }, // 4 ev i juli, 4 synliga
    { slug: 'Marknadsplatskarlskoga', name: 'Karlskoga, Örebro län' }, // 4 ev i juli, 1 synliga
    { slug: 'IFKKristianstad', name: 'IFK Kristianstad', city: 'Kristianstad' }, // 4 ev i juli, 1 synliga
    { slug: 'michael.haggmark.1', name: 'JLS Jämtlands Lokalhistoriker och Släktforskare' }, // 4 ev i juli, 3 synliga
    { slug: 'HotellHavanna', name: 'Hotell Havanna', city: 'Varberg' }, // 4 ev i juli, 3 synliga
    { slug: 'Huddingekommun', name: 'Huddinge kommun' }, // 4 ev i juli, 8 synliga
    { slug: 'huddingeparkrun', name: 'Huddinge Parkrun' }, // 4 ev i juli, 8 synliga
    { slug: 'gretasgothenburg', name: 'Gretas Göteborg', city: 'Göteborg' }, // 4 ev i juli, 2 synliga
    { slug: 'Gummifabriken', name: 'Gummifabriken i Värnamo' }, // 4 ev i juli, 8 synliga
    { slug: 'GrastorpsBygdegardsforening', name: 'Grästorps Bygdegårdsförening' }, // 4 ev i juli, 6 synliga
    { slug: 'gnestakommun', name: 'Gnesta kommun', city: 'Strängnäs' }, // 4 ev i juli, 2 synliga
    { slug: 'gamlahalmstad', name: 'Gamla Halmstad', city: 'Halmstad' }, // 4 ev i juli, 3 synliga
    { slug: 'FriskaViljorFC', name: 'Friska Viljor FC' }, // 4 ev i juli, 8 synliga
    { slug: 'foreningensm', name: 'Föreningen Söderhamns Museum', city: 'Söderhamn' }, // 4 ev i juli, 1 synliga
    { slug: 'FrokenLarssonHandelsbod', name: 'Fröken Larsson Vintage, Antikt & Secondhand' }, // 4 ev i juli, 1 synliga
    { slug: 'frirumsandviken', name: 'Frirum Sandviken', city: 'Sandviken' }, // 4 ev i juli, 2 synliga
    { slug: 'doroteabibliotek', name: 'Dorotea bibliotek / Kraapohken gærjagåetie' }, // 4 ev i juli, 8 synliga
    { slug: 'cirkusmuseet', name: 'Cirkusmuseet' }, // 4 ev i juli, 2 synliga
    { slug: 'cafehelaideella', name: 'Café HELA ideella Landskrona', city: 'Landskrona' }, // 4 ev i juli, 1 synliga
    { slug: 'centrumhusbiografen', name: 'Centrumhusbiografen' }, // 4 ev i juli, 8 synliga
    { slug: 'boulognerskogenparkrun', name: 'Boulognerskogen parkrun, Gävle', city: 'Gävle' }, // 4 ev i juli, 6 synliga
    { slug: 'MuseetBollnasKonsthall', name: 'Bollnäs Museum & Konsthall' }, // 4 ev i juli, 2 synliga
    { slug: 'bradspelskafeet', name: 'Brädspelskaféet', city: 'Karlshamn' }, // 4 ev i juli, 5 synliga
    { slug: 'arbogabio', name: 'Arboga bio' }, // 4 ev i juli, 8 synliga
    { slug: 'AlingsasHK', name: 'Alingsås HK', city: 'Alingsås' }, // 4 ev i juli, 1 synliga
    { slug: 'boca.vasteras', name: 'Boca Västerås', city: 'Västerås' }, // 4 ev i juli, 2 synliga
    { slug: 'abfmalmo', name: 'ABF Malmö' }, // 4 ev i juli, 8 synliga
    { slug: 'alvsbyn', name: 'Älvsbyn' }, // 3 ev i juli, 8 synliga
    { slug: 'folkanteater', name: 'Örnsköldsviks Riksteaterförening' }, // 3 ev i juli, 8 synliga
    { slug: 'yogaheart.nu', name: 'Yogaheart' }, // 3 ev i juli, 2 synliga
    { slug: 'welcomehubhaugalandet', name: 'Welcome Hub Haugalandet' }, // 3 ev i juli, 2 synliga
    { slug: 'vaxjoloparklubb', name: 'Växjö Löparklubb' }, // 3 ev i juli, 1 synliga
    { slug: 'VisbyRoma', name: 'Visby Roma Hockey', city: 'Visby' }, // 3 ev i juli, 3 synliga
    { slug: 'vindeln', name: 'Vindelns Kommun' }, // 3 ev i juli, 6 synliga
    { slug: 'herrestadsaiffotbollherr', name: 'Undavallen' }, // 3 ev i juli, 8 synliga
    { slug: 'umepride', name: 'Umepride' }, // 3 ev i juli, 8 synliga
    { slug: 'Bonanderfriskvard', name: 'Uddevalla, Västra Götalands län', city: 'Uddevalla' }, // 3 ev i juli, 5 synliga
    { slug: 'trailtourumea', name: 'Umeå Trail' }, // 3 ev i juli, 8 synliga
    { slug: 'dalarodyksallskap', name: 'Torvalla sporthall' }, // 3 ev i juli, 6 synliga
    { slug: 'TornsIF', name: 'Torns IF', city: 'Lund' }, // 3 ev i juli, 8 synliga
    { slug: 'tingsrydsbibliotekochkultur', name: 'Tingsryds bibliotek och kultur' }, // 3 ev i juli, 5 synliga
    { slug: 'naasdk', name: 'Tingshuset Lerum' }, // 3 ev i juli, 2 synliga
    { slug: 'Thimouryoga', name: 'Thimour Yoga', city: 'Borås' }, // 3 ev i juli, 2 synliga
    { slug: 'stalebo.ridklubb.official', name: 'Stålebo Ridklubb' }, // 3 ev i juli, 1 synliga
    { slug: 'studiomalinfredrika', name: 'Studio Malin Fredrika', city: 'Kristinehamn' }, // 3 ev i juli, 3 synliga
    { slug: 'SVGoteborg', name: 'Studieförbundet Vuxenskolan Göteborg', city: 'Göteborg' }, // 3 ev i juli, 8 synliga
    { slug: 'svgavleborg', name: 'Studieförbundet Vuxenskolan Gävleborg', city: 'Gävle' }, // 3 ev i juli, 8 synliga
    { slug: 'Studieforbundetbildanord', name: 'Studieförbundet Bilda Nord' }, // 3 ev i juli, 7 synliga
    { slug: 'streetfoodskandinavia', name: 'Street Food Skandinavia' }, // 3 ev i juli, 3 synliga
    { slug: 'stenhusetgille', name: 'Stenhuset' }, // 3 ev i juli, 1 synliga
    { slug: 'SpangaHockey', name: 'Spånga Hockey' }, // 3 ev i juli, 1 synliga
    { slug: 'svkalingsas', name: 'Stora Torget Alingsås', city: 'Alingsås' }, // 3 ev i juli, 8 synliga
    { slug: 'spiritofmansweden', name: 'Spirit of Man' }, // 3 ev i juli, 1 synliga
    { slug: 'sommarparadisetsandviken', name: 'Sommarparadiset Sandviken', city: 'Sandviken' }, // 3 ev i juli, 8 synliga
    { slug: 'hedemorafolketspark', name: 'Sommar-Bingo Hedemora Folkets Park 2026' }, // 3 ev i juli, 8 synliga
    { slug: 'SkolsimmarnaIK', name: 'Skolsimmarna IK' }, // 3 ev i juli, 3 synliga
    { slug: 'lindasolacer', name: 'Solacer' }, // 3 ev i juli, 1 synliga
    { slug: 'biblioteketsimrishamn', name: 'Simrishamns bibliotek', city: 'Simrishamn' }, // 3 ev i juli, 7 synliga
    { slug: 'seniortraffen', name: 'Seniorträffen, Oxelösund' }, // 3 ev i juli, 5 synliga
    { slug: 'SanktJohanneskyrka', name: 'Sankt Johannes kyrka, Malmö' }, // 3 ev i juli, 3 synliga
    { slug: 'SalemStavanger', name: 'Salem Stavanger' }, // 3 ev i juli, 1 synliga
    { slug: 'Salemcover', name: 'Salem 2.0' }, // 3 ev i juli, 8 synliga
    { slug: 'satssverige', name: 'SATS Sverige', city: 'Helsingborg' }, // 3 ev i juli, 4 synliga
    { slug: 'rfsisu.norrbotten', name: 'RF' }, // 3 ev i juli, 1 synliga
    { slug: 'pinkprogramming', name: 'Pink Programming', city: 'Stockholm' }, // 3 ev i juli, 8 synliga
    { slug: 'pifdam', name: 'PIF Damfotboll' }, // 3 ev i juli, 8 synliga
    { slug: 'kavlingeoldtimespub', name: 'Old Times Pub' }, // 3 ev i juli, 5 synliga
    { slug: 'nygatan6', name: 'Nygatan 6' }, // 3 ev i juli, 8 synliga
    { slug: 'northcreativenodes', name: 'North Creative Nodes', city: 'Boden' }, // 3 ev i juli, 7 synliga
    { slug: 'obosisverige', name: 'OBOS i Sverige' }, // 3 ev i juli, 1 synliga
    { slug: 'NiklasStromstedtMusic', name: 'Niklas Strömstedt', city: 'Gävle' }, // 3 ev i juli, 8 synliga
    { slug: 'Musikhuset', name: 'Musikhuset Gävle', city: 'Gävle' }, // 3 ev i juli, 8 synliga
    { slug: 'nkvillan.nyk', name: 'NK-villan', city: 'Nyköping' }, // 3 ev i juli, 1 synliga
    { slug: 'musikilerum', name: 'Musik i Lerum' }, // 3 ev i juli, 3 synliga
    { slug: 'MotalaBasket', name: 'Motala Basket - W72', city: 'Motala' }, // 3 ev i juli, 2 synliga
    { slug: 'lundsallhelgonakyrka', name: 'Lunds Allhelgonakyrka' }, // 3 ev i juli, 3 synliga
    { slug: 'liverestaurangen', name: 'Luleå Energi Arena' }, // 3 ev i juli, 1 synliga
    { slug: 'LiveAlmhult', name: 'Live Älmhult' }, // 3 ev i juli, 5 synliga
    { slug: 'livironu', name: 'Liv-i-ro', city: 'Katrineholm' }, // 3 ev i juli, 2 synliga
    { slug: 'lidingostadnaringsliv', name: 'Lidingö stad näringsliv' }, // 3 ev i juli, 1 synliga
    { slug: 'lidingostad', name: 'Lidingö stad' }, // 3 ev i juli, 8 synliga
    { slug: 'Landskronastad', name: 'Landskrona stad', city: 'Landskrona' }, // 3 ev i juli, 2 synliga
    { slug: 'laila.amrouche', name: 'Laila Amrouche', city: 'Uddevalla' }, // 3 ev i juli, 4 synliga
    { slug: 'LandskronaFoto', name: 'Landskrona Foto', city: 'Landskrona' }, // 3 ev i juli, 8 synliga
    { slug: 'liveatheart', name: 'LIVE AT HEART' }, // 3 ev i juli, 1 synliga
    { slug: 'kulturitranemo', name: 'Kultur i Tranemo' }, // 3 ev i juli, 8 synliga
    { slug: 'kalix.bibliotek', name: 'Kalix Bibliotek' }, // 3 ev i juli, 2 synliga
    { slug: 'icfalkenberg', name: 'IC Falkenberg', city: 'Falkenberg' }, // 3 ev i juli, 6 synliga
    { slug: 'hets.nu', name: 'Hässleholm Centralstation', city: 'Hässleholm' }, // 3 ev i juli, 8 synliga
    { slug: 'ginanykvist', name: 'Hojkompisar Stockholm med omnejd', city: 'Stockholm' }, // 3 ev i juli, 1 synliga
    { slug: 'kraniosakralterapihastochmanniska', name: 'Göteborg', city: 'Göteborg' }, // 3 ev i juli, 8 synliga
    { slug: 'guppyentertainmentab', name: 'Guppy Entertainment', city: 'Falun' }, // 3 ev i juli, 8 synliga
    { slug: 'gronalundstivoli', name: 'Gröna Lund', city: 'Stockholm' }, // 3 ev i juli, 2 synliga
    { slug: 'frimisorebro', name: 'Frimis' }, // 3 ev i juli, 7 synliga
    { slug: 'folkuniversitetetvisby', name: 'Folkuniversitetet Visby', city: 'Visby' }, // 3 ev i juli, 8 synliga
    { slug: 'fhsater', name: 'Folkets Hus Säter' }, // 3 ev i juli, 6 synliga
    { slug: 'fjarasaik', name: 'Fjärås AIK, FAIK' }, // 3 ev i juli, 8 synliga
    { slug: 'fagerstascouterna', name: 'Fagersta Scoutkår' }, // 3 ev i juli, 1 synliga
    { slug: 'ekobutikosterlen', name: 'Fairys & Friends Ekohandel' }, // 3 ev i juli, 2 synliga
    { slug: 'FKPscorpiosweden', name: 'FKP Scorpio Sverige' }, // 3 ev i juli, 8 synliga
    { slug: 'energiheaxorna', name: 'Energihäxorna' }, // 3 ev i juli, 3 synliga
    { slug: 'dragonflystudioavesta', name: 'Dragonfly Studio' }, // 3 ev i juli, 2 synliga
    { slug: 'charlottepolsonkonsert', name: 'Charlotte Polson - konsert', city: 'Ljungby' }, // 3 ev i juli, 2 synliga
    { slug: 'caferosenhill', name: 'Café Rosenhill' }, // 3 ev i juli, 1 synliga
    { slug: 'cufskaane', name: 'CUF Skåne' }, // 3 ev i juli, 8 synliga
    { slug: 'brygganangelholm', name: 'Bryggan Kök & Bar' }, // 3 ev i juli, 6 synliga
    { slug: 'borlangekommun', name: 'Borlänge kommun', city: 'Borlänge' }, // 3 ev i juli, 2 synliga
    { slug: '61563974404293', name: 'Blå Elefanten' }, // 3 ev i juli, 3 synliga
    { slug: 'bohuslanguider', name: 'Bohusläns Guider' }, // 3 ev i juli, 4 synliga
    { slug: 'biokontrastiggesund', name: 'Bio Kontrast - Folkets Hus Iggesund' }, // 3 ev i juli, 1 synliga
    { slug: 'folketsbiomalmo', name: 'Biograf Panora Malmö' }, // 3 ev i juli, 7 synliga
    { slug: 'haningebibliotek', name: 'Biblioteken i Haninge' }, // 3 ev i juli, 5 synliga
    { slug: 'apollonsolna', name: 'Apollon Solna FK' }, // 3 ev i juli, 3 synliga
    { slug: 'Bibliotekenilulea', name: 'Biblioteken i Luleå' }, // 3 ev i juli, 8 synliga
    { slug: 'alingsaskommun', name: 'Alingsås kommun', city: 'Alingsås' }, // 3 ev i juli, 2 synliga
    { slug: 'alexhermanssonshow', name: 'Alex Hermansson' }, // 3 ev i juli, 8 synliga
    { slug: 'alingsasparken', name: 'Alingsås Parken', city: 'Alingsås' }, // 3 ev i juli, 3 synliga
    { slug: 'dalarna.abf', name: 'ABF Dalarna', city: 'Falun' }, // 3 ev i juli, 1 synliga
    { slug: 'hasse.soderstrom.77', name: '4R challenge' }, // 3 ev i juli, 5 synliga
    { slug: 'ostfoldteater', name: 'Østfold Teater' }, // 2 ev i juli, 6 synliga
    { slug: 'ostgotateatern', name: 'Östgötateatern', city: 'Linköping' }, // 2 ev i juli, 3 synliga
    { slug: 'ostersundskommun', name: 'Östersunds kommun - Staaren tjïelte' }, // 2 ev i juli, 7 synliga
    { slug: 'ostersundsbibliotek', name: 'Östersunds Bibliotek' }, // 2 ev i juli, 8 synliga
    { slug: 'destinationostersund', name: 'Östersund, Jämtland, Sweden' }, // 2 ev i juli, 8 synliga
    { slug: 'sdbollebygd', name: 'torget i Bollebygd' }, // 2 ev i juli, 8 synliga
    { slug: 'ColdFusionComedy', name: 'https://linktr.ee/Coldfusioncomedy' }, // 2 ev i juli, 2 synliga
    { slug: 'zatancruisers', name: 'Zatan Cruisers', city: 'Laholm' }, // 2 ev i juli, 8 synliga
    { slug: 'yogaskolan.ostersund', name: 'Yogaskolan Östersund' }, // 2 ev i juli, 1 synliga
    { slug: 'studieframjandetmusikuppsala', name: 'Walmstedtska Gården' }, // 2 ev i juli, 8 synliga
    { slug: 'vatterhemofficiell', name: 'Vätterhem', city: 'Jönköping' }, // 2 ev i juli, 1 synliga
    { slug: 'wafabbil', name: 'Wafab Bil', city: 'Arvika' }, // 2 ev i juli, 3 synliga
    { slug: 'vasteraskonserthus', name: 'Västerås Konserthus', city: 'Västerås' }, // 2 ev i juli, 8 synliga
    { slug: 'vasbybk', name: 'Väsby Brukshundsklubb' }, // 2 ev i juli, 1 synliga
    { slug: 'Voories1951', name: 'Voorbereidingskool George Preparatory School' }, // 2 ev i juli, 4 synliga
    { slug: 'Levochmaval', name: 'ViveVale' }, // 2 ev i juli, 4 synliga
    { slug: 'VisitUmea', name: 'VisitUmeå', city: 'Umeå' }, // 2 ev i juli, 2 synliga
    { slug: 'vilhelmina.folketshus.7', name: 'Vilhelmina Folkets Hus' }, // 2 ev i juli, 4 synliga
    { slug: 'vewcs', name: 'Victor Evelina West Coast Swing', city: 'Uppsala' }, // 2 ev i juli, 8 synliga
    { slug: 'vedeldspizzan', name: 'Vedeldspizzan', city: 'Göteborg' }, // 2 ev i juli, 2 synliga
    { slug: 'vansbrokommun', name: 'Vansbro kommun' }, // 2 ev i juli, 8 synliga
    { slug: 'everypadelkopparlunden', name: 'Vamos Padel' }, // 2 ev i juli, 4 synliga
    { slug: 'VXOevent', name: 'VXO event' }, // 2 ev i juli, 1 synliga
    { slug: 'uppsalakammarorkester', name: 'Uppsala Kammarorkester', city: 'Uppsala' }, // 2 ev i juli, 8 synliga
    { slug: 'ungdomshuset.odense', name: 'Ungdomshuset Odense' }, // 2 ev i juli, 8 synliga
    { slug: 'umeadansklubb', name: 'Umeå Dansklubb' }, // 2 ev i juli, 2 synliga
    { slug: 'trosa.golfklubb', name: 'Trosa Golfklubb' }, // 2 ev i juli, 1 synliga
    { slug: 'seductionexcursions', name: 'Tyresö kommun, Stockholms län' }, // 2 ev i juli, 8 synliga
    { slug: 'TormekSharpeningInnovation', name: 'Tormek', city: 'Lindesberg' }, // 2 ev i juli, 2 synliga
    { slug: 'tillsammansforkumla', name: 'Tillsammans för Kumla' }, // 2 ev i juli, 8 synliga
    { slug: 'TibroRF', name: 'Tibro Ryttarförening' }, // 2 ev i juli, 2 synliga
    { slug: 'tgsportbar', name: 'TG Sportbar & Restaurang', city: 'Staffanstorp' }, // 2 ev i juli, 8 synliga
    { slug: 'thabelatravel', name: 'Thabela Travel' }, // 2 ev i juli, 8 synliga
    { slug: 'soderbarkeparken', name: 'Söderbärkeparken' }, // 2 ev i juli, 3 synliga
    { slug: 'sodrahalsinglandstradgardsodlareforening', name: 'Södra Hälsinglands Trädgårdsodlareförening', city: 'Söderhamn' }, // 2 ev i juli, 2 synliga
    { slug: '100057481808877', name: 'Sånnagården' }, // 2 ev i juli, 2 synliga
    { slug: 'sundsbysateri', name: 'Sundsby Säteri' }, // 2 ev i juli, 2 synliga
    { slug: 'sundbalans', name: 'Sund Balans' }, // 2 ev i juli, 3 synliga
    { slug: 'studieforbundet.vilhelmina', name: 'Studieförbundet Vuxenskolan Vilhelmina' }, // 2 ev i juli, 1 synliga
    { slug: 'stuckonlive', name: 'Stuck On - Live' }, // 2 ev i juli, 8 synliga
    { slug: 'stromtorpsik', name: 'Strömtorps IK' }, // 2 ev i juli, 2 synliga
    { slug: 'mpvetlanda', name: 'Stortorget' }, // 2 ev i juli, 2 synliga
    { slug: 'stockholmsmarknader', name: 'Stockholmsmarknader' }, // 2 ev i juli, 5 synliga
    { slug: '5071puben', name: 'Standupkunst' }, // 2 ev i juli, 2 synliga
    { slug: 'stockholmghostwalk', name: 'Stockholm Ghost Walk', city: 'Stockholm' }, // 2 ev i juli, 4 synliga
    { slug: 'sportsonvasagatan', name: 'Sportson', city: 'Göteborg' }, // 2 ev i juli, 2 synliga
    { slug: 'SpiritualisternaKristianstad', name: 'Spiritualisterna i Kristianstad', city: 'Kristianstad' }, // 2 ev i juli, 1 synliga
    { slug: 'royal.roland.5623', name: 'SoundTrack Roland' }, // 2 ev i juli, 2 synliga
    { slug: 'Snapphanarnasrf', name: 'Snapphanarnas Ryttarförening', city: 'Sölvesborg' }, // 2 ev i juli, 8 synliga
    { slug: 'skanskabyggvaror', name: 'Skånska Byggvaror', city: 'Göteborg' }, // 2 ev i juli, 8 synliga
    { slug: 'skistarsverige', name: 'SkiStar', city: 'Helsingborg' }, // 2 ev i juli, 8 synliga
    { slug: 'skarahf', name: 'Skara HF' }, // 2 ev i juli, 8 synliga
    { slug: 'SkogsbadiStockholm', name: 'Skogsbad i Stockholm', city: 'Stockholm' }, // 2 ev i juli, 1 synliga
    { slug: 'Siggenfriends', name: 'Sigge n Friends' }, // 2 ev i juli, 2 synliga
    { slug: 'sevallabygdegard', name: 'Sevalla Bygdegård', city: 'Västerås' }, // 2 ev i juli, 8 synliga
    { slug: 'sensusvastrasverige', name: 'Sensus Västra Sverige', city: 'Göteborg' }, // 2 ev i juli, 8 synliga
    { slug: 'SagasIslandshastar', name: 'Sagas Íshestar' }, // 2 ev i juli, 1 synliga
    { slug: 'sagabioflen', name: 'Saga Bio, Flen' }, // 2 ev i juli, 2 synliga
    { slug: 'stfostraskane', name: 'STF Östra Skåne Lokalavdelning' }, // 2 ev i juli, 8 synliga
    { slug: 'STCSkovdeStaketgatan', name: 'STC', city: 'Skövde' }, // 2 ev i juli, 6 synliga
    { slug: 'spkroslagssektionen', name: 'SPK Svenska Pudelklubbens Roslagssektion', city: 'Norrtälje' }, // 2 ev i juli, 7 synliga
    { slug: 'kristina.blad', name: 'SHETLAND MITT' }, // 2 ev i juli, 8 synliga
    { slug: 'rokochgrillsverige', name: 'Rök Och Grill AB' }, // 2 ev i juli, 8 synliga
    { slug: 'Reimersholmehotel', name: 'Reimersholme Hotel', city: 'Stockholm' }, // 2 ev i juli, 8 synliga
    { slug: 'lottamarkhester', name: 'Reikicentrum Oskarshamn', city: 'Oskarshamn' }, // 2 ev i juli, 2 synliga
    { slug: 'uddevalla.riksteaterforening', name: 'Regionteater Väst' }, // 2 ev i juli, 4 synliga
    { slug: 'rehnsbk', name: 'Rehns BK' }, // 2 ev i juli, 8 synliga
    { slug: 'RAWcomedyclub', name: 'RAW comedy club', city: 'Stockholm' }, // 2 ev i juli, 2 synliga
    { slug: 'puskasmusikk', name: 'Puskas Musikk & Platebar' }, // 2 ev i juli, 8 synliga
    { slug: 'punkfestsoderhamn', name: 'Punkfest Söderhamn', city: 'Söderhamn' }, // 2 ev i juli, 1 synliga
    { slug: 'poffertjes.se', name: 'Poffertjes.se' }, // 2 ev i juli, 3 synliga
    { slug: 'CDMortenSteen', name: 'PADI Course Director Morten Steen' }, // 2 ev i juli, 8 synliga
    { slug: 'planthousehuntersville', name: 'PlantHouse' }, // 2 ev i juli, 8 synliga
    { slug: 'tommy.jeansson', name: 'Olofströms Cykelklubb', city: 'Olofström' }, // 2 ev i juli, 1 synliga
    { slug: 'naringslivmonsteraskommun', name: 'Näringsliv Mönsterås kommun' }, // 2 ev i juli, 1 synliga
    { slug: 'nojeskompanietmorrum', name: 'Nöjeskompaniet', city: 'Hässleholm' }, // 2 ev i juli, 1 synliga
    { slug: 'CyrusMoradi', name: 'Nyköping', city: 'Nyköping' }, // 2 ev i juli, 8 synliga
    { slug: 'svenskaafghanhundklubben', name: 'Nykvarns Hundhall' }, // 2 ev i juli, 1 synliga
    { slug: 'Nostalgiklubben', name: 'Nostalgiklubben' }, // 2 ev i juli, 6 synliga
    { slug: 'stadshotelletnora', name: 'Nora Bokhandel', city: 'Nora' }, // 2 ev i juli, 8 synliga
    { slug: 'nordiskakammarorkestern', name: 'Nordiska Kammarorkestern', city: 'Sundsvall' }, // 2 ev i juli, 5 synliga
    { slug: 'Nightcruiserskristinehamn', name: 'Nightcruisers Kristinehamn', city: 'Kristinehamn' }, // 2 ev i juli, 2 synliga
    { slug: 'NaturumVattenriket', name: 'Naturum Vattenriket', city: 'Kristianstad' }, // 2 ev i juli, 3 synliga
    { slug: 'nfharnosand', name: 'Naturskyddsföreningen Härnösand', city: 'Härnösand' }, // 2 ev i juli, 8 synliga
    { slug: 'nationalmuseumswe', name: 'Nationalmuseum' }, // 2 ev i juli, 7 synliga
    { slug: 'nackalokalhistoriska', name: 'Nacka lokalhistoriska arkiv' }, // 2 ev i juli, 1 synliga
    { slug: 'mollerstivoli', name: 'Möllers Tivoli' }, // 2 ev i juli, 8 synliga
    { slug: 'movendimjolby', name: 'Movendi Mjölby', city: 'Mjölby' }, // 2 ev i juli, 5 synliga
    { slug: 'mormorsgruvan', name: 'Mormorsgruvans byalag' }, // 2 ev i juli, 8 synliga
    { slug: 'hotellmullsjo', name: 'Mullsjö Hotell & Konferens' }, // 2 ev i juli, 1 synliga
    { slug: 'moriskapaviljongen', name: 'Moriska Paviljongen' }, // 2 ev i juli, 8 synliga
    { slug: 'mikespubskovde', name: 'Mikes pub och restaurang', city: 'Skövde' }, // 2 ev i juli, 4 synliga
    { slug: 'mervipunkka66', name: 'Mer Vila' }, // 2 ev i juli, 1 synliga
    { slug: 'mediumcamilla', name: 'Medium Camilla' }, // 2 ev i juli, 5 synliga
    { slug: 'MatoNostalgi', name: 'Mat & Nostalgi i Viksjö' }, // 2 ev i juli, 8 synliga
    { slug: 'MariaSandelsallskapet', name: 'Maria Sandel' }, // 2 ev i juli, 8 synliga
    { slug: 'motorklubbentandstiftet', name: 'Malmö Stad' }, // 2 ev i juli, 7 synliga
    { slug: 'loparfesten', name: 'Löparfesten Skanör-Falsterbo' }, // 2 ev i juli, 6 synliga
    { slug: 'lysekilshandel', name: 'Lysekils Handel' }, // 2 ev i juli, 1 synliga
    { slug: 'gasasteget', name: 'Lunds Dansklubb Gåsasteget', city: 'Lund' }, // 2 ev i juli, 6 synliga
    { slug: 'ludvikakommun', name: 'Ludvika kommun' }, // 2 ev i juli, 1 synliga
    { slug: 'lugersweden', name: 'Luger' }, // 2 ev i juli, 8 synliga
    { slug: 'lommaflotten', name: 'LommaFlotten' }, // 2 ev i juli, 2 synliga
    { slug: 'LokalaHjalpenVasteras', name: 'Lokala Hjälpen', city: 'Västerås' }, // 2 ev i juli, 1 synliga
    { slug: 'ovewenchelarsuno', name: 'Ljungby', city: 'Ljungby' }, // 2 ev i juli, 8 synliga
    { slug: 'linkupbookings', name: 'LinkUp Bookings' }, // 2 ev i juli, 1 synliga
    { slug: 'Linkoepingslistan', name: 'Linköpingslistan', city: 'Linköping' }, // 2 ev i juli, 8 synliga
    { slug: 'lillaedetskommun', name: 'Lilla Edets kommun' }, // 2 ev i juli, 3 synliga
    { slug: 'LiljansHaxbod', name: 'Liljans häxbod' }, // 2 ev i juli, 1 synliga
    { slug: 'lindblomacademy', name: 'Lindblom Academy Inner Spirit Light', city: 'Västerås' }, // 2 ev i juli, 8 synliga
    { slug: 'theshipchristchurch', name: 'Laughing Bellys' }, // 2 ev i juli, 8 synliga
    { slug: 'korforalla', name: 'Kör för alla', city: 'Stockholm' }, // 2 ev i juli, 8 synliga
    { slug: 'kungalvskommun', name: 'Kungälvs kommun' }, // 2 ev i juli, 1 synliga
    { slug: 'Dansvirvlar', name: 'Kungälv, Västra Götalands län' }, // 2 ev i juli, 1 synliga
    { slug: 'kulturmagasinetsundsvall', name: 'Kulturmagasinet Sundsvall', city: 'Sundsvall' }, // 2 ev i juli, 8 synliga
    { slug: 'kpdmellerud', name: 'Kulturbruket på Dal' }, // 2 ev i juli, 8 synliga
    { slug: 'kulturbolaget', name: 'Kulturbolaget' }, // 2 ev i juli, 8 synliga
    { slug: 'kulturisigma', name: 'Kultur i Sigma' }, // 2 ev i juli, 1 synliga
    { slug: 'carina.grahnhellberg', name: 'Krokom, Jämtlands län' }, // 2 ev i juli, 8 synliga
    { slug: 'parohia.Helsingborg', name: 'Krika Skog' }, // 2 ev i juli, 7 synliga
    { slug: 'konstframjandet.skane', name: 'Konstfrämjandet Skåne' }, // 2 ev i juli, 1 synliga
    { slug: 'konstepidemin', name: 'Konstepidemin' }, // 2 ev i juli, 6 synliga
    { slug: 'MimersKulturhus', name: 'Kongahällaleden' }, // 2 ev i juli, 8 synliga
    { slug: 'kulturonoje', name: 'Kim Kultur&Nöje', city: 'Norrtälje' }, // 2 ev i juli, 4 synliga
    { slug: 'fastningsmuseet', name: 'Karlsborgs Fästningsmuseum' }, // 2 ev i juli, 6 synliga
    { slug: 'koijkonsthantverk', name: 'KOiJ Konsthantverk i Jönköping', city: 'Jönköping' }, // 2 ev i juli, 8 synliga
    { slug: 'kbwestgbg', name: 'KB West' }, // 2 ev i juli, 8 synliga
    { slug: 'jonkopingcity', name: 'Jönköping City', city: 'Jönköping' }, // 2 ev i juli, 3 synliga
    { slug: 'kdoxelosund', name: 'Järntorget Oxelösund' }, // 2 ev i juli, 2 synliga
    { slug: 'municipiodefaro', name: 'Jardim da Alameda' }, // 2 ev i juli, 7 synliga
    { slug: 'JTTEventsLtd', name: 'JTT Events' }, // 2 ev i juli, 1 synliga
    { slug: 'jamtlimuseum', name: 'Jamtli' }, // 2 ev i juli, 4 synliga
    { slug: 'HoforsHockey', name: 'Ishallen Hofors' }, // 2 ev i juli, 8 synliga
    { slug: 'JCIHalmstad', name: 'JCI Halmstad', city: 'Halmstad' }, // 2 ev i juli, 8 synliga
    { slug: 'Inkonst3', name: 'Inkonst' }, // 2 ev i juli, 8 synliga
    { slug: 'ikeaumea', name: 'IKEA', city: 'Sundsvall' }, // 2 ev i juli, 8 synliga
    { slug: 'boltic', name: 'IF Boltic', city: 'Karlstad' }, // 2 ev i juli, 3 synliga
    { slug: 'ideadrottninghog', name: 'Idé A Drottninghög', city: 'Helsingborg' }, // 2 ev i juli, 6 synliga
    { slug: 'harnosandsbibliotek', name: 'Härnösands bibliotek', city: 'Härnösand' }, // 2 ev i juli, 8 synliga
    { slug: '100063537131403', name: 'Hårdrockskören', city: 'Gävle' }, // 2 ev i juli, 8 synliga
    { slug: 'hotelmolndalsbroochroyrestaurant', name: 'Hotel Mölndals Bro - Roy Restaurant Café & Bar' }, // 2 ev i juli, 8 synliga
    { slug: 'assistanspoolen', name: 'Hedera Assistans Region Syd', city: 'Helsingborg' }, // 2 ev i juli, 8 synliga
    { slug: 'headstompproductions', name: 'Headstomp Productions' }, // 2 ev i juli, 8 synliga
    { slug: 'malinstang.se', name: 'Hamra Trail Run' }, // 2 ev i juli, 3 synliga
    { slug: 'hagforskulturochbibliotek', name: 'Hagfors kultur och bibliotek' }, // 2 ev i juli, 3 synliga
    { slug: 'hypoteket', name: 'HYPOTEKET', city: 'Lund' }, // 2 ev i juli, 3 synliga
    { slug: 'stadsbiblioteketgbg', name: 'Göteborgs stadsbibliotek' }, // 2 ev i juli, 7 synliga
    { slug: 'GothenburgSymphonyOrchestra', name: 'Göteborgs Symfoniker', city: 'Göteborg' }, // 2 ev i juli, 5 synliga
    { slug: 'gallivare.se', name: 'Gällivare kommun', city: 'Gällivare' }, // 2 ev i juli, 6 synliga
    { slug: 'gotams', name: 'Göta MS', city: 'Enköping' }, // 2 ev i juli, 8 synliga
    { slug: 'gkmmsplit', name: 'Gradska knjiznica Marka Marulica Split' }, // 2 ev i juli, 8 synliga
    { slug: 'Glimmingehus', name: 'Glimmingehus' }, // 2 ev i juli, 5 synliga
    { slug: 'gnosjobibliotek', name: 'Gnosjö kultur & bibliotek' }, // 2 ev i juli, 2 synliga
    { slug: 'StudieframjandetNorrbotten', name: 'GROP - Gällivare Rock och Pop', city: 'Gällivare' }, // 2 ev i juli, 4 synliga
    { slug: 'trolldansarna', name: 'Föreningen Trolldansarna', city: 'Sundsvall' }, // 2 ev i juli, 2 synliga
    { slug: 'grekiskaostersund', name: 'GREKISKA grill & bar (Östersund)' }, // 2 ev i juli, 3 synliga
    { slug: 'Furuviksparken', name: 'Furuviksparken' }, // 2 ev i juli, 2 synliga
    { slug: 'claes.toyra.9', name: 'Fyristorg' }, // 2 ev i juli, 8 synliga
    { slug: 'fulloflife.tantra', name: 'Full of Life' }, // 2 ev i juli, 2 synliga
    { slug: 'forumbiblioteken', name: 'Forumbiblioteken i Nacka' }, // 2 ev i juli, 4 synliga
    { slug: 'Mockelnforeningarna', name: 'Folkets hus, Karlskoga' }, // 2 ev i juli, 8 synliga
    { slug: 'folketshusulricehamn', name: 'Folkets Hus Ulricehamn' }, // 2 ev i juli, 8 synliga
    { slug: 'fhuddevalla', name: 'Folkets Hus Uddevalla', city: 'Uddevalla' }, // 2 ev i juli, 6 synliga
    { slug: 'hovmantorps.folketshus', name: 'Folkbiografen Hovmantorp' }, // 2 ev i juli, 5 synliga
    { slug: 'iggesundsfolkan', name: 'Folkets Hus - Iggesund' }, // 2 ev i juli, 7 synliga
    { slug: 'FjordCadenza', name: 'Fjord Cadenza' }, // 2 ev i juli, 8 synliga
    { slug: 'fernandascafeet', name: 'Fernandas Konditori & Bageri', city: 'Staffanstorp' }, // 2 ev i juli, 2 synliga
    { slug: 'Familjecentralen.Ulricehamn', name: 'Familjecentralen, Öppna förskolan i Ulricehamn' }, // 2 ev i juli, 5 synliga
    { slug: 'falbygdsturism', name: 'FalbygdsTurism' }, // 2 ev i juli, 7 synliga
    { slug: 'Falkopingsbibliotek', name: 'Falköpings bibliotek' }, // 2 ev i juli, 3 synliga
    { slug: 'eyragarden', name: 'Eyragården, Kävlinge Kommun' }, // 2 ev i juli, 5 synliga
    { slug: 'europadirektvasternorrland', name: 'Europa Direkt Västernorrland' }, // 2 ev i juli, 7 synliga
    { slug: 'enkopingsmassan', name: 'Enköpingsmässan', city: 'Enköping' }, // 2 ev i juli, 4 synliga
    { slug: 'EnaBuggSwing', name: 'Ena Bugg & Swing', city: 'Enköping' }, // 2 ev i juli, 8 synliga
    { slug: 'eksjoidrottsskola', name: 'Eksjö idrottsskola' }, // 2 ev i juli, 1 synliga
    { slug: 'ebba.dansklubb', name: 'EBBA Dansklubb' }, // 2 ev i juli, 7 synliga
    { slug: 'Drammensacred', name: 'Drammen Sacred Music Festival' }, // 2 ev i juli, 7 synliga
    { slug: 'DestinationSundsvall', name: 'Destination Sundsvall', city: 'Sundsvall' }, // 2 ev i juli, 3 synliga
    { slug: 'Droskan.se', name: 'DROSKAN' }, // 2 ev i juli, 8 synliga
    { slug: 'denvitaliljan', name: 'Den Vita Liljan' }, // 2 ev i juli, 1 synliga
    { slug: 'ClassicCarWeek', name: 'Classic Car Week' }, // 2 ev i juli, 3 synliga
    { slug: 'cirkus.klub', name: 'Cirkus' }, // 2 ev i juli, 7 synliga
    { slug: 'vasterascity', name: 'Carlsson På Kajen', city: 'Västerås' }, // 2 ev i juli, 8 synliga
    { slug: 'carcarefreaks', name: 'CarCare Freaks - Bilpleje Shop' }, // 2 ev i juli, 1 synliga
    { slug: 'ckwano1', name: 'CK Wano', city: 'Halmstad' }, // 2 ev i juli, 1 synliga
    { slug: 'csnoje.se', name: 'CS Nöje' }, // 2 ev i juli, 8 synliga
    { slug: 'centrumforfotografi', name: 'CFF – Centrum för fotografi', city: 'Landskrona' }, // 2 ev i juli, 8 synliga
    { slug: 'c4shopping', name: 'C4 Shopping', city: 'Kristianstad' }, // 2 ev i juli, 1 synliga
    { slug: 'baerumkulturhus', name: 'Bærum Kulturhus' }, // 2 ev i juli, 5 synliga
    { slug: 'JonkopingsLansKonstforening', name: 'Borås, Västra Götalands län', city: 'Borås' }, // 2 ev i juli, 8 synliga
    { slug: 'BygdensEFS', name: 'Bygdens EFS' }, // 2 ev i juli, 8 synliga
    { slug: 'Boras.Stadsteater', name: 'Borås Stadsteater', city: 'Borås' }, // 2 ev i juli, 3 synliga
    { slug: 'bohusfastning', name: 'Bohus Fästning' }, // 2 ev i juli, 7 synliga
    { slug: 'BollebygdsRidklubb', name: 'Bollebygds Ridklubb' }, // 2 ev i juli, 8 synliga
    { slug: 'Bipolarforeningen.Norge', name: 'Bipolarforeningen Norge' }, // 2 ev i juli, 8 synliga
    { slug: 'Biotranan.Tranemo', name: 'Bio Tranan Tranemo' }, // 2 ev i juli, 3 synliga
    { slug: 'bibliotekljusdal', name: 'Biblioteket I Ljusdal' }, // 2 ev i juli, 3 synliga
    { slug: 'befreenow.se', name: 'Befreenow' }, // 2 ev i juli, 4 synliga
    { slug: 'beehivestationfoodcarts', name: 'BeeHive Station Food Pod' }, // 2 ev i juli, 1 synliga
    { slug: 'backa.teater', name: 'Backa Teater' }, // 2 ev i juli, 2 synliga
    { slug: 'barnbiblioteken', name: 'Barnbiblioteken', city: 'Strängnäs' }, // 2 ev i juli, 6 synliga
    { slug: 'backtobiblecommunity', name: 'Back to Bible Community Church', city: 'Lund' }, // 2 ev i juli, 8 synliga
    { slug: 'BTHofficiell', name: 'BTH - Blekinge Tekniska Högskola', city: 'Karlskrona' }, // 2 ev i juli, 1 synliga
    { slug: 'autismblekinge', name: 'Autism Blekinge', city: 'Olofström' }, // 2 ev i juli, 2 synliga
    { slug: 'autismskane', name: 'Autism Skåne', city: 'Kristianstad' }, // 2 ev i juli, 3 synliga
    { slug: 'ArbogaFolketsPark', name: 'Arboga Folkets Park' }, // 2 ev i juli, 8 synliga
    { slug: 'annkiochklas', name: 'Annki & Klas' }, // 2 ev i juli, 4 synliga
    { slug: 'alexeklundofficial', name: 'Alex Eklund', city: 'Eskilstuna' }, // 2 ev i juli, 8 synliga
    { slug: 'attraktivalaholm', name: 'Attraktiva Laholm', city: 'Laholm' }, // 2 ev i juli, 2 synliga
    { slug: 'Hjovidvattern', name: 'Ahlins Gasmix' }, // 2 ev i juli, 8 synliga
    { slug: 'abfnorrkalix', name: 'ABF Norr Kalix' }, // 2 ev i juli, 4 synliga
    { slug: 'astarscandinavia', name: 'A STAR Entertainment', city: 'Norrköping' }, // 2 ev i juli, 8 synliga
    { slug: '59anLysekil', name: '59an i Lysekil' }, // 2 ev i juli, 5 synliga
    { slug: '73ansloppis', name: '73ans loppis' }, // 2 ev i juli, 8 synliga
    { slug: '013lostinline', name: '013-Lost in Line', city: 'Linköping' }, // 2 ev i juli, 1 synliga
];
