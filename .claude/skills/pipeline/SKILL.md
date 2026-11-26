---
name: pipeline
description: Arbeta med VADKUL:s event-pipeline — skrapning, Firestore-skrivningar, SQLite-spegeln, aggregate och nattjobbet på Mac minin. Använd ALLTID denna skill vid ändringar i apps/scraper, vid skrivningar mot linkEvents, när aggregat/dammsugning/sync nämns, när event saknas eller har fel datum/bild, eller när nattjobbet inte verkar ha körts.
---

# Event-pipelinen

## Järnregler

1. **`url` är primärnyckel i HELA pipelinen.** Länklösa event MÅSTE ligga på userCreated-live-spåret — annars kolliderar de på tomma nyckeln och fäller descriptions-uppladdningen.
2. **ALLA skrivningar mot `linkEvents` går via `stamped()`** i `apps/scraper/src/utils/firestoreStamp.ts`. Den sätter `updatedAt`-cursorn som den inkrementella syncen bygger på — en oststämplad skrivning blir osynlig för syncen och spegeln driftar.
3. **Läsningar går via SQLite-spegeln först** (dbHelper) — det är kostnadsfixen som håller Firestore-reads nere. Läs inte direkt mot Firestore i skript utan skäl.

## Ordningen som alltid gäller

`aggregate` läser **lokala SQLite**, inte Firestore. Kör därför alltid:

```bash
cd apps/scraper && npm run sync-to-sqlite && npm run aggregate
```

Hoppar man över syncen aggregerar man gammal data och undrar var de nya eventen tog vägen.

## Kända fällor i skrapad data

