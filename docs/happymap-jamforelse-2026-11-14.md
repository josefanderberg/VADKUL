# Happymap mot VADKUL - källor, pris och plats (2026-11-14)

_Uppföljning av `happymap-siffror-2026-10-06.md`. Frågan den här gången (Josef 14/11): de har fler
källor och exaktare priser och platser än vi - stämmer det, var sitter felet, och vad krävs för att
vi ska vara minst lika bra?_

**Underlag.** Happymaps publika ortssidor (`/vad-hander`, uppdaterade 14/11 11:35): ortslistan och
första sidan för Falkenberg, Uppsala, Växjö och Stockholm, lästa i webbläsare. Deras robots.txt
tillåter läsning för att svara på en fråga men inte massuttag, så det är ett stickprov, inte en
kopia av deras data. Vår sida: SQLite-spegeln (`events.db`) samma eftermiddag. Fönstret är deras:
**14-27 november**.

## 1. Antal: de leder på det besökaren ser, vi leder på det vi har

| 14-27 november | Happymap | VADKUL, förvalet | VADKUL, allt i databasen |
|---|---|---|---|
| Event | 16 837 (187 orter) | 14 082 | 24 180 |

Skillnaden mellan våra två kolumner är opt-in-källorna: Svenska kyrkan, PRO och Korpen är dolda tills
besökaren kryssar i dem (ägarbeslut 31/8). Det är 10 098 event i fönstret. Happymap visar sina
kyrk- och föreningsevent för alla.

| Ort | Happymap | Vi, förvalet | Vi, allt |
|---|---|---|---|
| Stor-Stockholm (18 kommuner) | 3 383 | 1 874 | 3 294 |
| Stor-Göteborg (7 kommuner) | 1 831 | 1 650 | 2 247 |
| Uppsala | 945 | 336 | 573 |
| Malmö | 484 | 452 | 679 |
| Lund | 339 | 284 | 381 |
| Umeå | 315 | 234 | 453 |
| Helsingborg | 311 | 213 | 283 |
| Karlstad | 274 | 187 | 284 |
| Linköping | 240 | 193 | 395 |
| Norrköping | 239 | 201 | 337 |
| Jönköping | 221 | 159 | 325 |
| Växjö | 201 | 143 | 280 |
| Gävle | 191 | 153 | 243 |
| Västerås | 183 | 113 | 243 |
| Östersund | 166 | 135 | 234 |
| Örebro | 159 | 194 | 316 |
| Borås | 125 | 139 | 217 |
| Halmstad | 122 | 155 | 273 |
| Kalmar | 110 | 124 | 159 |
| Falkenberg | 35 | 66 | 82 |

Med förvalet leder vi i 10 av 21 län (de mindre), de i 11 - tydligast i Stockholms län (3 699 mot
2 172), Västra Götaland (3 142 mot 2 445) och Uppsala län (1 122 mot 526). Räknar man allt vi har
leder vi i 20 av 21 län; bara Uppsala län ligger efter.

Orter räknas hos oss per kommun via närmaste tätort (SCB-registret, storleksviktat). Deras tal är
tillfällen, våra är rader - en serie med en rad per datum räknas lika, men en utställning med
slutdatum är en rad hos oss.

**Källbredd.** Vi har 571 källor i registret plus ett fyrtiotal egna skrapare: 449 källdomäner och
2 645 arrangörsnamn bara i förvalets tvåveckorsfönster. Deras sitemap hade 2 729 arrangörer i
oktober. Bredden är alltså jämförbar; det som skiljer är vilka källor.

Källor de har och vi saknar, sedda i stickprovet:

- **nationsguiden.se** - Uppsalas studentnationer (klubbar, pubar, idrott, baler). Förklarar
  större delen av Uppsalagapet ensam.
- **Sensus** - studieförbundet. Vi har 1 event. Medborgarskolans motor kan nära nog återanvändas
  (noterat redan 6/10).
