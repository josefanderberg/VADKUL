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

**Det som återstår är proben.** Chapter House, keun joo, Palladium, Växjö Konserthus och Café
Fontaine har eventsidor men inte i något format proben provar (Tribe, wp-v2, sitemap med JSON-LD).
Nästa steg är att proben också letar en listsida (`/evenemang`, `/event-nyheter`, `/program`,
`/live`) och provar sitemap-motorns katalogläge på den. Mono säljer via Biljettkiosken, en
biljettplattform vi inte läser. När proben kan mer: töm domarna i `web-snowball-state.json` för
de berörda domänerna, annars vilar de i 90 dagar.

## 5. Vad som krävs för att vara minst lika bra

| | Läge | Nästa steg | Vem |
|---|---|---|---|
| Pris | 42 % i förvalet mot deras 45-65 % | Tickster-nyckeln. Bibliotekens API. | Josef (nyckeln), minin |
| Plats | 67 % exakt, 24 % på mittpunkt (var 64 / 28) | venueFixes för de namngivna. Arenaregistret för matcherna. | minin |
| Antal, förvalet | 87 % av deras (14 580 mot 16 837) | Proben för listsidor, sedan `venue-candidates` ort för ort. nationsguiden.se, Sensus, Biljettkiosken. De tolv volymrasen. Och frågan om kyrkan/PRO/Korpen ska vara dolda som förval - 10 098 event i fönstret. | Josef (beslutet), minin |

## 6. Mätmetod, för nästa gång

- Deras ortstal: `/vad-hander` (en sida, alla 187 orter). Prisandel: sista raden per event på en
  ortssida ("Pris okänt" / "Gratis" / belopp). Källa per event: värdnamnet i bildens
  `data-original-src`.
- Vårt: `npm run quality-coverage` (pris per källa), `SELECT geoPrecision, COUNT(*)`, och
  `npm run price-refine -- --sample` (sex sidor per värd, visar vilka värdar som bär pris i markupen).
- `npm run alerts` - raderna `[volymras]` är källor som lever men tappat det mesta.
- Mätfälla: räkna aldrig bara `hidden = 0`. Opt-in-källorna (`isOptInSource`) är 40 % av raderna
  men syns inte för en ny besökare.