- **Omslagsbilder är delvis skräp**: `data:`-platshållare och rotrelativa `/images`-sökvägar förekommer i källdata (fällde Search Consoles "Ogiltig webbadress i fältet image"). Filtrera vid inläsning, lita aldrig blint på `image`.
- **Datumkapning**: `cheerioFallback` tar första `startDate` globalt på sidan — på källor med flera event per sida (Kulturbolaget-buggen) blir alla event feldaterade. Var misstänksam mot listsidor. Samma fälla med sajtvida datum: banners (Malmö Live: "3 oktober passerar Malmö Marathon") och "Andra event"-kort (Havremagasinet). Botemedlet är `detailDateSelector` på sidans eget datumfält.
- **Sajter byter URL-struktur tyst** (Visit Isabergsregionen, Spritmuseum 28/9): sitemapen har hundratals URL:er men `urlPatterns` matchar 0. Symptom: "N totalt → 0 matchande" i torrkörningen. Redirectar gamla adresser med samma slug → `canonicalUrl` i SitemapConfig så `url`-nyckeln består (inga dubbletter).
- **Datumet i URL:en kan vara publiceringsdagen** (upplev.vaxjo.se, #257 17/11): "2026-09-28-vit-pals" är konserten 20/11. `urlDateRegex` släpper bara URL:er högst 31 dagar före fönstret, så 100 av 141 sidor hämtades aldrig om och 42 kommande event saknades. Kontrollera mot ett par detaljsidor innan `urlDateRegex` sätts. Symptomet är "urlDateRegex pre-filter N → mycket färre".
- **Samma hus på flera punkter ger dubbletter på kartan** (Växjö 20/11, #257). Dubblettrensningens titelregler kräver samma hus, högst 200 m isär. Spretar källorna (husets sajt, kommunen, Facebook) måste huset in i `data/venueFixes.ts`. En gatuadress som namn ("Nygatan 6") får `withinKm`, så att namnar i andra städer inte flyttas.
- **WAF/bot-spärrar på Mozilla-UA från node** (Waldemarsudde, KB 28/9): 403 eller JS-utmaning trots att curl fungerar → `userAgent: 'VadKul/1.0 (+https://vadkul.se)'`.
- **Plats bara i titeln/sidans fält** (regionsajter): `titlePlaces` (ort ur titel/venue) och `detailVenueSelector` i SitemapConfig — annars hamnar allt på `defaultCity`:s centroid.
- **Källans koordinater kan vara en ortsmittpunkt, och fel ort** (#199, 13/11): Värnamo kommuns Cruncho lade Hestra Handsken (Hestra, Gislaved) på byn Hestra vid Rydaholm, 57.05, 14.316667, med postnummer och ort som pekade på samma fel by. Koordinater exakt på hela bågminuter (`isCoarseSourceCoord`) märks därför `ort-centroid`, och runnern provar adress/venue först. Är källan konsekvent fel hjälper bara en rad i `data/venueFixes.ts`; få ut den direkt med `npm run hotfix-aggregate -- --apply --only="<namn>"`.
- **Platsmärkningen och mittpunkterna** (#247, 16/11). Fem regler i geokodningskedjan som platsgranskningen lärde oss:
  - En fråga som bara består av orter ("Östersund, Östersund") är en mittpunkt (`placeOnlyPrecision`), aldrig 'poi'. 600 event i förvalet räknades som "på lokalen" innan.
  - Stadsmittpunkten tas ur SCB:s tätortsregister när Nominatims svar är kommunens mitt (hela bågminuter) eller en namne (`reconcileCityCentroid`). Strömsund låg 45 km ut i skogen.
  - En ortsmittpunkt stoppar inte kandidatkedjan (`firstPreciseHit`). Bara lokal, gata eller källkoordinat gör det.
  - Konsortiefilialer provas bara i sin egen ort (`branchCity`/`branchTown`), aldrig i de andra medlemsorterna.
  - En registerrad som ligger långt från orten i sitt eget namn räknas inte (`venueTownConflict`). Den lärs inte heller in.
  
  - FB-köns stad är bara var vi letade (#291, 26/11). Turnéarrangörer (Jubel) korspostar, och "Medborgarhuset i Säffle" ur Uppsala-kön föll till Uppsalas mittpunkt: Säffle fanns inte bland de 95 städerna. `anchorCityEvidence` (`scrapers/facebook/anchorCity.ts`) läser därför adressen mot SCB-registret och titelns segment ("… | Säffle"). Ett starkt bevis får vinna med en mittpunkt bara när köns kedja inte gav något bättre än en mittpunkt (`preferTextHit`). Vakter som mättes fram: versal, prefix ("Stora Kopparbergs kyrka" = Falun), landsnamn (Danmark är en tätort i Uppsala), två orter = tvetydigt, och minst 2 000 invånare (småorter som Lindholmen och Torup är namnar till stadsdelar).

  Runnerns refresh läker mittpunktsevent när kedjan nu hittar mer (`shouldMovePlace`). En ny kedjerättelse behöver därför ingen engångskörning för de gamla eventen, bara en refresh av källan.
- **Priset står i faktarutan, inte i brödtexten** (jämförelsen 14/11, `docs/happymap-jamforelse-2026-11-14.md`): 80 % av eventen saknade pris fast eventsidan bar det (`<dt>Pris</dt><dd>…</dd>`, "Kostnad: Gratis", JSON-LD offers). `utils/priceFromMarkup.ts` läser det — i sitemap-motorn vid inläsning, och i nattsteg K10 (`price-refine`) för alla andra motorer. Fel pris från en källa: slå upp adressen i `~/Library/Logs/vadkul-scraper/price-refine.tsv` (regeln står på raden), och stäng av med `noMarkupPrice: true` på en sitemap-källa. Tickster går INTE den vägen: priset finns bara i `secure.tickster.com`, som robots.txt stänger; det kräver deras Event API-nyckel.
- **Kända event får nytt pris bara vid full-refresh** (var 4:e körning, `SCRAPE_FORCE_REFRESH=1` eller `contentSweep`). En vanlig körning efter en prisfix i en skrapare ändrar inget på det som redan ligger i databasen (Göteborgs Stad 14/11: 54 nya fick pris, 1 075 gamla först med `SCRAPE_FORCE_REFRESH=1`).
- **Lokalregistret matchar på stadsnamn som text** (`lookupVenueSmart`): kommunen i frågan ("Fittja bibliotek, Botkyrka") mot postorten i registret (Norsborg) missade, och eventet föll till mittpunkten. `lookupVenueNear` (namn + närhet) är inkopplat efter stadsuppslaget sedan 14/11; `repair-centroids-from-register.ts` läker redan lagrade event utan nätanrop.
- **Krogens program står på en vanlig sida** (15/11, `docs/happymap-jamforelse-2026-11-14.md` avsnitt 4): ingen kalenderplugin, sitemap eller JSON-LD, bara rubrik + datumrad. Probens steg 6 (`bulk-probe`) följer startsidans länk till "Evenemang"/"Program" och väljer KATALOG (kort som länkar till en detaljsida per event → sitemap-motorn med `isHtmlCatalog` + `skipPublishTimes`) före PROGRAM PÅ SIDAN (→ `listing`-motorn, `utils/listingBlocks.ts`: datumraden är ankaret, titeln är rubriken i samma kort). Program på sidan läses bara för utpekade ställen (kandidatfilens femte kolumn `ställe`): hos ett turnerande band är texten efter datumet PLATSEN, inte titeln (haaks.se, pubkor.se). Läses inte: inlägg direkt under roten (`/quiz-pa-fredag/`, går inte att skilja från `/meny/` — keun joo), Facebook-inbäddningar, JS-renderade sidor.
- **Stadssvepets granskning** (#245, 17/11). Snöbollens godkännande räcker inte, så varje godkänd källa torrkörs (`npm run sources -- --dry-run --ids=…`) innan den behålls.
  - Ut: julbord och bokningslänkar, erbjudanden ("Julklappstips", "Nyårscatering"), nyhetssidor, sidrubriker, företagskurser, och 0 event i torrkörningen.
  - Bortgranskade domäner får verdiktet `GRANSKAD` i `web-snowball-state.json`. Det minns snöbollen för alltid; ett kvarlämnat PASS provas om efter 90 dagar och läggs in igen.
  - OSM:s namn är ofta fel ställe, t.ex. restaurangen i stället för kulturhuset (Aurora i Kiruna) eller kaféet i stället för gården (Färsna gård). Rätta `hostName` och `defaultVenue` mot sajtens egen titel.
  - Runnern sätter registrets `defaultVenue` när motorn inte gav någon lokal, för alla motorer. Förr gjorde bara sitemap, wp-rest och listing det.
  - Titlar som börjar eller slutar med "Inställd/Inställt" sparas inte (`isCancelledTitle`).
  - Sitemap-motorn tar bort sajtnamnet ur JSON-LD-namn ("Open Mic Night — garage bar") när svansen är sajtens `og:site_name`.
  - Ett hus som saknas i OSM får en rad i `data/venueFixes.ts`, med koordinaten kontrollerad mot sajtens adress. `apply-venue-fixes` rättar då också märkningen på event som redan står på rätt punkt men är märkta som mittpunkt.
- **Inläggets publiceringsdatum är inget eventdatum.** WordPress skriver `<time class="entry-date published">` på varje inlägg; sitemap-motorn tog det som eventets dag (keun joo: tio "event" på sina publiceringsdagar). `skipPublishTimes: true` tar bort de tiderna före datumtolkningen — sätts av proben på kataloger den hittat själv. Listing-motorn gör det alltid.
- **Biblioteken (Axiell) har inget prisfält**, varken i sökningen eller i detaljanropet. ÄGARBESLUT (Josef 15/11 2026, #249): ett biblioteksevent utan någon kostnadsuppgift (belopp, avgift, kostnad, biljett, betalning) visas som "Gratis", se `libraryDefaultPrice` i `scrapers/bibliotek.ts`. Ändra inte utan att fråga Josef.
- **Null-ön (0,0, locationName "Sverige")** = källan gav varken venue, ort eller kandidater. Platsblock rad för rad ("Venue, Gata" + "123 45 Ort"): `detailPlaceSelector` (sitemap, NBV) / `detailPlace` (wp-rest wp-v2, Vemdalen — även kartans koordinater). Tribe utan venue använder `defaultCity`. Läk kända event med `contentSweep: '<datum>'` på källan (eller `SCRAPE_FORCE_REFRESH=1`) — `backfill-geocode` hoppar över "Sverige".

## Verktyg för felsökning

- `npm run sources -- --ids=<id> --dry-run` — kör källan mot live-sajten utan att skriva något. Första steget vid varje "källan ger 0".
- `npm run alerts` — samlad larmlista (tysta källor, krascher, datumkluster, 0,0-event, invariant-larm, karantän) → `scraper-alerts.json`. Nattkedjan kör och pushar den; rotens `npm run dev` skriver ut den.
- Karantän (`quarantine.json`) släpps genom att ta bort källans post när den är fixad — annars står den pausad tills veckoretryn ser liv.
- `npm run price-refine -- --sample` — sex detaljsidor per värd, torrkört: visar vilka värdar som bär pris i markupen och vilka som hålls tillbaka (sidmallens belopp, obevisad gratisflagga). `--host=<värd>` för en källa, `--apply` skriver.
- `npm run venue-candidates -- --city=Ort` → `npm run web-snowball -- --candidates=venue-candidates.txt --max=N --dry` — ortens krogar, scener och caféer ur OSM genom snöbollens vanliga kedja (prob, rimlighetskontroll, tsc-vakt). Utan `--dry` skrivs godkända källor till `registry-snowball.ts`. Lär sig proben något nytt: höj `PROBE_VERSION` i `utils/snowballSmoke.ts`, så provas gamla FAIL om utan att `web-snowball-state.json` töms för hand.
- Refresh rör aldrig TITLAR. Avkapade titlar efter en fix i titelstädningen ("Föreläsning" i stället för "Föreläsning - AI för föreningsarbete", 15/11): `npx ts-node src/scripts/refresh-truncated-titles.ts --ids=<källa> [--apply]` skriver bara om där den sparade titeln är början av den färska.
- AI-granskningen fyller bara i pris där källan inte gav något (sedan 15/11; förr nollade den källans pris i spegeln). Ger en källa pris i torrkörning men spegeln saknar det: kolla granskningen först.
- `SCRAPE_FORCE_REFRESH=1` — tvinga refresh av kända URL:er (rättar tid/plats efter en motorfix). Rättar INTE event motorn slutat returnera; de kräver en riktad döljning (se `oneoff-hide-stale-dateclusters.ts`).

## Nattjobbet på Mac minin

- Kedjan är schemalagd 00:30 via launchd, men `StartCalendarInterval` väcker **inte** en sovande Mac — jobbet körs först vid uppvaknande. Fixen är en pmset-väckning 00:25 på minin.
- Saknas färsk data på morgonen: kolla först om minin sov, inte koden.
- Efter ändringar i scrapern: minin behöver `git pull` (och `npm install` vid nya beroenden) innan nästa körning — den kör sin egen kopia från `main`.
- Ordning sedan 28/9: bespoke + Sources → aggregat → **Facebook sist** → slutaggregat. FB körs EN gång (today-sweden kör inte FB), FB-söket är av (`FB_SEARCH=1` slår på), och `fb-reject-memory.json` håller avfärdade sid-/seed-event borta. Kedjan tog ~21 h innan.
- `run-daily.sh` exporterar `NODE_OPTIONS` med IPv4 först + längre anslutningsförsök — utan det ~200 "fetch failed"/natt mot Nominatim m.fl.
- Ändra inte `run-daily.sh` medan kedjan kör (bash läser skriptet löpande) — kolla `pgrep -fl run-daily`.

## App-flödet (plattformsplanen fas 1, 25/9)

`aggregate` bygger även APPENS per-region-flöde: `utils/appFeed.ts` delar upp
destinations per län (region = närmaste stadens län ur webbens CITIES, som
regex-läses ur `cityUtils.ts`), joinar bilder och pris (sedan 29/10) ur cards via eventKey och laddar
upp som blobbar (`app-<region>`) + metadatadok. 60-dagarshorisont sedan 28/10
(förr 14, kartans fönster) — appen läser `days` och låter dagväljaren nå dit. Serveras BLOB-ONLY av `/api/events/app-<region>`; utan
blob svarar routen 503 och nästa nattaggregat läker. Ändras fälten MÅSTE
spegeln i `packages/kontrakt` (AppFeedEvent) följa med.
