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
    { slug: 'jubelAB', name: 'Visit Örebro' }, // 416 ev i juli, 8 synliga
    { slug: 'LiveEventRadar', name: 'Live Event Radar' }, // 107 ev i juli, 8 synliga
    { slug: 'varjesteg', name: 'VarjeSteg' }, // 51 ev i juli, 8 synliga
    { slug: 'nieuscene', name: 'Nieu Torshov' }, // 42 ev i juli, 7 synliga
    { slug: 'feverup', name: 'Fever', city: 'Stockholm' }, // 41 ev i juli, 8 synliga
    { slug: 'laughseats', name: 'Laugh Seats' }, // 37 ev i juli, 8 synliga
    { slug: 'vaxjobibliotek', name: 'Växjö bibliotek' }, // 35 ev i juli, 8 synliga
    { slug: 'ABFsorm', name: 'ABF Sörmland', city: 'Katrineholm' }, // 31 ev i juli, 8 synliga
    { slug: 'StudieforbundetVuxenskolanVast', name: 'Studieförbundet Vuxenskolan Väst', city: 'Uddevalla' }, // 28 ev i juli, 6 synliga
    { slug: 'Moveat.Sweden', name: 'Moveat', city: 'Stockholm' }, // 27 ev i juli, 8 synliga
    { slug: 'kulturaktiebolaget', name: 'Kulturaktiebolaget', city: 'Karlstad' }, // 25 ev i juli, 8 synliga
    { slug: 'hundesenteretitrondheim', name: 'Hundesenteret' }, // 25 ev i juli, 8 synliga
    { slug: 'diamondsdirectstore', name: 'Diamonds Direct' }, // 25 ev i juli, 8 synliga
    { slug: 'Vaxjodyksport', name: 'Växjödyksport', city: 'Växjö' }, // 24 ev i juli, 8 synliga
    { slug: 'jointhestudentlife', name: 'The Student Life', city: 'Uppsala' }, // 23 ev i juli, 8 synliga
    { slug: 'Honggymnastikforening', name: 'Høng GF' }, // 23 ev i juli, 8 synliga
    { slug: 'stadsbiblioteketgbg', name: 'Göteborgs stadsbibliotek' }, // 23 ev i juli, 6 synliga
    { slug: 'jazzclubfasching', name: 'Fasching' }, // 22 ev i juli, 7 synliga
    { slug: 'hemfranderome', name: 'Hem från Derome', city: 'Varberg' }, // 21 ev i juli, 4 synliga
    { slug: 'studioexpress.se', name: 'Studioexpress.se', city: 'Lund' }, // 20 ev i juli, 8 synliga
    { slug: 'stormspakhus', name: 'Storms Pakhus' }, // 20 ev i juli, 7 synliga
    { slug: 'northeventAB', name: 'Northevent AB', city: 'Karlstad' }, // 20 ev i juli, 8 synliga
    { slug: 'fagerstakommun', name: 'Skinnskattebergs Kommun' }, // 20 ev i juli, 8 synliga
    { slug: 'medborgarskolanjamtland', name: 'Medborgarskolan' }, // 20 ev i juli, 8 synliga
    { slug: 'Cafebiografen', name: 'Cafe biografen' }, // 20 ev i juli, 8 synliga
    { slug: 'folkuniversitetetvisby', name: 'Folkuniversitetet Visby', city: 'Visby' }, // 20 ev i juli, 8 synliga
    { slug: 'vaniumeasida', name: 'Vän i Umeå' }, // 19 ev i juli, 8 synliga
    { slug: 'SundsvallsStadsbibliotek', name: 'Sundsvalls Stadsbibliotek', city: 'Sundsvall' }, // 19 ev i juli, 8 synliga
    { slug: 'hotelskansenoland', name: 'Hotel Skansen', city: 'Kalmar' }, // 19 ev i juli, 8 synliga
    { slug: 'svdalsland', name: 'Studieförbundet Vuxenskolan i Dalsland' }, // 18 ev i juli, 8 synliga
    { slug: 'vrakdykarpensionatet', name: 'Vrakdykarpensionatet' }, // 18 ev i juli, 8 synliga
    { slug: 'molndalsdansskola', name: 'Mölndals Dansskola' }, // 18 ev i juli, 8 synliga
    { slug: 'Megascope', name: 'Megascope' }, // 18 ev i juli, 8 synliga
    { slug: 'bioroy', name: 'Bio Roy' }, // 18 ev i juli, 8 synliga
    { slug: 'kulturkvarteret', name: 'Kulturkvarteret Kristianstad', city: 'Kristianstad' }, // 18 ev i juli, 8 synliga
    { slug: 'alltpascen', name: 'Allt På Scen & Mycke Nöje', city: 'Linköping' }, // 18 ev i juli, 8 synliga
    { slug: 'medleymalmo', name: 'medley malmö' }, // 17 ev i juli, 8 synliga
    { slug: 'trivselhussverige', name: 'Trivselhus', city: 'Helsingborg' }, // 17 ev i juli, 4 synliga
    { slug: 'attentionmolndal', name: 'Attention Mölndal' }, // 17 ev i juli, 8 synliga
    { slug: 'taystase', name: 'Taysta', city: 'Jönköping' }, // 17 ev i juli, 8 synliga
    { slug: 'KulturcentrumSandviken', name: 'Kulturcentrum Sandviken', city: 'Sandviken' }, // 17 ev i juli, 6 synliga
    { slug: 'varnamobibliotekochkultur', name: 'Värnamo bibliotek och kultur' }, // 16 ev i juli, 8 synliga
    { slug: 'Musikhuset', name: 'Musikhuset Gävle', city: 'Gävle' }, // 16 ev i juli, 8 synliga
    { slug: 'sodertaljestadsscen', name: 'Södertälje stadsscen' }, // 16 ev i juli, 8 synliga
    { slug: 'kulturiale', name: 'Kultur i Ale' }, // 16 ev i juli, 7 synliga
    { slug: 'gkmmsplit', name: 'Gradska knjiznica Marka Marulica Split' }, // 16 ev i juli, 8 synliga
    { slug: 'guppyentertainmentab', name: 'Guppy Entertainment', city: 'Kristianstad' }, // 16 ev i juli, 8 synliga
    { slug: 'gemenskapikungsor', name: 'Gemenskap i Kungsör' }, // 16 ev i juli, 7 synliga
    { slug: 'bibliotekenihalmstad', name: 'Biblioteken i Halmstad', city: 'Halmstad' }, // 16 ev i juli, 8 synliga
    { slug: 'vasteraskonserthus', name: 'Västerås Konserthus', city: 'Västerås' }, // 15 ev i juli, 8 synliga
    { slug: 'umepride', name: 'Umepride' }, // 15 ev i juli, 8 synliga
    { slug: 'Tangokompaniet', name: 'Tangokompaniet', city: 'Lund' }, // 15 ev i juli, 8 synliga
    { slug: 'ulrikabeijeryoga', name: 'UB Yoga, Sång & Ceremoni', city: 'Hudiksvall' }, // 15 ev i juli, 6 synliga
    { slug: 'Scalateatern', name: 'Scalateatern i Karlstad', city: 'Karlstad' }, // 15 ev i juli, 8 synliga
    { slug: 'mejeriet', name: 'Mejeriet', city: 'Lund' }, // 15 ev i juli, 8 synliga
    { slug: 'Midsommargarden', name: 'Midsommargården' }, // 15 ev i juli, 8 synliga
    { slug: 'lantmannenmaskinochlantbruk', name: 'Lantmännen Maskin och Lantmännen Lantbruk', city: 'Kristianstad' }, // 15 ev i juli, 5 synliga
    { slug: 'lerumsbibliotek', name: 'Kultur och bibliotek i Lerum' }, // 15 ev i juli, 8 synliga
    { slug: 'Kulturenshus', name: 'Kulturens hus Luleå' }, // 15 ev i juli, 8 synliga
    { slug: 'kollektivetlivetbar', name: 'Kollektivet Livet' }, // 15 ev i juli, 8 synliga
    { slug: 'Hjaltevadshus', name: 'Hjältevadshus', city: 'Göteborg' }, // 15 ev i juli, 6 synliga
    { slug: 'Eskilstunastadsbibliotek', name: 'Eskilstuna stadsbibliotek', city: 'Eskilstuna' }, // 15 ev i juli, 8 synliga
    { slug: 'vadhanderistockholm', name: 'Vad som händer i Stockholm', city: 'Stockholm' }, // 14 ev i juli, 5 synliga
    { slug: 'litensmula', name: 'Vita Huset - En Liten Smula', city: 'Norrtälje' }, // 14 ev i juli, 8 synliga
    { slug: 'folkuniversitetetregionsyd', name: 'Folkuniversitetet Syd', city: 'Lund' }, // 14 ev i juli, 8 synliga
    { slug: 'orebrobibliotek', name: 'Örebro bibliotek' }, // 13 ev i juli, 8 synliga
    { slug: 'Victoriateatern', name: 'Victoriateatern Malmö' }, // 13 ev i juli, 8 synliga
    { slug: 'vallentunadans', name: 'Vallentuna Dans' }, // 13 ev i juli, 8 synliga
    { slug: 'Esso36', name: 'SO36' }, // 13 ev i juli, 8 synliga
    { slug: 'norrlandsoperan', name: 'Norrlandsoperan' }, // 13 ev i juli, 8 synliga
    { slug: 'natminkulturhus', name: 'Nationella minoriteters kulturhus' }, // 13 ev i juli, 5 synliga
    { slug: 'musikidalarna', name: 'Musik i Dalarna', city: 'Falun' }, // 13 ev i juli, 6 synliga
    { slug: 'kristinehamnsbibliotek', name: 'Kristinehamns bibliotek', city: 'Kristinehamn' }, // 13 ev i juli, 5 synliga
    { slug: 'kramforsbibliotek', name: 'Kramfors bibliotek' }, // 13 ev i juli, 5 synliga
    { slug: 'krallentertainment', name: 'Krall Entertainment', city: 'Uppsala' }, // 13 ev i juli, 8 synliga
    { slug: 'Inkonst3', name: 'Inkonst' }, // 13 ev i juli, 8 synliga
    { slug: 'Hedenstedbibliotekerne', name: 'Hedensted Bibliotekerne' }, // 13 ev i juli, 8 synliga
    { slug: 'eksjobibliotek', name: 'Eksjö stadsbibliotek' }, // 13 ev i juli, 7 synliga
    { slug: 'Debasersthlm', name: 'Debaser', city: 'Stockholm' }, // 13 ev i juli, 7 synliga
    { slug: 'csnoje.se', name: 'CS Nöje', city: 'Jönköping' }, // 13 ev i juli, 8 synliga
    { slug: 'Biotranan.Tranemo', name: 'Bio Tranan Tranemo' }, // 13 ev i juli, 8 synliga
    { slug: 'arvikabibliotek', name: 'Arvika Bibliotek', city: 'Arvika' }, // 13 ev i juli, 6 synliga
    { slug: 'ABFsodertorn', name: 'ABF Södertörn' }, // 13 ev i juli, 8 synliga
    { slug: 'tibrobibliotek', name: 'Tibro bibliotek' }, // 12 ev i juli, 6 synliga
    { slug: 'svorebrolan', name: 'Studieförbundet Vuxenskolan Örebro Län', city: 'Nora' }, // 12 ev i juli, 8 synliga
    { slug: 'varldskulturmuseet', name: 'Världskulturmuseet' }, // 12 ev i juli, 7 synliga
    { slug: 'skogsvargarna', name: 'OK Skogsvargarna', city: 'Lidköping' }, // 12 ev i juli, 4 synliga
    { slug: 'oxiebiblioteket', name: 'Oxiebiblioteket' }, // 12 ev i juli, 5 synliga
    { slug: 'harnosandsbibliotek', name: 'Härnösands bibliotek', city: 'Härnösand' }, // 12 ev i juli, 8 synliga
    { slug: 'nygatan6', name: 'Nygatan 6' }, // 12 ev i juli, 8 synliga
    { slug: 'SwinginHepTown', name: 'HepTown', city: 'Lund' }, // 12 ev i juli, 8 synliga
    { slug: 'HarrysStenungsund', name: 'Harrys' }, // 12 ev i juli, 6 synliga
    { slug: 'freemoveyogastudio.nu', name: 'Freemove Yogastudio' }, // 12 ev i juli, 8 synliga
    { slug: 'folketshusulricehamn', name: 'Folkets Hus Ulricehamn' }, // 12 ev i juli, 8 synliga
    { slug: 'dismitt', name: 'Dis-Mitt', city: 'Gävle' }, // 12 ev i juli, 1 synliga
    { slug: 'bjuvsbibliotek', name: 'Bjuvs bibliotek' }, // 12 ev i juli, 8 synliga
    { slug: 'BorlangeDance', name: 'Borlänge Dance', city: 'Borlänge' }, // 12 ev i juli, 3 synliga
    { slug: 'bibliotekenilaholm', name: 'Biblioteken i Laholm', city: 'Laholm' }, // 12 ev i juli, 4 synliga
    { slug: 'vasterasbibliotek', name: 'Västerås bibliotek', city: 'Västerås' }, // 11 ev i juli, 8 synliga
    { slug: 'bibliotekoupplevelser', name: 'Vingåkers bibliotek' }, // 11 ev i juli, 7 synliga
    { slug: 'gunnesgard', name: 'Vikingagården Gunnes gård' }, // 11 ev i juli, 5 synliga
    { slug: 'svkalmarlan', name: 'Studieförbundet Vuxenskolan Kalmar län', city: 'Nybro' }, // 11 ev i juli, 8 synliga
    { slug: 'malmostadsbibliotek', name: 'Stadsbiblioteket i Malmö' }, // 11 ev i juli, 8 synliga
    { slug: 'biblioteketsimrishamn', name: 'Simrishamns bibliotek', city: 'Simrishamn' }, // 11 ev i juli, 8 synliga
    { slug: 'Reimersholmehotel', name: 'Reimersholme Hotel', city: 'Stockholm' }, // 11 ev i juli, 8 synliga
    { slug: 'shrekraveofficial', name: 'Shrek Rave' }, // 11 ev i juli, 8 synliga
    { slug: 'movehomesverige', name: 'Movehome', city: 'Motala' }, // 11 ev i juli, 5 synliga
    { slug: 'linkopingairswing', name: 'Linköping Air Swing', city: 'Linköping' }, // 11 ev i juli, 8 synliga
    { slug: 'karlskronabibliotek', name: 'Karlskrona Stadsbibliotek', city: 'Karlskrona' }, // 11 ev i juli, 8 synliga
    { slug: 'Gardenoffeathers', name: 'Garden of Feathers', city: 'Staffanstorp' }, // 11 ev i juli, 8 synliga
    { slug: 'iggesundsfolkan', name: 'Folkets Hus - Iggesund' }, // 11 ev i juli, 6 synliga
    { slug: 'FKPscorpiosweden', name: 'FKP Scorpio Sverige' }, // 11 ev i juli, 8 synliga
    { slug: 'estrad.norr', name: 'Estrad Norr' }, // 11 ev i juli, 7 synliga
    { slug: 'dalarnasmuseum', name: 'Dalarnas museum', city: 'Falun' }, // 11 ev i juli, 3 synliga
    { slug: 'centrumhusbiografen', name: 'Centrumhusbiografen' }, // 11 ev i juli, 8 synliga
    { slug: 'CooperativaCovibar', name: 'Covibar' }, // 11 ev i juli, 3 synliga
    { slug: 'bibliotekeniboras', name: 'Biblioteken i Borås', city: 'Borås' }, // 11 ev i juli, 6 synliga
    { slug: 'baravanlig.se', name: 'Bara Vanlig', city: 'Lund' }, // 11 ev i juli, 8 synliga
    { slug: 'almhultsbibliotek', name: 'Älmhults bibliotek' }, // 10 ev i juli, 8 synliga
    { slug: 'ystadsbibliotek', name: 'Ystads bibliotek', city: 'Ystad' }, // 10 ev i juli, 8 synliga
    { slug: 'YogaHusetFalun', name: 'Yogahuset Falun', city: 'Falun' }, // 10 ev i juli, 8 synliga
    { slug: 'vewcs', name: 'Victor Evelina West Coast Swing', city: 'Uppsala' }, // 10 ev i juli, 8 synliga
    { slug: 'vadstenabibliotek', name: 'Vadstena bibliotek' }, // 10 ev i juli, 5 synliga
    { slug: 'ungdomshuset.odense', name: 'Ungdomshuset Odense' }, // 10 ev i juli, 8 synliga
    { slug: 'Uddevallakassetten', name: 'Uddevallakassetten', city: 'Uddevalla' }, // 10 ev i juli, 8 synliga
    { slug: 'TillsammansHoor', name: 'Tillsammans Höör' }, // 10 ev i juli, 4 synliga
    { slug: 'Storlihytta', name: 'Storlihytta' }, // 10 ev i juli, 8 synliga
    { slug: 'SVGoteborg', name: 'Studieförbundet Vuxenskolan Göteborg', city: 'Göteborg' }, // 10 ev i juli, 8 synliga
    { slug: 'TheTivoli', name: 'The Tivoli', city: 'Helsingborg' }, // 10 ev i juli, 8 synliga
    { slug: 'Smalands', name: 'Smålands Nation', city: 'Lund' }, // 10 ev i juli, 2 synliga
    { slug: 'norrkoping.symphony', name: 'Louis De Geer-hallen Norrköping', city: 'Norrköping' }, // 10 ev i juli, 8 synliga
    { slug: 'planthousehuntersville', name: 'PlantHouse' }, // 10 ev i juli, 8 synliga
    { slug: 'ebba.dansklubb', name: 'EBBA Dansklubb' }, // 10 ev i juli, 4 synliga
    { slug: 'gotlandsmuseum', name: 'Gotlands Museum', city: 'Tingstäde' }, // 10 ev i juli, 6 synliga
    { slug: 'centrumforfotografi', name: 'CFF – Centrum för fotografi', city: 'Göteborg' }, // 10 ev i juli, 4 synliga
    { slug: 'arbisnkpg', name: 'Arbis' }, // 10 ev i juli, 8 synliga
    { slug: 'aabendans', name: 'Aaben Dans' }, // 10 ev i juli, 4 synliga
    { slug: 'varlokal', name: 'Vår lokal' }, // 9 ev i juli, 8 synliga
    { slug: 'orebro.salsafriends.9', name: 'Örebro Salsafriends' }, // 9 ev i juli, 4 synliga
    { slug: 'steamhotel', name: 'The Steam Hotel', city: 'Västerås' }, // 9 ev i juli, 5 synliga
    { slug: 'slagelsebib', name: 'Slagelse Bibliotekerne' }, // 9 ev i juli, 8 synliga
    { slug: 'naturskyddsforeningen.vanersborg', name: 'Naturskyddsföreningen Vänersborg' }, // 9 ev i juli, 4 synliga
    { slug: 'junisalvsborgdistrikt', name: 'Movendi Älvsborg', city: 'Alingsås' }, // 9 ev i juli, 8 synliga
    { slug: 'monica.karlsson.399', name: 'Motala biologiska förening', city: 'Motala' }, // 9 ev i juli, 4 synliga
    { slug: 'kulturbolaget', name: 'Kulturbolaget', city: 'Jönköping' }, // 9 ev i juli, 8 synliga
    { slug: 'malmocityskaters', name: 'Malmö City Skaters', city: 'Lund' }, // 9 ev i juli, 8 synliga
    { slug: 'konstmuseet', name: 'Konstmuseet', city: 'Skövde' }, // 9 ev i juli, 5 synliga
    { slug: 'kalmarnationlund', name: 'Kalmar Nation', city: 'Lund' }, // 9 ev i juli, 6 synliga
    { slug: 'KappaBarMalmo', name: 'Kappa Bar Malmö' }, // 9 ev i juli, 8 synliga
    { slug: 'jkpglm', name: 'Jönköpings läns museum', city: 'Jönköping' }, // 9 ev i juli, 1 synliga
    { slug: 'inrenatur', name: 'Inre natur' }, // 9 ev i juli, 6 synliga
    { slug: 'ideadrottninghog', name: 'Idé A Drottninghög', city: 'Helsingborg' }, // 9 ev i juli, 5 synliga
    { slug: 'Gummifabriken', name: 'Gummifabriken i Värnamo' }, // 9 ev i juli, 8 synliga
    { slug: 'BorasDansforening', name: 'Borås Dansförening', city: 'Borås' }, // 9 ev i juli, 6 synliga
    { slug: 'baerumkulturhus', name: 'Bærum Kulturhus' }, // 9 ev i juli, 7 synliga
    { slug: 'folketsbiomalmo', name: 'Biograf Panora Malmö' }, // 9 ev i juli, 8 synliga
    { slug: 'BibliotekeniKalmarkommun', name: 'Biblioteken i Kalmar kommun', city: 'Kalmar' }, // 9 ev i juli, 8 synliga
    { slug: 'astarscandinavia', name: 'A STAR Entertainment', city: 'Norrköping' }, // 9 ev i juli, 8 synliga
    { slug: 'ArbogaFolketsPark', name: 'Arboga Folkets Park' }, // 9 ev i juli, 8 synliga
    { slug: 'ostgotateatern', name: 'Östgötateatern', city: 'Norrköping' }, // 8 ev i juli, 3 synliga
    { slug: 'WermlandOpera', name: 'Wermland Opera', city: 'Karlstad' }, // 8 ev i juli, 5 synliga
    { slug: 'ostersundsbibliotek', name: 'Östersunds Bibliotek' }, // 8 ev i juli, 8 synliga
    { slug: 'vaxjokommun', name: 'Växjö kommun' }, // 8 ev i juli, 5 synliga
    { slug: 'tingsrydsbibliotekochkultur', name: 'Tingsryds bibliotek och kultur' }, // 8 ev i juli, 4 synliga
    { slug: 'lena.lingensjo', name: 'Söndsvalls damer �', city: 'Sundsvall' }, // 8 ev i juli, 5 synliga
    { slug: 'tangojamt', name: 'TangoJamt' }, // 8 ev i juli, 2 synliga
    { slug: 'Studieframjandetjamtlandharjedalen', name: 'Studiefrämjandet Jämtland/Härjedalen' }, // 8 ev i juli, 5 synliga
    { slug: 'stadshallen', name: 'Stadshallen', city: 'Lund' }, // 8 ev i juli, 6 synliga
    { slug: 'smalandsuppsala', name: 'Smålands nation', city: 'Uppsala' }, // 8 ev i juli, 5 synliga
    { slug: 'Sjoangen', name: 'Sjöängen i Askersund' }, // 8 ev i juli, 5 synliga
    { slug: 'sigtunastiftelsen', name: 'Sigtunastiftelsen' }, // 8 ev i juli, 6 synliga
    { slug: 'sensusvastrasverige', name: 'Sensus Västra Sverige', city: 'Göteborg' }, // 8 ev i juli, 8 synliga
    { slug: 'regionmuseetskane', name: 'Regionmuseet Skåne', city: 'Kristianstad' }, // 8 ev i juli, 4 synliga
    { slug: 'norskamatorteaterforbund', name: 'Norsk Amatørteaterforbund' }, // 8 ev i juli, 8 synliga
    { slug: 'nationalmuseumswe', name: 'Nationalmuseum', city: 'Stockholm' }, // 8 ev i juli, 7 synliga
    { slug: 'reisdegkomikerklubb', name: 'Reis Deg Komikerklubb' }, // 8 ev i juli, 4 synliga
    { slug: 'malmomuseum', name: 'Malmö museum', city: 'Malmö' }, // 8 ev i juli, 7 synliga
    { slug: 'gasasteget', name: 'Lunds Dansklubb Gåsasteget', city: 'Lund' }, // 8 ev i juli, 6 synliga
    { slug: 'lundsallhelgonakyrka', name: 'Lunds Allhelgonakyrka' }, // 8 ev i juli, 4 synliga
    { slug: 'lindblomacademy', name: 'Lindblom Academy Inner Spirit Light', city: 'Västerås' }, // 8 ev i juli, 8 synliga
    { slug: 'jagvagarstuffa', name: 'Jag vågar stuffa', city: 'Karlshamn' }, // 8 ev i juli, 8 synliga
    { slug: 'gospelgiz', name: 'Joy Singers', city: 'Ljungby' }, // 8 ev i juli, 8 synliga
    { slug: 'hyltebiblioteken', name: 'Hyltebiblioteken' }, // 8 ev i juli, 6 synliga
    { slug: 'hjartatshus', name: 'Hjärtats hus', city: 'Jönköping' }, // 8 ev i juli, 6 synliga
    { slug: 'GothenburgSymphonyOrchestra', name: 'Göteborgs Symfoniker' }, // 8 ev i juli, 5 synliga
    { slug: 'fhsater', name: 'Folkets Hus Säter' }, // 8 ev i juli, 7 synliga
    { slug: 'dansinordnya', name: 'Dans i Nord nya', city: 'Gällivare' }, // 8 ev i juli, 8 synliga
    { slug: 'Bibliotekenilulea', name: 'Biblioteken i Luleå' }, // 8 ev i juli, 8 synliga
    { slug: 'barnbiblioteken', name: 'Barnbiblioteken', city: 'Strängnäs' }, // 8 ev i juli, 6 synliga
    { slug: 'ArrangemangLund', name: 'Arrangemang Lund', city: 'Lund' }, // 8 ev i juli, 4 synliga
    { slug: 'avensbylapland', name: 'Avens by Nature / Västerås Reiki Center', city: 'Västerås' }, // 8 ev i juli, 4 synliga
    { slug: 'ungdomsgardentimra', name: 'Aktivitetshuset Pangea' }, // 8 ev i juli, 3 synliga
    { slug: 'ABFKiruna', name: 'ABF Norr Kiruna', city: 'Kiruna' }, // 8 ev i juli, 8 synliga
    { slug: 'angebibliotek', name: 'Ånge centralbibliotek' }, // 7 ev i juli, 6 synliga
    { slug: 'alvsbyn', name: 'Älvsbyn' }, // 7 ev i juli, 8 synliga
    { slug: 'YogaZonBorgholm', name: 'YogaZon' }, // 7 ev i juli, 1 synliga
    { slug: 'vilhelmina.folketshus.7', name: 'Vilhelmina Folkets Hus' }, // 7 ev i juli, 4 synliga
    { slug: 'vaxjoloparklubb', name: 'Växjö Löparklubb' }, // 7 ev i juli, 3 synliga
    { slug: 'vansbrokommun', name: 'Vansbro kommun' }, // 7 ev i juli, 5 synliga
    { slug: 'UppsalaBudoklubb', name: 'Uppsala Budoklubb', city: 'Uppsala' }, // 7 ev i juli, 6 synliga
    { slug: 'varbergsolhall', name: 'Varbergs Ölhall', city: 'Varberg' }, // 7 ev i juli, 3 synliga
    { slug: 'UpplevSkovde', name: 'Upplev Skövde', city: 'Skövde' }, // 7 ev i juli, 2 synliga
    { slug: 'ThePulsebar2023', name: 'The Pulse' }, // 7 ev i juli, 4 synliga
    { slug: 'teaterhalland', name: 'Teater Halland', city: 'Varberg' }, // 7 ev i juli, 4 synliga
    { slug: 'tangovarberg', name: 'Tango Varberg', city: 'Varberg' }, // 7 ev i juli, 3 synliga
    { slug: 'Sundsvallsmuseum', name: 'Sundsvalls museum', city: 'Sundsvall' }, // 7 ev i juli, 4 synliga
    { slug: 'solvesborgcsk', name: 'Stortorget Sölvesborg', city: 'Sölvesborg' }, // 7 ev i juli, 2 synliga
    { slug: 'stfostraskane', name: 'STF Östra Skåne Lokalavdelning', city: 'Kristianstad' }, // 7 ev i juli, 8 synliga
    { slug: 'SanktJohanneskyrka', name: 'Sankt Johannes kyrka, Malmö' }, // 7 ev i juli, 7 synliga
    { slug: 'NiklasStromstedtMusic', name: 'Niklas Strömstedt', city: 'Gävle' }, // 7 ev i juli, 6 synliga
    { slug: 'nbvost', name: 'NBV Öst', city: 'Nyköping' }, // 7 ev i juli, 3 synliga
    { slug: 'nfacademy', name: 'NF Academy' }, // 7 ev i juli, 8 synliga
    { slug: 'moriskapaviljongen', name: 'Moriska Paviljongen' }, // 7 ev i juli, 7 synliga
    { slug: 'malmolive', name: 'Malmö Live' }, // 7 ev i juli, 5 synliga
    { slug: 'lugersweden', name: 'Luger', city: 'Stockholm' }, // 7 ev i juli, 8 synliga
    { slug: 'lommafolketshus', name: 'Lomma Folkets Hus' }, // 7 ev i juli, 4 synliga
    { slug: 'KBASQUARE', name: 'Kungsbacka Square Dancers', city: 'Kungsbacka' }, // 7 ev i juli, 2 synliga
    { slug: 'kulturmagasinetsundsvall', name: 'Kulturmagasinet Sundsvall', city: 'Sundsvall' }, // 7 ev i juli, 8 synliga
    { slug: 'kpdmellerud', name: 'Kulturbruket på Dal' }, // 7 ev i juli, 8 synliga
    { slug: 'klostretiystad', name: 'Klostret i Ystad', city: 'Ystad' }, // 7 ev i juli, 7 synliga
    { slug: 'KSHHealing', name: 'KSH Healing', city: 'Kalmar' }, // 7 ev i juli, 1 synliga
    { slug: 'hotelmolndalsbroochroyrestaurant', name: 'Hotel Mölndals Bro - Roy Restaurant Café & Bar' }, // 7 ev i juli, 8 synliga
    { slug: 'JyskRejsebureau', name: 'Jysk Rejsebureau' }, // 7 ev i juli, 8 synliga
    { slug: 'hagforskulturochbibliotek', name: 'Hagfors kultur och bibliotek' }, // 7 ev i juli, 5 synliga
    { slug: 'hcamarathon', name: 'HCA Marathon' }, // 7 ev i juli, 4 synliga
    { slug: 'gallivarekultur', name: 'Gällivare Kultur', city: 'Gällivare' }, // 7 ev i juli, 2 synliga
    { slug: 'Discaid', name: 'Discaid', city: 'Borlänge' }, // 7 ev i juli, 3 synliga
    { slug: 'DanshusetDkBuggie', name: 'Dansklubben Buggie i Ulricehamn' }, // 7 ev i juli, 4 synliga
    { slug: 'absaloncph', name: 'Absalon' }, // 7 ev i juli, 8 synliga
    { slug: '59anLysekil', name: '59an i Lysekil' }, // 7 ev i juli, 3 synliga
    { slug: 'ostfoldteater', name: 'Østfold Teater' }, // 6 ev i juli, 7 synliga
    { slug: 'ostersundskommun', name: 'Östersunds kommun - Staaren tjïelte' }, // 6 ev i juli, 2 synliga
    { slug: 'folkanteater', name: 'Örnsköldsviks Riksteaterförening' }, // 6 ev i juli, 8 synliga
    { slug: 'ObackaJazz', name: 'Öbacka Jazz&Blues Härnösand', city: 'Härnösand' }, // 6 ev i juli, 8 synliga
    { slug: 'almhultsif', name: 'Älmhults IF' }, // 6 ev i juli, 8 synliga
    { slug: 'yoganatur.se', name: 'YogaNatur' }, // 6 ev i juli, 8 synliga
    { slug: 'VXOevent', name: 'VXO event' }, // 6 ev i juli, 8 synliga
    { slug: 'herrestadsaiffotbollherr', name: 'Undavallen' }, // 6 ev i juli, 8 synliga
    { slug: 'stuckonlive', name: 'Stuck On - Live' }, // 6 ev i juli, 8 synliga
    { slug: 'TeaterDictat', name: 'Teater Dictat' }, // 6 ev i juli, 3 synliga
    { slug: 'swingum400', name: 'Swingum' }, // 6 ev i juli, 5 synliga
    { slug: 'svgavleborg', name: 'Studieförbundet Vuxenskolan Gävleborg', city: 'Gävle' }, // 6 ev i juli, 7 synliga
    { slug: 'sevallabygdegard', name: 'Sevalla Bygdegård', city: 'Västerås' }, // 6 ev i juli, 8 synliga
    { slug: 'naturumblekinge', name: 'Naturum Blekinge', city: 'Ronneby' }, // 6 ev i juli, 4 synliga
    { slug: 'naringslivsoderhamn', name: 'Näringsliv Söderhamns kommun', city: 'Söderhamn' }, // 6 ev i juli, 2 synliga
    { slug: 'mjolbykommun', name: 'Mjölby kommun', city: 'Mjölby' }, // 6 ev i juli, 2 synliga
    { slug: 'mikespubskovde', name: 'Mikes pub och restaurang', city: 'Skövde' }, // 6 ev i juli, 3 synliga
    { slug: 'mediumcamilla', name: 'Medium Camilla', city: 'Linköping' }, // 6 ev i juli, 4 synliga
    { slug: 'medeltidsmuseet', name: 'Medeltidsmuseet' }, // 6 ev i juli, 1 synliga
    { slug: 'mats.fuchs.9', name: 'Mats Fuchs' }, // 6 ev i juli, 1 synliga
    { slug: 'bodyandsoulmovement', name: 'Maria Slättorp - Body & Soul Movement' }, // 6 ev i juli, 4 synliga
    { slug: 'Lakarmissionen', name: 'Läkarmissionen' }, // 6 ev i juli, 3 synliga
    { slug: 'LandskronaBK', name: 'Landskrona Brukshundklubb', city: 'Landskrona' }, // 6 ev i juli, 1 synliga
    { slug: 'konstepidemin', name: 'Konstepidemin' }, // 6 ev i juli, 6 synliga
    { slug: 'borgmastarvilla', name: 'Hotell Humbla', city: 'Sölvesborg' }, // 6 ev i juli, 2 synliga
    { slug: 'inger.ericson.7', name: 'Inger Ericson', city: 'Stockholm' }, // 6 ev i juli, 3 synliga
    { slug: 'ginanykvist', name: 'Hojkompisar Stockholm med omnejd', city: 'Stockholm' }, // 6 ev i juli, 1 synliga
    { slug: 'gretasgothenburg', name: 'Gretas Göteborg', city: 'Göteborg' }, // 6 ev i juli, 6 synliga
    { slug: 'FylgjaHelandeHarmoni', name: 'Fylgja - helande harmoni', city: 'Sundsvall' }, // 6 ev i juli, 8 synliga
    { slug: 'FrokenLarssonHandelsbod', name: 'Fröken Larsson Vintage, Antikt & Secondhand' }, // 6 ev i juli, 2 synliga
    { slug: 'Familjecentralen.Ulricehamn', name: 'Familjecentralen, Öppna förskolan i Ulricehamn' }, // 6 ev i juli, 5 synliga
    { slug: 'energiheaxorna', name: 'Energihäxorna' }, // 6 ev i juli, 4 synliga
    { slug: 'eastvillecomedy', name: 'Event Vesta - KC' }, // 6 ev i juli, 1 synliga
    { slug: 'WheelsOfCarlshamn', name: 'Cykelklubben Wheels Of Carlshamn', city: 'Karlshamn' }, // 6 ev i juli, 1 synliga
    { slug: 'cirkus.klub', name: 'Cirkus' }, // 6 ev i juli, 6 synliga
    { slug: 'Drammensacred', name: 'Drammen Sacred Music Festival' }, // 6 ev i juli, 8 synliga
    { slug: 'brasserietboras', name: 'Brasseriet', city: 'Borås' }, // 6 ev i juli, 4 synliga
    { slug: 'Boras.Stadsteater', name: 'Borås Stadsteater', city: 'Borås' }, // 6 ev i juli, 4 synliga
    { slug: 'Blojupproret', name: 'Blöjupproret, Sveriges förening för EC och tygblöjor', city: 'Lund' }, // 6 ev i juli, 8 synliga
    { slug: 'bergsakers', name: 'Bergsåker', city: 'Sundsvall' }, // 6 ev i juli, 2 synliga
    { slug: 'anebybibliotek', name: 'Aneby bibliotek' }, // 6 ev i juli, 5 synliga
    { slug: 'amplifiedvast', name: 'Amplified Väst', city: 'Borås' }, // 6 ev i juli, 4 synliga
    { slug: 'alexhermanssonshow', name: 'Alex Hermansson', city: 'Lund' }, // 6 ev i juli, 8 synliga
    { slug: 'WoodyWestGbg', name: 'Woody West' }, // 5 ev i juli, 8 synliga
    { slug: 'karlecafe', name: 'karl-e' }, // 5 ev i juli, 6 synliga
    { slug: 'willhemab', name: 'Willhem AB', city: 'Göteborg' }, // 5 ev i juli, 8 synliga
    { slug: 'vindeln', name: 'Vindelns Kommun' }, // 5 ev i juli, 3 synliga
    { slug: 'riksteaternhultsfred', name: 'Valhall Hultsfred' }, // 5 ev i juli, 1 synliga
    { slug: 'varnamocity', name: 'Värnamo City' }, // 5 ev i juli, 3 synliga
    { slug: 'foxfairoak', name: 'The Fox Fair Oak' }, // 5 ev i juli, 8 synliga
    { slug: 'swinginmotionab', name: 'Swing in motion', city: 'Borås' }, // 5 ev i juli, 5 synliga
    { slug: 'spiritofmansweden', name: 'Spirit of Man' }, // 5 ev i juli, 2 synliga
    { slug: 'Studieforbundetbildanord', name: 'Studieförbundet Bilda Nord' }, // 5 ev i juli, 8 synliga
    { slug: 'stockholmghostwalk', name: 'Stockholm Ghost Walk', city: 'Stockholm' }, // 5 ev i juli, 5 synliga
    { slug: 'SkolsimmarnaIK', name: 'Skolsimmarna IK' }, // 5 ev i juli, 3 synliga
    { slug: 'silvenska', name: 'Silvénska villan' }, // 5 ev i juli, 3 synliga
    { slug: 'rfsisuvn', name: 'RF - SISU Västernorrland', city: 'Härnösand' }, // 5 ev i juli, 1 synliga
    { slug: 'quiztyreso', name: 'QUIZ - Tyresö' }, // 5 ev i juli, 1 synliga
    { slug: 'obosisverige', name: 'OBOS i Sverige' }, // 5 ev i juli, 2 synliga
    { slug: 'northcreativenodes', name: 'North Creative Nodes', city: 'Boden' }, // 5 ev i juli, 4 synliga
    { slug: 'Nostalgiklubben', name: 'Nostalgiklubben' }, // 5 ev i juli, 7 synliga
    { slug: 'nordiskakammarorkestern', name: 'Nordiska Kammarorkestern', city: 'Sundsvall' }, // 5 ev i juli, 5 synliga
    { slug: 'NorrlandTulpaner', name: 'Norrlands Tulpan Trädgård', city: 'Hudiksvall' }, // 5 ev i juli, 6 synliga
    { slug: 'NaturumVattenriket', name: 'Naturum Vattenriket', city: 'Kristianstad' }, // 5 ev i juli, 3 synliga
    { slug: '1mr.langos', name: 'Mr.Lángos', city: 'Uppsala' }, // 5 ev i juli, 2 synliga
    { slug: 'nkvillan.nyk', name: 'NK-villan', city: 'Nyköping' }, // 5 ev i juli, 2 synliga
    { slug: 'lundchoralfestival.lcf', name: 'Lund Choral Festival', city: 'Lund' }, // 5 ev i juli, 8 synliga
    { slug: 'livenationswe', name: 'Live Nation Sweden' }, // 5 ev i juli, 7 synliga
    { slug: 'Kungalvsparken', name: 'Kungälvs Parken', city: 'Trollhättan' }, // 5 ev i juli, 8 synliga
    { slug: 'landskronasurfcenter', name: 'Landskrona SurfCenter', city: 'Landskrona' }, // 5 ev i juli, 2 synliga
    { slug: 'mittlandplus', name: 'Kultur i Ånge Kommun' }, // 5 ev i juli, 8 synliga
    { slug: 'kristianstadskommun', name: 'Kristianstads kommun', city: 'Kristianstad' }, // 5 ev i juli, 1 synliga
    { slug: 'konstframjandet.skane', name: 'Konstfrämjandet Skåne' }, // 5 ev i juli, 5 synliga
    { slug: 'Ifoodfestival', name: 'International Food Festival', city: 'Göteborg' }, // 5 ev i juli, 2 synliga
    { slug: 'icfalkenberg', name: 'IC Falkenberg', city: 'Falkenberg' }, // 5 ev i juli, 5 synliga
    { slug: 'hypoteket', name: 'HYPOTEKET', city: 'Lund' }, // 5 ev i juli, 4 synliga
    { slug: 'HotellHulingen', name: 'Hotell Hulingen' }, // 5 ev i juli, 8 synliga
    { slug: 'GrastorpsBygdegardsforening', name: 'Grästorps Bygdegårdsförening' }, // 5 ev i juli, 5 synliga
    { slug: 'gellerasenkarlskoga', name: 'Gelleråsen, Karlskoga' }, // 5 ev i juli, 3 synliga
    { slug: 'foreningensm', name: 'Föreningen Söderhamns Museum', city: 'Söderhamn' }, // 5 ev i juli, 2 synliga
    { slug: 'fulloflife.tantra', name: 'Full of Life' }, // 5 ev i juli, 2 synliga
    { slug: 'Falkopingsbibliotek', name: 'Falköpings bibliotek' }, // 5 ev i juli, 4 synliga
    { slug: 'ericbergstroom', name: 'Eric Bergström', city: 'Jönköping' }, // 5 ev i juli, 3 synliga
    { slug: 'dansofolkton', name: 'Dans & Folkton' }, // 5 ev i juli, 8 synliga
    { slug: 'vasterascity', name: 'Carlsson På Kajen', city: 'Västerås' }, // 5 ev i juli, 8 synliga
    { slug: 'forumbiblioteken', name: 'Forumbiblioteken i Nacka' }, // 5 ev i juli, 2 synliga
    { slug: 'CirkusStavanger', name: 'CIRKUS' }, // 5 ev i juli, 5 synliga
    { slug: 'borjessonsbil', name: 'Börjessons Bil', city: 'Karlshamn' }, // 5 ev i juli, 8 synliga
    { slug: 'arttourssthlm', name: 'Art Tours Sthlm', city: 'Stockholm' }, // 5 ev i juli, 4 synliga
    { slug: 'haningebibliotek', name: 'Biblioteken i Haninge' }, // 5 ev i juli, 5 synliga
    { slug: 'arbogabio', name: 'Arboga bio' }, // 5 ev i juli, 1 synliga
    { slug: 'arenahagmyren', name: 'Arena Hagmyren', city: 'Hudiksvall' }, // 5 ev i juli, 5 synliga
    { slug: 'alltidtjorn', name: 'Alltid Tjörn' }, // 5 ev i juli, 3 synliga
    { slug: 'oviklatinodans', name: 'Övik Latinodans' }, // 4 ev i juli, 4 synliga
    { slug: 'StreetRollerHockeyLeague', name: 'https://www.facebook.com/share/g/', city: 'Eslöv' }, // 4 ev i juli, 1 synliga
    { slug: 'ostgotamusiken', name: 'Östgötamusiken', city: 'Linköping' }, // 4 ev i juli, 8 synliga
    { slug: 'Levochmaval', name: 'ViveVale', city: 'Lund' }, // 4 ev i juli, 2 synliga
    { slug: 'Vindelnskommunbibliotek', name: 'Vindelns kommunbibliotek' }, // 4 ev i juli, 3 synliga
    { slug: 'vedeldspizzan', name: 'Vedeldspizzan', city: 'Göteborg' }, // 4 ev i juli, 2 synliga
    { slug: 'uppsalakammarorkester', name: 'Uppsala Kammarorkester', city: 'Uppsala' }, // 4 ev i juli, 8 synliga
    { slug: 'Upplandsmuseet', name: 'Upplandsmuseet', city: 'Uppsala' }, // 4 ev i juli, 7 synliga
    { slug: 'meraloppis', name: 'Ulf Andersson' }, // 4 ev i juli, 3 synliga
    { slug: 'tunapark.se', name: 'Tuna Park', city: 'Eskilstuna' }, // 4 ev i juli, 2 synliga
    { slug: 'TormekSharpeningInnovation', name: 'Tormek', city: 'Lindesberg' }, // 4 ev i juli, 2 synliga
    { slug: 'toccaentertainment', name: 'Tocca Entertainment', city: 'Västerås' }, // 4 ev i juli, 8 synliga
    { slug: 'tobbetrollkarl', name: 'Tobbe Trollkarl', city: 'Borlänge' }, // 4 ev i juli, 8 synliga
    { slug: 'svartebyalag', name: 'Svarte' }, // 4 ev i juli, 2 synliga
    { slug: 'Transportnorrbotten', name: 'Svenska Transportarbetareförbundet Avdelning 26', city: 'Kiruna' }, // 4 ev i juli, 8 synliga
    { slug: 'skovdeaik', name: 'Skövde AIK', city: 'Skövde' }, // 4 ev i juli, 1 synliga
    { slug: 'skarahf', name: 'Skara HF' }, // 4 ev i juli, 2 synliga
    { slug: 'SalemStavanger', name: 'Salem Stavanger' }, // 4 ev i juli, 8 synliga
    { slug: 'spkroslagssektionen', name: 'SPK Svenska Pudelklubbens Roslagssektion', city: 'Norrtälje' }, // 4 ev i juli, 6 synliga
    { slug: 'sagabioflen', name: 'Saga Bio, Flen' }, // 4 ev i juli, 1 synliga
    { slug: 'miguel.delgado.3998', name: 'SALSA i VARBERG', city: 'Varberg' }, // 4 ev i juli, 2 synliga
    { slug: 'rimboprastgard', name: 'Rimbo Prästgård' }, // 4 ev i juli, 5 synliga
    { slug: 'pinkprogramming', name: 'Pink Programming' }, // 4 ev i juli, 3 synliga
    { slug: 'pifdam', name: 'PIF Damfotboll' }, // 4 ev i juli, 8 synliga
    { slug: 'nordboetnorrkoping', name: 'Nördboet', city: 'Norrköping' }, // 4 ev i juli, 8 synliga
    { slug: 'norrvikenbastad', name: 'Norrviken' }, // 4 ev i juli, 2 synliga
    { slug: 'nordicsociety.org', name: 'Nordic society', city: 'Stockholm' }, // 4 ev i juli, 4 synliga
    { slug: 'musikilerum', name: 'Musik i Lerum' }, // 4 ev i juli, 2 synliga
    { slug: 'mastersgalleri', name: 'Mästers Galleri - SKHF Skurupsbygdens konst- och hantverksförening' }, // 4 ev i juli, 1 synliga
    { slug: 'LottasOmtanke', name: 'Lottas Omtanke', city: 'Oskarshamn' }, // 4 ev i juli, 2 synliga
    { slug: 'lommaflotten', name: 'LommaFlotten' }, // 4 ev i juli, 2 synliga
    { slug: 'lisebergab', name: 'Liseberg' }, // 4 ev i juli, 4 synliga
    { slug: 'Bonanderfriskvard', name: 'Lena Bonanders Massage & Friskvård', city: 'Uddevalla' }, // 4 ev i juli, 4 synliga
    { slug: 'klingsbergsforlagab', name: 'Klingsbergs Förlag AB', city: 'Norrköping' }, // 4 ev i juli, 1 synliga
    { slug: 'kbwestgbg', name: 'KB West' }, // 4 ev i juli, 8 synliga
    { slug: 'jonkopingcity', name: 'Jönköping City', city: 'Jönköping' }, // 4 ev i juli, 8 synliga
    { slug: 'municipiodefaro', name: 'Jardim da Alameda' }, // 4 ev i juli, 7 synliga
    { slug: 'michael.haggmark.1', name: 'JLS Jämtlands Lokalhistoriker och Släktforskare' }, // 4 ev i juli, 3 synliga
    { slug: 'IFKKristianstad', name: 'IFK Kristianstad', city: 'Kristianstad' }, // 4 ev i juli, 8 synliga
    { slug: 'huddingeparkrun', name: 'Huddinge Parkrun' }, // 4 ev i juli, 8 synliga
    { slug: 'gnestakommun', name: 'Gnesta kommun', city: 'Strängnäs' }, // 4 ev i juli, 2 synliga
    { slug: 'gnosjobibliotek', name: 'Gnosjö kultur & bibliotek' }, // 4 ev i juli, 1 synliga
    { slug: 'frirumsandviken', name: 'Frirum Sandviken', city: 'Sandviken' }, // 4 ev i juli, 1 synliga
    { slug: 'hovmantorps.folketshus', name: 'Folkbiografen Hovmantorp' }, // 4 ev i juli, 4 synliga
    { slug: 'drakenlive', name: 'Draken Live' }, // 4 ev i juli, 7 synliga
    { slug: 'doroteabibliotek', name: 'Dorotea bibliotek / Kraapohken gærjagåetie' }, // 4 ev i juli, 8 synliga
    { slug: 'dragonflystudioavesta', name: 'Dragonfly Studio' }, // 4 ev i juli, 2 synliga
    { slug: 'Dansalliansen', name: 'Dansalliansen' }, // 4 ev i juli, 3 synliga
    { slug: 'cirkusmuseet', name: 'Cirkusmuseet' }, // 4 ev i juli, 2 synliga
    { slug: 'clarionsundsvall', name: 'Clarion Hotel Sundsvall', city: 'Sundsvall' }, // 4 ev i juli, 3 synliga
    { slug: 'cafehelaideella', name: 'Café HELA ideella Landskrona', city: 'Landskrona' }, // 4 ev i juli, 8 synliga
    { slug: 'charlottepolsonkonsert', name: 'Charlotte Polson - konsert', city: 'Ljungby' }, // 4 ev i juli, 2 synliga
    { slug: 'brygganangelholm', name: 'Bryggan Kök & Bar' }, // 4 ev i juli, 4 synliga
    { slug: 'boulognerskogenparkrun', name: 'Boulognerskogen parkrun, Gävle', city: 'Gävle' }, // 4 ev i juli, 5 synliga
    { slug: 'boca.vasteras', name: 'Boca Västerås', city: 'Västerås' }, // 4 ev i juli, 2 synliga
    { slug: 'MuseetBollnasKonsthall', name: 'Bollnäs Museum & Konsthall' }, // 4 ev i juli, 2 synliga
    { slug: 'biokontrastiggesund', name: 'Bio Kontrast - Folkets Hus Iggesund' }, // 4 ev i juli, 2 synliga
    { slug: 'backa.teater', name: 'Backa Teater' }, // 4 ev i juli, 3 synliga
    { slug: 'annkiochklas', name: 'Annki & Klas' }, // 4 ev i juli, 3 synliga
    { slug: 'AlingsasHK', name: 'Alingsås HK', city: 'Alingsås' }, // 4 ev i juli, 1 synliga
    { slug: 'AlingsasDansklubb', name: 'Alingsås Dansklubb', city: 'Alingsås' }, // 4 ev i juli, 4 synliga
    { slug: 'alexeklundofficial', name: 'Alex Eklund', city: 'Eskilstuna' }, // 4 ev i juli, 7 synliga
    { slug: 'VisbyRoma', name: 'Visby Roma Hockey', city: 'Visby' }, // 3 ev i juli, 1 synliga
    { slug: 'villalidkopingbk', name: 'Villa Lidköping BK', city: 'Lidköping' }, // 3 ev i juli, 8 synliga
    { slug: 'TyresoRoyalCrowns', name: 'Tyresö Royal Crowns' }, // 3 ev i juli, 8 synliga
    { slug: 'jansvenssontrubadur', name: 'Trubadur Jan Svensson Musik Produktion', city: 'Uddevalla' }, // 3 ev i juli, 8 synliga
    { slug: 'dalarodyksallskap', name: 'Torvalla sporthall' }, // 3 ev i juli, 8 synliga
    { slug: 'tranemo.bibliotek', name: 'Tranemo bibliotek' }, // 3 ev i juli, 4 synliga
    { slug: 'TibroRF', name: 'Tibro Ryttarförening' }, // 3 ev i juli, 1 synliga
    { slug: 'Thimouryoga', name: 'Thimour Yoga', city: 'Borås' }, // 3 ev i juli, 2 synliga
    { slug: 'tasspalatset.se', name: 'Tasspalatset' }, // 3 ev i juli, 7 synliga
    { slug: 'soderbarkeparken', name: 'Söderbärkeparken' }, // 3 ev i juli, 4 synliga
    { slug: 'syfestivalen', name: 'Sy- & Hantverksfestivalen - mässan för kreativa sinnen' }, // 3 ev i juli, 1 synliga
    { slug: 'studiomalinfredrika', name: 'Studio Malin Fredrika', city: 'Kristinehamn' }, // 3 ev i juli, 1 synliga
    { slug: 'svinorrabohuslan', name: 'Studieförbundet Vuxenskolan i Norra Bohuslän' }, // 3 ev i juli, 8 synliga
    { slug: 'streetfoodskandinavia', name: 'Street Food Skandinavia' }, // 3 ev i juli, 8 synliga
    { slug: 'stockholmsmarknader', name: 'Stockholmsmarknader' }, // 3 ev i juli, 4 synliga
    { slug: 'svkalingsas', name: 'Stora Torget Alingsås', city: 'Alingsås' }, // 3 ev i juli, 8 synliga
    { slug: 'stenhusetgille', name: 'Stenhuset' }, // 3 ev i juli, 6 synliga
    { slug: 'spokguiden', name: 'Spökguiden' }, // 3 ev i juli, 3 synliga
    { slug: 'SpangaHockey', name: 'Spånga Hockey' }, // 3 ev i juli, 1 synliga
    { slug: 'sportsonvasagatan', name: 'Sportson', city: 'Göteborg' }, // 3 ev i juli, 2 synliga
    { slug: 'SoulRelax.Motala', name: 'SoulRelax', city: 'Motala' }, // 3 ev i juli, 2 synliga
    { slug: 'situpcomedy', name: 'Sit-up comedy show' }, // 3 ev i juli, 4 synliga
    { slug: 'Siggenfriends', name: 'Sigge n Friends' }, // 3 ev i juli, 8 synliga
    { slug: 'seniortraffen', name: 'Seniorträffen, Oxelösund' }, // 3 ev i juli, 5 synliga
    { slug: 'sarakulturhus', name: 'Sara kulturhus' }, // 3 ev i juli, 5 synliga
    { slug: 'SsdkKarlshamn', name: 'SSDK Karlshamn', city: 'Karlshamn' }, // 3 ev i juli, 1 synliga
    { slug: 'kristina.blad', name: 'SHETLAND MITT' }, // 3 ev i juli, 1 synliga
    { slug: 'satssverige', name: 'SATS Sverige', city: 'Helsingborg' }, // 3 ev i juli, 4 synliga
    { slug: 'uddevalla.riksteaterforening', name: 'Regionteater Väst' }, // 3 ev i juli, 3 synliga
    { slug: 'rfsisu.norrbotten', name: 'RF' }, // 3 ev i juli, 1 synliga
    { slug: 'pitea.se', name: 'Piteå kommun' }, // 3 ev i juli, 8 synliga
    { slug: 'RAWcomedyclub', name: 'RAW comedy club', city: 'Stockholm' }, // 3 ev i juli, 8 synliga
    { slug: 'poffertjes.se', name: 'Poffertjes.se' }, // 3 ev i juli, 8 synliga
    { slug: 'nojeskompanietmorrum', name: 'Nöjeskompaniet', city: 'Hässleholm' }, // 3 ev i juli, 1 synliga
    { slug: 'NojetKonsert', name: 'Nöjet Konsert AB', city: 'Västerås' }, // 3 ev i juli, 8 synliga
    { slug: 'naringslivmonsteraskommun', name: 'Näringsliv Mönsterås kommun' }, // 3 ev i juli, 3 synliga
    { slug: 'MotalaBasket', name: 'Motala Basket - W72', city: 'Motala' }, // 3 ev i juli, 2 synliga
    { slug: 'nfharnosand', name: 'Naturskyddsföreningen Härnösand', city: 'Härnösand' }, // 3 ev i juli, 1 synliga
    { slug: 'Mordmysterium', name: 'Mordmysterium' }, // 3 ev i juli, 6 synliga
    { slug: 'MariaSandelsallskapet', name: 'Maria Sandel' }, // 3 ev i juli, 1 synliga
    { slug: 'MusikcentrumVast', name: 'MCV - Musikcentrum Väst' }, // 3 ev i juli, 8 synliga
    { slug: 'liverestaurangen', name: 'Luleå Energi Arena' }, // 3 ev i juli, 8 synliga
    { slug: 'ovewenchelarsuno', name: 'Ljungby', city: 'Ljungby' }, // 3 ev i juli, 8 synliga
    { slug: 'lidingostadnaringsliv', name: 'Lidingö stad näringsliv' }, // 3 ev i juli, 1 synliga
    { slug: 'theshipchristchurch', name: 'Laughing Bellys' }, // 3 ev i juli, 8 synliga
    { slug: 'kungalvskommun', name: 'Kungälvs kommun' }, // 3 ev i juli, 1 synliga
    { slug: 'LandskronaFoto', name: 'Landskrona Foto', city: 'Landskrona' }, // 3 ev i juli, 8 synliga
    { slug: 'kulturitranemo', name: 'Kultur i Tranemo' }, // 3 ev i juli, 8 synliga
    { slug: 'kristnaregnbagsrorelsen', name: 'Kristna regnbågsrörelsen - Riksförbundet EKHO', city: 'Göteborg' }, // 3 ev i juli, 3 synliga
    { slug: 'kulturonoje', name: 'Kim Kultur&Nöje', city: 'Norrtälje' }, // 3 ev i juli, 3 synliga
    { slug: 'fastningsmuseet', name: 'Karlsborgs Fästningsmuseum' }, // 3 ev i juli, 5 synliga
    { slug: 'katalin.uppsala', name: 'Katalin And All That Jazz Östra Station' }, // 3 ev i juli, 8 synliga
    { slug: 'kraniosakralterapihastochmanniska', name: 'Jennies HelhetsHälsa' }, // 3 ev i juli, 1 synliga
    { slug: 'kalix.bibliotek', name: 'Kalix Bibliotek' }, // 3 ev i juli, 4 synliga
    { slug: 'Huddingekommun', name: 'Huddinge kommun' }, // 3 ev i juli, 8 synliga
    { slug: 'boltic', name: 'IF Boltic', city: 'Karlstad' }, // 3 ev i juli, 1 synliga
    { slug: 'JTTEventsLtd', name: 'JTT Events' }, // 3 ev i juli, 1 synliga
    { slug: 'HotellHavanna', name: 'Hotell Havanna', city: 'Varberg' }, // 3 ev i juli, 3 synliga
    { slug: 'hedemorafolketspark', name: 'Hedemora Folkets Park' }, // 3 ev i juli, 8 synliga
    { slug: 'gamlahalmstad', name: 'Gamla Halmstad', city: 'Halmstad' }, // 3 ev i juli, 6 synliga
    { slug: 'Glimmingehus', name: 'Glimmingehus' }, // 3 ev i juli, 3 synliga
    { slug: 'Furuviksparken', name: 'Furuviksparken' }, // 3 ev i juli, 2 synliga
    { slug: 'fjarasaik', name: 'Fjärås AIK, FAIK' }, // 3 ev i juli, 8 synliga
    { slug: 'fhuddevalla', name: 'Folkets Hus Uddevalla', city: 'Uddevalla' }, // 3 ev i juli, 7 synliga
    { slug: 'fernandascafeet', name: 'Fernandas Konditori & Bageri', city: 'Staffanstorp' }, // 3 ev i juli, 1 synliga
    { slug: 'filmfestsundsvall', name: 'Filmfest Sundsvall', city: 'Sundsvall' }, // 3 ev i juli, 8 synliga
    { slug: 'Faluguide', name: 'Faluguide', city: 'Falun' }, // 3 ev i juli, 8 synliga
    { slug: 'ekobutikosterlen', name: 'Fairys & Friends Ekohandel' }, // 3 ev i juli, 1 synliga
    { slug: 'europadirektvasternorrland', name: 'Europa Direkt Västernorrland' }, // 3 ev i juli, 6 synliga
    { slug: 'fagerstascouterna', name: 'Fagersta Scoutkår' }, // 3 ev i juli, 8 synliga
    { slug: 'caferosenhill', name: 'Café Rosenhill' }, // 3 ev i juli, 1 synliga
    { slug: 'cufskaane', name: 'CUF Skåne' }, // 3 ev i juli, 8 synliga
    { slug: 'ckwano1', name: 'CK Wano', city: 'Varberg' }, // 3 ev i juli, 1 synliga
    { slug: 'bradspelskafeet', name: 'Brädspelskaféet', city: 'Karlshamn' }, // 3 ev i juli, 3 synliga
    { slug: 'bohusfastning', name: 'Bohus Fästning' }, // 3 ev i juli, 7 synliga
    { slug: 'borlangekommun', name: 'Borlänge kommun', city: 'Borlänge' }, // 3 ev i juli, 1 synliga
    { slug: '61563974404293', name: 'Blå Elefanten' }, // 3 ev i juli, 3 synliga
    { slug: 'bibliotekljusdal', name: 'Biblioteket I Ljusdal' }, // 3 ev i juli, 4 synliga
    { slug: 'betlehemskyrkan', name: 'Betlehemskyrkan' }, // 3 ev i juli, 8 synliga
    { slug: 'befreenow.se', name: 'Befreenow' }, // 3 ev i juli, 4 synliga
    { slug: 'beehivestationfoodcarts', name: 'BeeHive Station Food Pod' }, // 3 ev i juli, 5 synliga
    { slug: 'babblarnalive', name: 'Babblarna på scen', city: 'Uppsala' }, // 3 ev i juli, 4 synliga
    { slug: 'abfmalmo', name: 'ABF Malmö' }, // 3 ev i juli, 8 synliga
    { slug: 'abfnorrkalix', name: 'ABF Norr Kalix' }, // 3 ev i juli, 3 synliga
    { slug: 'aterstallvatmarker', name: 'Återställ Våtmarker', city: 'Visby' }, // 2 ev i juli, 1 synliga
    { slug: 'Astorpskommun', name: 'Åstorps kommun' }, // 2 ev i juli, 3 synliga
    { slug: 'naturumSkrylle', name: 'naturum Skrylle' }, // 2 ev i juli, 4 synliga
    { slug: 'ColdFusionComedy', name: 'https://linktr.ee/Coldfusioncomedy' }, // 2 ev i juli, 2 synliga
    { slug: 'yogaheart.nu', name: 'Yogaheart' }, // 2 ev i juli, 2 synliga
    { slug: 'yogaskolan.ostersund', name: 'Yogaskolan Östersund' }, // 2 ev i juli, 8 synliga
    { slug: 'yoga121.se', name: 'Yoga 121', city: 'Hudiksvall' }, // 2 ev i juli, 4 synliga
    { slug: 'winterviken', name: 'Winterviken', city: 'Stockholm' }, // 2 ev i juli, 4 synliga
    { slug: 'studieframjandetmusikuppsala', name: 'Walmstedtska Gården' }, // 2 ev i juli, 8 synliga
    { slug: 'wafabbil', name: 'Wafab Bil', city: 'Arvika' }, // 2 ev i juli, 3 synliga
    { slug: 'vatterhemofficiell', name: 'Vätterhem', city: 'Jönköping' }, // 2 ev i juli, 8 synliga
    { slug: 'vnmuseum', name: 'Västernorrlands museum', city: 'Härnösand' }, // 2 ev i juli, 5 synliga
    { slug: 'vasbybk', name: 'Väsby Brukshundsklubb' }, // 2 ev i juli, 8 synliga
    { slug: 'vikkysKonst', name: 'Vikkys Konst', city: 'Linköping' }, // 2 ev i juli, 2 synliga
    { slug: 'Voories1951', name: 'Voorbereidingskool George Preparatory School' }, // 2 ev i juli, 4 synliga
    { slug: 'everypadelkopparlunden', name: 'Vamos Padel' }, // 2 ev i juli, 4 synliga
    { slug: 'vardagibalans', name: 'Vardag i Balans', city: 'Lund' }, // 2 ev i juli, 2 synliga
    { slug: 'trailtourumea', name: 'Umeå Trail' }, // 2 ev i juli, 8 synliga
    { slug: 'umeadansklubb', name: 'Umeå Dansklubb' }, // 2 ev i juli, 2 synliga
    { slug: 'uddevallahem', name: 'Uddevallahem', city: 'Uddevalla' }, // 2 ev i juli, 8 synliga
    { slug: 'seductionexcursions', name: 'Tyresö kommun, Stockholms län' }, // 2 ev i juli, 8 synliga
    { slug: 'tradgarn', name: 'Trädgår\'n' }, // 2 ev i juli, 8 synliga
    { slug: 'torsebrosvamp', name: 'Torsebro Svamp', city: 'Kristianstad' }, // 2 ev i juli, 8 synliga
    { slug: 'naasdk', name: 'Tingshuset Lerum' }, // 2 ev i juli, 2 synliga
    { slug: 'TornsIF', name: 'Torns IF', city: 'Lund' }, // 2 ev i juli, 8 synliga
    { slug: 'timraik.se', name: 'Timrå IK' }, // 2 ev i juli, 1 synliga
    { slug: 'tillsammansforkumla', name: 'Tillsammans för Kumla' }, // 2 ev i juli, 8 synliga
    { slug: 'thabelatravel', name: 'Thabela Travel' }, // 2 ev i juli, 8 synliga
    { slug: 'tgsportbar', name: 'TG Sportbar & Restaurang', city: 'Staffanstorp' }, // 2 ev i juli, 8 synliga
    { slug: 'Sormlandsmuseum', name: 'Sörmlands museum', city: 'Nyköping' }, // 2 ev i juli, 6 synliga
    { slug: 'sodrahalsinglandstradgardsodlareforening', name: 'Södra Hälsinglands Trädgårdsodlareförening', city: 'Söderhamn' }, // 2 ev i juli, 2 synliga
    { slug: 'soderhamnsbibblan', name: 'Söderhamns Stadsbibliotek', city: 'Söderhamn' }, // 2 ev i juli, 6 synliga
    { slug: 'sundsbysateri', name: 'Sundsby Säteri' }, // 2 ev i juli, 2 synliga
    { slug: 'studieforbundet.vilhelmina', name: 'Studieförbundet Vuxenskolan Vilhelmina' }, // 2 ev i juli, 6 synliga
    { slug: '5071puben', name: 'Standupkunst' }, // 2 ev i juli, 1 synliga
    { slug: 'royal.roland.5623', name: 'SoundTrack Roland' }, // 2 ev i juli, 2 synliga
    { slug: 'sommarparadisetsandviken', name: 'Sommarparadiset Sandviken', city: 'Sandviken' }, // 2 ev i juli, 8 synliga
    { slug: 'sollentunakommun', name: 'Sollentuna kommun' }, // 2 ev i juli, 5 synliga
    { slug: 'lindasolacer', name: 'Solacer' }, // 2 ev i juli, 1 synliga
    { slug: 'skovdeyogacentrum', name: 'Skövde YogaCentrum', city: 'Skövde' }, // 2 ev i juli, 2 synliga
    { slug: 'Snapphanarnasrf', name: 'Snapphanarnas Ryttarförening', city: 'Sölvesborg' }, // 2 ev i juli, 8 synliga
    { slug: 'SkogsbadiStockholm', name: 'Skogsbad i Stockholm', city: 'Stockholm' }, // 2 ev i juli, 1 synliga
    { slug: 'skanskabyggvaror', name: 'Skånska Byggvaror', city: 'Göteborg' }, // 2 ev i juli, 8 synliga
    { slug: 'skistarsverige', name: 'SkiStar', city: 'Helsingborg' }, // 2 ev i juli, 8 synliga
    { slug: 'skelleftea', name: 'Skellefteå kommun' }, // 2 ev i juli, 1 synliga
    { slug: 'SensusOstersund', name: 'Sensus Östersund' }, // 2 ev i juli, 8 synliga
    { slug: 'seniorikungsbacka', name: 'Senior i Kungsbacka', city: 'Kungsbacka' }, // 2 ev i juli, 8 synliga
    { slug: 'selangerskyrka', name: 'Selångers Kyrka', city: 'Sundsvall' }, // 2 ev i juli, 8 synliga
    { slug: 'scenklart', name: 'Scenklart' }, // 2 ev i juli, 3 synliga
    { slug: 'Salemcover', name: 'Salem 2.0' }, // 2 ev i juli, 8 synliga
    { slug: 'SalongJL', name: 'Salong JL' }, // 2 ev i juli, 8 synliga
    { slug: 'sagateaterboras', name: 'Sagateatern', city: 'Borås' }, // 2 ev i juli, 8 synliga
    { slug: 'SagasIslandshastar', name: 'Sagas Íshestar' }, // 2 ev i juli, 8 synliga
    { slug: 'raadalensbk', name: 'Råådalens Brukshundklubb', city: 'Helsingborg' }, // 2 ev i juli, 8 synliga
    { slug: 'rehnsbk', name: 'Rehns BK' }, // 2 ev i juli, 8 synliga
    { slug: 'punkfestsoderhamn', name: 'Punkfest Söderhamn', city: 'Söderhamn' }, // 2 ev i juli, 1 synliga
    { slug: 'pustervik', name: 'Pustervik' }, // 2 ev i juli, 8 synliga
    { slug: 'petra.kvanna', name: 'Petra Kvännå', city: 'Göteborg' }, // 2 ev i juli, 1 synliga
    { slug: 'parkenkulturhus', name: 'Parken kulturhus' }, // 2 ev i juli, 7 synliga
    { slug: 'paula.gocko', name: 'Paula Gocko' }, // 2 ev i juli, 1 synliga
    { slug: 'CDMortenSteen', name: 'PADI Course Director Morten Steen' }, // 2 ev i juli, 8 synliga
    { slug: 'oslonye', name: 'Oslo Nye Teater' }, // 2 ev i juli, 8 synliga
    { slug: 'Nightcruiserskristinehamn', name: 'Nightcruisers Kristinehamn', city: 'Kristinehamn' }, // 2 ev i juli, 8 synliga
    { slug: 'nykopings.folkhogskola', name: 'Nyköpings Folkhögskola', city: 'Nyköping' }, // 2 ev i juli, 8 synliga
    { slug: 'kavlingeoldtimespub', name: 'Old Times Pub' }, // 2 ev i juli, 5 synliga
    { slug: 'nackalokalhistoriska', name: 'Nacka lokalhistoriska arkiv' }, // 2 ev i juli, 1 synliga
    { slug: 'naturskyddsforeningenigoteborg', name: 'Naturskyddsföreningen i Göteborg', city: 'Göteborg' }, // 2 ev i juli, 7 synliga
    { slug: 'NalenStockholm', name: 'Nalen', city: 'Stockholm' }, // 2 ev i juli, 7 synliga
    { slug: 'mollerstivoli', name: 'Möllers Tivoli' }, // 2 ev i juli, 8 synliga
    { slug: 'Myresjohus', name: 'Myresjöhus' }, // 2 ev i juli, 1 synliga
    { slug: 'musikisydmalmo', name: 'Musik i Syd Malmö' }, // 2 ev i juli, 8 synliga
    { slug: 'mormorsgruvan', name: 'Mormorsgruvans byalag' }, // 2 ev i juli, 8 synliga
    { slug: 'hotellmullsjo', name: 'Mullsjö Hotell & Konferens' }, // 2 ev i juli, 8 synliga
    { slug: 'monovaxjo', name: 'Mono Växjö' }, // 2 ev i juli, 8 synliga
    { slug: 'Molekylverkstan', name: 'Molekylverkstan' }, // 2 ev i juli, 7 synliga
    { slug: 'mrckarlstad', name: 'Mikkeller Running Club Karlstad', city: 'Karlstad' }, // 2 ev i juli, 1 synliga
    { slug: 'M.Dans.F', name: 'Mer Dans åt Folket', city: 'Eskilstuna' }, // 2 ev i juli, 1 synliga
    { slug: '61579262192859', name: 'Mellanrummet' }, // 2 ev i juli, 2 synliga
    { slug: 'mashupberlin', name: 'Mash-Up - Multigender / Multiworld' }, // 2 ev i juli, 4 synliga
    { slug: 'MatoNostalgi', name: 'Mat & Nostalgi i Viksjö' }, // 2 ev i juli, 8 synliga
];
