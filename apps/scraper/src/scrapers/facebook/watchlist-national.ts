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
    { slug: 'svenskakammarorkestern', name: 'Visit Örebro' }, // 167 ev i juli, 8 synliga
    { slug: 'fkpscorpio', name: 'FKP Scorpio' }, // 70 ev i juli, 8 synliga
    { slug: 'gkmmsplit', name: 'Gradska knjiznica Marka Marulica Split' }, // 53 ev i juli, 8 synliga
    { slug: 'studioexpress.se', name: 'Studioexpress.se', city: 'Linköping' }, // 50 ev i juli, 8 synliga
    { slug: 'eventkalix', name: 'Kalix Kommun', city: 'Luleå' }, // 50 ev i juli, 8 synliga
    { slug: 'livenationswe', name: 'Live Nation Sweden', city: 'Stockholm' }, // 49 ev i juli, 8 synliga
    { slug: 'vaxjobibliotek', name: 'Växjö bibliotek' }, // 45 ev i juli, 1 synliga
    { slug: 'guppyentertainmentab', name: 'Guppy Entertainment', city: 'Karlstad' }, // 45 ev i juli, 8 synliga
    { slug: 'kulturaktiebolaget', name: 'Kulturaktiebolaget', city: 'Kristianstad' }, // 44 ev i juli, 8 synliga
    { slug: 'nieuscene', name: 'Nieu Torshov' }, // 39 ev i juli, 7 synliga
    { slug: 'rodakvarnhbg', name: 'Röda Kvarn Helsingborg', city: 'Helsingborg' }, // 36 ev i juli, 8 synliga
    { slug: 'Ostgota', name: 'Östgöta Nation', city: 'Lund' }, // 33 ev i juli, 8 synliga
    { slug: 'vastmanlandslansmuseum', name: 'Västmanlands läns museum' }, // 32 ev i juli, 8 synliga
    { slug: 'FKPscorpiosweden', name: 'FKP Scorpio Sverige', city: 'Stockholm' }, // 31 ev i juli, 8 synliga
    { slug: 'Megascope', name: 'Megascope' }, // 30 ev i juli, 8 synliga
    { slug: 'trinitymusicberlin', name: 'Trinity Music' }, // 29 ev i juli, 8 synliga
    { slug: 'jubelAB', name: 'Jubel', city: 'Uppsala' }, // 29 ev i juli, 8 synliga
    { slug: 'rockefelleroslo', name: 'Rockefeller / John Dee / Sentrum Scene' }, // 29 ev i juli, 8 synliga
    { slug: 'stormspakhus', name: 'Storms Pakhus' }, // 28 ev i juli, 7 synliga
    { slug: '61587843912500', name: 'Skinnskattebergs Kommun' }, // 28 ev i juli, 6 synliga
    { slug: 'livenationnorway', name: 'Live Nation Norway' }, // 28 ev i juli, 8 synliga
    { slug: 'grandliveab', name: 'Grand Live', city: 'Kungsbacka' }, // 28 ev i juli, 8 synliga
    { slug: 'folketsbiomalmo', name: 'Biograf Panora Malmö' }, // 26 ev i juli, 7 synliga
    { slug: 'kollektivetlivetbar', name: 'Kollektivet Livet' }, // 25 ev i juli, 8 synliga
    { slug: 'Musikhuset', name: 'Musikhuset Gävle', city: 'Gävle' }, // 25 ev i juli, 8 synliga
    { slug: 'Kulturenshus', name: 'Kulturens hus Luleå' }, // 24 ev i juli, 8 synliga
    { slug: 'hundesenteretitrondheim', name: 'Hundesenteret' }, // 24 ev i juli, 8 synliga
    { slug: 'csnoje.se', name: 'CS Nöje', city: 'Skövde' }, // 24 ev i juli, 8 synliga
    { slug: 'KonserthusetStockholm', name: 'Konserthuset Stockholm', city: 'Stockholm' }, // 23 ev i juli, 8 synliga
    { slug: 'Debasersthlm', name: 'Debaser', city: 'Stockholm' }, // 23 ev i juli, 7 synliga
    { slug: 'planbmalmo', name: 'Plan B - malmö' }, // 23 ev i juli, 8 synliga
    { slug: 'jazzclubfasching', name: 'Fasching' }, // 23 ev i juli, 8 synliga
    { slug: 'vasteraskonserthus', name: 'Västerås Konserthus', city: 'Västerås' }, // 22 ev i juli, 8 synliga
    { slug: 'StudieforbundetVuxenskolanVast', name: 'Studieförbundet Vuxenskolan Väst', city: 'Uddevalla' }, // 22 ev i juli, 7 synliga
    { slug: 'Honggymnastikforening', name: 'Høng GF' }, // 22 ev i juli, 8 synliga
    { slug: 'KulturcentrumSandviken', name: 'Kulturcentrum Sandviken', city: 'Sandviken' }, // 22 ev i juli, 7 synliga
    { slug: 'uppsalakonsertkongress', name: 'Uppsala Konsert & Kongress', city: 'Uppsala' }, // 21 ev i juli, 8 synliga
    { slug: 'Smalands', name: 'Smålands Nation', city: 'Lund' }, // 21 ev i juli, 6 synliga
    { slug: 'thekaliberroom', name: 'The Kaliber Room', city: 'Uppsala' }, // 21 ev i juli, 8 synliga
    { slug: 'folkuniversitetetregionsyd', name: 'Folkuniversitetet Syd', city: 'Helsingborg' }, // 21 ev i juli, 8 synliga
    { slug: 'skogsvargarna', name: 'OK Skogsvargarna' }, // 20 ev i juli, 4 synliga
    { slug: 'kulturkvarteret', name: 'Kulturkvarteret Kristianstad', city: 'Kristianstad' }, // 20 ev i juli, 6 synliga
    { slug: 'kulturhusetstadsteatern', name: 'Kulturhuset Stadsteatern' }, // 20 ev i juli, 7 synliga
    { slug: 'stadsbiblioteketgbg', name: 'Göteborgs stadsbibliotek' }, // 20 ev i juli, 7 synliga
    { slug: 'baerumkulturhus', name: 'Bærum Kulturhus' }, // 20 ev i juli, 5 synliga
    { slug: 'porterpelle', name: 'Porter Pelle' }, // 19 ev i juli, 8 synliga
    { slug: 'Scalateatern', name: 'Scalateatern i Karlstad', city: 'Karlstad' }, // 19 ev i juli, 3 synliga
    { slug: 'Gummifabriken', name: 'Gummifabriken i Värnamo' }, // 19 ev i juli, 8 synliga
    { slug: 'eksjobibliotek', name: 'Eksjö stadsbibliotek' }, // 19 ev i juli, 7 synliga
    { slug: 'bioroy', name: 'Bio Roy' }, // 19 ev i juli, 8 synliga
    { slug: 'nationalmuseumswe', name: 'Nationalmuseum', city: 'Stockholm' }, // 18 ev i juli, 6 synliga
    { slug: 'lerumsbibliotek', name: 'Kultur och bibliotek i Lerum' }, // 18 ev i juli, 7 synliga
    { slug: 'drammenkulturhus', name: 'Drammen kulturhus' }, // 18 ev i juli, 8 synliga
    { slug: 'barumbibliotek', name: 'Bærum bibliotek' }, // 18 ev i juli, 7 synliga
    { slug: 'Bibliotekenilulea', name: 'Biblioteken i Luleå' }, // 18 ev i juli, 8 synliga
    { slug: 'svdalsland', name: 'Studieförbundet Vuxenskolan i Dalsland' }, // 17 ev i juli, 8 synliga
    { slug: 'RalingenBibliotek', name: 'Rælingen bibliotek' }, // 17 ev i juli, 7 synliga
    { slug: 'parkenkulturhus', name: 'Parken kulturhus' }, // 17 ev i juli, 3 synliga
    { slug: 'norrlandsoperan', name: 'Norrlandsoperan' }, // 17 ev i juli, 6 synliga
    { slug: 'HarrysStenungsund', name: 'Harrys' }, // 17 ev i juli, 7 synliga
    { slug: 'cnemanorrkoping', name: 'Cnema', city: 'Norrköping' }, // 17 ev i juli, 6 synliga
    { slug: 'medleymalmo', name: 'medley malmö' }, // 16 ev i juli, 8 synliga
    { slug: 'vasterasbibliotek', name: 'Västerås bibliotek', city: 'Västerås' }, // 16 ev i juli, 6 synliga
    { slug: 'Victoriateatern', name: 'Victoriateatern Malmö' }, // 16 ev i juli, 7 synliga
    { slug: 'tranemo.bibliotek', name: 'Tranemo bibliotek' }, // 16 ev i juli, 5 synliga
    { slug: 'Tangokompaniet', name: 'Tangokompaniet' }, // 16 ev i juli, 8 synliga
    { slug: 'northeventAB', name: 'Northevent AB', city: 'Linköping' }, // 16 ev i juli, 8 synliga
    { slug: 'hyltebiblioteken', name: 'Hyltebiblioteken' }, // 16 ev i juli, 6 synliga
    { slug: 'folkuniversitetetvisby', name: 'Folkuniversitetet Visby', city: 'Visby' }, // 16 ev i juli, 2 synliga
    { slug: 'bokmassandalarna', name: 'Bokmässan Dalarna', city: 'Borlänge' }, // 16 ev i juli, 8 synliga
    { slug: 'Alergotura', name: 'Alergotura', city: 'Nora' }, // 16 ev i juli, 8 synliga
    { slug: 'feverup', name: 'Fever', city: 'Stockholm' }, // 16 ev i juli, 8 synliga
    { slug: 'trivselhussverige', name: 'Trivselhus' }, // 15 ev i juli, 4 synliga
    { slug: 'sodertaljestadsscen', name: 'Södertälje stadsscen' }, // 15 ev i juli, 8 synliga
    { slug: 'stageumea', name: 'Stage Umeå' }, // 15 ev i juli, 8 synliga
    { slug: 'Regionteatern', name: 'Regionteatern Blekinge Kronoberg', city: 'Karlshamn' }, // 15 ev i juli, 7 synliga
    { slug: 'nygatan6', name: 'Nygatan 6' }, // 15 ev i juli, 5 synliga
    { slug: 'norrbottensteatern', name: 'Norrbottensteatern' }, // 15 ev i juli, 3 synliga
    { slug: 'iggesundsfolkan', name: 'Folkets Hus - Iggesund' }, // 15 ev i juli, 7 synliga
    { slug: 'hudiksvalls.bibliotek', name: 'Biblioteken i Hudiksvalls kommun', city: 'Hudiksvall' }, // 15 ev i juli, 7 synliga
    { slug: 'barnbiblioteken', name: 'Barnbiblioteken', city: 'Strängnäs' }, // 15 ev i juli, 5 synliga
    { slug: 'vilhelmina.folketshus.7', name: 'Vilhelmina Folkets Hus' }, // 14 ev i juli, 4 synliga
    { slug: 'varnamobibliotekochkultur', name: 'Värnamo bibliotek och kultur' }, // 14 ev i juli, 8 synliga
    { slug: 'SundsvallsStadsbibliotek', name: 'Sundsvalls Stadsbibliotek', city: 'Sundsvall' }, // 14 ev i juli, 8 synliga
    { slug: 'stalletvarldensmusik', name: 'Stallet - Världens Musik', city: 'Stockholm' }, // 14 ev i juli, 8 synliga
    { slug: 'malmostadsbibliotek', name: 'Stadsbiblioteket i Malmö' }, // 14 ev i juli, 8 synliga
    { slug: 'situpcomedy', name: 'Sit-up comedy show' }, // 14 ev i juli, 4 synliga
    { slug: 'NefertitiGBG', name: 'Nefertiti' }, // 14 ev i juli, 8 synliga
    { slug: 'rodakvarnkulturhus', name: 'Röda Kvarn Kultur' }, // 14 ev i juli, 8 synliga
    { slug: 'MusikiChristinae', name: 'Musik i Christinae', city: 'Alingsås' }, // 14 ev i juli, 6 synliga
    { slug: 'Midsommargarden', name: 'Midsommargården' }, // 14 ev i juli, 8 synliga
    { slug: 'gasasteget', name: 'Lunds Dansklubb Gåsasteget', city: 'Lund' }, // 14 ev i juli, 8 synliga
    { slug: 'NyaHouseofBlues', name: 'House of blues Borlänge- HOBB', city: 'Borlänge' }, // 14 ev i juli, 6 synliga
    { slug: 'hotelskansenoland', name: 'Hotel Skansen' }, // 14 ev i juli, 8 synliga
    { slug: 'gemenskapikungsor', name: 'Gemenskap i Kungsör' }, // 14 ev i juli, 7 synliga
    { slug: 'vastergotlandsmuseum', name: 'Västergötlands museum' }, // 13 ev i juli, 5 synliga
    { slug: 'oslonye', name: 'Oslo Nye Teater' }, // 13 ev i juli, 7 synliga
    { slug: 'mejeriet', name: 'Mejeriet', city: 'Lund' }, // 13 ev i juli, 6 synliga
    { slug: 'katalinsjazzbar', name: 'Katalins Bakficka', city: 'Uppsala' }, // 13 ev i juli, 8 synliga
    { slug: 'kalmarnationlund', name: 'Kalmar Nation', city: 'Lund' }, // 13 ev i juli, 7 synliga
    { slug: 'Hjaltevadshus', name: 'Hjältevadshus', city: 'Uppsala' }, // 13 ev i juli, 1 synliga
    { slug: 'bjorn.carlsson', name: 'Carlsson På Kajen', city: 'Västerås' }, // 13 ev i juli, 8 synliga
    { slug: 'Eskilstunastadsbibliotek', name: 'Eskilstuna stadsbibliotek', city: 'Eskilstuna' }, // 13 ev i juli, 8 synliga
    { slug: 'allthingslivesweden', name: 'All Things Live Sweden', city: 'Stockholm' }, // 13 ev i juli, 4 synliga
    { slug: 'Vaxjodyksport', name: 'Växjödyksport', city: 'Växjö' }, // 12 ev i juli, 8 synliga
    { slug: 'steamhotel', name: 'The Steam Hotel', city: 'Västerås' }, // 12 ev i juli, 5 synliga
    { slug: 'junisalvsborgdistrikt', name: 'Movendi Älvsborg', city: 'Borås' }, // 12 ev i juli, 8 synliga
    { slug: 'lorenskogbibliotek', name: 'Lørenskog bibliotek' }, // 12 ev i juli, 8 synliga
    { slug: 'lagerhusetsbibliotek', name: 'Lagerhusets Bibliotek' }, // 12 ev i juli, 7 synliga
    { slug: 'kramforsbibliotek', name: 'Kramfors bibliotek' }, // 12 ev i juli, 5 synliga
    { slug: 'hedvigeleonora', name: 'Hedvig Eleonora kyrka' }, // 12 ev i juli, 6 synliga
    { slug: 'babblarnalive', name: 'Babblarna på scen', city: 'Jönköping' }, // 12 ev i juli, 4 synliga
    { slug: 'vrakdykarpensionatet', name: 'Vrakdykarpensionatet' }, // 11 ev i juli, 8 synliga
    { slug: 'ulrikabeijeryoga', name: 'UB Yoga, Sång & Ceremoni', city: 'Hudiksvall' }, // 11 ev i juli, 6 synliga
    { slug: 'throwbackeventsldn', name: 'Throwback Events' }, // 11 ev i juli, 8 synliga
    { slug: 'lorenskoghus', name: 'Lørenskog hus' }, // 11 ev i juli, 7 synliga
    { slug: 'inrenatur', name: 'Inre natur' }, // 11 ev i juli, 5 synliga
    { slug: 'Falkopingsbibliotek', name: 'Falköpings bibliotek' }, // 11 ev i juli, 6 synliga
    { slug: 'ideadrottninghog', name: 'Idé A Drottninghög', city: 'Helsingborg' }, // 11 ev i juli, 8 synliga
    { slug: 'absaloncph', name: 'Værksteder i Absalon' }, // 10 ev i juli, 8 synliga
    { slug: 'varldskulturmuseet', name: 'Världskulturmuseet' }, // 10 ev i juli, 8 synliga
    { slug: 'litensmula', name: 'Vita Huset - En Liten Smula', city: 'Norrtälje' }, // 10 ev i juli, 8 synliga
    { slug: 'Sundsvallsmuseum', name: 'Sundsvalls museum' }, // 10 ev i juli, 4 synliga
    { slug: 'taystase', name: 'Taysta', city: 'Västerås' }, // 10 ev i juli, 8 synliga
    { slug: 'musikidalarna', name: 'Musik i Dalarna', city: 'Falun' }, // 10 ev i juli, 8 synliga
    { slug: 'magasinetfalun', name: 'Magasinet Falun', city: 'Falun' }, // 10 ev i juli, 8 synliga
    { slug: 'kulturmagasinetsundsvall', name: 'Kulturmagasinet Sundsvall', city: 'Sundsvall' }, // 10 ev i juli, 8 synliga
    { slug: 'jadanskurs', name: 'JAdans' }, // 10 ev i juli, 8 synliga
    { slug: 'konstepidemin', name: 'Konstepidemin' }, // 10 ev i juli, 4 synliga
    { slug: 'gallivarekommunsfolkbibliotek', name: 'Gällivare kommuns folkbibliotek', city: 'Gällivare' }, // 10 ev i juli, 4 synliga
    { slug: 'gretasgothenburg', name: 'Gretas Göteborg', city: 'Göteborg' }, // 10 ev i juli, 8 synliga
    { slug: 'bibliotekljusdal', name: 'Biblioteken i Ljusdals kommun' }, // 10 ev i juli, 5 synliga
    { slug: 'BibliotekeniKalmarkommun', name: 'Biblioteken i Kalmar kommun', city: 'Kalmar' }, // 10 ev i juli, 8 synliga
    { slug: 'askerkulturhus', name: 'Asker kulturhus' }, // 10 ev i juli, 8 synliga
    { slug: 'ABFsorm', name: 'ABF Sörmland', city: 'Eskilstuna' }, // 10 ev i juli, 8 synliga
    { slug: 'almhultsbibliotek', name: 'Älmhults bibliotek' }, // 9 ev i juli, 5 synliga
    { slug: 'vadstenabibliotek', name: 'Vadstena bibliotek' }, // 9 ev i juli, 4 synliga
    { slug: 'VintervikensTradgard', name: 'Vintervikens Trädgård', city: 'Stockholm' }, // 9 ev i juli, 8 synliga
    { slug: 'TheBruceSpringsteenTribute', name: 'The Bruce Springsteen Tribute - Best of the Boss', city: 'Trollhättan' }, // 9 ev i juli, 8 synliga
    { slug: 'ostergotlandsbokmassa', name: 'TellUs bok- och berättarmässa i Linköping', city: 'Linköping' }, // 9 ev i juli, 8 synliga
    { slug: 'StoraTeatern', name: 'Stora Teatern' }, // 9 ev i juli, 6 synliga
    { slug: 'sigtunastiftelsen', name: 'Sigtunastiftelsen' }, // 9 ev i juli, 6 synliga
    { slug: 'sarakulturhus', name: 'Sara kulturhus' }, // 9 ev i juli, 8 synliga
    { slug: 'puskasmusikk', name: 'Puskas Musikk & Platebar' }, // 9 ev i juli, 3 synliga
    { slug: 'Kafebredsjon', name: 'Kafe Bredsjön' }, // 9 ev i juli, 4 synliga
    { slug: 'HotelEggers', name: 'Hôtel Eggers' }, // 9 ev i juli, 5 synliga
    { slug: 'gavlebibliotek', name: 'Gävle bibliotek', city: 'Gävle' }, // 9 ev i juli, 8 synliga
    { slug: 'gavlekonserthus', name: 'Gävle Konserthus', city: 'Gävle' }, // 9 ev i juli, 8 synliga
    { slug: 'fhuddevalla', name: 'Folkets Hus Uddevalla', city: 'Uddevalla' }, // 9 ev i juli, 6 synliga
    { slug: 'fhsater', name: 'Folkets Hus Säter' }, // 9 ev i juli, 8 synliga
    { slug: 'Eslovsstadsbibliotek', name: 'Eslövs stadsbibliotek', city: 'Eslöv' }, // 9 ev i juli, 6 synliga
    { slug: 'bibliotekenitierp', name: 'Biblioteken i Tierps kommun' }, // 9 ev i juli, 8 synliga
    { slug: 'arvikabibliotek', name: 'Arvika Bibliotek', city: 'Arvika' }, // 9 ev i juli, 6 synliga
    { slug: 'abf.stockholm', name: 'ABF Stockholm', city: 'Stockholm' }, // 9 ev i juli, 6 synliga
    { slug: 'orebro.salsafriends.9', name: 'Örebro Salsafriends' }, // 8 ev i juli, 3 synliga
    { slug: 'vaniumeasida', name: 'Vän i Umeå' }, // 8 ev i juli, 8 synliga
    { slug: 'visituddevalla', name: 'Visit Uddevalla', city: 'Uddevalla' }, // 8 ev i juli, 2 synliga
    { slug: 'regionmuseetskane', name: 'Regionmuseet Skåne', city: 'Kristianstad' }, // 8 ev i juli, 3 synliga
    { slug: 'oxiebiblioteket', name: 'Oxiebiblioteket' }, // 8 ev i juli, 5 synliga
    { slug: 'RadissonBluGothenburg', name: 'Radisson Blu Scandinavia Hotel, Gothenburg (Göteborg)', city: 'Göteborg' }, // 8 ev i juli, 5 synliga
    { slug: 'NaturumVattenriket', name: 'Naturum Vattenriket' }, // 8 ev i juli, 2 synliga
    { slug: 'lundsallhelgonakyrka', name: 'Lunds Allhelgonakyrka' }, // 8 ev i juli, 5 synliga
    { slug: 'kulturhusetkaken', name: 'Kulturhuset Kåken' }, // 8 ev i juli, 8 synliga
    { slug: 'kulturbolaget', name: 'Kulturbolaget' }, // 8 ev i juli, 8 synliga
    { slug: 'kristinehamnsbibliotek', name: 'Kristinehamns bibliotek', city: 'Kristinehamn' }, // 8 ev i juli, 7 synliga
    { slug: 'krallentertainment', name: 'Krall Entertainment', city: 'Jönköping' }, // 8 ev i juli, 6 synliga
    { slug: 'borgmastarvilla', name: 'Hotell Humbla', city: 'Sölvesborg' }, // 8 ev i juli, 2 synliga
    { slug: 'ebba.dansklubb', name: 'EBBA Dansklubb' }, // 8 ev i juli, 6 synliga
    { slug: 'drakenlive', name: 'Draken Live' }, // 8 ev i juli, 8 synliga
    { slug: 'christmasnighttour', name: 'Christmas Night', city: 'Uppsala' }, // 8 ev i juli, 8 synliga
    { slug: 'musikenshusgbg', name: 'Café Hängmattan' }, // 8 ev i juli, 8 synliga
    { slug: 'bjuvsbibliotek', name: 'Bjuvs bibliotek' }, // 8 ev i juli, 8 synliga
    { slug: 'BestermanAB', name: 'Besterman', city: 'Uppsala' }, // 8 ev i juli, 8 synliga
    { slug: 'atalantegbg', name: 'Atalante' }, // 8 ev i juli, 3 synliga
    { slug: 'anebybibliotek', name: 'Aneby bibliotek' }, // 8 ev i juli, 4 synliga
    { slug: 'umeafilmfestival', name: 'Umeå Filmfestival' }, // 7 ev i juli, 8 synliga
    { slug: 'tibrobibliotek', name: 'Tibro bibliotek' }, // 7 ev i juli, 6 synliga
    { slug: 'Storlihytta', name: 'Storlihytta' }, // 7 ev i juli, 8 synliga
    { slug: 'Sjoangen', name: 'Sjöängen i Askersund' }, // 7 ev i juli, 5 synliga
    { slug: 'sisselkyrkjebo', name: 'Sissel Kyrkjebø', city: 'Stockholm' }, // 7 ev i juli, 8 synliga
    { slug: 'shrekraveofficial', name: 'Shrek Rave' }, // 7 ev i juli, 8 synliga
    { slug: 'reisdegkomikerklubb', name: 'Reis Deg Komikerklubb' }, // 7 ev i juli, 4 synliga
    { slug: 'planthousehuntersville', name: 'PlantHouse' }, // 7 ev i juli, 8 synliga
    { slug: 'nojespartner', name: 'Nöjespartner', city: 'Varberg' }, // 7 ev i juli, 1 synliga
    { slug: 'northcreativenodes', name: 'North Creative Nodes', city: 'Boden' }, // 7 ev i juli, 7 synliga
    { slug: 'molndalsdansskola', name: 'Mölndals Dansskola' }, // 7 ev i juli, 8 synliga
    { slug: 'NalenStockholm', name: 'Nalen', city: 'Stockholm' }, // 7 ev i juli, 7 synliga
    { slug: 'konstmuseummalmo', name: 'Malmö Konstmuseum' }, // 7 ev i juli, 5 synliga
    { slug: 'movehomesverige', name: 'Movehome' }, // 7 ev i juli, 3 synliga
    { slug: 'LBSDK', name: 'Luleå Bugg och Swing Dansklubb' }, // 7 ev i juli, 4 synliga
    { slug: 'linkopingsstadsbibliotek', name: 'Linköpings stadsbibliotek', city: 'Linköping' }, // 7 ev i juli, 8 synliga
    { slug: 'latinamerikaifokus', name: 'Latinamerika i Fokus', city: 'Lund' }, // 7 ev i juli, 8 synliga
    { slug: 'Landskronabibliotek', name: 'Landskrona bibliotek', city: 'Landskrona' }, // 7 ev i juli, 8 synliga
    { slug: 'konstmuseet', name: 'Konstmuseet', city: 'Skövde' }, // 7 ev i juli, 4 synliga
    { slug: 'Inkonst3', name: 'Inkonst' }, // 7 ev i juli, 8 synliga
    { slug: 'hjartatshus', name: 'Hjärtats hus', city: 'Jönköping' }, // 7 ev i juli, 5 synliga
    { slug: 'KappaBarMalmo', name: 'Kappa Bar Malmö' }, // 7 ev i juli, 8 synliga
    { slug: 'GothenburgSymphonyOrchestra', name: 'Göteborgs Symfoniker' }, // 7 ev i juli, 3 synliga
    { slug: 'gavlesymfoniorkester', name: 'Gävle Symfoniorkester', city: 'Gävle' }, // 7 ev i juli, 3 synliga
    { slug: 'Familjecentralen.Ulricehamn', name: 'Familjecentralen, Öppna förskolan i Ulricehamn' }, // 7 ev i juli, 5 synliga
    { slug: 'falkenbergsstadsteater', name: 'Falkenbergs Stadsteater', city: 'Falkenberg' }, // 7 ev i juli, 8 synliga
    { slug: 'enkopingskommunbibliotek', name: 'Enköpings kommunbibliotek', city: 'Enköping' }, // 7 ev i juli, 3 synliga
    { slug: 'EncoreSundbyberg', name: 'Encore, Sundbyberg' }, // 7 ev i juli, 8 synliga
    { slug: 'DanshusetDkBuggie', name: 'Dansklubben Buggie i Ulricehamn' }, // 7 ev i juli, 4 synliga
    { slug: 'barnensscen', name: 'Barnens Scen' }, // 7 ev i juli, 4 synliga
    { slug: 'ystadsbibliotek', name: 'Ystads bibliotek', city: 'Ystad' }, // 6 ev i juli, 8 synliga
    { slug: 'varlokal', name: 'Vår lokal' }, // 6 ev i juli, 7 synliga
    { slug: 'sundsvallskommun', name: 'Sundsvalls kommun', city: 'Sundsvall' }, // 6 ev i juli, 7 synliga
    { slug: 'royal.roland.5623', name: 'SoundTrack Roland' }, // 6 ev i juli, 2 synliga
    { slug: 'skovdekulturhus', name: 'Skövde Kulturhus', city: 'Skövde' }, // 6 ev i juli, 8 synliga
    { slug: '100046421744875', name: 'Råda Rum' }, // 6 ev i juli, 6 synliga
    { slug: 'OdeumLundsUniversitet', name: 'Odeum', city: 'Lund' }, // 6 ev i juli, 7 synliga
    { slug: 'nbvost', name: 'NBV Öst' }, // 6 ev i juli, 3 synliga
    { slug: 'monument031', name: 'Monument 031' }, // 6 ev i juli, 8 synliga
    { slug: 'moriskapaviljongen', name: 'Moriska Paviljongen' }, // 6 ev i juli, 8 synliga
    { slug: 'malmolive', name: 'Malmö Live' }, // 6 ev i juli, 4 synliga
    { slug: 'kafedeluxe', name: 'Kafé de luxe' }, // 6 ev i juli, 6 synliga
    { slug: 'harnosandsbibliotek', name: 'Härnösands bibliotek', city: 'Härnösand' }, // 6 ev i juli, 2 synliga
    { slug: 'hallundafolketshus', name: 'Hallunda Folkets Hus' }, // 6 ev i juli, 8 synliga
    { slug: 'globallivingvasteras', name: 'Global Living', city: 'Västerås' }, // 6 ev i juli, 6 synliga
    { slug: 'eskilstunakompaniet', name: 'Eskilstunakompaniet', city: 'Eskilstuna' }, // 6 ev i juli, 8 synliga
    { slug: 'bollnasbibliotek', name: 'Bollnäs bibliotek och Kulturhuset Bollnäs' }, // 6 ev i juli, 6 synliga
    { slug: 'alvestabibliotek', name: 'Biblioteken i Alvesta kommun' }, // 6 ev i juli, 7 synliga
    { slug: 'arbogabio', name: 'Arboga bio' }, // 6 ev i juli, 8 synliga
    { slug: '59anLysekil', name: '59an i Lysekil' }, // 6 ev i juli, 2 synliga
    { slug: 'yogaskolan.karlstad', name: 'Yogaskolan Karlstad', city: 'Karlstad' }, // 5 ev i juli, 5 synliga
    { slug: 'WoodyWestGbg', name: 'Woody West' }, // 5 ev i juli, 8 synliga
    { slug: 'stockholmsmarknader', name: 'Stockholmsmarknader' }, // 5 ev i juli, 5 synliga
    { slug: 'stadshallen', name: 'Stadshallen', city: 'Lund' }, // 5 ev i juli, 7 synliga
    { slug: 'SensusRCN', name: 'Rättighetscentrum Norrbotten - mot diskriminering' }, // 5 ev i juli, 2 synliga
    { slug: 'pustervik', name: 'Pustervik' }, // 5 ev i juli, 8 synliga
    { slug: 'pitea.se', name: 'Piteå kommun', city: 'Piteå' }, // 5 ev i juli, 1 synliga
    { slug: 'Parkbiografen', name: 'Parkbiografen' }, // 5 ev i juli, 2 synliga
    { slug: 'lokstallet.skovde', name: 'Lokstallet', city: 'Skövde' }, // 5 ev i juli, 8 synliga
    { slug: 'Kulturhusetibergen', name: 'Kulturhuset i Bergen' }, // 5 ev i juli, 7 synliga
    { slug: 'kulturhusetmobeln', name: 'Kulturhuset Möbeln' }, // 5 ev i juli, 8 synliga
    { slug: 'kpdmellerud', name: 'Kulturbruket på Dal' }, // 5 ev i juli, 5 synliga
    { slug: 'Kapellet.telje', name: 'Kapellet', city: 'Norrtälje' }, // 5 ev i juli, 8 synliga
    { slug: 'JiAdagarna', name: 'JiA-Dagarna | Juridiska Föreningens arbetsmarknadsdagar | www.jf.se/jia', city: 'Lund' }, // 5 ev i juli, 8 synliga
    { slug: 'jagvagarstuffa', name: 'Jag vågar stuffa', city: 'Karlshamn' }, // 5 ev i juli, 6 synliga
    { slug: 'harkekonstcentrum', name: 'Härke Konstcentrum' }, // 5 ev i juli, 2 synliga
    { slug: 'eyragarden', name: 'Eyragården, Kävlinge Kommun' }, // 5 ev i juli, 5 synliga
    { slug: 'energiheaxorna', name: 'Energihäxorna' }, // 5 ev i juli, 3 synliga
    { slug: 'bolgenkulturhus', name: 'Bølgen Kulturhus' }, // 5 ev i juli, 3 synliga
    { slug: 'biograffokusjonkoping', name: 'Biograf Fokus Jönköping', city: 'Jönköping' }, // 5 ev i juli, 5 synliga
    { slug: 'biokontrastiggesund', name: 'Bio Kontrast - Folkets Hus Iggesund' }, // 5 ev i juli, 2 synliga
    { slug: 'amplifiedvast', name: 'Amplified Väst', city: 'Borås' }, // 5 ev i juli, 5 synliga
    { slug: 'Vardklockanskyrka', name: 'Vårdklockans kyrka', city: 'Visby' }, // 4 ev i juli, 1 synliga
    { slug: 'villalidkopingbk', name: 'Villa Lidköping BK', city: 'Lidköping' }, // 4 ev i juli, 2 synliga
    { slug: 'vewcs', name: 'Victor Evelina West Coast Swing', city: 'Uppsala' }, // 4 ev i juli, 4 synliga
    { slug: 'vardagibalans', name: 'Vardag i Balans', city: 'Lund' }, // 4 ev i juli, 3 synliga
    { slug: 'UpplevSkovde', name: 'Upplev Skövde', city: 'Skövde' }, // 4 ev i juli, 4 synliga
    { slug: 'teatervasternorrland', name: 'Teater Västernorrland' }, // 4 ev i juli, 1 synliga
    { slug: 'tasspalatset.se', name: 'Tasspalatset' }, // 4 ev i juli, 5 synliga
    { slug: 'sundsbysateri', name: 'Sundsby Säteri' }, // 4 ev i juli, 4 synliga
    { slug: 'studieframjandetumea', name: 'Studiefrämjandet Västerbotten' }, // 4 ev i juli, 6 synliga
    { slug: 'stuckonlive', name: 'Stuck On - Live' }, // 4 ev i juli, 7 synliga
    { slug: 'rabagastalta', name: 'Rabagast' }, // 4 ev i juli, 8 synliga
    { slug: 'quiztyreso', name: 'QUIZ - Tyresö' }, // 4 ev i juli, 1 synliga
    { slug: 'poffertjes.se', name: 'Poffertjes.se' }, // 4 ev i juli, 8 synliga
    { slug: 'nordicsociety.org', name: 'Nordic society', city: 'Stockholm' }, // 4 ev i juli, 3 synliga
    { slug: 'NiklasStromstedtMusic', name: 'Niklas Strömstedt' }, // 4 ev i juli, 8 synliga
    { slug: 'mikespubskovde', name: 'Mikes pub och restaurang', city: 'Skövde' }, // 4 ev i juli, 1 synliga
    { slug: 'mats.fuchs.9', name: 'Mats Fuchs' }, // 4 ev i juli, 1 synliga
    { slug: 'malmomuseum', name: 'Malmö museum', city: 'Malmö' }, // 4 ev i juli, 5 synliga
    { slug: 'MahalayaCenter', name: 'Mahalaya - Center for Holistic Growth' }, // 4 ev i juli, 6 synliga
    { slug: 'malmabuggarna', name: 'Malmabuggarna' }, // 4 ev i juli, 1 synliga
    { slug: 'lyckselemusikoteater', name: 'Lycksele Musik & Teaterförening-en del av Riksteatern', city: 'Lycksele' }, // 4 ev i juli, 5 synliga
    { slug: 'lassewinnerback', name: 'Lars Winnerbäck', city: 'Linköping' }, // 4 ev i juli, 8 synliga
    { slug: 'kulturhusetfregatten', name: 'Kulturhuset Fregatten' }, // 4 ev i juli, 4 synliga
    { slug: 'kristianstadsfilmstudio', name: 'Kristianstads Filmstudio', city: 'Kristianstad' }, // 4 ev i juli, 4 synliga
    { slug: 'visitsoderhamn', name: 'Kulturen Söderhamn', city: 'Söderhamn' }, // 4 ev i juli, 1 synliga
    { slug: 'kalixkommun', name: 'Kalix kommun' }, // 4 ev i juli, 7 synliga
    { slug: 'trumhakan', name: 'Jansson Communication' }, // 4 ev i juli, 5 synliga
    { slug: 'KSHHealing', name: 'KSH Healing', city: 'Kalmar' }, // 4 ev i juli, 5 synliga
    { slug: 'icfalkenberg', name: 'IC Falkenberg', city: 'Falkenberg' }, // 4 ev i juli, 8 synliga
    { slug: 'huddingeparkrun', name: 'Huddinge Parkrun' }, // 4 ev i juli, 8 synliga
    { slug: 'hovmantorps.folketshus', name: 'Hovmantorps Folkets Hus' }, // 4 ev i juli, 3 synliga
    { slug: 'estrad.norr', name: 'Estrad Norr' }, // 4 ev i juli, 3 synliga
    { slug: 'centrumhusbiografen', name: 'Centrumhusbiografen' }, // 4 ev i juli, 5 synliga
    { slug: 'catscornermalmo', name: 'Cats\' Corner' }, // 4 ev i juli, 2 synliga
    { slug: 'boulognerskogenparkrun', name: 'Boulognerskogen parkrun, Gävle', city: 'Gävle' }, // 4 ev i juli, 5 synliga
    { slug: 'Boras.Stadsteater', name: 'Borås Stadsteater', city: 'Borås' }, // 4 ev i juli, 4 synliga
    { slug: 'BorlangeDance', name: 'Borlänge Dance', city: 'Borlänge' }, // 4 ev i juli, 6 synliga
    { slug: 'boca.vasteras', name: 'Boca Västerås', city: 'Västerås' }, // 4 ev i juli, 2 synliga
    { slug: 'haningebibliotek', name: 'Biblioteken i Haninge' }, // 4 ev i juli, 3 synliga
    { slug: 'backyardfalun', name: 'Backyard Club', city: 'Falun' }, // 4 ev i juli, 4 synliga
    { slug: 'arbetetsmuseum', name: 'Arbetets museum', city: 'Norrköping' }, // 4 ev i juli, 3 synliga
    { slug: 'alingsaskulturhus', name: 'Alingsås kulturhus', city: 'Alingsås' }, // 4 ev i juli, 3 synliga
    { slug: 'ostgotateatern', name: 'Östgötateatern', city: 'Norrköping' }, // 3 ev i juli, 3 synliga
    { slug: 'vaxjokonserthus', name: 'Växjö Konserthus' }, // 3 ev i juli, 8 synliga
    { slug: 'WermlandOpera', name: 'Wermland Opera', city: 'Karlstad' }, // 3 ev i juli, 3 synliga
    { slug: 'vasteraskongress', name: 'Västerås Kongress', city: 'Västerås' }, // 3 ev i juli, 8 synliga
    { slug: 'Levochmaval', name: 'ViveVale', city: 'Lund' }, // 3 ev i juli, 2 synliga
    { slug: 'BokskogeniTorup', name: 'Torups Slott' }, // 3 ev i juli, 3 synliga
    { slug: 'stasartistas', name: 'Stas Artist' }, // 3 ev i juli, 4 synliga
    { slug: 'SoulRelax.Motala', name: 'SoulRelax', city: 'Motala' }, // 3 ev i juli, 3 synliga
    { slug: 'skaneskonst', name: 'Skånes konstförening' }, // 3 ev i juli, 1 synliga
    { slug: 'SkolsimmarnaIK', name: 'Skolsimmarna IK' }, // 3 ev i juli, 3 synliga
    { slug: 'seniorikungsbacka', name: 'Senior i Kungsbacka', city: 'Kungsbacka' }, // 3 ev i juli, 3 synliga
    { slug: 'nojesfabriken', name: 'Nöjesfabriken', city: 'Karlstad' }, // 3 ev i juli, 8 synliga
    { slug: 'natminkulturhus', name: 'Nationella minoriteters kulturhus' }, // 3 ev i juli, 3 synliga
    { slug: 'musikvalvetbaggen', name: 'Musikvalvet Baggen' }, // 3 ev i juli, 2 synliga
    { slug: 'mollan.mitt', name: 'Mitt Möllan' }, // 3 ev i juli, 3 synliga
    { slug: 'bodyandsoulmovement', name: 'Maria Slättorp - Body & Soul Movement' }, // 3 ev i juli, 5 synliga
    { slug: 'statarmuseet', name: 'Malmö Stad' }, // 3 ev i juli, 2 synliga
    { slug: 'malmocityskaters', name: 'Malmö City Skaters' }, // 3 ev i juli, 4 synliga
    { slug: 'lundsstadsbibliotek', name: 'Lunds stadsbibliotek', city: 'Lund' }, // 3 ev i juli, 8 synliga
    { slug: 'louisdegeernorrkoping', name: 'Louis De Geer, Norrköping', city: 'Norrköping' }, // 3 ev i juli, 8 synliga
    { slug: 'Kulturhjaltarna', name: 'Kulturoasen' }, // 3 ev i juli, 8 synliga
    { slug: 'kulturhusetmollegarden', name: 'Kulturhuset Möllegården' }, // 3 ev i juli, 4 synliga
    { slug: 'Kajmanpite', name: 'Kajman' }, // 3 ev i juli, 4 synliga
    { slug: 'jonkopingcity', name: 'Jönköping City', city: 'Jönköping' }, // 3 ev i juli, 2 synliga
    { slug: 'bio.juniora', name: 'Juniora' }, // 3 ev i juli, 3 synliga
    { slug: 'jiversdancingclub', name: 'Jivers Dancing Club' }, // 3 ev i juli, 8 synliga
    { slug: 'jazzklubbensundsvall.se', name: 'Jazzklubben Sundsvall', city: 'Sundsvall' }, // 3 ev i juli, 4 synliga
    { slug: 'michael.haggmark.1', name: 'JLS Jämtlands Lokalhistoriker och Släktforskare' }, // 3 ev i juli, 1 synliga
    { slug: 'HotellHavanna', name: 'Hotell Havanna', city: 'Varberg' }, // 3 ev i juli, 3 synliga
    { slug: 'hedemorafolketspark', name: 'Hedemora Folkets Park' }, // 3 ev i juli, 8 synliga
    { slug: 'hiphopweekendkalmar', name: 'Hip Hop Weekend' }, // 3 ev i juli, 8 synliga
    { slug: 'helsingborgcity', name: 'HBG City', city: 'Helsingborg' }, // 3 ev i juli, 4 synliga
    { slug: 'artstheatregeorge', name: 'George Arts Theatre' }, // 3 ev i juli, 2 synliga
    { slug: 'gasklockorna', name: 'Gasklockorna Gävle', city: 'Gävle' }, // 3 ev i juli, 8 synliga
    { slug: 'forfattarcentrumvast', name: 'Författarcentrum Väst' }, // 3 ev i juli, 2 synliga
    { slug: 'Folkuniversitetet.Goteborg', name: 'Folkuniversitetet Göteborg', city: 'Göteborg' }, // 3 ev i juli, 4 synliga
    { slug: 'Clubsoundkilla', name: 'Club Soundkilla' }, // 3 ev i juli, 2 synliga
    { slug: 'clarionostersund', name: 'Clarion Hotel Grand Östersund (Östersund)' }, // 3 ev i juli, 7 synliga
    { slug: 'clarionsundsvall', name: 'Clarion Hotel Sundsvall', city: 'Sundsvall' }, // 3 ev i juli, 1 synliga
    { slug: 'BorasDansforening', name: 'Borås Dansförening', city: 'Borås' }, // 3 ev i juli, 6 synliga
    { slug: 'backa.teater', name: 'Backa Teater' }, // 3 ev i juli, 1 synliga
    { slug: 'bibliotekeniburlov', name: 'Biblioteken i Burlöv' }, // 3 ev i juli, 6 synliga
    { slug: 'AlingsasDansklubb', name: 'Alingsås Dansklubb', city: 'Alingsås' }, // 3 ev i juli, 2 synliga
    { slug: 'abfmalmo', name: 'ABF Malmö', city: 'Trelleborg' }, // 3 ev i juli, 7 synliga
    { slug: 'alltpascen', name: 'Allt På Scen & Mycke Nöje', city: 'Lund' }, // 3 ev i juli, 8 synliga
    { slug: 'ostfoldteater', name: 'Østfold Teater' }, // 2 ev i juli, 5 synliga
    { slug: 'folkanteater', name: 'Örnsköldsviks Riksteaterförening' }, // 2 ev i juli, 8 synliga
    { slug: 'ystadicentrum', name: 'Ystad i centrum', city: 'Ystad' }, // 2 ev i juli, 3 synliga
    { slug: '61575848977708', name: 'WIESE' }, // 2 ev i juli, 6 synliga
    { slug: 'varakonserthus', name: 'Vara Konserthus' }, // 2 ev i juli, 8 synliga
    { slug: 'upplevskara', name: 'Upplev Skara' }, // 2 ev i juli, 4 synliga
    { slug: 'UnionScene', name: 'Union Scene' }, // 2 ev i juli, 8 synliga
    { slug: 'ungscenost', name: 'Ung Scen Öst', city: 'Norrköping' }, // 2 ev i juli, 2 synliga
    { slug: 'tunapark.se', name: 'Tuna Park', city: 'Eskilstuna' }, // 2 ev i juli, 3 synliga
    { slug: 'classicumvaxthus', name: 'Classicum Växthus AB' }, // 2 ev i juli, 3 synliga
    { slug: 'dansofolkton', name: 'Dans & Folkton' }, // 2 ev i juli, 2 synliga
    { slug: 'brasserietboras', name: 'Brasseriet', city: 'Borås' }, // 2 ev i juli, 4 synliga
    { slug: 'BlaKaktus', name: 'Bluesföreningen Blå Kaktus' }, // 2 ev i juli, 6 synliga
    { slug: 'bibliotekenisvedala', name: 'Biblioteken i Svedala' }, // 2 ev i juli, 3 synliga
    { slug: 'angebibliotek', name: 'Biblioteken i Ånge' }, // 2 ev i juli, 5 synliga
    { slug: 'bibliotekenilaholm', name: 'Biblioteken i Laholm', city: 'Laholm' }, // 2 ev i juli, 3 synliga
    { slug: 'BeijersParksCafe', name: 'Beijers Parks Café' }, // 2 ev i juli, 2 synliga
    { slug: 'mountainfilm', name: 'Banff Mountain Film Festival Scandinavia' }, // 2 ev i juli, 2 synliga
    { slug: 'backayardbeats', name: 'Back a Yard Beats', city: 'Stockholm' }, // 2 ev i juli, 3 synliga
    { slug: 'ABForesund', name: 'ABF Öresund', city: 'Helsingborg' }, // 2 ev i juli, 4 synliga
];
