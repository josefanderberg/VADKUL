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
    { slug: 'jubelAB', name: 'Visit Örebro' }, // 451 ev i juli, 8 synliga
    { slug: 'LiveEventRadar', name: 'Live Event Radar' }, // 90 ev i juli, 8 synliga
    { slug: 'nieuscene', name: 'Nieu Torshov' }, // 54 ev i juli, 7 synliga
    { slug: 'vaxjobibliotek', name: 'Växjö bibliotek' }, // 46 ev i juli, 8 synliga
    { slug: 'kulturaktiebolaget', name: 'Kulturaktiebolaget', city: 'Karlstad' }, // 37 ev i juli, 8 synliga
    { slug: 'StudieforbundetVuxenskolanVast', name: 'Studieförbundet Vuxenskolan Väst', city: 'Uddevalla' }, // 35 ev i juli, 6 synliga
    { slug: 'diamondsdirectstore', name: 'Diamonds Direct' }, // 33 ev i juli, 8 synliga
    { slug: 'stadsbiblioteketgbg', name: 'Göteborgs stadsbibliotek' }, // 32 ev i juli, 8 synliga
    { slug: 'ABFsorm', name: 'ABF Sörmland', city: 'Katrineholm' }, // 31 ev i juli, 8 synliga
    { slug: 'Megascope', name: 'Megascope' }, // 29 ev i juli, 8 synliga
    { slug: 'KulturcentrumSandviken', name: 'Kulturcentrum Sandviken', city: 'Sandviken' }, // 28 ev i juli, 7 synliga
    { slug: 'Honggymnastikforening', name: 'Høng GF' }, // 28 ev i juli, 8 synliga
    { slug: 'Vaxjodyksport', name: 'Växjödyksport', city: 'Växjö' }, // 26 ev i juli, 8 synliga
    { slug: 'varjesteg', name: 'VarjeSteg' }, // 26 ev i juli, 8 synliga
    { slug: 'studioexpress.se', name: 'Studioexpress.se', city: 'Lund' }, // 26 ev i juli, 8 synliga
    { slug: 'hundesenteretitrondheim', name: 'Hundesenteret' }, // 26 ev i juli, 8 synliga
    { slug: 'Moveat.Sweden', name: 'Moveat', city: 'Göteborg' }, // 25 ev i juli, 8 synliga
    { slug: 'northeventAB', name: 'Northevent AB', city: 'Karlstad' }, // 25 ev i juli, 8 synliga
    { slug: 'svdalsland', name: 'Studieförbundet Vuxenskolan i Dalsland' }, // 24 ev i juli, 8 synliga
    { slug: 'folkuniversitetetvisby', name: 'Folkuniversitetet Visby', city: 'Visby' }, // 24 ev i juli, 8 synliga
    { slug: 'folkuniversitetetregionsyd', name: 'Folkuniversitetet Syd', city: 'Lund' }, // 24 ev i juli, 8 synliga
    { slug: 'vrakdykarpensionatet', name: 'Vrakdykarpensionatet' }, // 23 ev i juli, 8 synliga
    { slug: 'stormspakhus', name: 'Storms Pakhus' }, // 23 ev i juli, 6 synliga
    { slug: 'Kulturenshus', name: 'Kulturens hus Luleå' }, // 23 ev i juli, 8 synliga
    { slug: 'jointhestudentlife', name: 'The Student Life' }, // 23 ev i juli, 3 synliga
    { slug: 'guppyentertainmentab', name: 'Guppy Entertainment', city: 'Kristianstad' }, // 23 ev i juli, 8 synliga
    { slug: 'attentionmolndal', name: 'Attention Mölndal' }, // 23 ev i juli, 8 synliga
    { slug: 'medborgarskolanjamtland', name: 'Medborgarskolan' }, // 22 ev i juli, 8 synliga
    { slug: 'hotelskansenoland', name: 'Hotel Skansen', city: 'Kalmar' }, // 22 ev i juli, 8 synliga
    { slug: 'medleymalmo', name: 'medley malmö' }, // 21 ev i juli, 8 synliga
    { slug: 'gkmmsplit', name: 'Gradska knjiznica Marka Marulica Split' }, // 21 ev i juli, 8 synliga
    { slug: 'kulturiale', name: 'Kultur i Ale' }, // 21 ev i juli, 6 synliga
    { slug: 'csnoje.se', name: 'CS Nöje', city: 'Jönköping' }, // 21 ev i juli, 8 synliga
    { slug: 'alltpascen', name: 'Allt På Scen & Mycke Nöje', city: 'Linköping' }, // 21 ev i juli, 8 synliga
    { slug: 'Musikhuset', name: 'Musikhuset Gävle', city: 'Gävle' }, // 20 ev i juli, 8 synliga
    { slug: 'kulturkvarteret', name: 'Kulturkvarteret Kristianstad', city: 'Kristianstad' }, // 20 ev i juli, 8 synliga
    { slug: 'vasteraskonserthus', name: 'Västerås Konserthus', city: 'Västerås' }, // 19 ev i juli, 8 synliga
    { slug: 'Tangokompaniet', name: 'Tangokompaniet', city: 'Lund' }, // 19 ev i juli, 8 synliga
    { slug: 'molndalsdansskola', name: 'Mölndals Dansskola' }, // 19 ev i juli, 8 synliga
    { slug: 'hemfranderome', name: 'Hem från Derome', city: 'Varberg' }, // 19 ev i juli, 6 synliga
    { slug: 'gemenskapikungsor', name: 'Gemenskap i Kungsör' }, // 19 ev i juli, 7 synliga
    { slug: 'skogsvargarna', name: 'OK Skogsvargarna', city: 'Lidköping' }, // 18 ev i juli, 6 synliga
    { slug: 'SundsvallsStadsbibliotek', name: 'Sundsvalls Stadsbibliotek', city: 'Sundsvall' }, // 18 ev i juli, 8 synliga
    { slug: 'kollektivetlivetbar', name: 'Kollektivet Livet' }, // 18 ev i juli, 8 synliga
    { slug: 'jazzclubfasching', name: 'Fasching' }, // 18 ev i juli, 8 synliga
    { slug: 'Debasersthlm', name: 'Debaser', city: 'Stockholm' }, // 18 ev i juli, 6 synliga
    { slug: 'varnamobibliotekochkultur', name: 'Värnamo bibliotek och kultur' }, // 17 ev i juli, 8 synliga
    { slug: 'Esso36', name: 'SO36' }, // 17 ev i juli, 8 synliga
    { slug: 'dismitt', name: 'Dis-Mitt', city: 'Gävle' }, // 17 ev i juli, 1 synliga
    { slug: 'mejeriet', name: 'Mejeriet', city: 'Lund' }, // 17 ev i juli, 7 synliga
    { slug: 'Midsommargarden', name: 'Midsommargården' }, // 17 ev i juli, 8 synliga
    { slug: 'vaniumeasida', name: 'Vän i Umeå' }, // 16 ev i juli, 8 synliga
    { slug: 'litensmula', name: 'Vita Huset - En Liten Smula', city: 'Norrtälje' }, // 16 ev i juli, 8 synliga
    { slug: 'bibliotekoupplevelser', name: 'Vingåkers bibliotek' }, // 16 ev i juli, 8 synliga
    { slug: 'trivselhussverige', name: 'Trivselhus', city: 'Lidköping' }, // 16 ev i juli, 3 synliga
    { slug: 'Smalands', name: 'Smålands Nation', city: 'Lund' }, // 16 ev i juli, 5 synliga
    { slug: 'taystase', name: 'Taysta', city: 'Linköping' }, // 16 ev i juli, 8 synliga
    { slug: 'kramforsbibliotek', name: 'Kramfors bibliotek' }, // 16 ev i juli, 6 synliga
    { slug: 'krallentertainment', name: 'Krall Entertainment', city: 'Uppsala' }, // 16 ev i juli, 8 synliga
    { slug: 'bioroy', name: 'Bio Roy' }, // 16 ev i juli, 8 synliga
    { slug: 'Hjaltevadshus', name: 'Hjältevadshus', city: 'Göteborg' }, // 16 ev i juli, 7 synliga
    { slug: 'bibliotekenihalmstad', name: 'Biblioteken i Halmstad', city: 'Halmstad' }, // 16 ev i juli, 8 synliga
    { slug: 'Victoriateatern', name: 'Victoriateatern Malmö' }, // 15 ev i juli, 8 synliga
    { slug: 'umepride', name: 'Umepride' }, // 15 ev i juli, 8 synliga
    { slug: 'sodertaljestadsscen', name: 'Södertälje stadsscen' }, // 15 ev i juli, 8 synliga
    { slug: 'vadhanderistockholm', name: 'Vad som händer i Stockholm', city: 'Stockholm' }, // 15 ev i juli, 5 synliga
    { slug: 'Scalateatern', name: 'Scalateatern i Karlstad', city: 'Karlstad' }, // 15 ev i juli, 8 synliga
    { slug: 'lantmannenmaskinochlantbruk', name: 'Lantmännen Maskin och Lantmännen Lantbruk', city: 'Kristianstad' }, // 15 ev i juli, 8 synliga
    { slug: 'natminkulturhus', name: 'Nationella minoriteters kulturhus' }, // 15 ev i juli, 5 synliga
    { slug: 'kristinehamnsbibliotek', name: 'Kristinehamns bibliotek', city: 'Kristinehamn' }, // 15 ev i juli, 5 synliga
    { slug: 'Inkonst3', name: 'Inkonst' }, // 15 ev i juli, 8 synliga
    { slug: 'fhsater', name: 'Folkets Hus Säter' }, // 15 ev i juli, 8 synliga
    { slug: 'FKPscorpiosweden', name: 'FKP Scorpio Sverige' }, // 15 ev i juli, 8 synliga
    { slug: 'ABFsodertorn', name: 'ABF Södertörn' }, // 15 ev i juli, 8 synliga
    { slug: 'estrad.norr', name: 'Estrad Norr' }, // 15 ev i juli, 6 synliga
    { slug: 'ulrikabeijeryoga', name: 'UB Yoga, Sång & Ceremoni', city: 'Hudiksvall' }, // 14 ev i juli, 6 synliga
    { slug: 'orebrobibliotek', name: 'Örebro bibliotek' }, // 14 ev i juli, 8 synliga
    { slug: 'toccaentertainment', name: 'Tocca Entertainment', city: 'Sundsvall' }, // 14 ev i juli, 8 synliga
    { slug: 'Storlihytta', name: 'Storlihytta' }, // 14 ev i juli, 8 synliga
    { slug: 'folketshusulricehamn', name: 'Folkets Hus Ulricehamn' }, // 14 ev i juli, 7 synliga
    { slug: 'eksjobibliotek', name: 'Eksjö stadsbibliotek' }, // 14 ev i juli, 7 synliga
    { slug: 'CooperativaCovibar', name: 'Covibar' }, // 14 ev i juli, 4 synliga
    { slug: 'vasterasbibliotek', name: 'Västerås bibliotek', city: 'Västerås' }, // 13 ev i juli, 6 synliga
    { slug: 'varldskulturmuseet', name: 'Världskulturmuseet' }, // 13 ev i juli, 7 synliga
    { slug: 'vallentunadans', name: 'Vallentuna Dans' }, // 13 ev i juli, 6 synliga
    { slug: 'ungdomshuset.odense', name: 'Ungdomshuset Odense' }, // 13 ev i juli, 8 synliga
    { slug: 'vadstenabibliotek', name: 'Vadstena bibliotek' }, // 13 ev i juli, 6 synliga
    { slug: 'tibrobibliotek', name: 'Tibro bibliotek' }, // 13 ev i juli, 6 synliga
    { slug: 'Reimersholmehotel', name: 'Reimersholme Hotel', city: 'Stockholm' }, // 13 ev i juli, 8 synliga
    { slug: 'oxiebiblioteket', name: 'Oxiebiblioteket' }, // 13 ev i juli, 7 synliga
    { slug: 'planthousehuntersville', name: 'PlantHouse' }, // 13 ev i juli, 8 synliga
    { slug: 'norrlandsoperan', name: 'Norrlandsoperan' }, // 13 ev i juli, 8 synliga
    { slug: 'nygatan6', name: 'Nygatan 6' }, // 13 ev i juli, 6 synliga
    { slug: 'nationalmuseumswe', name: 'Nationalmuseum', city: 'Stockholm' }, // 13 ev i juli, 7 synliga
    { slug: 'musikidalarna', name: 'Musik i Dalarna', city: 'Falun' }, // 13 ev i juli, 6 synliga
    { slug: 'movehomesverige', name: 'Movehome', city: 'Motala' }, // 13 ev i juli, 2 synliga
    { slug: 'hyltebiblioteken', name: 'Hyltebiblioteken' }, // 13 ev i juli, 8 synliga
    { slug: 'SwinginHepTown', name: 'HepTown', city: 'Lund' }, // 13 ev i juli, 8 synliga
    { slug: 'Hedenstedbibliotekerne', name: 'Hedensted Bibliotekerne' }, // 13 ev i juli, 8 synliga
    { slug: 'HarrysStenungsund', name: 'Harrys' }, // 13 ev i juli, 6 synliga
    { slug: 'iggesundsfolkan', name: 'Folkets Hus - Iggesund' }, // 13 ev i juli, 8 synliga
    { slug: 'BorlangeDance', name: 'Borlänge Dance', city: 'Borlänge' }, // 13 ev i juli, 1 synliga
    { slug: 'bibliotekeniboras', name: 'Biblioteken i Borås', city: 'Borås' }, // 13 ev i juli, 7 synliga
    { slug: 'Biotranan.Tranemo', name: 'Bio Tranan Tranemo' }, // 13 ev i juli, 8 synliga
    { slug: 'Sormlandsmuseum', name: 'Sörmlands museum', city: 'Nyköping' }, // 12 ev i juli, 7 synliga
    { slug: 'svinorrabohuslan', name: 'Studieförbundet Vuxenskolan i Norra Bohuslän' }, // 12 ev i juli, 8 synliga
    { slug: 'svkalmarlan', name: 'Studieförbundet Vuxenskolan Kalmar län', city: 'Nybro' }, // 12 ev i juli, 8 synliga
    { slug: 'Sjoangen', name: 'Sjöängen i Askersund' }, // 12 ev i juli, 6 synliga
    { slug: 'NojetKonsert', name: 'Nöjet Konsert AB', city: 'Uppsala' }, // 12 ev i juli, 8 synliga
    { slug: 'shrekraveofficial', name: 'Shrek Rave' }, // 12 ev i juli, 8 synliga
    { slug: 'NiklasStromstedtMusic', name: 'Niklas Strömstedt', city: 'Gävle' }, // 12 ev i juli, 6 synliga
    { slug: 'kulturbolaget', name: 'Kulturbolaget', city: 'Jönköping' }, // 12 ev i juli, 8 synliga
    { slug: 'ideadrottninghog', name: 'Idé A Drottninghög', city: 'Helsingborg' }, // 12 ev i juli, 3 synliga
    { slug: 'freemoveyogastudio.nu', name: 'Freemove Yogastudio' }, // 12 ev i juli, 8 synliga
    { slug: 'harnosandsbibliotek', name: 'Härnösands bibliotek', city: 'Härnösand' }, // 12 ev i juli, 7 synliga
    { slug: 'ebba.dansklubb', name: 'EBBA Dansklubb' }, // 12 ev i juli, 5 synliga
    { slug: 'bibliotekenilaholm', name: 'Biblioteken i Laholm', city: 'Laholm' }, // 12 ev i juli, 5 synliga
    { slug: 'barnbiblioteken', name: 'Barnbiblioteken', city: 'Strängnäs' }, // 12 ev i juli, 8 synliga
    { slug: 'arbisnkpg', name: 'Arbis' }, // 12 ev i juli, 8 synliga
    { slug: 'vaxjokommun', name: 'Växjö kommun' }, // 11 ev i juli, 7 synliga
    { slug: 'vewcs', name: 'Victor Evelina West Coast Swing', city: 'Uppsala' }, // 11 ev i juli, 8 synliga
    { slug: 'foxfairoak', name: 'The Fox Fair Oak' }, // 11 ev i juli, 8 synliga
    { slug: 'svgavleborg', name: 'Studieförbundet Vuxenskolan Gävleborg', city: 'Gävle' }, // 11 ev i juli, 8 synliga
    { slug: 'biblioteketsimrishamn', name: 'Simrishamns bibliotek', city: 'Simrishamn' }, // 11 ev i juli, 8 synliga
    { slug: 'svorebrolan', name: 'Studieförbundet Vuxenskolan Örebro Län', city: 'Nora' }, // 11 ev i juli, 7 synliga
    { slug: 'sensusvastrasverige', name: 'Sensus Västra Sverige', city: 'Göteborg' }, // 11 ev i juli, 8 synliga
    { slug: 'junisalvsborgdistrikt', name: 'Movendi Älvsborg', city: 'Alingsås' }, // 11 ev i juli, 8 synliga
    { slug: 'monovaxjo', name: 'Mono Växjö' }, // 11 ev i juli, 8 synliga
    { slug: 'lundchoralfestival.lcf', name: 'Lund Choral Festival', city: 'Lund' }, // 11 ev i juli, 8 synliga
    { slug: 'linkopingairswing', name: 'Linköping Air Swing', city: 'Linköping' }, // 11 ev i juli, 8 synliga
    { slug: 'karlskronabibliotek', name: 'Karlskrona Stadsbibliotek', city: 'Karlskrona' }, // 11 ev i juli, 8 synliga
    { slug: 'inrenatur', name: 'Inre natur' }, // 11 ev i juli, 6 synliga
    { slug: 'Eskilstunastadsbibliotek', name: 'Eskilstuna stadsbibliotek', city: 'Eskilstuna' }, // 11 ev i juli, 8 synliga
    { slug: 'Gardenoffeathers', name: 'Garden of Feathers', city: 'Staffanstorp' }, // 11 ev i juli, 8 synliga
    { slug: 'BorasDansforening', name: 'Borås Dansförening', city: 'Borås' }, // 11 ev i juli, 7 synliga
    { slug: 'bjuvsbibliotek', name: 'Bjuvs bibliotek' }, // 11 ev i juli, 8 synliga
    { slug: 'centrumhusbiografen', name: 'Centrumhusbiografen' }, // 11 ev i juli, 7 synliga
    { slug: 'Bibliotekenilulea', name: 'Biblioteken i Luleå' }, // 11 ev i juli, 8 synliga
    { slug: 'aabendans', name: 'Aaben Dans' }, // 11 ev i juli, 4 synliga
    { slug: 'astarscandinavia', name: 'A STAR Entertainment', city: 'Norrköping' }, // 11 ev i juli, 8 synliga
    { slug: 'almhultsbibliotek', name: 'Älmhults bibliotek' }, // 10 ev i juli, 6 synliga
    { slug: 'ystadsbibliotek', name: 'Ystads bibliotek', city: 'Ystad' }, // 10 ev i juli, 8 synliga
    { slug: 'Uddevallakassetten', name: 'Uddevallakassetten', city: 'Uddevalla' }, // 10 ev i juli, 7 synliga
    { slug: 'tingsrydsbibliotekochkultur', name: 'Tingsryds bibliotek och kultur' }, // 10 ev i juli, 5 synliga
    { slug: 'TillsammansHoor', name: 'Tillsammans Höör' }, // 10 ev i juli, 1 synliga
    { slug: 'tasspalatset.se', name: 'Tasspalatset' }, // 10 ev i juli, 8 synliga
    { slug: 'SVGoteborg', name: 'Studieförbundet Vuxenskolan Göteborg', city: 'Göteborg' }, // 10 ev i juli, 8 synliga
    { slug: 'malmostadsbibliotek', name: 'Stadsbiblioteket i Malmö' }, // 10 ev i juli, 8 synliga
    { slug: 'slagelsebib', name: 'Slagelse Bibliotekerne' }, // 10 ev i juli, 8 synliga
    { slug: 'seniorikungsbacka', name: 'Senior i Kungsbacka', city: 'Kungsbacka' }, // 10 ev i juli, 8 synliga
    { slug: 'parkenkulturhus', name: 'Parken kulturhus' }, // 10 ev i juli, 7 synliga
    { slug: 'NalenStockholm', name: 'Nalen', city: 'Stockholm' }, // 10 ev i juli, 7 synliga
    { slug: 'moriskapaviljongen', name: 'Moriska Paviljongen' }, // 10 ev i juli, 7 synliga
    { slug: 'livenationswe', name: 'Live Nation Sweden', city: 'Karlstad' }, // 10 ev i juli, 6 synliga
    { slug: 'lundsallhelgonakyrka', name: 'Lunds Allhelgonakyrka' }, // 10 ev i juli, 5 synliga
    { slug: 'konstepidemin', name: 'Konstepidemin' }, // 10 ev i juli, 8 synliga
    { slug: 'KappaBarMalmo', name: 'Kappa Bar Malmö' }, // 10 ev i juli, 8 synliga
    { slug: 'KSHHealing', name: 'KSH Healing', city: 'Kalmar' }, // 10 ev i juli, 1 synliga
    { slug: 'gotlandsmuseum', name: 'Gotlands Museum', city: 'Visby' }, // 10 ev i juli, 7 synliga
    { slug: 'gretasgothenburg', name: 'Gretas Göteborg', city: 'Göteborg' }, // 10 ev i juli, 8 synliga
    { slug: 'hovmantorps.folketshus', name: 'Folkbiografen Hovmantorp' }, // 10 ev i juli, 8 synliga
    { slug: 'cirkus.klub', name: 'Cirkus' }, // 10 ev i juli, 6 synliga
    { slug: 'centrumforfotografi', name: 'CFF – Centrum för fotografi', city: 'Göteborg' }, // 10 ev i juli, 4 synliga
    { slug: 'baerumkulturhus', name: 'Bærum Kulturhus' }, // 10 ev i juli, 5 synliga
    { slug: 'folketsbiomalmo', name: 'Biograf Panora Malmö' }, // 10 ev i juli, 8 synliga
    { slug: 'arvikabibliotek', name: 'Arvika Bibliotek', city: 'Arvika' }, // 10 ev i juli, 7 synliga
    { slug: '59anLysekil', name: '59an i Lysekil' }, // 10 ev i juli, 5 synliga
    { slug: 'YogaHusetFalun', name: 'Yogahuset Falun', city: 'Falun' }, // 9 ev i juli, 8 synliga
    { slug: 'WoodyWestGbg', name: 'Woody West' }, // 9 ev i juli, 8 synliga
    { slug: 'varlokal', name: 'Vår lokal' }, // 9 ev i juli, 8 synliga
    { slug: 'gunnesgard', name: 'Vikingagården Gunnes gård' }, // 9 ev i juli, 4 synliga
    { slug: 'tranemo.bibliotek', name: 'Tranemo bibliotek' }, // 9 ev i juli, 6 synliga
    { slug: 'stockholmghostwalk', name: 'Stockholm Ghost Walk', city: 'Stockholm' }, // 9 ev i juli, 5 synliga
    { slug: 'smalandsuppsala', name: 'Smålands nation', city: 'Uppsala' }, // 9 ev i juli, 4 synliga
    { slug: 'silvenska', name: 'Silvénska villan' }, // 9 ev i juli, 6 synliga
    { slug: 'sigtunastiftelsen', name: 'Sigtunastiftelsen' }, // 9 ev i juli, 6 synliga
    { slug: 'stfostraskane', name: 'STF Östra Skåne Lokalavdelning', city: 'Kristianstad' }, // 9 ev i juli, 8 synliga
    { slug: 'reisdegkomikerklubb', name: 'Reis Deg Komikerklubb' }, // 9 ev i juli, 4 synliga
    { slug: 'nbvost', name: 'NBV Öst', city: 'Nyköping' }, // 9 ev i juli, 4 synliga
    { slug: 'malmolive', name: 'Malmö Live' }, // 9 ev i juli, 5 synliga
    { slug: 'gasasteget', name: 'Lunds Dansklubb Gåsasteget', city: 'Lund' }, // 9 ev i juli, 7 synliga
    { slug: 'norrkoping.symphony', name: 'Louis De Geer-hallen Norrköping', city: 'Norrköping' }, // 9 ev i juli, 8 synliga
    { slug: 'lommafolketshus', name: 'Lomma Folkets Hus' }, // 9 ev i juli, 5 synliga
    { slug: 'KBASQUARE', name: 'Kungsbacka Square Dancers', city: 'Kungsbacka' }, // 9 ev i juli, 3 synliga
    { slug: 'kulturmagasinetsundsvall', name: 'Kulturmagasinet Sundsvall', city: 'Sundsvall' }, // 9 ev i juli, 8 synliga
    { slug: 'katalin.uppsala', name: 'Katalin And All That Jazz Östra Station', city: 'Uppsala' }, // 9 ev i juli, 8 synliga
    { slug: 'jkpglm', name: 'Jönköpings läns museum', city: 'Jönköping' }, // 9 ev i juli, 1 synliga
    { slug: 'HotellHulingen', name: 'Hotell Hulingen' }, // 9 ev i juli, 8 synliga
    { slug: 'kalmarnationlund', name: 'Kalmar Nation', city: 'Lund' }, // 9 ev i juli, 6 synliga
    { slug: 'hjartatshus', name: 'Hjärtats hus', city: 'Jönköping' }, // 9 ev i juli, 5 synliga
    { slug: 'hotelmolndalsbroochroyrestaurant', name: 'Hotel Mölndals Bro - Roy Restaurant Café & Bar' }, // 9 ev i juli, 8 synliga
    { slug: 'Gummifabriken', name: 'Gummifabriken i Värnamo' }, // 9 ev i juli, 8 synliga
    { slug: 'baravanlig.se', name: 'Bara Vanlig', city: 'Lund' }, // 9 ev i juli, 8 synliga
    { slug: 'ungdomsgardentimra', name: 'Aktivitetshuset Pangea' }, // 9 ev i juli, 4 synliga
    { slug: 'ArbogaFolketsPark', name: 'Arboga Folkets Park' }, // 9 ev i juli, 8 synliga
    { slug: 'ostersundsbibliotek', name: 'Östersunds Bibliotek' }, // 8 ev i juli, 8 synliga
    { slug: 'orebro.salsafriends.9', name: 'Örebro Salsafriends' }, // 8 ev i juli, 4 synliga
    { slug: 'angebibliotek', name: 'Ånge centralbibliotek' }, // 8 ev i juli, 6 synliga
    { slug: 'WermlandOpera', name: 'Wermland Opera', city: 'Karlstad' }, // 8 ev i juli, 4 synliga
    { slug: 'vnmuseum', name: 'Västernorrlands museum', city: 'Härnösand' }, // 8 ev i juli, 7 synliga
    { slug: 'vilhelmina.folketshus.7', name: 'Vilhelmina Folkets Hus' }, // 8 ev i juli, 3 synliga
    { slug: 'TheTivoli', name: 'The Tivoli', city: 'Helsingborg' }, // 8 ev i juli, 8 synliga
    { slug: 'steamhotel', name: 'The Steam Hotel', city: 'Västerås' }, // 8 ev i juli, 5 synliga
    { slug: 'ThePulsebar2023', name: 'The Pulse' }, // 8 ev i juli, 5 synliga
    { slug: 'SanktJohanneskyrka', name: 'Sankt Johannes kyrka, Malmö' }, // 8 ev i juli, 8 synliga
    { slug: 'sarakulturhus', name: 'Sara kulturhus' }, // 8 ev i juli, 8 synliga
    { slug: 'norskamatorteaterforbund', name: 'Norsk Amatørteaterforbund' }, // 8 ev i juli, 8 synliga
    { slug: 'regionmuseetskane', name: 'Regionmuseet Skåne', city: 'Kristianstad' }, // 8 ev i juli, 4 synliga
    { slug: 'oslonye', name: 'Oslo Nye Teater' }, // 8 ev i juli, 8 synliga
    { slug: 'NaturumVattenriket', name: 'Naturum Vattenriket', city: 'Kristianstad' }, // 8 ev i juli, 2 synliga
    { slug: 'monica.karlsson.399', name: 'Motala biologiska förening', city: 'Motala' }, // 8 ev i juli, 4 synliga
    { slug: 'medeltidsmuseet', name: 'Medeltidsmuseet', city: 'Stockholm' }, // 8 ev i juli, 6 synliga
    { slug: 'naturskyddsforeningen.vanersborg', name: 'Naturskyddsföreningen Vänersborg' }, // 8 ev i juli, 3 synliga
    { slug: 'malmocityskaters', name: 'Malmö City Skaters', city: 'Lund' }, // 8 ev i juli, 8 synliga
    { slug: 'konstmuseet', name: 'Konstmuseet', city: 'Skövde' }, // 8 ev i juli, 5 synliga
    { slug: 'jagvagarstuffa', name: 'Jag vågar stuffa', city: 'Karlshamn' }, // 8 ev i juli, 8 synliga
    { slug: 'gospelgiz', name: 'Joy Singers', city: 'Ljungby' }, // 8 ev i juli, 8 synliga
    { slug: 'hedvigeleonora', name: 'Hedvig Eleonora kyrka' }, // 8 ev i juli, 6 synliga
    { slug: 'hagforskulturochbibliotek', name: 'Hagfors kultur och bibliotek' }, // 8 ev i juli, 7 synliga
    { slug: 'GothenburgSymphonyOrchestra', name: 'Göteborgs Symfoniker' }, // 8 ev i juli, 4 synliga
    { slug: 'fulloflife.tantra', name: 'Full of Life' }, // 8 ev i juli, 2 synliga
    { slug: 'forumbiblioteken', name: 'Forumbiblioteken i Nacka' }, // 8 ev i juli, 6 synliga
    { slug: 'DanshusetDkBuggie', name: 'Dansklubben Buggie i Ulricehamn' }, // 8 ev i juli, 4 synliga
    { slug: 'dansinordnya', name: 'Dans i Nord nya', city: 'Gällivare' }, // 8 ev i juli, 8 synliga
    { slug: 'brasserietboras', name: 'Brasseriet', city: 'Borås' }, // 8 ev i juli, 5 synliga
    { slug: 'Boras.Stadsteater', name: 'Borås Stadsteater', city: 'Borås' }, // 8 ev i juli, 4 synliga
    { slug: 'BibliotekeniKalmarkommun', name: 'Biblioteken i Kalmar kommun', city: 'Kalmar' }, // 8 ev i juli, 8 synliga
    { slug: 'avensbylapland', name: 'Avens by Nature / Västerås Reiki Center', city: 'Västerås' }, // 8 ev i juli, 3 synliga
    { slug: 'ObackaJazz', name: 'Öbacka Jazz&Blues Härnösand', city: 'Härnösand' }, // 7 ev i juli, 8 synliga
    { slug: 'ostfoldteater', name: 'Østfold Teater' }, // 7 ev i juli, 7 synliga
    { slug: 'ostgotateatern', name: 'Östgötateatern', city: 'Norrköping' }, // 7 ev i juli, 3 synliga
    { slug: 'vaxjoloparklubb', name: 'Växjö Löparklubb' }, // 7 ev i juli, 3 synliga
    { slug: 'varbergsolhall', name: 'Varbergs Ölhall', city: 'Varberg' }, // 7 ev i juli, 2 synliga
    { slug: 'vansbrokommun', name: 'Vansbro kommun' }, // 7 ev i juli, 2 synliga
    { slug: 'VXOevent', name: 'VXO event' }, // 7 ev i juli, 8 synliga
    { slug: 'UppsalaBudoklubb', name: 'Uppsala Budoklubb', city: 'Uppsala' }, // 7 ev i juli, 6 synliga
    { slug: 'Sundsvallsmuseum', name: 'Sundsvalls museum', city: 'Sundsvall' }, // 7 ev i juli, 5 synliga
    { slug: 'teaterhalland', name: 'Teater Halland', city: 'Varberg' }, // 7 ev i juli, 6 synliga
    { slug: 'soderhamnsbibblan', name: 'Söderhamns Stadsbibliotek', city: 'Söderhamn' }, // 7 ev i juli, 4 synliga
    { slug: 'stuckonlive', name: 'Stuck On - Live' }, // 7 ev i juli, 8 synliga
    { slug: 'sevallabygdegard', name: 'Sevalla Bygdegård', city: 'Västerås' }, // 7 ev i juli, 7 synliga
    { slug: 'NorrlandTulpaner', name: 'Norrlands Tulpan Trädgård', city: 'Hudiksvall' }, // 7 ev i juli, 5 synliga
    { slug: 'stadshallen', name: 'Stadshallen', city: 'Lund' }, // 7 ev i juli, 6 synliga
    { slug: 'bodyandsoulmovement', name: 'Maria Slättorp - Body & Soul Movement' }, // 7 ev i juli, 5 synliga
    { slug: 'Lakarmissionen', name: 'Läkarmissionen', city: 'Mariestad' }, // 7 ev i juli, 2 synliga
    { slug: 'malmomuseum', name: 'Malmö museum', city: 'Malmö' }, // 7 ev i juli, 7 synliga
    { slug: 'lugersweden', name: 'Luger', city: 'Stockholm' }, // 7 ev i juli, 8 synliga
    { slug: 'kpdmellerud', name: 'Kulturbruket på Dal' }, // 7 ev i juli, 8 synliga
    { slug: 'klostretiystad', name: 'Klostret i Ystad', city: 'Ystad' }, // 7 ev i juli, 5 synliga
    { slug: 'kalix.bibliotek', name: 'Kalix Bibliotek' }, // 7 ev i juli, 7 synliga
    { slug: 'JyskRejsebureau', name: 'Jysk Rejsebureau' }, // 7 ev i juli, 8 synliga
    { slug: 'gallivarekultur', name: 'Gällivare Kultur', city: 'Gällivare' }, // 7 ev i juli, 2 synliga
    { slug: 'foreningensm', name: 'Föreningen Söderhamns Museum', city: 'Söderhamn' }, // 7 ev i juli, 3 synliga
    { slug: 'filmfestsundsvall', name: 'Filmfest Sundsvall', city: 'Sundsvall' }, // 7 ev i juli, 8 synliga
    { slug: 'drakenlive', name: 'Draken Live' }, // 7 ev i juli, 7 synliga
    { slug: 'Discaid', name: 'Discaid', city: 'Borlänge' }, // 7 ev i juli, 2 synliga
    { slug: 'dansofolkton', name: 'Dans & Folkton' }, // 7 ev i juli, 7 synliga
    { slug: 'CirkusStavanger', name: 'CIRKUS' }, // 7 ev i juli, 4 synliga
    { slug: 'WheelsOfCarlshamn', name: 'Cykelklubben Wheels Of Carlshamn', city: 'Karlshamn' }, // 7 ev i juli, 8 synliga
    { slug: 'haningebibliotek', name: 'Biblioteken i Haninge' }, // 7 ev i juli, 6 synliga
    { slug: 'betlehemskyrkan', name: 'Betlehemskyrkan' }, // 7 ev i juli, 8 synliga
    { slug: 'arbogabio', name: 'Arboga bio' }, // 7 ev i juli, 2 synliga
    { slug: 'ostersundskommun', name: 'Östersunds kommun - Staaren tjïelte' }, // 6 ev i juli, 6 synliga
    { slug: 'folkanteater', name: 'Örnsköldsviks Riksteaterförening' }, // 6 ev i juli, 8 synliga
    { slug: 'Levochmaval', name: 'ViveVale', city: 'Lund' }, // 6 ev i juli, 2 synliga
    { slug: 'Vindelnskommunbibliotek', name: 'Vindelns kommunbibliotek' }, // 6 ev i juli, 3 synliga
    { slug: 'tradgarn', name: 'Trädgår\'n' }, // 6 ev i juli, 8 synliga
    { slug: 'meraloppis', name: 'Ulf Andersson' }, // 6 ev i juli, 2 synliga
    { slug: 'swingum400', name: 'Swingum' }, // 6 ev i juli, 5 synliga
    { slug: 'solvesborgcsk', name: 'Stortorget Sölvesborg', city: 'Sölvesborg' }, // 6 ev i juli, 2 synliga
    { slug: 'stockholmsmarknader', name: 'Stockholmsmarknader' }, // 6 ev i juli, 4 synliga
    { slug: 'Studieforbundetbildanord', name: 'Studieförbundet Bilda Nord' }, // 6 ev i juli, 8 synliga
    { slug: 'stockholmjazz', name: 'Stockholm Jazz Festival', city: 'Stockholm' }, // 6 ev i juli, 8 synliga
    { slug: 'skanskabyggvaror', name: 'Skånska Byggvaror', city: 'Göteborg' }, // 6 ev i juli, 4 synliga
    { slug: 'situpcomedy', name: 'Sit-up comedy show' }, // 6 ev i juli, 2 synliga
    { slug: 'sagabioflen', name: 'Saga Bio, Flen' }, // 6 ev i juli, 2 synliga
    { slug: 'obosisverige', name: 'OBOS i Sverige', city: 'Uppsala' }, // 6 ev i juli, 4 synliga
    { slug: 'pitea.se', name: 'Piteå kommun' }, // 6 ev i juli, 4 synliga
    { slug: 'naturskyddsforeningenigoteborg', name: 'Naturskyddsföreningen i Göteborg', city: 'Göteborg' }, // 6 ev i juli, 5 synliga
    { slug: 'mikespubskovde', name: 'Mikes pub och restaurang', city: 'Skövde' }, // 6 ev i juli, 2 synliga
    { slug: 'lisebergab', name: 'Liseberg' }, // 6 ev i juli, 5 synliga
    { slug: 'LandskronaBK', name: 'Landskrona Brukshundklubb', city: 'Landskrona' }, // 6 ev i juli, 2 synliga
    { slug: 'inger.ericson.7', name: 'Inger Ericson', city: 'Stockholm' }, // 6 ev i juli, 1 synliga
    { slug: 'landskronasurfcenter', name: 'Landskrona SurfCenter', city: 'Landskrona' }, // 6 ev i juli, 2 synliga
    { slug: 'mittlandplus', name: 'Kultur i Ånge Kommun' }, // 6 ev i juli, 8 synliga
    { slug: 'borgmastarvilla', name: 'Hotell Humbla', city: 'Sölvesborg' }, // 6 ev i juli, 2 synliga
    { slug: 'gnosjobibliotek', name: 'Gnosjö kultur & bibliotek' }, // 6 ev i juli, 3 synliga
    { slug: 'ginanykvist', name: 'Hojkompisar Stockholm med omnejd', city: 'Stockholm' }, // 6 ev i juli, 1 synliga
    { slug: 'FylgjaHelandeHarmoni', name: 'Fylgja - helande harmoni', city: 'Sundsvall' }, // 6 ev i juli, 8 synliga
    { slug: 'Familjecentralen.Ulricehamn', name: 'Familjecentralen, Öppna förskolan i Ulricehamn' }, // 6 ev i juli, 5 synliga
    { slug: 'FrokenLarssonHandelsbod', name: 'Fröken Larsson Vintage, Antikt & Secondhand' }, // 6 ev i juli, 1 synliga
    { slug: 'Falkopingsbibliotek', name: 'Falköpings bibliotek' }, // 6 ev i juli, 5 synliga
    { slug: 'dragonflystudioavesta', name: 'Dragonfly Studio' }, // 6 ev i juli, 3 synliga
    { slug: 'Drammensacred', name: 'Drammen Sacred Music Festival' }, // 6 ev i juli, 8 synliga
    { slug: 'dalarnasmuseum', name: 'Dalarnas museum', city: 'Falun' }, // 6 ev i juli, 2 synliga
    { slug: 'mikaelgottberg', name: 'Carlsson På Kajen', city: 'Västerås' }, // 6 ev i juli, 3 synliga
    { slug: 'Blojupproret', name: 'Blöjupproret, Sveriges förening för EC och tygblöjor', city: 'Lund' }, // 6 ev i juli, 8 synliga
    { slug: 'bibliotekljusdal', name: 'Biblioteken i Ljusdals kommun' }, // 6 ev i juli, 5 synliga
    { slug: 'backa.teater', name: 'Backa Teater' }, // 6 ev i juli, 3 synliga
    { slug: 'babblarnalive', name: 'Babblarna på scen', city: 'Uppsala' }, // 6 ev i juli, 3 synliga
    { slug: 'arttourssthlm', name: 'Art Tours Sthlm', city: 'Stockholm' }, // 6 ev i juli, 4 synliga
    { slug: 'anebybibliotek', name: 'Aneby bibliotek' }, // 6 ev i juli, 6 synliga
    { slug: 'alexhermanssonshow', name: 'Alex Hermansson', city: 'Lund' }, // 6 ev i juli, 8 synliga
    { slug: 'ABFKiruna', name: 'ABF Norr Kiruna', city: 'Kiruna' }, // 6 ev i juli, 8 synliga
    { slug: 'ostersundskulturskola', name: 'Östersunds Kulturskola' }, // 5 ev i juli, 6 synliga
    { slug: 'aterstallvatmarker', name: 'Återställ Våtmarker', city: 'Stockholm' }, // 5 ev i juli, 2 synliga
    { slug: 'Astorpskommun', name: 'Åstorps kommun' }, // 5 ev i juli, 2 synliga
    { slug: 'alvsbyn', name: 'Älvsbyn' }, // 5 ev i juli, 8 synliga
    { slug: 'YogaZonBorgholm', name: 'YogaZon' }, // 5 ev i juli, 1 synliga
    { slug: 'karlecafe', name: 'karl-e' }, // 5 ev i juli, 5 synliga
    { slug: 'willhemab', name: 'Willhem AB', city: 'Göteborg' }, // 5 ev i juli, 1 synliga
    { slug: 'varnamocity', name: 'Värnamo City' }, // 5 ev i juli, 2 synliga
    { slug: 'vindeln', name: 'Vindelns Kommun' }, // 5 ev i juli, 2 synliga
    { slug: 'vedeldspizzan', name: 'Vedeldspizzan', city: 'Göteborg' }, // 5 ev i juli, 2 synliga
    { slug: 'jansvenssontrubadur', name: 'Trubadur Jan Svensson Musik Produktion', city: 'Uddevalla' }, // 5 ev i juli, 8 synliga
    { slug: 'herrestadsaiffotbollherr', name: 'Undavallen' }, // 5 ev i juli, 1 synliga
    { slug: 'TeaterDictat', name: 'Teater Dictat' }, // 5 ev i juli, 3 synliga
    { slug: 'sollentunakommun', name: 'Sollentuna kommun' }, // 5 ev i juli, 5 synliga
    { slug: 'SkolsimmarnaIK', name: 'Skolsimmarna IK' }, // 5 ev i juli, 3 synliga
    { slug: 'SensusOstersund', name: 'Sensus Östersund' }, // 5 ev i juli, 8 synliga
    { slug: 'rfsisuvn', name: 'RF - SISU Västernorrland', city: 'Härnösand' }, // 5 ev i juli, 1 synliga
    { slug: 'quiztyreso', name: 'QUIZ - Tyresö' }, // 5 ev i juli, 1 synliga
    { slug: 'poffertjes.se', name: 'Poffertjes.se' }, // 5 ev i juli, 1 synliga
    { slug: 'planbmalmo', name: 'Plan B - malmö' }, // 5 ev i juli, 8 synliga
    { slug: 'nykopings.folkhogskola', name: 'Nyköpings Folkhögskola', city: 'Nyköping' }, // 5 ev i juli, 7 synliga
    { slug: 'naringslivsoderhamn', name: 'Näringsliv Söderhamns kommun', city: 'Söderhamn' }, // 5 ev i juli, 8 synliga
    { slug: 'northcreativenodes', name: 'North Creative Nodes', city: 'Boden' }, // 5 ev i juli, 7 synliga
    { slug: 'nordiskakammarorkestern', name: 'Nordiska Kammarorkestern', city: 'Sundsvall' }, // 5 ev i juli, 5 synliga
    { slug: 'nfacademy', name: 'NF Academy' }, // 5 ev i juli, 6 synliga
    { slug: 'musikilerum', name: 'Musik i Lerum' }, // 5 ev i juli, 2 synliga
    { slug: 'Mordmysterium', name: 'Mordmysterium' }, // 5 ev i juli, 6 synliga
    { slug: 'mediumcamilla', name: 'Medium Camilla', city: 'Linköping' }, // 5 ev i juli, 3 synliga
    { slug: 'mjolbykommun', name: 'Mjölby kommun', city: 'Mjölby' }, // 5 ev i juli, 1 synliga
    { slug: 'MusikcentrumVast', name: 'MCV - Musikcentrum Väst' }, // 5 ev i juli, 8 synliga
    { slug: 'lindblomacademy', name: 'Lindblom Academy Inner Spirit Light', city: 'Västerås' }, // 5 ev i juli, 8 synliga
];
