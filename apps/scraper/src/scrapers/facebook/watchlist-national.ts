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
    { slug: 'Livescenscandinaviaab', name: 'Visit Örebro' }, // 160 ev i juli, 7 synliga
    { slug: 'LiveEventRadar', name: 'Live Event Radar' }, // 66 ev i juli, 8 synliga
    { slug: 'nieuscene', name: 'Nieu Torshov' }, // 64 ev i juli, 7 synliga
    { slug: 'vaxjobibliotek', name: 'Växjö bibliotek' }, // 55 ev i juli, 8 synliga
    { slug: 'stadsbiblioteketgbg', name: 'Göteborgs stadsbibliotek' }, // 52 ev i juli, 7 synliga
    { slug: 'kulturaktiebolaget', name: 'Kulturaktiebolaget', city: 'Landskrona' }, // 49 ev i juli, 8 synliga
    { slug: 'StudieforbundetVuxenskolanVast', name: 'Studieförbundet Vuxenskolan Väst', city: 'Uddevalla' }, // 45 ev i juli, 7 synliga
    { slug: 'studioexpress.se', name: 'Studioexpress.se', city: 'Lund' }, // 43 ev i juli, 8 synliga
    { slug: 'gkmmsplit', name: 'Gradska knjiznica Marka Marulica Split' }, // 40 ev i juli, 8 synliga
    { slug: 'abfnorrkalix', name: 'Kalix Kommun' }, // 39 ev i juli, 4 synliga
    { slug: 'KulturcentrumSandviken', name: 'Kulturcentrum Sandviken', city: 'Sandviken' }, // 38 ev i juli, 6 synliga
    { slug: 'folkuniversitetetvisby', name: 'Folkuniversitetet Visby', city: 'Visby' }, // 37 ev i juli, 8 synliga
    { slug: 'guppyentertainmentab', name: 'Guppy Entertainment', city: 'Kristianstad' }, // 35 ev i juli, 8 synliga
    { slug: 'Musikhuset', name: 'Musikhuset Gävle', city: 'Gävle' }, // 33 ev i juli, 8 synliga
    { slug: 'hundesenteretitrondheim', name: 'Hundesenteret' }, // 32 ev i juli, 8 synliga
    { slug: 'stockholmjazz', name: 'Stockholm Jazz Festival', city: 'Stockholm' }, // 31 ev i juli, 8 synliga
    { slug: 'csnoje.se', name: 'CS Nöje', city: 'Jönköping' }, // 30 ev i juli, 8 synliga
    { slug: 'svdalsland', name: 'Studieförbundet Vuxenskolan i Dalsland' }, // 29 ev i juli, 8 synliga
    { slug: 'FKPscorpiosweden', name: 'FKP Scorpio Sverige' }, // 29 ev i juli, 8 synliga
    { slug: 'vasteraskonserthus', name: 'Västerås Konserthus', city: 'Västerås' }, // 28 ev i juli, 8 synliga
    { slug: 'allaktivitetshusetsture', name: 'Skinnskattebergs Kommun' }, // 28 ev i juli, 1 synliga
    { slug: 'Vaxjodyksport', name: 'Växjödyksport', city: 'Växjö' }, // 27 ev i juli, 8 synliga
    { slug: 'Debasersthlm', name: 'Debaser', city: 'Stockholm' }, // 27 ev i juli, 7 synliga
    { slug: 'stormspakhus', name: 'Storms Pakhus' }, // 27 ev i juli, 6 synliga
    { slug: 'ABFsorm', name: 'ABF Sörmland', city: 'Eskilstuna' }, // 27 ev i juli, 8 synliga
    { slug: 'Honggymnastikforening', name: 'Høng GF' }, // 26 ev i juli, 8 synliga
    { slug: 'vrakdykarpensionatet', name: 'Vrakdykarpensionatet' }, // 25 ev i juli, 8 synliga
    { slug: 'lundchoralfestival.lcf', name: 'Lund Choral Festival', city: 'Lund' }, // 24 ev i juli, 8 synliga
    { slug: 'dismitt', name: 'Dis-Mitt', city: 'Gävle' }, // 24 ev i juli, 8 synliga
    { slug: 'baerumkulturhus', name: 'Bærum Kulturhus' }, // 24 ev i juli, 6 synliga
    { slug: 'Megascope', name: 'Megascope' }, // 23 ev i juli, 8 synliga
    { slug: 'folkuniversitetetregionsyd', name: 'Folkuniversitetet Syd', city: 'Helsingborg' }, // 23 ev i juli, 8 synliga
    { slug: 'planbmalmo', name: 'Plan B - malmö' }, // 21 ev i juli, 8 synliga
    { slug: 'northeventAB', name: 'Northevent AB', city: 'Jönköping' }, // 21 ev i juli, 8 synliga
    { slug: 'Moveat.Sweden', name: 'Moveat', city: 'Göteborg' }, // 21 ev i juli, 8 synliga
    { slug: 'kollektivetlivetbar', name: 'Kollektivet Livet' }, // 21 ev i juli, 8 synliga
    { slug: 'HarrysStenungsund', name: 'Harrys' }, // 21 ev i juli, 7 synliga
    { slug: 'jazzclubfasching', name: 'Fasching' }, // 21 ev i juli, 8 synliga
    { slug: 'Kulturenshus', name: 'Kulturens hus Luleå' }, // 20 ev i juli, 8 synliga
    { slug: 'livenationswe', name: 'Live Nation Sweden', city: 'Stockholm' }, // 20 ev i juli, 8 synliga
    { slug: 'hyltebiblioteken', name: 'Hyltebiblioteken' }, // 20 ev i juli, 8 synliga
    { slug: 'barnbiblioteken', name: 'Barnbiblioteken', city: 'Strängnäs' }, // 20 ev i juli, 6 synliga
    { slug: 'toccaentertainment', name: 'Tocca Entertainment', city: 'Sundsvall' }, // 19 ev i juli, 5 synliga
    { slug: 'svgavleborg', name: 'Studieförbundet Vuxenskolan Gävleborg', city: 'Gävle' }, // 19 ev i juli, 8 synliga
    { slug: 'skogsvargarna', name: 'OK Skogsvargarna' }, // 19 ev i juli, 4 synliga
    { slug: 'Inkonst3', name: 'Inkonst' }, // 19 ev i juli, 8 synliga
    { slug: 'NojetKonsert', name: 'Nöjet Konsert AB', city: 'Uppsala' }, // 19 ev i juli, 8 synliga
    { slug: 'katalin.uppsala', name: 'Katalin And All That Jazz Östra Station', city: 'Uppsala' }, // 19 ev i juli, 8 synliga
    { slug: 'iggesundsfolkan', name: 'Folkets Hus - Iggesund' }, // 19 ev i juli, 7 synliga
    { slug: 'Sormlandsmuseum', name: 'Sörmlands museum', city: 'Nyköping' }, // 18 ev i juli, 6 synliga
    { slug: 'sodertaljestadsscen', name: 'Södertälje stadsscen' }, // 18 ev i juli, 8 synliga
    { slug: 'svinorrabohuslan', name: 'Studieförbundet Vuxenskolan i Norra Bohuslän' }, // 18 ev i juli, 8 synliga
    { slug: 'Scalateatern', name: 'Scalateatern i Karlstad', city: 'Karlstad' }, // 18 ev i juli, 5 synliga
    { slug: 'hotelskansenoland', name: 'Hotel Skansen', city: 'Kalmar' }, // 18 ev i juli, 8 synliga
    { slug: 'hemfranderome', name: 'Hem från Derome', city: 'Landskrona' }, // 18 ev i juli, 8 synliga
    { slug: 'rockefelleroslo', name: 'Rockefeller / John Dee / Sentrum Scene' }, // 17 ev i juli, 8 synliga
    { slug: 'norrlandsoperan', name: 'Norrlandsoperan' }, // 17 ev i juli, 6 synliga
    { slug: 'vadstenabibliotek', name: 'Vadstena bibliotek' }, // 17 ev i juli, 5 synliga
    { slug: 'mejeriet', name: 'Mejeriet', city: 'Lund' }, // 17 ev i juli, 7 synliga
    { slug: 'kramforsbibliotek', name: 'Kramfors bibliotek' }, // 17 ev i juli, 7 synliga
    { slug: 'nationalmuseumswe', name: 'Nationalmuseum', city: 'Stockholm' }, // 17 ev i juli, 7 synliga
    { slug: 'krallentertainment', name: 'Krall Entertainment', city: 'Uppsala' }, // 17 ev i juli, 8 synliga
    { slug: 'jubelAB', name: 'Jubel', city: 'Västerås' }, // 17 ev i juli, 8 synliga
    { slug: 'Hjaltevadshus', name: 'Hjältevadshus', city: 'Uppsala' }, // 17 ev i juli, 2 synliga
    { slug: 'attentionmolndal', name: 'Attention Mölndal' }, // 17 ev i juli, 8 synliga
    { slug: 'Ostgota', name: 'Östgöta Nation', city: 'Lund' }, // 16 ev i juli, 8 synliga
    { slug: 'medleymalmo', name: 'medley malmö' }, // 16 ev i juli, 8 synliga
    { slug: 'Sjoangen', name: 'Sjöängen i Askersund' }, // 16 ev i juli, 6 synliga
    { slug: 'planthousehuntersville', name: 'PlantHouse' }, // 16 ev i juli, 8 synliga
    { slug: 'medborgarskolanjamtland', name: 'Medborgarskolan' }, // 16 ev i juli, 8 synliga
    { slug: 'monovaxjo', name: 'Mono Växjö' }, // 16 ev i juli, 8 synliga
    { slug: 'hedvigeleonora', name: 'Hedvig Eleonora kyrka' }, // 16 ev i juli, 6 synliga
    { slug: 'kulturkvarteret', name: 'Kulturkvarteret Kristianstad', city: 'Kristianstad' }, // 16 ev i juli, 7 synliga
    { slug: 'fhsater', name: 'Folkets Hus Säter' }, // 16 ev i juli, 6 synliga
    { slug: 'alltpascen', name: 'Allt På Scen & Mycke Nöje', city: 'Västerås' }, // 16 ev i juli, 8 synliga
    { slug: 'astarscandinavia', name: 'A STAR Entertainment', city: 'Norrköping' }, // 16 ev i juli, 8 synliga
    { slug: 'umepride', name: 'Umepride' }, // 15 ev i juli, 8 synliga
    { slug: 'tranemo.bibliotek', name: 'Tranemo bibliotek' }, // 15 ev i juli, 4 synliga
    { slug: 'Smalands', name: 'Smålands Nation', city: 'Lund' }, // 15 ev i juli, 4 synliga
    { slug: 'vadhanderistockholm', name: 'Vad som händer i Stockholm', city: 'Stockholm' }, // 15 ev i juli, 5 synliga
    { slug: 'parkenkulturhus', name: 'Parken kulturhus' }, // 15 ev i juli, 8 synliga
    { slug: 'movehomesverige', name: 'Movehome', city: 'Karlstad' }, // 15 ev i juli, 3 synliga
    { slug: 'kulturhusetstadsteatern', name: 'Kulturhuset Stadsteatern' }, // 15 ev i juli, 8 synliga
    { slug: 'harnosandsbibliotek', name: 'Härnösands bibliotek', city: 'Härnösand' }, // 15 ev i juli, 7 synliga
    { slug: 'enkopingskommunbibliotek', name: 'Enköpings kommunbibliotek', city: 'Enköping' }, // 15 ev i juli, 6 synliga
    { slug: 'folketshusulricehamn', name: 'Folkets Hus Ulricehamn' }, // 15 ev i juli, 7 synliga
    { slug: 'allthingslivesweden', name: 'All Things Live Sweden', city: 'Landskrona' }, // 15 ev i juli, 6 synliga
    { slug: 'vasterasbibliotek', name: 'Västerås bibliotek', city: 'Västerås' }, // 14 ev i juli, 6 synliga
    { slug: 'Victoriateatern', name: 'Victoriateatern Malmö' }, // 14 ev i juli, 7 synliga
    { slug: 'vewcs', name: 'Victor Evelina West Coast Swing', city: 'Uppsala' }, // 14 ev i juli, 8 synliga
    { slug: 'tingsrydsbibliotekochkultur', name: 'Tingsryds bibliotek och kultur' }, // 14 ev i juli, 5 synliga
    { slug: 'steamhotel', name: 'The Steam Hotel', city: 'Västerås' }, // 14 ev i juli, 7 synliga
    { slug: 'tasspalatset.se', name: 'Tasspalatset' }, // 14 ev i juli, 6 synliga
    { slug: 'NalenStockholm', name: 'Nalen', city: 'Stockholm' }, // 14 ev i juli, 6 synliga
    { slug: 'nygatan6', name: 'Nygatan 6' }, // 14 ev i juli, 7 synliga
    { slug: 'Reimersholmehotel', name: 'Reimersholme Hotel', city: 'Stockholm' }, // 14 ev i juli, 8 synliga
    { slug: 'kulturiale', name: 'Kultur i Ale' }, // 14 ev i juli, 5 synliga
    { slug: 'ideadrottninghog', name: 'Idé A Drottninghög', city: 'Helsingborg' }, // 14 ev i juli, 6 synliga
    { slug: 'Gummifabriken', name: 'Gummifabriken i Värnamo' }, // 14 ev i juli, 8 synliga
    { slug: 'gemenskapikungsor', name: 'Gemenskap i Kungsör' }, // 14 ev i juli, 7 synliga
    { slug: 'gretasgothenburg', name: 'Gretas Göteborg', city: 'Göteborg' }, // 14 ev i juli, 8 synliga
    { slug: 'BorasDansforening', name: 'Borås Dansförening', city: 'Borås' }, // 14 ev i juli, 8 synliga
    { slug: 'bioroy', name: 'Bio Roy' }, // 14 ev i juli, 8 synliga
    { slug: 'Biotranan.Tranemo', name: 'Bio Tranan Tranemo' }, // 14 ev i juli, 5 synliga
    { slug: 'ABFKiruna', name: 'ABF Norr Kiruna', city: 'Kiruna' }, // 14 ev i juli, 8 synliga
    { slug: 'litensmula', name: 'Vita Huset - En Liten Smula', city: 'Norrtälje' }, // 13 ev i juli, 8 synliga
    { slug: 'vastmanlandslansmuseum', name: 'Västmanlands läns museum', city: 'Västerås' }, // 13 ev i juli, 8 synliga
    { slug: 'tibrobibliotek', name: 'Tibro bibliotek' }, // 13 ev i juli, 6 synliga
    { slug: 'Tangokompaniet', name: 'Tangokompaniet', city: 'Lund' }, // 13 ev i juli, 7 synliga
    { slug: 'SundsvallsStadsbibliotek', name: 'Sundsvalls Stadsbibliotek', city: 'Sundsvall' }, // 13 ev i juli, 8 synliga
    { slug: 'jointhestudentlife', name: 'The Student Life' }, // 13 ev i juli, 2 synliga
    { slug: 'svkalmarlan', name: 'Studieförbundet Vuxenskolan Kalmar län', city: 'Nybro' }, // 13 ev i juli, 8 synliga
    { slug: 'rodakvarnhbg', name: 'Röda Kvarn Helsingborg', city: 'Helsingborg' }, // 13 ev i juli, 8 synliga
    { slug: 'situpcomedy', name: 'Sit-up comedy show' }, // 13 ev i juli, 3 synliga
    { slug: 'SanktJohanneskyrka', name: 'Sankt Johannes kyrka, Malmö' }, // 13 ev i juli, 8 synliga
    { slug: 'Midsommargarden', name: 'Midsommargården' }, // 13 ev i juli, 8 synliga
    { slug: 'malmolive', name: 'Malmö Live' }, // 13 ev i juli, 7 synliga
    { slug: 'lundsallhelgonakyrka', name: 'Lunds Allhelgonakyrka' }, // 13 ev i juli, 5 synliga
    { slug: 'inrenatur', name: 'Inre natur' }, // 13 ev i juli, 6 synliga
    { slug: 'gotlandsmuseum', name: 'Gotlands Museum', city: 'Visby' }, // 13 ev i juli, 5 synliga
    { slug: 'BrassUnit', name: 'BrassUnit', city: 'Lidköping' }, // 13 ev i juli, 8 synliga
    { slug: 'centrumhusbiografen', name: 'Centrumhusbiografen' }, // 13 ev i juli, 8 synliga
    { slug: 'cirkus.klub', name: 'Cirkus' }, // 13 ev i juli, 6 synliga
    { slug: 'varlokal', name: 'Vår lokal' }, // 12 ev i juli, 6 synliga
    { slug: 'varnamobibliotekochkultur', name: 'Värnamo bibliotek och kultur' }, // 12 ev i juli, 8 synliga
    { slug: 'varldskulturmuseet', name: 'Världskulturmuseet' }, // 12 ev i juli, 8 synliga
    { slug: 'ungdomshuset.odense', name: 'Ungdomshuset Odense' }, // 12 ev i juli, 8 synliga
    { slug: 'trinitymusicberlin', name: 'Trinity Music' }, // 12 ev i juli, 8 synliga
    { slug: 'sensusvastrasverige', name: 'Sensus Västra Sverige', city: 'Göteborg' }, // 12 ev i juli, 8 synliga
    { slug: 'pitea.se', name: 'Piteå kommun' }, // 12 ev i juli, 8 synliga
    { slug: 'oxiebiblioteket', name: 'Oxiebiblioteket' }, // 12 ev i juli, 6 synliga
    { slug: 'NiklasStromstedtMusic', name: 'Niklas Strömstedt', city: 'Gävle' }, // 12 ev i juli, 8 synliga
    { slug: 'natminkulturhus', name: 'Nationella minoriteters kulturhus' }, // 12 ev i juli, 7 synliga
    { slug: 'moriskapaviljongen', name: 'Moriska Paviljongen' }, // 12 ev i juli, 8 synliga
    { slug: 'lugersweden', name: 'Luger', city: 'Stockholm' }, // 12 ev i juli, 8 synliga
    { slug: 'malmomuseum', name: 'Malmö museum', city: 'Malmö' }, // 12 ev i juli, 5 synliga
    { slug: 'katalinsjazzbar', name: 'Katalins Bakficka', city: 'Uppsala' }, // 12 ev i juli, 8 synliga
    { slug: 'estrad.norr', name: 'Estrad Norr' }, // 12 ev i juli, 7 synliga
    { slug: 'kulturbolaget', name: 'Kulturbolaget', city: 'Jönköping' }, // 12 ev i juli, 8 synliga
    { slug: 'kalmarnationlund', name: 'Kalmar Nation', city: 'Lund' }, // 12 ev i juli, 5 synliga
    { slug: 'eksjobibliotek', name: 'Eksjö stadsbibliotek' }, // 12 ev i juli, 7 synliga
    { slug: 'drammenkulturhus', name: 'Drammen kulturhus' }, // 12 ev i juli, 8 synliga
    { slug: 'ebba.dansklubb', name: 'EBBA Dansklubb' }, // 12 ev i juli, 5 synliga
    { slug: 'biograffokusjonkoping', name: 'Biograf Fokus Jönköping', city: 'Jönköping' }, // 12 ev i juli, 8 synliga
    { slug: 'dalarnasmuseum', name: 'Dalarnas museum', city: 'Falun' }, // 12 ev i juli, 6 synliga
    { slug: 'bibliotekenihalmstad', name: 'Biblioteken i Halmstad', city: 'Halmstad' }, // 12 ev i juli, 8 synliga
    { slug: 'bergenlive', name: 'Bergen Live' }, // 12 ev i juli, 8 synliga
    { slug: 'ABFsodertorn', name: 'ABF Södertörn' }, // 12 ev i juli, 8 synliga
    { slug: 'bibliotekoupplevelser', name: 'Vingåkers bibliotek' }, // 11 ev i juli, 7 synliga
    { slug: 'soderhamnsbibblan', name: 'Söderhamns Stadsbibliotek', city: 'Söderhamn' }, // 11 ev i juli, 7 synliga
    { slug: 'SVGoteborg', name: 'Studieförbundet Vuxenskolan Göteborg', city: 'Göteborg' }, // 11 ev i juli, 8 synliga
    { slug: 'sigtunastiftelsen', name: 'Sigtunastiftelsen' }, // 11 ev i juli, 5 synliga
    { slug: 'sarakulturhus', name: 'Sara kulturhus' }, // 11 ev i juli, 8 synliga
    { slug: '100046421744875', name: 'Råda Rum' }, // 11 ev i juli, 8 synliga
    { slug: 'MusikiChristinae', name: 'Musik i Christinae', city: 'Alingsås' }, // 11 ev i juli, 7 synliga
    { slug: 'magasinetfalun', name: 'Magasinet Falun', city: 'Falun' }, // 11 ev i juli, 8 synliga
    { slug: 'Landskronabibliotek', name: 'Landskrona bibliotek', city: 'Landskrona' }, // 11 ev i juli, 8 synliga
    { slug: 'medeltidsmuseet', name: 'Medeltidsmuseet', city: 'Stockholm' }, // 11 ev i juli, 7 synliga
    { slug: 'kollektivkrogen', name: 'Kollektivkrogen' }, // 11 ev i juli, 8 synliga
    { slug: 'kulturhuseteden', name: 'Kulturhuset Eden' }, // 11 ev i juli, 7 synliga
    { slug: 'konstepidemin', name: 'Konstepidemin' }, // 11 ev i juli, 8 synliga
    { slug: 'HotellHulingen', name: 'Hotell Hulingen' }, // 11 ev i juli, 8 synliga
    { slug: 'hotelmolndalsbroochroyrestaurant', name: 'Hotel Mölndals Bro - Roy Restaurant Café & Bar' }, // 11 ev i juli, 5 synliga
    { slug: 'halmstadsteater', name: 'Halmstads Teater' }, // 11 ev i juli, 8 synliga
    { slug: 'gavlekonserthus', name: 'Gävle Konserthus', city: 'Gävle' }, // 11 ev i juli, 8 synliga
    { slug: 'grandliveab', name: 'Grand Live', city: 'Eskilstuna' }, // 11 ev i juli, 8 synliga
    { slug: 'feverup', name: 'Fever', city: 'Stockholm' }, // 11 ev i juli, 8 synliga
    { slug: 'falkenbergsstadsteater', name: 'Falkenbergs Stadsteater', city: 'Falkenberg' }, // 11 ev i juli, 8 synliga
    { slug: 'musikenshusgbg', name: 'Café Hängmattan' }, // 11 ev i juli, 8 synliga
    { slug: 'centrumforfotografi', name: 'CFF – Centrum för fotografi', city: 'Göteborg' }, // 11 ev i juli, 1 synliga
    { slug: 'Bibliotekenilulea', name: 'Biblioteken i Luleå' }, // 11 ev i juli, 8 synliga
    { slug: 'BibliotekeniJonkoping', name: 'Biblioteken i Jönköping', city: 'Jönköping' }, // 11 ev i juli, 8 synliga
    { slug: '59anLysekil', name: '59an i Lysekil' }, // 11 ev i juli, 3 synliga
    { slug: 'ostgotateatern', name: 'Östgötateatern', city: 'Norrköping' }, // 10 ev i juli, 5 synliga
    { slug: 'karlecafe', name: 'karl-e' }, // 10 ev i juli, 8 synliga
    { slug: 'WoodyWestGbg', name: 'Woody West' }, // 10 ev i juli, 8 synliga
    { slug: 'vilhelmina.folketshus.7', name: 'Vilhelmina Folkets Hus' }, // 10 ev i juli, 2 synliga
    { slug: 'tradgarn', name: 'Trädgår\'n' }, // 10 ev i juli, 8 synliga
    { slug: 'svorebrolan', name: 'Studieförbundet Vuxenskolan Örebro Län', city: 'Lindesberg' }, // 10 ev i juli, 8 synliga
    { slug: 'Showtic', name: 'Showtic', city: 'Linköping' }, // 10 ev i juli, 7 synliga
    { slug: 'seniorikungsbacka', name: 'Senior i Kungsbacka', city: 'Kungsbacka' }, // 10 ev i juli, 7 synliga
    { slug: 'stfostraskane', name: 'STF Östra Skåne Lokalavdelning', city: 'Kristianstad' }, // 10 ev i juli, 8 synliga
    { slug: 'musikvalvetbaggen', name: 'Musikvalvet Baggen' }, // 10 ev i juli, 4 synliga
    { slug: 'oslonye', name: 'Oslo Nye Teater' }, // 10 ev i juli, 8 synliga
    { slug: 'latinamerikaifokus', name: 'Latinamerika i Fokus' }, // 10 ev i juli, 8 synliga
    { slug: 'kulturmagasinetsundsvall', name: 'Kulturmagasinet Sundsvall', city: 'Sundsvall' }, // 10 ev i juli, 8 synliga
    { slug: 'KappaBarMalmo', name: 'Kappa Bar Malmö' }, // 10 ev i juli, 5 synliga
    { slug: 'jazzklubbensundsvall.se', name: 'Jazzklubben Sundsvall', city: 'Sundsvall' }, // 10 ev i juli, 8 synliga
    { slug: 'hagforskulturochbibliotek', name: 'Hagfors kultur och bibliotek' }, // 10 ev i juli, 5 synliga
    { slug: 'GothenburgSymphonyOrchestra', name: 'Göteborgs Symfoniker' }, // 10 ev i juli, 4 synliga
    { slug: 'goteborgsstad', name: 'Göteborgs Stad', city: 'Göteborg' }, // 10 ev i juli, 5 synliga
    { slug: 'EncoreSundbyberg', name: 'Encore, Sundbyberg' }, // 10 ev i juli, 8 synliga
    { slug: 'Boras.Stadsteater', name: 'Borås Stadsteater', city: 'Borås' }, // 10 ev i juli, 3 synliga
    { slug: 'bibliotekljusdal', name: 'Biblioteken i Ljusdals kommun' }, // 10 ev i juli, 5 synliga
    { slug: 'folketsbiomalmo', name: 'Biograf Panora Malmö' }, // 10 ev i juli, 8 synliga
    { slug: 'alvestabibliotek', name: 'Biblioteken i Alvesta kommun' }, // 10 ev i juli, 6 synliga
    { slug: 'ostersundsbibliotek', name: 'Östersunds Bibliotek' }, // 9 ev i juli, 8 synliga
    { slug: 'catscornermalmo', name: 'https://www.facebook.com/groups/', city: 'Stockholm' }, // 9 ev i juli, 3 synliga
    { slug: 'vaxjoloparklubb', name: 'Växjö Löparklubb' }, // 9 ev i juli, 1 synliga
    { slug: 'vnmuseum', name: 'Västernorrlands museum', city: 'Härnösand' }, // 9 ev i juli, 7 synliga
    { slug: 'vaniumeasida', name: 'Vän i Umeå' }, // 9 ev i juli, 8 synliga
    { slug: 'ulrikabeijeryoga', name: 'UB Yoga, Sång & Ceremoni', city: 'Hudiksvall' }, // 9 ev i juli, 7 synliga
    { slug: 'Vindelnskommunbibliotek', name: 'Vindelns kommunbibliotek' }, // 9 ev i juli, 5 synliga
    { slug: 'trivselhussverige', name: 'Trivselhus', city: 'Karlstad' }, // 9 ev i juli, 2 synliga
    { slug: 'stockholmsmarknader', name: 'Stockholmsmarknader' }, // 9 ev i juli, 4 synliga
    { slug: 'stockholmghostwalk', name: 'Stockholm Ghost Walk', city: 'Stockholm' }, // 9 ev i juli, 5 synliga
    { slug: 'biblioteketsimrishamn', name: 'Simrishamns bibliotek', city: 'Simrishamn' }, // 9 ev i juli, 8 synliga
    { slug: 'malmostadsbibliotek', name: 'Stadsbiblioteket i Malmö' }, // 9 ev i juli, 8 synliga
    { slug: 'sagabioflen', name: 'Saga Bio, Flen' }, // 9 ev i juli, 5 synliga
    { slug: 'mikespubskovde', name: 'Mikes pub och restaurang', city: 'Skövde' }, // 9 ev i juli, 3 synliga
    { slug: 'molndalsdansskola', name: 'Mölndals Dansskola' }, // 9 ev i juli, 8 synliga
    { slug: 'MusikcentrumVast', name: 'MCV - Musikcentrum Väst' }, // 9 ev i juli, 8 synliga
    { slug: 'linkopingairswing', name: 'Linköping Air Swing', city: 'Linköping' }, // 9 ev i juli, 8 synliga
    { slug: 'lisebergab', name: 'Liseberg' }, // 9 ev i juli, 3 synliga
    { slug: 'kulturhusetmobeln', name: 'Kulturhuset Möbeln' }, // 9 ev i juli, 8 synliga
    { slug: 'konstmuseet', name: 'Konstmuseet', city: 'Skövde' }, // 9 ev i juli, 7 synliga
    { slug: 'karlskronabibliotek', name: 'Karlskrona Stadsbibliotek', city: 'Karlskrona' }, // 9 ev i juli, 8 synliga
    { slug: 'kristinehamnsbibliotek', name: 'Kristinehamns bibliotek', city: 'Kristinehamn' }, // 9 ev i juli, 5 synliga
    { slug: 'kbwestgbg', name: 'KB West' }, // 9 ev i juli, 8 synliga
    { slug: 'hjartatshus', name: 'Hjärtats hus', city: 'Jönköping' }, // 9 ev i juli, 7 synliga
    { slug: 'hovmantorps.folketshus', name: 'Folkbiografen Hovmantorp' }, // 9 ev i juli, 8 synliga
    { slug: 'Falkopingsbibliotek', name: 'Falköpings bibliotek' }, // 9 ev i juli, 4 synliga
    { slug: 'eskilstunakompaniet', name: 'Eskilstunakompaniet', city: 'Eskilstuna' }, // 9 ev i juli, 8 synliga
    { slug: 'drakenlive', name: 'Draken Live' }, // 9 ev i juli, 4 synliga
    { slug: 'Eskilstunastadsbibliotek', name: 'Eskilstuna stadsbibliotek', city: 'Eskilstuna' }, // 9 ev i juli, 8 synliga
    { slug: 'haningebibliotek', name: 'Biblioteken i Haninge' }, // 9 ev i juli, 5 synliga
    { slug: 'bibliotekeniboras', name: 'Biblioteken i Borås', city: 'Borås' }, // 9 ev i juli, 8 synliga
    { slug: 'BestermanAB', name: 'Besterman', city: 'Karlstad' }, // 9 ev i juli, 8 synliga
    { slug: 'mountainfilm', name: 'Banff Mountain Film Festival Scandinavia', city: 'Falun' }, // 9 ev i juli, 3 synliga
    { slug: 'babblarnalive', name: 'Babblarna på scen', city: 'Uppsala' }, // 9 ev i juli, 4 synliga
    { slug: 'ArbogaFolketsPark', name: 'Arboga Folkets Park' }, // 9 ev i juli, 8 synliga
    { slug: 'anebybibliotek', name: 'Aneby bibliotek' }, // 9 ev i juli, 5 synliga
    { slug: 'ostfoldteater', name: 'Østfold Teater' }, // 8 ev i juli, 8 synliga
    { slug: 'ostersundskulturskola', name: 'Östersunds Kulturskola' }, // 8 ev i juli, 3 synliga
    { slug: 'orebrobibliotek', name: 'Örebro bibliotek' }, // 8 ev i juli, 8 synliga
    { slug: 'vaxjokommun', name: 'Växjö kommun' }, // 8 ev i juli, 3 synliga
    { slug: 'tunapark.se', name: 'Tuna Park', city: 'Eskilstuna' }, // 8 ev i juli, 6 synliga
    { slug: 'vansbrokommun', name: 'Vansbro kommun' }, // 8 ev i juli, 1 synliga
    { slug: 'VXOevent', name: 'VXO event' }, // 8 ev i juli, 8 synliga
    { slug: 'ThePulsebar2023', name: 'The Pulse' }, // 8 ev i juli, 5 synliga
    { slug: 'TheTivoli', name: 'The Tivoli', city: 'Helsingborg' }, // 8 ev i juli, 8 synliga
    { slug: 'Storlihytta', name: 'Storlihytta' }, // 8 ev i juli, 8 synliga
    { slug: 'shrekraveofficial', name: 'Shrek Rave' }, // 8 ev i juli, 8 synliga
    { slug: 'rodakvarnkulturhus', name: 'Röda Kvarn Kultur' }, // 8 ev i juli, 8 synliga
    { slug: 'NaturumVattenriket', name: 'Naturum Vattenriket' }, // 8 ev i juli, 3 synliga
    { slug: 'nbvost', name: 'NBV Öst', city: 'Nyköping' }, // 8 ev i juli, 2 synliga
    { slug: 'musikilerum', name: 'Musik i Lerum' }, // 8 ev i juli, 5 synliga
    { slug: 'musikidalarna', name: 'Musik i Dalarna', city: 'Falun' }, // 8 ev i juli, 7 synliga
    { slug: 'monica.karlsson.399', name: 'Motala biologiska förening', city: 'Motala' }, // 8 ev i juli, 4 synliga
    { slug: 'junisalvsborgdistrikt', name: 'Movendi Älvsborg', city: 'Borås' }, // 8 ev i juli, 8 synliga
    { slug: 'lokstallet.skovde', name: 'Lokstallet', city: 'Skövde' }, // 8 ev i juli, 8 synliga
    { slug: 'kulturcentrumebeneser', name: 'Kulturcentrum Ebeneser' }, // 8 ev i juli, 8 synliga
    { slug: 'gasasteget', name: 'Lunds Dansklubb Gåsasteget', city: 'Lund' }, // 8 ev i juli, 7 synliga
    { slug: 'kristianstadsfilmstudio', name: 'Kristianstads Filmstudio', city: 'Kristianstad' }, // 8 ev i juli, 8 synliga
    { slug: 'grumsbio', name: 'Grums Bio' }, // 8 ev i juli, 4 synliga
    { slug: 'lerumsbibliotek', name: 'Kultur och bibliotek i Lerum' }, // 8 ev i juli, 5 synliga
    { slug: 'gnosjobibliotek', name: 'Gnosjö kultur & bibliotek' }, // 8 ev i juli, 5 synliga
    { slug: 'Furuviksparken', name: 'Furuviksparken' }, // 8 ev i juli, 2 synliga
    { slug: 'fulloflife.tantra', name: 'Full of Life' }, // 8 ev i juli, 2 synliga
    { slug: 'FolkteaternGbg', name: 'Folkteatern Göteborg', city: 'Göteborg' }, // 8 ev i juli, 7 synliga
    { slug: 'CirkusStavanger', name: 'CIRKUS' }, // 8 ev i juli, 6 synliga
    { slug: 'brasserietboras', name: 'Brasseriet', city: 'Borås' }, // 8 ev i juli, 4 synliga
    { slug: 'BorlangeDance', name: 'Borlänge Dance', city: 'Borlänge' }, // 8 ev i juli, 6 synliga
    { slug: 'backyardfalun', name: 'Backyard Club', city: 'Falun' }, // 8 ev i juli, 6 synliga
    { slug: 'orebro.salsafriends.9', name: 'Örebro Salsafriends' }, // 7 ev i juli, 4 synliga
    { slug: 'YogaHusetFalun', name: 'Yogahuset Falun', city: 'Falun' }, // 7 ev i juli, 7 synliga
    { slug: 'vastmanlandsteater', name: 'Västmanlands Teater', city: 'Västerås' }, // 7 ev i juli, 5 synliga
    { slug: 'UkrainianCultureInSweden', name: 'Ukrainian Culture in Sweden /Ukraine Culture Now' }, // 7 ev i juli, 6 synliga
    { slug: 'vallentunadans', name: 'Vallentuna Dans' }, // 7 ev i juli, 5 synliga
    { slug: 'jansvenssontrubadur', name: 'Trubadur Jan Svensson Musik Produktion', city: 'Uddevalla' }, // 7 ev i juli, 8 synliga
    { slug: 'taystase', name: 'Taysta', city: 'Västerås' }, // 7 ev i juli, 8 synliga
    { slug: 'rpsb50', name: 'TRENDERs', city: 'Göteborg' }, // 7 ev i juli, 8 synliga
    { slug: 'sevallabygdegard', name: 'Sevalla Bygdegård' }, // 7 ev i juli, 5 synliga
    { slug: 'seniortraffen', name: 'Seniorträffen, Oxelösund' }, // 7 ev i juli, 5 synliga
    { slug: 'reisdegkomikerklubb', name: 'Reis Deg Komikerklubb' }, // 7 ev i juli, 3 synliga
    { slug: 'regiongotland', name: 'Region Gotland', city: 'Visby' }, // 7 ev i juli, 4 synliga
    { slug: 'naturskyddsforeningenigoteborg', name: 'Naturskyddsföreningen i Göteborg', city: 'Göteborg' }, // 7 ev i juli, 5 synliga
    { slug: 'lindblomacademy', name: 'Lindblom Academy Inner Spirit Light', city: 'Västerås' }, // 7 ev i juli, 8 synliga
    { slug: 'malmocityskaters', name: 'Malmö City Skaters', city: 'Lund' }, // 7 ev i juli, 8 synliga
    { slug: 'lantmannenmaskinochlantbruk', name: 'Lantmännen Maskin och Lantmännen Lantbruk', city: 'Skövde' }, // 7 ev i juli, 1 synliga
    { slug: 'kulturhusetfregatten', name: 'Kulturhuset Fregatten' }, // 7 ev i juli, 6 synliga
    { slug: 'kungligaslotten', name: 'Kungliga Slotten' }, // 7 ev i juli, 4 synliga
    { slug: 'kulturhusetbollnas', name: 'Kulturhuset Bollnäs' }, // 7 ev i juli, 8 synliga
    { slug: 'kpdmellerud', name: 'Kulturbruket på Dal' }, // 7 ev i juli, 8 synliga
    { slug: 'trumhakan', name: 'Jansson Communication' }, // 7 ev i juli, 8 synliga
    { slug: 'forumbiblioteken', name: 'Forumbiblioteken i Nacka' }, // 7 ev i juli, 3 synliga
    { slug: 'JacyzHotel', name: 'Jacy\'z Hotel & Resort' }, // 7 ev i juli, 6 synliga
    { slug: 'filmfestsundsvall', name: 'Filmfest Sundsvall', city: 'Sundsvall' }, // 7 ev i juli, 8 synliga
    { slug: 'Familjecentralen.Ulricehamn', name: 'Familjecentralen, Öppna förskolan i Ulricehamn' }, // 7 ev i juli, 5 synliga
    { slug: 'DanshusetDkBuggie', name: 'Dansklubben Buggie i Ulricehamn' }, // 7 ev i juli, 5 synliga
    { slug: 'dansofolkton', name: 'Dans & Folkton' }, // 7 ev i juli, 8 synliga
    { slug: 'WheelsOfCarlshamn', name: 'Cykelklubben Wheels Of Carlshamn', city: 'Karlshamn' }, // 7 ev i juli, 1 synliga
    { slug: 'betlehemskyrkan', name: 'Betlehemskyrkan' }, // 7 ev i juli, 6 synliga
    { slug: 'baravanlig.se', name: 'Bara Vanlig', city: 'Lund' }, // 7 ev i juli, 8 synliga
    { slug: 'arvikabibliotek', name: 'Arvika Bibliotek', city: 'Arvika' }, // 7 ev i juli, 7 synliga
    { slug: 'arbogabio', name: 'Arboga bio' }, // 7 ev i juli, 1 synliga
    { slug: 'alexeklundofficial', name: 'Alex Eklund', city: 'Eskilstuna' }, // 7 ev i juli, 5 synliga
    { slug: 'AlingsasDansklubb', name: 'Alingsås Dansklubb', city: 'Alingsås' }, // 7 ev i juli, 4 synliga
    { slug: 'almhultsbibliotek', name: 'Älmhults bibliotek' }, // 6 ev i juli, 6 synliga
    { slug: 'yofcreativepartners', name: 'YOF Creative Partners', city: 'Stockholm' }, // 6 ev i juli, 8 synliga
    { slug: 'ystadsbibliotek', name: 'Ystads bibliotek', city: 'Ystad' }, // 6 ev i juli, 8 synliga
    { slug: 'Levochmaval', name: 'ViveVale', city: 'Lund' }, // 6 ev i juli, 2 synliga
    { slug: 'VintervikensTradgard', name: 'Vintervikens Trädgård', city: 'Stockholm' }, // 6 ev i juli, 8 synliga
    { slug: 'vindeln', name: 'Vindelns Kommun' }, // 6 ev i juli, 1 synliga
    { slug: 'vedeldspizzan', name: 'Vedeldspizzan', city: 'Göteborg' }, // 6 ev i juli, 2 synliga
    { slug: 'vardagibalans', name: 'Vardag i Balans', city: 'Lund' }, // 6 ev i juli, 2 synliga
    { slug: 'uppsalakonsertkongress', name: 'Uppsala Konsert & Kongress', city: 'Uppsala' }, // 6 ev i juli, 8 synliga
    { slug: 'umefox', name: 'UmeFox' }, // 6 ev i juli, 5 synliga
    { slug: 'Uddevallakassetten', name: 'Uddevallakassetten', city: 'Uddevalla' }, // 6 ev i juli, 3 synliga
    { slug: 'TillsammansHoor', name: 'Tillsammans Höör' }, // 6 ev i juli, 1 synliga
    { slug: 'svartebyalag', name: 'Svarte' }, // 6 ev i juli, 4 synliga
    { slug: 'Sundsvallsmuseum', name: 'Sundsvalls museum' }, // 6 ev i juli, 6 synliga
    { slug: 'smalandsuppsala', name: 'Smålands nation', city: 'Uppsala' }, // 6 ev i juli, 3 synliga
    { slug: 'regionmuseetskane', name: 'Regionmuseet Skåne', city: 'Kristianstad' }, // 6 ev i juli, 5 synliga
    { slug: 'silvenska', name: 'Silvénska villan' }, // 6 ev i juli, 5 synliga
    { slug: 'stuckonlive', name: 'Stuck On - Live' }, // 6 ev i juli, 8 synliga
    { slug: 'ParaplyProduktion', name: 'Paraply', city: 'Karlskrona' }, // 6 ev i juli, 8 synliga
    { slug: 'obosisverige', name: 'OBOS i Sverige', city: 'Uppsala' }, // 6 ev i juli, 3 synliga
    { slug: 'poffertjes.se', name: 'Poffertjes.se' }, // 6 ev i juli, 1 synliga
    { slug: 'mediumcamilla', name: 'Medium Camilla', city: 'Linköping' }, // 6 ev i juli, 2 synliga
    { slug: 'nykopings.folkhogskola', name: 'Nyköpings Folkhögskola', city: 'Nyköping' }, // 6 ev i juli, 5 synliga
    { slug: 'Mordmysterium', name: 'Mordmysterium' }, // 6 ev i juli, 5 synliga
    { slug: 'lommafolketshus', name: 'Lomma Folkets Hus' }, // 6 ev i juli, 5 synliga
    { slug: 'bodyandsoulmovement', name: 'Maria Slättorp - Body & Soul Movement' }, // 6 ev i juli, 4 synliga
    { slug: 'Bonanderfriskvard', name: 'Lena Bonanders Massage & Friskvård', city: 'Uddevalla' }, // 6 ev i juli, 4 synliga
    { slug: 'kristnaregnbagsrorelsen', name: 'Kristna regnbågsrörelsen - Riksförbundet EKHO' }, // 6 ev i juli, 8 synliga
    { slug: 'mittlandplus', name: 'Kultur i Ånge Kommun' }, // 6 ev i juli, 8 synliga
    { slug: 'Kapellet.telje', name: 'Kapellet', city: 'Norrtälje' }, // 6 ev i juli, 8 synliga
    { slug: 'jkpglm', name: 'Jönköpings läns museum', city: 'Jönköping' }, // 6 ev i juli, 4 synliga
    { slug: 'jan.svensson.9469', name: 'Jan Svensson' }, // 6 ev i juli, 8 synliga
    { slug: 'jagvagarstuffa', name: 'Jag vågar stuffa', city: 'Karlshamn' }, // 6 ev i juli, 8 synliga
    { slug: 'freemoveyogastudio.nu', name: 'Freemove Yogastudio' }, // 6 ev i juli, 8 synliga
    { slug: 'solvesborgcsk', name: 'Hjortakroksskolan' }, // 6 ev i juli, 2 synliga
    { slug: 'Gardenoffeathers', name: 'Garden of Feathers', city: 'Staffanstorp' }, // 6 ev i juli, 4 synliga
    { slug: 'dragonflystudioavesta', name: 'Dragonfly Studio' }, // 6 ev i juli, 2 synliga
    { slug: 'fkpscorpio', name: 'FKP Scorpio' }, // 6 ev i juli, 8 synliga
    { slug: 'Drammensacred', name: 'Drammen Sacred Music Festival' }, // 6 ev i juli, 8 synliga
    { slug: 'mikaelgottberg', name: 'Carlsson På Kajen' }, // 6 ev i juli, 3 synliga
    { slug: 'bjuvsbibliotek', name: 'Bjuvs bibliotek' }, // 6 ev i juli, 8 synliga
    { slug: 'ckwano1', name: 'CK Wano', city: 'Varberg' }, // 6 ev i juli, 1 synliga
    { slug: 'BokskogeniTorup', name: 'Bokskogen i Torup' }, // 6 ev i juli, 4 synliga
    { slug: 'angebibliotek', name: 'Biblioteken i Ånge' }, // 6 ev i juli, 5 synliga
    { slug: 'ArtFocusSverige', name: 'Birka Auktioner' }, // 6 ev i juli, 5 synliga
    { slug: 'arbisnkpg', name: 'Arbis' }, // 6 ev i juli, 8 synliga
    { slug: 'ostersundskommun', name: 'Östersunds kommun - Staaren tjïelte' }, // 5 ev i juli, 3 synliga
    { slug: 'folkanteater', name: 'Örnsköldsviks Riksteaterförening' }, // 5 ev i juli, 8 synliga
    { slug: 'ObackaJazz', name: 'Öbacka Jazz&Blues Härnösand', city: 'Härnösand' }, // 5 ev i juli, 7 synliga
    { slug: 'aterstallvatmarker', name: 'Återställ Våtmarker', city: 'Stockholm' }, // 5 ev i juli, 2 synliga
    { slug: 'Astorpskommun', name: 'Åstorps kommun' }, // 5 ev i juli, 8 synliga
    { slug: 'alvsbynsbibliotek', name: 'Älvsbyns Bibliotek' }, // 5 ev i juli, 6 synliga
    { slug: 'alvsbyn', name: 'Älvsbyn' }, // 5 ev i juli, 8 synliga
    { slug: 'Vardklockanskyrka', name: 'Vårdklockans kyrka', city: 'Visby' }, // 5 ev i juli, 3 synliga
    { slug: 'WermlandOpera', name: 'Wermland Opera', city: 'Karlstad' }, // 5 ev i juli, 2 synliga
    { slug: 'vikkysKonst', name: 'Vikkys Konst', city: 'Linköping' }, // 5 ev i juli, 4 synliga
    { slug: 'UppsalaBudoklubb', name: 'Uppsala Budoklubb', city: 'Uppsala' }, // 5 ev i juli, 6 synliga
    { slug: 'teaterhalland', name: 'Teater Halland', city: 'Varberg' }, // 5 ev i juli, 4 synliga
    { slug: 'swinginmotionab', name: 'Swing in motion', city: 'Borås' }, // 5 ev i juli, 7 synliga
    { slug: 'Studieforbundetbildanord', name: 'Studieförbundet Bilda Nord' }, // 5 ev i juli, 8 synliga
    { slug: 'studieframjandetumea', name: 'Studiefrämjandet Västerbotten' }, // 5 ev i juli, 6 synliga
    { slug: 'scenknuten', name: 'Scenknuten', city: 'Eskilstuna' }, // 5 ev i juli, 2 synliga
    { slug: 'slagelsebib', name: 'Slagelse Bibliotekerne' }, // 5 ev i juli, 8 synliga
    { slug: 'SalemStavanger', name: 'Salem Stavanger' }, // 5 ev i juli, 1 synliga
    { slug: 'satssverige', name: 'SATS Sverige', city: 'Stockholm' }, // 5 ev i juli, 5 synliga
    { slug: 'quiztyreso', name: 'QUIZ - Tyresö' }, // 5 ev i juli, 1 synliga
    { slug: 'sagateaterboras', name: 'Sagateatern', city: 'Borås' }, // 5 ev i juli, 8 synliga
    { slug: 'pustervik', name: 'Pustervik' }, // 5 ev i juli, 8 synliga
    { slug: 'nojesfabriken', name: 'Nöjesfabriken', city: 'Karlstad' }, // 5 ev i juli, 8 synliga
    { slug: 'northcreativenodes', name: 'North Creative Nodes', city: 'Boden' }, // 5 ev i juli, 6 synliga
    { slug: 'nordiskakammarorkestern', name: 'Nordiska Kammarorkestern', city: 'Sundsvall' }, // 5 ev i juli, 6 synliga
    { slug: 'hotellmullsjo', name: 'Mullsjö Hotell & Konferens' }, // 5 ev i juli, 3 synliga
    { slug: 'Lakarmissionen', name: 'Läkarmissionen', city: 'Alingsås' }, // 5 ev i juli, 4 synliga
    { slug: 'livenationnorway', name: 'Live Nation Norway' }, // 5 ev i juli, 8 synliga
    { slug: 'lesbisktrumuppsala', name: 'Lesbiskt rum Uppsala', city: 'Uppsala' }, // 5 ev i juli, 6 synliga
    { slug: 'LandskronaTeater', name: 'Landskrona Teater', city: 'Landskrona' }, // 5 ev i juli, 8 synliga
    { slug: 'LandskronaMusikochTeater', name: 'Landskrona Musik & Teater - en del av Riksteatern', city: 'Landskrona' }, // 5 ev i juli, 6 synliga
    { slug: 'kalix.bibliotek', name: 'Kalix Bibliotek' }, // 5 ev i juli, 3 synliga
    { slug: 'Kungalvsparken', name: 'Kungälvs Parken', city: 'Borås' }, // 5 ev i juli, 8 synliga
    { slug: 'KSHHealing', name: 'KSH Healing', city: 'Kalmar' }, // 5 ev i juli, 4 synliga
    { slug: 'jiversdancingclub', name: 'Jivers Dancing Club' }, // 5 ev i juli, 8 synliga
    { slug: 'lena.lingensjo', name: 'Härnösands damer', city: 'Härnösand' }, // 5 ev i juli, 4 synliga
    { slug: 'icfalkenberg', name: 'IC Falkenberg', city: 'Falkenberg' }, // 5 ev i juli, 8 synliga
    { slug: 'HotellHavanna', name: 'Hotell Havanna', city: 'Varberg' }, // 5 ev i juli, 3 synliga
    { slug: '100064844764389', name: 'Herrljunga Folkets Park' }, // 5 ev i juli, 8 synliga
    { slug: 'Hedenstedbibliotekerne', name: 'Hedensted Bibliotekerne' }, // 5 ev i juli, 8 synliga
    { slug: 'goteborgs.botaniska.tradgard', name: 'Göteborgs botaniska trädgård' }, // 5 ev i juli, 4 synliga
    { slug: 'artstheatregeorge', name: 'George Arts Theatre' }, // 5 ev i juli, 3 synliga
    { slug: 'FrokenLarssonHandelsbod', name: 'Fröken Larsson Vintage, Antikt & Secondhand' }, // 5 ev i juli, 1 synliga
    { slug: 'billy.affelin', name: 'Fiskeevent och Fisketävlingar(i samarbete med Sfk Westrogothia)' }, // 5 ev i juli, 1 synliga
    { slug: 'emelie.lagerstrom', name: 'Dansa med Emelie' }, // 5 ev i juli, 1 synliga
    { slug: 'dancetogether.se', name: 'Dance Together', city: 'Eskilstuna' }, // 5 ev i juli, 8 synliga
    { slug: 'CoderDojoLund', name: 'CoderDojo Lund', city: 'Lund' }, // 5 ev i juli, 2 synliga
    { slug: 'BlaKaktus', name: 'Bluesföreningen Blå Kaktus' }, // 5 ev i juli, 8 synliga
    { slug: 'annkiochklas', name: 'Annki & Klas' }, // 5 ev i juli, 3 synliga
    { slug: 'backa.teater', name: 'Backa Teater' }, // 5 ev i juli, 3 synliga
    { slug: 'amplifiedvast', name: 'Amplified Väst', city: 'Borås' }, // 5 ev i juli, 2 synliga
    { slug: 'angustheultimatetribute', name: 'Angus - The Ultimate Tribute', city: 'Borlänge' }, // 5 ev i juli, 8 synliga
    { slug: 'backayardbeats', name: 'Back a Yard Beats', city: 'Stockholm' }, // 5 ev i juli, 3 synliga
    { slug: 'abfmalmo', name: 'ABF Malmö' }, // 5 ev i juli, 8 synliga
    { slug: 'naturumSkrylle', name: 'naturum Skrylle' }, // 4 ev i juli, 1 synliga
    { slug: 'yogaheart.nu', name: 'Yogaheart' }, // 4 ev i juli, 2 synliga
    { slug: 'YogaZonBorgholm', name: 'YogaZon' }, // 4 ev i juli, 1 synliga
    { slug: 'vasterascity', name: 'Västerås City', city: 'Västerås' }, // 4 ev i juli, 8 synliga
    { slug: 'yoga121.se', name: 'Yoga 121', city: 'Hudiksvall' }, // 4 ev i juli, 1 synliga
    { slug: 'afrosvenskarnasforum', name: 'Ubuntu Malmö Filmfestival' }, // 4 ev i juli, 2 synliga
    { slug: 'NattklubbTradgarn', name: 'Trädgår\'n Nattklubb' }, // 4 ev i juli, 6 synliga
    { slug: 'swingum400', name: 'Swingum' }, // 4 ev i juli, 4 synliga
    { slug: 'stadshallen', name: 'Stadshallen', city: 'Lund' }, // 4 ev i juli, 6 synliga
    { slug: 'spacerumforskapande', name: 'Space - Rum för skapande', city: 'Visby' }, // 4 ev i juli, 1 synliga
    { slug: 'SpangaHockey', name: 'Spånga Hockey' }, // 4 ev i juli, 3 synliga
    { slug: 'sollentunakommun', name: 'Sollentuna kommun' }, // 4 ev i juli, 2 synliga
    { slug: 'royal.roland.5623', name: 'SoundTrack Roland' }, // 4 ev i juli, 2 synliga
    { slug: 'skovdeyogacentrum', name: 'Skövde YogaCentrum', city: 'Skövde' }, // 4 ev i juli, 3 synliga
    { slug: 'skanskabyggvaror', name: 'Skånska Byggvaror', city: 'Göteborg' }, // 4 ev i juli, 8 synliga
    { slug: 'skovdeaik', name: 'Skövde AIK', city: 'Skövde' }, // 4 ev i juli, 1 synliga
    { slug: 'SkolsimmarnaIK', name: 'Skolsimmarna IK' }, // 4 ev i juli, 3 synliga
    { slug: 'SensusOstersund', name: 'Sensus Östersund' }, // 4 ev i juli, 7 synliga
    { slug: 'spkroslagssektionen', name: 'SPK Svenska Pudelklubbens Roslagssektion', city: 'Norrtälje' }, // 4 ev i juli, 4 synliga
    { slug: 'reumatikerforeningenlinkoping', name: 'Reumatikerföreningen Linköping', city: 'Linköping' }, // 4 ev i juli, 2 synliga
    { slug: 'kavlingeoldtimespub', name: 'Old Times Pub' }, // 4 ev i juli, 5 synliga
    { slug: 'halloikaraoke', name: 'Oslostandup.no' }, // 4 ev i juli, 4 synliga
    { slug: 'Nostalgiklubben', name: 'Nostalgiklubben' }, // 4 ev i juli, 6 synliga
    { slug: 'NorrlandTulpaner', name: 'Norrlands Tulpan Trädgård' }, // 4 ev i juli, 3 synliga
    { slug: 'nordicsociety.org', name: 'Nordic society', city: 'Stockholm' }, // 4 ev i juli, 3 synliga
    { slug: 'musikisydmalmo', name: 'Musik i Syd Malmö' }, // 4 ev i juli, 4 synliga
    { slug: 'malmostad', name: 'Malmö stad' }, // 4 ev i juli, 1 synliga
    { slug: 'Motorcykelentusiasterna', name: 'MCE - motorcykelentusiasterna' }, // 4 ev i juli, 5 synliga
    { slug: 'mats.fuchs.9', name: 'Mats Fuchs' }, // 4 ev i juli, 1 synliga
    { slug: 'lyckselemusikoteater', name: 'Lycksele Musik & Teaterförening-en del av Riksteatern', city: 'Lycksele' }, // 4 ev i juli, 3 synliga
    { slug: 'LBSDK', name: 'Luleå Bugg och Swing Dansklubb' }, // 4 ev i juli, 7 synliga
    { slug: 'lommaflotten', name: 'LommaFlotten' }, // 4 ev i juli, 2 synliga
    { slug: 'konsertkongress', name: 'Linköping Konsert & Kongress', city: 'Linköping' }, // 4 ev i juli, 8 synliga
    { slug: 'Kulturhjaltarna', name: 'Kulturhjältarna' }, // 4 ev i juli, 8 synliga
    { slug: 'gallivare.se', name: 'Kulturfest', city: 'Gällivare' }, // 4 ev i juli, 8 synliga
    { slug: 'konsertpuls', name: 'KonsertPuls' }, // 4 ev i juli, 3 synliga
    { slug: 'swedbanksagarstiftelsesoderhamn', name: 'Kulturen Söderhamn', city: 'Söderhamn' }, // 4 ev i juli, 3 synliga
    { slug: 'klostretiystad', name: 'Klostret i Ystad', city: 'Ystad' }, // 4 ev i juli, 4 synliga
    { slug: 'jonkopingcity', name: 'Jönköping City', city: 'Jönköping' }, // 4 ev i juli, 2 synliga
    { slug: 'harnosandsmusiksallskap', name: 'Härnösands Musiksällskap' }, // 4 ev i juli, 3 synliga
    { slug: 'IFKKristianstad', name: 'IFK Kristianstad', city: 'Kristianstad' }, // 4 ev i juli, 1 synliga
    { slug: 'ginanykvist', name: 'Hojkompisar Stockholm med omnejd', city: 'Stockholm' }, // 4 ev i juli, 8 synliga
    { slug: 'helsingborgcity', name: 'HBG City' }, // 4 ev i juli, 5 synliga
    { slug: 'gamlahalmstad', name: 'Gamla Halmstad', city: 'Halmstad' }, // 4 ev i juli, 4 synliga
    { slug: 'gnestabokdagar', name: 'Gnesta Bokdagar' }, // 4 ev i juli, 8 synliga
    { slug: 'DocLoungeMalmo', name: 'Doc Lounge Malmö' }, // 4 ev i juli, 5 synliga
    { slug: 'djquizmedslimvic', name: 'DJ QUIZ med SLIM VIC', city: 'Gävle' }, // 4 ev i juli, 2 synliga
    { slug: 'bibliotekenilaholm', name: 'Biblioteken i Laholm', city: 'Laholm' }, // 4 ev i juli, 6 synliga
    { slug: 'BibliotekeniKalmarkommun', name: 'Biblioteken i Kalmar kommun', city: 'Kalmar' }, // 4 ev i juli, 8 synliga
    { slug: 'bergsakers', name: 'Bergsåker', city: 'Sundsvall' }, // 4 ev i juli, 3 synliga
    { slug: 'befreenow.se', name: 'Befreenow' }, // 4 ev i juli, 6 synliga
    { slug: 'avtrycktjorn', name: 'Avtryck Tjörn 9-11 oktober 2026' }, // 4 ev i juli, 8 synliga
    { slug: 'atalantegbg', name: 'Atalante' }, // 4 ev i juli, 2 synliga
    { slug: 'alltidtjorn', name: 'Alltid Tjörn' }, // 4 ev i juli, 4 synliga
    { slug: 'alingsaskulturhus', name: 'Alingsås kulturhus', city: 'Alingsås' }, // 4 ev i juli, 2 synliga
    { slug: 'alexhermanssonshow', name: 'Alex Hermansson', city: 'Lund' }, // 4 ev i juli, 8 synliga
    { slug: 'ungdomsgardentimra', name: 'Aktivitetshuset Pangea' }, // 4 ev i juli, 6 synliga
    { slug: 'adasteater', name: 'ADAS teater', city: 'Göteborg' }, // 4 ev i juli, 2 synliga
    { slug: 'q.barsundsvall', name: 'q.bar Sundsvall', city: 'Sundsvall' }, // 3 ev i juli, 7 synliga
    { slug: 'StreetRollerHockeyLeague', name: 'https://www.facebook.com/share/g/' }, // 3 ev i juli, 1 synliga
    { slug: 'winterviken', name: 'Winterviken', city: 'Stockholm' }, // 3 ev i juli, 2 synliga
    { slug: 'Vikarvet', name: 'Vikarvet Kulturhistoriskt Sällskap' }, // 3 ev i juli, 1 synliga
    { slug: 'valbokopcentrum', name: 'Valbo köpcentrum' }, // 3 ev i juli, 2 synliga
    { slug: 'uppsalakammarorkester', name: 'Uppsala Kammarorkester', city: 'Uppsala' }, // 3 ev i juli, 8 synliga
    { slug: 'Upplandsmuseet', name: 'Upplandsmuseet', city: 'Uppsala' }, // 3 ev i juli, 8 synliga
    { slug: 'tangojamt', name: 'TangoJamt' }, // 3 ev i juli, 3 synliga
    { slug: 'meraloppis', name: 'Ulf Andersson' }, // 3 ev i juli, 2 synliga
    { slug: 'tangovarberg', name: 'Tango Varberg', city: 'Varberg' }, // 3 ev i juli, 3 synliga
    { slug: 'stenegardjarvso', name: 'Stenegård i Järvsö' }, // 3 ev i juli, 2 synliga
    { slug: 'studiomalinfredrika', name: 'Studio Malin Fredrika', city: 'Kristinehamn' }, // 3 ev i juli, 1 synliga
    { slug: 'stalletvarldensmusik', name: 'Stallet - Världens Musik', city: 'Stockholm' }, // 3 ev i juli, 8 synliga
    { slug: 'spiritofmansweden', name: 'Spirit of Man' }, // 3 ev i juli, 1 synliga
    { slug: 'SmalandsVillan', name: 'SmålandsVillan', city: 'Visby' }, // 3 ev i juli, 3 synliga
    { slug: 'SoulRelax.Motala', name: 'SoulRelax', city: 'Motala' }, // 3 ev i juli, 3 synliga
    { slug: 'skarahf', name: 'Skara HF' }, // 3 ev i juli, 8 synliga
    { slug: 'kristina.blad', name: 'SHETLAND MITT' }, // 3 ev i juli, 8 synliga
    { slug: 'rimboprastgard', name: 'Rimbo Prästgård' }, // 3 ev i juli, 3 synliga
    { slug: 'rfsisuvn', name: 'RF - SISU Västernorrland', city: 'Härnösand' }, // 3 ev i juli, 8 synliga
    { slug: 'pinkprogramming', name: 'Pink Programming' }, // 3 ev i juli, 8 synliga
    { slug: 'palladiummalmo1', name: 'Palladium (Malmö)' }, // 3 ev i juli, 8 synliga
    { slug: 'pifdam', name: 'PIF Damfotboll' }, // 3 ev i juli, 8 synliga
    { slug: 'nordboetnorrkoping', name: 'Nördboet', city: 'Norrköping' }, // 3 ev i juli, 2 synliga
    { slug: 'NordiskaAkvarellmuseet', name: 'Nordiska Akvarellmuseet' }, // 3 ev i juli, 8 synliga
    { slug: 'naturumblekinge', name: 'Naturum Blekinge', city: 'Ronneby' }, // 3 ev i juli, 2 synliga
    { slug: 'naturskyddsforeningen.vanersborg', name: 'Naturskyddsföreningen Vänersborg' }, // 3 ev i juli, 5 synliga
    { slug: 'nkvillan.nyk', name: 'NK-villan', city: 'Nyköping' }, // 3 ev i juli, 1 synliga
    { slug: 'MonsterasHandel', name: 'Mönsterås Handel', city: 'Kalmar' }, // 3 ev i juli, 2 synliga
    { slug: 'MotalaBasket', name: 'Motala Basket - W72', city: 'Motala' }, // 3 ev i juli, 3 synliga
    { slug: 'mjolbykommun', name: 'Mjölby kommun', city: 'Mjölby' }, // 3 ev i juli, 2 synliga
    { slug: 'MalmoLiveKonserthus', name: 'Malmö Live Konserthus' }, // 3 ev i juli, 2 synliga
    { slug: 'lidingostadnaringsliv', name: 'Lidingö stad näringsliv' }, // 3 ev i juli, 3 synliga
    { slug: 'liverestaurangen', name: 'Luleå Energi Arena' }, // 3 ev i juli, 1 synliga
    { slug: 'theshipchristchurch', name: 'Laughing Bellys' }, // 3 ev i juli, 8 synliga
    { slug: 'lassewinnerback', name: 'Lars Winnerbäck', city: 'Eskilstuna' }, // 3 ev i juli, 8 synliga
    { slug: 'KFKretsen', name: 'Kulturföreningen Kretsen' }, // 3 ev i juli, 3 synliga
    { slug: 'konstframjandet.skane', name: 'Konstfrämjandet Skåne' }, // 3 ev i juli, 5 synliga
    { slug: 'karlstadskommun', name: 'Karlstads kommun', city: 'Karlstad' }, // 3 ev i juli, 1 synliga
    { slug: 'jamtlimuseum', name: 'Jamtli' }, // 3 ev i juli, 6 synliga
    { slug: 'michael.haggmark.1', name: 'JLS Jämtlands Lokalhistoriker och Släktforskare' }, // 3 ev i juli, 3 synliga
    { slug: 'boltic', name: 'IF Boltic', city: 'Karlstad' }, // 3 ev i juli, 1 synliga
    { slug: 'harnosandfhsk', name: 'Härnösands folkhögskola' }, // 3 ev i juli, 6 synliga
    { slug: 'huddingeparkrun', name: 'Huddinge Parkrun' }, // 3 ev i juli, 8 synliga
    { slug: 'borgmastarvilla', name: 'Hotell Humbla', city: 'Sölvesborg' }, // 3 ev i juli, 2 synliga
    { slug: 'hedemorafolketspark', name: 'Hedemora Folkets Park' }, // 3 ev i juli, 8 synliga
    { slug: 'HagarMalinHellkvistSellen', name: 'Hagar Malin Hellkvist Sellèn' }, // 3 ev i juli, 1 synliga
    { slug: 'hothousejazz.malmo', name: 'HOT HOUSE JAZZ MALMÖ', city: 'Malmö' }, // 3 ev i juli, 4 synliga
    { slug: 'hcamarathon', name: 'HCA Marathon' }, // 3 ev i juli, 4 synliga
    { slug: 'gallivarekommunsfolkbibliotek', name: 'Gällivare kommuns folkbibliotek', city: 'Gällivare' }, // 3 ev i juli, 3 synliga
    { slug: 'gavlebibliotek', name: 'Gävle bibliotek', city: 'Gävle' }, // 3 ev i juli, 8 synliga
    { slug: 'Glimmingehus', name: 'Glimmingehus' }, // 3 ev i juli, 2 synliga
    { slug: 'foreningensm', name: 'Föreningen Söderhamns Museum', city: 'Söderhamn' }, // 3 ev i juli, 2 synliga
    { slug: 'fhuddevalla', name: 'Folkets Hus Uddevalla', city: 'Uddevalla' }, // 3 ev i juli, 5 synliga
    { slug: 'eyragarden', name: 'Eyragården, Kävlinge Kommun den onsdag, oktober 7 2026' }, // 3 ev i juli, 5 synliga
    { slug: 'europadirektvasternorrland', name: 'Europa Direkt Västernorrland' }, // 3 ev i juli, 1 synliga
    { slug: 'essenseikiruna', name: 'Essense - Helhetscenter', city: 'Kiruna' }, // 3 ev i juli, 1 synliga
    { slug: 'Eslovsstadsbibliotek', name: 'Eslövs stadsbibliotek', city: 'Eslöv' }, // 3 ev i juli, 4 synliga
    { slug: 'dansinordnya', name: 'Dans i Nord nya' }, // 3 ev i juli, 6 synliga
    { slug: 'clarionsundsvall', name: 'Clarion Hotel Sundsvall', city: 'Sundsvall' }, // 3 ev i juli, 2 synliga
    { slug: 'cirkusmuseet', name: 'Cirkusmuseet' }, // 3 ev i juli, 2 synliga
    { slug: 'carliahotelresort', name: 'Carlia Hotel & Resort', city: 'Uddevalla' }, // 3 ev i juli, 3 synliga
    { slug: 'boca.vasteras', name: 'Boca Västerås', city: 'Västerås' }, // 3 ev i juli, 2 synliga
    { slug: 'biokontrastiggesund', name: 'Bio Kontrast - Folkets Hus Iggesund' }, // 3 ev i juli, 1 synliga
    { slug: 'nordenkarlshamnsolvesborg', name: 'Bellevueparken Karlshamn', city: 'Karlshamn' }, // 3 ev i juli, 8 synliga
    { slug: 'BarnOchUngdomskulturTjornsKommun', name: 'Barn- och ungdomskultur Tjörns kommun' }, // 3 ev i juli, 3 synliga
    { slug: 'avensbylapland', name: 'Avens by Nature / Västerås Reiki Center', city: 'Västerås' }, // 3 ev i juli, 4 synliga
    { slug: 'annikaelinderoth', name: 'Annika E Linderoth', city: 'Lund' }, // 3 ev i juli, 7 synliga
    { slug: 'allmannasangenvisby', name: 'Allmänna Sången Visby', city: 'Visby' }, // 3 ev i juli, 5 synliga
    { slug: 'AlingsasHK', name: 'Alingsås HK', city: 'Alingsås' }, // 3 ev i juli, 2 synliga
    { slug: 'harkekonstcentrum', name: 'Ahlbergshallen' }, // 3 ev i juli, 2 synliga
    { slug: 'absaloncph', name: 'Absalon' }, // 3 ev i juli, 8 synliga
    { slug: 'ovrehalsinglandshemslojdsforening', name: 'Övre Hälsinglands hemslöjdsförening', city: 'Hudiksvall' }, // 2 ev i juli, 2 synliga
    { slug: 'ostgotamusiken', name: 'Östgötamusiken', city: 'Linköping' }, // 2 ev i juli, 8 synliga
    { slug: 'ystadicentrum', name: 'Ystad i centrum', city: 'Ystad' }, // 2 ev i juli, 2 synliga
    { slug: 'yogaskolan.karlstad', name: 'Yogaskolan Karlstad', city: 'Karlstad' }, // 2 ev i juli, 7 synliga
    { slug: 'varnamocity', name: 'Värnamo City' }, // 2 ev i juli, 2 synliga
    { slug: 'VisbyRoma', name: 'Visby Roma Hockey', city: 'Visby' }, // 2 ev i juli, 8 synliga
    { slug: 'villalidkopingbk', name: 'Villa Lidköping BK', city: 'Lidköping' }, // 2 ev i juli, 2 synliga
    { slug: 'gunnesgard', name: 'Vikingagården Gunnes gård' }, // 2 ev i juli, 2 synliga
    { slug: 'varbergsstadshotellochasiaspa', name: 'Varbergs Stadshotell och Asia Spa', city: 'Varberg' }, // 2 ev i juli, 4 synliga
    { slug: 'UpplevSkovde', name: 'Upplev Skövde', city: 'Skövde' }, // 2 ev i juli, 2 synliga
    { slug: 'ungscenost', name: 'Ung Scen Öst' }, // 2 ev i juli, 1 synliga
    { slug: 'umeakommun', name: 'Umeå kommun' }, // 2 ev i juli, 1 synliga
    { slug: 'umeadansimperium', name: 'Umeå Dansimperium' }, // 2 ev i juli, 8 synliga
    { slug: 'uddevallahem', name: 'Uddevallahem', city: 'Uddevalla' }, // 2 ev i juli, 8 synliga
    { slug: 'uddevalla.riksteaterforening', name: 'Uddevalla Riksteaterförening', city: 'Uddevalla' }, // 2 ev i juli, 1 synliga
    { slug: 'TormekSharpeningInnovation', name: 'Tormek', city: 'Lindesberg' }, // 2 ev i juli, 2 synliga
    { slug: 'kulturochteater', name: 'Tjörns kultur- och teaterförening' }, // 2 ev i juli, 3 synliga
    { slug: 'timraik.se', name: 'Timrå IK' }, // 2 ev i juli, 8 synliga
    { slug: 'TibroRF', name: 'Tibro Ryttarförening' }, // 2 ev i juli, 8 synliga
    { slug: 'tillsammansforkumla', name: 'Tillsammans för Kumla' }, // 2 ev i juli, 8 synliga
    { slug: 'thekaliberroom', name: 'The Kaliber Room' }, // 2 ev i juli, 8 synliga
    { slug: 'tangosundsvall', name: 'TangoSundsvall', city: 'Sundsvall' }, // 2 ev i juli, 2 synliga
    { slug: 'SoderhamnsKonstforening', name: 'Söderhamns Konstförening', city: 'Söderhamn' }, // 2 ev i juli, 4 synliga
    { slug: 'syfestivalen', name: 'Sy- & Hantverksfestivalen - mässan för kreativa sinnen' }, // 2 ev i juli, 1 synliga
    { slug: 'sverigesradio', name: 'Sveriges Radio' }, // 2 ev i juli, 8 synliga
    { slug: 'sundsvallskommun', name: 'Sundsvalls kommun' }, // 2 ev i juli, 8 synliga
    { slug: 'Studentafton', name: 'Studentafton', city: 'Lund' }, // 2 ev i juli, 1 synliga
    { slug: 'stjarnkvallar', name: 'Stjärnkvällar' }, // 2 ev i juli, 1 synliga
    { slug: 'stenhusetgille', name: 'Stenhuset' }, // 2 ev i juli, 7 synliga
    { slug: 'skovdekulturhus', name: 'Skövde Kulturhus', city: 'Skövde' }, // 2 ev i juli, 8 synliga
    { slug: 'skelleftea', name: 'Skellefteå kommun' }, // 2 ev i juli, 8 synliga
    { slug: 'skansklive', name: 'Skånsk Live', city: 'Landskrona' }, // 2 ev i juli, 2 synliga
    { slug: 'skansen', name: 'Skansen', city: 'Stockholm' }, // 2 ev i juli, 1 synliga
    { slug: 'Siggenfriends', name: 'Sigge n Friends' }, // 2 ev i juli, 8 synliga
    { slug: 'selangerskyrka', name: 'Selångers Kyrka', city: 'Sundsvall' }, // 2 ev i juli, 8 synliga
    { slug: 'SalemsBibliotek', name: 'Salems bibliotek' }, // 2 ev i juli, 6 synliga
    { slug: 'bollnasbio', name: 'Röda Kvarn Bollnäs' }, // 2 ev i juli, 4 synliga
    { slug: 'RalingenBibliotek', name: 'Rælingen bibliotek' }, // 2 ev i juli, 7 synliga
    { slug: 'rushentlive', name: 'Rush Ent.', city: 'Stockholm' }, // 2 ev i juli, 8 synliga
    { slug: 'Rockhyttan', name: 'Rockhyttan' }, // 2 ev i juli, 1 synliga
    { slug: 'ringstromsrestaurang', name: 'Ringströms', city: 'Alingsås' }, // 2 ev i juli, 1 synliga
    { slug: 'RAWcomedyclub', name: 'RAW comedy club' }, // 2 ev i juli, 8 synliga
    { slug: 'RadissonBluGothenburg', name: 'Radisson Blu Scandinavia Hotel, Gothenburg (Göteborg)', city: 'Göteborg' }, // 2 ev i juli, 4 synliga
    { slug: 'PitebygdensMusikforbund', name: 'Pitebygdens Musikförbund' }, // 2 ev i juli, 1 synliga
    { slug: 'petra.revenue', name: 'Petra Revenue', city: 'Göteborg' }, // 2 ev i juli, 2 synliga
    { slug: 'naringslivmonsteraskommun', name: 'Näringsliv Mönsterås kommun' }, // 2 ev i juli, 1 synliga
    { slug: 'norrkoping.symphony', name: 'Norrköpings Symfoniorkester', city: 'Linköping' }, // 2 ev i juli, 7 synliga
    { slug: 'Nightcruiserskristinehamn', name: 'Nightcruisers Kristinehamn', city: 'Kristinehamn' }, // 2 ev i juli, 1 synliga
    { slug: 'Myresjohus', name: 'Myresjöhus' }, // 2 ev i juli, 3 synliga
    { slug: 'NefertitiGBG', name: 'Nefertiti' }, // 2 ev i juli, 8 synliga
    { slug: 'monument031', name: 'Monument 031' }, // 2 ev i juli, 8 synliga
    { slug: 'M.Dans.F', name: 'Mer Dans åt Folket', city: 'Eskilstuna' }, // 2 ev i juli, 1 synliga
    { slug: 'statarmuseet', name: 'Malmö Stad' }, // 2 ev i juli, 1 synliga
    { slug: 'mashupberlin', name: 'Mash-Up - Multigender / Multiworld' }, // 2 ev i juli, 8 synliga
    { slug: 'MariaLundqvistOffentlig', name: 'Maria Lundqvist' }, // 2 ev i juli, 8 synliga
    { slug: 'crimecityrollers', name: 'Malmö Roller Derby - Crime City Rollers' }, // 2 ev i juli, 4 synliga
    { slug: 'malmojazzstory', name: 'Malmö Jazz Story' }, // 2 ev i juli, 7 synliga
    { slug: 'malmodanceweek', name: 'Malmö Dance Week' }, // 2 ev i juli, 8 synliga
    { slug: 'MahalayaCenter', name: 'Mahalaya - Center for Holistic Growth' }, // 2 ev i juli, 5 synliga
    { slug: 'Lollipopsoderhamn', name: 'Lollipop Music Bar & Diner', city: 'Söderhamn' }, // 2 ev i juli, 8 synliga
    { slug: 'louisdegeernorrkoping', name: 'Louis De Geer', city: 'Norrköping' }, // 2 ev i juli, 8 synliga
    { slug: 'guideklubben83', name: 'Linköpings Guideklubb' }, // 2 ev i juli, 8 synliga
    { slug: 'LandskronaBK', name: 'Landskrona Brukshundklubb', city: 'Landskrona' }, // 2 ev i juli, 3 synliga
    { slug: 'Dansvirvlar', name: 'Kungälv, Västra Götalands län' }, // 2 ev i juli, 8 synliga
    { slug: 'kulturkollektivet.beardmen', name: 'Kulturkollektivet Beardmen' }, // 2 ev i juli, 1 synliga
    { slug: 'Kulturhusetibergen', name: 'Kulturhuset i Bergen' }, // 2 ev i juli, 7 synliga
    { slug: 'kulturjkpgskommun', name: 'Kultur Jönköpings kommun' }, // 2 ev i juli, 8 synliga
    { slug: 'klubbkrinolin', name: 'Krinolin - kammarmusikklubben' }, // 2 ev i juli, 3 synliga
    { slug: 'KonserthusetStockholm', name: 'Konserthuset Stockholm', city: 'Stockholm' }, // 2 ev i juli, 8 synliga
    { slug: 'kulturonoje', name: 'Kim Kultur&Nöje', city: 'Norrtälje' }, // 2 ev i juli, 2 synliga
    { slug: 'KDMetalcoholics', name: 'Karlstad Metalcoholics', city: 'Karlstad' }, // 2 ev i juli, 6 synliga
    { slug: 'fastningsmuseet', name: 'Karlsborgs Fästningsmuseum' }, // 2 ev i juli, 5 synliga
    { slug: 'kalixkommun', name: 'Kalix kommun' }, // 2 ev i juli, 6 synliga
    { slug: 'KLUBBDODSWE', name: 'KLUBB DÖD' }, // 2 ev i juli, 8 synliga
    { slug: 'kraniosakralterapihastochmanniska', name: 'Jennies HelhetsHälsa' }, // 2 ev i juli, 1 synliga
    { slug: 'municipiodefaro', name: 'Jardim da Alameda' }, // 2 ev i juli, 8 synliga
    { slug: 'IntimanTeatern', name: 'Intiman', city: 'Stockholm' }, // 2 ev i juli, 2 synliga
    { slug: 'homefreevocalband', name: 'Home Free' }, // 2 ev i juli, 8 synliga
    { slug: 'gavlesymfoniorkester', name: 'Gävle Symfoniorkester', city: 'Gävle' }, // 2 ev i juli, 8 synliga
    { slug: 'grandsamarkand', name: 'Grand Samarkand' }, // 2 ev i juli, 2 synliga
    { slug: 'GamlaLanthandeln', name: 'Gamla Lanthandeln' }, // 2 ev i juli, 8 synliga
    { slug: 'StudieframjandetNorrbotten', name: 'GROP' }, // 2 ev i juli, 5 synliga
    { slug: 'FylgjaHelandeHarmoni', name: 'Fylgja - helande harmoni', city: 'Sundsvall' }, // 2 ev i juli, 7 synliga
    { slug: 'fredheimarena', name: 'Fredheim Arena' }, // 2 ev i juli, 1 synliga
    { slug: 'fernandascafeet', name: 'Fernandas Konditori & Bageri', city: 'Staffanstorp' }, // 2 ev i juli, 1 synliga
    { slug: 'FargegatenStavanger', name: 'Fargegaten' }, // 2 ev i juli, 8 synliga
    { slug: 'FyrisComedy', name: 'FYRIS Comedy' }, // 2 ev i juli, 4 synliga
    { slug: 'DestinationHassleholm', name: 'Destination Hässleholm', city: 'Hässleholm' }, // 2 ev i juli, 4 synliga
    { slug: 'dansnu', name: 'Dans Nu Uddevalla', city: 'Uddevalla' }, // 2 ev i juli, 1 synliga
    { slug: 'borlangekommun', name: 'Dalarnas familjehemsresurs' }, // 2 ev i juli, 1 synliga
    { slug: 'delsbohembygdsforening', name: 'Delsbo Forngård' }, // 2 ev i juli, 3 synliga
    { slug: 'couleurkonsthandel', name: 'Couleur Konsthandel', city: 'Stockholm' }, // 2 ev i juli, 2 synliga
    { slug: 'cnemanorrkoping', name: 'Cnema', city: 'Norrköping' }, // 2 ev i juli, 8 synliga
    { slug: 'centralastadsrum', name: 'Centrala Stadsrum' }, // 2 ev i juli, 3 synliga
    { slug: 'boulognerskogenparkrun', name: 'Boulognerskogen parkrun, Gävle', city: 'Gävle' }, // 2 ev i juli, 2 synliga
    { slug: 'MuseetBollnasKonsthall', name: 'Bollnäs Museum & Konsthall' }, // 2 ev i juli, 2 synliga
    { slug: 'bollnasdansar', name: 'Bollnäs Dansar' }, // 2 ev i juli, 8 synliga
    { slug: 'billstromska.fhsk', name: 'Billströmska folkhögskolan' }, // 2 ev i juli, 3 synliga
    { slug: 'autismblekinge', name: 'Autism Blekinge', city: 'Olofström' }, // 2 ev i juli, 2 synliga
    { slug: 'beehivestationfoodcarts', name: 'BeeHive Station Food Pod' }, // 2 ev i juli, 3 synliga
    { slug: 'arttourssthlm', name: 'Art Tours Sthlm' }, // 2 ev i juli, 3 synliga
    { slug: 'arenahagmyren', name: 'Arena Hagmyren', city: 'Hudiksvall' }, // 2 ev i juli, 2 synliga
    { slug: 'allthingslivenorway', name: 'All Things Live Norway' }, // 2 ev i juli, 8 synliga
    { slug: 'abf.stockholm', name: 'ABF Stockholm', city: 'Stockholm' }, // 2 ev i juli, 7 synliga
];
