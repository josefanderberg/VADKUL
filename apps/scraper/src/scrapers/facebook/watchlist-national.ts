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
    { slug: 'svenskakammarorkestern', name: 'Visit Örebro' }, // 158 ev i juli, 8 synliga
    { slug: 'gkmmsplit', name: 'Gradska knjiznica Marka Marulica Split' }, // 70 ev i juli, 6 synliga
    { slug: 'eventkalix', name: 'Kalix Kommun', city: 'Luleå' }, // 67 ev i juli, 8 synliga
    { slug: 'fkpscorpio', name: 'FKP Scorpio' }, // 65 ev i juli, 8 synliga
    { slug: 'vaxjobibliotek', name: 'Växjö bibliotek' }, // 58 ev i juli, 4 synliga
    { slug: 'studioexpress.se', name: 'Studioexpress.se', city: 'Eskilstuna' }, // 50 ev i juli, 8 synliga
    { slug: 'livenationswe', name: 'Live Nation Sweden', city: 'Stockholm' }, // 48 ev i juli, 8 synliga
    { slug: 'kulturaktiebolaget', name: 'Kulturaktiebolaget', city: 'Västervik' }, // 47 ev i juli, 8 synliga
    { slug: 'guppyentertainmentab', name: 'Guppy Entertainment', city: 'Kristianstad' }, // 43 ev i juli, 8 synliga
    { slug: 'nieuscene', name: 'Nieu Torshov' }, // 42 ev i juli, 7 synliga
    { slug: 'rodakvarnhbg', name: 'Röda Kvarn Helsingborg', city: 'Helsingborg' }, // 34 ev i juli, 8 synliga
    { slug: 'vastmanlandslansmuseum', name: 'Västmanlands läns museum', city: 'Västerås' }, // 33 ev i juli, 8 synliga
    { slug: 'livenationnorway', name: 'Live Nation Norway' }, // 31 ev i juli, 5 synliga
    { slug: 'FKPscorpiosweden', name: 'FKP Scorpio Sverige', city: 'Stockholm' }, // 31 ev i juli, 8 synliga
    { slug: 'Megascope', name: 'Megascope' }, // 30 ev i juli, 8 synliga
    { slug: 'Ostgota', name: 'Östgöta Nation', city: 'Lund' }, // 30 ev i juli, 8 synliga
    { slug: 'planbmalmo', name: 'Plan B - malmö' }, // 28 ev i juli, 8 synliga
    { slug: 'rockefelleroslo', name: 'Rockefeller / John Dee / Sentrum Scene' }, // 27 ev i juli, 7 synliga
    { slug: 'trinitymusicberlin', name: 'Trinity Music' }, // 27 ev i juli, 8 synliga
    { slug: 'Musikhuset', name: 'Musikhuset Gävle', city: 'Gävle' }, // 27 ev i juli, 8 synliga
    { slug: 'stadsbiblioteketgbg', name: 'Göteborgs stadsbibliotek' }, // 27 ev i juli, 8 synliga
    { slug: 'stormspakhus', name: 'Storms Pakhus' }, // 26 ev i juli, 6 synliga
    { slug: 'Debasersthlm', name: 'Debaser', city: 'Stockholm' }, // 26 ev i juli, 7 synliga
    { slug: 'folkuniversitetetregionsyd', name: 'Folkuniversitetet Syd', city: 'Kristianstad' }, // 25 ev i juli, 8 synliga
    { slug: 'KonserthusetStockholm', name: 'Konserthuset Stockholm', city: 'Stockholm' }, // 25 ev i juli, 8 synliga
    { slug: '61587843912500', name: 'Skinnskattebergs Kommun' }, // 24 ev i juli, 6 synliga
    { slug: 'thekaliberroom', name: 'The Kaliber Room', city: 'Uppsala' }, // 24 ev i juli, 8 synliga
    { slug: 'Honggymnastikforening', name: 'Høng GF' }, // 24 ev i juli, 8 synliga
    { slug: 'kulturhusetstadsteatern', name: 'Kulturhuset Stadsteatern' }, // 24 ev i juli, 8 synliga
    { slug: 'jazzclubfasching', name: 'Fasching' }, // 24 ev i juli, 7 synliga
    { slug: 'Scalateatern', name: 'Scalateatern i Karlstad', city: 'Karlstad' }, // 23 ev i juli, 6 synliga
    { slug: 'lerumsbibliotek', name: 'Kultur och bibliotek i Lerum', city: 'Alingsås' }, // 23 ev i juli, 8 synliga
    { slug: 'jubelAB', name: 'Jubel', city: 'Uppsala' }, // 23 ev i juli, 8 synliga
    { slug: 'vasteraskonserthus', name: 'Västerås Konserthus', city: 'Västerås' }, // 22 ev i juli, 8 synliga
    { slug: 'RalingenBibliotek', name: 'Rælingen bibliotek' }, // 22 ev i juli, 8 synliga
    { slug: 'StudieforbundetVuxenskolanVast', name: 'Studieförbundet Vuxenskolan Väst', city: 'Uddevalla' }, // 22 ev i juli, 7 synliga
    { slug: 'norrlandsoperan', name: 'Norrlandsoperan' }, // 21 ev i juli, 6 synliga
    { slug: 'Kulturenshus', name: 'Kulturens hus Luleå' }, // 21 ev i juli, 8 synliga
    { slug: 'hundesenteretitrondheim', name: 'Hundesenteret' }, // 21 ev i juli, 8 synliga
    { slug: 'skogsvargarna', name: 'OK Skogsvargarna' }, // 20 ev i juli, 7 synliga
    { slug: 'kollektivetlivetbar', name: 'Kollektivet Livet' }, // 20 ev i juli, 8 synliga
    { slug: 'baerumkulturhus', name: 'Bærum Kulturhus' }, // 20 ev i juli, 6 synliga
    { slug: 'svdalsland', name: 'Studieförbundet Vuxenskolan i Dalsland' }, // 19 ev i juli, 8 synliga
    { slug: 'parkenkulturhus', name: 'Parken kulturhus' }, // 19 ev i juli, 4 synliga
    { slug: 'grandliveab', name: 'Grand Live', city: 'Kungsbacka' }, // 19 ev i juli, 8 synliga
    { slug: 'folketsbiomalmo', name: 'Biograf Panora Malmö' }, // 19 ev i juli, 8 synliga
    { slug: 'NefertitiGBG', name: 'Nefertiti' }, // 19 ev i juli, 8 synliga
    { slug: 'bibliotekeniboras', name: 'Biblioteken i Borås', city: 'Borås' }, // 19 ev i juli, 8 synliga
    { slug: 'uppsalakonsertkongress', name: 'Uppsala Konsert & Kongress', city: 'Uppsala' }, // 18 ev i juli, 8 synliga
    { slug: 'stalletvarldensmusik', name: 'Stallet - Världens Musik', city: 'Stockholm' }, // 18 ev i juli, 8 synliga
    { slug: 'kulturkvarteret', name: 'Kulturkvarteret Kristianstad', city: 'Kristianstad' }, // 18 ev i juli, 7 synliga
    { slug: 'KulturcentrumSandviken', name: 'Kulturcentrum Sandviken', city: 'Sandviken' }, // 18 ev i juli, 5 synliga
    { slug: 'hyltebiblioteken', name: 'Hyltebiblioteken' }, // 18 ev i juli, 8 synliga
    { slug: 'gavlebibliotek', name: 'Gävle bibliotek', city: 'Gävle' }, // 18 ev i juli, 8 synliga
    { slug: 'drammenkulturhus', name: 'Drammen kulturhus' }, // 18 ev i juli, 8 synliga
    { slug: 'cnemanorrkoping', name: 'Cnema', city: 'Norrköping' }, // 18 ev i juli, 8 synliga
    { slug: 'csnoje.se', name: 'CS Nöje', city: 'Stockholm' }, // 18 ev i juli, 8 synliga
    { slug: 'Tangokompaniet', name: 'Tangokompaniet' }, // 17 ev i juli, 8 synliga
    { slug: 'Smalands', name: 'Smålands Nation', city: 'Lund' }, // 17 ev i juli, 8 synliga
    { slug: 'kramforsbibliotek', name: 'Kramfors bibliotek' }, // 17 ev i juli, 6 synliga
    { slug: 'folkuniversitetetvisby', name: 'Folkuniversitetet Visby', city: 'Visby' }, // 17 ev i juli, 6 synliga
    { slug: 'eksjobibliotek', name: 'Eksjö stadsbibliotek' }, // 17 ev i juli, 7 synliga
    { slug: 'feverup', name: 'Fever' }, // 17 ev i juli, 8 synliga
    { slug: 'Bibliotekenilulea', name: 'Biblioteken i Luleå' }, // 17 ev i juli, 7 synliga
    { slug: 'allthingslivesweden', name: 'All Things Live Sweden', city: 'Stockholm' }, // 17 ev i juli, 5 synliga
    { slug: 'vrakdykarpensionatet', name: 'Vrakdykarpensionatet' }, // 16 ev i juli, 8 synliga
    { slug: 'medborgarskolanjamtland', name: 'Medborgarskolan' }, // 16 ev i juli, 8 synliga
    { slug: 'katalinsjazzbar', name: 'Katalins Bakficka', city: 'Uppsala' }, // 16 ev i juli, 8 synliga
    { slug: 'norrbottensteatern', name: 'Norrbottensteatern' }, // 16 ev i juli, 4 synliga
    { slug: 'HarrysStenungsund', name: 'Harrys' }, // 16 ev i juli, 6 synliga
    { slug: 'hudiksvalls.bibliotek', name: 'Biblioteken i Hudiksvalls kommun', city: 'Hudiksvall' }, // 16 ev i juli, 7 synliga
    { slug: 'bjorn.carlsson', name: 'Carlsson På Kajen', city: 'Västerås' }, // 16 ev i juli, 8 synliga
    { slug: 'bergenlive', name: 'Bergen Live' }, // 16 ev i juli, 8 synliga
    { slug: 'abf.stockholm', name: 'ABF Stockholm', city: 'Stockholm' }, // 16 ev i juli, 6 synliga
    { slug: 'medleymalmo', name: 'medley malmö' }, // 15 ev i juli, 8 synliga
    { slug: 'vasterasbibliotek', name: 'Västerås bibliotek', city: 'Västerås' }, // 15 ev i juli, 6 synliga
    { slug: 'varnamobibliotekochkultur', name: 'Värnamo bibliotek och kultur' }, // 15 ev i juli, 8 synliga
    { slug: 'Victoriateatern', name: 'Victoriateatern Malmö' }, // 15 ev i juli, 4 synliga
    { slug: 'sodertaljestadsscen', name: 'Södertälje stadsscen' }, // 15 ev i juli, 8 synliga
    { slug: 'situpcomedy', name: 'Sit-up comedy show' }, // 15 ev i juli, 4 synliga
    { slug: 'SalemsBibliotek', name: 'Salems bibliotek' }, // 15 ev i juli, 5 synliga
    { slug: 'rodakvarnkulturhus', name: 'Röda Kvarn Kultur' }, // 15 ev i juli, 8 synliga
    { slug: 'nationalmuseumswe', name: 'Nationalmuseum', city: 'Stockholm' }, // 15 ev i juli, 7 synliga
    { slug: 'malmodanceweek', name: 'Malmö Dance Week' }, // 15 ev i juli, 8 synliga
    { slug: 'latinamerikaifokus', name: 'Latinamerika i Fokus', city: 'Lund' }, // 15 ev i juli, 4 synliga
    { slug: 'NyaHouseofBlues', name: 'House of blues Borlänge- HOBB', city: 'Borlänge' }, // 15 ev i juli, 6 synliga
    { slug: 'hotelskansenoland', name: 'Hotel Skansen' }, // 15 ev i juli, 8 synliga
    { slug: 'gemenskapikungsor', name: 'Gemenskap i Kungsör' }, // 15 ev i juli, 8 synliga
    { slug: 'barumbibliotek', name: 'Bærum bibliotek' }, // 15 ev i juli, 7 synliga
    { slug: 'barnbiblioteken', name: 'Barnbiblioteken', city: 'Strängnäs' }, // 15 ev i juli, 5 synliga
    { slug: 'ulrikabeijeryoga', name: 'UB Yoga, Sång & Ceremoni', city: 'Hudiksvall' }, // 14 ev i juli, 6 synliga
    { slug: 'steamhotel', name: 'The Steam Hotel', city: 'Västerås' }, // 14 ev i juli, 6 synliga
    { slug: 'trivselhussverige', name: 'Trivselhus' }, // 14 ev i juli, 3 synliga
    { slug: 'Sundsvallsmuseum', name: 'Sundsvalls museum' }, // 14 ev i juli, 6 synliga
    { slug: 'porterpelle', name: 'Porter Pelle' }, // 14 ev i juli, 8 synliga
    { slug: 'oslonye', name: 'Oslo Nye Teater' }, // 14 ev i juli, 8 synliga
    { slug: 'SundsvallsStadsbibliotek', name: 'Sundsvalls Stadsbibliotek', city: 'Sundsvall' }, // 14 ev i juli, 8 synliga
    { slug: 'gasasteget', name: 'Lunds Dansklubb Gåsasteget', city: 'Lund' }, // 14 ev i juli, 8 synliga
    { slug: 'Hjaltevadshus', name: 'Hjältevadshus', city: 'Uppsala' }, // 14 ev i juli, 8 synliga
    { slug: 'NordiskaAkvarellmuseet', name: 'Nordiska Akvarellmuseet' }, // 14 ev i juli, 8 synliga
    { slug: 'Gummifabriken', name: 'Gummifabriken i Värnamo' }, // 14 ev i juli, 8 synliga
    { slug: 'enkopingskommunbibliotek', name: 'Enköpings kommunbibliotek', city: 'Enköping' }, // 14 ev i juli, 4 synliga
    { slug: 'iggesundsfolkan', name: 'Folkets Hus - Iggesund' }, // 14 ev i juli, 7 synliga
    { slug: 'dalarnasmuseum', name: 'Dalarnas museum', city: 'Falun' }, // 14 ev i juli, 4 synliga
    { slug: 'vnmuseum', name: 'Västernorrlands museum', city: 'Härnösand' }, // 13 ev i juli, 7 synliga
    { slug: 'tranemo.bibliotek', name: 'Tranemo bibliotek' }, // 13 ev i juli, 6 synliga
    { slug: 'tingsrydsbibliotekochkultur', name: 'Tingsryds bibliotek och kultur' }, // 13 ev i juli, 5 synliga
    { slug: 'Sormlandsmuseum', name: 'Sörmlands museum', city: 'Nyköping' }, // 13 ev i juli, 6 synliga
    { slug: 'stageway', name: 'Stageway' }, // 13 ev i juli, 8 synliga
    { slug: 'stageumea', name: 'Stage Umeå' }, // 13 ev i juli, 8 synliga
    { slug: 'malmostadsbibliotek', name: 'Stadsbiblioteket i Malmö' }, // 13 ev i juli, 8 synliga
    { slug: 'Regionteatern', name: 'Regionteatern Blekinge Kronoberg', city: 'Karlshamn' }, // 13 ev i juli, 7 synliga
    { slug: 'nygatan6', name: 'Nygatan 6' }, // 13 ev i juli, 6 synliga
    { slug: 'northeventAB', name: 'Northevent AB', city: 'Norrköping' }, // 13 ev i juli, 8 synliga
    { slug: 'kalmarnationlund', name: 'Kalmar Nation', city: 'Lund' }, // 13 ev i juli, 5 synliga
    { slug: 'hedvigeleonora', name: 'Hedvig Eleonora kyrka' }, // 13 ev i juli, 6 synliga
    { slug: 'MusikiChristinae', name: 'Musik i Christinae', city: 'Alingsås' }, // 13 ev i juli, 7 synliga
    { slug: 'BorasDansforening', name: 'Borås Dansförening', city: 'Borås' }, // 13 ev i juli, 3 synliga
    { slug: 'bioroy', name: 'Bio Roy' }, // 13 ev i juli, 8 synliga
    { slug: 'Vaxjodyksport', name: 'Växjödyksport', city: 'Växjö' }, // 12 ev i juli, 8 synliga
    { slug: 'tradgarn', name: 'Trädgår\'n' }, // 12 ev i juli, 8 synliga
    { slug: 'TheTivoli', name: 'The Tivoli', city: 'Helsingborg' }, // 12 ev i juli, 8 synliga
    { slug: 'taystase', name: 'Taysta', city: 'Västerås' }, // 12 ev i juli, 8 synliga
    { slug: 'rpsb50', name: 'TRENDERs', city: 'Alingsås' }, // 12 ev i juli, 8 synliga
    { slug: 'sv.vasternorrland', name: 'Studieförbundet Vuxenskolan Västernorrland', city: 'Sundsvall' }, // 12 ev i juli, 8 synliga
    { slug: 'sigtunastiftelsen', name: 'Sigtunastiftelsen' }, // 12 ev i juli, 5 synliga
    { slug: 'monument031', name: 'Monument 031' }, // 12 ev i juli, 8 synliga
    { slug: 'klostretiystad', name: 'Klostret i Ystad', city: 'Ystad' }, // 12 ev i juli, 6 synliga
    { slug: 'katalin.uppsala', name: 'Katalin And All That Jazz Östra Station' }, // 12 ev i juli, 8 synliga
    { slug: 'inrenatur', name: 'Inre natur' }, // 12 ev i juli, 6 synliga
    { slug: 'bibliotekenitierp', name: 'Biblioteken i Tierps kommun' }, // 12 ev i juli, 8 synliga
    { slug: 'bibliotekljusdal', name: 'Biblioteken i Ljusdals kommun' }, // 12 ev i juli, 5 synliga
    { slug: 'BibliotekeniKalmarkommun', name: 'Biblioteken i Kalmar kommun', city: 'Kalmar' }, // 12 ev i juli, 8 synliga
    { slug: 'vastergotlandsmuseum', name: 'Västergötlands museum' }, // 11 ev i juli, 5 synliga
    { slug: 'throwbackeventsldn', name: 'Throwback Events' }, // 11 ev i juli, 8 synliga
    { slug: 'TheBruceSpringsteenTribute', name: 'The Bruce Springsteen Tribute - Best of the Boss', city: 'Trollhättan' }, // 11 ev i juli, 8 synliga
    { slug: 'seniortraffen', name: 'Seniorträffen, Oxelösund' }, // 11 ev i juli, 6 synliga
    { slug: 'junisalvsborgdistrikt', name: 'Movendi Älvsborg', city: 'Borås' }, // 11 ev i juli, 8 synliga
    { slug: 'Landskronabibliotek', name: 'Landskrona bibliotek', city: 'Landskrona' }, // 11 ev i juli, 8 synliga
    { slug: 'Midsommargarden', name: 'Midsommargården' }, // 11 ev i juli, 8 synliga
    { slug: 'gavlekonserthus', name: 'Gävle Konserthus', city: 'Gävle' }, // 11 ev i juli, 8 synliga
    { slug: 'Falkopingsbibliotek', name: 'Falköpings bibliotek' }, // 11 ev i juli, 5 synliga
    { slug: 'Eskilstunastadsbibliotek', name: 'Eskilstuna stadsbibliotek', city: 'Eskilstuna' }, // 11 ev i juli, 8 synliga
    { slug: 'atalantegbg', name: 'Atalante' }, // 11 ev i juli, 3 synliga
    { slug: 'Alergotura', name: 'Alergotura', city: 'Nora' }, // 11 ev i juli, 6 synliga
    { slug: 'vaxjokommun', name: 'Växjö kommun' }, // 10 ev i juli, 5 synliga
    { slug: 'vastmanlandsteater', name: 'Västmanlands Teater', city: 'Västerås' }, // 10 ev i juli, 6 synliga
    { slug: 'litensmula', name: 'Vita Huset - En Liten Smula', city: 'Norrtälje' }, // 10 ev i juli, 8 synliga
    { slug: 'vilhelmina.folketshus.7', name: 'Vilhelmina Folkets Hus' }, // 10 ev i juli, 4 synliga
    { slug: 'vadstenabibliotek', name: 'Vadstena bibliotek' }, // 10 ev i juli, 5 synliga
    { slug: 'SVGoteborg', name: 'Studieförbundet Vuxenskolan Göteborg', city: 'Göteborg' }, // 10 ev i juli, 8 synliga
    { slug: 'planthousehuntersville', name: 'PlantHouse' }, // 10 ev i juli, 8 synliga
    { slug: 'monovaxjo', name: 'Mono Växjö' }, // 10 ev i juli, 8 synliga
    { slug: 'mejeriet', name: 'Mejeriet', city: 'Lund' }, // 10 ev i juli, 7 synliga
    { slug: 'LBSDK', name: 'Luleå Bugg och Swing Dansklubb' }, // 10 ev i juli, 6 synliga
    { slug: 'lindblomacademy', name: 'Lindblom Academy Inner Spirit Light', city: 'Västerås' }, // 10 ev i juli, 8 synliga
    { slug: 'lagerhusetsbibliotek', name: 'Lagerhusets Bibliotek' }, // 10 ev i juli, 7 synliga
    { slug: 'krallentertainment', name: 'Krall Entertainment', city: 'Helsingborg' }, // 10 ev i juli, 8 synliga
    { slug: 'kollektivkrogen', name: 'Kollektivkrogen' }, // 10 ev i juli, 8 synliga
    { slug: 'jadanskurs', name: 'JAdans' }, // 10 ev i juli, 6 synliga
    { slug: 'gretasgothenburg', name: 'Gretas Göteborg', city: 'Göteborg' }, // 10 ev i juli, 8 synliga
    { slug: 'ideadrottninghog', name: 'Idé A Drottninghög', city: 'Helsingborg' }, // 10 ev i juli, 8 synliga
    { slug: 'ebba.dansklubb', name: 'EBBA Dansklubb' }, // 10 ev i juli, 5 synliga
    { slug: 'bjuvsbibliotek', name: 'Bjuvs bibliotek' }, // 10 ev i juli, 8 synliga
    { slug: 'babblarnalive', name: 'Babblarna på scen', city: 'Jönköping' }, // 10 ev i juli, 4 synliga
    { slug: 'DanshusetDkBuggie', name: 'Dansklubben Buggie i Ulricehamn' }, // 10 ev i juli, 5 synliga
    { slug: 'ABFsorm', name: 'ABF Sörmland', city: 'Eskilstuna' }, // 10 ev i juli, 8 synliga
    { slug: 'VaerkstederiAbsalon', name: 'Værksteder i Absalon' }, // 9 ev i juli, 8 synliga
    { slug: 'karlecafe', name: 'karl-e' }, // 9 ev i juli, 8 synliga
    { slug: 'yogaskolan.karlstad', name: 'Yogaskolan Karlstad', city: 'Karlstad' }, // 9 ev i juli, 4 synliga
    { slug: 'vadhanderistockholm', name: 'Vad händer i Stockholm', city: 'Stockholm' }, // 9 ev i juli, 3 synliga
    { slug: 'ostergotlandsbokmassa', name: 'TellUs bok- och berättarmässa i Linköping', city: 'Linköping' }, // 9 ev i juli, 8 synliga
    { slug: 'tornqvisteventandmusic', name: 'Törnqvist Event & Music', city: 'Linköping' }, // 9 ev i juli, 8 synliga
    { slug: 'regionmuseetskane', name: 'Regionmuseet Skåne', city: 'Kristianstad' }, // 9 ev i juli, 5 synliga
    { slug: 'puskasmusikk', name: 'Puskas Musikk & Platebar' }, // 9 ev i juli, 6 synliga
    { slug: 'NalenStockholm', name: 'Nalen', city: 'Stockholm' }, // 9 ev i juli, 7 synliga
    { slug: 'malmolive', name: 'Malmö Live' }, // 9 ev i juli, 4 synliga
    { slug: 'magasinetfalun', name: 'Magasinet Falun', city: 'Falun' }, // 9 ev i juli, 8 synliga
    { slug: 'kulturhusetkaken', name: 'Kulturhuset Kåken' }, // 9 ev i juli, 8 synliga
    { slug: 'Kafebredsjon', name: 'Kafe Bredsjön' }, // 9 ev i juli, 5 synliga
    { slug: 'fhsater', name: 'Folkets Hus Säter' }, // 9 ev i juli, 8 synliga
    { slug: 'Familjecentralen.Ulricehamn', name: 'Familjecentralen, Öppna förskolan i Ulricehamn' }, // 9 ev i juli, 5 synliga
    { slug: 'attentionmolndal', name: 'Attention Mölndal' }, // 9 ev i juli, 7 synliga
    { slug: 'ostersundsbibliotek', name: 'Östersunds Bibliotek' }, // 8 ev i juli, 8 synliga
    { slug: 'almhultsbibliotek', name: 'Älmhults bibliotek' }, // 8 ev i juli, 6 synliga
    { slug: 'varldskulturmuseet', name: 'Världskulturmuseet' }, // 8 ev i juli, 8 synliga
    { slug: 'tibrobibliotek', name: 'Tibro bibliotek' }, // 8 ev i juli, 5 synliga
    { slug: 'svkalmarlan', name: 'Studieförbundet Vuxenskolan Kalmar län', city: 'Nybro' }, // 8 ev i juli, 7 synliga
    { slug: 'biblioteketsimrishamn', name: 'Simrishamns bibliotek', city: 'Simrishamn' }, // 8 ev i juli, 8 synliga
    { slug: 'reisdegkomikerklubb', name: 'Reis Deg Komikerklubb' }, // 8 ev i juli, 4 synliga
    { slug: 'oxiebiblioteket', name: 'Oxiebiblioteket' }, // 8 ev i juli, 5 synliga
    { slug: 'movehomesverige', name: 'Movehome' }, // 8 ev i juli, 4 synliga
    { slug: 'lassewinnerback', name: 'Lars Winnerbäck', city: 'Linköping' }, // 8 ev i juli, 8 synliga
    { slug: 'HotelEggers', name: 'Hôtel Eggers' }, // 8 ev i juli, 5 synliga
    { slug: 'GothenburgSymphonyOrchestra', name: 'Göteborgs Symfoniker' }, // 8 ev i juli, 4 synliga
    { slug: 'gavlesymfoniorkester', name: 'Gävle Symfoniorkester', city: 'Gävle' }, // 8 ev i juli, 2 synliga
    { slug: 'gallivarekommunsfolkbibliotek', name: 'Gällivare kommuns folkbibliotek', city: 'Gällivare' }, // 8 ev i juli, 3 synliga
    { slug: 'falkenbergsstadsteater', name: 'Falkenbergs Stadsteater', city: 'Falkenberg' }, // 8 ev i juli, 8 synliga
    { slug: 'drakenlive', name: 'Draken Live' }, // 8 ev i juli, 6 synliga
    { slug: 'ckwano1', name: 'CK Wano', city: 'Varberg' }, // 8 ev i juli, 8 synliga
    { slug: 'BrassUnit', name: 'BrassUnit', city: 'Stockholm' }, // 8 ev i juli, 5 synliga
    { slug: 'bibliotekenihalmstad', name: 'Biblioteken i Halmstad', city: 'Halmstad' }, // 8 ev i juli, 8 synliga
    { slug: 'ystadsbibliotek', name: 'Ystads bibliotek', city: 'Ystad' }, // 7 ev i juli, 8 synliga
    { slug: 'visituddevalla', name: 'Visit Uddevalla', city: 'Uddevalla' }, // 7 ev i juli, 4 synliga
    { slug: 'VintervikensTradgard', name: 'Vintervikens Trädgård', city: 'Stockholm' }, // 7 ev i juli, 8 synliga
    { slug: 'UpplevSkovde', name: 'Upplev Skövde', city: 'Skövde' }, // 7 ev i juli, 4 synliga
    { slug: 'Storlihytta', name: 'Storlihytta' }, // 7 ev i juli, 8 synliga
    { slug: 'Showtic', name: 'Showtic', city: 'Jönköping' }, // 7 ev i juli, 6 synliga
    { slug: 'SalemStavanger', name: 'Salem Stavanger' }, // 7 ev i juli, 3 synliga
    { slug: 'OdeumLundsUniversitet', name: 'Odeum', city: 'Lund' }, // 7 ev i juli, 8 synliga
    { slug: 'molndalsdansskola', name: 'Mölndals Dansskola' }, // 7 ev i juli, 8 synliga
    { slug: 'medeltidsmuseet', name: 'Medeltidsmuseet', city: 'Stockholm' }, // 7 ev i juli, 7 synliga
    { slug: 'musikochteatervanner', name: 'Musik & Teatervänner' }, // 7 ev i juli, 8 synliga
    { slug: 'MahalayaCenter', name: 'Mahalaya - Center for Holistic Growth' }, // 7 ev i juli, 5 synliga
    { slug: 'lorenskoghus', name: 'Lørenskog hus' }, // 7 ev i juli, 7 synliga
    { slug: 'linkopingairswing', name: 'Linköping Air Swing', city: 'Linköping' }, // 7 ev i juli, 8 synliga
    { slug: 'kulturhusetfregatten', name: 'Kulturhuset Fregatten' }, // 7 ev i juli, 4 synliga
    { slug: 'konstmuseet', name: 'Konstmuseet', city: 'Skövde' }, // 7 ev i juli, 4 synliga
    { slug: 'konstepidemin', name: 'Konstepidemin' }, // 7 ev i juli, 5 synliga
    { slug: 'JiAdagarna', name: 'JiA-Dagarna | Juridiska Föreningens arbetsmarknadsdagar | www.jf.se/jia', city: 'Lund' }, // 7 ev i juli, 8 synliga
    { slug: 'halmstadsteater', name: 'Halmstads Teater' }, // 7 ev i juli, 7 synliga
    { slug: 'Glimmingehus', name: 'Glimmingehus' }, // 7 ev i juli, 5 synliga
    { slug: 'freemoveyogastudio.nu', name: 'Freemove Yogastudio' }, // 7 ev i juli, 5 synliga
    { slug: 'folketshusborlange', name: 'Folkets Hus Borlänge', city: 'Borlänge' }, // 7 ev i juli, 8 synliga
    { slug: 'centrumhusbiografen', name: 'Centrumhusbiografen' }, // 7 ev i juli, 6 synliga
    { slug: 'musikenshusgbg', name: 'Café Hängmattan' }, // 7 ev i juli, 8 synliga
    { slug: 'allthingslivenorway', name: 'All Things Live Norway' }, // 7 ev i juli, 8 synliga
    { slug: 'WoodyWestGbg', name: 'Woody West' }, // 6 ev i juli, 8 synliga
    { slug: 'orebro.salsafriends.9', name: 'Örebro Salsafriends' }, // 6 ev i juli, 3 synliga
    { slug: 'vedeldspizzan', name: 'Vedeldspizzan', city: 'Göteborg' }, // 6 ev i juli, 2 synliga
    { slug: 'umeafilmfestival', name: 'Umeå Filmfestival' }, // 6 ev i juli, 8 synliga
    { slug: 'tangojamt', name: 'TangoJamt' }, // 6 ev i juli, 4 synliga
    { slug: 'lena.lingensjo', name: 'Söndsvalls damer �' }, // 6 ev i juli, 5 synliga
    { slug: 'studieframjandetumea', name: 'Studiefrämjandet Västerbotten' }, // 6 ev i juli, 8 synliga
    { slug: 'seniorikungsbacka', name: 'Senior i Kungsbacka', city: 'Kungsbacka' }, // 6 ev i juli, 4 synliga
    { slug: 'SensusRCN', name: 'Rättighetscentrum Norrbotten - mot diskriminering' }, // 6 ev i juli, 6 synliga
    { slug: 'pustervik', name: 'Pustervik' }, // 6 ev i juli, 8 synliga
    { slug: 'palladiummalmo1', name: 'Palladium' }, // 6 ev i juli, 8 synliga
    { slug: 'kavlingeoldtimespub', name: 'Old Times Pub' }, // 6 ev i juli, 6 synliga
    { slug: 'NaturumVattenriket', name: 'Naturum Vattenriket' }, // 6 ev i juli, 3 synliga
    { slug: 'moriskapaviljongen', name: 'Moriska Paviljongen' }, // 6 ev i juli, 8 synliga
    { slug: 'musikidalarna', name: 'Musik i Dalarna', city: 'Falun' }, // 6 ev i juli, 4 synliga
    { slug: 'kulturcentrumebeneser', name: 'Kulturcentrum Ebeneser' }, // 6 ev i juli, 8 synliga
    { slug: 'kristianstadsfilmstudio', name: 'Kristianstads Filmstudio', city: 'Kristianstad' }, // 6 ev i juli, 6 synliga
    { slug: 'goteborgsstad', name: 'Göteborgs Stad', city: 'Göteborg' }, // 6 ev i juli, 5 synliga
    { slug: 'globallivingvasteras', name: 'Global Living', city: 'Västerås' }, // 6 ev i juli, 7 synliga
    { slug: 'fhuddevalla', name: 'Folkets Hus Uddevalla', city: 'Uddevalla' }, // 6 ev i juli, 5 synliga
    { slug: 'boulognerskogenparkrun', name: 'Boulognerskogen parkrun, Gävle', city: 'Gävle' }, // 6 ev i juli, 6 synliga
    { slug: 'arbogabio', name: 'Arboga bio' }, // 6 ev i juli, 1 synliga
    { slug: '59anLysekil', name: '59an i Lysekil' }, // 6 ev i juli, 3 synliga
    { slug: 'ostfoldteater', name: 'Østfold Teater' }, // 5 ev i juli, 5 synliga
    { slug: 'ostergotlandsmuseum', name: 'Östergötlands museum' }, // 5 ev i juli, 7 synliga
    { slug: 'Levochmaval', name: 'ViveVale', city: 'Lund' }, // 5 ev i juli, 2 synliga
    { slug: 'vewcs', name: 'Victor Evelina West Coast Swing', city: 'Uppsala' }, // 5 ev i juli, 5 synliga
    { slug: 'villalidkopingbk', name: 'Villa Lidköping BK', city: 'Lidköping' }, // 5 ev i juli, 1 synliga
    { slug: 'vardagibalans', name: 'Vardag i Balans', city: 'Lund' }, // 5 ev i juli, 2 synliga
    { slug: 'UppsalaBudoklubb', name: 'Uppsala Budoklubb', city: 'Uppsala' }, // 5 ev i juli, 6 synliga
    { slug: 'Upplandsmuseet', name: 'Upplandsmuseet', city: 'Uppsala' }, // 5 ev i juli, 6 synliga
    { slug: 'umefox', name: 'UmeFox' }, // 5 ev i juli, 4 synliga
    { slug: 'ungscenost', name: 'Ung Scen Öst', city: 'Norrköping' }, // 5 ev i juli, 2 synliga
    { slug: 'teatervasternorrland', name: 'Teater Västernorrland' }, // 5 ev i juli, 2 synliga
    { slug: 'stockholmsmarknader', name: 'Stockholmsmarknader' }, // 5 ev i juli, 5 synliga
    { slug: 'sundsvallskommun', name: 'Sundsvalls kommun', city: 'Sundsvall' }, // 5 ev i juli, 8 synliga
    { slug: 'reumatikerforeningenlinkoping', name: 'Reumatikerföreningen Linköping', city: 'Linköping' }, // 5 ev i juli, 3 synliga
    { slug: 'Reimersholmehotel', name: 'Reimersholme Hotel', city: 'Stockholm' }, // 5 ev i juli, 8 synliga
    { slug: 'obosisverige', name: 'OBOS i Sverige', city: 'Lund' }, // 5 ev i juli, 3 synliga
    { slug: 'musikvalvetbaggen', name: 'Musikvalvet Baggen' }, // 5 ev i juli, 5 synliga
    { slug: 'NiklasStromstedtMusic', name: 'Niklas Strömstedt', city: 'Uppsala' }, // 5 ev i juli, 7 synliga
    { slug: 'nordicsociety.org', name: 'Nordic society', city: 'Stockholm' }, // 5 ev i juli, 3 synliga
    { slug: 'naturumblekinge', name: 'Naturum Blekinge', city: 'Ronneby' }, // 5 ev i juli, 3 synliga
    { slug: 'MotalaBasket', name: 'Motala Basket - W72', city: 'Motala' }, // 5 ev i juli, 2 synliga
    { slug: 'malmosaluhall', name: 'Malmö Saluhall' }, // 5 ev i juli, 2 synliga
    { slug: 'mikespubskovde', name: 'Mikes pub och restaurang', city: 'Skövde' }, // 5 ev i juli, 1 synliga
    { slug: 'MariaLundqvistOffentlig', name: 'Maria Lundqvist', city: 'Eskilstuna' }, // 5 ev i juli, 1 synliga
    { slug: 'malmabuggarna', name: 'Malmabuggarna' }, // 5 ev i juli, 2 synliga
    { slug: 'Kulturhjaltarna', name: 'Kulturhjältarna' }, // 5 ev i juli, 8 synliga
    { slug: 'MAKSIMconcertPianist', name: 'Kultur For Folket' }, // 5 ev i juli, 8 synliga
    { slug: 'Kapellet.telje', name: 'Kapellet', city: 'Norrtälje' }, // 5 ev i juli, 8 synliga
    { slug: 'KLUBBDODSWE', name: 'KLUBB DÖD' }, // 5 ev i juli, 8 synliga
    { slug: 'jagvagarstuffa', name: 'Jag vågar stuffa', city: 'Karlshamn' }, // 5 ev i juli, 6 synliga
    { slug: 'JacyzHotel', name: 'Jacy\'z Hotel & Resort' }, // 5 ev i juli, 6 synliga
    { slug: 'hjartatshus', name: 'Hjärtats hus', city: 'Jönköping' }, // 5 ev i juli, 5 synliga
    { slug: 'gronakallanalvkarleby', name: 'Gröna Källan - Älvkarleby' }, // 5 ev i juli, 4 synliga
    { slug: 'energiheaxorna', name: 'Energihäxorna' }, // 5 ev i juli, 4 synliga
    { slug: 'DDRKgbg', name: 'DDRKgbg' }, // 5 ev i juli, 4 synliga
    { slug: 'WheelsOfCarlshamn', name: 'Cykelklubben Wheels Of Carlshamn', city: 'Karlshamn' }, // 5 ev i juli, 8 synliga
    { slug: 'dansofolkton', name: 'Dans & Folkton' }, // 5 ev i juli, 3 synliga
    { slug: 'catscornermalmo', name: 'Cats\' Corner' }, // 5 ev i juli, 3 synliga
    { slug: 'backyardfalun', name: 'Backyard Club', city: 'Falun' }, // 5 ev i juli, 4 synliga
    { slug: 'ArbogaFolketsPark', name: 'Arboga Folkets Park' }, // 5 ev i juli, 8 synliga
    { slug: 'backa.teater', name: 'Backa Teater' }, // 5 ev i juli, 2 synliga
    { slug: 'abfnorrkalix', name: 'ABF Norr Kalix' }, // 5 ev i juli, 5 synliga
    { slug: 'alltpascen', name: 'Allt På Scen & Mycke Nöje', city: 'Lund' }, // 5 ev i juli, 8 synliga
    { slug: 'WermlandOpera', name: 'Wermland Opera', city: 'Karlstad' }, // 4 ev i juli, 2 synliga
    { slug: 'vaxjoloparklubb', name: 'Växjö Löparklubb' }, // 4 ev i juli, 4 synliga
    { slug: 'svinorrabohuslan', name: 'Studieförbundet Vuxenskolan i Norra Bohuslän' }, // 4 ev i juli, 3 synliga
    { slug: 'Studieforbundetbildanord', name: 'Studieförbundet Bilda Nord' }, // 4 ev i juli, 8 synliga
    { slug: 'stuckonlive', name: 'Stuck On - Live' }, // 4 ev i juli, 8 synliga
    { slug: 'stadshallen', name: 'Stadshallen', city: 'Lund' }, // 4 ev i juli, 7 synliga
    { slug: 'royal.roland.5623', name: 'SoundTrack Roland' }, // 4 ev i juli, 2 synliga
    { slug: 'SoulRelax.Motala', name: 'SoulRelax', city: 'Motala' }, // 4 ev i juli, 3 synliga
    { slug: 'quiztyreso', name: 'QUIZ - Tyresö' }, // 4 ev i juli, 1 synliga
    { slug: 'slagelsebib', name: 'Slagelse Bibliotekerne' }, // 4 ev i juli, 8 synliga
    { slug: 'rabagastalta', name: 'Rabagast' }, // 4 ev i juli, 8 synliga
    { slug: 'poffertjes.se', name: 'Poffertjes.se' }, // 4 ev i juli, 8 synliga
    { slug: 'NojetKonsert', name: 'Nöjet Konsert AB', city: 'Sundsvall' }, // 4 ev i juli, 8 synliga
    { slug: 'nojesfabriken', name: 'Nöjesfabriken', city: 'Karlstad' }, // 4 ev i juli, 8 synliga
    { slug: 'nbvost', name: 'NBV Öst' }, // 4 ev i juli, 4 synliga
    { slug: 'monica.karlsson.399', name: 'Motala biologiska förening', city: 'Motala' }, // 4 ev i juli, 3 synliga
    { slug: 'mats.fuchs.9', name: 'Mats Fuchs' }, // 4 ev i juli, 1 synliga
    { slug: 'lorenskogbibliotek', name: 'Lørenskog bibliotek' }, // 4 ev i juli, 8 synliga
    { slug: 'lyckselemusikoteater', name: 'Lycksele Musik & Teaterförening-en del av Riksteatern', city: 'Lycksele' }, // 4 ev i juli, 2 synliga
    { slug: 'lundchoralfestival.lcf', name: 'Lund Choral Festival', city: 'Lund' }, // 4 ev i juli, 8 synliga
    { slug: 'kulturhusetbollnas', name: 'Kulturhuset Bollnäs' }, // 4 ev i juli, 8 synliga
    { slug: 'visitsoderhamn', name: 'Kulturen Söderhamn', city: 'Söderhamn' }, // 4 ev i juli, 1 synliga
    { slug: 'kpdmellerud', name: 'Kulturbruket på Dal' }, // 4 ev i juli, 5 synliga
    { slug: 'KappaBarMalmo', name: 'Kappa Bar Malmö' }, // 4 ev i juli, 4 synliga
    { slug: 'kalixkommun', name: 'Kalix kommun' }, // 4 ev i juli, 7 synliga
    { slug: 'kbwestgbg', name: 'KB West' }, // 4 ev i juli, 8 synliga
    { slug: 'kalix.bibliotek', name: 'Kalix Bibliotek' }, // 4 ev i juli, 2 synliga
    { slug: 'michael.haggmark.1', name: 'JLS Jämtlands Lokalhistoriker och Släktforskare' }, // 4 ev i juli, 1 synliga
    { slug: 'jazzklubbensundsvall.se', name: 'Jazzklubben Sundsvall', city: 'Sundsvall' }, // 4 ev i juli, 5 synliga
    { slug: 'trumhakan', name: 'Jansson Communication' }, // 4 ev i juli, 6 synliga
    { slug: 'IntimanTeatern', name: 'Intiman', city: 'Stockholm' }, // 4 ev i juli, 2 synliga
    { slug: 'icfalkenberg', name: 'IC Falkenberg', city: 'Falkenberg' }, // 4 ev i juli, 8 synliga
    { slug: 'hovmantorps.folketshus', name: 'Hovmantorps Folkets Hus' }, // 4 ev i juli, 4 synliga
    { slug: 'huddingeparkrun', name: 'Huddinge Parkrun' }, // 4 ev i juli, 8 synliga
    { slug: 'HotellHavanna', name: 'Hotell Havanna', city: 'Varberg' }, // 4 ev i juli, 2 synliga
    { slug: 'SwinginHepTown', name: 'HepTown' }, // 4 ev i juli, 8 synliga
    { slug: 'gnosjobibliotek', name: 'Gnosjö kultur & bibliotek' }, // 4 ev i juli, 2 synliga
    { slug: 'eyragarden', name: 'Eyragården, Kävlinge Kommun' }, // 4 ev i juli, 4 synliga
    { slug: 'BorlangeDance', name: 'Borlänge Dance', city: 'Borlänge' }, // 4 ev i juli, 5 synliga
    { slug: 'bokmassandalarna', name: 'Bokmässan Dalarna', city: 'Borlänge' }, // 4 ev i juli, 8 synliga
    { slug: 'BestermanAB', name: 'Besterman', city: 'Uppsala' }, // 4 ev i juli, 8 synliga
    { slug: 'befreenow.se', name: 'Befreenow' }, // 4 ev i juli, 6 synliga
    { slug: 'bergsakers', name: 'Bergsåker', city: 'Sundsvall' }, // 4 ev i juli, 2 synliga
    { slug: 'alingsaskulturhus', name: 'Alingsås kulturhus', city: 'Alingsås' }, // 4 ev i juli, 4 synliga
    { slug: 'mountainfilm', name: 'Banff Mountain Film Festival Scandinavia' }, // 4 ev i juli, 2 synliga
    { slug: 'AlingsasHK', name: 'Alingsås HK', city: 'Alingsås' }, // 4 ev i juli, 2 synliga
    { slug: 'ostgotamusiken', name: 'Östgötamusiken', city: 'Linköping' }, // 3 ev i juli, 7 synliga
    { slug: 'ostersundskommun', name: 'Östersunds kommun - Staaren tjïelte' }, // 3 ev i juli, 3 synliga
    { slug: 'VXOevent', name: 'VXO event' }, // 3 ev i juli, 4 synliga
    { slug: 'teaterhalland', name: 'Teater Halland', city: 'Varberg' }, // 3 ev i juli, 3 synliga
    { slug: 'tangosundsvall', name: 'TangoSundsvall', city: 'Sundsvall' }, // 3 ev i juli, 2 synliga
    { slug: 'tangovarberg', name: 'Tango Varberg', city: 'Varberg' }, // 3 ev i juli, 3 synliga
    { slug: 'soderhamnsbibblan', name: 'Söderhamns Stadsbibliotek', city: 'Söderhamn' }, // 3 ev i juli, 3 synliga
    { slug: 'SoderhamnsKonstforening', name: 'Söderhamns Konstförening', city: 'Söderhamn' }, // 3 ev i juli, 1 synliga
    { slug: 'StoraTeatern', name: 'Stora Teatern' }, // 3 ev i juli, 4 synliga
    { slug: 'stabekkjazzclub', name: 'Stabekk Jazz Club' }, // 3 ev i juli, 3 synliga
    { slug: 'skovdeyogacentrum', name: 'Skövde YogaCentrum', city: 'Skövde' }, // 3 ev i juli, 2 synliga
    { slug: 'sisselkyrkjebo', name: 'Sissel Kyrkjebø', city: 'Stockholm' }, // 3 ev i juli, 8 synliga
    { slug: 'rimboprastgard', name: 'Rimbo Prästgård' }, // 3 ev i juli, 8 synliga
    { slug: 'pinkprogramming', name: 'Pink Programming', city: 'Lund' }, // 3 ev i juli, 2 synliga
    { slug: 'Parkbiografen', name: 'Parkbiografen' }, // 3 ev i juli, 1 synliga
    { slug: 'Mordmysterium', name: 'Mordmysterium' }, // 3 ev i juli, 2 synliga
    { slug: 'mollan.mitt', name: 'Mitt Möllan' }, // 3 ev i juli, 3 synliga
    { slug: 'statarmuseet', name: 'Malmö Stad' }, // 3 ev i juli, 2 synliga
    { slug: 'louisdegeernorrkoping', name: 'Louis De Geer, Norrköping', city: 'Norrköping' }, // 3 ev i juli, 8 synliga
    { slug: 'lommafolketshus', name: 'Lomma Folkets Hus' }, // 3 ev i juli, 4 synliga
    { slug: 'lisebergab', name: 'Liseberg' }, // 3 ev i juli, 2 synliga
    { slug: 'lesbisktrumuppsala', name: 'Lesbiskt rum Uppsala', city: 'Uppsala' }, // 3 ev i juli, 4 synliga
    { slug: 'Kungalvsparken', name: 'Kungälvs Parken', city: 'Borås' }, // 3 ev i juli, 4 synliga
    { slug: 'kristnaregnbagsrorelsen', name: 'Kristna regnbågsrörelsen - Riksförbundet EKHO' }, // 3 ev i juli, 2 synliga
    { slug: 'jonkopingcity', name: 'Jönköping City', city: 'Jönköping' }, // 3 ev i juli, 3 synliga
    { slug: 'hemfranderome', name: 'Hem från Derome' }, // 3 ev i juli, 8 synliga
    { slug: 'hiphopweekendkalmar', name: 'Hip Hop Weekend' }, // 3 ev i juli, 8 synliga
    { slug: 'hedemorafolketspark', name: 'Hedemora Folkets Park' }, // 3 ev i juli, 8 synliga
    { slug: 'Gardenoffeathers', name: 'Garden of Feathers', city: 'Staffanstorp' }, // 3 ev i juli, 8 synliga
    { slug: 'forfattarcentrumvast', name: 'Författarcentrum Väst' }, // 3 ev i juli, 4 synliga
    { slug: 'FylgjaHelandeHarmoni', name: 'Fylgja - helande harmoni', city: 'Sundsvall' }, // 3 ev i juli, 7 synliga
    { slug: 'Folkuniversitetet.Goteborg', name: 'Folkuniversitetet Göteborg', city: 'Göteborg' }, // 3 ev i juli, 5 synliga
    { slug: 'forumbiblioteken', name: 'Forumbiblioteken i Nacka' }, // 3 ev i juli, 2 synliga
    { slug: 'FyrisComedy', name: 'FYRIS Comedy' }, // 3 ev i juli, 3 synliga
    { slug: 'dragonflystudioavesta', name: 'Dragonfly Studio' }, // 3 ev i juli, 2 synliga
    { slug: 'Clubsoundkilla', name: 'Club Soundkilla' }, // 3 ev i juli, 2 synliga
    { slug: 'couleurkonsthandel', name: 'Couleur Konsthandel', city: 'Stockholm' }, // 3 ev i juli, 2 synliga
    { slug: 'bolgenkulturhus', name: 'Bølgen Kulturhus' }, // 3 ev i juli, 5 synliga
    { slug: 'clarionsundsvall', name: 'Clarion Hotel Sundsvall', city: 'Sundsvall' }, // 3 ev i juli, 2 synliga
    { slug: 'MuseetBollnasKonsthall', name: 'Bollnäs Museum & Konsthall' }, // 3 ev i juli, 1 synliga
    { slug: 'BlaKaktus', name: 'Bluesföreningen Blå Kaktus' }, // 3 ev i juli, 7 synliga
    { slug: 'arbetetsmuseum', name: 'Arbetets museum', city: 'Norrköping' }, // 3 ev i juli, 3 synliga
    { slug: 'amplifiedvast', name: 'Amplified Väst', city: 'Borås' }, // 3 ev i juli, 4 synliga
    { slug: 'folkanteater', name: 'Örnsköldsviks Riksteaterförening' }, // 2 ev i juli, 8 synliga
    { slug: 'ObackaJazz', name: 'Öbacka Jazz&Blues Härnösand', city: 'Härnösand' }, // 2 ev i juli, 3 synliga
    { slug: 'vasteraskongress', name: 'Västerås Kongress', city: 'Västerås' }, // 2 ev i juli, 8 synliga
    { slug: 'VisitOstersund', name: 'VisitÖstersund', city: 'Östersund' }, // 2 ev i juli, 8 synliga
    { slug: 'hamarvenues', name: 'Venues' }, // 2 ev i juli, 8 synliga
    { slug: 'varakonserthus', name: 'Vara Konserthus' }, // 2 ev i juli, 8 synliga
    { slug: 'Uddevallakassetten', name: 'Uddevallakassetten', city: 'Uddevalla' }, // 2 ev i juli, 7 synliga
    { slug: 'tunapark.se', name: 'Tuna Park', city: 'Eskilstuna' }, // 2 ev i juli, 2 synliga
    { slug: 'tillsammansforkumla', name: 'Tillsammans för Kumla' }, // 2 ev i juli, 8 synliga
    { slug: 'stockholmjazz', name: 'Stockholm Jazz Festival', city: 'Stockholm' }, // 2 ev i juli, 8 synliga
    { slug: 'stenegardjarvso', name: 'Stenegård i Järvsö' }, // 2 ev i juli, 2 synliga
    { slug: 'stasartistas', name: 'Stas Artist' }, // 2 ev i juli, 3 synliga
    { slug: 'rfsisuvn', name: 'Stadshuset Kronan, Örnskökdsvik' }, // 2 ev i juli, 3 synliga
    { slug: 'spirisvisma', name: 'Spiris Visma', city: 'Stockholm' }, // 2 ev i juli, 2 synliga
    { slug: 'skeppetgbg', name: 'Skeppet GBG' }, // 2 ev i juli, 8 synliga
    { slug: 'silvenska', name: 'Silvénska villan' }, // 2 ev i juli, 2 synliga
    { slug: 'scenknuten', name: 'Scenknuten', city: 'Eskilstuna' }, // 2 ev i juli, 2 synliga
    { slug: 'stfostraskane', name: 'STF Östra Skåne Lokalavdelning' }, // 2 ev i juli, 3 synliga
    { slug: 'sagateaterboras', name: 'Sagateatern', city: 'Borås' }, // 2 ev i juli, 8 synliga
    { slug: 'StahlEntertainment', name: 'STAHL Entertainment' }, // 2 ev i juli, 8 synliga
    { slug: 'skrotmusik', name: 'SKROT', city: 'Ystad' }, // 2 ev i juli, 1 synliga
    { slug: 'signalsignal.org', name: 'SIGNAL' }, // 2 ev i juli, 2 synliga
    { slug: 'selammusic', name: 'SELAM', city: 'Stockholm' }, // 2 ev i juli, 2 synliga
    { slug: 'sstudentermalmo', name: 'S-Studenter Malmö' }, // 2 ev i juli, 8 synliga
    { slug: 'Riksteaternvaxjo', name: 'Riksteatern Växjö' }, // 2 ev i juli, 3 synliga
    { slug: 'regionkronoberg', name: 'Region Kronoberg' }, // 2 ev i juli, 2 synliga
    { slug: 'programivaven', name: 'Program i Väven' }, // 2 ev i juli, 8 synliga
    { slug: 'tantensgronaskafferi', name: 'Piprot' }, // 2 ev i juli, 2 synliga
    { slug: 'PitebygdensMusikforbund', name: 'Pitebygdens Musikförbund' }, // 2 ev i juli, 2 synliga
    { slug: 'OnTheFloor2014', name: 'On the Floor', city: 'Karlshamn' }, // 2 ev i juli, 7 synliga
    { slug: 'nykopings.folkhogskola', name: 'Nyköpings Folkhögskola', city: 'Nyköping' }, // 2 ev i juli, 2 synliga
    { slug: 'naturskyddsforeningenigoteborg', name: 'Naturskyddsföreningen i Göteborg', city: 'Göteborg' }, // 2 ev i juli, 2 synliga
    { slug: 'naturskyddsforeningen.vanersborg', name: 'Naturskyddsföreningen Vänersborg' }, // 2 ev i juli, 4 synliga
    { slug: 'liverestaurangen', name: 'Luleå Energi Arena' }, // 2 ev i juli, 8 synliga
    { slug: 'luleabasket', name: 'Luleå Basket' }, // 2 ev i juli, 1 synliga
    { slug: 'LandskronaMusikochTeater', name: 'Landskrona Musik & Teater - en del av Riksteatern', city: 'Landskrona' }, // 2 ev i juli, 3 synliga
    { slug: 'kulturhusetmollegarden', name: 'Kulturhuset Möllegården' }, // 2 ev i juli, 6 synliga
    { slug: 'ScenkonstH', name: 'Kulturhuset Glada Hudik' }, // 2 ev i juli, 1 synliga
    { slug: 'kristianstadskommun', name: 'Kristianstads kommun', city: 'Kristianstad' }, // 2 ev i juli, 8 synliga
    { slug: 'karlstadskommun', name: 'Karlstads kommun', city: 'Karlstad' }, // 2 ev i juli, 3 synliga
    { slug: 'Kajmanpite', name: 'Kajman' }, // 2 ev i juli, 6 synliga
    { slug: '100054229401426', name: 'Karolina Leifsdotter' }, // 2 ev i juli, 4 synliga
    { slug: 'jadedheartmusic', name: 'Jaded Heart' }, // 2 ev i juli, 8 synliga
    { slug: '100064844764389', name: 'Herrljunga Folkets Park' }, // 2 ev i juli, 3 synliga
    { slug: 'kraniosakralterapihastochmanniska', name: 'Jennies HelhetsHälsa' }, // 2 ev i juli, 1 synliga
    { slug: 'headstompproductions', name: 'Headstomp Productions' }, // 2 ev i juli, 8 synliga
    { slug: 'hagforskulturochbibliotek', name: 'Hagfors kultur och bibliotek' }, // 2 ev i juli, 2 synliga
    { slug: 'gamlahalmstad', name: 'Gamla Halmstad', city: 'Halmstad' }, // 2 ev i juli, 2 synliga
    { slug: 'foreningensm', name: 'Föreningen Söderhamns Museum', city: 'Söderhamn' }, // 2 ev i juli, 6 synliga
    { slug: 'forskarnasgalleri', name: 'Forskarnas galleri - Malmö universitetsbibliotek' }, // 2 ev i juli, 2 synliga
    { slug: 'FrokenLarssonHandelsbod', name: 'Fröken Larsson Vintage, Antikt & Secondhand' }, // 2 ev i juli, 4 synliga
    { slug: 'delsbohembygdsforening', name: 'Delsbo Forngård' }, // 2 ev i juli, 1 synliga
    { slug: 'dismitt', name: 'Dis-Mitt' }, // 2 ev i juli, 8 synliga
    { slug: 'clarionostersund', name: 'Clarion Hotel Grand Östersund (Östersund)' }, // 2 ev i juli, 8 synliga
    { slug: 'blekingska', name: 'Blekingska nationen', city: 'Lund' }, // 2 ev i juli, 8 synliga
    { slug: 'billstromska.fhsk', name: 'Billströmska folkhögskolan' }, // 2 ev i juli, 2 synliga
    { slug: 'backayardbeats', name: 'Back a Yard Beats', city: 'Stockholm' }, // 2 ev i juli, 2 synliga
    { slug: 'babetteskafferi', name: 'Babettes Kafferi', city: 'Linköping' }, // 2 ev i juli, 6 synliga
    { slug: 'angustheultimatetribute', name: 'Angus - The Ultimate Tribute' }, // 2 ev i juli, 8 synliga
    { slug: 'annelundsgarden', name: 'Annelundsgården' }, // 2 ev i juli, 8 synliga
    { slug: 'alexeklundofficial', name: 'Alex Eklund', city: 'Eskilstuna' }, // 2 ev i juli, 2 synliga
    { slug: 'absaloncph', name: 'Absalon' }, // 2 ev i juli, 8 synliga
];
