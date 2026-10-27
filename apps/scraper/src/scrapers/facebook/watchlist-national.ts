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
    { slug: 'granelundsodlingar', name: 'Visit Örebro' }, // 125 ev i juli, 1 synliga
    { slug: 'kalixkommun', name: 'Kalix Kommun', city: 'Luleå' }, // 74 ev i juli, 7 synliga
    { slug: 'nieuscene', name: 'Nieu Torshov' }, // 59 ev i juli, 7 synliga
    { slug: 'vaxjobibliotek', name: 'Växjö bibliotek' }, // 57 ev i juli, 8 synliga
    { slug: 'gkmmsplit', name: 'Gradska knjiznica Marka Marulica Split' }, // 54 ev i juli, 8 synliga
    { slug: 'studioexpress.se', name: 'Studioexpress.se', city: 'Sundsvall' }, // 53 ev i juli, 8 synliga
    { slug: 'StudieforbundetVuxenskolanVast', name: 'Studieförbundet Vuxenskolan Väst', city: 'Göteborg' }, // 43 ev i juli, 5 synliga
    { slug: 'kulturaktiebolaget', name: 'Kulturaktiebolaget', city: 'Stockholm' }, // 43 ev i juli, 8 synliga
    { slug: 'KulturcentrumSandviken', name: 'Kulturcentrum Sandviken', city: 'Sandviken' }, // 36 ev i juli, 7 synliga
    { slug: 'guppyentertainmentab', name: 'Guppy Entertainment', city: 'Borås' }, // 35 ev i juli, 8 synliga
    { slug: 'Debasersthlm', name: 'Debaser', city: 'Stockholm' }, // 34 ev i juli, 7 synliga
    { slug: 'stockholmjazz', name: 'Stockholm Jazz Festival', city: 'Stockholm' }, // 31 ev i juli, 8 synliga
    { slug: 'livenationswe', name: 'Live Nation Sweden', city: 'Stockholm' }, // 31 ev i juli, 8 synliga
    { slug: 'planbmalmo', name: 'Plan B - malmö' }, // 28 ev i juli, 8 synliga
    { slug: 'Musikhuset', name: 'Musikhuset Gävle', city: 'Gävle' }, // 28 ev i juli, 8 synliga
    { slug: 'Megascope', name: 'Megascope' }, // 28 ev i juli, 8 synliga
    { slug: 'FKPscorpiosweden', name: 'FKP Scorpio Sverige', city: 'Stockholm' }, // 28 ev i juli, 8 synliga
    { slug: 'Vaxjodyksport', name: 'Växjödyksport', city: 'Växjö' }, // 27 ev i juli, 8 synliga
    { slug: '61587843912500', name: 'Skinnskattebergs Kommun' }, // 27 ev i juli, 6 synliga
    { slug: 'csnoje.se', name: 'CS Nöje', city: 'Karlstad' }, // 27 ev i juli, 8 synliga
    { slug: 'folkuniversitetetregionsyd', name: 'Folkuniversitetet Syd', city: 'Helsingborg' }, // 27 ev i juli, 8 synliga
    { slug: 'Scalateatern', name: 'Scalateatern i Karlstad', city: 'Karlstad' }, // 26 ev i juli, 8 synliga
    { slug: 'folkuniversitetetvisby', name: 'Folkuniversitetet Visby', city: 'Visby' }, // 25 ev i juli, 7 synliga
    { slug: 'stormspakhus', name: 'Storms Pakhus' }, // 24 ev i juli, 7 synliga
    { slug: 'Honggymnastikforening', name: 'Høng GF' }, // 24 ev i juli, 8 synliga
    { slug: 'latinamerikaifokus', name: 'Latinamerika i Fokus' }, // 23 ev i juli, 4 synliga
    { slug: 'Kulturenshus', name: 'Kulturens hus Luleå' }, // 23 ev i juli, 6 synliga
    { slug: 'hyltebiblioteken', name: 'Hyltebiblioteken' }, // 23 ev i juli, 7 synliga
    { slug: 'jazzclubfasching', name: 'Fasching' }, // 23 ev i juli, 8 synliga
    { slug: 'ABFsorm', name: 'ABF Sörmland', city: 'Eskilstuna' }, // 23 ev i juli, 8 synliga
    { slug: 'rockefelleroslo', name: 'Rockefeller / John Dee / Sentrum Scene' }, // 22 ev i juli, 8 synliga
    { slug: 'dismitt', name: 'Dis-Mitt', city: 'Gävle' }, // 22 ev i juli, 8 synliga
    { slug: 'Ostgota', name: 'Östgöta Nation', city: 'Lund' }, // 21 ev i juli, 8 synliga
    { slug: 'kramforsbibliotek', name: 'Kramfors bibliotek' }, // 21 ev i juli, 8 synliga
    { slug: 'enkopingskommunbibliotek', name: 'Enköpings kommunbibliotek', city: 'Enköping' }, // 21 ev i juli, 8 synliga
    { slug: 'BorasDansforening', name: 'Borås Dansförening', city: 'Borås' }, // 21 ev i juli, 5 synliga
    { slug: 'allthingslivesweden', name: 'All Things Live Sweden', city: 'Landskrona' }, // 21 ev i juli, 7 synliga
    { slug: 'medborgarskolanjamtland', name: 'Medborgarskolan' }, // 20 ev i juli, 8 synliga
    { slug: 'jubelAB', name: 'Jubel', city: 'Västerås' }, // 20 ev i juli, 8 synliga
    { slug: 'svinorrabohuslan', name: 'Studieförbundet Vuxenskolan i Norra Bohuslän' }, // 19 ev i juli, 8 synliga
    { slug: 'Smalands', name: 'Smålands Nation', city: 'Lund' }, // 19 ev i juli, 4 synliga
    { slug: 'rodakvarnhbg', name: 'Röda Kvarn Helsingborg', city: 'Helsingborg' }, // 19 ev i juli, 8 synliga
    { slug: 'NojetKonsert', name: 'Nöjet Konsert AB', city: 'Uppsala' }, // 19 ev i juli, 8 synliga
    { slug: 'krallentertainment', name: 'Krall Entertainment', city: 'Helsingborg' }, // 19 ev i juli, 6 synliga
    { slug: 'baerumkulturhus', name: 'Bærum Kulturhus' }, // 19 ev i juli, 7 synliga
    { slug: 'vrakdykarpensionatet', name: 'Vrakdykarpensionatet' }, // 18 ev i juli, 8 synliga
    { slug: 'svgavleborg', name: 'Studieförbundet Vuxenskolan Gävleborg', city: 'Gävle' }, // 18 ev i juli, 7 synliga
    { slug: 'northeventAB', name: 'Northevent AB', city: 'Jönköping' }, // 18 ev i juli, 8 synliga
    { slug: 'norrlandsoperan', name: 'Norrlandsoperan' }, // 18 ev i juli, 6 synliga
    { slug: 'kulturhusetstadsteatern', name: 'Kulturhuset Stadsteatern' }, // 18 ev i juli, 8 synliga
    { slug: 'Tangokompaniet', name: 'Tangokompaniet' }, // 17 ev i juli, 8 synliga
    { slug: 'Sjoangen', name: 'Sjöängen i Askersund' }, // 17 ev i juli, 6 synliga
    { slug: 'MusikiChristinae', name: 'Musik i Christinae', city: 'Alingsås' }, // 17 ev i juli, 8 synliga
    { slug: 'rodakvarnkulturhus', name: 'Röda Kvarn Kultur' }, // 17 ev i juli, 8 synliga
    { slug: 'NalenStockholm', name: 'Nalen', city: 'Stockholm' }, // 17 ev i juli, 6 synliga
    { slug: 'Moveat.Sweden', name: 'Moveat', city: 'Lund' }, // 17 ev i juli, 8 synliga
    { slug: 'hedvigeleonora', name: 'Hedvig Eleonora kyrka' }, // 17 ev i juli, 6 synliga
    { slug: 'drammenkulturhus', name: 'Drammen kulturhus' }, // 17 ev i juli, 8 synliga
    { slug: 'vastmanlandslansmuseum', name: 'Västmanlands läns museum', city: 'Västerås' }, // 16 ev i juli, 8 synliga
    { slug: 'toccaentertainment', name: 'Tocca Entertainment', city: 'Sundsvall' }, // 16 ev i juli, 3 synliga
    { slug: 'sodertaljestadsscen', name: 'Södertälje stadsscen' }, // 16 ev i juli, 8 synliga
    { slug: 'skogsvargarna', name: 'OK Skogsvargarna' }, // 16 ev i juli, 6 synliga
    { slug: 'parkenkulturhus', name: 'Parken kulturhus' }, // 16 ev i juli, 8 synliga
    { slug: 'mejeriet', name: 'Mejeriet', city: 'Lund' }, // 16 ev i juli, 7 synliga
    { slug: 'KonserthusetStockholm', name: 'Konserthuset Stockholm', city: 'Stockholm' }, // 16 ev i juli, 8 synliga
    { slug: 'kollektivetlivetbar', name: 'Kollektivet Livet' }, // 16 ev i juli, 8 synliga
    { slug: 'kalmarnationlund', name: 'Kalmar Nation', city: 'Lund' }, // 16 ev i juli, 6 synliga
    { slug: 'hemfranderome', name: 'Hem från Derome', city: 'Varberg' }, // 16 ev i juli, 2 synliga
    { slug: 'BrassUnit', name: 'BrassUnit', city: 'Lidköping' }, // 16 ev i juli, 8 synliga
    { slug: 'vadstenabibliotek', name: 'Vadstena bibliotek' }, // 15 ev i juli, 5 synliga
    { slug: 'tingsrydsbibliotekochkultur', name: 'Tingsryds bibliotek och kultur' }, // 15 ev i juli, 7 synliga
    { slug: 'SundsvallsStadsbibliotek', name: 'Sundsvalls Stadsbibliotek', city: 'Sundsvall' }, // 15 ev i juli, 8 synliga
    { slug: 'situpcomedy', name: 'Sit-up comedy show' }, // 15 ev i juli, 3 synliga
    { slug: 'SanktJohanneskyrka', name: 'Sankt Johannes kyrka, Malmö' }, // 15 ev i juli, 8 synliga
    { slug: 'livenationnorway', name: 'Live Nation Norway' }, // 15 ev i juli, 7 synliga
    { slug: 'halmstadsteater', name: 'Halmstads Teater' }, // 15 ev i juli, 8 synliga
    { slug: 'attentionmolndal', name: 'Attention Mölndal' }, // 15 ev i juli, 6 synliga
    { slug: 'gotlandsmuseum', name: 'Gotlands Museum', city: 'Visby' }, // 15 ev i juli, 6 synliga
    { slug: 'seniorikungsbacka', name: 'Senior i Kungsbacka', city: 'Kungsbacka' }, // 14 ev i juli, 7 synliga
    { slug: 'malmolive', name: 'Malmö Live' }, // 14 ev i juli, 6 synliga
    { slug: 'kollektivkrogen', name: 'Kollektivkrogen' }, // 14 ev i juli, 8 synliga
    { slug: 'gavlebibliotek', name: 'Gävle bibliotek', city: 'Gävle' }, // 14 ev i juli, 8 synliga
    { slug: 'gemenskapikungsor', name: 'Gemenskap i Kungsör' }, // 14 ev i juli, 7 synliga
    { slug: 'bibliotekeniboras', name: 'Biblioteken i Borås', city: 'Borås' }, // 14 ev i juli, 8 synliga
    { slug: 'alltpascen', name: 'Allt På Scen & Mycke Nöje', city: 'Gävle' }, // 14 ev i juli, 8 synliga
    { slug: 'Victoriateatern', name: 'Victoriateatern Malmö' }, // 13 ev i juli, 4 synliga
    { slug: 'vadhanderistockholm', name: 'Vad som händer i Stockholm', city: 'Stockholm' }, // 13 ev i juli, 5 synliga
    { slug: 'steamhotel', name: 'The Steam Hotel', city: 'Västerås' }, // 13 ev i juli, 5 synliga
    { slug: 'tranemo.bibliotek', name: 'Tranemo bibliotek' }, // 13 ev i juli, 4 synliga
    { slug: 'sigtunastiftelsen', name: 'Sigtunastiftelsen' }, // 13 ev i juli, 5 synliga
    { slug: 'medeltidsmuseet', name: 'Medeltidsmuseet', city: 'Stockholm' }, // 13 ev i juli, 8 synliga
    { slug: 'magasinetfalun', name: 'Magasinet Falun', city: 'Falun' }, // 13 ev i juli, 8 synliga
    { slug: 'Hjaltevadshus', name: 'Hjältevadshus', city: 'Uppsala' }, // 13 ev i juli, 2 synliga
    { slug: 'Landskronabibliotek', name: 'Landskrona bibliotek', city: 'Landskrona' }, // 13 ev i juli, 8 synliga
    { slug: 'alvestabibliotek', name: 'Biblioteken i Alvesta kommun' }, // 13 ev i juli, 8 synliga
    { slug: 'biograffokusjonkoping', name: 'Biograf Fokus Jönköping', city: 'Jönköping' }, // 13 ev i juli, 8 synliga
    { slug: 'vaniumeasida', name: 'Vän i Umeå' }, // 12 ev i juli, 8 synliga
    { slug: 'litensmula', name: 'Vita Huset - En Liten Smula', city: 'Norrtälje' }, // 12 ev i juli, 8 synliga
    { slug: 'uppsalakonsertkongress', name: 'Uppsala Konsert & Kongress', city: 'Uppsala' }, // 12 ev i juli, 8 synliga
    { slug: 'thekaliberroom', name: 'The Kaliber Room', city: 'Uppsala' }, // 12 ev i juli, 8 synliga
    { slug: 'soderhamnsbibblan', name: 'Söderhamns Stadsbibliotek', city: 'Söderhamn' }, // 12 ev i juli, 7 synliga
    { slug: 'svkalmarlan', name: 'Studieförbundet Vuxenskolan Kalmar län', city: 'Kalmar' }, // 12 ev i juli, 8 synliga
    { slug: 'tradgarn', name: 'Trädgår\'n' }, // 12 ev i juli, 8 synliga
    { slug: 'musikvalvetbaggen', name: 'Musikvalvet Baggen' }, // 12 ev i juli, 5 synliga
    { slug: 'lundsallhelgonakyrka', name: 'Lunds Allhelgonakyrka' }, // 12 ev i juli, 4 synliga
    { slug: 'kulturhuseteden', name: 'Kulturhuset Eden' }, // 12 ev i juli, 8 synliga
    { slug: 'HotellHulingen', name: 'Hotell Hulingen' }, // 12 ev i juli, 8 synliga
    { slug: 'estrad.norr', name: 'Estrad Norr' }, // 12 ev i juli, 4 synliga
    { slug: 'bibliotekljusdal', name: 'Biblioteken i Ljusdals kommun' }, // 12 ev i juli, 7 synliga
    { slug: 'ideadrottninghog', name: 'Idé A Drottninghög', city: 'Helsingborg' }, // 12 ev i juli, 8 synliga
    { slug: 'vaxjokommun', name: 'Växjö kommun' }, // 11 ev i juli, 8 synliga
    { slug: 'Sundsvallsmuseum', name: 'Sundsvalls museum' }, // 11 ev i juli, 8 synliga
    { slug: 'oslonye', name: 'Oslo Nye Teater' }, // 11 ev i juli, 8 synliga
    { slug: 'rpsb50', name: 'TRENDERs', city: 'Göteborg' }, // 11 ev i juli, 8 synliga
    { slug: 'Midsommargarden', name: 'Midsommargården' }, // 11 ev i juli, 8 synliga
    { slug: 'planthousehuntersville', name: 'PlantHouse' }, // 11 ev i juli, 8 synliga
    { slug: 'malmodanceweek', name: 'Malmö Dance Week' }, // 11 ev i juli, 8 synliga
    { slug: 'kristinehamnsbibliotek', name: 'Kristinehamns bibliotek', city: 'Kristinehamn' }, // 11 ev i juli, 8 synliga
    { slug: 'goteborgsstad', name: 'Göteborgs Stad', city: 'Göteborg' }, // 11 ev i juli, 5 synliga
    { slug: 'Gummifabriken', name: 'Gummifabriken i Värnamo' }, // 11 ev i juli, 8 synliga
    { slug: 'feverup', name: 'Fever', city: 'Stockholm' }, // 11 ev i juli, 8 synliga
    { slug: 'Eskilstunastadsbibliotek', name: 'Eskilstuna stadsbibliotek', city: 'Eskilstuna' }, // 11 ev i juli, 8 synliga
    { slug: 'cnemanorrkoping', name: 'Cnema', city: 'Norrköping' }, // 11 ev i juli, 8 synliga
    { slug: 'varldskulturmuseet', name: 'Världskulturmuseet' }, // 10 ev i juli, 8 synliga
    { slug: 'bibliotekoupplevelser', name: 'Vingåkers bibliotek' }, // 10 ev i juli, 6 synliga
    { slug: 'trivselhussverige', name: 'Trivselhus', city: 'Karlstad' }, // 10 ev i juli, 3 synliga
    { slug: 'svorebrolan', name: 'Studieförbundet Vuxenskolan Örebro Län', city: 'Lindesberg' }, // 10 ev i juli, 8 synliga
    { slug: 'sarakulturhus', name: 'Sara kulturhus' }, // 10 ev i juli, 5 synliga
    { slug: 'natminkulturhus', name: 'Nationella minoriteters kulturhus' }, // 10 ev i juli, 7 synliga
    { slug: 'lisebergab', name: 'Liseberg' }, // 10 ev i juli, 3 synliga
    { slug: 'inrenatur', name: 'Inre natur' }, // 10 ev i juli, 5 synliga
    { slug: 'eksjobibliotek', name: 'Eksjö stadsbibliotek' }, // 10 ev i juli, 7 synliga
    { slug: 'Bibliotekenilulea', name: 'Biblioteken i Luleå' }, // 10 ev i juli, 8 synliga
    { slug: 'BibliotekeniJonkoping', name: 'Biblioteken i Jönköping', city: 'Jönköping' }, // 10 ev i juli, 8 synliga
    { slug: 'babblarnalive', name: 'Babblarna på scen', city: 'Uppsala' }, // 10 ev i juli, 4 synliga
    { slug: 'arbisnkpg', name: 'Arbis' }, // 10 ev i juli, 8 synliga
    { slug: 'ABFKiruna', name: 'ABF Norr Kiruna', city: 'Kiruna' }, // 10 ev i juli, 8 synliga
    { slug: 'yogaskolan.karlstad', name: 'Yogaskolan Karlstad', city: 'Karlstad' }, // 9 ev i juli, 7 synliga
    { slug: 'tunapark.se', name: 'Tuna Park', city: 'Eskilstuna' }, // 9 ev i juli, 2 synliga
    { slug: 'vallentunadans', name: 'Vallentuna Dans' }, // 9 ev i juli, 6 synliga
    { slug: 'stockholmsmarknader', name: 'Stockholmsmarknader' }, // 9 ev i juli, 5 synliga
    { slug: 'smalandsuppsala', name: 'Smålands nation', city: 'Uppsala' }, // 9 ev i juli, 4 synliga
    { slug: 'SalemsBibliotek', name: 'Salems bibliotek' }, // 9 ev i juli, 8 synliga
    { slug: 'RalingenBibliotek', name: 'Rælingen bibliotek' }, // 9 ev i juli, 8 synliga
    { slug: 'NiklasStromstedtMusic', name: 'Niklas Strömstedt', city: 'Uppsala' }, // 9 ev i juli, 7 synliga
    { slug: 'pitea.se', name: 'Piteå kommun' }, // 9 ev i juli, 5 synliga
    { slug: 'musikilerum', name: 'Musik i Lerum' }, // 9 ev i juli, 8 synliga
    { slug: 'musikidalarna', name: 'Musik i Dalarna', city: 'Falun' }, // 9 ev i juli, 7 synliga
    { slug: 'malmomuseum', name: 'Malmö museum', city: 'Malmö' }, // 9 ev i juli, 4 synliga
    { slug: 'lugersweden', name: 'Luger', city: 'Stockholm' }, // 9 ev i juli, 8 synliga
    { slug: 'movehomesverige', name: 'Movehome', city: 'Karlstad' }, // 9 ev i juli, 1 synliga
    { slug: 'kulturhusetfregatten', name: 'Kulturhuset Fregatten' }, // 9 ev i juli, 6 synliga
    { slug: 'jazzklubbensundsvall.se', name: 'Jazzklubben Sundsvall', city: 'Sundsvall' }, // 9 ev i juli, 8 synliga
    { slug: 'konstmuseet', name: 'Konstmuseet', city: 'Skövde' }, // 9 ev i juli, 6 synliga
    { slug: 'Falkopingsbibliotek', name: 'Falköpings bibliotek' }, // 9 ev i juli, 5 synliga
    { slug: 'hjartatshus', name: 'Hjärtats hus', city: 'Jönköping' }, // 9 ev i juli, 7 synliga
    { slug: 'drakenlive', name: 'Draken Live' }, // 9 ev i juli, 7 synliga
    { slug: 'CirkusStavanger', name: 'CIRKUS' }, // 9 ev i juli, 5 synliga
    { slug: 'backyardfalun', name: 'Backyard Club', city: 'Falun' }, // 9 ev i juli, 4 synliga
    { slug: 'abf.stockholm', name: 'ABF Stockholm', city: 'Stockholm' }, // 9 ev i juli, 6 synliga
    { slug: 'WoodyWestGbg', name: 'Woody West' }, // 8 ev i juli, 8 synliga
    { slug: 'vaxjoloparklubb', name: 'Växjö Löparklubb' }, // 8 ev i juli, 1 synliga
    { slug: 'vilhelmina.folketshus.7', name: 'Vilhelmina Folkets Hus' }, // 8 ev i juli, 5 synliga
    { slug: 'umefox', name: 'UmeFox' }, // 8 ev i juli, 3 synliga
    { slug: 'TheTivoli', name: 'The Tivoli', city: 'Helsingborg' }, // 8 ev i juli, 8 synliga
    { slug: 'malmostadsbibliotek', name: 'Stadsbiblioteket i Malmö' }, // 8 ev i juli, 8 synliga
    { slug: 'shrekraveofficial', name: 'Shrek Rave' }, // 8 ev i juli, 8 synliga
    { slug: 'Reimersholmehotel', name: 'Reimersholme Hotel', city: 'Stockholm' }, // 8 ev i juli, 8 synliga
    { slug: 'junisalvsborgdistrikt', name: 'Movendi Älvsborg', city: 'Borås' }, // 8 ev i juli, 8 synliga
    { slug: 'kungligaslotten', name: 'Kungliga Slotten' }, // 8 ev i juli, 2 synliga
    { slug: 'jkpglm', name: 'Jönköpings läns museum', city: 'Jönköping' }, // 8 ev i juli, 3 synliga
    { slug: 'kulturiale', name: 'Kultur i Ale' }, // 8 ev i juli, 5 synliga
    { slug: 'JacyzHotel', name: 'Jacy\'z Hotel & Resort' }, // 8 ev i juli, 6 synliga
    { slug: 'Hedenstedbibliotekerne', name: 'Hedensted Bibliotekerne' }, // 8 ev i juli, 8 synliga
    { slug: 'eskilstunakompaniet', name: 'Eskilstunakompaniet', city: 'Eskilstuna' }, // 8 ev i juli, 8 synliga
    { slug: 'dansofolkton', name: 'Dans & Folkton' }, // 8 ev i juli, 8 synliga
    { slug: 'cirkus.klub', name: 'Cirkus' }, // 8 ev i juli, 5 synliga
    { slug: 'ckwano1', name: 'CK Wano', city: 'Varberg' }, // 8 ev i juli, 2 synliga
    { slug: 'AlingsasDansklubb', name: 'Alingsås Dansklubb', city: 'Alingsås' }, // 8 ev i juli, 5 synliga
    { slug: 'folketsbiomalmo', name: 'Biograf Panora Malmö' }, // 8 ev i juli, 8 synliga
    { slug: '59anLysekil', name: '59an i Lysekil' }, // 8 ev i juli, 3 synliga
    { slug: 'catscornermalmo', name: 'https://www.facebook.com/groups/', city: 'Stockholm' }, // 7 ev i juli, 6 synliga
    { slug: 'WermlandOpera', name: 'Wermland Opera', city: 'Karlstad' }, // 7 ev i juli, 4 synliga
    { slug: 'yogaheart.nu', name: 'Yogaheart' }, // 7 ev i juli, 3 synliga
    { slug: 'vastmanlandsteater', name: 'Västmanlands Teater', city: 'Västerås' }, // 7 ev i juli, 3 synliga
    { slug: 'VintervikensTradgard', name: 'Vintervikens Trädgård', city: 'Stockholm' }, // 7 ev i juli, 8 synliga
    { slug: 'varnamobibliotekochkultur', name: 'Värnamo bibliotek och kultur' }, // 7 ev i juli, 8 synliga
    { slug: 'Vindelnskommunbibliotek', name: 'Vindelns kommunbibliotek' }, // 7 ev i juli, 5 synliga
    { slug: 'vardagibalans', name: 'Vardag i Balans', city: 'Lund' }, // 7 ev i juli, 2 synliga
    { slug: 'UkrainianCultureInSweden', name: 'Ukrainian Culture in Sweden /Ukraine Culture Now' }, // 7 ev i juli, 6 synliga
    { slug: 'jansvenssontrubadur', name: 'Trubadur Jan Svensson Musik Produktion', city: 'Uddevalla' }, // 7 ev i juli, 8 synliga
    { slug: 'svartebyalag', name: 'Svarte' }, // 7 ev i juli, 4 synliga
    { slug: 'Storlihytta', name: 'Storlihytta' }, // 7 ev i juli, 8 synliga
    { slug: 'silvenska', name: 'Silvénska villan' }, // 7 ev i juli, 3 synliga
    { slug: 'sagabioflen', name: 'Saga Bio, Flen' }, // 7 ev i juli, 3 synliga
    { slug: 'molndalsdansskola', name: 'Mölndals Dansskola' }, // 7 ev i juli, 8 synliga
    { slug: 'moriskapaviljongen', name: 'Moriska Paviljongen' }, // 7 ev i juli, 8 synliga
    { slug: 'Mordmysterium', name: 'Mordmysterium' }, // 7 ev i juli, 3 synliga
    { slug: 'mikespubskovde', name: 'Mikes pub och restaurang', city: 'Skövde' }, // 7 ev i juli, 3 synliga
    { slug: 'louisdegeernorrkoping', name: 'Louis De Geer', city: 'Norrköping' }, // 7 ev i juli, 8 synliga
    { slug: 'lassewinnerback', name: 'Lars Winnerbäck', city: 'Eskilstuna' }, // 7 ev i juli, 8 synliga
    { slug: 'MariaLundqvistOffentlig', name: 'Maria Lundqvist', city: 'Eskilstuna' }, // 7 ev i juli, 5 synliga
    { slug: 'lokstallet.skovde', name: 'Lokstallet', city: 'Skövde' }, // 7 ev i juli, 8 synliga
    { slug: 'kulturcentrumebeneser', name: 'Kulturcentrum Ebeneser' }, // 7 ev i juli, 8 synliga
    { slug: 'kristnaregnbagsrorelsen', name: 'Kristna regnbågsrörelsen - Riksförbundet EKHO' }, // 7 ev i juli, 7 synliga
    { slug: 'kulturbolaget', name: 'Kulturbolaget' }, // 7 ev i juli, 8 synliga
    { slug: 'KSHHealing', name: 'KSH Healing', city: 'Kalmar' }, // 7 ev i juli, 4 synliga
    { slug: 'Furuviksparken', name: 'Furuviksparken' }, // 7 ev i juli, 2 synliga
    { slug: 'solvesborgcsk', name: 'Hjortakroksskolan' }, // 7 ev i juli, 3 synliga
    { slug: 'dragonflystudioavesta', name: 'Dragonfly Studio' }, // 7 ev i juli, 2 synliga
    { slug: 'WheelsOfCarlshamn', name: 'Cykelklubben Wheels Of Carlshamn', city: 'Karlshamn' }, // 7 ev i juli, 2 synliga
    { slug: 'angebibliotek', name: 'Biblioteken i Ånge' }, // 7 ev i juli, 6 synliga
    { slug: 'atalantegbg', name: 'Atalante' }, // 7 ev i juli, 5 synliga
    { slug: 'ostfoldteater', name: 'Østfold Teater' }, // 6 ev i juli, 8 synliga
    { slug: 'q.barsundsvall', name: 'q.bar Sundsvall', city: 'Sundsvall' }, // 6 ev i juli, 6 synliga
    { slug: 'vasterascity', name: 'Västerås City', city: 'Västerås' }, // 6 ev i juli, 8 synliga
    { slug: 'yofcreativepartners', name: 'YOF Creative Partners', city: 'Stockholm' }, // 6 ev i juli, 7 synliga
    { slug: 'VXOevent', name: 'VXO event' }, // 6 ev i juli, 7 synliga
    { slug: 'skovdekulturhus', name: 'Skövde Kulturhus', city: 'Skövde' }, // 6 ev i juli, 8 synliga
    { slug: 'skovdeyogacentrum', name: 'Skövde YogaCentrum', city: 'Skövde' }, // 6 ev i juli, 2 synliga
    { slug: 'scenknuten', name: 'Scenknuten', city: 'Eskilstuna' }, // 6 ev i juli, 2 synliga
    { slug: 'sagateaterboras', name: 'Sagateatern', city: 'Borås' }, // 6 ev i juli, 8 synliga
    { slug: 'regionmuseetskane', name: 'Regionmuseet Skåne', city: 'Kristianstad' }, // 6 ev i juli, 4 synliga
    { slug: 'reumatikerforeningenlinkoping', name: 'Reumatikerföreningen Linköping', city: 'Linköping' }, // 6 ev i juli, 2 synliga
    { slug: 'nykopings.folkhogskola', name: 'Nyköpings Folkhögskola', city: 'Nyköping' }, // 6 ev i juli, 4 synliga
    { slug: 'nbvost', name: 'NBV Öst' }, // 6 ev i juli, 2 synliga
    { slug: 'MahalayaCenter', name: 'Mahalaya - Center for Holistic Growth' }, // 6 ev i juli, 6 synliga
    { slug: 'malmocityskaters', name: 'Malmö City Skaters' }, // 6 ev i juli, 7 synliga
    { slug: 'lyckselemusikoteater', name: 'Lycksele Musik & Teaterförening-en del av Riksteatern', city: 'Lycksele' }, // 6 ev i juli, 5 synliga
    { slug: 'LBSDK', name: 'Luleå Bugg och Swing Dansklubb' }, // 6 ev i juli, 6 synliga
    { slug: 'Bonanderfriskvard', name: 'Lena Bonanders Massage & Friskvård', city: 'Uddevalla' }, // 6 ev i juli, 5 synliga
    { slug: 'jagvagarstuffa', name: 'Jag vågar stuffa', city: 'Karlshamn' }, // 6 ev i juli, 8 synliga
    { slug: 'klostretiystad', name: 'Klostret i Ystad', city: 'Ystad' }, // 6 ev i juli, 2 synliga
    { slug: 'kristianstadsfilmstudio', name: 'Kristianstads Filmstudio', city: 'Kristianstad' }, // 6 ev i juli, 8 synliga
    { slug: 'HotellHavanna', name: 'Hotell Havanna', city: 'Varberg' }, // 6 ev i juli, 3 synliga
    { slug: 'hotelmolndalsbroochroyrestaurant', name: 'Hotel Mölndals Bro - Roy Restaurant Café & Bar' }, // 6 ev i juli, 6 synliga
    { slug: 'gallivarekommunsfolkbibliotek', name: 'Gällivare kommuns folkbibliotek', city: 'Gällivare' }, // 6 ev i juli, 5 synliga
    { slug: 'artstheatregeorge', name: 'George Arts Theatre' }, // 6 ev i juli, 1 synliga
    { slug: 'Gardenoffeathers', name: 'Garden of Feathers', city: 'Staffanstorp' }, // 6 ev i juli, 8 synliga
    { slug: 'folketshusulricehamn', name: 'Folkets Hus Ulricehamn' }, // 6 ev i juli, 6 synliga
    { slug: 'hovmantorps.folketshus', name: 'Folkbiografen Hovmantorp' }, // 6 ev i juli, 8 synliga
    { slug: 'filmfestsundsvall', name: 'Filmfest Sundsvall', city: 'Sundsvall' }, // 6 ev i juli, 8 synliga
    { slug: 'BorlangeDance', name: 'Borlänge Dance', city: 'Borlänge' }, // 6 ev i juli, 6 synliga
    { slug: 'bjuvsbibliotek', name: 'Bjuvs bibliotek' }, // 6 ev i juli, 8 synliga
    { slug: 'BibliotekeniKalmarkommun', name: 'Biblioteken i Kalmar kommun', city: 'Kalmar' }, // 6 ev i juli, 8 synliga
    { slug: 'angustheultimatetribute', name: 'Angus - The Ultimate Tribute', city: 'Borlänge' }, // 6 ev i juli, 8 synliga
    { slug: 'ostgotateatern', name: 'Östgötateatern', city: 'Norrköping' }, // 5 ev i juli, 3 synliga
    { slug: 'almhultsbibliotek', name: 'Älmhults bibliotek' }, // 5 ev i juli, 6 synliga
    { slug: 'naturumSkrylle', name: 'naturum Skrylle' }, // 5 ev i juli, 2 synliga
    { slug: 'YogaHusetFalun', name: 'Yogahuset Falun', city: 'Falun' }, // 5 ev i juli, 7 synliga
    { slug: 'Vardklockanskyrka', name: 'Vårdklockans kyrka', city: 'Visby' }, // 5 ev i juli, 3 synliga
    { slug: 'vedeldspizzan', name: 'Vedeldspizzan', city: 'Göteborg' }, // 5 ev i juli, 2 synliga
    { slug: 'umepride', name: 'Umepride' }, // 5 ev i juli, 8 synliga
    { slug: 'tangovarberg', name: 'Tango Varberg', city: 'Varberg' }, // 5 ev i juli, 3 synliga
    { slug: 'swinginmotionab', name: 'Swing in motion', city: 'Borås' }, // 5 ev i juli, 7 synliga
    { slug: 'stockholmghostwalk', name: 'Stockholm Ghost Walk', city: 'Stockholm' }, // 5 ev i juli, 5 synliga
    { slug: 'biblioteketsimrishamn', name: 'Simrishamns bibliotek', city: 'Simrishamn' }, // 5 ev i juli, 8 synliga
    { slug: 'satssverige', name: 'SATS Sverige', city: 'Stockholm' }, // 5 ev i juli, 4 synliga
    { slug: 'reisdegkomikerklubb', name: 'Reis Deg Komikerklubb' }, // 5 ev i juli, 3 synliga
    { slug: 'kavlingeoldtimespub', name: 'Old Times Pub' }, // 5 ev i juli, 5 synliga
    { slug: 'MotalaBasket', name: 'Motala Basket - W72', city: 'Motala' }, // 5 ev i juli, 2 synliga
    { slug: 'bodyandsoulmovement', name: 'Maria Slättorp - Body & Soul Movement' }, // 5 ev i juli, 5 synliga
    { slug: 'Lakarmissionen', name: 'Läkarmissionen', city: 'Alingsås' }, // 5 ev i juli, 4 synliga
    { slug: 'Kungalvsparken', name: 'Kungälvs Parken', city: 'Borås' }, // 5 ev i juli, 8 synliga
    { slug: 'Kulturhjaltarna', name: 'Kulturhjältarna' }, // 5 ev i juli, 8 synliga
    { slug: 'MAKSIMconcertPianist', name: 'Kultur For Folket', city: 'Linköping' }, // 5 ev i juli, 5 synliga
    { slug: 'jiversdancingclub', name: 'Jivers Dancing Club' }, // 5 ev i juli, 8 synliga
    { slug: 'IntimanTeatern', name: 'Intiman', city: 'Stockholm' }, // 5 ev i juli, 2 synliga
    { slug: 'hagforskulturochbibliotek', name: 'Hagfors kultur och bibliotek' }, // 5 ev i juli, 5 synliga
    { slug: '100064844764389', name: 'Herrljunga Folkets Park' }, // 5 ev i juli, 7 synliga
    { slug: 'goteborgs.botaniska.tradgard', name: 'Göteborgs botaniska trädgård' }, // 5 ev i juli, 5 synliga
    { slug: 'gnosjobibliotek', name: 'Gnosjö kultur & bibliotek' }, // 5 ev i juli, 5 synliga
    { slug: 'freemoveyogastudio.nu', name: 'Freemove Yogastudio' }, // 5 ev i juli, 6 synliga
    { slug: 'Familjecentralen.Ulricehamn', name: 'Familjecentralen, Öppna förskolan i Ulricehamn' }, // 5 ev i juli, 5 synliga
    { slug: 'Eslovsstadsbibliotek', name: 'Eslövs stadsbibliotek', city: 'Eslöv' }, // 5 ev i juli, 5 synliga
    { slug: 'billy.affelin', name: 'Fiskeevent och Fisketävlingar(i samarbete med Sfk Westrogothia)' }, // 5 ev i juli, 1 synliga
    { slug: 'dancetogether.se', name: 'Dance Together', city: 'Eskilstuna' }, // 5 ev i juli, 7 synliga
    { slug: 'CoderDojoLund', name: 'CoderDojo Lund', city: 'Lund' }, // 5 ev i juli, 2 synliga
    { slug: 'bjorn.carlsson', name: 'Carlsson På Kajen' }, // 5 ev i juli, 8 synliga
    { slug: 'BlaKaktus', name: 'Bluesföreningen Blå Kaktus' }, // 5 ev i juli, 8 synliga
    { slug: 'Biotranan.Tranemo', name: 'Bio Tranan Tranemo' }, // 5 ev i juli, 2 synliga
    { slug: 'betlehemskyrkan', name: 'Betlehemskyrkan' }, // 5 ev i juli, 3 synliga
    { slug: 'ArbogaFolketsPark', name: 'Arboga Folkets Park' }, // 5 ev i juli, 8 synliga
    { slug: 'haningebibliotek', name: 'Biblioteken i Haninge' }, // 5 ev i juli, 5 synliga
    { slug: 'ungdomsgardentimra', name: 'Aktivitetshuset Pangea' }, // 5 ev i juli, 5 synliga
    { slug: 'ostgotamusiken', name: 'Östgötamusiken', city: 'Linköping' }, // 4 ev i juli, 8 synliga
    { slug: 'ObackaJazz', name: 'Öbacka Jazz&Blues Härnösand', city: 'Härnösand' }, // 4 ev i juli, 6 synliga
    { slug: 'orebro.salsafriends.9', name: 'Örebro Salsafriends' }, // 4 ev i juli, 4 synliga
    { slug: 'villalidkopingbk', name: 'Villa Lidköping BK', city: 'Lidköping' }, // 4 ev i juli, 2 synliga
    { slug: 'yoga121.se', name: 'Yoga 121', city: 'Hudiksvall' }, // 4 ev i juli, 1 synliga
    { slug: 'Levochmaval', name: 'ViveVale', city: 'Lund' }, // 4 ev i juli, 2 synliga
    { slug: 'ungscenost', name: 'Ung Scen Öst', city: 'Norrköping' }, // 4 ev i juli, 4 synliga
    { slug: 'vikkysKonst', name: 'Vikkys Konst', city: 'Linköping' }, // 4 ev i juli, 2 synliga
    { slug: 'Uddevallakassetten', name: 'Uddevallakassetten', city: 'Uddevalla' }, // 4 ev i juli, 5 synliga
    { slug: 'BokskogeniTorup', name: 'Torups Slott' }, // 4 ev i juli, 4 synliga
    { slug: 'afrosvenskarnasforum', name: 'Ubuntu Malmö Filmfestival' }, // 4 ev i juli, 2 synliga
    { slug: 'teaterhalland', name: 'Teater Halland', city: 'Varberg' }, // 4 ev i juli, 5 synliga
    { slug: 'swingum400', name: 'Swingum' }, // 4 ev i juli, 3 synliga
    { slug: 'SoderhamnsKonstforening', name: 'Söderhamns Konstförening', city: 'Söderhamn' }, // 4 ev i juli, 3 synliga
    { slug: 'sundsvallskommun', name: 'Sundsvalls kommun', city: 'Sundsvall' }, // 4 ev i juli, 8 synliga
    { slug: 'Studieforbundetbildanord', name: 'Studieförbundet Bilda Nord' }, // 4 ev i juli, 8 synliga
    { slug: 'stadshallen', name: 'Stadshallen', city: 'Lund' }, // 4 ev i juli, 6 synliga
    { slug: 'SpangaHockey', name: 'Spånga Hockey' }, // 4 ev i juli, 2 synliga
    { slug: 'spiritofmansweden', name: 'Spirit of Man' }, // 4 ev i juli, 1 synliga
    { slug: 'spacerumforskapande', name: 'Space - Rum för skapande', city: 'Visby' }, // 4 ev i juli, 2 synliga
    { slug: 'sollentunakommun', name: 'Sollentuna kommun' }, // 4 ev i juli, 2 synliga
    { slug: 'RadissonBluGothenburg', name: 'Radisson Blu Scandinavia Hotel, Gothenburg (Göteborg)', city: 'Göteborg' }, // 4 ev i juli, 3 synliga
    { slug: 'pustervik', name: 'Pustervik' }, // 4 ev i juli, 8 synliga
    { slug: 'poffertjes.se', name: 'Poffertjes.se' }, // 4 ev i juli, 8 synliga
    { slug: 'palladiummalmo1', name: 'Palladium' }, // 4 ev i juli, 8 synliga
    { slug: 'halloikaraoke', name: 'Oslostandup.no' }, // 4 ev i juli, 3 synliga
    { slug: 'nordicsociety.org', name: 'Nordic society', city: 'Stockholm' }, // 4 ev i juli, 4 synliga
    { slug: 'NorrlandTulpaner', name: 'Norrlands Tulpan Trädgård' }, // 4 ev i juli, 3 synliga
    { slug: 'naturskyddsforeningen.vanersborg', name: 'Naturskyddsföreningen Vänersborg' }, // 4 ev i juli, 6 synliga
    { slug: 'monica.karlsson.399', name: 'Motala biologiska förening', city: 'Motala' }, // 4 ev i juli, 3 synliga
    { slug: 'mats.fuchs.9', name: 'Mats Fuchs' }, // 4 ev i juli, 1 synliga
    { slug: 'Motorcykelentusiasterna', name: 'MCE - motorcykelentusiasterna' }, // 4 ev i juli, 4 synliga
    { slug: 'gasasteget', name: 'Lunds Dansklubb Gåsasteget', city: 'Lund' }, // 4 ev i juli, 7 synliga
    { slug: 'lesbisktrumuppsala', name: 'Lesbiskt rum Uppsala', city: 'Uppsala' }, // 4 ev i juli, 6 synliga
    { slug: 'LandskronaTeater', name: 'Landskrona Teater', city: 'Landskrona' }, // 4 ev i juli, 8 synliga
    { slug: 'gallivare.se', name: 'Kulturfest', city: 'Gällivare' }, // 4 ev i juli, 7 synliga
    { slug: 'lena.lingensjo', name: 'Härnösands damer' }, // 4 ev i juli, 8 synliga
    { slug: 'harnosandsbibliotek', name: 'Härnösands bibliotek', city: 'Härnösand' }, // 4 ev i juli, 5 synliga
    { slug: 'GothenburgSymphonyOrchestra', name: 'Göteborgs Symfoniker' }, // 4 ev i juli, 4 synliga
    { slug: 'gavlesymfoniorkester', name: 'Gävle Symfoniorkester', city: 'Gävle' }, // 4 ev i juli, 7 synliga
    { slug: 'hothousejazz.malmo', name: 'HOT HOUSE JAZZ MALMÖ', city: 'Malmö' }, // 4 ev i juli, 7 synliga
    { slug: 'gnestabokdagar', name: 'Gnesta Bokdagar' }, // 4 ev i juli, 8 synliga
    { slug: 'gamlahalmstad', name: 'Gamla Halmstad', city: 'Halmstad' }, // 4 ev i juli, 3 synliga
    { slug: 'foreningensm', name: 'Föreningen Söderhamns Museum', city: 'Söderhamn' }, // 4 ev i juli, 4 synliga
    { slug: 'fhuddevalla', name: 'Folkets Hus Uddevalla', city: 'Uddevalla' }, // 4 ev i juli, 5 synliga
    { slug: 'cirkusmuseet', name: 'Cirkusmuseet' }, // 4 ev i juli, 3 synliga
    { slug: 'bollnasbibliotek', name: 'Bollnäs bibliotek och Kulturhuset Bollnäs' }, // 4 ev i juli, 6 synliga
    { slug: 'bibliotekenilaholm', name: 'Biblioteken i Laholm', city: 'Laholm' }, // 4 ev i juli, 6 synliga
    { slug: 'MuseetBollnasKonsthall', name: 'Bollnäs Museum & Konsthall' }, // 4 ev i juli, 2 synliga
    { slug: 'backayardbeats', name: 'Back a Yard Beats', city: 'Stockholm' }, // 4 ev i juli, 2 synliga
    { slug: 'avtrycktjorn', name: 'Avtryck Tjörn 9-11 oktober 2026' }, // 4 ev i juli, 8 synliga
    { slug: 'amplifiedvast', name: 'Amplified Väst', city: 'Borås' }, // 4 ev i juli, 3 synliga
    { slug: 'adasteater', name: 'ADAS teater' }, // 4 ev i juli, 3 synliga
    { slug: 'ostersundsbibliotek', name: 'Östersunds Bibliotek' }, // 3 ev i juli, 8 synliga
    { slug: 'StreetRollerHockeyLeague', name: 'https://www.facebook.com/share/g/' }, // 3 ev i juli, 1 synliga
    { slug: 'Astorpskommun', name: 'Åstorps kommun' }, // 3 ev i juli, 8 synliga
    { slug: 'TheBruceSpringsteenTribute', name: 'The Bruce Springsteen Tribute - Best of the Boss' }, // 3 ev i juli, 8 synliga
    { slug: 'tangosundsvall', name: 'TangoSundsvall', city: 'Sundsvall' }, // 3 ev i juli, 2 synliga
    { slug: 'tangojamt', name: 'TangoJamt' }, // 3 ev i juli, 3 synliga
    { slug: 'stageumea', name: 'Stage Umeå' }, // 3 ev i juli, 8 synliga
    { slug: 'stageway', name: 'Stageway' }, // 3 ev i juli, 8 synliga
    { slug: 'SmalandsVillan', name: 'SmålandsVillan', city: 'Visby' }, // 3 ev i juli, 1 synliga
    { slug: 'skovdeaik', name: 'Skövde AIK', city: 'Skövde' }, // 3 ev i juli, 1 synliga
    { slug: 'SkolsimmarnaIK', name: 'Skolsimmarna IK' }, // 3 ev i juli, 3 synliga
    { slug: 'SensusOstersund', name: 'Sensus Östersund' }, // 3 ev i juli, 8 synliga
    { slug: 'pinkprogramming', name: 'Pink Programming', city: 'Lund' }, // 3 ev i juli, 3 synliga
    { slug: 'MalmoLiveKonserthus', name: 'Malmö Live Konserthus' }, // 3 ev i juli, 2 synliga
    { slug: 'liverestaurangen', name: 'Luleå Energi Arena' }, // 3 ev i juli, 8 synliga
    { slug: 'karlstadskommun', name: 'Karlstads kommun', city: 'Karlstad' }, // 3 ev i juli, 4 synliga
    { slug: 'lindblomacademy', name: 'Lindblom Academy Inner Spirit Light', city: 'Västerås' }, // 3 ev i juli, 8 synliga
    { slug: 'KappaBarMalmo', name: 'Kappa Bar Malmö' }, // 3 ev i juli, 3 synliga
    { slug: 'kraniosakralterapihastochmanniska', name: 'Jennies HelhetsHälsa' }, // 3 ev i juli, 2 synliga
    { slug: 'michael.haggmark.1', name: 'JLS Jämtlands Lokalhistoriker och Släktforskare' }, // 3 ev i juli, 2 synliga
    { slug: 'IFKKristianstad', name: 'IFK Kristianstad', city: 'Kristianstad' }, // 3 ev i juli, 1 synliga
    { slug: 'harnosandfhsk', name: 'Härnösands folkhögskola' }, // 3 ev i juli, 6 synliga
    { slug: 'icfalkenberg', name: 'IC Falkenberg', city: 'Falkenberg' }, // 3 ev i juli, 8 synliga
    { slug: 'harnosandsmusiksallskap', name: 'Härnösands Musiksällskap' }, // 3 ev i juli, 3 synliga
    { slug: 'harkekonstcentrum', name: 'Härke Konstcentrum' }, // 3 ev i juli, 2 synliga
    { slug: 'huddingeparkrun', name: 'Huddinge Parkrun' }, // 3 ev i juli, 8 synliga
    { slug: 'hedemorafolketspark', name: 'Hedemora Folkets Park' }, // 3 ev i juli, 8 synliga
    { slug: 'helsingborgcity', name: 'HBG City' }, // 3 ev i juli, 3 synliga
    { slug: 'Glimmingehus', name: 'Glimmingehus' }, // 3 ev i juli, 3 synliga
    { slug: 'grandsamarkand', name: 'Grand Samarkand' }, // 3 ev i juli, 1 synliga
    { slug: 'FyrisComedy', name: 'FYRIS Comedy' }, // 3 ev i juli, 4 synliga
    { slug: 'djquizmedslimvic', name: 'DJ QUIZ med SLIM VIC', city: 'Gävle' }, // 3 ev i juli, 2 synliga
    { slug: 'biokontrastiggesund', name: 'Bio Kontrast - Folkets Hus Iggesund' }, // 3 ev i juli, 1 synliga
    { slug: 'couleurkonsthandel', name: 'Couleur Konsthandel', city: 'Stockholm' }, // 3 ev i juli, 3 synliga
    { slug: 'carliahotelresort', name: 'Carlia Hotel & Resort', city: 'Uddevalla' }, // 3 ev i juli, 1 synliga
    { slug: 'bergsakers', name: 'Bergsåker', city: 'Sundsvall' }, // 3 ev i juli, 3 synliga
    { slug: 'beehivestationfoodcarts', name: 'BeeHive Station Food Pod' }, // 3 ev i juli, 3 synliga
    { slug: 'BarnOchUngdomskulturTjornsKommun', name: 'Barn- och ungdomskultur Tjörns kommun' }, // 3 ev i juli, 3 synliga
    { slug: 'arvikabibliotek', name: 'Arvika Bibliotek', city: 'Arvika' }, // 3 ev i juli, 7 synliga
    { slug: 'allmannasangenvisby', name: 'Allmänna Sången Visby', city: 'Visby' }, // 3 ev i juli, 2 synliga
    { slug: 'allthingslivenorway', name: 'All Things Live Norway' }, // 3 ev i juli, 8 synliga
    { slug: 'Alergotura', name: 'Alergotura', city: 'Nora' }, // 3 ev i juli, 8 synliga
    { slug: 'AlingsasHK', name: 'Alingsås HK', city: 'Alingsås' }, // 3 ev i juli, 1 synliga
    { slug: 'ostersundskommun', name: 'Östersunds kommun - Staaren tjïelte' }, // 2 ev i juli, 3 synliga
    { slug: 'bluesfestivalen', name: 'Östersunds Bluesfestival' }, // 2 ev i juli, 8 synliga
    { slug: 'ystadicentrum', name: 'Ystad i centrum', city: 'Ystad' }, // 2 ev i juli, 3 synliga
    { slug: 'folkanteater', name: 'Örnsköldsviks Riksteaterförening' }, // 2 ev i juli, 8 synliga
    { slug: 'vastergotlandsmuseum', name: 'Västergötlands museum' }, // 2 ev i juli, 7 synliga
    { slug: 'VaerkstederiAbsalon', name: 'Værksteder i Absalon' }, // 2 ev i juli, 8 synliga
    { slug: 'gunnesgard', name: 'Vikingagården Gunnes gård' }, // 2 ev i juli, 2 synliga
    { slug: 'Vikarvet', name: 'Vikarvet Kulturhistoriskt Sällskap' }, // 2 ev i juli, 8 synliga
    { slug: 'vadstena.naturskyddsforening', name: 'Vadstena Föreläsningsförening' }, // 2 ev i juli, 1 synliga
    { slug: 'valbokopcentrum', name: 'Valbo köpcentrum' }, // 2 ev i juli, 1 synliga
    { slug: 'meraloppis', name: 'Ulf Andersson' }, // 2 ev i juli, 2 synliga
    { slug: 'umeadansimperium', name: 'Umeå Dansimperium' }, // 2 ev i juli, 8 synliga
    { slug: 'torggatan14', name: 'Torggatan 14', city: 'Enköping' }, // 2 ev i juli, 2 synliga
    { slug: 'kulturochteater', name: 'Tjörns kultur- och teaterförening' }, // 2 ev i juli, 3 synliga
    { slug: 'tillsammansforkumla', name: 'Tillsammans för Kumla' }, // 2 ev i juli, 8 synliga
    { slug: 'sverigesradio', name: 'Sveriges Radio' }, // 2 ev i juli, 8 synliga
    { slug: 'sv.vasternorrland', name: 'Studieförbundet Vuxenskolan' }, // 2 ev i juli, 8 synliga
    { slug: 'stjarnkvallar', name: 'Stjärnkvällar' }, // 2 ev i juli, 8 synliga
    { slug: 'skansklive', name: 'Skånsk Live', city: 'Landskrona' }, // 2 ev i juli, 8 synliga
    { slug: 'skarahf', name: 'Skara HF' }, // 2 ev i juli, 1 synliga
    { slug: 'sstudentermalmo', name: 'S-Studenter Malmö' }, // 2 ev i juli, 1 synliga
    { slug: 'rushentlive', name: 'Rush Ent.', city: 'Stockholm' }, // 2 ev i juli, 8 synliga
    { slug: 'riksforbundetforfolkmusikochdans', name: 'RFoD - Riksförbundet för Folkmusik & Dans' }, // 2 ev i juli, 1 synliga
    { slug: 'rimboprastgard', name: 'Rimbo Prästgård' }, // 2 ev i juli, 3 synliga
    { slug: 'petra.revenue', name: 'Petra Revenue' }, // 2 ev i juli, 1 synliga
    { slug: 'OdeumLundsUniversitet', name: 'Odeum', city: 'Lund' }, // 2 ev i juli, 7 synliga
    { slug: 'northcreativenodes', name: 'North Creative Nodes', city: 'Boden' }, // 2 ev i juli, 8 synliga
    { slug: 'Norrdans', name: 'Norrdans', city: 'Härnösand' }, // 2 ev i juli, 4 synliga
    { slug: 'norrbottensteatern', name: 'Norrbottensteatern' }, // 2 ev i juli, 6 synliga
    { slug: 'crimecityrollers', name: 'Malmö Roller Derby - Crime City Rollers' }, // 2 ev i juli, 4 synliga
    { slug: 'statarmuseet', name: 'Malmö Stad' }, // 2 ev i juli, 1 synliga
    { slug: 'malmojazzstory', name: 'Malmö Jazz Story' }, // 2 ev i juli, 7 synliga
    { slug: 'konstmuseummalmo', name: 'Malmö Konstmuseum' }, // 2 ev i juli, 5 synliga
    { slug: 'malmabuggarna', name: 'Malmabuggarna' }, // 2 ev i juli, 3 synliga
    { slug: 'linkopingsstadsbibliotek', name: 'Linköpings stadsbibliotek' }, // 2 ev i juli, 8 synliga
    { slug: 'LandskronaBK', name: 'Landskrona Brukshundklubb', city: 'Landskrona' }, // 2 ev i juli, 1 synliga
    { slug: 'kulturskolanljusdalskommun', name: 'Kulturskolan Ljusdals kommun' }, // 2 ev i juli, 8 synliga
    { slug: 'kpdmellerud', name: 'Kulturbruket på Dal' }, // 2 ev i juli, 7 synliga
    { slug: 'kulturhusetkaken', name: 'Kulturhuset Kåken' }, // 2 ev i juli, 8 synliga
    { slug: 'kulturkollektivet.beardmen', name: 'Kulturkollektivet Beardmen' }, // 2 ev i juli, 1 synliga
    { slug: 'konsertpuls', name: 'KonsertPuls' }, // 2 ev i juli, 2 synliga
    { slug: 'klubbkrinolin', name: 'Krinolin - kammarmusikklubben' }, // 2 ev i juli, 2 synliga
    { slug: 'KDMetalcoholics', name: 'Karlstad Metalcoholics', city: 'Karlstad' }, // 2 ev i juli, 6 synliga
    { slug: 'jonkopingcity', name: 'Jönköping City', city: 'Jönköping' }, // 2 ev i juli, 1 synliga
    { slug: 'bio.juniora', name: 'Juniora' }, // 2 ev i juli, 3 synliga
    { slug: 'jamtlimuseum', name: 'Jamtli' }, // 2 ev i juli, 4 synliga
    { slug: 'jadanskurs', name: 'JAdans' }, // 2 ev i juli, 6 synliga
    { slug: 'HotelEggers', name: 'Hôtel Eggers' }, // 2 ev i juli, 6 synliga
    { slug: 'goteborgwindorchestra', name: 'GÖTEBORG WIND ORCHESTRA', city: 'Göteborg' }, // 2 ev i juli, 3 synliga
    { slug: 'folketshusborlange', name: 'Folkets Hus Borlänge', city: 'Borlänge' }, // 2 ev i juli, 8 synliga
    { slug: 'eyragarden', name: 'Eyragården, Kävlinge Kommun den onsdag, oktober 7 2026' }, // 2 ev i juli, 3 synliga
    { slug: 'essenseikiruna', name: 'Essense - Helhetscenter', city: 'Kiruna' }, // 2 ev i juli, 1 synliga
    { slug: 'delsbohembygdsforening', name: 'Delsbo Forngård' }, // 2 ev i juli, 2 synliga
    { slug: 'dansinordnya', name: 'Dans i Nord nya' }, // 2 ev i juli, 5 synliga
    { slug: 'dansnu', name: 'Dans Nu Uddevalla', city: 'Uddevalla' }, // 2 ev i juli, 1 synliga
    { slug: 'clandestinofestivalen', name: 'Clandestino Festival' }, // 2 ev i juli, 2 synliga
    { slug: 'centralastadsrum', name: 'Centrala Stadsrum' }, // 2 ev i juli, 3 synliga
    { slug: 'centrumforfotografi', name: 'CFF – Centrum för fotografi', city: 'Stockholm' }, // 2 ev i juli, 8 synliga
    { slug: 'bollnasdansar', name: 'Bollnäs Dansar' }, // 2 ev i juli, 8 synliga
    { slug: 'boca.vasteras', name: 'Boca Västerås', city: 'Västerås' }, // 2 ev i juli, 2 synliga
    { slug: 'hudiksvalls.bibliotek', name: 'Biblioteken i Hudiksvalls kommun', city: 'Hudiksvall' }, // 2 ev i juli, 7 synliga
    { slug: 'arenahagmyren', name: 'Arena Hagmyren', city: 'Hudiksvall' }, // 2 ev i juli, 2 synliga
    { slug: 'bevaegelseiabsalon', name: 'Bevægelse i Absalon' }, // 2 ev i juli, 8 synliga
];