- Enskilda scener: The Kaliber Room och Fyrisbiografen (Uppsala), Kafé de luxe och Keun Joo
  (Växjö), Stampen och Cyklopen (Stockholm), Hermans och Gekås eventhall (Falkenberg/Ullared).
- Sedan oktober har de lagt till biljettplattformarna (Tickster, Nortic, Billetto, Ticketmaster),
  som då var vårt övertag.

## 2. Pris: här var gapet störst

| Andel event med pris | Före | Efter dagens körningar |
|---|---|---|
| Happymap, stickprov | Falkenberg 66 %, Växjö 52 %, Uppsala 45 %, Stockholms utvalda 90 % | |
| VADKUL, alla kommande | 19,9 % (7 712 av 38 756) | 30,9 % (12 772 av 41 324) |
| VADKUL, förvalet | 23 % | 41,7 % (6 074 av 14 580) |

Orsaken var inte att källorna saknar pris. Priset står på eventsidan hos de flesta kommun-, besöks-
och förbundskällor, men i sidans **faktaruta** (`<dt>Pris</dt><dd>365 kr</dd>`, "Kostnad: Gratis")
eller i JSON-LD - inte i brödtexten, som var det enda vår prisletare läste. Fyra fel, i storleksordning:

1. **Faktarutan lästes aldrig** (ca 12 000 event hos 389 värdar). Nytt: `utils/priceFromMarkup.ts`
   läser etiketterade rader, JSON-LD offers och ensamma prisrader. Inkopplat i sitemap-motorn (alla
   287 sitemap-källor, utan extra hämtning) och i ABF-skraparen, och som nattsteg K10
   (`npm run price-refine`) för allt annat.
2. **Göteborgs Stad**: API:ts prisfält är tomt på 97 % av raderna, och då är eventet gratis - stadens
   egen sida skriver "Kostnad: Gratis". 84 av 1 173 hade pris; nu 1 168 av 1 227.
3. **Dubbletter tappade priset**: dedupen behåller biljettsajtens rad (affiliatelänken) och gömde
   kommunsajtens som bar priset. 273 synliga event hade en gömd tvilling med pris. Nytt: prisarv i
   `dedupe-cross`.
4. **Tickster: 3 228 event, 10 % med pris.** Det går inte att lösa i koden. Priset finns bara i
   biljettbutiken (`secure.tickster.com`), som deras robots.txt stänger för robotar. Vägen in är
   Ticksters Event API, som kräver en nyckel: https://developer.tickster.com ("Request API key",
   de riktar sig uttryckligen till "event aggregators"). **Ägaråtgärd.** Det här är den enskilt
   största kvarvarande prisluckan och den som syns mest: Stockholms utvalda hos Happymap är till en
   tredjedel Tickster-event med pris.

Precision före täckning gäller som förut. Det som stoppas: belopp i löptext utan etikett, två
prisuppgifter som inte går ihop (Helsingborg Arena: showen 395-725 kr, terrasspaketet 1 300 kr),
"Priset avser endast buffé", gratis med åldersgräns, samma belopp på nästan alla en värds sidor
(sidmallens pris), och JSON-LD-flaggan `isAccessibleForFree` som enda belägg hos en värd som aldrig
visat `false` (Hörby sätter `true` på allt). Varje satt pris loggas med adress och regel i
`~/Library/Logs/vadkul-scraper/price-refine.tsv`.

Utan pris även efter detta, och varför: Svenska kyrkan (7 200, sidan är en JS-app och priset är
okänt även hos Happymap), swehockey och Korpen (matcher), Facebook (bara brödtext), bibliotekens
evenemangssidor (SPA; API:t behöver en egen titt), PRO och Friluftsfrämjandet (sidorna bär inget pris).

## 3. Plats: en tredjedel låg på en ortsmittpunkt

Förvalets event i fönstret: 64 % exakt (lokal, gata eller källans koordinat), 28 % på en
ortsmittpunkt, 8 % omärkta. Happymaps listor visar lokalnamn på nästan varje rad. Tre fel:

