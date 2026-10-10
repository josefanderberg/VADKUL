/**
 * hockeyArenas.ts — ishockeyarenor → ort, för swehockey-källorna.
 *
 * Förbundets scheman (stats.swehockey.se) har BARA arenanamnet. Orten ger
 * runnern nearCity-skyddet och stadscentroiden som golv. Utan den:
 *   - namnkrockar: "LF Arena" finns i både Västervik och Piteå, "Torvalla
 *     ishall" i både Haninge och Östersund, "Lejonhallen" och "Oasen" har
 *     namnar på annat håll — fritext-Nominatim gav Varberg, Norge och Danmark;
 *   - sponsornamnen ("KFK Mekan Arena", "ICA Maxi Arena" …) saknas i OSM eller
 *     pekar på en annan ort med samma sponsor (ICA Maxi → Visby, Team Sportia
 *     → Motala), och en miss utan ort blir 0,0 (HA-arenorna 28/9, venueFixes).
 *
 * `city`  — orten arenan ligger i (tätort; kommunnamn bara där tätorten är
 *           osäker). Varje rad kollad 2026-10-10: Nominatim-träff på arenan i
 *           orten, eller hemmalagets ort + serie/motståndare när OSM saknar
 *           arenan. Orten slås upp som "<ort>, Sverige" (geocodeCityCentroid) —
 *           alla 171 orter gav rätt ort där.
 * `osm`   — byggnadens namn i OpenStreetMap när sponsornamnet inte finns där;
 *           provas först.
 * `foreign` — arenan ligger utomlands (danska lag spelar i södra serierna);
 *           matcherna där hoppas över, kartan är svensk.
 * `coords` — verifierad position (adress ur klubbens/kommunens sida, källan i
 *           kommentaren) för arenor som saknas i OSM i orter där ortnamnet
 *           geokodas till KOMMUNENS mittpunkt — Krokom 47 km, Orsa 21, Ludvika
 *           20 km från tätorten (10/10). Skickas som eventets koordinater; ingen
 *           geokodning. Här och inte i venueFixes: venueFixes matchar namnet i
 *           ALLA källor, och "Hitachi Arena" finns också i Västerås.
 *
 * Säsong 2026/27: Hockeyettan + alla U18/U20-serier. Okända arenor loggas av
 * motorn ("okänd arena") och geokodas på hemmalagets ort — lägg till dem här.
 */

export interface HockeyArena {
    city: string;
    osm?: string;
    foreign?: true;
    coords?: [number, number];
}

