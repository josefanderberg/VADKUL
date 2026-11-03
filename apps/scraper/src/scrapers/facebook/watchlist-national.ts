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
    { slug: 'eventkalix', name: 'Kalix Kommun', city: 'Luleå' }, // 74 ev i juli, 8 synliga
    { slug: 'vaxjobibliotek', name: 'Växjö bibliotek' }, // 61 ev i juli, 8 synliga
    { slug: 'gkmmsplit', name: 'Gradska knjiznica Marka Marulica Split' }, // 59 ev i juli, 8 synliga
    { slug: 'StudieforbundetVuxenskolanVast', name: 'Studieförbundet Vuxenskolan Väst', city: 'Uddevalla' }, // 44 ev i juli, 7 synliga
    { slug: 'livenationswe', name: 'Live Nation Sweden', city: 'Stockholm' }, // 37 ev i juli, 8 synliga
    { slug: 'kulturaktiebolaget', name: 'Kulturaktiebolaget', city: 'Karlstad' }, // 36 ev i juli, 8 synliga
    { slug: 'vastmanlandslansmuseum', name: 'Västmanlands läns museum', city: 'Västerås' }, // 35 ev i juli, 8 synliga
    { slug: 'planbmalmo', name: 'Plan B - malmö' }, // 32 ev i juli, 8 synliga
    { slug: 'Musikhuset', name: 'Musikhuset Gävle', city: 'Gävle' }, // 31 ev i juli, 8 synliga
    { slug: 'Debasersthlm', name: 'Debaser', city: 'Stockholm' }, // 31 ev i juli, 6 synliga
    { slug: 'rodakvarnhbg', name: 'Röda Kvarn Helsingborg', city: 'Helsingborg' }, // 30 ev i juli, 8 synliga
    { slug: 'rockefelleroslo', name: 'Rockefeller / John Dee / Sentrum Scene' }, // 29 ev i juli, 7 synliga
    { slug: 'Scalateatern', name: 'Scalateatern i Karlstad', city: 'Karlstad' }, // 28 ev i juli, 8 synliga
    { slug: 'KulturcentrumSandviken', name: 'Kulturcentrum Sandviken', city: 'Sandviken' }, // 28 ev i juli, 5 synliga
    { slug: 'hundesenteretitrondheim', name: 'Hundesenteret' }, // 26 ev i juli, 8 synliga
    { slug: 'Honggymnastikforening', name: 'Høng GF' }, // 25 ev i juli, 8 synliga
    { slug: 'Ostgota', name: 'Östgöta Nation', city: 'Lund' }, // 25 ev i juli, 8 synliga
    { slug: 'svdalsland', name: 'Studieförbundet Vuxenskolan i Dalsland' }, // 24 ev i juli, 8 synliga
    { slug: 'Megascope', name: 'Megascope' }, // 24 ev i juli, 8 synliga
    { slug: 'Vaxjodyksport', name: 'Växjödyksport', city: 'Växjö' }, // 23 ev i juli, 8 synliga
    { slug: 'stormspakhus', name: 'Storms Pakhus' }, // 23 ev i juli, 6 synliga
    { slug: 'kulturhusetstadsteatern', name: 'Kulturhuset Stadsteatern' }, // 23 ev i juli, 7 synliga
    { slug: 'latinamerikaifokus', name: 'Latinamerika i Fokus' }, // 23 ev i juli, 4 synliga
    { slug: 'hyltebiblioteken', name: 'Hyltebiblioteken' }, // 23 ev i juli, 6 synliga
    { slug: 'Kulturenshus', name: 'Kulturens hus Luleå' }, // 22 ev i juli, 8 synliga
    { slug: 'kramforsbibliotek', name: 'Kramfors bibliotek' }, // 22 ev i juli, 6 synliga
    { slug: 'allthingslivesweden', name: 'All Things Live Sweden', city: 'Landskrona' }, // 22 ev i juli, 5 synliga
    { slug: 'MusikiChristinae', name: 'Musik i Christinae', city: 'Alingsås' }, // 21 ev i juli, 8 synliga
    { slug: 'KonserthusetStockholm', name: 'Konserthuset Stockholm', city: 'Stockholm' }, // 21 ev i juli, 8 synliga
    { slug: 'csnoje.se', name: 'CS Nöje', city: 'Stockholm' }, // 21 ev i juli, 8 synliga
    { slug: 'fkpscorpio', name: 'FKP Scorpio' }, // 21 ev i juli, 8 synliga
    { slug: 'sodertaljestadsscen', name: 'Södertälje stadsscen' }, // 20 ev i juli, 8 synliga
    { slug: 'Smalands', name: 'Smålands Nation', city: 'Lund' }, // 20 ev i juli, 5 synliga
    { slug: 'northeventAB', name: 'Northevent AB', city: 'Karlskrona' }, // 19 ev i juli, 8 synliga
    { slug: 'kalmarnationlund', name: 'Kalmar Nation', city: 'Lund' }, // 19 ev i juli, 6 synliga
    { slug: 'jubelAB', name: 'Jubel', city: 'Göteborg' }, // 19 ev i juli, 8 synliga
    { slug: 'baerumkulturhus', name: 'Bærum Kulturhus' }, // 19 ev i juli, 5 synliga
    { slug: 'vasteraskonserthus', name: 'Västerås Konserthus', city: 'Västerås' }, // 18 ev i juli, 8 synliga
    { slug: 'trinitymusicberlin', name: 'Trinity Music' }, // 18 ev i juli, 8 synliga
    { slug: 'Tangokompaniet', name: 'Tangokompaniet' }, // 18 ev i juli, 8 synliga
    { slug: 'gavlebibliotek', name: 'Gävle bibliotek', city: 'Gävle' }, // 18 ev i juli, 8 synliga
    { slug: 'BorasDansforening', name: 'Borås Dansförening', city: 'Borås' }, // 18 ev i juli, 3 synliga
    { slug: 'svgavleborg', name: 'Studieförbundet Vuxenskolan Gävleborg', city: 'Gävle' }, // 17 ev i juli, 7 synliga
    { slug: 'skogsvargarna', name: 'OK Skogsvargarna' }, // 16 ev i juli, 4 synliga
    { slug: 'vasterasbibliotek', name: 'Västerås bibliotek', city: 'Västerås' }, // 16 ev i juli, 5 synliga
    { slug: 'medborgarskolanjamtland', name: 'Medborgarskolan' }, // 16 ev i juli, 6 synliga
    { slug: 'kollektivetlivetbar', name: 'Kollektivet Livet' }, // 16 ev i juli, 8 synliga
    { slug: 'HarrysStenungsund', name: 'Harrys' }, // 16 ev i juli, 6 synliga
    { slug: 'halmstadsteater', name: 'Halmstads Teater' }, // 16 ev i juli, 8 synliga
    { slug: 'Gummifabriken', name: 'Gummifabriken i Värnamo' }, // 16 ev i juli, 8 synliga
    { slug: 'dalarnasmuseum', name: 'Dalarnas museum', city: 'Falun' }, // 16 ev i juli, 3 synliga
    { slug: 'gotlandsmuseum', name: 'Gotlands Museum', city: 'Visby' }, // 16 ev i juli, 6 synliga
    { slug: 'tingsrydsbibliotekochkultur', name: 'Tingsryds bibliotek och kultur' }, // 15 ev i juli, 5 synliga
    { slug: 'RalingenBibliotek', name: 'Rælingen bibliotek' }, // 15 ev i juli, 8 synliga
    { slug: 'NordiskaAkvarellmuseet', name: 'Nordiska Akvarellmuseet' }, // 15 ev i juli, 4 synliga
    { slug: 'kulturkvarteret', name: 'Kulturkvarteret Kristianstad', city: 'Kristianstad' }, // 15 ev i juli, 6 synliga
    { slug: 'krallentertainment', name: 'Krall Entertainment', city: 'Helsingborg' }, // 15 ev i juli, 8 synliga
    { slug: 'kollektivkrogen', name: 'Kollektivkrogen' }, // 15 ev i juli, 8 synliga
    { slug: 'hedvigeleonora', name: 'Hedvig Eleonora kyrka' }, // 15 ev i juli, 6 synliga
    { slug: 'bergenlive', name: 'Bergen Live' }, // 15 ev i juli, 8 synliga
    { slug: 'vadstenabibliotek', name: 'Vadstena bibliotek' }, // 14 ev i juli, 4 synliga
    { slug: 'uppsalakonsertkongress', name: 'Uppsala Konsert & Kongress', city: 'Uppsala' }, // 14 ev i juli, 8 synliga
    { slug: 'Sjoangen', name: 'Sjöängen i Askersund' }, // 14 ev i juli, 5 synliga
    { slug: 'SundsvallsStadsbibliotek', name: 'Sundsvalls Stadsbibliotek', city: 'Sundsvall' }, // 14 ev i juli, 8 synliga
    { slug: 'malmolive', name: 'Malmö Live' }, // 14 ev i juli, 6 synliga
    { slug: 'LiveEventRadar', name: 'Live Event Radar' }, // 14 ev i juli, 8 synliga
    { slug: 'grandliveab', name: 'Grand Live', city: 'Uppsala' }, // 14 ev i juli, 8 synliga
    { slug: 'cnemanorrkoping', name: 'Cnema', city: 'Norrköping' }, // 14 ev i juli, 6 synliga
    { slug: 'bjorn.carlsson', name: 'Carlsson På Kajen', city: 'Västerås' }, // 14 ev i juli, 8 synliga
    { slug: 'BrassUnit', name: 'BrassUnit', city: 'Lidköping' }, // 14 ev i juli, 8 synliga
    { slug: 'biograffokusjonkoping', name: 'Biograf Fokus Jönköping', city: 'Jönköping' }, // 14 ev i juli, 8 synliga
    { slug: 'bioroy', name: 'Bio Roy' }, // 14 ev i juli, 8 synliga
    { slug: 'bibliotekeniboras', name: 'Biblioteken i Borås', city: 'Borås' }, // 14 ev i juli, 7 synliga
    { slug: 'vadhanderistockholm', name: 'Vad som händer i Stockholm', city: 'Stockholm' }, // 13 ev i juli, 3 synliga
    { slug: 'tranemo.bibliotek', name: 'Tranemo bibliotek' }, // 13 ev i juli, 6 synliga
    { slug: 'rpsb50', name: 'TRENDERs', city: 'Göteborg' }, // 13 ev i juli, 8 synliga
    { slug: 'sigtunastiftelsen', name: 'Sigtunastiftelsen' }, // 13 ev i juli, 6 synliga
    { slug: 'NefertitiGBG', name: 'Nefertiti' }, // 13 ev i juli, 8 synliga
    { slug: 'NalenStockholm', name: 'Nalen', city: 'Stockholm' }, // 13 ev i juli, 6 synliga
    { slug: 'musikvalvetbaggen', name: 'Musikvalvet Baggen' }, // 13 ev i juli, 5 synliga
    { slug: 'magasinetfalun', name: 'Magasinet Falun', city: 'Falun' }, // 13 ev i juli, 8 synliga
    { slug: 'lundchoralfestival.lcf', name: 'Lund Choral Festival', city: 'Lund' }, // 13 ev i juli, 8 synliga
    { slug: 'lerumsbibliotek', name: 'Kultur och bibliotek i Lerum' }, // 13 ev i juli, 6 synliga
    { slug: 'katalinsjazzbar', name: 'Katalins Bakficka', city: 'Uppsala' }, // 13 ev i juli, 8 synliga
    { slug: 'inrenatur', name: 'Inre natur' }, // 13 ev i juli, 6 synliga
    { slug: 'dismitt', name: 'Dis-Mitt', city: 'Gävle' }, // 13 ev i juli, 8 synliga
    { slug: 'varnamobibliotekochkultur', name: 'Värnamo bibliotek och kultur' }, // 12 ev i juli, 8 synliga
    { slug: 'vaniumeasida', name: 'Vän i Umeå' }, // 12 ev i juli, 8 synliga
    { slug: 'TheTivoli', name: 'The Tivoli', city: 'Helsingborg' }, // 12 ev i juli, 8 synliga
    { slug: 'Sundsvallsmuseum', name: 'Sundsvalls museum' }, // 12 ev i juli, 8 synliga
    { slug: 'svkalmarlan', name: 'Studieförbundet Vuxenskolan Kalmar län', city: 'Kalmar' }, // 12 ev i juli, 8 synliga
    { slug: 'SanktJohanneskyrka', name: 'Sankt Johannes kyrka, Malmö' }, // 12 ev i juli, 8 synliga
    { slug: '100046421744875', name: 'Råda Rum' }, // 12 ev i juli, 8 synliga
    { slug: 'planthousehuntersville', name: 'PlantHouse' }, // 12 ev i juli, 8 synliga
    { slug: 'SalemsBibliotek', name: 'Salems bibliotek' }, // 12 ev i juli, 6 synliga
    { slug: 'lundsallhelgonakyrka', name: 'Lunds Allhelgonakyrka' }, // 12 ev i juli, 4 synliga
    { slug: 'Landskronabibliotek', name: 'Landskrona bibliotek', city: 'Landskrona' }, // 12 ev i juli, 8 synliga
    { slug: 'kungligaslotten', name: 'Kungliga Slotten' }, // 12 ev i juli, 6 synliga
    { slug: 'hotelskansenoland', name: 'Hotel Skansen' }, // 12 ev i juli, 8 synliga
    { slug: 'gavlekonserthus', name: 'Gävle Konserthus', city: 'Gävle' }, // 12 ev i juli, 5 synliga
    { slug: 'Hjaltevadshus', name: 'Hjältevadshus', city: 'Gävle' }, // 12 ev i juli, 2 synliga
    { slug: 'Eskilstunastadsbibliotek', name: 'Eskilstuna stadsbibliotek', city: 'Eskilstuna' }, // 12 ev i juli, 8 synliga
    { slug: 'eksjobibliotek', name: 'Eksjö stadsbibliotek' }, // 12 ev i juli, 6 synliga
    { slug: 'musikenshusgbg', name: 'Café Hängmattan' }, // 12 ev i juli, 8 synliga
    { slug: 'litensmula', name: 'Vita Huset - En Liten Smula', city: 'Norrtälje' }, // 11 ev i juli, 8 synliga
    { slug: 'vilhelmina.folketshus.7', name: 'Vilhelmina Folkets Hus' }, // 11 ev i juli, 4 synliga
    { slug: 'toccaentertainment', name: 'Tocca Entertainment', city: 'Falun' }, // 11 ev i juli, 3 synliga
    { slug: 'ThePulsebar2023', name: 'The Pulse' }, // 11 ev i juli, 4 synliga
    { slug: 'TheBruceSpringsteenTribute', name: 'The Bruce Springsteen Tribute - Best of the Boss', city: 'Trollhättan' }, // 11 ev i juli, 8 synliga
    { slug: 'svorebrolan', name: 'Studieförbundet Vuxenskolan Örebro Län', city: 'Lindesberg' }, // 11 ev i juli, 8 synliga
    { slug: 'malmostadsbibliotek', name: 'Stadsbiblioteket i Malmö' }, // 11 ev i juli, 8 synliga
    { slug: 'smalandsuppsala', name: 'Smålands nation', city: 'Uppsala' }, // 11 ev i juli, 4 synliga
    { slug: 'sarakulturhus', name: 'Sara kulturhus' }, // 11 ev i juli, 4 synliga
    { slug: 'medeltidsmuseet', name: 'Medeltidsmuseet', city: 'Stockholm' }, // 11 ev i juli, 8 synliga
    { slug: 'kulturcentrumebeneser', name: 'Kulturcentrum Ebeneser' }, // 11 ev i juli, 8 synliga
    { slug: 'gemenskapikungsor', name: 'Gemenskap i Kungsör' }, // 11 ev i juli, 7 synliga
    { slug: 'ideadrottninghog', name: 'Idé A Drottninghög', city: 'Helsingborg' }, // 11 ev i juli, 8 synliga
    { slug: 'goteborgsstad', name: 'Göteborgs Stad', city: 'Göteborg' }, // 11 ev i juli, 5 synliga
    { slug: 'EncoreSundbyberg', name: 'Encore, Sundbyberg' }, // 11 ev i juli, 8 synliga
    { slug: 'ABFKiruna', name: 'ABF Norr Kiruna', city: 'Kiruna' }, // 11 ev i juli, 8 synliga
    { slug: 'barnbiblioteken', name: 'Barnbiblioteken', city: 'Strängnäs' }, // 11 ev i juli, 7 synliga
    { slug: 'attentionmolndal', name: 'Attention Mölndal' }, // 11 ev i juli, 3 synliga
    { slug: 'anebybibliotek', name: 'Aneby bibliotek' }, // 11 ev i juli, 4 synliga
    { slug: 'vasterascity', name: 'Västerås City', city: 'Västerås' }, // 10 ev i juli, 8 synliga
    { slug: 'vastergotlandsmuseum', name: 'Västergötlands museum' }, // 10 ev i juli, 5 synliga
    { slug: 'umefox', name: 'UmeFox' }, // 10 ev i juli, 5 synliga
    { slug: 'tradgarn', name: 'Trädgår\'n' }, // 10 ev i juli, 8 synliga
    { slug: 'shrekraveofficial', name: 'Shrek Rave' }, // 10 ev i juli, 8 synliga
    { slug: 'stalletvarldensmusik', name: 'Stallet - Världens Musik', city: 'Stockholm' }, // 10 ev i juli, 8 synliga
    { slug: 'NojetKonsert', name: 'Nöjet Konsert AB', city: 'Uppsala' }, // 10 ev i juli, 8 synliga
    { slug: 'monovaxjo', name: 'Mono Växjö' }, // 10 ev i juli, 8 synliga
    { slug: 'LBSDK', name: 'Luleå Bugg och Swing Dansklubb' }, // 10 ev i juli, 8 synliga
    { slug: 'Inkonst3', name: 'Inkonst' }, // 10 ev i juli, 8 synliga
    { slug: 'iggesundsfolkan', name: 'Folkets Hus - Iggesund' }, // 10 ev i juli, 8 synliga
    { slug: 'feverup', name: 'Fever', city: 'Stockholm' }, // 10 ev i juli, 8 synliga
    { slug: 'eskilstunakompaniet', name: 'Eskilstunakompaniet', city: 'Eskilstuna' }, // 10 ev i juli, 8 synliga
    { slug: 'folketsbiomalmo', name: 'Biograf Panora Malmö' }, // 10 ev i juli, 8 synliga
    { slug: 'arbisnkpg', name: 'Arbis' }, // 10 ev i juli, 8 synliga
    { slug: 'alltpascen', name: 'Allt På Scen & Mycke Nöje', city: 'Lund' }, // 10 ev i juli, 4 synliga
    { slug: 'medleymalmo', name: 'medley malmö' }, // 9 ev i juli, 8 synliga
    { slug: 'yogaskolan.karlstad', name: 'Yogaskolan Karlstad', city: 'Karlstad' }, // 9 ev i juli, 7 synliga
    { slug: 'varlokal', name: 'Vår lokal' }, // 9 ev i juli, 7 synliga
    { slug: 'ulrikabeijeryoga', name: 'UB Yoga, Sång & Ceremoni', city: 'Hudiksvall' }, // 9 ev i juli, 7 synliga
    { slug: 'tunapark.se', name: 'Tuna Park', city: 'Eskilstuna' }, // 9 ev i juli, 2 synliga
    { slug: 'Showtic', name: 'Showtic', city: 'Linköping' }, // 9 ev i juli, 6 synliga
    { slug: 'seniortraffen', name: 'Seniorträffen, Oxelösund' }, // 9 ev i juli, 5 synliga
    { slug: 'regionmuseetskane', name: 'Regionmuseet Skåne', city: 'Kristianstad' }, // 9 ev i juli, 4 synliga
    { slug: 'nygatan6', name: 'Nygatan 6' }, // 9 ev i juli, 5 synliga
    { slug: 'norrbottensteatern', name: 'Norrbottensteatern' }, // 9 ev i juli, 7 synliga
    { slug: 'musikidalarna', name: 'Musik i Dalarna', city: 'Falun' }, // 9 ev i juli, 6 synliga
    { slug: 'louisdegeernorrkoping', name: 'Louis De Geer', city: 'Norrköping' }, // 9 ev i juli, 8 synliga
    { slug: 'Kulturhusetibergen', name: 'Kulturhuset i Bergen' }, // 9 ev i juli, 7 synliga
    { slug: 'lassewinnerback', name: 'Lars Winnerbäck', city: 'Eskilstuna' }, // 9 ev i juli, 8 synliga
    { slug: 'konstmuseet', name: 'Konstmuseet', city: 'Skövde' }, // 9 ev i juli, 5 synliga
    { slug: 'kulturhusetbollnas', name: 'Kulturhuset Bollnäs' }, // 9 ev i juli, 8 synliga
    { slug: 'JacyzHotel', name: 'Jacy\'z Hotel & Resort' }, // 9 ev i juli, 5 synliga
    { slug: 'gallivarekommunsfolkbibliotek', name: 'Gällivare kommuns folkbibliotek', city: 'Gällivare' }, // 9 ev i juli, 4 synliga
    { slug: 'hemfranderome', name: 'Hem från Derome', city: 'Landskrona' }, // 9 ev i juli, 8 synliga
    { slug: 'Falkopingsbibliotek', name: 'Falköpings bibliotek' }, // 9 ev i juli, 5 synliga
    { slug: 'falkenbergsstadsteater', name: 'Falkenbergs Stadsteater', city: 'Falkenberg' }, // 9 ev i juli, 8 synliga
    { slug: 'estrad.norr', name: 'Estrad Norr' }, // 9 ev i juli, 4 synliga
    { slug: 'DanshusetDkBuggie', name: 'Dansklubben Buggie i Ulricehamn' }, // 9 ev i juli, 3 synliga
    { slug: 'BibliotekeniJonkoping', name: 'Biblioteken i Jönköping', city: 'Jönköping' }, // 9 ev i juli, 8 synliga
    { slug: 'babblarnalive', name: 'Babblarna på scen', city: 'Jönköping' }, // 9 ev i juli, 4 synliga
    { slug: 'Alergotura', name: 'Alergotura', city: 'Nora' }, // 9 ev i juli, 2 synliga
    { slug: 'karlecafe', name: 'karl-e' }, // 8 ev i juli, 8 synliga
    { slug: 'vastmanlandsteater', name: 'Västmanlands Teater', city: 'Västerås' }, // 8 ev i juli, 4 synliga
    { slug: 'Sormlandsmuseum', name: 'Sörmlands museum', city: 'Nyköping' }, // 8 ev i juli, 7 synliga
    { slug: 'stageway', name: 'Stageway' }, // 8 ev i juli, 6 synliga
    { slug: 'soderhamnsbibblan', name: 'Söderhamns Stadsbibliotek', city: 'Söderhamn' }, // 8 ev i juli, 3 synliga
    { slug: 'stageumea', name: 'Stage Umeå' }, // 8 ev i juli, 8 synliga
    { slug: 'ParaplyProduktion', name: 'Paraply', city: 'Karlskrona' }, // 8 ev i juli, 8 synliga
    { slug: 'oslonye', name: 'Oslo Nye Teater' }, // 8 ev i juli, 7 synliga
    { slug: 'oxiebiblioteket', name: 'Oxiebiblioteket' }, // 8 ev i juli, 6 synliga
    { slug: 'natminkulturhus', name: 'Nationella minoriteters kulturhus' }, // 8 ev i juli, 5 synliga
    { slug: 'monument031', name: 'Monument 031' }, // 8 ev i juli, 8 synliga
    { slug: 'mikespubskovde', name: 'Mikes pub och restaurang', city: 'Skövde' }, // 8 ev i juli, 2 synliga
    { slug: 'lokstallet.skovde', name: 'Lokstallet', city: 'Skövde' }, // 8 ev i juli, 8 synliga
    { slug: 'Bonanderfriskvard', name: 'Lena Bonanders Massage & Friskvård', city: 'Uddevalla' }, // 8 ev i juli, 5 synliga
    { slug: 'kulturhusetmobeln', name: 'Kulturhuset Möbeln' }, // 8 ev i juli, 8 synliga
    { slug: 'kulturiale', name: 'Kultur i Ale' }, // 8 ev i juli, 5 synliga
    { slug: 'kulturhusetkaken', name: 'Kulturhuset Kåken' }, // 8 ev i juli, 8 synliga
    { slug: 'kristianstadsfilmstudio', name: 'Kristianstads Filmstudio', city: 'Kristianstad' }, // 8 ev i juli, 8 synliga
    { slug: 'hjartatshus', name: 'Hjärtats hus', city: 'Jönköping' }, // 8 ev i juli, 7 synliga
    { slug: 'drakenlive', name: 'Draken Live' }, // 8 ev i juli, 5 synliga
    { slug: 'Hedenstedbibliotekerne', name: 'Hedensted Bibliotekerne' }, // 8 ev i juli, 8 synliga
    { slug: 'ckwano1', name: 'CK Wano', city: 'Varberg' }, // 8 ev i juli, 1 synliga
    { slug: 'BorlangeDance', name: 'Borlänge Dance', city: 'Borlänge' }, // 8 ev i juli, 5 synliga
    { slug: 'mountainfilm', name: 'Banff Mountain Film Festival Scandinavia', city: 'Falun' }, // 8 ev i juli, 3 synliga
    { slug: 'AlingsasDansklubb', name: 'Alingsås Dansklubb', city: 'Alingsås' }, // 8 ev i juli, 5 synliga
    { slug: 'ostfoldteater', name: 'Østfold Teater' }, // 7 ev i juli, 8 synliga
    { slug: 'orebro.salsafriends.9', name: 'Örebro Salsafriends' }, // 7 ev i juli, 4 synliga
    { slug: 'WermlandOpera', name: 'Wermland Opera', city: 'Karlstad' }, // 7 ev i juli, 3 synliga
    { slug: 'vaxjokommun', name: 'Växjö kommun' }, // 7 ev i juli, 8 synliga
    { slug: 'vnmuseum', name: 'Västernorrlands museum', city: 'Härnösand' }, // 7 ev i juli, 6 synliga
    { slug: 'trivselhussverige', name: 'Trivselhus', city: 'Staffanstorp' }, // 7 ev i juli, 2 synliga
    { slug: 'tasspalatset.se', name: 'Tasspalatset' }, // 7 ev i juli, 6 synliga
    { slug: 'swinginmotionab', name: 'Swing in motion', city: 'Borås' }, // 7 ev i juli, 7 synliga
    { slug: 'sv.vasternorrland', name: 'Studieförbundet Vuxenskolan Västernorrland', city: 'Sundsvall' }, // 7 ev i juli, 8 synliga
    { slug: 'Storlihytta', name: 'Storlihytta' }, // 7 ev i juli, 8 synliga
    { slug: 'sensusvastrasverige', name: 'Sensus Västra Sverige', city: 'Göteborg' }, // 7 ev i juli, 8 synliga
    { slug: 'reumatikerforeningenlinkoping', name: 'Reumatikerföreningen Linköping', city: 'Linköping' }, // 7 ev i juli, 3 synliga
    { slug: 'molndalsdansskola', name: 'Mölndals Dansskola' }, // 7 ev i juli, 8 synliga
    { slug: 'moriskapaviljongen', name: 'Moriska Paviljongen' }, // 7 ev i juli, 7 synliga
    { slug: 'MariaLundqvistOffentlig', name: 'Maria Lundqvist', city: 'Eskilstuna' }, // 7 ev i juli, 5 synliga
    { slug: 'Lakarmissionen', name: 'Läkarmissionen', city: 'Alingsås' }, // 7 ev i juli, 8 synliga
    { slug: 'gasasteget', name: 'Lunds Dansklubb Gåsasteget', city: 'Lund' }, // 7 ev i juli, 7 synliga
    { slug: 'linkopingairswing', name: 'Linköping Air Swing', city: 'Linköping' }, // 7 ev i juli, 8 synliga
    { slug: 'kristnaregnbagsrorelsen', name: 'Kristna regnbågsrörelsen - Riksförbundet EKHO' }, // 7 ev i juli, 8 synliga
    { slug: 'Kapellet.telje', name: 'Kapellet', city: 'Norrtälje' }, // 7 ev i juli, 7 synliga
    { slug: 'jagvagarstuffa', name: 'Jag vågar stuffa', city: 'Karlshamn' }, // 7 ev i juli, 8 synliga
    { slug: 'freemoveyogastudio.nu', name: 'Freemove Yogastudio' }, // 7 ev i juli, 5 synliga
    { slug: 'hovmantorps.folketshus', name: 'Folkbiografen Hovmantorp' }, // 7 ev i juli, 5 synliga
    { slug: 'bjuvsbibliotek', name: 'Bjuvs bibliotek' }, // 7 ev i juli, 8 synliga
    { slug: 'angebibliotek', name: 'Biblioteken i Ånge' }, // 7 ev i juli, 4 synliga
    { slug: 'BibliotekeniKalmarkommun', name: 'Biblioteken i Kalmar kommun', city: 'Kalmar' }, // 7 ev i juli, 8 synliga
    { slug: 'arvikabibliotek', name: 'Arvika Bibliotek', city: 'Arvika' }, // 7 ev i juli, 7 synliga
    { slug: '59anLysekil', name: '59an i Lysekil' }, // 7 ev i juli, 4 synliga
    { slug: 'q.barsundsvall', name: 'q.bar Sundsvall', city: 'Sundsvall' }, // 6 ev i juli, 5 synliga
    { slug: 'yofcreativepartners', name: 'YOF Creative Partners', city: 'Stockholm' }, // 6 ev i juli, 7 synliga
    { slug: 'vewcs', name: 'Victor Evelina West Coast Swing', city: 'Uppsala' }, // 6 ev i juli, 8 synliga
    { slug: 'vedeldspizzan', name: 'Vedeldspizzan', city: 'Göteborg' }, // 6 ev i juli, 2 synliga
    { slug: 'varbergsstadshotellochasiaspa', name: 'Varbergs Stadshotell och Asia Spa', city: 'Varberg' }, // 6 ev i juli, 5 synliga
    { slug: 'vardagibalans', name: 'Vardag i Balans', city: 'Lund' }, // 6 ev i juli, 2 synliga
    { slug: 'UpplevSkovde', name: 'Upplev Skövde', city: 'Skövde' }, // 6 ev i juli, 3 synliga
    { slug: 'UkrainianCultureInSweden', name: 'Ukrainian Culture in Sweden /Ukraine Culture Now' }, // 6 ev i juli, 4 synliga
    { slug: 'BokskogeniTorup', name: 'Torups Slott' }, // 6 ev i juli, 1 synliga
    { slug: 'tangovarberg', name: 'Tango Varberg', city: 'Varberg' }, // 6 ev i juli, 3 synliga
    { slug: 'lena.lingensjo', name: 'Söndsvalls damer �', city: 'Sundsvall' }, // 6 ev i juli, 6 synliga
    { slug: 'skovdekulturhus', name: 'Skövde Kulturhus', city: 'Skövde' }, // 6 ev i juli, 8 synliga
    { slug: 'Reimersholmehotel', name: 'Reimersholme Hotel', city: 'Stockholm' }, // 6 ev i juli, 8 synliga
    { slug: 'konstmuseummalmo', name: 'Malmö Konstmuseum' }, // 6 ev i juli, 3 synliga
    { slug: 'lyckselemusikoteater', name: 'Lycksele Musik & Teaterförening-en del av Riksteatern', city: 'Lycksele' }, // 6 ev i juli, 3 synliga
    { slug: 'lisebergab', name: 'Liseberg' }, // 6 ev i juli, 2 synliga
    { slug: 'linkopingsstadsbibliotek', name: 'Linköpings stadsbibliotek', city: 'Linköping' }, // 6 ev i juli, 7 synliga
    { slug: 'kulturhusetfregatten', name: 'Kulturhuset Fregatten' }, // 6 ev i juli, 6 synliga
    { slug: 'Kulturhjaltarna', name: 'Kulturhjältarna' }, // 6 ev i juli, 8 synliga
    { slug: 'kulturbolaget', name: 'Kulturbolaget' }, // 6 ev i juli, 8 synliga
    { slug: 'KSHHealing', name: 'KSH Healing', city: 'Kalmar' }, // 6 ev i juli, 6 synliga
    { slug: 'kbwestgbg', name: 'KB West' }, // 6 ev i juli, 8 synliga
    { slug: 'IntimanTeatern', name: 'Intiman', city: 'Stockholm' }, // 6 ev i juli, 2 synliga
    { slug: 'HotellHavanna', name: 'Hotell Havanna', city: 'Varberg' }, // 6 ev i juli, 3 synliga
    { slug: 'NyaHouseofBlues', name: 'House of blues Borlänge- HOBB', city: 'Borlänge' }, // 6 ev i juli, 7 synliga
    { slug: 'GothenburgSymphonyOrchestra', name: 'Göteborgs Symfoniker' }, // 6 ev i juli, 4 synliga
    { slug: 'grumsbio', name: 'Grums Bio' }, // 6 ev i juli, 8 synliga
    { slug: 'gretasgothenburg', name: 'Gretas Göteborg', city: 'Göteborg' }, // 6 ev i juli, 8 synliga
    { slug: 'folketshusborlange', name: 'Folkets Hus Borlänge', city: 'Borlänge' }, // 6 ev i juli, 7 synliga
    { slug: 'Familjecentralen.Ulricehamn', name: 'Familjecentralen, Öppna förskolan i Ulricehamn' }, // 6 ev i juli, 5 synliga
    { slug: 'ebba.dansklubb', name: 'EBBA Dansklubb' }, // 6 ev i juli, 5 synliga
    { slug: 'dansofolkton', name: 'Dans & Folkton' }, // 6 ev i juli, 4 synliga
    { slug: 'WheelsOfCarlshamn', name: 'Cykelklubben Wheels Of Carlshamn', city: 'Karlshamn' }, // 6 ev i juli, 8 synliga
    { slug: 'centrumhusbiografen', name: 'Centrumhusbiografen' }, // 6 ev i juli, 8 synliga
    { slug: 'backyardfalun', name: 'Backyard Club', city: 'Falun' }, // 6 ev i juli, 2 synliga
    { slug: 'AlingsasHK', name: 'Alingsås HK', city: 'Alingsås' }, // 6 ev i juli, 2 synliga
    { slug: 'tangojamt', name: 'TangoJamt' }, // 5 ev i juli, 3 synliga
    { slug: 'swingum400', name: 'Swingum' }, // 5 ev i juli, 4 synliga
    { slug: 'SVGoteborg', name: 'Studieförbundet Vuxenskolan Göteborg', city: 'Göteborg' }, // 5 ev i juli, 8 synliga
    { slug: 'Studieforbundetbildanord', name: 'Studieförbundet Bilda Nord' }, // 5 ev i juli, 8 synliga
    { slug: 'stockholmsmarknader', name: 'Stockholmsmarknader' }, // 5 ev i juli, 5 synliga
    { slug: 'SkolsimmarnaIK', name: 'Skolsimmarna IK' }, // 5 ev i juli, 3 synliga
    { slug: 'skovdeyogacentrum', name: 'Skövde YogaCentrum', city: 'Skövde' }, // 5 ev i juli, 2 synliga
    { slug: 'seniorikungsbacka', name: 'Senior i Kungsbacka', city: 'Kungsbacka' }, // 5 ev i juli, 5 synliga
    { slug: 'sagabioflen', name: 'Saga Bio, Flen' }, // 5 ev i juli, 1 synliga
    { slug: 'scenknuten', name: 'Scenknuten', city: 'Eskilstuna' }, // 5 ev i juli, 2 synliga
    { slug: 'RadissonBluGothenburg', name: 'Radisson Blu Scandinavia Hotel, Gothenburg (Göteborg)', city: 'Göteborg' }, // 5 ev i juli, 4 synliga
    { slug: 'pustervik', name: 'Pustervik' }, // 5 ev i juli, 8 synliga
    { slug: 'nojesfabriken', name: 'Nöjesfabriken', city: 'Karlstad' }, // 5 ev i juli, 8 synliga
    { slug: 'naturumblekinge', name: 'Naturum Blekinge', city: 'Ronneby' }, // 5 ev i juli, 1 synliga
    { slug: 'nbvost', name: 'NBV Öst' }, // 5 ev i juli, 3 synliga
    { slug: 'MotalaBasket', name: 'Motala Basket - W72', city: 'Motala' }, // 5 ev i juli, 2 synliga
    { slug: 'malmabuggarna', name: 'Malmabuggarna' }, // 5 ev i juli, 3 synliga
    { slug: 'MusikcentrumVast', name: 'MCV - Musikcentrum Väst' }, // 5 ev i juli, 8 synliga
    { slug: 'Motorcykelentusiasterna', name: 'MCE - motorcykelentusiasterna' }, // 5 ev i juli, 3 synliga
    { slug: 'Kungalvsparken', name: 'Kungälvs Parken', city: 'Borås' }, // 5 ev i juli, 7 synliga
    { slug: 'kulturmagasinetsundsvall', name: 'Kulturmagasinet Sundsvall', city: 'Sundsvall' }, // 5 ev i juli, 8 synliga
    { slug: 'KappaBarMalmo', name: 'Kappa Bar Malmö' }, // 5 ev i juli, 4 synliga
    { slug: 'jan.svensson.9469', name: 'Jan Svensson' }, // 5 ev i juli, 8 synliga
    { slug: 'HotelEggers', name: 'Hôtel Eggers' }, // 5 ev i juli, 5 synliga
    { slug: 'harkekonstcentrum', name: 'Härke Konstcentrum' }, // 5 ev i juli, 2 synliga
    { slug: 'harnosandsbibliotek', name: 'Härnösands bibliotek', city: 'Härnösand' }, // 5 ev i juli, 4 synliga
    { slug: 'gnosjobibliotek', name: 'Gnosjö kultur & bibliotek' }, // 5 ev i juli, 3 synliga
    { slug: 'Furuviksparken', name: 'Furuviksparken' }, // 5 ev i juli, 1 synliga
    { slug: 'Eslovsstadsbibliotek', name: 'Eslövs stadsbibliotek', city: 'Eslöv' }, // 5 ev i juli, 3 synliga
    { slug: 'brasserietboras', name: 'Brasseriet', city: 'Borås' }, // 5 ev i juli, 4 synliga
    { slug: 'MuseetBollnasKonsthall', name: 'Bollnäs Museum & Konsthall' }, // 5 ev i juli, 1 synliga
    { slug: 'ArbogaFolketsPark', name: 'Arboga Folkets Park' }, // 5 ev i juli, 8 synliga
    { slug: 'allthingslivenorway', name: 'All Things Live Norway' }, // 5 ev i juli, 8 synliga
    { slug: 'amplifiedvast', name: 'Amplified Väst', city: 'Borås' }, // 5 ev i juli, 3 synliga
    { slug: 'abfnorrkalix', name: 'ABF Norr Kalix' }, // 5 ev i juli, 5 synliga
    { slug: 'ostgotamusiken', name: 'Östgötamusiken', city: 'Linköping' }, // 4 ev i juli, 8 synliga
    { slug: 'ObackaJazz', name: 'Öbacka Jazz&Blues Härnösand', city: 'Härnösand' }, // 4 ev i juli, 5 synliga
    { slug: 'alvsbynsbibliotek', name: 'Älvsbyns Bibliotek' }, // 4 ev i juli, 2 synliga
    { slug: 'VaerkstederiAbsalon', name: 'Værksteder i Absalon' }, // 4 ev i juli, 8 synliga
    { slug: 'Vardklockanskyrka', name: 'Vårdklockans kyrka', city: 'Visby' }, // 4 ev i juli, 3 synliga
    { slug: 'Upplandsmuseet', name: 'Upplandsmuseet', city: 'Uppsala' }, // 4 ev i juli, 8 synliga
    { slug: 'tornqvisteventandmusic', name: 'Törnqvist Event & Music' }, // 4 ev i juli, 8 synliga
    { slug: 'ostergotlandsbokmassa', name: 'TellUs bok- och berättarmässa i Linköping', city: 'Linköping' }, // 4 ev i juli, 8 synliga
    { slug: 'tangosundsvall', name: 'TangoSundsvall', city: 'Sundsvall' }, // 4 ev i juli, 2 synliga
    { slug: 'SoderhamnsKonstforening', name: 'Söderhamns Konstförening', city: 'Söderhamn' }, // 4 ev i juli, 1 synliga
    { slug: 'sundsvallskommun', name: 'Sundsvalls kommun', city: 'Sundsvall' }, // 4 ev i juli, 8 synliga
    { slug: 'stenhusetgille', name: 'Stenhuset' }, // 4 ev i juli, 2 synliga
    { slug: 'SalemStavanger', name: 'Salem Stavanger' }, // 4 ev i juli, 8 synliga
    { slug: 'northcreativenodes', name: 'North Creative Nodes', city: 'Boden' }, // 4 ev i juli, 8 synliga
    { slug: 'musikochteatervanner', name: 'Musik & Teatervänner' }, // 4 ev i juli, 7 synliga
    { slug: 'mats.fuchs.9', name: 'Mats Fuchs' }, // 4 ev i juli, 1 synliga
    { slug: 'kpdmellerud', name: 'Kulturbruket på Dal' }, // 4 ev i juli, 7 synliga
    { slug: 'jiversdancingclub', name: 'Jivers Dancing Club' }, // 4 ev i juli, 8 synliga
    { slug: 'huddingeparkrun', name: 'Huddinge Parkrun' }, // 4 ev i juli, 8 synliga
    { slug: 'borgmastarvilla', name: 'Hotell Humbla', city: 'Sölvesborg' }, // 4 ev i juli, 3 synliga
    { slug: '100064844764389', name: 'Herrljunga Folkets Park' }, // 4 ev i juli, 6 synliga
    { slug: 'hotelmolndalsbroochroyrestaurant', name: 'Hotel Mölndals Bro - Roy Restaurant Café & Bar' }, // 4 ev i juli, 4 synliga
    { slug: 'gnestabokdagar', name: 'Gnesta Bokdagar' }, // 4 ev i juli, 8 synliga
    { slug: 'Gardenoffeathers', name: 'Garden of Feathers', city: 'Staffanstorp' }, // 4 ev i juli, 8 synliga
    { slug: 'dancetogether.se', name: 'Dance Together', city: 'Eskilstuna' }, // 4 ev i juli, 4 synliga
    { slug: 'couleurkonsthandel', name: 'Couleur Konsthandel', city: 'Stockholm' }, // 4 ev i juli, 4 synliga
    { slug: 'cirkusmuseet', name: 'Cirkusmuseet' }, // 4 ev i juli, 2 synliga
    { slug: 'boca.vasteras', name: 'Boca Västerås', city: 'Västerås' }, // 4 ev i juli, 2 synliga
    { slug: 'biokontrastiggesund', name: 'Bio Kontrast - Folkets Hus Iggesund' }, // 4 ev i juli, 2 synliga
    { slug: 'haningebibliotek', name: 'Biblioteken i Haninge' }, // 4 ev i juli, 5 synliga
    { slug: 'befreenow.se', name: 'Befreenow' }, // 4 ev i juli, 6 synliga
    { slug: 'angustheultimatetribute', name: 'Angus - The Ultimate Tribute', city: 'Borlänge' }, // 4 ev i juli, 8 synliga
    { slug: 'alltidtjorn', name: 'Alltid Tjörn' }, // 4 ev i juli, 5 synliga
    { slug: 'absaloncph', name: 'Absalon' }, // 4 ev i juli, 8 synliga
    { slug: 'ostersundskulturskola', name: 'Östersunds Kulturskola' }, // 3 ev i juli, 3 synliga
    { slug: 'ystadicentrum', name: 'Ystad i centrum', city: 'Ystad' }, // 3 ev i juli, 2 synliga
    { slug: 'yoga121.se', name: 'Yoga 121', city: 'Hudiksvall' }, // 3 ev i juli, 2 synliga
    { slug: 'visituddevalla', name: 'Visit Uddevalla', city: 'Uddevalla' }, // 3 ev i juli, 4 synliga
    { slug: 'villalidkopingbk', name: 'Villa Lidköping BK', city: 'Lidköping' }, // 3 ev i juli, 1 synliga
    { slug: 'VXOevent', name: 'VXO event' }, // 3 ev i juli, 4 synliga
    { slug: 'TillsammansHoor', name: 'Tillsammans Höör' }, // 3 ev i juli, 8 synliga
    { slug: 'stadshallen', name: 'Stadshallen', city: 'Lund' }, // 3 ev i juli, 6 synliga
    { slug: 'stuckonlive', name: 'Stuck On - Live' }, // 3 ev i juli, 8 synliga
    { slug: 'spacerumforskapande', name: 'Space - Rum för skapande', city: 'Visby' }, // 3 ev i juli, 8 synliga
    { slug: 'SoulRelax.Motala', name: 'SoulRelax', city: 'Motala' }, // 3 ev i juli, 3 synliga
    { slug: 'sollentunakommun', name: 'Sollentuna kommun' }, // 3 ev i juli, 1 synliga
    { slug: 'rimboprastgard', name: 'Rimbo Prästgård' }, // 3 ev i juli, 8 synliga
    { slug: 'rfsisuvn', name: 'RF - SISU Västernorrland', city: 'Härnösand' }, // 3 ev i juli, 8 synliga
    { slug: 'porterpelle', name: 'Porter Pelle' }, // 3 ev i juli, 8 synliga
    { slug: 'poffertjes.se', name: 'Poffertjes.se' }, // 3 ev i juli, 8 synliga
    { slug: 'halloikaraoke', name: 'Oslostandup.no' }, // 3 ev i juli, 3 synliga
    { slug: 'NaturumVattenriket', name: 'Naturum Vattenriket' }, // 3 ev i juli, 2 synliga
    { slug: 'naturskyddsforeningenigoteborg', name: 'Naturskyddsföreningen i Göteborg', city: 'Göteborg' }, // 3 ev i juli, 3 synliga
    { slug: 'liverestaurangen', name: 'Luleå Energi Arena' }, // 3 ev i juli, 1 synliga
    { slug: 'konsertkongress', name: 'Linköping Konsert & Kongress', city: 'Linköping' }, // 3 ev i juli, 8 synliga
    { slug: 'LandskronaTeater', name: 'Landskrona Teater', city: 'Landskrona' }, // 3 ev i juli, 8 synliga
    { slug: 'LandskronaMusikochTeater', name: 'Landskrona Musik & Teater - en del av Riksteatern', city: 'Landskrona' }, // 3 ev i juli, 5 synliga
    { slug: 'SoderhamnsRiksteaterforening', name: 'Kulturen Söderhamn', city: 'Söderhamn' }, // 3 ev i juli, 3 synliga
    { slug: 'kalixkommun', name: 'Kalix kommun' }, // 3 ev i juli, 6 synliga
    { slug: 'kalix.bibliotek', name: 'Kalix Bibliotek' }, // 3 ev i juli, 1 synliga
    { slug: 'JiAdagarna', name: 'JiA-Dagarna | Juridiska Föreningens arbetsmarknadsdagar | www.jf.se/jia' }, // 3 ev i juli, 8 synliga
    { slug: 'icfalkenberg', name: 'IC Falkenberg', city: 'Falkenberg' }, // 3 ev i juli, 8 synliga
    { slug: 'harnosandsmusiksallskap', name: 'Härnösands Musiksällskap' }, // 3 ev i juli, 2 synliga
    { slug: 'harnosandfhsk', name: 'Härnösands folkhögskola' }, // 3 ev i juli, 6 synliga
    { slug: 'hiphopweekendkalmar', name: 'Hip Hop Weekend' }, // 3 ev i juli, 8 synliga
    { slug: 'hedemorafolketspark', name: 'Hedemora Folkets Park' }, // 3 ev i juli, 8 synliga
    { slug: 'hagforskulturochbibliotek', name: 'Hagfors kultur och bibliotek' }, // 3 ev i juli, 4 synliga
    { slug: 'helsingborgcity', name: 'HBG City', city: 'Helsingborg' }, // 3 ev i juli, 3 synliga
    { slug: 'fhuddevalla', name: 'Folkets Hus Uddevalla', city: 'Uddevalla' }, // 3 ev i juli, 6 synliga
    { slug: 'fhsater', name: 'Folkets Hus Säter' }, // 3 ev i juli, 8 synliga
    { slug: 'gallivare.se', name: 'Folkets Hus Gällivare', city: 'Gällivare' }, // 3 ev i juli, 5 synliga
    { slug: 'FyrisComedy', name: 'FYRIS Comedy' }, // 3 ev i juli, 3 synliga
    { slug: 'delsbohembygdsforening', name: 'Delsbo Forngård' }, // 3 ev i juli, 1 synliga
    { slug: 'djquizmedslimvic', name: 'DJ QUIZ med SLIM VIC', city: 'Gävle' }, // 3 ev i juli, 2 synliga
    { slug: 'boulognerskogenparkrun', name: 'Boulognerskogen parkrun, Gävle', city: 'Gävle' }, // 3 ev i juli, 4 synliga
    { slug: 'alexeklundofficial', name: 'Alex Eklund', city: 'Eskilstuna' }, // 3 ev i juli, 4 synliga
    { slug: 'BarnOchUngdomskulturTjornsKommun', name: 'Barn- och ungdomskultur Tjörns kommun' }, // 3 ev i juli, 8 synliga
    { slug: 'adasteater', name: 'ADAS teater' }, // 3 ev i juli, 1 synliga
    { slug: 'odf.malmo', name: 'Öresunds Dansförening' }, // 2 ev i juli, 8 synliga
    { slug: 'alvsbyn', name: 'Älvsbyn' }, // 2 ev i juli, 5 synliga
    { slug: 'orlogsstadenkarlskrona.se', name: 'Världsarvet Örlogsstaden Karlskrona', city: 'Karlskrona' }, // 2 ev i juli, 1 synliga
    { slug: 'Levochmaval', name: 'ViveVale', city: 'Lund' }, // 2 ev i juli, 2 synliga
    { slug: 'vikkysKonst', name: 'Vikkys Konst', city: 'Linköping' }, // 2 ev i juli, 1 synliga
    { slug: 'Vikarvet', name: 'Vikarvet Kulturhistoriskt Sällskap' }, // 2 ev i juli, 8 synliga
    { slug: 'valbokopcentrum', name: 'Valbo köpcentrum' }, // 2 ev i juli, 1 synliga
    { slug: 'meraloppis', name: 'Ulf Andersson' }, // 2 ev i juli, 8 synliga
    { slug: 'Uddevallakassetten', name: 'Uddevallakassetten', city: 'Uddevalla' }, // 2 ev i juli, 6 synliga
    { slug: 'afrosvenskarnasforum', name: 'Ubuntu Malmö Filmfestival' }, // 2 ev i juli, 2 synliga
    { slug: 'torggatan14', name: 'Torggatan 14', city: 'Enköping' }, // 2 ev i juli, 1 synliga
    { slug: 'tillsammansforkumla', name: 'Tillsammans för Kumla' }, // 2 ev i juli, 8 synliga
    { slug: 'throwbackeventsldn', name: 'Throwback Events' }, // 2 ev i juli, 8 synliga
    { slug: 'solvesborg', name: 'Sölvesborgs kommun', city: 'Sölvesborg' }, // 2 ev i juli, 2 synliga
    { slug: 'teatervasternorrland', name: 'Teater Västernorrland' }, // 2 ev i juli, 1 synliga
    { slug: 'stenegardjarvso', name: 'Stenegård i Järvsö' }, // 2 ev i juli, 2 synliga
    { slug: 'royal.roland.5623', name: 'SoundTrack Roland' }, // 2 ev i juli, 2 synliga
    { slug: 'stabekkjazzclub', name: 'Stabekk Jazz Club' }, // 2 ev i juli, 8 synliga
    { slug: 'SmalandsVillan', name: 'SmålandsVillan' }, // 2 ev i juli, 1 synliga
    { slug: 'skansklive', name: 'Skånsk Live', city: 'Landskrona' }, // 2 ev i juli, 8 synliga
    { slug: 'skellefteakammarmusik', name: 'Skellefteå Kammarmusikförening' }, // 2 ev i juli, 1 synliga
    { slug: 'SensusRCN', name: 'Rättighetscentrum Norrbotten - mot diskriminering' }, // 2 ev i juli, 8 synliga
    { slug: 'rushentlive', name: 'Rush Ent.' }, // 2 ev i juli, 8 synliga
    { slug: 'ringstromsrestaurang', name: 'Ringströms', city: 'Alingsås' }, // 2 ev i juli, 7 synliga
    { slug: 'petra.revenue', name: 'Petra Revenue' }, // 2 ev i juli, 8 synliga
    { slug: 'hotellmullsjo', name: 'Mullsjö Hotell & Konferens' }, // 2 ev i juli, 1 synliga
    { slug: 'mediumcamilla', name: 'Medium Camilla' }, // 2 ev i juli, 3 synliga
    { slug: 'statarmuseet', name: 'Malmö Stad' }, // 2 ev i juli, 8 synliga
    { slug: 'crimecityrollers', name: 'Malmö Roller Derby - Crime City Rollers' }, // 2 ev i juli, 4 synliga
    { slug: 'DancecityOslo', name: 'MR production Norway' }, // 2 ev i juli, 1 synliga
    { slug: 'klubbkrinolin', name: 'Krinolin - kammarmusikklubben' }, // 2 ev i juli, 2 synliga
    { slug: 'klubbmariama', name: 'Klubb Mariama' }, // 2 ev i juli, 2 synliga
    { slug: 'karlstadskommun', name: 'Karlstads kommun', city: 'Karlstad' }, // 2 ev i juli, 2 synliga
    { slug: 'KDMetalcoholics', name: 'Karlstad Metalcoholics', city: 'Karlstad' }, // 2 ev i juli, 6 synliga
    { slug: 'fastningsmuseet', name: 'Karlsborgs Fästningsmuseum' }, // 2 ev i juli, 4 synliga
    { slug: 'Kafebredsjon', name: 'Kafe Bredsjön' }, // 2 ev i juli, 1 synliga
    { slug: 'jonkopingcity', name: 'Jönköping City', city: 'Jönköping' }, // 2 ev i juli, 5 synliga
    { slug: 'sagateaterboras', name: 'Johan Östling' }, // 2 ev i juli, 8 synliga
    { slug: 'bio.juniora', name: 'Juniora' }, // 2 ev i juli, 8 synliga
    { slug: 'jamtlimuseum', name: 'Jamtli' }, // 2 ev i juli, 4 synliga
    { slug: 'jadedheartmusic', name: 'Jaded Heart' }, // 2 ev i juli, 2 synliga
    { slug: 'high5ivefestivals', name: 'High 5ive Festivals' }, // 2 ev i juli, 6 synliga
    { slug: 'gronakallanalvkarleby', name: 'Gröna Källan - Älvkarleby' }, // 2 ev i juli, 4 synliga
    { slug: 'grandsamarkand', name: 'Grand Samarkand' }, // 2 ev i juli, 1 synliga
    { slug: 'gamlahalmstad', name: 'Gamla Halmstad', city: 'Halmstad' }, // 2 ev i juli, 3 synliga
    { slug: 'foreningensm', name: 'Föreningen Söderhamns Museum', city: 'Söderhamn' }, // 2 ev i juli, 2 synliga
    { slug: 'FylgjaHelandeHarmoni', name: 'Fylgja - helande harmoni', city: 'Sundsvall' }, // 2 ev i juli, 8 synliga
    { slug: 'fulloflife.tantra', name: 'Full of Life' }, // 2 ev i juli, 2 synliga
    { slug: 'forumbiblioteken', name: 'Forumbiblioteken i Nacka' }, // 2 ev i juli, 2 synliga
    { slug: 'micke.finell', name: 'Folkets Hus Norrtälje - Norrtälje kulturhus', city: 'Norrtälje' }, // 2 ev i juli, 1 synliga
    { slug: 'centralastadsrum', name: 'Falu centrum' }, // 2 ev i juli, 1 synliga
    { slug: 'DocLoungeMalmo', name: 'Doc Lounge Malmö' }, // 2 ev i juli, 3 synliga
    { slug: 'eyragarden', name: 'Eyragården, Kävlinge Kommun' }, // 2 ev i juli, 3 synliga
    { slug: 'DestinationSundsvall', name: 'Destination Sundsvall', city: 'Sundsvall' }, // 2 ev i juli, 4 synliga
    { slug: 'DDRKgbg', name: 'DDRKgbg' }, // 2 ev i juli, 6 synliga
    { slug: 'Clubsoundkilla', name: 'Club Soundkilla' }, // 2 ev i juli, 2 synliga
    { slug: 'clandestinofestivalen', name: 'Clandestino Festival' }, // 2 ev i juli, 1 synliga
    { slug: 'bollnasdansar', name: 'Bollnäs Dansar' }, // 2 ev i juli, 8 synliga
    { slug: 'billstromska.fhsk', name: 'Billströmska folkhögskolan' }, // 2 ev i juli, 8 synliga
    { slug: 'barnensscen', name: 'Barnens Scen' }, // 2 ev i juli, 4 synliga
    { slug: 'backa.teater', name: 'Backa Teater' }, // 2 ev i juli, 3 synliga
    { slug: 'avtrycktjorn', name: 'Avtryck Tjörn 9-11 oktober 2026' }, // 2 ev i juli, 8 synliga
    { slug: 'arenahagmyren', name: 'Arena Hagmyren', city: 'Hudiksvall' }, // 2 ev i juli, 2 synliga
    { slug: 'annkiochklas', name: 'Annki & Klas' }, // 2 ev i juli, 1 synliga
    { slug: 'arbetetsmuseum', name: 'Arbetets museum', city: 'Norrköping' }, // 2 ev i juli, 3 synliga
    { slug: 'allmannasangenvisby', name: 'Allmänna Sången Visby', city: 'Visby' }, // 2 ev i juli, 6 synliga
    { slug: 'alingsaskulturhus', name: 'Alingsås kulturhus', city: 'Alingsås' }, // 2 ev i juli, 2 synliga
    { slug: 'abfmalmo', name: 'ABF Malmö' }, // 2 ev i juli, 8 synliga
];
