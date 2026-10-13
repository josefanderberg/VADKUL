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
    { slug: 'Livescenscandinaviaab', name: 'Visit Örebro' }, // 134 ev i juli, 7 synliga
    { slug: 'LiveEventRadar', name: 'Live Event Radar' }, // 94 ev i juli, 8 synliga
    { slug: 'vaxjobibliotek', name: 'Växjö bibliotek' }, // 65 ev i juli, 8 synliga
    { slug: 'nieuscene', name: 'Nieu Torshov' }, // 63 ev i juli, 7 synliga
    { slug: 'StudieforbundetVuxenskolanVast', name: 'Studieförbundet Vuxenskolan Väst', city: 'Uddevalla' }, // 46 ev i juli, 6 synliga
    { slug: 'stadsbiblioteketgbg', name: 'Göteborgs stadsbibliotek' }, // 44 ev i juli, 7 synliga
    { slug: 'eventkalix', name: 'Kalix Kommun', city: 'Luleå' }, // 42 ev i juli, 7 synliga
    { slug: 'kulturaktiebolaget', name: 'Kulturaktiebolaget', city: 'Karlstad' }, // 40 ev i juli, 8 synliga
    { slug: 'studioexpress.se', name: 'Studioexpress.se', city: 'Lund' }, // 38 ev i juli, 8 synliga
    { slug: 'KulturcentrumSandviken', name: 'Kulturcentrum Sandviken', city: 'Sandviken' }, // 38 ev i juli, 6 synliga
    { slug: 'ABFsorm', name: 'ABF Sörmland', city: 'Eskilstuna' }, // 34 ev i juli, 8 synliga
    { slug: 'hundesenteretitrondheim', name: 'Hundesenteret' }, // 33 ev i juli, 8 synliga
    { slug: 'Honggymnastikforening', name: 'Høng GF' }, // 31 ev i juli, 8 synliga
    { slug: 'Vaxjodyksport', name: 'Växjödyksport', city: 'Växjö' }, // 31 ev i juli, 8 synliga
    { slug: 'Megascope', name: 'Megascope' }, // 30 ev i juli, 8 synliga
    { slug: 'svdalsland', name: 'Studieförbundet Vuxenskolan i Dalsland' }, // 29 ev i juli, 8 synliga
    { slug: 'guppyentertainmentab', name: 'Guppy Entertainment', city: 'Kristianstad' }, // 29 ev i juli, 8 synliga
    { slug: 'folkuniversitetetvisby', name: 'Folkuniversitetet Visby', city: 'Visby' }, // 29 ev i juli, 7 synliga
    { slug: 'northeventAB', name: 'Northevent AB', city: 'Karlstad' }, // 28 ev i juli, 8 synliga
    { slug: 'stormspakhus', name: 'Storms Pakhus' }, // 27 ev i juli, 6 synliga
    { slug: 'Debasersthlm', name: 'Debaser', city: 'Stockholm' }, // 27 ev i juli, 8 synliga
    { slug: 'Musikhuset', name: 'Musikhuset Gävle', city: 'Gävle' }, // 27 ev i juli, 8 synliga
    { slug: 'allaktivitetshusetsture', name: 'Skinnskattebergs Kommun' }, // 26 ev i juli, 1 synliga
    { slug: 'folkuniversitetetregionsyd', name: 'Folkuniversitetet Syd', city: 'Lund' }, // 26 ev i juli, 8 synliga
    { slug: 'attentionmolndal', name: 'Attention Mölndal' }, // 26 ev i juli, 8 synliga
    { slug: 'gkmmsplit', name: 'Gradska knjiznica Marka Marulica Split' }, // 26 ev i juli, 7 synliga
    { slug: 'vrakdykarpensionatet', name: 'Vrakdykarpensionatet' }, // 25 ev i juli, 8 synliga
    { slug: 'hotelskansenoland', name: 'Hotel Skansen', city: 'Kalmar' }, // 25 ev i juli, 8 synliga
    { slug: 'csnoje.se', name: 'CS Nöje', city: 'Jönköping' }, // 25 ev i juli, 8 synliga
    { slug: 'feverup', name: 'Fever', city: 'Stockholm' }, // 25 ev i juli, 8 synliga
    { slug: 'dismitt', name: 'Dis-Mitt', city: 'Gävle' }, // 24 ev i juli, 1 synliga
    { slug: 'vasteraskonserthus', name: 'Västerås Konserthus', city: 'Västerås' }, // 24 ev i juli, 8 synliga
    { slug: 'stockholmjazz', name: 'Stockholm Jazz Festival', city: 'Stockholm' }, // 24 ev i juli, 8 synliga
    { slug: 'Kulturenshus', name: 'Kulturens hus Luleå' }, // 24 ev i juli, 8 synliga
    { slug: 'jointhestudentlife', name: 'The Student Life' }, // 23 ev i juli, 2 synliga
    { slug: 'medleymalmo', name: 'medley malmö' }, // 23 ev i juli, 8 synliga
    { slug: 'Moveat.Sweden', name: 'Moveat', city: 'Göteborg' }, // 23 ev i juli, 8 synliga
    { slug: 'FKPscorpiosweden', name: 'FKP Scorpio Sverige' }, // 23 ev i juli, 8 synliga
    { slug: 'medborgarskolanjamtland', name: 'Medborgarskolan' }, // 22 ev i juli, 8 synliga
    { slug: 'hemfranderome', name: 'Hem från Derome', city: 'Varberg' }, // 22 ev i juli, 7 synliga
    { slug: 'alltpascen', name: 'Allt På Scen & Mycke Nöje', city: 'Linköping' }, // 22 ev i juli, 8 synliga
    { slug: 'Tangokompaniet', name: 'Tangokompaniet', city: 'Lund' }, // 21 ev i juli, 7 synliga
    { slug: 'sodertaljestadsscen', name: 'Södertälje stadsscen' }, // 21 ev i juli, 8 synliga
    { slug: 'Scalateatern', name: 'Scalateatern i Karlstad', city: 'Karlstad' }, // 21 ev i juli, 8 synliga
    { slug: 'Smalands', name: 'Smålands Nation', city: 'Lund' }, // 21 ev i juli, 5 synliga
    { slug: 'kramforsbibliotek', name: 'Kramfors bibliotek' }, // 21 ev i juli, 6 synliga
    { slug: 'kollektivetlivetbar', name: 'Kollektivet Livet' }, // 21 ev i juli, 8 synliga
    { slug: 'kulturiale', name: 'Kultur i Ale' }, // 21 ev i juli, 4 synliga
    { slug: 'jubelAB', name: 'Jubel', city: 'Västerås' }, // 21 ev i juli, 8 synliga
    { slug: 'gemenskapikungsor', name: 'Gemenskap i Kungsör' }, // 21 ev i juli, 8 synliga
    { slug: 'SundsvallsStadsbibliotek', name: 'Sundsvalls Stadsbibliotek', city: 'Sundsvall' }, // 20 ev i juli, 8 synliga
    { slug: 'skogsvargarna', name: 'OK Skogsvargarna', city: 'Lidköping' }, // 20 ev i juli, 5 synliga
    { slug: 'kulturkvarteret', name: 'Kulturkvarteret Kristianstad', city: 'Kristianstad' }, // 20 ev i juli, 7 synliga
    { slug: 'molndalsdansskola', name: 'Mölndals Dansskola' }, // 20 ev i juli, 8 synliga
    { slug: 'krallentertainment', name: 'Krall Entertainment', city: 'Uppsala' }, // 20 ev i juli, 8 synliga
    { slug: 'litensmula', name: 'Vita Huset - En Liten Smula', city: 'Norrtälje' }, // 18 ev i juli, 8 synliga
    { slug: 'Victoriateatern', name: 'Victoriateatern Malmö' }, // 18 ev i juli, 8 synliga
    { slug: 'mejeriet', name: 'Mejeriet', city: 'Lund' }, // 18 ev i juli, 7 synliga
    { slug: 'bioroy', name: 'Bio Roy' }, // 18 ev i juli, 8 synliga
    { slug: 'jazzclubfasching', name: 'Fasching' }, // 18 ev i juli, 8 synliga
    { slug: 'ABFsodertorn', name: 'ABF Södertörn' }, // 18 ev i juli, 8 synliga
    { slug: 'varnamobibliotekochkultur', name: 'Värnamo bibliotek och kultur' }, // 17 ev i juli, 8 synliga
    { slug: 'varldskulturmuseet', name: 'Världskulturmuseet' }, // 17 ev i juli, 8 synliga
    { slug: 'svkalmarlan', name: 'Studieförbundet Vuxenskolan Kalmar län', city: 'Nybro' }, // 17 ev i juli, 8 synliga
    { slug: 'svgavleborg', name: 'Studieförbundet Vuxenskolan Gävleborg', city: 'Gävle' }, // 17 ev i juli, 7 synliga
    { slug: 'planthousehuntersville', name: 'PlantHouse' }, // 17 ev i juli, 8 synliga
    { slug: 'Midsommargarden', name: 'Midsommargården' }, // 17 ev i juli, 8 synliga
    { slug: 'kristinehamnsbibliotek', name: 'Kristinehamns bibliotek', city: 'Kristinehamn' }, // 17 ev i juli, 5 synliga
    { slug: 'Inkonst3', name: 'Inkonst' }, // 17 ev i juli, 8 synliga
    { slug: 'Hjaltevadshus', name: 'Hjältevadshus', city: 'Uppsala' }, // 17 ev i juli, 7 synliga
    { slug: 'HarrysStenungsund', name: 'Harrys' }, // 17 ev i juli, 6 synliga
    { slug: 'folketshusulricehamn', name: 'Folkets Hus Ulricehamn' }, // 17 ev i juli, 8 synliga
    { slug: 'bibliotekenihalmstad', name: 'Biblioteken i Halmstad', city: 'Halmstad' }, // 17 ev i juli, 8 synliga
    { slug: 'vaniumeasida', name: 'Vän i Umeå' }, // 16 ev i juli, 8 synliga
    { slug: 'tibrobibliotek', name: 'Tibro bibliotek' }, // 16 ev i juli, 6 synliga
    { slug: 'Sjoangen', name: 'Sjöängen i Askersund' }, // 16 ev i juli, 6 synliga
    { slug: 'NojetKonsert', name: 'Nöjet Konsert AB', city: 'Uppsala' }, // 16 ev i juli, 8 synliga
    { slug: 'nationalmuseumswe', name: 'Nationalmuseum', city: 'Stockholm' }, // 16 ev i juli, 8 synliga
    { slug: 'livenationswe', name: 'Live Nation Sweden', city: 'Linköping' }, // 16 ev i juli, 8 synliga
    { slug: 'SwinginHepTown', name: 'HepTown', city: 'Lund' }, // 16 ev i juli, 8 synliga
    { slug: 'fhsater', name: 'Folkets Hus Säter' }, // 16 ev i juli, 8 synliga
    { slug: 'astarscandinavia', name: 'A STAR Entertainment', city: 'Norrköping' }, // 16 ev i juli, 8 synliga
    { slug: 'iggesundsfolkan', name: 'Folkets Hus - Iggesund' }, // 16 ev i juli, 6 synliga
    { slug: 'baerumkulturhus', name: 'Bærum Kulturhus' }, // 16 ev i juli, 6 synliga
    { slug: 'vasterasbibliotek', name: 'Västerås bibliotek', city: 'Västerås' }, // 15 ev i juli, 7 synliga
    { slug: 'bibliotekoupplevelser', name: 'Vingåkers bibliotek' }, // 15 ev i juli, 7 synliga
    { slug: 'vadstenabibliotek', name: 'Vadstena bibliotek' }, // 15 ev i juli, 5 synliga
    { slug: 'vallentunadans', name: 'Vallentuna Dans' }, // 15 ev i juli, 6 synliga
    { slug: 'umepride', name: 'Umepride' }, // 15 ev i juli, 8 synliga
    { slug: 'tingsrydsbibliotekochkultur', name: 'Tingsryds bibliotek och kultur' }, // 15 ev i juli, 5 synliga
    { slug: 'Sormlandsmuseum', name: 'Sörmlands museum', city: 'Nyköping' }, // 15 ev i juli, 7 synliga
    { slug: 'toccaentertainment', name: 'Tocca Entertainment', city: 'Sundsvall' }, // 15 ev i juli, 4 synliga
    { slug: 'Storlihytta', name: 'Storlihytta' }, // 15 ev i juli, 8 synliga
    { slug: 'oxiebiblioteket', name: 'Oxiebiblioteket' }, // 15 ev i juli, 7 synliga
    { slug: 'nygatan6', name: 'Nygatan 6' }, // 15 ev i juli, 6 synliga
    { slug: 'natminkulturhus', name: 'Nationella minoriteters kulturhus' }, // 15 ev i juli, 6 synliga
    { slug: 'monovaxjo', name: 'Mono Växjö' }, // 15 ev i juli, 8 synliga
    { slug: 'malmolive', name: 'Malmö Live' }, // 15 ev i juli, 7 synliga
    { slug: 'lantmannenmaskinochlantbruk', name: 'Lantmännen Maskin och Lantmännen Lantbruk', city: 'Kristianstad' }, // 15 ev i juli, 8 synliga
    { slug: 'katalin.uppsala', name: 'Katalin And All That Jazz Östra Station', city: 'Uppsala' }, // 15 ev i juli, 8 synliga
    { slug: 'hyltebiblioteken', name: 'Hyltebiblioteken' }, // 15 ev i juli, 6 synliga
    { slug: 'estrad.norr', name: 'Estrad Norr' }, // 15 ev i juli, 6 synliga
    { slug: 'eksjobibliotek', name: 'Eksjö stadsbibliotek' }, // 15 ev i juli, 6 synliga
    { slug: 'ulrikabeijeryoga', name: 'UB Yoga, Sång & Ceremoni', city: 'Hudiksvall' }, // 14 ev i juli, 6 synliga
    { slug: 'orebrobibliotek', name: 'Örebro bibliotek' }, // 14 ev i juli, 8 synliga
    { slug: 'svinorrabohuslan', name: 'Studieförbundet Vuxenskolan i Norra Bohuslän' }, // 14 ev i juli, 8 synliga
    { slug: 'shrekraveofficial', name: 'Shrek Rave' }, // 14 ev i juli, 8 synliga
    { slug: 'planbmalmo', name: 'Plan B - malmö' }, // 14 ev i juli, 8 synliga
    { slug: 'movehomesverige', name: 'Movehome', city: 'Motala' }, // 14 ev i juli, 4 synliga
    { slug: 'ideadrottninghog', name: 'Idé A Drottninghög', city: 'Helsingborg' }, // 14 ev i juli, 6 synliga
    { slug: 'Biotranan.Tranemo', name: 'Bio Tranan Tranemo' }, // 14 ev i juli, 8 synliga
    { slug: 'YogaHusetFalun', name: 'Yogahuset Falun', city: 'Falun' }, // 13 ev i juli, 8 synliga
    { slug: 'trivselhussverige', name: 'Trivselhus', city: 'Linköping' }, // 13 ev i juli, 2 synliga
    { slug: 'steamhotel', name: 'The Steam Hotel', city: 'Västerås' }, // 13 ev i juli, 6 synliga
    { slug: 'Reimersholmehotel', name: 'Reimersholme Hotel', city: 'Stockholm' }, // 13 ev i juli, 8 synliga
    { slug: 'norrlandsoperan', name: 'Norrlandsoperan' }, // 13 ev i juli, 6 synliga
    { slug: 'NalenStockholm', name: 'Nalen', city: 'Stockholm' }, // 13 ev i juli, 6 synliga
    { slug: 'lundsallhelgonakyrka', name: 'Lunds Allhelgonakyrka' }, // 13 ev i juli, 6 synliga
    { slug: 'kulturbolaget', name: 'Kulturbolaget', city: 'Jönköping' }, // 13 ev i juli, 8 synliga
    { slug: 'hjartatshus', name: 'Hjärtats hus', city: 'Jönköping' }, // 13 ev i juli, 6 synliga
    { slug: 'Gardenoffeathers', name: 'Garden of Feathers', city: 'Staffanstorp' }, // 13 ev i juli, 7 synliga
    { slug: 'ebba.dansklubb', name: 'EBBA Dansklubb' }, // 13 ev i juli, 6 synliga
    { slug: 'BorlangeDance', name: 'Borlänge Dance', city: 'Borlänge' }, // 13 ev i juli, 7 synliga
    { slug: 'aabendans', name: 'Aaben Dans' }, // 13 ev i juli, 4 synliga
    { slug: 'barnbiblioteken', name: 'Barnbiblioteken', city: 'Strängnäs' }, // 13 ev i juli, 5 synliga
    { slug: 'ABFKiruna', name: 'ABF Norr Kiruna', city: 'Kiruna' }, // 13 ev i juli, 8 synliga
    { slug: 'vewcs', name: 'Victor Evelina West Coast Swing', city: 'Uppsala' }, // 12 ev i juli, 8 synliga
    { slug: 'ungdomshuset.odense', name: 'Ungdomshuset Odense' }, // 12 ev i juli, 8 synliga
    { slug: 'vadhanderistockholm', name: 'Vad som händer i Stockholm', city: 'Stockholm' }, // 12 ev i juli, 4 synliga
    { slug: 'tranemo.bibliotek', name: 'Tranemo bibliotek' }, // 12 ev i juli, 4 synliga
    { slug: 'sigtunastiftelsen', name: 'Sigtunastiftelsen' }, // 12 ev i juli, 7 synliga
    { slug: 'malmostadsbibliotek', name: 'Stadsbiblioteket i Malmö' }, // 12 ev i juli, 8 synliga
    { slug: 'taystase', name: 'Taysta', city: 'Stockholm' }, // 12 ev i juli, 8 synliga
    { slug: 'sensusvastrasverige', name: 'Sensus Västra Sverige', city: 'Göteborg' }, // 12 ev i juli, 8 synliga
    { slug: 'NiklasStromstedtMusic', name: 'Niklas Strömstedt', city: 'Gävle' }, // 12 ev i juli, 6 synliga
    { slug: 'SanktJohanneskyrka', name: 'Sankt Johannes kyrka, Malmö' }, // 12 ev i juli, 8 synliga
    { slug: 'musikidalarna', name: 'Musik i Dalarna', city: 'Falun' }, // 12 ev i juli, 5 synliga
    { slug: 'moriskapaviljongen', name: 'Moriska Paviljongen' }, // 12 ev i juli, 8 synliga
    { slug: 'lundchoralfestival.lcf', name: 'Lund Choral Festival', city: 'Lund' }, // 12 ev i juli, 8 synliga
    { slug: 'malmocityskaters', name: 'Malmö City Skaters', city: 'Lund' }, // 12 ev i juli, 8 synliga
    { slug: 'hedvigeleonora', name: 'Hedvig Eleonora kyrka' }, // 12 ev i juli, 6 synliga
    { slug: 'harnosandsbibliotek', name: 'Härnösands bibliotek', city: 'Härnösand' }, // 12 ev i juli, 3 synliga
    { slug: 'Gummifabriken', name: 'Gummifabriken i Värnamo' }, // 12 ev i juli, 8 synliga
    { slug: 'gretasgothenburg', name: 'Gretas Göteborg', city: 'Göteborg' }, // 12 ev i juli, 8 synliga
    { slug: 'gotlandsmuseum', name: 'Gotlands Museum', city: 'Visby' }, // 12 ev i juli, 6 synliga
    { slug: 'freemoveyogastudio.nu', name: 'Freemove Yogastudio' }, // 12 ev i juli, 8 synliga
    { slug: 'Eskilstunastadsbibliotek', name: 'Eskilstuna stadsbibliotek', city: 'Eskilstuna' }, // 12 ev i juli, 8 synliga
    { slug: 'BorasDansforening', name: 'Borås Dansförening', city: 'Borås' }, // 12 ev i juli, 8 synliga
    { slug: 'centrumhusbiografen', name: 'Centrumhusbiografen' }, // 12 ev i juli, 7 synliga
    { slug: 'folketsbiomalmo', name: 'Biograf Panora Malmö' }, // 12 ev i juli, 8 synliga
    { slug: 'almhultsbibliotek', name: 'Älmhults bibliotek' }, // 11 ev i juli, 5 synliga
    { slug: 'varlokal', name: 'Vår lokal' }, // 11 ev i juli, 8 synliga
    { slug: 'tasspalatset.se', name: 'Tasspalatset' }, // 11 ev i juli, 8 synliga
    { slug: 'svorebrolan', name: 'Studieförbundet Vuxenskolan Örebro Län', city: 'Nora' }, // 11 ev i juli, 8 synliga
    { slug: 'soderhamnsbibblan', name: 'Söderhamns Stadsbibliotek', city: 'Söderhamn' }, // 11 ev i juli, 7 synliga
    { slug: 'SVGoteborg', name: 'Studieförbundet Vuxenskolan Göteborg', city: 'Göteborg' }, // 11 ev i juli, 8 synliga
    { slug: 'seniorikungsbacka', name: 'Senior i Kungsbacka', city: 'Kungsbacka' }, // 11 ev i juli, 7 synliga
    { slug: 'biblioteketsimrishamn', name: 'Simrishamns bibliotek', city: 'Simrishamn' }, // 11 ev i juli, 8 synliga
    { slug: 'parkenkulturhus', name: 'Parken kulturhus' }, // 11 ev i juli, 7 synliga
    { slug: 'malmomuseum', name: 'Malmö museum', city: 'Malmö' }, // 11 ev i juli, 6 synliga
    { slug: 'nbvost', name: 'NBV Öst', city: 'Nyköping' }, // 11 ev i juli, 3 synliga
    { slug: 'mikespubskovde', name: 'Mikes pub och restaurang', city: 'Skövde' }, // 11 ev i juli, 4 synliga
    { slug: 'linkopingairswing', name: 'Linköping Air Swing', city: 'Linköping' }, // 11 ev i juli, 8 synliga
    { slug: 'konstmuseet', name: 'Konstmuseet', city: 'Skövde' }, // 11 ev i juli, 6 synliga
    { slug: 'konstepidemin', name: 'Konstepidemin' }, // 11 ev i juli, 8 synliga
    { slug: 'karlskronabibliotek', name: 'Karlskrona Stadsbibliotek', city: 'Karlskrona' }, // 11 ev i juli, 8 synliga
    { slug: 'kalmarnationlund', name: 'Kalmar Nation', city: 'Lund' }, // 11 ev i juli, 6 synliga
    { slug: 'HotellHulingen', name: 'Hotell Hulingen' }, // 11 ev i juli, 8 synliga
    { slug: 'Hedenstedbibliotekerne', name: 'Hedensted Bibliotekerne' }, // 11 ev i juli, 8 synliga
    { slug: 'hotelmolndalsbroochroyrestaurant', name: 'Hotel Mölndals Bro - Roy Restaurant Café & Bar' }, // 11 ev i juli, 7 synliga
    { slug: 'cirkus.klub', name: 'Cirkus' }, // 11 ev i juli, 6 synliga
    { slug: 'CirkusStavanger', name: 'CIRKUS' }, // 11 ev i juli, 8 synliga
    { slug: 'bjuvsbibliotek', name: 'Bjuvs bibliotek' }, // 11 ev i juli, 8 synliga
    { slug: 'bibliotekenilaholm', name: 'Biblioteken i Laholm', city: 'Laholm' }, // 11 ev i juli, 5 synliga
    { slug: 'Bibliotekenilulea', name: 'Biblioteken i Luleå' }, // 11 ev i juli, 8 synliga
    { slug: 'bibliotekeniboras', name: 'Biblioteken i Borås', city: 'Borås' }, // 11 ev i juli, 8 synliga
    { slug: 'ArbogaFolketsPark', name: 'Arboga Folkets Park' }, // 11 ev i juli, 8 synliga
    { slug: 'arbisnkpg', name: 'Arbis' }, // 11 ev i juli, 8 synliga
    { slug: '59anLysekil', name: '59an i Lysekil' }, // 11 ev i juli, 4 synliga
    { slug: 'ystadsbibliotek', name: 'Ystads bibliotek', city: 'Ystad' }, // 10 ev i juli, 8 synliga
    { slug: 'vaxjokommun', name: 'Växjö kommun' }, // 10 ev i juli, 5 synliga
    { slug: 'vilhelmina.folketshus.7', name: 'Vilhelmina Folkets Hus' }, // 10 ev i juli, 3 synliga
    { slug: 'ThePulsebar2023', name: 'The Pulse' }, // 10 ev i juli, 5 synliga
    { slug: 'TheTivoli', name: 'The Tivoli', city: 'Helsingborg' }, // 10 ev i juli, 8 synliga
    { slug: 'silvenska', name: 'Silvénska villan' }, // 10 ev i juli, 5 synliga
    { slug: 'stfostraskane', name: 'STF Östra Skåne Lokalavdelning', city: 'Kristianstad' }, // 10 ev i juli, 8 synliga
    { slug: 'reisdegkomikerklubb', name: 'Reis Deg Komikerklubb' }, // 10 ev i juli, 4 synliga
    { slug: 'junisalvsborgdistrikt', name: 'Movendi Älvsborg', city: 'Borås' }, // 10 ev i juli, 8 synliga
    { slug: 'monica.karlsson.399', name: 'Motala biologiska förening', city: 'Motala' }, // 10 ev i juli, 5 synliga
    { slug: 'Lakarmissionen', name: 'Läkarmissionen', city: 'Alingsås' }, // 10 ev i juli, 5 synliga
    { slug: 'medeltidsmuseet', name: 'Medeltidsmuseet', city: 'Stockholm' }, // 10 ev i juli, 7 synliga
    { slug: 'KBASQUARE', name: 'Kungsbacka Square Dancers', city: 'Kungsbacka' }, // 10 ev i juli, 3 synliga
    { slug: 'KappaBarMalmo', name: 'Kappa Bar Malmö' }, // 10 ev i juli, 7 synliga
    { slug: 'lugersweden', name: 'Luger', city: 'Stockholm' }, // 10 ev i juli, 8 synliga
    { slug: 'kulturmagasinetsundsvall', name: 'Kulturmagasinet Sundsvall', city: 'Sundsvall' }, // 10 ev i juli, 8 synliga
    { slug: 'inrenatur', name: 'Inre natur' }, // 10 ev i juli, 6 synliga
    { slug: 'KSHHealing', name: 'KSH Healing', city: 'Kalmar' }, // 10 ev i juli, 2 synliga
    { slug: 'jagvagarstuffa', name: 'Jag vågar stuffa', city: 'Karlshamn' }, // 10 ev i juli, 8 synliga
    { slug: 'hagforskulturochbibliotek', name: 'Hagfors kultur och bibliotek' }, // 10 ev i juli, 6 synliga
    { slug: 'hovmantorps.folketshus', name: 'Folkbiografen Hovmantorp' }, // 10 ev i juli, 8 synliga
    { slug: 'dalarnasmuseum', name: 'Dalarnas museum', city: 'Falun' }, // 10 ev i juli, 5 synliga
    { slug: 'centrumforfotografi', name: 'CFF – Centrum för fotografi', city: 'Göteborg' }, // 10 ev i juli, 2 synliga
    { slug: 'arvikabibliotek', name: 'Arvika Bibliotek', city: 'Arvika' }, // 10 ev i juli, 7 synliga
    { slug: 'ungdomsgardentimra', name: 'Aktivitetshuset Pangea' }, // 10 ev i juli, 6 synliga
    { slug: 'karlecafe', name: 'karl-e' }, // 9 ev i juli, 8 synliga
    { slug: 'ostersundsbibliotek', name: 'Östersunds Bibliotek' }, // 9 ev i juli, 8 synliga
    { slug: 'WoodyWestGbg', name: 'Woody West' }, // 9 ev i juli, 8 synliga
    { slug: 'vaxjoloparklubb', name: 'Växjö Löparklubb' }, // 9 ev i juli, 1 synliga
    { slug: 'vnmuseum', name: 'Västernorrlands museum', city: 'Härnösand' }, // 9 ev i juli, 7 synliga
    { slug: 'WermlandOpera', name: 'Wermland Opera', city: 'Karlstad' }, // 9 ev i juli, 4 synliga
    { slug: 'Uddevallakassetten', name: 'Uddevallakassetten', city: 'Uddevalla' }, // 9 ev i juli, 4 synliga
    { slug: 'TillsammansHoor', name: 'Tillsammans Höör' }, // 9 ev i juli, 1 synliga
    { slug: 'stockholmghostwalk', name: 'Stockholm Ghost Walk', city: 'Stockholm' }, // 9 ev i juli, 5 synliga
    { slug: 'situpcomedy', name: 'Sit-up comedy show' }, // 9 ev i juli, 3 synliga
    { slug: 'sarakulturhus', name: 'Sara kulturhus' }, // 9 ev i juli, 8 synliga
    { slug: 'oslonye', name: 'Oslo Nye Teater' }, // 9 ev i juli, 8 synliga
    { slug: 'gasasteget', name: 'Lunds Dansklubb Gåsasteget', city: 'Lund' }, // 9 ev i juli, 7 synliga
    { slug: 'lisebergab', name: 'Liseberg' }, // 9 ev i juli, 5 synliga
    { slug: 'jkpglm', name: 'Jönköpings läns museum', city: 'Jönköping' }, // 9 ev i juli, 1 synliga
    { slug: 'fulloflife.tantra', name: 'Full of Life' }, // 9 ev i juli, 2 synliga
    { slug: 'GothenburgSymphonyOrchestra', name: 'Göteborgs Symfoniker' }, // 9 ev i juli, 3 synliga
    { slug: 'Falkopingsbibliotek', name: 'Falköpings bibliotek' }, // 9 ev i juli, 5 synliga
    { slug: 'Boras.Stadsteater', name: 'Borås Stadsteater', city: 'Borås' }, // 9 ev i juli, 3 synliga
    { slug: 'DanshusetDkBuggie', name: 'Dansklubben Buggie i Ulricehamn' }, // 9 ev i juli, 5 synliga
    { slug: 'haningebibliotek', name: 'Biblioteken i Haninge' }, // 9 ev i juli, 6 synliga
    { slug: 'baravanlig.se', name: 'Bara Vanlig', city: 'Lund' }, // 9 ev i juli, 8 synliga
    { slug: 'ostgotateatern', name: 'Östgötateatern', city: 'Norrköping' }, // 8 ev i juli, 3 synliga
    { slug: 'orebro.salsafriends.9', name: 'Örebro Salsafriends' }, // 8 ev i juli, 4 synliga
    { slug: 'angebibliotek', name: 'Ånge centralbibliotek' }, // 8 ev i juli, 5 synliga
    { slug: 'VXOevent', name: 'VXO event' }, // 8 ev i juli, 8 synliga
    { slug: 'Sundsvallsmuseum', name: 'Sundsvalls museum', city: 'Sundsvall' }, // 8 ev i juli, 5 synliga
    { slug: 'tradgarn', name: 'Trädgår\'n' }, // 8 ev i juli, 8 synliga
    { slug: 'stuckonlive', name: 'Stuck On - Live' }, // 8 ev i juli, 8 synliga
    { slug: 'smalandsuppsala', name: 'Smålands nation', city: 'Uppsala' }, // 8 ev i juli, 3 synliga
    { slug: 'slagelsebib', name: 'Slagelse Bibliotekerne' }, // 8 ev i juli, 8 synliga
    { slug: 'norskamatorteaterforbund', name: 'Norsk Amatørteaterforbund' }, // 8 ev i juli, 8 synliga
    { slug: 'NaturumVattenriket', name: 'Naturum Vattenriket' }, // 8 ev i juli, 3 synliga
    { slug: 'regionmuseetskane', name: 'Regionmuseet Skåne', city: 'Kristianstad' }, // 8 ev i juli, 4 synliga
    { slug: 'norrkoping.symphony', name: 'Louis De Geer-hallen Norrköping', city: 'Norrköping' }, // 8 ev i juli, 8 synliga
    { slug: 'lommafolketshus', name: 'Lomma Folkets Hus' }, // 8 ev i juli, 5 synliga
    { slug: 'Mordmysterium', name: 'Mordmysterium' }, // 8 ev i juli, 6 synliga
    { slug: 'gospelgiz', name: 'Joy Singers', city: 'Ljungby' }, // 8 ev i juli, 8 synliga
    { slug: 'kpdmellerud', name: 'Kulturbruket på Dal' }, // 8 ev i juli, 8 synliga
    { slug: 'drakenlive', name: 'Draken Live' }, // 8 ev i juli, 5 synliga
    { slug: 'forumbiblioteken', name: 'Forumbiblioteken i Nacka' }, // 8 ev i juli, 5 synliga
    { slug: 'dansofolkton', name: 'Dans & Folkton' }, // 8 ev i juli, 7 synliga
    { slug: 'brasserietboras', name: 'Brasseriet', city: 'Borås' }, // 8 ev i juli, 4 synliga
    { slug: 'babblarnalive', name: 'Babblarna på scen', city: 'Uppsala' }, // 8 ev i juli, 3 synliga
    { slug: 'arbogabio', name: 'Arboga bio' }, // 8 ev i juli, 8 synliga
    { slug: 'ostfoldteater', name: 'Østfold Teater' }, // 7 ev i juli, 7 synliga
    { slug: 'Vindelnskommunbibliotek', name: 'Vindelns kommunbibliotek' }, // 7 ev i juli, 4 synliga
    { slug: 'folkanteater', name: 'Örnsköldsviks Riksteaterförening' }, // 7 ev i juli, 8 synliga
    { slug: 'vansbrokommun', name: 'Vansbro kommun' }, // 7 ev i juli, 1 synliga
    { slug: 'Studieforbundetbildanord', name: 'Studieförbundet Bilda Nord' }, // 7 ev i juli, 8 synliga
    { slug: 'stockholmsmarknader', name: 'Stockholmsmarknader' }, // 7 ev i juli, 4 synliga
    { slug: 'sevallabygdegard', name: 'Sevalla Bygdegård', city: 'Västerås' }, // 7 ev i juli, 6 synliga
    { slug: 'rfsisuvn', name: 'RF - SISU Västernorrland', city: 'Härnösand' }, // 7 ev i juli, 8 synliga
    { slug: 'naturskyddsforeningenigoteborg', name: 'Naturskyddsföreningen i Göteborg', city: 'Göteborg' }, // 7 ev i juli, 5 synliga
    { slug: 'NorrlandTulpaner', name: 'Norrlands Tulpan Trädgård', city: 'Härnösand' }, // 7 ev i juli, 3 synliga
    { slug: 'lindblomacademy', name: 'Lindblom Academy Inner Spirit Light', city: 'Västerås' }, // 7 ev i juli, 8 synliga
    { slug: 'klostretiystad', name: 'Klostret i Ystad', city: 'Ystad' }, // 7 ev i juli, 4 synliga
    { slug: 'kalix.bibliotek', name: 'Kalix Bibliotek' }, // 7 ev i juli, 6 synliga
    { slug: 'bodyandsoulmovement', name: 'Maria Slättorp - Body & Soul Movement' }, // 7 ev i juli, 5 synliga
    { slug: 'JyskRejsebureau', name: 'Jysk Rejsebureau' }, // 7 ev i juli, 8 synliga
    { slug: 'gnosjobibliotek', name: 'Gnosjö kultur & bibliotek' }, // 7 ev i juli, 4 synliga
    { slug: 'Furuviksparken', name: 'Furuviksparken' }, // 7 ev i juli, 2 synliga
    { slug: 'foreningensm', name: 'Föreningen Söderhamns Museum', city: 'Söderhamn' }, // 7 ev i juli, 3 synliga
    { slug: 'filmfestsundsvall', name: 'Filmfest Sundsvall', city: 'Sundsvall' }, // 7 ev i juli, 8 synliga
    { slug: 'Discaid', name: 'Discaid', city: 'Borlänge' }, // 7 ev i juli, 2 synliga
    { slug: 'dragonflystudioavesta', name: 'Dragonfly Studio' }, // 7 ev i juli, 3 synliga
    { slug: 'WheelsOfCarlshamn', name: 'Cykelklubben Wheels Of Carlshamn', city: 'Karlshamn' }, // 7 ev i juli, 1 synliga
    { slug: 'mikaelgottberg', name: 'Carlsson På Kajen', city: 'Västerås' }, // 7 ev i juli, 3 synliga
    { slug: 'bibliotekljusdal', name: 'Biblioteken i Ljusdals kommun' }, // 7 ev i juli, 5 synliga
    { slug: 'betlehemskyrkan', name: 'Betlehemskyrkan' }, // 7 ev i juli, 8 synliga
    { slug: 'avensbylapland', name: 'Avens by Nature / Västerås Reiki Center', city: 'Västerås' }, // 7 ev i juli, 4 synliga
    { slug: 'anebybibliotek', name: 'Aneby bibliotek' }, // 7 ev i juli, 5 synliga
    { slug: 'absaloncph', name: 'Absalon' }, // 7 ev i juli, 8 synliga
    { slug: 'ObackaJazz', name: 'Öbacka Jazz&Blues Härnösand', city: 'Härnösand' }, // 6 ev i juli, 7 synliga
    { slug: 'ostersundskulturskola', name: 'Östersunds Kulturskola' }, // 6 ev i juli, 4 synliga
    { slug: 'ostersundskommun', name: 'Östersunds kommun - Staaren tjïelte' }, // 6 ev i juli, 4 synliga
    { slug: 'Levochmaval', name: 'ViveVale', city: 'Lund' }, // 6 ev i juli, 2 synliga
    { slug: 'vindeln', name: 'Vindelns Kommun' }, // 6 ev i juli, 1 synliga
    { slug: 'gunnesgard', name: 'Vikingagården Gunnes gård' }, // 6 ev i juli, 3 synliga
    { slug: 'vedeldspizzan', name: 'Vedeldspizzan', city: 'Göteborg' }, // 6 ev i juli, 2 synliga
    { slug: 'meraloppis', name: 'Ulf Andersson' }, // 6 ev i juli, 2 synliga
    { slug: 'jansvenssontrubadur', name: 'Trubadur Jan Svensson Musik Produktion', city: 'Uddevalla' }, // 6 ev i juli, 8 synliga
    { slug: 'teaterhalland', name: 'Teater Halland', city: 'Varberg' }, // 6 ev i juli, 5 synliga
    { slug: 'stadshallen', name: 'Stadshallen', city: 'Lund' }, // 6 ev i juli, 6 synliga
    { slug: 'swingum400', name: 'Swingum' }, // 6 ev i juli, 4 synliga
    { slug: 'Showtic', name: 'Showtic', city: 'Linköping' }, // 6 ev i juli, 6 synliga
    { slug: 'sagabioflen', name: 'Saga Bio, Flen' }, // 6 ev i juli, 1 synliga
    { slug: 'poffertjes.se', name: 'Poffertjes.se' }, // 6 ev i juli, 1 synliga
    { slug: 'pitea.se', name: 'Piteå kommun' }, // 6 ev i juli, 5 synliga
    { slug: 'nykopings.folkhogskola', name: 'Nyköpings Folkhögskola', city: 'Nyköping' }, // 6 ev i juli, 6 synliga
    { slug: 'northcreativenodes', name: 'North Creative Nodes', city: 'Boden' }, // 6 ev i juli, 7 synliga
    { slug: 'nordiskakammarorkestern', name: 'Nordiska Kammarorkestern', city: 'Sundsvall' }, // 6 ev i juli, 6 synliga
    { slug: 'naturskyddsforeningen.vanersborg', name: 'Naturskyddsföreningen Vänersborg' }, // 6 ev i juli, 5 synliga
    { slug: 'musikilerum', name: 'Musik i Lerum' }, // 6 ev i juli, 3 synliga
    { slug: 'mediumcamilla', name: 'Medium Camilla', city: 'Linköping' }, // 6 ev i juli, 3 synliga
    { slug: 'MusikcentrumVast', name: 'MCV - Musikcentrum Väst' }, // 6 ev i juli, 8 synliga
    { slug: 'Landskronabibliotek', name: 'Landskrona bibliotek', city: 'Landskrona' }, // 6 ev i juli, 8 synliga
    { slug: 'mittlandplus', name: 'Kultur i Ånge Kommun' }, // 6 ev i juli, 8 synliga
    { slug: 'kulturhusetfregatten', name: 'Kulturhuset Fregatten' }, // 6 ev i juli, 7 synliga
    { slug: 'ginanykvist', name: 'Hojkompisar Stockholm med omnejd', city: 'Stockholm' }, // 6 ev i juli, 1 synliga
    { slug: 'inger.ericson.7', name: 'Inger Ericson', city: 'Stockholm' }, // 6 ev i juli, 8 synliga
    { slug: 'borgmastarvilla', name: 'Hotell Humbla', city: 'Sölvesborg' }, // 6 ev i juli, 2 synliga
    { slug: 'FylgjaHelandeHarmoni', name: 'Fylgja - helande harmoni', city: 'Sundsvall' }, // 6 ev i juli, 8 synliga
    { slug: 'FrokenLarssonHandelsbod', name: 'Fröken Larsson Vintage, Antikt & Secondhand' }, // 6 ev i juli, 1 synliga
    { slug: 'Familjecentralen.Ulricehamn', name: 'Familjecentralen, Öppna förskolan i Ulricehamn' }, // 6 ev i juli, 4 synliga
    { slug: 'Drammensacred', name: 'Drammen Sacred Music Festival' }, // 6 ev i juli, 8 synliga
    { slug: 'backa.teater', name: 'Backa Teater' }, // 6 ev i juli, 3 synliga
    { slug: 'dansinordnya', name: 'Dans i Nord nya', city: 'Gällivare' }, // 6 ev i juli, 7 synliga
    { slug: 'amplifiedvast', name: 'Amplified Väst', city: 'Borås' }, // 6 ev i juli, 4 synliga
    { slug: 'aterstallvatmarker', name: 'Återställ Våtmarker', city: 'Stockholm' }, // 5 ev i juli, 2 synliga
    { slug: 'ostgotamusiken', name: 'Östgötamusiken', city: 'Linköping' }, // 5 ev i juli, 8 synliga
    { slug: 'Astorpskommun', name: 'Åstorps kommun' }, // 5 ev i juli, 8 synliga
    { slug: 'alvsbyn', name: 'Älvsbyn' }, // 5 ev i juli, 8 synliga
    { slug: 'YogaZonBorgholm', name: 'YogaZon' }, // 5 ev i juli, 1 synliga
    { slug: 'varnamocity', name: 'Värnamo City' }, // 5 ev i juli, 2 synliga
    { slug: 'vardagibalans', name: 'Vardag i Balans', city: 'Lund' }, // 5 ev i juli, 2 synliga
    { slug: 'herrestadsaiffotbollherr', name: 'Undavallen' }, // 5 ev i juli, 8 synliga
    { slug: 'svartebyalag', name: 'Svarte' }, // 5 ev i juli, 4 synliga
    { slug: 'swinginmotionab', name: 'Swing in motion', city: 'Borås' }, // 5 ev i juli, 5 synliga
    { slug: 'SkolsimmarnaIK', name: 'Skolsimmarna IK' }, // 5 ev i juli, 3 synliga
    { slug: 'SensusOstersund', name: 'Sensus Östersund' }, // 5 ev i juli, 8 synliga
    { slug: 'sollentunakommun', name: 'Sollentuna kommun' }, // 5 ev i juli, 2 synliga
    { slug: '100046421744875', name: 'Råda Rum' }, // 5 ev i juli, 8 synliga
    { slug: 'scenknuten', name: 'Scenknuten', city: 'Eskilstuna' }, // 5 ev i juli, 1 synliga
    { slug: 'quiztyreso', name: 'QUIZ - Tyresö' }, // 5 ev i juli, 1 synliga
    { slug: 'rfsisu.norrbotten', name: 'RF' }, // 5 ev i juli, 8 synliga
    { slug: 'halloikaraoke', name: 'Oslostandup.no' }, // 5 ev i juli, 4 synliga
    { slug: 'mjolbykommun', name: 'Mjölby kommun', city: 'Mjölby' }, // 5 ev i juli, 1 synliga
    { slug: 'Bonanderfriskvard', name: 'Lena Bonanders Massage & Friskvård', city: 'Uddevalla' }, // 5 ev i juli, 4 synliga
    { slug: 'landskronasurfcenter', name: 'Landskrona SurfCenter', city: 'Landskrona' }, // 5 ev i juli, 1 synliga
    { slug: 'obosisverige', name: 'OBOS i Sverige', city: 'Uppsala' }, // 5 ev i juli, 3 synliga
    { slug: 'Kungalvsparken', name: 'Kungälvs Parken', city: 'Trollhättan' }, // 5 ev i juli, 8 synliga
    { slug: 'kulturhuseteden', name: 'Kulturhuset Eden' }, // 5 ev i juli, 6 synliga
    { slug: 'swedbanksagarstiftelsesoderhamn', name: 'Kulturen Söderhamn', city: 'Söderhamn' }, // 5 ev i juli, 3 synliga
    { slug: 'kulturcentrumebeneser', name: 'Kulturcentrum Ebeneser' }, // 5 ev i juli, 8 synliga
    { slug: 'katalinsjazzbar', name: 'Katalins Bakficka', city: 'Uppsala' }, // 5 ev i juli, 8 synliga
    { slug: 'kbwestgbg', name: 'KB West' }, // 5 ev i juli, 8 synliga
    { slug: 'jazzklubbensundsvall.se', name: 'Jazzklubben Sundsvall', city: 'Sundsvall' }, // 5 ev i juli, 8 synliga
    { slug: 'trumhakan', name: 'Jansson Communication' }, // 5 ev i juli, 8 synliga
    { slug: 'hcamarathon', name: 'HCA Marathon' }, // 5 ev i juli, 4 synliga
    { slug: 'IFKKristianstad', name: 'IFK Kristianstad', city: 'Kristianstad' }, // 5 ev i juli, 8 synliga
    { slug: 'gellerasenkarlskoga', name: 'Gelleråsen, Karlskoga' }, // 5 ev i juli, 1 synliga
    { slug: 'falkenbergsstadsteater', name: 'Falkenbergs Stadsteater', city: 'Falkenberg' }, // 5 ev i juli, 8 synliga
    { slug: 'enkopingskommunbibliotek', name: 'Enköpings kommunbibliotek', city: 'Enköping' }, // 5 ev i juli, 7 synliga
    { slug: 'brygganangelholm', name: 'Bryggan Kök & Bar' }, // 5 ev i juli, 4 synliga
    { slug: 'CoderDojoLund', name: 'CoderDojo Lund', city: 'Lund' }, // 5 ev i juli, 2 synliga
    { slug: 'BibliotekeniKalmarkommun', name: 'Biblioteken i Kalmar kommun', city: 'Kalmar' }, // 5 ev i juli, 8 synliga
    { slug: 'biokontrastiggesund', name: 'Bio Kontrast - Folkets Hus Iggesund' }, // 5 ev i juli, 2 synliga
    { slug: 'backyardfalun', name: 'Backyard Club', city: 'Falun' }, // 5 ev i juli, 7 synliga
    { slug: 'arttourssthlm', name: 'Art Tours Sthlm', city: 'Stockholm' }, // 5 ev i juli, 3 synliga
    { slug: 'alltidtjorn', name: 'Alltid Tjörn' }, // 5 ev i juli, 4 synliga
    { slug: 'allthingslivesweden', name: 'All Things Live Sweden' }, // 5 ev i juli, 6 synliga
    { slug: 'alexeklundofficial', name: 'Alex Eklund', city: 'Eskilstuna' }, // 5 ev i juli, 6 synliga
    { slug: 'AlingsasDansklubb', name: 'Alingsås Dansklubb', city: 'Alingsås' }, // 5 ev i juli, 4 synliga
    { slug: 'abfmalmo', name: 'ABF Malmö' }, // 5 ev i juli, 8 synliga
    { slug: 'oviklatinodans', name: 'Övik Latinodans' }, // 4 ev i juli, 5 synliga
    { slug: 'Ostgota', name: 'Östgöta Nation', city: 'Lund' }, // 4 ev i juli, 8 synliga
    { slug: 'almhultsif', name: 'Älmhults IF' }, // 4 ev i juli, 8 synliga
    { slug: 'StreetRollerHockeyLeague', name: 'https://www.facebook.com/share/g/' }, // 4 ev i juli, 1 synliga
    { slug: 'yogaheart.nu', name: 'Yogaheart' }, // 4 ev i juli, 3 synliga
    { slug: 'Vardklockanskyrka', name: 'Vårdklockans kyrka', city: 'Visby' }, // 4 ev i juli, 4 synliga
    { slug: 'vastmanlandslansmuseum', name: 'Västmanlands läns museum', city: 'Västerås' }, // 4 ev i juli, 8 synliga
    { slug: 'villalidkopingbk', name: 'Villa Lidköping BK', city: 'Lidköping' }, // 4 ev i juli, 2 synliga
    { slug: 'vastmanlandsteater', name: 'Västmanlands Teater', city: 'Västerås' }, // 4 ev i juli, 3 synliga
    { slug: 'UppsalaBudoklubb', name: 'Uppsala Budoklubb', city: 'Uppsala' }, // 4 ev i juli, 6 synliga
    { slug: 'UpplevSkovde', name: 'Upplev Skövde', city: 'Skövde' }, // 4 ev i juli, 1 synliga
    { slug: 'UkrainianCultureInSweden', name: 'Ukrainian Culture in Sweden /Ukraine Culture Now' }, // 4 ev i juli, 8 synliga
    { slug: 'Upplandsmuseet', name: 'Upplandsmuseet', city: 'Uppsala' }, // 4 ev i juli, 8 synliga
    { slug: 'umefox', name: 'UmeFox' }, // 4 ev i juli, 5 synliga
    { slug: 'afrosvenskarnasforum', name: 'Ubuntu Malmö Filmfestival' }, // 4 ev i juli, 4 synliga
    { slug: 'dalarodyksallskap', name: 'Torvalla sporthall' }, // 4 ev i juli, 8 synliga
    { slug: 'tobbetrollkarl', name: 'Tobbe Trollkarl', city: 'Borlänge' }, // 4 ev i juli, 8 synliga
    { slug: 'TeaterDictat', name: 'Teater Dictat' }, // 4 ev i juli, 3 synliga
    { slug: 'solvesborgcsk', name: 'Svartaled' }, // 4 ev i juli, 2 synliga
    { slug: 'tangojamt', name: 'TangoJamt' }, // 4 ev i juli, 1 synliga
    { slug: 'spiritofmansweden', name: 'Spirit of Man' }, // 4 ev i juli, 2 synliga
    { slug: 'SmalandsVillan', name: 'SmålandsVillan', city: 'Visby' }, // 4 ev i juli, 3 synliga
    { slug: 'skanskabyggvaror', name: 'Skånska Byggvaror', city: 'Göteborg' }, // 4 ev i juli, 8 synliga
    { slug: 'skovdeyogacentrum', name: 'Skövde YogaCentrum', city: 'Skövde' }, // 4 ev i juli, 3 synliga
    { slug: 'seniortraffen', name: 'Seniorträffen, Oxelösund' }, // 4 ev i juli, 5 synliga
    { slug: 'SalemStavanger', name: 'Salem Stavanger' }, // 4 ev i juli, 1 synliga
    { slug: 'miguel.delgado.3998', name: 'SALSA i VARBERG', city: 'Varberg' }, // 4 ev i juli, 1 synliga
    { slug: 'rodakvarnhbg', name: 'Röda Kvarn Helsingborg', city: 'Helsingborg' }, // 4 ev i juli, 8 synliga
    { slug: 'rimboprastgard', name: 'Rimbo Prästgård' }, // 4 ev i juli, 4 synliga
    { slug: 'pustervik', name: 'Pustervik' }, // 4 ev i juli, 8 synliga
    { slug: 'Nostalgiklubben', name: 'Nostalgiklubben' }, // 4 ev i juli, 6 synliga
    { slug: 'nordicsociety.org', name: 'Nordic society', city: 'Stockholm' }, // 4 ev i juli, 3 synliga
    { slug: 'naturumblekinge', name: 'Naturum Blekinge', city: 'Ronneby' }, // 4 ev i juli, 2 synliga
    { slug: 'nfacademy', name: 'NF Academy' }, // 4 ev i juli, 4 synliga
    { slug: 'nkvillan.nyk', name: 'NK-villan', city: 'Nyköping' }, // 4 ev i juli, 8 synliga
    { slug: 'musikvalvetbaggen', name: 'Musikvalvet Baggen' }, // 4 ev i juli, 8 synliga
    { slug: 'mats.fuchs.9', name: 'Mats Fuchs' }, // 4 ev i juli, 1 synliga
    { slug: 'magasinetfalun', name: 'Magasinet Falun', city: 'Falun' }, // 4 ev i juli, 8 synliga
    { slug: 'lommaflotten', name: 'LommaFlotten' }, // 4 ev i juli, 2 synliga
    { slug: 'lokstallet.skovde', name: 'Lokstallet', city: 'Skövde' }, // 4 ev i juli, 8 synliga
    { slug: 'kristnaregnbagsrorelsen', name: 'Kristna regnbågsrörelsen - Riksförbundet EKHO', city: 'Göteborg' }, // 4 ev i juli, 6 synliga
    { slug: 'kollektivkrogen', name: 'Kollektivkrogen' }, // 4 ev i juli, 8 synliga
    { slug: 'konstframjandet.skane', name: 'Konstfrämjandet Skåne' }, // 4 ev i juli, 5 synliga
    { slug: 'klingsbergsforlagab', name: 'Klingsbergs Förlag AB', city: 'Norrköping' }, // 4 ev i juli, 1 synliga
    { slug: 'icfalkenberg', name: 'IC Falkenberg', city: 'Falkenberg' }, // 4 ev i juli, 8 synliga
    { slug: 'jonkopingcity', name: 'Jönköping City', city: 'Jönköping' }, // 4 ev i juli, 2 synliga
    { slug: 'lena.lingensjo', name: 'Härnösands damer', city: 'Härnösand' }, // 4 ev i juli, 2 synliga
    { slug: 'hypoteket', name: 'HYPOTEKET', city: 'Lund' }, // 4 ev i juli, 4 synliga
    { slug: 'goteborgs.botaniska.tradgard', name: 'Göteborgs botaniska trädgård' }, // 4 ev i juli, 4 synliga
    { slug: 'goteborgsstad', name: 'Göteborgs Stad', city: 'Göteborg' }, // 4 ev i juli, 5 synliga
    { slug: 'Glimmingehus', name: 'Glimmingehus' }, // 4 ev i juli, 2 synliga
    { slug: 'artstheatregeorge', name: 'George Arts Theatre' }, // 4 ev i juli, 3 synliga
    { slug: 'Kulturhjaltarna', name: 'Folkets Hus Norrtälje - Norrtälje kulturhus', city: 'Norrtälje' }, // 4 ev i juli, 8 synliga
    { slug: 'ericbergstroom', name: 'Eric Bergström', city: 'Jönköping' }, // 4 ev i juli, 1 synliga
    { slug: 'eskilstunakompaniet', name: 'Eskilstunakompaniet', city: 'Eskilstuna' }, // 4 ev i juli, 8 synliga
    { slug: 'DocLoungeMalmo', name: 'Doc Lounge Malmö' }, // 4 ev i juli, 6 synliga
    { slug: 'doroteabibliotek', name: 'Dorotea bibliotek / Kraapohken gærjagåetie' }, // 4 ev i juli, 8 synliga
    { slug: 'drammenkulturhus', name: 'Drammen kulturhus' }, // 4 ev i juli, 8 synliga
    { slug: 'ckwano1', name: 'CK Wano', city: 'Varberg' }, // 4 ev i juli, 1 synliga
    { slug: 'clarionsundsvall', name: 'Clarion Hotel Sundsvall', city: 'Sundsvall' }, // 4 ev i juli, 2 synliga
    { slug: 'boulognerskogenparkrun', name: 'Boulognerskogen parkrun, Gävle', city: 'Gävle' }, // 4 ev i juli, 3 synliga
    { slug: 'borjessonsbil', name: 'Börjessons Bil', city: 'Karlskrona' }, // 4 ev i juli, 8 synliga
    { slug: 'MuseetBollnasKonsthall', name: 'Bollnäs Museum & Konsthall' }, // 4 ev i juli, 2 synliga
    { slug: 'boca.vasteras', name: 'Boca Västerås', city: 'Västerås' }, // 4 ev i juli, 2 synliga
    { slug: 'BibliotekeniJonkoping', name: 'Biblioteken i Jönköping', city: 'Jönköping' }, // 4 ev i juli, 8 synliga
    { slug: 'bergsakers', name: 'Bergsåker', city: 'Sundsvall' }, // 4 ev i juli, 3 synliga
    { slug: 'avtrycktjorn', name: 'Avtryck Tjörn 9-11 oktober 2026' }, // 4 ev i juli, 8 synliga
    { slug: 'alvestabibliotek', name: 'Biblioteken i Alvesta kommun' }, // 4 ev i juli, 7 synliga
    { slug: 'mountainfilm', name: 'Banff Mountain Film Festival Scandinavia', city: 'Falun' }, // 4 ev i juli, 3 synliga
    { slug: 'arenahagmyren', name: 'Arena Hagmyren', city: 'Hudiksvall' }, // 4 ev i juli, 3 synliga
    { slug: 'alingsaskulturhus', name: 'Alingsås kulturhus', city: 'Alingsås' }, // 4 ev i juli, 3 synliga
    { slug: 'alexhermanssonshow', name: 'Alex Hermansson', city: 'Lund' }, // 4 ev i juli, 8 synliga
    { slug: 'abfnorrkalix', name: 'ABF Norr Kalix' }, // 4 ev i juli, 5 synliga
    { slug: 'yoga121.se', name: 'Yoga 121', city: 'Hudiksvall' }, // 3 ev i juli, 3 synliga
    { slug: 'winterviken', name: 'Winterviken', city: 'Stockholm' }, // 3 ev i juli, 4 synliga
    { slug: 'vasterascity', name: 'Västerås City', city: 'Västerås' }, // 3 ev i juli, 8 synliga
    { slug: 'VisbyRoma', name: 'Visby Roma Hockey', city: 'Visby' }, // 3 ev i juli, 8 synliga
    { slug: 'vikkysKonst', name: 'Vikkys Konst', city: 'Linköping' }, // 3 ev i juli, 3 synliga
    { slug: 'AspelandsMusikforening', name: 'Valhall Hultsfred' }, // 3 ev i juli, 3 synliga
    { slug: 'uppsalakammarorkester', name: 'Uppsala Kammarorkester', city: 'Uppsala' }, // 3 ev i juli, 8 synliga
    { slug: 'TyresoRoyalCrowns', name: 'Tyresö Royal Crowns' }, // 3 ev i juli, 8 synliga
    { slug: 'NattklubbTradgarn', name: 'Trädgår\'n Nattklubb' }, // 3 ev i juli, 8 synliga
    { slug: 'rpsb50', name: 'TRENDERs' }, // 3 ev i juli, 8 synliga
    { slug: 'TormekSharpeningInnovation', name: 'Tormek', city: 'Lindesberg' }, // 3 ev i juli, 2 synliga
    { slug: 'soderbarkeparken', name: 'Söderbärkeparken' }, // 3 ev i juli, 3 synliga
    { slug: 'studiomalinfredrika', name: 'Studio Malin Fredrika', city: 'Kristinehamn' }, // 3 ev i juli, 1 synliga
    { slug: 'royal.roland.5623', name: 'SoundTrack Roland' }, // 3 ev i juli, 2 synliga
    { slug: 'SoulRelax.Motala', name: 'SoulRelax', city: 'Motala' }, // 3 ev i juli, 3 synliga
    { slug: 'skovdeaik', name: 'Skövde AIK', city: 'Skövde' }, // 3 ev i juli, 2 synliga
    { slug: 'sagateaterboras', name: 'Sagateatern', city: 'Borås' }, // 3 ev i juli, 8 synliga
    { slug: 'spkroslagssektionen', name: 'SPK Svenska Pudelklubbens Roslagssektion', city: 'Norrtälje' }, // 3 ev i juli, 4 synliga
    { slug: 'kristina.blad', name: 'SHETLAND MITT' }, // 3 ev i juli, 1 synliga
    { slug: 'rodakvarnkultur', name: 'Röda Kvarn Kultur' }, // 3 ev i juli, 8 synliga
    { slug: 'rehnsbk', name: 'Rehns BK' }, // 3 ev i juli, 1 synliga
    { slug: 'satssverige', name: 'SATS Sverige', city: 'Stockholm' }, // 3 ev i juli, 5 synliga
    { slug: 'pinkprogramming', name: 'Pink Programming' }, // 3 ev i juli, 2 synliga
    { slug: 'pifdam', name: 'PIF Damfotboll' }, // 3 ev i juli, 8 synliga
    { slug: 'nordboetnorrkoping', name: 'Nördboet', city: 'Norrköping' }, // 3 ev i juli, 1 synliga
    { slug: 'nojeskompanietmorrum', name: 'Nöjeskompaniet', city: 'Hässleholm' }, // 3 ev i juli, 1 synliga
    { slug: 'naringslivmonsteraskommun', name: 'Näringsliv Mönsterås kommun' }, // 3 ev i juli, 2 synliga
    { slug: 'hotellmullsjo', name: 'Mullsjö Hotell & Konferens' }, // 3 ev i juli, 3 synliga
    { slug: 'musikisydmalmo', name: 'Musik i Syd Malmö' }, // 3 ev i juli, 6 synliga
    { slug: 'M.Dans.F', name: 'Mer Dans åt Folket', city: 'Eskilstuna' }, // 3 ev i juli, 2 synliga
    { slug: 'malmostad', name: 'Malmö stad' }, // 3 ev i juli, 2 synliga
    { slug: 'lyckselemusikoteater', name: 'Lycksele Musik & Teaterförening-en del av Riksteatern', city: 'Lycksele' }, // 3 ev i juli, 3 synliga
    { slug: 'MariaSandelsallskapet', name: 'Maria Sandel' }, // 3 ev i juli, 8 synliga
    { slug: 'Lollipopsoderhamn', name: 'Lollipop Music Bar & Diner', city: 'Söderhamn' }, // 3 ev i juli, 8 synliga
    { slug: 'ovewenchelarsuno', name: 'Ljungby', city: 'Ljungby' }, // 3 ev i juli, 8 synliga
    { slug: 'guideklubben83', name: 'Linköpings Guideklubb' }, // 3 ev i juli, 8 synliga
    { slug: 'LandskronaTeater', name: 'Landskrona Teater', city: 'Landskrona' }, // 3 ev i juli, 8 synliga
    { slug: 'LandskronaMusikochTeater', name: 'Landskrona Musik & Teater - en del av Riksteatern', city: 'Landskrona' }, // 3 ev i juli, 7 synliga
    { slug: 'theshipchristchurch', name: 'Laughing Bellys' }, // 3 ev i juli, 8 synliga
    { slug: 'LandskronaBK', name: 'Landskrona Brukshundklubb', city: 'Landskrona' }, // 3 ev i juli, 2 synliga
    { slug: 'kungligaslotten', name: 'Kungliga Slotten' }, // 3 ev i juli, 4 synliga
    { slug: 'gallivare.se', name: 'Kulturfest', city: 'Gällivare' }, // 3 ev i juli, 7 synliga
    { slug: 'konsertpuls', name: 'KonsertPuls' }, // 3 ev i juli, 4 synliga
    { slug: 'jiversdancingclub', name: 'Jivers Dancing Club' }, // 3 ev i juli, 8 synliga
    { slug: 'konsertkongress', name: 'Kultur For Folket', city: 'Linköping' }, // 3 ev i juli, 8 synliga
    { slug: 'kraniosakralterapihastochmanniska', name: 'Jennies HelhetsHälsa' }, // 3 ev i juli, 2 synliga
    { slug: 'municipiodefaro', name: 'Jardim da Alameda' }, // 3 ev i juli, 8 synliga
    { slug: 'michael.haggmark.1', name: 'JLS Jämtlands Lokalhistoriker och Släktforskare' }, // 3 ev i juli, 2 synliga
    { slug: 'boltic', name: 'IF Boltic', city: 'Karlstad' }, // 3 ev i juli, 1 synliga
    { slug: 'huddingeparkrun', name: 'Huddinge Parkrun' }, // 3 ev i juli, 8 synliga
    { slug: 'hedemorafolketspark', name: 'Hedemora Folkets Park' }, // 3 ev i juli, 8 synliga
    { slug: 'gavlekonserthus', name: 'Gävle Konserthus', city: 'Gävle' }, // 3 ev i juli, 6 synliga
    { slug: 'GrastorpsBygdegardsforening', name: 'Grästorps Bygdegårdsförening' }, // 3 ev i juli, 5 synliga
    { slug: 'helsingborgcity', name: 'HBG City' }, // 3 ev i juli, 5 synliga
    { slug: 'grandliveab', name: 'Grand Live', city: 'Eskilstuna' }, // 3 ev i juli, 8 synliga
    { slug: 'gamlahalmstad', name: 'Gamla Halmstad', city: 'Halmstad' }, // 3 ev i juli, 5 synliga
    { slug: 'FolkteaternGbg', name: 'Folkteatern Göteborg', city: 'Göteborg' }, // 3 ev i juli, 7 synliga
    { slug: 'billy.affelin', name: 'Fiskeevent och Fisketävlingar(i samarbete med Sfk Westrogothia)' }, // 3 ev i juli, 1 synliga
    { slug: 'fhuddevalla', name: 'Folkets Hus Uddevalla', city: 'Uddevalla' }, // 3 ev i juli, 5 synliga
    { slug: 'ekobutikosterlen', name: 'Fairys & Friends Ekohandel' }, // 3 ev i juli, 1 synliga
    { slug: 'fernandascafeet', name: 'Fernandas Konditori & Bageri', city: 'Staffanstorp' }, // 3 ev i juli, 1 synliga
    { slug: 'sjobosimanlaggning', name: 'FUB Sjöbo', city: 'Sjöbo' }, // 3 ev i juli, 8 synliga
    { slug: 'europadirektvasternorrland', name: 'Europa Direkt Västernorrland' }, // 3 ev i juli, 1 synliga
    { slug: 'eyragarden', name: 'Eyragården, Kävlinge Kommun den onsdag, oktober 7 2026' }, // 3 ev i juli, 4 synliga
    { slug: 'EncoreSundbyberg', name: 'Encore, Sundbyberg' }, // 3 ev i juli, 8 synliga
    { slug: 'dancetogether.se', name: 'Dance Together', city: 'Eskilstuna' }, // 3 ev i juli, 8 synliga
    { slug: 'cirkusmuseet', name: 'Cirkusmuseet' }, // 3 ev i juli, 2 synliga
    { slug: 'BrassUnit', name: 'BrassUnit', city: 'Sandviken' }, // 3 ev i juli, 8 synliga
    { slug: 'borlangekommun', name: 'Borlänge kommun', city: 'Borlänge' }, // 3 ev i juli, 1 synliga
    { slug: '61563974404293', name: 'Blå Elefanten' }, // 3 ev i juli, 3 synliga
    { slug: 'bohusfastning', name: 'Bohus Fästning' }, // 3 ev i juli, 7 synliga
    { slug: 'BokskogeniTorup', name: 'Bokskogen i Torup' }, // 3 ev i juli, 5 synliga
    { slug: 'biograffokusjonkoping', name: 'Biograf Fokus Jönköping', city: 'Jönköping' }, // 3 ev i juli, 8 synliga
    { slug: 'befreenow.se', name: 'Befreenow' }, // 3 ev i juli, 6 synliga
    { slug: 'nordenkarlshamnsolvesborg', name: 'Bellevueparken Karlshamn', city: 'Karlshamn' }, // 3 ev i juli, 8 synliga
    { slug: 'annkiochklas', name: 'Annki & Klas' }, // 3 ev i juli, 3 synliga
    { slug: 'allmannasangenvisby', name: 'Allmänna Sången Visby', city: 'Visby' }, // 3 ev i juli, 5 synliga
    { slug: 'backayardbeats', name: 'Back a Yard Beats', city: 'Stockholm' }, // 3 ev i juli, 4 synliga
    { slug: 'AlingsasHK', name: 'Alingsås HK', city: 'Alingsås' }, // 3 ev i juli, 1 synliga
    { slug: 'harkekonstcentrum', name: 'Ahlbergshallen' }, // 3 ev i juli, 1 synliga
    { slug: 'adasteater', name: 'ADAS teater', city: 'Göteborg' }, // 3 ev i juli, 3 synliga
    { slug: 'ovrehalsinglandshemslojdsforening', name: 'Övre Hälsinglands hemslöjdsförening', city: 'Hudiksvall' }, // 2 ev i juli, 2 synliga
    { slug: 'alvsbynsbibliotek', name: 'Älvsbyns Bibliotek' }, // 2 ev i juli, 6 synliga
    { slug: 'ystadicentrum', name: 'Ystad i centrum', city: 'Ystad' }, // 2 ev i juli, 2 synliga
    { slug: 'naturumSkrylle', name: 'naturum Skrylle' }, // 2 ev i juli, 1 synliga
    { slug: 'yofcreativepartners', name: 'YOF Creative Partners', city: 'Stockholm' }, // 2 ev i juli, 8 synliga
    { slug: 'willhemab', name: 'Willhem AB', city: 'Göteborg' }, // 2 ev i juli, 2 synliga
    { slug: 'Voories1951', name: 'Voorbereidingskool George Preparatory School' }, // 2 ev i juli, 4 synliga
    { slug: 'VintervikensTradgard', name: 'Vintervikens Trädgård', city: 'Stockholm' }, // 2 ev i juli, 8 synliga
    { slug: 'Vikarvet', name: 'Vikarvet Kulturhistoriskt Sällskap' }, // 2 ev i juli, 1 synliga
    { slug: 'everypadelkopparlunden', name: 'Vamos Padel' }, // 2 ev i juli, 4 synliga
    { slug: 'valbokopcentrum', name: 'Valbo köpcentrum' }, // 2 ev i juli, 2 synliga
    { slug: 'umeadansklubb', name: 'Umeå Dansklubb' }, // 2 ev i juli, 8 synliga
    { slug: 'uddevallahem', name: 'Uddevallahem', city: 'Uddevalla' }, // 2 ev i juli, 8 synliga
    { slug: 'tunapark.se', name: 'Tuna Park', city: 'Eskilstuna' }, // 2 ev i juli, 4 synliga
    { slug: 'trinitymusicberlin', name: 'Trinity Music' }, // 2 ev i juli, 8 synliga
    { slug: 'tjorn.bibliotek', name: 'Tjörns kommunbibliotek' }, // 2 ev i juli, 4 synliga
    { slug: 'timraik.se', name: 'Timrå IK' }, // 2 ev i juli, 1 synliga
    { slug: 'TibroRF', name: 'Tibro Ryttarförening' }, // 2 ev i juli, 1 synliga
    { slug: 'Thimouryoga', name: 'Thimour Yoga', city: 'Borås' }, // 2 ev i juli, 2 synliga
    { slug: 'tillsammansforkumla', name: 'Tillsammans för Kumla' }, // 2 ev i juli, 8 synliga
    { slug: 'tangovarberg', name: 'Tango Varberg', city: 'Varberg' }, // 2 ev i juli, 3 synliga
    { slug: 'syfestivalen', name: 'Sy- & Hantverksfestivalen - mässan för kreativa sinnen' }, // 2 ev i juli, 1 synliga
    { slug: 'sverigesradio', name: 'Sveriges Radio' }, // 2 ev i juli, 8 synliga
    { slug: 'studieframjandetumea', name: 'Studiefrämjandet Västerbotten' }, // 2 ev i juli, 7 synliga
    { slug: 'streetfoodskandinavia', name: 'Street Food Skandinavia' }, // 2 ev i juli, 8 synliga
    { slug: 'stenhusetgille', name: 'Stenhuset' }, // 2 ev i juli, 7 synliga
    { slug: 'SpangaHockey', name: 'Spånga Hockey' }, // 2 ev i juli, 8 synliga
    { slug: 'spokguiden', name: 'Spökguiden' }, // 2 ev i juli, 1 synliga
    { slug: 'spacerumforskapande', name: 'Space - Rum för skapande', city: 'Visby' }, // 2 ev i juli, 4 synliga
    { slug: 'skarahf', name: 'Skara HF' }, // 2 ev i juli, 1 synliga
    { slug: 'skelleftea', name: 'Skellefteå kommun' }, // 2 ev i juli, 8 synliga
    { slug: 'skansen', name: 'Skansen', city: 'Stockholm' }, // 2 ev i juli, 1 synliga
    { slug: 'Siggenfriends', name: 'Sigge n Friends' }, // 2 ev i juli, 8 synliga
    { slug: 'sexmasterietiboras', name: 'Sexet I Borås (6-1)', city: 'Borås' }, // 2 ev i juli, 1 synliga
    { slug: 'selangerskyrka', name: 'Selångers Kyrka', city: 'Sundsvall' }, // 2 ev i juli, 8 synliga
    { slug: 'SagasIslandshastar', name: 'Sagas Íshestar' }, // 2 ev i juli, 8 synliga
    { slug: 'SsdkKarlshamn', name: 'SSDK Karlshamn', city: 'Karlshamn' }, // 2 ev i juli, 1 synliga
    { slug: 'bollnasbio', name: 'Röda Kvarn Bollnäs' }, // 2 ev i juli, 1 synliga
    { slug: 'raadalensbk', name: 'Råådalens Brukshundklubb', city: 'Helsingborg' }, // 2 ev i juli, 8 synliga
    { slug: 'rushentlive', name: 'Rush Ent.', city: 'Stockholm' }, // 2 ev i juli, 8 synliga
    { slug: 'Rockhyttan', name: 'Rockhyttan' }, // 2 ev i juli, 1 synliga
    { slug: 'rockefelleroslo', name: 'Rockefeller / John Dee / Sentrum Scene' }, // 2 ev i juli, 8 synliga
    { slug: 'reumatikerforeningenlinkoping', name: 'Reumatikerföreningen Linköping', city: 'Linköping' }, // 2 ev i juli, 4 synliga
    { slug: 'uddevalla.riksteaterforening', name: 'Regionteater Väst' }, // 2 ev i juli, 2 synliga
    { slug: 'regiongotland', name: 'Region Gotland', city: 'Visby' }, // 2 ev i juli, 3 synliga
    { slug: 'PitebygdensMusikforbund', name: 'Pitebygdens Musikförbund' }, // 2 ev i juli, 1 synliga
    { slug: 'RAWcomedyclub', name: 'RAW comedy club' }, // 2 ev i juli, 8 synliga
    { slug: 'paula.gocko', name: 'Paula Gocko' }, // 2 ev i juli, 2 synliga
    { slug: 'petra.kvanna', name: 'Petra Kvännå', city: 'Göteborg' }, // 2 ev i juli, 6 synliga
    { slug: 'ParaplyProduktion', name: 'Paraply' }, // 2 ev i juli, 8 synliga
    { slug: 'palladiummalmo1', name: 'Palladium (Malmö)' }, // 2 ev i juli, 8 synliga
    { slug: 'oslipatuppsala', name: 'Oslipat Uppsala', city: 'Uppsala' }, // 2 ev i juli, 8 synliga
    { slug: 'kavlingeoldtimespub', name: 'Old Times Pub' }, // 2 ev i juli, 4 synliga
    { slug: 'nojesfabriken', name: 'Nöjesfabriken', city: 'Karlstad' }, // 2 ev i juli, 8 synliga
    { slug: 'Nightcruiserskristinehamn', name: 'Nightcruisers Kristinehamn', city: 'Kristinehamn' }, // 2 ev i juli, 1 synliga
    { slug: 'nfharnosand', name: 'Naturskyddsföreningen Härnösand', city: 'Härnösand' }, // 2 ev i juli, 8 synliga
    { slug: 'MonsterasHandel', name: 'Mönsterås Handel', city: 'Kalmar' }, // 2 ev i juli, 2 synliga
    { slug: 'mastersgalleri', name: 'Mästers Galleri - SKHF Skurupsbygdens konst- och hantverksförening' }, // 2 ev i juli, 8 synliga
    { slug: 'Myresjohus', name: 'Myresjöhus' }, // 2 ev i juli, 2 synliga
    { slug: 'MusikiChristinae', name: 'Musik i Christinae', city: 'Alingsås' }, // 2 ev i juli, 6 synliga
    { slug: 'MotalaBasket', name: 'Motala Basket - W72', city: 'Motala' }, // 2 ev i juli, 2 synliga
    { slug: 'Molekylverkstan', name: 'Molekylverkstan' }, // 2 ev i juli, 7 synliga
    { slug: 'MatoNostalgi', name: 'Mat & Nostalgi i Viksjö' }, // 2 ev i juli, 8 synliga
    { slug: 'mashupberlin', name: 'Mash-Up - Multigender / Multiworld' }, // 2 ev i juli, 8 synliga
    { slug: 'statarmuseet', name: 'Malmö Stad' }, // 2 ev i juli, 1 synliga
    { slug: 'malmojazzstory', name: 'Malmö Jazz Story' }, // 2 ev i juli, 6 synliga
    { slug: 'Motorcykelentusiasterna', name: 'MCE - motorcykelentusiasterna' }, // 2 ev i juli, 5 synliga
    { slug: 'liverestaurangen', name: 'Luleå Energi Arena' }, // 2 ev i juli, 1 synliga
    { slug: 'chryssimanurung', name: 'Lux' }, // 2 ev i juli, 4 synliga
    { slug: 'LottasOmtanke', name: 'Lottas Omtanke' }, // 2 ev i juli, 8 synliga
    { slug: 'lidingostadnaringsliv', name: 'Lidingö stad näringsliv' }, // 2 ev i juli, 3 synliga
    { slug: 'linkupbookings', name: 'LinkUp Bookings' }, // 2 ev i juli, 2 synliga
    { slug: 'latinamerikaifokus', name: 'Latinamerika i Fokus' }, // 2 ev i juli, 8 synliga
    { slug: 'lesbisktrumuppsala', name: 'Lesbiskt rum Uppsala', city: 'Uppsala' }, // 2 ev i juli, 7 synliga
    { slug: 'Landskronastad', name: 'Landskrona stad', city: 'Landskrona' }, // 2 ev i juli, 1 synliga
    { slug: 'laila.amrouche', name: 'Laila Amrouche', city: 'Uddevalla' }, // 2 ev i juli, 2 synliga
    { slug: 'LundBigBand', name: 'LUND BIG BAND', city: 'Lund' }, // 2 ev i juli, 8 synliga
    { slug: 'korforalla', name: 'Kör för alla', city: 'Stockholm' }, // 2 ev i juli, 8 synliga
    { slug: 'Dansvirvlar', name: 'Kungälv, Västra Götalands län' }, // 2 ev i juli, 8 synliga
    { slug: 'kulturhusetstadsteatern', name: 'Kulturhuset Stadsteatern' }, // 2 ev i juli, 7 synliga
    { slug: 'kulturhusetmobeln', name: 'Kulturhuset Möbeln' }, // 2 ev i juli, 8 synliga
    { slug: 'kulturhusetbollnas', name: 'Kulturhuset Bollnäs' }, // 2 ev i juli, 8 synliga
    { slug: 'KFKretsen', name: 'Kulturföreningen Kretsen' }, // 2 ev i juli, 3 synliga
    { slug: 'kulturjkpgskommun', name: 'Kultur Jönköpings kommun' }, // 2 ev i juli, 8 synliga
    { slug: 'kristianstadsfilmstudio', name: 'Kristianstads Filmstudio', city: 'Kristianstad' }, // 2 ev i juli, 8 synliga
    { slug: 'kulturonoje', name: 'Kim Kultur&Nöje', city: 'Norrtälje' }, // 2 ev i juli, 2 synliga
    { slug: 'klubbkrinolin', name: 'Krinolin - kammarmusikklubben' }, // 2 ev i juli, 3 synliga
    { slug: 'karlstadskommun', name: 'Karlstads kommun', city: 'Karlstad' }, // 2 ev i juli, 1 synliga
    { slug: 'fastningsmuseet', name: 'Karlsborgs Fästningsmuseum' }, // 2 ev i juli, 5 synliga
    { slug: 'Kapellet.telje', name: 'Kapellet' }, // 2 ev i juli, 8 synliga
    { slug: 'scaniarinkenarena', name: 'Jerry Olsson' }, // 2 ev i juli, 8 synliga
    { slug: 'jan.svensson.9469', name: 'Jan Svensson' }, // 2 ev i juli, 8 synliga
    { slug: 'JacyzHotel', name: 'Jacy\'z Hotel & Resort' }, // 2 ev i juli, 5 synliga
    { slug: 'jamtlimuseum', name: 'Jamtli' }, // 2 ev i juli, 6 synliga
    { slug: 'JTTEventsLtd', name: 'JTT Events' }, // 2 ev i juli, 4 synliga
    { slug: 'harnosandsmusiksallskap', name: 'Härnösands Musiksällskap' }, // 2 ev i juli, 4 synliga
    { slug: 'harnosandfhsk', name: 'Härnösands folkhögskola' }, // 2 ev i juli, 7 synliga
    { slug: 'Huddingekommun', name: 'Huddinge kommun' }, // 2 ev i juli, 8 synliga
    { slug: 'HotellHavanna', name: 'Hotell Havanna', city: 'Varberg' }, // 2 ev i juli, 3 synliga
    { slug: 'homefreevocalband', name: 'Home Free' }, // 2 ev i juli, 8 synliga
    { slug: '100064844764389', name: 'Herrljunga Folkets Park' }, // 2 ev i juli, 8 synliga
    { slug: 'studentconsulting', name: 'Helsingborg, Skåne län', city: 'Helsingborg' }, // 2 ev i juli, 1 synliga
    { slug: 'malinstang.se', name: 'Hamra Trail Run' }, // 2 ev i juli, 3 synliga
    { slug: 'HagarMalinHellkvistSellen', name: 'Hagar Malin Hellkvist Sellèn' }, // 2 ev i juli, 3 synliga
    { slug: 'halmstadsteater', name: 'Halmstads Teater' }, // 2 ev i juli, 8 synliga
    { slug: 'gallivarekultur', name: 'Gällivare Kultur', city: 'Gällivare' }, // 2 ev i juli, 6 synliga
    { slug: 'gronalundstivoli', name: 'Gröna Lund', city: 'Stockholm' }, // 2 ev i juli, 2 synliga
    { slug: 'grumsbio', name: 'Grums Bio' }, // 2 ev i juli, 7 synliga
    { slug: 'GamlaLanthandeln', name: 'Gamla Lanthandeln' }, // 2 ev i juli, 8 synliga
    { slug: 'StudieframjandetNorrbotten', name: 'GROP' }, // 2 ev i juli, 4 synliga
    { slug: 'frirumsandviken', name: 'Frirum Sandviken', city: 'Sandviken' }, // 2 ev i juli, 8 synliga
    { slug: 'fredheimarena', name: 'Fredheim Arena' }, // 2 ev i juli, 2 synliga
    { slug: 'grekiskaostersund', name: 'GREKISKA grill & bar (Östersund)' }, // 2 ev i juli, 3 synliga
    { slug: 'FargegatenStavanger', name: 'Fargegaten' }, // 2 ev i juli, 8 synliga
    { slug: 'fagerstascouterna', name: 'Fagersta Scoutkår' }, // 2 ev i juli, 8 synliga
    { slug: 'essenseikiruna', name: 'Essense - Helhetscenter', city: 'Kiruna' }, // 2 ev i juli, 1 synliga
    { slug: 'DestinationHassleholm', name: 'Destination Hässleholm', city: 'Hässleholm' }, // 2 ev i juli, 3 synliga
    { slug: 'denvitaliljan', name: 'Den Vita Liljan' }, // 2 ev i juli, 1 synliga
    { slug: 'dansnu', name: 'Dans Nu Uddevalla', city: 'Uddevalla' }, // 2 ev i juli, 2 synliga
    { slug: 'Dansalliansen', name: 'Dansalliansen' }, // 2 ev i juli, 1 synliga
    { slug: 'djquizmedslimvic', name: 'DJ QUIZ med SLIM VIC', city: 'Gävle' }, // 2 ev i juli, 2 synliga
    { slug: 'charlottepolsonkonsert', name: 'Charlotte Polson - konsert' }, // 2 ev i juli, 1 synliga
    { slug: 'centralastadsrum', name: 'Centrala Stadsrum', city: 'Falun' }, // 2 ev i juli, 1 synliga
    { slug: 'carliahotelresort', name: 'Carlia Hotel & Resort', city: 'Uddevalla' }, // 2 ev i juli, 3 synliga
    { slug: 'musikenshusgbg', name: 'Café Hängmattan' }, // 2 ev i juli, 8 synliga
    { slug: 'c4shopping', name: 'C4 Shopping', city: 'Kristianstad' }, // 2 ev i juli, 1 synliga
    { slug: 'cafehelaideella', name: 'Café HELA ideella Landskrona', city: 'Landskrona' }, // 2 ev i juli, 8 synliga
    { slug: 'BollebygdsRidklubb', name: 'Bollebygds Ridklubb' }, // 2 ev i juli, 8 synliga
    { slug: 'Blojupproret', name: 'Blöjupproret, Sveriges förening för EC och tygblöjor', city: 'Lund' }, // 2 ev i juli, 8 synliga
    { slug: 'BlaKaktus', name: 'Bluesföreningen Blå Kaktus' }, // 2 ev i juli, 8 synliga
    { slug: 'BestermanAB', name: 'Besterman', city: 'Linköping' }, // 2 ev i juli, 8 synliga
    { slug: 'ArtFocusSverige', name: 'Birka Auktioner' }, // 2 ev i juli, 3 synliga
    { slug: 'bergenlive', name: 'Bergen Live' }, // 2 ev i juli, 8 synliga
    { slug: 'beehivestationfoodcarts', name: 'BeeHive Station Food Pod' }, // 2 ev i juli, 1 synliga
    { slug: 'BTHofficiell', name: 'BTH - Blekinge Tekniska Högskola', city: 'Karlskrona' }, // 2 ev i juli, 2 synliga
    { slug: 'autismblekinge', name: 'Autism Blekinge', city: 'Olofström' }, // 2 ev i juli, 1 synliga
    { slug: 'atalantegbg', name: 'Atalante' }, // 2 ev i juli, 2 synliga
    { slug: 'annikaelinderoth', name: 'Annika E Linderoth', city: 'Lund' }, // 2 ev i juli, 1 synliga
    { slug: 'angustheultimatetribute', name: 'Angus - The Ultimate Tribute' }, // 2 ev i juli, 8 synliga
    { slug: 'Hjovidvattern', name: 'Ahlins Gasmix' }, // 2 ev i juli, 8 synliga
    { slug: 'alingsaskommun', name: 'Alingsås kommun', city: 'Alingsås' }, // 2 ev i juli, 8 synliga
    { slug: 'dalarna.abf', name: 'ABF Dalarna', city: 'Borlänge' }, // 2 ev i juli, 1 synliga
];