export const HOCKEY_ARENAS: Record<string, HockeyArena> = {
    'ABB Arena Nord': { city: 'Västerås' },
    'Allhallen': { city: 'Ekerö' },
    'Arena Grosvad': { city: 'Finspång' },
    'Askims Ishall': { city: 'Göteborg' },
    'Avestahallen': { city: 'Avesta' },
    'Axelent Arena': { city: 'Värnamo' },
    'Bahcohallen': { city: 'Enköping' },
    'Be-Ge Hockey Center': { city: 'Oskarshamn' },
    'Behrn Arena': { city: 'Örebro' },
    'Billerudhallen': { city: 'Grums' },
    'Billingehov': { city: 'Skövde' },
    'Bjäre Entreprenad Arena': { city: 'Ängelholm' },       // Rögle BK:s träningshallar vid Catena Arena
    'Bjäre Markkonsult Arena': { city: 'Ängelholm' },
    'Bjästa Ishall': { city: 'Bjästa' },
    'Björkhallen': { city: 'Kristinehamn' },                // fritext gav en holme i Arboga
    'Björknäs Ishall': { city: 'Nacka' },
    'Björkängshallen': { city: 'Huddinge' },
    'Bollnäs Ishall': { city: 'Bollnäs' },
    'Borlänge Ishall': { city: 'Borlänge' },
    'Borås Ishall': { city: 'Borås' },
    'Brandcode Center': { city: 'Sundsvall' },
    'Brätte Ishall': { city: 'Vänersborg' },
    'CYLOQ Arena': { city: 'Sollentuna' },
    'Catena Arena': { city: 'Ängelholm' },
    'Clas Ohlson Foundation Arena': { city: 'Leksand' },    // Leksands IF + Häradsbygdens SS
    'Coop Norrbotten Arena': { city: 'Luleå' },
    'DIÖ Ishall': { city: 'Diö' },
    'Dackehallen': { city: 'Tingsryd' },
    'Ekhallen': { city: 'Gustavsberg' },
    'Elite Sängar Arena': { city: 'Kungsör' },
    'Exakt Arena': { city: 'Lidingö' },
    'FD Maskin Arena': { city: 'Kovland' },
    'Falu Expressbyrå Arena': { city: 'Falun' },
    'Farsta Ishall': { city: 'Stockholm' },
    'Fridhemshallen': { city: 'Uddevalla' },
    'Frölundaborg Isstadion': { city: 'Göteborg' },
    'Furudals Hockeycenter': { city: 'Furudal' },
    'Gimo Ishall': { city: 'Gimo' },
    'Gislerinken': { city: 'Gislaved' },
    'Gränby Ishallar A-hall': { city: 'Uppsala' },
    'Gränbyhallen (B)': { city: 'Uppsala' },
    'Gyllene Balken Arena': { city: 'Arboga' },
    'HCL Tech Arena': { city: 'Stockholm' },                // IK Göta, Region Öst
    'HIVE Arena': { city: 'Boden' },
    'Halmstad Arena': { city: 'Halmstad' },
    'Hammarö Ishall': { city: 'Skoghall' },
    'Hanvedens ishall': { city: 'Handen' },
    'Hatstore Arena': { city: 'Kalmar' },
    'Hedesunda Ishall': { city: 'Hedesunda' },
    'Helmia Arena': { city: 'Sunne' },
    'Himmelstalundshallen': { city: 'Norrköping' },
    'Hitachi Arena': { city: 'Ludvika' },                   // fritext gav en plan i Västerås
    'Hofors Ishall': { city: 'Hofors' },
    'Holmen Center': { city: 'Hudiksvall' },
    'Hovet, Johanneshov': { city: 'Stockholm' },
    'Husqvarna Garden': { city: 'Jönköping' },
    'Husumhallen': { city: 'Husum' },
    'Hägernäs Ishall': { city: 'Täby' },
    'Hägglunds Arena': { city: 'Örnsköldsvik' },
    'Höglandsrinken': { city: 'Nässjö' },
    'Höörs Ishall': { city: 'Höör' },
    'ICA Maxi Arena': { city: 'Kumla' },                    // fritext gav Visby
    'Ica Riksten Arena': { city: 'Tullinge' },
    'Internetport Arena': { city: 'Hudiksvall' },           // Lindefallets SK, Hudiksvalls kommun
    'Isbjörnen': { city: 'Skellefteå' },                    // SK Lejon; fritext gav ett kvarter i Stockholm
    'Ishallen Lidköping': { city: 'Lidköping' },
    'Ishuset': { city: 'Tumba' },                           // fritext gav Danmark
    'Isstadion LF Arena': { city: 'Piteå', osm: 'LF Arena' },
    'Jonstorps Ishall': { city: 'Jonstorp' },
    'Järfälla Ishall': { city: 'Järfälla' },
    'Järna Ishall': { city: 'Järna' },
    'Jössarinken A-hall': { city: 'Mörrum', osm: 'Jössarinken' },
    'Jössarinken B-hall': { city: 'Mörrum', osm: 'Jössarinken' },
    'KFK Mekan Arena': { city: 'Vetlanda' },
    'Kaj Johansson Arena': { city: 'Vännäs' },
    'Kastbergshallen': { city: 'Ånge' },
    'Kasthallen': { city: 'Gävle' },
    'Klanghallen': { city: 'Brunflo' },
    'Kopparhallen': { city: 'Skellefteå' },
    'Kristianstads Ishall': { city: 'Kristianstad' },
    'Kungsbacka Ishall (A)': { city: 'Kungsbacka' },
    'Kungsbacka Ishall (B)': { city: 'Kungsbacka' },
    'KvB Hallen': { city: 'Åstorp' },
    'Kvibergs Parks is- och sporthall': { city: 'Göteborg' },
    'Kärrtorps IP': { city: 'Stockholm' },
    'Kållereds Ishall': { city: 'Kållered' },
    'Köpings Ishall': { city: 'Köping' },
    'LF Arena': { city: 'Västervik' },                      // namnet finns även i Piteå
    'Landskrona Ishall A': { city: 'Landskrona' },
    'Landvetters Ishall': { city: 'Landvetter' },
    'Lassalyckans Ishall A-hall': { city: 'Ulricehamn' },
    'Lejonhallen': { city: 'Huddinge' },                    // Brinkens IF, Region Öst — namnen i Varberg är fel hall
    'Liljas Arena': { city: 'Nybro' },
    'Lilla Hallen': { city: 'Nyköping', osm: 'Rosvalla' },
    'Lillstrimma hallen': { city: 'Timrå' },
    'Limhamns Ishall': { city: 'Malmö' },
    'Lindbergs Arena': { city: 'Björklinge' },
    'Lindehov': { city: 'Lindesberg' },
    'Lionshov Ishall': { city: 'Strömstad' },
    'Lombiahallen': { city: 'Kiruna', osm: 'Lombia ishall' },
    'Lulebohallen': { city: 'Luleå' },
    'Lunds Ishall': { city: 'Lund' },
    'Lödöseborg': { city: 'Lödöse' },
    'Löfbergs Arena': { city: 'Karlstad' },
    'Löfbergs Ice Arena': { city: 'Karlstad' },
    'MP Bolagen Arena': { city: 'Vetlanda' },
    'Malmhallen': { city: 'Boliden' },
    'Malmö Isstadion': { city: 'Malmö' },
    'Malungs Ishall': { city: 'Malung' },
    'Marconihallen': { city: 'Göteborg' },
    'Mariehus Arena': { city: 'Mariestad' },
    'MerElArena': { city: 'Hällefors' },
    'Mimerhallen (Rocklunda B)': { city: 'Västerås' },
    'Modin & Zetterberg Hallen': { city: 'Sundsvall' },     // Njurunda
    'Monitor ERP Arena': { city: 'Gävle' },
    'Monitor ERP Arena (B)': { city: 'Gävle' },
    'Movalla Ishall': { city: 'Skillingaryd' },
    'Munkfors Arena': { city: 'Munkfors' },
    'Mälarhöjdens Ishall': { city: 'Stockholm' },
    'Mälarhöjdens Ishall 2': { city: 'Stockholm' },
    'Månsbrorinken': { city: 'Södertälje' },
    'Månskensrinken': { city: 'Västerås' },
    'NEH Hallen': { city: 'Nora' },
    'NKT Arena Karlskrona A-Hall': { city: 'Karlskrona', osm: 'NKT Arena Karlskrona' },
    'NKT Arena Karlskrona B-Hall': { city: 'Karlskrona', osm: 'NKT Arena Karlskrona' },
    'Nacka Ishall': { city: 'Nacka' },
    'NickBack Arena': { city: 'Valbo' },
    'Niphallen': { city: 'Sollefteå' },
    'Nittorps Ishall': { city: 'Nittorp' },
    'Nobelhallen': { city: 'Karlskoga' },
    'Nolhaga Ishall': { city: 'Alingsås' },
    'Nolia Ishall 1': { city: 'Umeå' },
    'Nolia Ishall 2': { city: 'Umeå' },
    'Norra Finans Arena': { city: 'Haparanda' },
    'Norsjö Arena': { city: 'Norsjö' },
    'Norvalla Ishall': { city: 'Vålberg' },
    'Nynäshallen': { city: 'Gävle' },
    'Näskotthallen': { city: 'Krokom' },                    // Näldens IF, Krokoms kommun
    'Oasen': { city: 'Kungälv', osm: 'Oasen sim- och ishall' },
    'Odenrinken': { city: 'Falköping' },
    'Olympiarinken A-Hall': { city: 'Helsingborg' },
    'Olympiarinken B-Hall': { city: 'Helsingborg' },
    'Orsa Ishall': { city: 'Orsa' },
    'Osby Ishall': { city: 'Osby' },
    'PART Arena': { city: 'Kalix' },
    'PROLYMPIAHALLEN': { city: 'Jönköping' },
    'PUAHALLEN': { city: 'Alingsås' },
    'Pinbackshallen': { city: 'Märsta' },
    'ProTrain Arena': { city: 'Mjölby', osm: 'Mjölby ishall' },
    'Profilgruppen Ishall': { city: 'Åseda' },
    'Railone Arena': { city: 'Orsa' },
    'Reliable Arena': { city: 'Stockholm' },
    'Rosenbergs ishall': { city: 'Tibro', osm: 'Tibro Ishall' },   // Rosenbergsgatan, Tibro
    'Rosengårds Ishall': { city: 'Malmö' },
    'Roslagens Sparbank Arena': { city: 'Norrtälje' },
    'Råsshallen': { city: 'Storå' },
    'Rödovre Centrum Arena': { city: 'Rødovre', foreign: true },
    'SCA Arena': { city: 'Timrå' },
    'SP Arena': { city: 'Ljungby' },
    'SSM AB Arena': { city: 'Nordmaling' },
    'Saab Arena': { city: 'Linköping' },
    'Salems Ishall': { city: 'Salem' },
    'Saltsjöbadens Ishall': { city: 'Saltsjöbaden' },
    'Sandbrohallen': { city: 'Enköping' },
    'Sannerudshallen': { city: 'Kil' },
    'Scaniarinken': { city: 'Södertälje' },
    'Skara Ishall': { city: 'Skara' },
    'Skellefteå Kraft Arena': { city: 'Skellefteå' },
    'Skellefteå Kraft Arena C-hallen': { city: 'Skellefteå' },
    'Skutskärs Ishall': { city: 'Skutskär' },
    'Skyttishallen': { city: 'Örnsköldsvik' },
    'Slottskogens Ishall': { city: 'Göteborg' },
    'Slättbergshallen': { city: 'Trollhättan' },
    'Smedjehov': { city: 'Norrahammar' },                   // HC Dalen, Jönköpings kommun
    'Smehallen': { city: 'Eskilstuna' },
    'Smehallen B': { city: 'Eskilstuna' },
    'Soft Center Arena': { city: 'Kallinge' },
    'Sparbanken Arena, Arvika': { city: 'Arvika' },
    'Stallet Norrköping': { city: 'Norrköping' },
    'Stenungsund Arena': { city: 'Stenungsund' },
    'Stockhagens Ishall': { city: 'Danderyd' },
    'Stora Hallen': { city: 'Nyköping', osm: 'Rosvalla' },  // fritext gav Missmyra/Älvkarleby
    'Stora Mossen': { city: 'Stockholm' },
    'Stortorpshallen': { city: 'Trångsund' },
    'Stricct Travel Arena': { city: 'Stockholm' },
    'Stålhallen': { city: 'Olofström' },                    // fritext gav Mo i Rana
    'Stångebro Ishall': { city: 'Linköping' },
    'Sunderby Ishall': { city: 'Luleå' },
    'Swoosh Arena': { city: 'Lycksele' },
    'Söderslättshallen': { city: 'Trelleborg' },
    'Talavidshallen': { city: 'Rydaholm' },
    'Team Sportia Arena': { city: 'Skutskär' },             // fritext gav Motala
    'Tegera Arena': { city: 'Leksand' },
    'Testebo Arena': { city: 'Gävle' },
    'Tibble Ishall': { city: 'Täby' },
    'Tingvalla Isstadion Rink 1': { city: 'Karlstad' },
    'Tjörns Ishall': { city: 'Tjörn' },
    'Torvalla Ishall': { city: 'Handen', osm: 'Torvalla IP' },     // Haninge Anchors — INTE Torvalla i Östersund
    'Tranås Åkeri Arena': { city: 'Tranås' },
    'Trollarinkens Ishall': { city: 'Glimåkra', osm: 'Trollarinken' },
    'Trängens IP Hall A': { city: 'Örebro' },
    'Tuve Ishall': { city: 'Göteborg' },
    'Tyresö Ishall': { city: 'Tyresö' },
    'Tyrs Hov Sportcentra': { city: 'Tyringe', osm: 'Tyrs hov' },
    'Töreshov': { city: 'Töreboda' },
    'Ulriksdals IP Hall 3': { city: 'Solna' },
    'Ungdomshallen': { city: 'Sundsvall' },
    'Upplandsbilforum Arena': { city: 'Uppsala' },
    'VBO Arena': { city: 'Vimmerby' },
    'Valhall': { city: 'Hagfors' },                         // Viking HC; fritext gav Norge
    'Vallentuna Ishall': { city: 'Vallentuna' },
    'Vallhamra Ishall': { city: 'Partille' },
    'Varbergs Ishall': { city: 'Varberg' },
    'Veddige Ishall': { city: 'Veddige' },
    'Vida Arena': { city: 'Växjö' },
    'Vilundaparkens Ishall A': { city: 'Upplands Väsby' },
    'Virdavallens Ishall': { city: 'Alvesta' },
    'Visby Ishall': { city: 'Visby' },
    'Visionite Arena': { city: 'Umeå' },
    'Visionite Arena B-hall': { city: 'Umeå' },
    'Visättra Ishall': { city: 'Flemingsberg' },
    'Vännäs Ishall': { city: 'Vännäs' },
    'Vättlehallen': { city: 'Lerum' },
    'Växjö Ishall': { city: 'Växjö' },
    'Wibe Arena': { city: 'Mora' },
    'XLNT AKUSTIK Arena': { city: 'Surahammar', osm: 'Surahallen' },
    'Ältahallen': { city: 'Älta' },
    'Åby Ishall': { city: 'Mölndal' },
    'Åkers Ishall': { city: 'Åkers styckebruk' },
    'Åmåls Ishall': { city: 'Åmål' },
    'Åse & Viste Arena': { city: 'Grästorp' },
    'Öckerö Ishall': { city: 'Öckerö' },
    'Östersund Arena Hall A': { city: 'Östersund' },
    'Östersund Arena Hall B': { city: 'Östersund' },
    'Österåshallen': { city: 'Hässleholm', osm: 'Österås ishall' },
};