1. **Lokalregistret missade platser det redan kunde.** Uppslaget krävde att stadsnamnen var samma
   text. Källan anger kommunen ("Fittja bibliotek, Botkyrka"), registret postorten (Norsborg). Nytt:
   `lookupVenueNear` matchar på namn + närhet (25 km, 10 km för kyrkonamn; aldrig generiska namn,
   rums-/scennamn, rena ortnamn eller föreningsnamn). Inkopplat i geokodningskedjan, geo-refine och
   bulk-repair. Befintliga event läks av `repair-centroids-from-register.ts`: 736 event flyttade till sin lokal (196 platser), 126 märkta om.
2. **Källor som aldrig läser detaljsidans plats** (#228-listan): platsconfig för 18 källor ovanpå #229:s fyra. Omläsningen samma kväll gav ny plats åt 600 event (Ängelholm 144 → 4 på mittpunkten, Norrtälje 60 → 4, Piteå 95 → 25, Ystad 78 → 63). Resten läks när eventen kommer in i källornas fönster.
3. **Felmärkt precision**: 126 event stod redan på sin lokal men var märkta som mittpunkt.

Kvar: Svenska kyrkan (4 400 på mittpunkt) och PRO (2 000) - opt-in-källor, och PRO-eventen saknar
ofta lokal helt. Ligamatcherna (1 200) behöver arenaregistret. Namngivna lokaler som inget uppslag
klarar: "Huvudbiblioteket" i Huddinge/Täby/Åkersberga (90), "Biblioteket i Solna centrum" (79),
"Västerås Kongress" (21), "Kino 2-4" i Lund (63) - rader för `data/venueFixes.ts` med kontrollerad
koordinat.

## 4. De unika ställena: krogar, scener, caféer

Josefs iakttagelse samma kväll: Happymap hade Naturskyddsföreningen och Chapter House i Växjö,
vi inte. Två olika orsaker.

**Naturskyddsföreningen var en bugg, inte en lucka.** Vi läser samma kalender. Adressernas
id-suffix är hexadecimalt (`…-2026-11-14-306c9/`) och tolkningen tog bara siffror, så bara vart
tionde event kom igenom: 27 av 239 i två veckor. Rättat och kört - 322 kommande event mot 121.
Ingenting larmade, fast källan har golvet `expectedMinEvents: 100`: larmlistan läste aldrig
golvet. Nytt larm `volymras` (under registrets golv, eller under 40 % av källans egen nivå två
veckor tidigare) hittade direkt tolv källor till, bland dem Destination Uppsala (300 hämtade
poster, 240 kastade av 30-dagarsfönstret - nu 180 dagar, 39 → 238 kommande event), Havremagasinet
(7 mot 137), Vemdalen (16 mot 250) och Vallentuna (10 mot 38).

**Krogarna fanns inte i tratten.** Happymaps Växjö-lista bärs av ställen som Kafé de luxe,
Slottsstallarna, PM & Vänner, keun joo, Chapter House och Mono. De har egna sajter med program,
de flesta på standardplattformar våra motorer redan läser. Tre saker stoppade dem:

1. **Skörden.** Webb-snöbollen hittar nya källor via länkar i event vi redan har. Dit kommer en
   restaurang aldrig. Nytt: `npm run venue-candidates -- --city=Ort` hämtar ortens krogar, scener
   och caféer ur OSM. Få har webbadress där (Växjö: 22 av 106), så domänen gissas ur namnet
   ("Chapter House" → chapterhouse.se) och godtas bara om sidan nämner både orten och stället.
   Växjö: 19 av 61 hittade så.
2. **Rimlighetskontrollen.** Regeln "minst hälften unika titlar" fällde just krogar: Pub-Torsdag
   varje vecka räknades som dubbletter. Nu räknas (titel, dag)-par - samma titel på olika dagar
   är en serie, samma titel samma dag är skräp.
3. **Lokalen.** En krogs flöde bär ingen plats, så eventen hamnade på ortens mittpunkt. Skördade
   ställen får nu sitt namn som `defaultVenue`.

Utfall i Växjö: 40 kandidater → 4 med läsbar kalender → 3 nya källor (Slottsstallarna, Kafé de
luxe, PM & Vänner), 25 event, alla på sin lokal, Kafé de luxe med pris.

**Proben läser nu vanliga programsidor (15/11).** Chapter House, Palladium och Växjö Konserthus
hade eventsidor men inte i något format proben provade (Tribe, wp-v2, sitemap med JSON-LD). Nytt
steg i `bulk-probe`: följ startsidans länk till "Evenemang"/"Program" och läs sidan som

- **katalog** - kort som länkar till en detaljsida per event (`/event/<namn>/`). Sitemap-motorns
  `isHtmlCatalog` läser den redan; proben pekar bara ut listsidan och länkfamiljen. Ny flagga
  `skipPublishTimes`: ett WordPress-inläggs publiceringsdatum är inget eventdatum (keun joo gav
  tio "event" på sina publiceringsdagar).
- **program på en enda sida** - rubrik, datumrad, lite text, inga detaljsidor. Ny motor `listing`
  (`utils/listingBlocks.ts`). Datumraden är ankaret och titeln är rubriken i samma kort; en sida
  ger hellre noll event än fel event.

Torrkört, inget inlagt i registret än:

| | Ställen provade | Skulle bli källor |
|---|---|---|
| Växjö | 37 | Chapter House (3 event på sidan, pris 300/525/725 kr), Palladium (7), Växjö Konserthus (46 via katalogen) |
| Kalmar + Jönköping (oberoende test) | 105 | Byttan (18), Slottshotellet (7), Villa Karlsro (4), Folkets bio (9), Berseau (3) |

Räkna med ungefär tre nya ställen per stad av den storleken. Det oberoende testet hittade sex
brister som rättades samma natt: status på datumraden ("27 nov Fullbokat" blev titeln
"Fullbokat"), ett avsnitts text på grannens event, slutdatum efter midnatt som eget event, en
veckodag som flyttade datumet 13 månader fram, hopklistrade element och Latin-1-sidor.

Tre spärrar kom ur samma test:

1. **Program på en sida läses bara för utpekade ställen** (kandidatfilens femte kolumn, satt av
   `venue-candidates`). Hos en krog är texten efter datumet akten; hos ett turnerande band är den
   platsen. Ett urval av 210 gamla FAIL släppte igenom haaks.se och pubkor.se med titlar som
   "Kalmar - Krögers". Kataloger berörs inte.
2. **Dubblettkontrollen är ortsmedveten** för ställen med känd ort. En konsertsal delar titlar
   med hela turnén, och Växjö Konserthus föll på att "EVIGT EDVIN" fanns i Karlstad.
3. **Utställningskataloger hoppas över.** En utställning hamnar annars på sin sista dag.

Probens generation står i `PROBE_VERSION` (`utils/snowballSmoke.ts`). Gamla FAIL från en äldre
generation provas om av sig själva, så `web-snowball-state.json` behöver inte tömmas för hand.

Läses fortfarande inte: keun joo (inlägg direkt under roten med datum som "21/11" - går inte att
skilja från `/meny/`), Café Fontaine (tom sida), Blend Bar (Facebook-inbäddning) och Mono, som
säljer via Biljettkiosken.

### Stadssvepen natten till 15/11

Proben kördes mot krogar, scener, caféer och museer ur OSM i 38 städer, de 20 största först och
sedan Norrland, Dalarna, Skåne och västkusten.

| | Ställen provade | Godkända | Inlagda efter granskning |
|---|---|---|---|
| Svep 1 (19 städer) | 1 147 | 91 | 82 |
| Svep 2 (19 städer) | 618 | 32 | 30 |
| Växjö, Kalmar, Jönköping | 142 | 8 | 8 |

Första körningen gav 847 nya synliga event, varav 510 inom förvalets tvåveckorsfönster och 470 av
dem på sin lokal. Gapet mot Happymap var cirka 2 250 event i samma fönster. Störst effekt i
Stockholm, där vi låg sämst till: Göta Lejon, Oscarsteatern, Intiman, Folkoperan, China Teatern,
Scalateatern, Playhouse och Teaterverket.

Granskningen tog bort elva källor och blev regler i snöbollen: hotellkedjor och rikskalendrar
(ortens hotell eller café blev plats för hela landets event), en idrottsförenings mötes- och
bokningskalender, ett enskilt event som listsida, och **datumkluster** - Droskan i Umeå gav 187 av
187 event samma dag och Skissernas museum 78 av 106 med dagens datum. Deras event är dolda.

Volymlarmen: av tretton var bara Vallentuna en verklig förlust (sidan visar nio kort och laddar
resten med "Visa fler"; nu 69 event mot 11 via kalenderappens egen rutt). Resten var säsong,
sajter med färre event, eller falsklarm.

Kvar: Örnsköldsvik (Overpass svarade inte), resten av landets tätorter (utbytet per stad sjunker
med storleken), och beslutet i josefanderberg/VADKUL#240 om att visa kyrkan och PRO vid inzoomning.

## 5. Plan: minst Happymaps precision (läge 15/11)

Ticket: #250 (första omgången, #236, nådde sina mål: pris över 40 %, mittpunkt under 25 %).

Alla tal gäller förvalet (det en ny besökare ser, utan kyrkan/PRO/Korpen) i ett tvåveckorsfönster,
mätt på samma sätt varje gång (avsnitt 6).

| Mått | Happymap | Vi 14/11 | Vi 15/11 | Vi 15/11 kväll | Mål |
|---|---|---|---|---|---|
| Antal | 16 837 (14-27/11) | 14 580 | 15 207 | 15 262 | minst deras siffra samma dag |
| Med pris | 45-66 % i ortsstickproven, 90 % i Stockholms utvalda | 41,7 % | 43,7 % | 54,4 % | 60 % |
| På sin lokal | lokalnamn på nära varje rad (Stockholm 15/11: ett fåtal av 50 saknade) | 66,7 % | 68,1 % | 68,8 % | 85 % |
| På ortens mittpunkt | - | 24,0 % | 23,5 % | 22,7 % | under 10 % |

**Var prisluckan ligger** (förvalet 15-28/11, event utan pris): biblioteken 1 957 av 2 765,
Tickster 983 av 1 089, Facebook 956 av 1 615, hockeymatcherna (swehockey) 653 av 653, Uppsalas
nationer 340 av 340, Ticketmaster 157 av 158. Biblioteken är den största enskilda luckan, inte
Tickster. Bibliotekens pris går INTE att läsa ur något fält (undersökt 15/11): Axiells
eventmodell saknar prisfält helt, både i sökningen och i detaljanropet
(`/customers/<id>/events/<uuid>`), och bibliotekens kalendersidor är en klientapp som visar
samma data. Av 2 205 biblioteksevent i tvåveckorsfönstret har 529 pris hos oss (ur texten och
AI-granskningen); textparsern hittar redan allt som står (5 missade). Bara 30 nämner ett
belopp i kronor över huvud taget. Resten, cirka 1 670, saknar prisuppgift hos källan.
ÄGARBESLUT (Josef 15/11): ett biblioteksevent utan någon kostnadsuppgift visas som gratis
(faef0336). 3 257 kända biblioteksevent fick priset vid omläsningen samma kväll, och
förvalets prisandel gick från 43,7 till 54,2 %.

**Resten av #249 (15/11 kväll):**

- Nationerna: detaljsidan ger beskrivning och kartmarkör (3e548760). 207 event flyttade från
  Uppsalas mittpunkt till nationens adress och 587 fick beskrivning, men bara 20 fick pris:
  pubar och caféer anger sällan entré. 67 icke-event (öppettider, mottagningstider) dolda.
- Ticketmaster: Discovery saknar `priceRanges` för alla svenska event, även i detaljanropet.
  Priset finns bara i partner-API:t för erbjudanden (`/commerce/v2/events/<id>/offers`), som
  svarar 401 med vår nyckel. Kräver en partneransökan (Josef), 158 event i fönstret.
- Hockeyn: ingen gemensam priskälla. SHL säljer via AXS (inget öppet API), övriga via
  klubbarnas system, och juniormatcherna (över hälften) anger sällan pris. Vägen är Tickster
  (#243): dedupe-cross ärver priset när samma match finns där.
Ticketmaster läses redan via Discovery API; det är `priceRanges` som saknas i svaren.

**Ett fel som åt priser (rättat 15/11):** AI-granskningen skrev sitt eget prisförslag över
källans pris i SQLite-spegeln, och förslaget är tomt när beskrivningen inte nämner något pris.
Nya event gick därför ut utan pris tills nästa sync råkade läka raden. Sensus "Kostnadsfritt"
lästes alltså rätt; det var granskningen som tog bort det. Nu fyller granskningen bara i där
priset saknas (81feabfb), och 409 kommande event fick tillbaka sitt pris ur Firestore (4c9f7bdd).

**Var platsluckan ligger** (på mittpunkten): biblioteken 598, Facebook 359, hockeymatcherna 270,
Tickster 265, nationerna 98.

**Vägen dit**

| Mått | Ticket | Vad | Vem |
|---|---|---|---|
| Antal | #240 | Kyrkan, PRO och Korpen vid inzoomning (10 000 event i fönstret) | MacBooken |
| Antal | #244 | Stockholms biografer: Zita, Fågel Blå, Capitol | minin |
| Antal | #245 | Stadssvepet: 19 städer kvar, sedan resten av tätorterna | minin |
| Antal | #246 | Frikyrkorna (cirka 150 församlingar hos Happymap) | minin, Josef (förval) |
| Antal | #248 | Biljettkiosken | minin |
| Pris, plats | #243 | Tickster Event API (ansökan skickad 15/11); Event Dump API ger alla kommande event i ett anrop per dygn | Josef (nyckeln), minin |
| Pris | #249 | Pris utöver Tickster: biblioteken (inget prisfält finns; ägarbeslut), nationerna, hockeyn, Ticketmaster (`priceRanges` saknas i Discovery-svaren) | minin, Josef (biblioteken) |
| Plats | #247 | Källorna på mittpunkten, källa för källa; arenaregistret för hockeymatcherna | minin |

Facebook-eventen saknar strukturerat pris och plats; de rättas bara genom att samma event hittas
i en bättre källa (dedupe-cross ärver pris och plats).

Arbetsregel (15/11): saknar en stor källa pris eller plats, leta först efter ett officiellt API för
aggregatorer innan vi nöjer oss med att skrapa sidorna. Tickster-API:t missades i fem månader.

## 6. Mätmetod, för nästa gång

- Deras ortstal: `/vad-hander` (en sida, alla 187 orter). Prisandel: sista raden per event på en
  ortssida ("Pris okänt" / "Gratis" / belopp). Källa per event: värdnamnet i bildens
  `data-original-src`.
- Vårt: `npm run quality-coverage` (pris per källa), `SELECT geoPrecision, COUNT(*)`, och
  `npm run price-refine -- --sample` (sex sidor per värd, visar vilka värdar som bär pris i markupen).
- Förvalet i SQLite: `hidden = 0`, tvåveckorsfönstret från i dag, och utan adresser som innehåller
  `svenskakyrkan.se`, `pro.se` (värd eller underdomän), `zoezi` eller `korpen`. Pris = `price` ej
  tomt; plats = `geoPrecision` i (`poi`, `gata`, `kallkoordinat`); mittpunkt = `ort-centroid` eller
  `stad-centroid`.
- Deras platsandel: på en ortssida, hur många av raderna under "Allt i programmet" som har en
  lokalrad.
- `npm run alerts` - raderna `[volymras]` är källor som lever men tappat det mesta.
- Mätfälla: räkna aldrig bara `hidden = 0`. Opt-in-källorna (`isOptInSource`) är 40 % av raderna
  men syns inte för en ny besökare.
