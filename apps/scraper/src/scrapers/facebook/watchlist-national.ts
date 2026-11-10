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
    { slug: 'granelundsodlingar', name: 'Visit Örebro' }, // 163 ev i juli, 3 synliga
    { slug: 'eventkalix', name: 'Kalix Kommun', city: 'Luleå' }, // 74 ev i juli, 8 synliga
    { slug: 'gkmmsplit', name: 'Gradska knjiznica Marka Marulica Split' }, // 65 ev i juli, 8 synliga
    { slug: 'vaxjobibliotek', name: 'Växjö bibliotek' }, // 51 ev i juli, 8 synliga
    { slug: 'studioexpress.se', name: 'Studioexpress.se', city: 'Lund' }, // 44 ev i juli, 8 synliga
    { slug: 'livenationswe', name: 'Live Nation Sweden', city: 'Stockholm' }, // 44 ev i juli, 8 synliga
    { slug: 'kulturaktiebolaget', name: 'Kulturaktiebolaget', city: 'Stockholm' }, // 42 ev i juli, 8 synliga
    { slug: 'vastmanlandslansmuseum', name: 'Västmanlands läns museum', city: 'Västerås' }, // 38 ev i juli, 8 synliga
    { slug: 'nieuscene', name: 'Nieu Torshov' }, // 38 ev i juli, 7 synliga
    { slug: 'guppyentertainmentab', name: 'Guppy Entertainment', city: 'Linköping' }, // 37 ev i juli, 8 synliga
    { slug: 'rodakvarnhbg', name: 'Röda Kvarn Helsingborg', city: 'Helsingborg' }, // 36 ev i juli, 8 synliga
    { slug: 'Ostgota', name: 'Östgöta Nation', city: 'Lund' }, // 31 ev i juli, 8 synliga
    { slug: 'kulturhusetstadsteatern', name: 'Kulturhuset Stadsteatern' }, // 30 ev i juli, 8 synliga
    { slug: 'planbmalmo', name: 'Plan B - malmö' }, // 30 ev i juli, 8 synliga
    { slug: 'Debasersthlm', name: 'Debaser', city: 'Stockholm' }, // 29 ev i juli, 6 synliga
    { slug: 'Scalateatern', name: 'Scalateatern i Karlstad', city: 'Karlstad' }, // 28 ev i juli, 8 synliga
    { slug: 'Musikhuset', name: 'Musikhuset Gävle', city: 'Gävle' }, // 28 ev i juli, 8 synliga
    { slug: 'stadsbiblioteketgbg', name: 'Göteborgs stadsbibliotek' }, // 28 ev i juli, 7 synliga
    { slug: 'livenationnorway', name: 'Live Nation Norway' }, // 27 ev i juli, 8 synliga
    { slug: 'trinitymusicberlin', name: 'Trinity Music' }, // 27 ev i juli, 8 synliga
    { slug: 'jubelAB', name: 'Jubel', city: 'Uppsala' }, // 27 ev i juli, 8 synliga
    { slug: 'FKPscorpiosweden', name: 'FKP Scorpio Sverige', city: 'Göteborg' }, // 27 ev i juli, 8 synliga
    { slug: 'Honggymnastikforening', name: 'Høng GF' }, // 25 ev i juli, 8 synliga
    { slug: 'stormspakhus', name: 'Storms Pakhus' }, // 25 ev i juli, 8 synliga
    { slug: 'latinamerikaifokus', name: 'Latinamerika i Fokus' }, // 24 ev i juli, 5 synliga
    { slug: 'KonserthusetStockholm', name: 'Konserthuset Stockholm', city: 'Stockholm' }, // 24 ev i juli, 8 synliga
    { slug: 'vasteraskonserthus', name: 'Västerås Konserthus', city: 'Västerås' }, // 22 ev i juli, 8 synliga
    { slug: 'KulturcentrumSandviken', name: 'Kulturcentrum Sandviken', city: 'Sandviken' }, // 22 ev i juli, 6 synliga
    { slug: 'folkuniversitetetvisby', name: 'Folkuniversitetet Visby', city: 'Visby' }, // 22 ev i juli, 7 synliga
    { slug: 'folkuniversitetetregionsyd', name: 'Folkuniversitetet Syd', city: 'Helsingborg' }, // 22 ev i juli, 8 synliga
    { slug: 'drammenkulturhus', name: 'Drammen kulturhus' }, // 22 ev i juli, 8 synliga
    { slug: 'baerumkulturhus', name: 'Bærum Kulturhus' }, // 22 ev i juli, 6 synliga
    { slug: 'RalingenBibliotek', name: 'Rælingen bibliotek' }, // 21 ev i juli, 8 synliga
    { slug: 'svdalsland', name: 'Studieförbundet Vuxenskolan i Dalsland' }, // 21 ev i juli, 8 synliga
    { slug: 'thekaliberroom', name: 'The Kaliber Room', city: 'Uppsala' }, // 21 ev i juli, 8 synliga
    { slug: 'enkopingskommunbibliotek', name: 'Enköpings kommunbibliotek', city: 'Enköping' }, // 21 ev i juli, 2 synliga
    { slug: 'skogsvargarna', name: 'OK Skogsvargarna' }, // 20 ev i juli, 8 synliga
    { slug: 'HarrysStenungsund', name: 'Harrys' }, // 20 ev i juli, 7 synliga
    { slug: 'lerumsbibliotek', name: 'Kultur och bibliotek i Lerum' }, // 19 ev i juli, 7 synliga
    { slug: 'katalinsjazzbar', name: 'Katalins Bakficka', city: 'Uppsala' }, // 19 ev i juli, 8 synliga
    { slug: 'kramforsbibliotek', name: 'Kramfors bibliotek' }, // 19 ev i juli, 4 synliga
    { slug: 'hyltebiblioteken', name: 'Hyltebiblioteken' }, // 19 ev i juli, 6 synliga
    { slug: 'gavlebibliotek', name: 'Gävle bibliotek', city: 'Gävle' }, // 19 ev i juli, 8 synliga
    { slug: 'Tangokompaniet', name: 'Tangokompaniet' }, // 18 ev i juli, 8 synliga
    { slug: 'stockholmjazz', name: 'Stockholm Jazz Festival', city: 'Stockholm' }, // 18 ev i juli, 8 synliga
    { slug: 'sodertaljestadsscen', name: 'Södertälje stadsscen' }, // 18 ev i juli, 8 synliga
    { slug: 'norrlandsoperan', name: 'Norrlandsoperan' }, // 18 ev i juli, 6 synliga
    { slug: 'uppsalakonsertkongress', name: 'Uppsala Konsert & Kongress', city: 'Uppsala' }, // 17 ev i juli, 8 synliga
    { slug: 'kulturkvarteret', name: 'Kulturkvarteret Kristianstad', city: 'Kristianstad' }, // 17 ev i juli, 8 synliga
    { slug: 'bibliotekeniboras', name: 'Biblioteken i Borås', city: 'Borås' }, // 17 ev i juli, 8 synliga
    { slug: 'barnbiblioteken', name: 'Barnbiblioteken', city: 'Strängnäs' }, // 17 ev i juli, 6 synliga
    { slug: 'medleymalmo', name: 'medley malmö' }, // 16 ev i juli, 8 synliga
    { slug: 'stalletvarldensmusik', name: 'Stallet - Världens Musik', city: 'Stockholm' }, // 16 ev i juli, 8 synliga
    { slug: 'parkenkulturhus', name: 'Parken kulturhus' }, // 16 ev i juli, 6 synliga
    { slug: 'kollektivkrogen', name: 'Kollektivkrogen' }, // 16 ev i juli, 8 synliga
    { slug: 'Hjaltevadshus', name: 'Hjältevadshus', city: 'Uppsala' }, // 16 ev i juli, 8 synliga
    { slug: 'malmodanceweek', name: 'Malmö Dance Week' }, // 16 ev i juli, 8 synliga
    { slug: 'BorasDansforening', name: 'Borås Dansförening', city: 'Borås' }, // 16 ev i juli, 3 synliga
    { slug: 'gavlekonserthus', name: 'Gävle Konserthus', city: 'Gävle' }, // 16 ev i juli, 8 synliga
    { slug: 'varnamobibliotekochkultur', name: 'Värnamo bibliotek och kultur' }, // 15 ev i juli, 8 synliga
    { slug: 'Victoriateatern', name: 'Victoriateatern Malmö' }, // 15 ev i juli, 6 synliga
    { slug: 'magasinetfalun', name: 'Magasinet Falun', city: 'Falun' }, // 15 ev i juli, 8 synliga
    { slug: 'hedvigeleonora', name: 'Hedvig Eleonora kyrka' }, // 15 ev i juli, 6 synliga
    { slug: 'dalarnasmuseum', name: 'Dalarnas museum', city: 'Falun' }, // 15 ev i juli, 5 synliga
    { slug: 'cnemanorrkoping', name: 'Cnema', city: 'Norrköping' }, // 15 ev i juli, 8 synliga
    { slug: 'bjorn.carlsson', name: 'Carlsson På Kajen', city: 'Västerås' }, // 15 ev i juli, 8 synliga
    { slug: 'vadstenabibliotek', name: 'Vadstena bibliotek' }, // 14 ev i juli, 6 synliga
    { slug: 'malmostadsbibliotek', name: 'Stadsbiblioteket i Malmö' }, // 14 ev i juli, 8 synliga
    { slug: 'SalemsBibliotek', name: 'Salems bibliotek' }, // 14 ev i juli, 6 synliga
    { slug: 'musikvalvetbaggen', name: 'Musikvalvet Baggen' }, // 14 ev i juli, 5 synliga
    { slug: 'Landskronabibliotek', name: 'Landskrona bibliotek', city: 'Landskrona' }, // 14 ev i juli, 8 synliga
    { slug: 'katalin.uppsala', name: 'Katalin And All That Jazz Östra Station', city: 'Uppsala' }, // 14 ev i juli, 8 synliga
    { slug: 'kalmarnationlund', name: 'Kalmar Nation', city: 'Lund' }, // 14 ev i juli, 5 synliga
    { slug: 'NyaHouseofBlues', name: 'House of blues Borlänge- HOBB', city: 'Borlänge' }, // 14 ev i juli, 6 synliga
    { slug: 'hotelskansenoland', name: 'Hotel Skansen' }, // 14 ev i juli, 8 synliga
    { slug: 'BrassUnit', name: 'BrassUnit', city: 'Lidköping' }, // 14 ev i juli, 5 synliga
    { slug: 'feverup', name: 'Fever', city: 'Stockholm' }, // 14 ev i juli, 8 synliga
    { slug: 'ulrikabeijeryoga', name: 'UB Yoga, Sång & Ceremoni', city: 'Hudiksvall' }, // 13 ev i juli, 7 synliga
    { slug: 'rpsb50', name: 'TRENDERs', city: 'Göteborg' }, // 13 ev i juli, 8 synliga
    { slug: 'sigtunastiftelsen', name: 'Sigtunastiftelsen' }, // 13 ev i juli, 6 synliga
    { slug: 'planthousehuntersville', name: 'PlantHouse' }, // 13 ev i juli, 8 synliga
    { slug: '100046421744875', name: 'Råda Rum' }, // 13 ev i juli, 6 synliga
    { slug: 'nygatan6', name: 'Nygatan 6' }, // 13 ev i juli, 6 synliga
    { slug: 'norrbottensteatern', name: 'Norrbottensteatern' }, // 13 ev i juli, 7 synliga
    { slug: 'malmolive', name: 'Malmö Live' }, // 13 ev i juli, 6 synliga
    { slug: 'lundchoralfestival.lcf', name: 'Lund Choral Festival', city: 'Lund' }, // 13 ev i juli, 8 synliga
    { slug: 'krallentertainment', name: 'Krall Entertainment', city: 'Helsingborg' }, // 13 ev i juli, 8 synliga
    { slug: 'inrenatur', name: 'Inre natur' }, // 13 ev i juli, 6 synliga
    { slug: 'gemenskapikungsor', name: 'Gemenskap i Kungsör' }, // 13 ev i juli, 8 synliga
    { slug: 'EncoreSundbyberg', name: 'Encore, Sundbyberg' }, // 13 ev i juli, 8 synliga
    { slug: 'falkenbergsstadsteater', name: 'Falkenbergs Stadsteater', city: 'Falkenberg' }, // 13 ev i juli, 8 synliga
    { slug: 'iggesundsfolkan', name: 'Folkets Hus - Iggesund' }, // 13 ev i juli, 6 synliga
    { slug: 'hudiksvalls.bibliotek', name: 'Biblioteken i Hudiksvalls kommun', city: 'Hudiksvall' }, // 13 ev i juli, 7 synliga
    { slug: 'bibliotekljusdal', name: 'Biblioteken i Ljusdals kommun' }, // 13 ev i juli, 5 synliga
    { slug: 'atalantegbg', name: 'Atalante' }, // 13 ev i juli, 4 synliga
    { slug: 'karlecafe', name: 'karl-e' }, // 12 ev i juli, 8 synliga
    { slug: 'vastmanlandsteater', name: 'Västmanlands Teater', city: 'Västerås' }, // 12 ev i juli, 6 synliga
    { slug: 'vadhanderistockholm', name: 'Vad som händer i Stockholm', city: 'Stockholm' }, // 12 ev i juli, 3 synliga
    { slug: 'tranemo.bibliotek', name: 'Tranemo bibliotek' }, // 12 ev i juli, 5 synliga
    { slug: 'steamhotel', name: 'The Steam Hotel', city: 'Västerås' }, // 12 ev i juli, 7 synliga
    { slug: 'Sormlandsmuseum', name: 'Sörmlands museum', city: 'Nyköping' }, // 12 ev i juli, 5 synliga
    { slug: 'Sundsvallsmuseum', name: 'Sundsvalls museum' }, // 12 ev i juli, 8 synliga
    { slug: 'situpcomedy', name: 'Sit-up comedy show' }, // 12 ev i juli, 3 synliga
    { slug: 'SanktJohanneskyrka', name: 'Sankt Johannes kyrka, Malmö' }, // 12 ev i juli, 8 synliga
    { slug: 'Midsommargarden', name: 'Midsommargården' }, // 12 ev i juli, 8 synliga
    { slug: 'monovaxjo', name: 'Mono Växjö' }, // 12 ev i juli, 8 synliga
    { slug: 'goteborgsstad', name: 'Göteborgs Stad', city: 'Göteborg' }, // 12 ev i juli, 7 synliga
    { slug: 'kulturhusetmobeln', name: 'Kulturhuset Möbeln' }, // 12 ev i juli, 8 synliga
    { slug: 'Eskilstunastadsbibliotek', name: 'Eskilstuna stadsbibliotek', city: 'Eskilstuna' }, // 12 ev i juli, 8 synliga
    { slug: 'eksjobibliotek', name: 'Eksjö stadsbibliotek' }, // 12 ev i juli, 7 synliga
    { slug: 'musikenshusgbg', name: 'Café Hängmattan' }, // 12 ev i juli, 8 synliga
    { slug: 'Bibliotekenilulea', name: 'Biblioteken i Luleå' }, // 12 ev i juli, 8 synliga
    { slug: 'odf.malmo', name: 'Öresunds Dansförening' }, // 11 ev i juli, 8 synliga
    { slug: 'vasterascity', name: 'Västerås City', city: 'Västerås' }, // 11 ev i juli, 8 synliga
    { slug: 'vnmuseum', name: 'Västernorrlands museum', city: 'Härnösand' }, // 11 ev i juli, 6 synliga
    { slug: 'vastergotlandsmuseum', name: 'Västergötlands museum' }, // 11 ev i juli, 5 synliga
    { slug: 'TheBruceSpringsteenTribute', name: 'The Bruce Springsteen Tribute - Best of the Boss', city: 'Trollhättan' }, // 11 ev i juli, 8 synliga
    { slug: 'stageumea', name: 'Stage Umeå' }, // 11 ev i juli, 8 synliga
    { slug: '61587843912500', name: 'Skinnskattebergs Kommun' }, // 11 ev i juli, 6 synliga
    { slug: 'oxiebiblioteket', name: 'Oxiebiblioteket' }, // 11 ev i juli, 4 synliga
    { slug: 'kungligaslotten', name: 'Kungliga Slotten' }, // 11 ev i juli, 5 synliga
    { slug: 'LBSDK', name: 'Luleå Bugg och Swing Dansklubb' }, // 11 ev i juli, 8 synliga
    { slug: 'alvestabibliotek', name: 'Biblioteken i Alvesta kommun' }, // 11 ev i juli, 6 synliga
    { slug: 'ABFsorm', name: 'ABF Sörmland', city: 'Eskilstuna' }, // 11 ev i juli, 8 synliga
    { slug: 'abf.stockholm', name: 'ABF Stockholm', city: 'Stockholm' }, // 11 ev i juli, 8 synliga
    { slug: 'yogaskolan.karlstad', name: 'Yogaskolan Karlstad', city: 'Karlstad' }, // 10 ev i juli, 5 synliga
    { slug: 'tornqvisteventandmusic', name: 'Törnqvist Event & Music', city: 'Linköping' }, // 10 ev i juli, 8 synliga
    { slug: 'vrakdykarpensionatet', name: 'Vrakdykarpensionatet' }, // 10 ev i juli, 8 synliga
    { slug: 'VintervikensTradgard', name: 'Vintervikens Trädgård', city: 'Stockholm' }, // 10 ev i juli, 8 synliga
    { slug: 'TheTivoli', name: 'The Tivoli', city: 'Helsingborg' }, // 10 ev i juli, 8 synliga
    { slug: 'seniortraffen', name: 'Seniorträffen, Oxelösund' }, // 10 ev i juli, 5 synliga
    { slug: 'skovdekulturhus', name: 'Skövde Kulturhus', city: 'Skövde' }, // 10 ev i juli, 8 synliga
    { slug: 'sarakulturhus', name: 'Sara kulturhus' }, // 10 ev i juli, 2 synliga
    { slug: 'nationalmuseumswe', name: 'Nationalmuseum', city: 'Stockholm' }, // 10 ev i juli, 7 synliga
    { slug: 'RadissonBluGothenburg', name: 'Radisson Blu Scandinavia Hotel, Gothenburg (Göteborg)', city: 'Göteborg' }, // 10 ev i juli, 6 synliga
    { slug: 'monument031', name: 'Monument 031' }, // 10 ev i juli, 8 synliga
    { slug: 'louisdegeernorrkoping', name: 'Louis De Geer', city: 'Norrköping' }, // 10 ev i juli, 8 synliga
    { slug: 'Kulturhusetibergen', name: 'Kulturhuset i Bergen' }, // 10 ev i juli, 7 synliga
    { slug: 'kulturhuseteden', name: 'Kulturhuset Eden' }, // 10 ev i juli, 6 synliga
    { slug: 'gretasgothenburg', name: 'Gretas Göteborg', city: 'Göteborg' }, // 10 ev i juli, 8 synliga
    { slug: 'Hedenstedbibliotekerne', name: 'Hedensted Bibliotekerne' }, // 10 ev i juli, 8 synliga
    { slug: 'fhsater', name: 'Folkets Hus Säter' }, // 10 ev i juli, 8 synliga
    { slug: 'Falkopingsbibliotek', name: 'Falköpings bibliotek' }, // 10 ev i juli, 6 synliga
    { slug: 'ckwano1', name: 'CK Wano', city: 'Varberg' }, // 10 ev i juli, 1 synliga
    { slug: 'arbisnkpg', name: 'Arbis', city: 'Norrköping' }, // 10 ev i juli, 8 synliga
    { slug: 'varlokal', name: 'Vår lokal' }, // 9 ev i juli, 7 synliga
    { slug: 'vaxjokommun', name: 'Växjö kommun' }, // 9 ev i juli, 8 synliga
    { slug: 'varbergsstadshotellochasiaspa', name: 'Varbergs Stadshotell och Asia Spa', city: 'Varberg' }, // 9 ev i juli, 5 synliga
    { slug: 'vaniumeasida', name: 'Vän i Umeå' }, // 9 ev i juli, 8 synliga
    { slug: 'vallentunadans', name: 'Vallentuna Dans' }, // 9 ev i juli, 5 synliga
    { slug: 'trivselhussverige', name: 'Trivselhus', city: 'Staffanstorp' }, // 9 ev i juli, 4 synliga
    { slug: 'ostergotlandsbokmassa', name: 'TellUs bok- och berättarmässa i Linköping', city: 'Linköping' }, // 9 ev i juli, 8 synliga
    { slug: 'svinorrabohuslan', name: 'Studieförbundet Vuxenskolan i Norra Bohuslän' }, // 9 ev i juli, 8 synliga
    { slug: 'sv.vasternorrland', name: 'Studieförbundet Vuxenskolan Västernorrland', city: 'Sundsvall' }, // 9 ev i juli, 8 synliga
    { slug: 'svkalmarlan', name: 'Studieförbundet Vuxenskolan Kalmar län', city: 'Nybro' }, // 9 ev i juli, 8 synliga
    { slug: 'shrekraveofficial', name: 'Shrek Rave' }, // 9 ev i juli, 8 synliga
    { slug: 'oslonye', name: 'Oslo Nye Teater' }, // 9 ev i juli, 7 synliga
    { slug: 'Lakarmissionen', name: 'Läkarmissionen', city: 'Alingsås' }, // 9 ev i juli, 8 synliga
    { slug: 'gasasteget', name: 'Lunds Dansklubb Gåsasteget', city: 'Lund' }, // 9 ev i juli, 7 synliga
    { slug: 'kristinehamnsbibliotek', name: 'Kristinehamns bibliotek', city: 'Kristinehamn' }, // 9 ev i juli, 6 synliga
    { slug: 'kulturhusetbollnas', name: 'Kulturhuset Bollnäs' }, // 9 ev i juli, 8 synliga
    { slug: 'jazzklubbensundsvall.se', name: 'Jazzklubben Sundsvall', city: 'Sundsvall' }, // 9 ev i juli, 7 synliga
    { slug: 'ebba.dansklubb', name: 'EBBA Dansklubb' }, // 9 ev i juli, 5 synliga
    { slug: 'ideadrottninghog', name: 'Idé A Drottninghög', city: 'Helsingborg' }, // 9 ev i juli, 8 synliga
    { slug: 'drakenlive', name: 'Draken Live' }, // 9 ev i juli, 5 synliga
    { slug: 'bjuvsbibliotek', name: 'Bjuvs bibliotek' }, // 9 ev i juli, 8 synliga
    { slug: 'mountainfilm', name: 'Banff Mountain Film Festival Scandinavia' }, // 9 ev i juli, 2 synliga
    { slug: 'AlingsasDansklubb', name: 'Alingsås Dansklubb', city: 'Alingsås' }, // 9 ev i juli, 5 synliga
    { slug: 'baravanlig.se', name: 'Bara Vanlig', city: 'Lund' }, // 9 ev i juli, 7 synliga
    { slug: 'ostersundsbibliotek', name: 'Östersunds Bibliotek' }, // 8 ev i juli, 8 synliga
    { slug: 'WermlandOpera', name: 'Wermland Opera', city: 'Karlstad' }, // 8 ev i juli, 3 synliga
    { slug: 'Vindelnskommunbibliotek', name: 'Vindelns kommunbibliotek' }, // 8 ev i juli, 6 synliga
    { slug: 'tunapark.se', name: 'Tuna Park', city: 'Eskilstuna' }, // 8 ev i juli, 2 synliga
    { slug: 'tasspalatset.se', name: 'Tasspalatset' }, // 8 ev i juli, 6 synliga
    { slug: 'reumatikerforeningenlinkoping', name: 'Reumatikerföreningen Linköping', city: 'Linköping' }, // 8 ev i juli, 2 synliga
    { slug: 'pitea.se', name: 'Piteå kommun' }, // 8 ev i juli, 6 synliga
    { slug: 'kulturmagasinetsundsvall', name: 'Kulturmagasinet Sundsvall', city: 'Sundsvall' }, // 8 ev i juli, 8 synliga
    { slug: 'lokstallet.skovde', name: 'Lokstallet', city: 'Skövde' }, // 8 ev i juli, 8 synliga
    { slug: 'kulturhusetkaken', name: 'Kulturhuset Kåken' }, // 8 ev i juli, 8 synliga
    { slug: 'kulturcentrumebeneser', name: 'Kulturcentrum Ebeneser' }, // 8 ev i juli, 8 synliga
    { slug: 'kristnaregnbagsrorelsen', name: 'Kristna regnbågsrörelsen - Riksförbundet EKHO' }, // 8 ev i juli, 6 synliga
    { slug: 'klostretiystad', name: 'Klostret i Ystad', city: 'Ystad' }, // 8 ev i juli, 3 synliga
    { slug: 'kristianstadsfilmstudio', name: 'Kristianstads Filmstudio', city: 'Kristianstad' }, // 8 ev i juli, 6 synliga
    { slug: 'Kapellet.telje', name: 'Kapellet', city: 'Norrtälje' }, // 8 ev i juli, 6 synliga
    { slug: 'jkpglm', name: 'Jönköpings läns museum', city: 'Jönköping' }, // 8 ev i juli, 1 synliga
    { slug: 'jadanskurs', name: 'JAdans' }, // 8 ev i juli, 4 synliga
    { slug: 'folketshusborlange', name: 'Folkets Hus Borlänge', city: 'Borlänge' }, // 8 ev i juli, 8 synliga
    { slug: 'dansofolkton', name: 'Dans & Folkton' }, // 8 ev i juli, 4 synliga
    { slug: 'centrumhusbiografen', name: 'Centrumhusbiografen' }, // 8 ev i juli, 7 synliga
    { slug: 'eskilstunakompaniet', name: 'Eskilstunakompaniet', city: 'Eskilstuna' }, // 8 ev i juli, 8 synliga
    { slug: 'arvikabibliotek', name: 'Arvika Bibliotek', city: 'Arvika' }, // 8 ev i juli, 6 synliga
    { slug: 'alltpascen', name: 'Allt På Scen & Mycke Nöje', city: 'Lund' }, // 8 ev i juli, 8 synliga
    { slug: 'anebybibliotek', name: 'Aneby bibliotek' }, // 8 ev i juli, 4 synliga
    { slug: 'ostfoldteater', name: 'Østfold Teater' }, // 7 ev i juli, 7 synliga
    { slug: 'litensmula', name: 'Vita Huset - En Liten Smula', city: 'Norrtälje' }, // 7 ev i juli, 8 synliga
    { slug: 'tibrobibliotek', name: 'Tibro bibliotek' }, // 7 ev i juli, 6 synliga
    { slug: 'lena.lingensjo', name: 'Söndsvalls damer �', city: 'Sundsvall' }, // 7 ev i juli, 6 synliga
    { slug: 'taystase', name: 'Taysta', city: 'Västerås' }, // 7 ev i juli, 8 synliga
    { slug: 'Storlihytta', name: 'Storlihytta' }, // 7 ev i juli, 8 synliga
    { slug: 'kavlingeoldtimespub', name: 'Old Times Pub' }, // 7 ev i juli, 5 synliga
    { slug: 'molndalsdansskola', name: 'Mölndals Dansskola' }, // 7 ev i juli, 8 synliga
    { slug: 'musikochteatervanner', name: 'Musik & Teatervänner' }, // 7 ev i juli, 7 synliga
    { slug: 'movehomesverige', name: 'Movehome' }, // 7 ev i juli, 2 synliga
    { slug: 'mikespubskovde', name: 'Mikes pub och restaurang', city: 'Skövde' }, // 7 ev i juli, 2 synliga
    { slug: 'konstmuseummalmo', name: 'Malmö Konstmuseum' }, // 7 ev i juli, 3 synliga
    { slug: 'linkopingairswing', name: 'Linköping Air Swing', city: 'Linköping' }, // 7 ev i juli, 8 synliga
    { slug: 'Bonanderfriskvard', name: 'Lena Bonanders Massage & Friskvård', city: 'Uddevalla' }, // 7 ev i juli, 4 synliga
    { slug: 'konstmuseet', name: 'Konstmuseet', city: 'Skövde' }, // 7 ev i juli, 5 synliga
    { slug: 'KSHHealing', name: 'KSH Healing', city: 'Kalmar' }, // 7 ev i juli, 5 synliga
    { slug: 'JiAdagarna', name: 'JiA-Dagarna | Juridiska Föreningens arbetsmarknadsdagar | www.jf.se/jia', city: 'Lund' }, // 7 ev i juli, 8 synliga
    { slug: 'harkekonstcentrum', name: 'Härke Konstcentrum' }, // 7 ev i juli, 2 synliga
    { slug: 'freemoveyogastudio.nu', name: 'Freemove Yogastudio' }, // 7 ev i juli, 5 synliga
    { slug: 'Familjecentralen.Ulricehamn', name: 'Familjecentralen, Öppna förskolan i Ulricehamn' }, // 7 ev i juli, 5 synliga
    { slug: 'Eslovsstadsbibliotek', name: 'Eslövs stadsbibliotek', city: 'Eslöv' }, // 7 ev i juli, 6 synliga
    { slug: 'BorlangeDance', name: 'Borlänge Dance', city: 'Borlänge' }, // 7 ev i juli, 3 synliga
    { slug: 'attentionmolndal', name: 'Attention Mölndal' }, // 7 ev i juli, 3 synliga
    { slug: 'backyardfalun', name: 'Backyard Club', city: 'Falun' }, // 7 ev i juli, 6 synliga
    { slug: 'q.barsundsvall', name: 'q.bar Sundsvall', city: 'Sundsvall' }, // 6 ev i juli, 4 synliga
    { slug: 'yofcreativepartners', name: 'YOF Creative Partners', city: 'Stockholm' }, // 6 ev i juli, 8 synliga
    { slug: 'vedeldspizzan', name: 'Vedeldspizzan', city: 'Göteborg' }, // 6 ev i juli, 2 synliga
    { slug: 'UpplevSkovde', name: 'Upplev Skövde', city: 'Skövde' }, // 6 ev i juli, 1 synliga
    { slug: 'Upplandsmuseet', name: 'Upplandsmuseet', city: 'Uppsala' }, // 6 ev i juli, 8 synliga
    { slug: 'BokskogeniTorup', name: 'Torups Slott' }, // 6 ev i juli, 1 synliga
    { slug: 'swingum400', name: 'Swingum' }, // 6 ev i juli, 2 synliga
    { slug: 'SalemStavanger', name: 'Salem Stavanger' }, // 6 ev i juli, 3 synliga
    { slug: 'studieframjandetumea', name: 'Studiefrämjandet Västerbotten' }, // 6 ev i juli, 6 synliga
    { slug: 'regiongotland', name: 'Region Gotland', city: 'Visby' }, // 6 ev i juli, 3 synliga
    { slug: 'reisdegkomikerklubb', name: 'Reis Deg Komikerklubb' }, // 6 ev i juli, 3 synliga
    { slug: 'palladiummalmo1', name: 'Palladium' }, // 6 ev i juli, 8 synliga
    { slug: 'nojesfabriken', name: 'Nöjesfabriken', city: 'Karlstad' }, // 6 ev i juli, 8 synliga
    { slug: 'northcreativenodes', name: 'North Creative Nodes', city: 'Boden' }, // 6 ev i juli, 8 synliga
    { slug: 'natminkulturhus', name: 'Nationella minoriteters kulturhus' }, // 6 ev i juli, 5 synliga
    { slug: 'NaturumVattenriket', name: 'Naturum Vattenriket' }, // 6 ev i juli, 2 synliga
    { slug: 'moriskapaviljongen', name: 'Moriska Paviljongen' }, // 6 ev i juli, 7 synliga
    { slug: 'MariaLundqvistOffentlig', name: 'Maria Lundqvist', city: 'Eskilstuna' }, // 6 ev i juli, 2 synliga
    { slug: 'MahalayaCenter', name: 'Mahalaya - Center for Holistic Growth' }, // 6 ev i juli, 5 synliga
    { slug: 'lyckselemusikoteater', name: 'Lycksele Musik & Teaterförening-en del av Riksteatern', city: 'Lycksele' }, // 6 ev i juli, 2 synliga
    { slug: 'Kulturhjaltarna', name: 'Kulturhjältarna' }, // 6 ev i juli, 8 synliga
    { slug: 'MAKSIMconcertPianist', name: 'Kultur For Folket', city: 'Linköping' }, // 6 ev i juli, 2 synliga
    { slug: 'karlskronabibliotek', name: 'Karlskrona Stadsbibliotek', city: 'Karlskrona' }, // 6 ev i juli, 8 synliga
    { slug: 'kbwestgbg', name: 'KB West' }, // 6 ev i juli, 8 synliga
    { slug: 'trumhakan', name: 'Jansson Communication' }, // 6 ev i juli, 7 synliga
    { slug: 'jagvagarstuffa', name: 'Jag vågar stuffa', city: 'Karlshamn' }, // 6 ev i juli, 7 synliga
    { slug: 'HotellHavanna', name: 'Hotell Havanna', city: 'Varberg' }, // 6 ev i juli, 3 synliga
    { slug: 'GothenburgSymphonyOrchestra', name: 'Göteborgs Symfoniker' }, // 6 ev i juli, 3 synliga
    { slug: 'grumsbio', name: 'Grums Bio' }, // 6 ev i juli, 8 synliga
    { slug: 'estrad.norr', name: 'Estrad Norr' }, // 6 ev i juli, 5 synliga
    { slug: 'FolkteaternGbg', name: 'Folkteatern Göteborg', city: 'Göteborg' }, // 6 ev i juli, 3 synliga
    { slug: 'WheelsOfCarlshamn', name: 'Cykelklubben Wheels Of Carlshamn', city: 'Karlshamn' }, // 6 ev i juli, 8 synliga
    { slug: 'ArbogaFolketsPark', name: 'Arboga Folkets Park' }, // 6 ev i juli, 8 synliga
    { slug: 'AlingsasHK', name: 'Alingsås HK', city: 'Alingsås' }, // 6 ev i juli, 2 synliga
    { slug: 'ABFKiruna', name: 'ABF Norr Kiruna', city: 'Kiruna' }, // 6 ev i juli, 3 synliga
    { slug: 'almhultsbibliotek', name: 'Älmhults bibliotek' }, // 5 ev i juli, 6 synliga
    { slug: 'swinginmotionab', name: 'Swing in motion', city: 'Borås' }, // 5 ev i juli, 2 synliga
    { slug: 'svartebyalag', name: 'Svarte' }, // 5 ev i juli, 2 synliga
    { slug: 'sensusvastrasverige', name: 'Sensus Västra Sverige', city: 'Göteborg' }, // 5 ev i juli, 8 synliga
    { slug: 'seniorikungsbacka', name: 'Senior i Kungsbacka', city: 'Kungsbacka' }, // 5 ev i juli, 5 synliga
    { slug: 'SensusRCN', name: 'Rättighetscentrum Norrbotten - mot diskriminering' }, // 5 ev i juli, 7 synliga
    { slug: 'NiklasStromstedtMusic', name: 'Niklas Strömstedt', city: 'Uppsala' }, // 5 ev i juli, 7 synliga
    { slug: 'naturumblekinge', name: 'Naturum Blekinge', city: 'Ronneby' }, // 5 ev i juli, 3 synliga
    { slug: 'mats.fuchs.9', name: 'Mats Fuchs' }, // 5 ev i juli, 1 synliga
    { slug: 'bodyandsoulmovement', name: 'Maria Slättorp - Body & Soul Movement' }, // 5 ev i juli, 4 synliga
    { slug: 'lesbisktrumuppsala', name: 'Lesbiskt rum Uppsala', city: 'Uppsala' }, // 5 ev i juli, 5 synliga
    { slug: 'jan.svensson.9469', name: 'Jan Svensson' }, // 5 ev i juli, 8 synliga
    { slug: '100064844764389', name: 'Herrljunga Folkets Park' }, // 5 ev i juli, 4 synliga
    { slug: 'artstheatregeorge', name: 'George Arts Theatre' }, // 5 ev i juli, 3 synliga
    { slug: 'DDRKgbg', name: 'DDRKgbg' }, // 5 ev i juli, 4 synliga
    { slug: 'dragonflystudioavesta', name: 'Dragonfly Studio' }, // 5 ev i juli, 3 synliga
    { slug: 'catscornermalmo', name: 'Cats\' Corner' }, // 5 ev i juli, 4 synliga
    { slug: 'cirkus.klub', name: 'Cirkus' }, // 5 ev i juli, 6 synliga
    { slug: 'MuseetBollnasKonsthall', name: 'Bollnäs Museum & Konsthall' }, // 5 ev i juli, 1 synliga
    { slug: 'boca.vasteras', name: 'Boca Västerås', city: 'Västerås' }, // 5 ev i juli, 2 synliga
    { slug: 'bibliotekenitierp', name: 'Biblioteken i Tierps kommun' }, // 5 ev i juli, 8 synliga
    { slug: 'befreenow.se', name: 'Befreenow' }, // 5 ev i juli, 6 synliga
    { slug: 'backa.teater', name: 'Backa Teater' }, // 5 ev i juli, 3 synliga
    { slug: 'backayardbeats', name: 'Back a Yard Beats', city: 'Stockholm' }, // 5 ev i juli, 2 synliga
    { slug: 'allthingslivenorway', name: 'All Things Live Norway' }, // 5 ev i juli, 8 synliga
    { slug: 'WoodyWestGbg', name: 'Woody West' }, // 4 ev i juli, 8 synliga
    { slug: 'Vardklockanskyrka', name: 'Vårdklockans kyrka', city: 'Visby' }, // 4 ev i juli, 3 synliga
    { slug: 'villalidkopingbk', name: 'Villa Lidköping BK', city: 'Lidköping' }, // 4 ev i juli, 1 synliga
    { slug: 'visituddevalla', name: 'Visit Uddevalla', city: 'Uddevalla' }, // 4 ev i juli, 4 synliga
    { slug: 'VXOevent', name: 'VXO event' }, // 4 ev i juli, 3 synliga
    { slug: 'sundsvallskommun', name: 'Sundsvalls kommun', city: 'Sundsvall' }, // 4 ev i juli, 8 synliga
    { slug: 'stadshallen', name: 'Stadshallen', city: 'Lund' }, // 4 ev i juli, 7 synliga
    { slug: 'stenhusetgille', name: 'Stenhuset' }, // 4 ev i juli, 2 synliga
    { slug: 'royal.roland.5623', name: 'SoundTrack Roland' }, // 4 ev i juli, 2 synliga
    { slug: 'SpangaHockey', name: 'Spånga Hockey' }, // 4 ev i juli, 8 synliga
    { slug: 'SoulRelax.Motala', name: 'SoulRelax', city: 'Motala' }, // 4 ev i juli, 3 synliga
    { slug: 'satssverige', name: 'SATS Sverige' }, // 4 ev i juli, 3 synliga
    { slug: 'pustervik', name: 'Pustervik' }, // 4 ev i juli, 8 synliga
    { slug: 'plattformimprovisationsomatik', name: 'Plattform för Improvisation och Somatik' }, // 4 ev i juli, 5 synliga
    { slug: 'OdeumLundsUniversitet', name: 'Odeum', city: 'Lund' }, // 4 ev i juli, 8 synliga
    { slug: 'junisalvsborgdistrikt', name: 'Movendi Älvsborg', city: 'Borås' }, // 4 ev i juli, 8 synliga
    { slug: 'monica.karlsson.399', name: 'Motala biologiska förening', city: 'Motala' }, // 4 ev i juli, 6 synliga
    { slug: 'lommafolketshus', name: 'Lomma Folkets Hus' }, // 4 ev i juli, 3 synliga
    { slug: 'Kungalvsparken', name: 'Kungälvs Parken', city: 'Borås' }, // 4 ev i juli, 6 synliga
    { slug: 'kpdmellerud', name: 'Kulturbruket på Dal' }, // 4 ev i juli, 6 synliga
    { slug: 'kulturbolaget', name: 'Kulturbolaget' }, // 4 ev i juli, 8 synliga
    { slug: 'KappaBarMalmo', name: 'Kappa Bar Malmö' }, // 4 ev i juli, 2 synliga
    { slug: 'kalixkommun', name: 'Kalix kommun' }, // 4 ev i juli, 7 synliga
    { slug: 'KLUBBDODSWE', name: 'KLUBB DÖD' }, // 4 ev i juli, 8 synliga
    { slug: 'jonkopingcity', name: 'Jönköping City', city: 'Jönköping' }, // 4 ev i juli, 2 synliga
    { slug: 'michael.haggmark.1', name: 'JLS Jämtlands Lokalhistoriker och Släktforskare' }, // 4 ev i juli, 2 synliga
    { slug: 'icfalkenberg', name: 'IC Falkenberg', city: 'Falkenberg' }, // 4 ev i juli, 8 synliga
    { slug: 'huddingeparkrun', name: 'Huddinge Parkrun' }, // 4 ev i juli, 8 synliga
    { slug: 'solvesborgcsk', name: 'Hjortakroksskolan' }, // 4 ev i juli, 2 synliga
    { slug: 'high5ivefestivals', name: 'High 5ive Festivals' }, // 4 ev i juli, 4 synliga
    { slug: 'gavlesymfoniorkester', name: 'Gävle Symfoniorkester', city: 'Gävle' }, // 4 ev i juli, 8 synliga
    { slug: 'gronakallanalvkarleby', name: 'Gröna Källan - Älvkarleby' }, // 4 ev i juli, 4 synliga
    { slug: 'Glimmingehus', name: 'Glimmingehus' }, // 4 ev i juli, 5 synliga
    { slug: 'FylgjaHelandeHarmoni', name: 'Fylgja - helande harmoni', city: 'Sundsvall' }, // 4 ev i juli, 8 synliga
    { slug: 'eyragarden', name: 'Eyragården, Kävlinge Kommun' }, // 4 ev i juli, 3 synliga
    { slug: 'delsbohembygdsforening', name: 'Delsbo Forngård' }, // 4 ev i juli, 2 synliga
    { slug: 'couleurkonsthandel', name: 'Couleur Konsthandel', city: 'Stockholm' }, // 4 ev i juli, 3 synliga
    { slug: 'cirkusmuseet', name: 'Cirkusmuseet' }, // 4 ev i juli, 2 synliga
    { slug: 'boulognerskogenparkrun', name: 'Boulognerskogen parkrun, Gävle', city: 'Gävle' }, // 4 ev i juli, 3 synliga
    { slug: 'biokontrastiggesund', name: 'Bio Kontrast - Folkets Hus Iggesund' }, // 4 ev i juli, 1 synliga
    { slug: 'bergsakers', name: 'Bergsåker', city: 'Sundsvall' }, // 4 ev i juli, 2 synliga
    { slug: 'BarnOchUngdomskulturTjornsKommun', name: 'Barn- och ungdomskultur Tjörns kommun' }, // 4 ev i juli, 1 synliga
    { slug: 'angustheultimatetribute', name: 'Angus - The Ultimate Tribute', city: 'Borlänge' }, // 4 ev i juli, 8 synliga
    { slug: 'alexeklundofficial', name: 'Alex Eklund', city: 'Eskilstuna' }, // 4 ev i juli, 3 synliga
    { slug: 'astarscandinavia', name: 'A STAR Entertainment', city: 'Norrköping' }, // 4 ev i juli, 8 synliga
    { slug: 'ostgotateatern', name: 'Östgötateatern', city: 'Norrköping' }, // 3 ev i juli, 3 synliga
    { slug: 'orebrobibliotek', name: 'Örebro bibliotek' }, // 3 ev i juli, 8 synliga
    { slug: 'ObackaJazz', name: 'Öbacka Jazz&Blues Härnösand', city: 'Härnösand' }, // 3 ev i juli, 4 synliga
    { slug: 'yoga121.se', name: 'Yoga 121', city: 'Hudiksvall' }, // 3 ev i juli, 1 synliga
    { slug: 'naturumSkrylle', name: 'naturum Skrylle' }, // 3 ev i juli, 4 synliga
    { slug: 'ungscenost', name: 'Ung Scen Öst', city: 'Norrköping' }, // 3 ev i juli, 4 synliga
    { slug: 'UkrainianCultureInSweden', name: 'Ukrainian Culture in Sweden /Ukraine Culture Now' }, // 3 ev i juli, 4 synliga
    { slug: 'Uddevallakassetten', name: 'Uddevallakassetten', city: 'Uddevalla' }, // 3 ev i juli, 8 synliga
    { slug: 'TillsammansHoor', name: 'Tillsammans Höör' }, // 3 ev i juli, 1 synliga
    { slug: 'teaterhalland', name: 'Teater Halland', city: 'Varberg' }, // 3 ev i juli, 4 synliga
    { slug: 'stuckonlive', name: 'Stuck On - Live' }, // 3 ev i juli, 8 synliga
    { slug: 'soderhamnsbibblan', name: 'Söderhamns Stadsbibliotek', city: 'Söderhamn' }, // 3 ev i juli, 3 synliga
    { slug: 'skarahf', name: 'Skara HF' }, // 3 ev i juli, 1 synliga
    { slug: 'stfostraskane', name: 'STF Östra Skåne Lokalavdelning' }, // 3 ev i juli, 4 synliga
    { slug: 'selammusic', name: 'SELAM', city: 'Stockholm' }, // 3 ev i juli, 2 synliga
    { slug: 'rimboprastgard', name: 'Rimbo Prästgård' }, // 3 ev i juli, 7 synliga
    { slug: 'quiztyreso', name: 'QUIZ - Tyresö' }, // 3 ev i juli, 1 synliga
    { slug: 'pinkprogramming', name: 'Pink Programming', city: 'Lund' }, // 3 ev i juli, 2 synliga
    { slug: 'nykopings.folkhogskola', name: 'Nyköpings Folkhögskola', city: 'Nyköping' }, // 3 ev i juli, 3 synliga
    { slug: 'nbvost', name: 'NBV Öst' }, // 3 ev i juli, 3 synliga
    { slug: 'musikisydmalmo', name: 'Musik i Syd Malmö' }, // 3 ev i juli, 3 synliga
    { slug: 'malmostad', name: 'Malmö stad' }, // 3 ev i juli, 1 synliga
    { slug: 'MalmoLiveKonserthus', name: 'Malmö Live Konserthus' }, // 3 ev i juli, 2 synliga
    { slug: 'Motorcykelentusiasterna', name: 'MCE - motorcykelentusiasterna' }, // 3 ev i juli, 2 synliga
    { slug: 'malmocityskaters', name: 'Malmö City Skaters' }, // 3 ev i juli, 5 synliga
    { slug: 'lisebergab', name: 'Liseberg' }, // 3 ev i juli, 1 synliga
    { slug: 'visitsoderhamn', name: 'Kulturen Söderhamn', city: 'Söderhamn' }, // 3 ev i juli, 1 synliga
    { slug: 'KDMetalcoholics', name: 'Karlstad Metalcoholics', city: 'Karlstad' }, // 3 ev i juli, 6 synliga
    { slug: 'fastningsmuseet', name: 'Karlsborgs Fästningsmuseum' }, // 3 ev i juli, 5 synliga
    { slug: 'kalix.bibliotek', name: 'Kalix Bibliotek' }, // 3 ev i juli, 2 synliga
    { slug: 'hovmantorps.folketshus', name: 'Hovmantorps Folkets Hus' }, // 3 ev i juli, 5 synliga
    { slug: 'hotelmolndalsbroochroyrestaurant', name: 'Hotel Mölndals Bro - Roy Restaurant Café & Bar' }, // 3 ev i juli, 7 synliga
    { slug: 'hothousejazz.malmo', name: 'HOT HOUSE JAZZ MALMÖ', city: 'Malmö' }, // 3 ev i juli, 7 synliga
    { slug: 'goteborgs.botaniska.tradgard', name: 'Göteborgs botaniska trädgård' }, // 3 ev i juli, 3 synliga
    { slug: 'goteborgwindorchestra', name: 'GÖTEBORG WIND ORCHESTRA', city: 'Göteborg' }, // 3 ev i juli, 3 synliga
    { slug: 'gasklockorna', name: 'Gasklockorna Gävle', city: 'Gävle' }, // 3 ev i juli, 8 synliga
    { slug: 'Gardenoffeathers', name: 'Garden of Feathers', city: 'Staffanstorp' }, // 3 ev i juli, 8 synliga
    { slug: 'gallivare.se', name: 'Folkets Hus Gällivare', city: 'Gällivare' }, // 3 ev i juli, 5 synliga
    { slug: 'FyrisComedy', name: 'FYRIS Comedy' }, // 3 ev i juli, 3 synliga
    { slug: 'billy.affelin', name: 'Fiskeevent och Fisketävlingar(i samarbete med Sfk Westrogothia)' }, // 3 ev i juli, 8 synliga
    { slug: 'DocLoungeMalmo', name: 'Doc Lounge Malmö' }, // 3 ev i juli, 4 synliga
    { slug: 'energiheaxorna', name: 'Energihäxorna' }, // 3 ev i juli, 2 synliga
    { slug: 'dancetogether.se', name: 'Dance Together', city: 'Eskilstuna' }, // 3 ev i juli, 4 synliga
    { slug: 'CoderDojoLund', name: 'CoderDojo Lund', city: 'Lund' }, // 3 ev i juli, 2 synliga
    { slug: 'bibliotekenilaholm', name: 'Biblioteken i Laholm', city: 'Laholm' }, // 3 ev i juli, 4 synliga
    { slug: 'arbogabio', name: 'Arboga bio' }, // 3 ev i juli, 2 synliga
    { slug: 'arbetetsmuseum', name: 'Arbetets museum', city: 'Norrköping' }, // 3 ev i juli, 3 synliga
    { slug: 'alingsaskulturhus', name: 'Alingsås kulturhus', city: 'Alingsås' }, // 3 ev i juli, 3 synliga
    { slug: 'alltidtjorn', name: 'Alltid Tjörn' }, // 3 ev i juli, 6 synliga
    { slug: 'adasteater', name: 'ADAS teater' }, // 3 ev i juli, 1 synliga
    { slug: 'ostersundskulturskola', name: 'Östersunds Kulturskola' }, // 2 ev i juli, 1 synliga
    { slug: 'ostersundskommun', name: 'Östersunds kommun - Staaren tjïelte' }, // 2 ev i juli, 2 synliga
    { slug: 'folkanteater', name: 'Örnsköldsviks Riksteaterförening' }, // 2 ev i juli, 8 synliga
    { slug: 'aterstallvatmarker', name: 'Återställ Våtmarker' }, // 2 ev i juli, 2 synliga
    { slug: 'ystadicentrum', name: 'Ystad i centrum', city: 'Ystad' }, // 2 ev i juli, 2 synliga
    { slug: 'orlogsstadenkarlskrona.se', name: 'Världsarvet Örlogsstaden Karlskrona', city: 'Karlskrona' }, // 2 ev i juli, 8 synliga
    { slug: 'VisitOstersund', name: 'VisitÖstersund', city: 'Östersund' }, // 2 ev i juli, 8 synliga
    { slug: 'valbokopcentrum', name: 'Valbo köpcentrum' }, // 2 ev i juli, 1 synliga
    { slug: 'vikkysKonst', name: 'Vikkys Konst', city: 'Linköping' }, // 2 ev i juli, 8 synliga
    { slug: 'umeafilmfestival', name: 'Umeå Filmfestival' }, // 2 ev i juli, 8 synliga
    { slug: 'NattklubbTradgarn', name: 'Trädgår\'n Nattklubb' }, // 2 ev i juli, 4 synliga
    { slug: 'torggatan14', name: 'Torggatan 14', city: 'Enköping' }, // 2 ev i juli, 8 synliga
    { slug: 'kulturochteater', name: 'Tjörns kultur- och teaterförening' }, // 2 ev i juli, 1 synliga
    { slug: 'tillsammansforkumla', name: 'Tillsammans för Kumla' }, // 2 ev i juli, 8 synliga
    { slug: 'Studentafton', name: 'Studentafton', city: 'Lund' }, // 2 ev i juli, 1 synliga
    { slug: 'stenegardjarvso', name: 'Stenegård i Järvsö' }, // 2 ev i juli, 3 synliga
    { slug: 'skovdeaik', name: 'Skövde AIK', city: 'Skövde' }, // 2 ev i juli, 8 synliga
    { slug: 'skansklive', name: 'Skånsk Live', city: 'Landskrona' }, // 2 ev i juli, 8 synliga
    { slug: 'skellefteakammarmusik', name: 'Skellefteå Kammarmusikförening' }, // 2 ev i juli, 8 synliga
    { slug: 'silvenska', name: 'Silvénska villan' }, // 2 ev i juli, 2 synliga
    { slug: 'scenknuten', name: 'Scenknuten', city: 'Eskilstuna' }, // 2 ev i juli, 2 synliga
    { slug: 'rohsskamuseet', name: 'Röhsska museet' }, // 2 ev i juli, 2 synliga
    { slug: 'rushentlive', name: 'Rush Ent.' }, // 2 ev i juli, 8 synliga
    { slug: 'ringstromsrestaurang', name: 'Ringströms', city: 'Alingsås' }, // 2 ev i juli, 7 synliga
    { slug: 'Regionteatern', name: 'Regionteatern Blekinge Kronoberg' }, // 2 ev i juli, 7 synliga
    { slug: 'ostergotlandsmuseum', name: 'RIDÅN - Bistro, Bar & Kultur' }, // 2 ev i juli, 7 synliga
    { slug: 'puskasmusikk', name: 'Puskas Musikk & Platebar' }, // 2 ev i juli, 8 synliga
    { slug: 'PitebygdensMusikforbund', name: 'Pitebygdens Musikförbund' }, // 2 ev i juli, 2 synliga
    { slug: 'OnTheFloor2014', name: 'On the Floor', city: 'Karlshamn' }, // 2 ev i juli, 7 synliga
    { slug: 'osloworld', name: 'Oslo World' }, // 2 ev i juli, 8 synliga
    { slug: 'nojespartner', name: 'Nöjespartner', city: 'Kungsbacka' }, // 2 ev i juli, 8 synliga
    { slug: 'hotellmullsjo', name: 'Mullsjö Hotell & Konferens' }, // 2 ev i juli, 8 synliga
    { slug: 'naturskyddsforeningenigoteborg', name: 'Naturskyddsföreningen i Göteborg', city: 'Göteborg' }, // 2 ev i juli, 2 synliga
    { slug: 'mollan.mitt', name: 'Mitt Möllan' }, // 2 ev i juli, 3 synliga
    { slug: 'malmosaluhall', name: 'Malmö Saluhall' }, // 2 ev i juli, 3 synliga
    { slug: 'malinjornvi', name: 'Malin Jörnvi', city: 'Uppsala' }, // 2 ev i juli, 1 synliga
    { slug: 'DancecityOslo', name: 'MR production Norway' }, // 2 ev i juli, 2 synliga
    { slug: 'lagerhusetsbibliotek', name: 'Lagerhusets Bibliotek' }, // 2 ev i juli, 7 synliga
    { slug: 'lindblomacademy', name: 'Lindblom Academy Inner Spirit Light', city: 'Västerås' }, // 2 ev i juli, 8 synliga
    { slug: 'latinmania.se', name: 'LATINmania' }, // 2 ev i juli, 8 synliga
    { slug: 'kulturskolanljusdalskommun', name: 'Kulturskolan Ljusdals kommun' }, // 2 ev i juli, 8 synliga
    { slug: 'kulturkollektivet.beardmen', name: 'Kulturkollektivet Beardmen' }, // 2 ev i juli, 2 synliga
    { slug: 'klubbkrinolin', name: 'Krinolin - kammarmusikklubben' }, // 2 ev i juli, 2 synliga
    { slug: 'konstepidemin', name: 'Konstepidemin' }, // 2 ev i juli, 4 synliga
    { slug: 'klubbmariama', name: 'Klubb Mariama', city: 'Stockholm' }, // 2 ev i juli, 2 synliga
    { slug: 'sagateaterboras', name: 'Johan Östling' }, // 2 ev i juli, 8 synliga
    { slug: 'kraniosakralterapihastochmanniska', name: 'Jennies HelhetsHälsa' }, // 2 ev i juli, 3 synliga
    { slug: 'jadedheartmusic', name: 'Jaded Heart' }, // 2 ev i juli, 2 synliga
    { slug: 'harnosandfhsk', name: 'Härnösands folkhögskola' }, // 2 ev i juli, 6 synliga
    { slug: 'headstompproductions', name: 'Headstomp Productions' }, // 2 ev i juli, 8 synliga
    { slug: 'globallivingvasteras', name: 'Global Living', city: 'Västerås' }, // 2 ev i juli, 8 synliga
    { slug: 'foreningensm', name: 'Föreningen Söderhamns Museum', city: 'Söderhamn' }, // 2 ev i juli, 1 synliga
    { slug: 'FrokenLarssonHandelsbod', name: 'Fröken Larsson Vintage, Antikt & Secondhand' }, // 2 ev i juli, 1 synliga
    { slug: 'forumbiblioteken', name: 'Forumbiblioteken i Nacka' }, // 2 ev i juli, 2 synliga
    { slug: 'DestinationSundsvall', name: 'Destination Sundsvall', city: 'Sundsvall' }, // 2 ev i juli, 4 synliga
    { slug: 'centralastadsrum', name: 'Falu centrum' }, // 2 ev i juli, 1 synliga
    { slug: 'dansinordnya', name: 'Dans i Nord nya' }, // 2 ev i juli, 8 synliga
    { slug: 'Clubsoundkilla', name: 'Club Soundkilla' }, // 2 ev i juli, 1 synliga
    { slug: 'christmasnighttour', name: 'Christmas Night', city: 'Uppsala' }, // 2 ev i juli, 8 synliga
    { slug: 'barumbibliotek', name: 'Bærum bibliotek' }, // 2 ev i juli, 7 synliga
    { slug: 'askerkulturhus', name: 'Asker kulturhus' }, // 2 ev i juli, 8 synliga
    { slug: 'annkiochklas', name: 'Annki & Klas' }, // 2 ev i juli, 8 synliga
    { slug: 'ABFsodertorn', name: 'ABF Södertörn' }, // 2 ev i juli, 6 synliga
];
