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
    { slug: 'Campingkul', name: 'Campingkul', city: 'Lidköping' }, // 30 ev i juli, 8 synliga
    { slug: 'scensommar', name: 'Scensommar', city: 'Ljungby' }, // 24 ev i juli, 8 synliga
    { slug: 'Hot.Events.Page.USA', name: 'Hot Events.' }, // 20 ev i juli, 8 synliga
    { slug: 'ClassicCarWeek', name: 'Classic Car Week' }, // 19 ev i juli, 2 synliga
    { slug: 'ArrangemangLund', name: 'Arrangemang Lund', city: 'Lund' }, // 17 ev i juli, 5 synliga
    { slug: 'taystase', name: 'Taysta', city: 'Uppsala' }, // 16 ev i juli, 8 synliga
    { slug: 'Vaxjodyksport', name: 'Växjödyksport', city: 'Växjö' }, // 15 ev i juli, 8 synliga
    { slug: 'bioroy', name: 'Bio Roy' }, // 15 ev i juli, 8 synliga
    { slug: 'sommarscen', name: 'Malmö Sommarscen' }, // 15 ev i juli, 5 synliga
    { slug: 'kackelstugan', name: 'Kackelstugan' }, // 13 ev i juli, 6 synliga
    { slug: 'bohuslanguider', name: 'Bohusläns Guider' }, // 13 ev i juli, 7 synliga
    { slug: 'nfacademy', name: 'NF Academy' }, // 12 ev i juli, 8 synliga
    { slug: 'gretasgothenburg', name: 'Gretas Göteborg', city: 'Göteborg' }, // 12 ev i juli, 8 synliga
    { slug: 'Dundermarknaden', name: 'Dundermarknaden' }, // 12 ev i juli, 7 synliga
    { slug: 'caferosenhill', name: 'Café Rosenhill' }, // 12 ev i juli, 7 synliga
    { slug: 'naturumSkrylle', name: 'naturum Skrylle' }, // 10 ev i juli, 4 synliga
    { slug: 'rixfmfestival', name: 'RIX FM Festival', city: 'Stockholm' }, // 10 ev i juli, 8 synliga
    { slug: 'medeltidsmuseet', name: 'Medeltidsmuseet', city: 'Stockholm' }, // 10 ev i juli, 8 synliga
    { slug: 'HotellHulingen', name: 'Hotell Hulingen' }, // 10 ev i juli, 8 synliga
    { slug: 'gronalundstivoli', name: 'Gröna Lund', city: 'Stockholm' }, // 10 ev i juli, 8 synliga
    { slug: 'hotellbellevue', name: 'Hotell Bellevue' }, // 10 ev i juli, 8 synliga
    { slug: 'Faluguide', name: 'Faluguide', city: 'Falun' }, // 10 ev i juli, 1 synliga
    { slug: 'trelleborgen', name: 'Trelleborgen', city: 'Trelleborg' }, // 9 ev i juli, 3 synliga
    { slug: 'surfviken', name: 'Surfviken' }, // 9 ev i juli, 7 synliga
    { slug: 'olearysgavle', name: 'O\'Learys Gävle', city: 'Gävle' }, // 9 ev i juli, 2 synliga
    { slug: 'jtmtrio', name: 'JTM Trio', city: 'Lycksele' }, // 9 ev i juli, 8 synliga
    { slug: 'rattvikbutchers', name: 'Rättvik Butchers' }, // 9 ev i juli, 4 synliga
    { slug: 'linkopingairswing', name: 'Dansbanan I Gamla Linköping', city: 'Linköping' }, // 9 ev i juli, 4 synliga
    { slug: 'soderkopingsbio', name: 'Söderköpings Bio' }, // 8 ev i juli, 2 synliga
    { slug: 'vaniumeasida', name: 'Vän i Umeå' }, // 8 ev i juli, 6 synliga
    { slug: 'stina.helmersson', name: 'Stina Helmersson', city: 'Olofström' }, // 8 ev i juli, 3 synliga
    { slug: 'tandsticksmuseet', name: 'Tändsticksmuseet', city: 'Jönköping' }, // 8 ev i juli, 5 synliga
    { slug: 'spokguiden', name: 'Spökguiden' }, // 8 ev i juli, 5 synliga
    { slug: 'stenhusetgille', name: 'Stenhuset' }, // 8 ev i juli, 3 synliga
    { slug: 'frimisorebro', name: 'Frimis' }, // 8 ev i juli, 8 synliga
    { slug: 'Alfredsspelobar', name: 'Stures Krog', city: 'Lidköping' }, // 7 ev i juli, 2 synliga
    { slug: 'klostretiystad', name: 'Klostret i Ystad', city: 'Ystad' }, // 7 ev i juli, 6 synliga
    { slug: 'redbullevents', name: 'Red Bull Events', city: 'Göteborg' }, // 7 ev i juli, 8 synliga
    { slug: 'frilandsmusset', name: 'Fiskartorpet' }, // 7 ev i juli, 4 synliga
    { slug: 'susanne.swantesson', name: 'Alternativ-Mässa', city: 'Göteborg' }, // 7 ev i juli, 6 synliga
    { slug: 'engelholmsrevyn', name: 'Engelholmsrevyn' }, // 7 ev i juli, 8 synliga
    { slug: 'varlokal', name: 'Vår lokal' }, // 6 ev i juli, 8 synliga
    { slug: 'Upplandsmuseet', name: 'Upplandsmuseet', city: 'Uppsala' }, // 6 ev i juli, 4 synliga
    { slug: 'upplevlandskronaven', name: 'Teaterparken' }, // 6 ev i juli, 8 synliga
    { slug: 'TheTivoli', name: 'The Tivoli', city: 'Helsingborg' }, // 6 ev i juli, 8 synliga
    { slug: 'solvesborgcsk', name: 'Stortorget Sölvesborg', city: 'Sölvesborg' }, // 6 ev i juli, 6 synliga
    { slug: 'BrygganSMB', name: 'Bryggan' }, // 6 ev i juli, 2 synliga
    { slug: 'Kungalvsparken', name: 'Kungälvs Parken' }, // 6 ev i juli, 8 synliga
    { slug: 'anebybibliotek', name: 'Aneby bibliotek' }, // 6 ev i juli, 4 synliga
    { slug: 'vastanforsbandy', name: 'Västanforsbandy' }, // 5 ev i juli, 1 synliga
    { slug: 'yoganovisen', name: 'YogaNovisen' }, // 5 ev i juli, 1 synliga
    { slug: 'MalinNilssonMagician', name: 'Varieté Voljär', city: 'Simrishamn' }, // 5 ev i juli, 1 synliga
    { slug: 'visitkumla', name: 'Visit Kumla' }, // 5 ev i juli, 2 synliga
    { slug: 'meraloppis', name: 'Ulf Andersson' }, // 5 ev i juli, 4 synliga
    { slug: 'scenosterlen', name: 'Scen Österlen', city: 'Simrishamn' }, // 5 ev i juli, 2 synliga
    { slug: 'Skadibmt', name: 'Skadi' }, // 5 ev i juli, 2 synliga
    { slug: 'Molekylverkstan', name: 'Molekylverkstan' }, // 5 ev i juli, 4 synliga
    { slug: 'mjolbykommun', name: 'Mjölby kommun', city: 'Mjölby' }, // 5 ev i juli, 1 synliga
    { slug: 'nederlulea', name: 'Nederluleå kyrka' }, // 5 ev i juli, 6 synliga
    { slug: 'MittsverigebananHarnosand', name: 'Mittsverigebanan', city: 'Härnösand' }, // 5 ev i juli, 3 synliga
    { slug: 'mats.fuchs.9', name: 'Mats Fuchs' }, // 5 ev i juli, 1 synliga
    { slug: 'LukeCombs', name: 'Luke Combs' }, // 5 ev i juli, 8 synliga
    { slug: 'roselandvisby', name: 'Kruttornet' }, // 5 ev i juli, 1 synliga
    { slug: 'gamlahalmstad', name: 'Gamla Halmstad', city: 'Halmstad' }, // 5 ev i juli, 6 synliga
    { slug: 'konstmuseet', name: 'Konstmuseet', city: 'Skövde' }, // 5 ev i juli, 5 synliga
    { slug: 'Droskan.se', name: 'DROSKAN' }, // 5 ev i juli, 4 synliga
    { slug: 'bally.love.1', name: 'Bally Love', city: 'Kalmar' }, // 5 ev i juli, 8 synliga
    { slug: 'TillsammansHoor', name: 'Tillsammans Höör' }, // 4 ev i juli, 6 synliga
    { slug: 'Tangokompaniet', name: 'Tangokompaniet' }, // 4 ev i juli, 4 synliga
    { slug: 'steelhotelsmedjebacken', name: 'Steel Hotel' }, // 4 ev i juli, 3 synliga
    { slug: 'sprangsten', name: 'Sprängsten' }, // 4 ev i juli, 2 synliga
    { slug: 'kulturfritidtrelleborg', name: 'Stadsparken' }, // 4 ev i juli, 3 synliga
    { slug: 'skovdekulturhus', name: 'Skövde Kulturhus', city: 'Skövde' }, // 4 ev i juli, 8 synliga
    { slug: 'juan.c.diaz.906', name: 'Paddla SUP & Tälta i Sverige' }, // 4 ev i juli, 8 synliga
    { slug: 'junisalvsborgdistrikt', name: 'Movendi Älvsborg', city: 'Borås' }, // 4 ev i juli, 3 synliga
    { slug: 'malnhavochkrog', name: 'MALN Hav & Krog', city: 'Hudiksvall' }, // 4 ev i juli, 8 synliga
    { slug: 'VeloxSkane', name: 'Malmö airsoft Indoor Arena' }, // 4 ev i juli, 2 synliga
    { slug: 'laneloge.se', name: 'Lane Loge', city: 'Uddevalla' }, // 4 ev i juli, 3 synliga
    { slug: 'vadhanderiuppsala', name: 'Händer i Uppsala', city: 'Uppsala' }, // 4 ev i juli, 7 synliga
    { slug: 'kraxagarden', name: 'Kraxagården' }, // 4 ev i juli, 8 synliga
    { slug: 'GavleRave', name: 'Gävle, Gävleborgs län', city: 'Gävle' }, // 4 ev i juli, 6 synliga
    { slug: 'bortansikolympia', name: 'Gunnarskog, Värmland' }, // 4 ev i juli, 8 synliga
    { slug: 'fritidibjuv', name: 'Fritid i Bjuv' }, // 4 ev i juli, 2 synliga
    { slug: 'bradspelskafeet', name: 'Brädspelskaféet', city: 'Karlshamn' }, // 4 ev i juli, 5 synliga
    { slug: 'GavleborgTaxklubb', name: 'Boulognerskogen, Gävle', city: 'Gävle' }, // 4 ev i juli, 8 synliga
    { slug: 'boulognerskogenparkrun', name: 'Boulognerskogen' }, // 4 ev i juli, 5 synliga
    { slug: 'ArkenZooHalmstadStenalyckan', name: 'Arken Zoo', city: 'Halmstad' }, // 4 ev i juli, 1 synliga
    { slug: 'Samrong.sombat.mt', name: 'ACAPOEIRA SWEDEN' }, // 4 ev i juli, 1 synliga
    { slug: 'webnode.se', name: 'YogaKajsa', city: 'Eslöv' }, // 3 ev i juli, 8 synliga
    { slug: 'vaxjoloparklubb', name: 'Växjö Löparklubb' }, // 3 ev i juli, 8 synliga
    { slug: 'ungitibro', name: 'UngiTibro' }, // 3 ev i juli, 2 synliga
    { slug: 'Tarabband', name: 'TARABBAND', city: 'Stockholm' }, // 3 ev i juli, 2 synliga
    { slug: '100090173421423', name: 'Studio Koxa' }, // 3 ev i juli, 2 synliga
    { slug: 'borascity', name: 'Stora Torget, Borås', city: 'Borås' }, // 3 ev i juli, 8 synliga
    { slug: 'StNikolaikyrka', name: 'St Nikolai kyrka' }, // 3 ev i juli, 8 synliga
    { slug: 'conventumorebro', name: 'Sommarlovskul.se' }, // 3 ev i juli, 8 synliga
    { slug: 'Roslagsmuseet', name: 'Roslagsmuseet', city: 'Norrtälje' }, // 3 ev i juli, 1 synliga
    { slug: 'Palmfestivalen', name: 'Palmfestivalen' }, // 3 ev i juli, 4 synliga
    { slug: 'norrvikenbastad', name: 'Norrviken' }, // 3 ev i juli, 1 synliga
    { slug: 'mkrs.se', name: 'MKRS' }, // 3 ev i juli, 1 synliga
    { slug: 'lotti.lundblad', name: 'Lotti Lundblad' }, // 3 ev i juli, 8 synliga
    { slug: 'laughseats', name: 'Laugh Seats' }, // 3 ev i juli, 8 synliga
    { slug: 'vastbosportdansklubb', name: 'Folkets Park Värnamo' }, // 3 ev i juli, 1 synliga
    { slug: 'GekasUllared', name: 'Gekås Ullared' }, // 3 ev i juli, 2 synliga
    { slug: 'christian.andersson.3150', name: 'Östergötlands Rc trail sällskap' }, // 2 ev i juli, 8 synliga
    { slug: 'horisont.ycs', name: 'Visby, Gotland Island, Sweden', city: 'Visby' }, // 2 ev i juli, 8 synliga
    { slug: 'wijtradgardar', name: 'Wij Trädgårdar' }, // 2 ev i juli, 8 synliga
    { slug: 'vatmoro', name: 'Våt Moro' }, // 2 ev i juli, 1 synliga
    { slug: 'sommarrocksvedala', name: 'Vad händer i Skåne' }, // 2 ev i juli, 8 synliga
    { slug: 'vadhanderistockholm', name: 'Vad som händer i Stockholm', city: 'Stockholm' }, // 2 ev i juli, 5 synliga
    { slug: 'Torreby.Castle', name: 'Torreby Slott' }, // 2 ev i juli, 8 synliga
    { slug: 'svaneholmsslott', name: 'Svaneholms slott' }, // 2 ev i juli, 8 synliga
    { slug: 'hotellkarlshamn', name: 'Stortorget Karlshamn', city: 'Karlshamn' }, // 2 ev i juli, 1 synliga
    { slug: 'mandagsrorelseilkpg', name: 'Stora torget Linköping', city: 'Linköping' }, // 2 ev i juli, 1 synliga
    { slug: 'stalpet', name: 'Stalpet' }, // 2 ev i juli, 2 synliga
    { slug: 'CountryPopLovers', name: 'Solna, Stockholm, Sweden', city: 'Stockholm' }, // 2 ev i juli, 7 synliga
    { slug: 'sdknacken', name: 'SDK Näcken', city: 'Katrineholm' }, // 2 ev i juli, 2 synliga
    { slug: 'revivefalkoping', name: 'Revive Falköping' }, // 2 ev i juli, 8 synliga
    { slug: 'ullakarinbella.johansson', name: 'Oxelösund' }, // 2 ev i juli, 6 synliga
    { slug: 'anders.djerf', name: 'Norrtälje - Vad händer på byn?', city: 'Norrtälje' }, // 2 ev i juli, 1 synliga
    { slug: 'nipyran', name: 'Nipyran' }, // 2 ev i juli, 8 synliga
    { slug: 'nattsuddbar', name: 'Nattsudd' }, // 2 ev i juli, 1 synliga
    { slug: 'fincha.carter', name: 'Mönsterås, Kalmar län', city: 'Kalmar' }, // 2 ev i juli, 1 synliga
    { slug: 'strawberryarena', name: 'Music Play' }, // 2 ev i juli, 8 synliga
    { slug: '1mr.langos', name: 'Mr.Lángos', city: 'Karlskrona' }, // 2 ev i juli, 8 synliga
    { slug: 'Mamasrestaurang', name: 'Mama’s' }, // 2 ev i juli, 5 synliga
    { slug: 'teslaownerssweden', name: 'Lycksele, Västerbottens län', city: 'Lycksele' }, // 2 ev i juli, 8 synliga
    { slug: 'historierfranhalsingland', name: 'Ljusdals hembygdsgård' }, // 2 ev i juli, 2 synliga
    { slug: 'karlskronabibliotek', name: 'Karlskrona Stadsbibliotek', city: 'Karlskrona' }, // 2 ev i juli, 5 synliga
    { slug: 'bjorkholmensbyalag', name: 'Karlskrona, Blekinge län', city: 'Karlskrona' }, // 2 ev i juli, 1 synliga
    { slug: 'karlskogakonsertforening', name: 'Karlskoga, Örebro län' }, // 2 ev i juli, 4 synliga
    { slug: 'eriksvik.finnkroken', name: 'Eriksvik' }, // 2 ev i juli, 5 synliga
    { slug: 'cecilia.arlebo', name: 'Cissi Ärlebo' }, // 2 ev i juli, 4 synliga
    { slug: 'Brannoforeningen', name: 'Brännöföreningen' }, // 2 ev i juli, 7 synliga
    { slug: 'trivselbanan', name: 'Bollnästravet' }, // 2 ev i juli, 8 synliga
    { slug: 'kfjamtland', name: 'Badhusparken Östersund' }, // 2 ev i juli, 7 synliga
    { slug: 'aspobygdegard', name: 'Aspö Bygdegård', city: 'Strängnäs' }, // 2 ev i juli, 8 synliga
    { slug: 'AsaBygdegard', name: 'Asa Bygdegård' }, // 2 ev i juli, 4 synliga
    { slug: 'SvenskaDvarghundsklubben', name: 'Apalby IP' }, // 2 ev i juli, 2 synliga
    { slug: 'arbogabio', name: 'Arboga bio' }, // 2 ev i juli, 1 synliga
];
