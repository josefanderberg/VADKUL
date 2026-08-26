# Kommun-svansen — svep över de 99 utan egen källa (2026-08-26)

`npm run coverage` rapporterade **99 kommuner utan egen källa**. Det här är
facit av svepet: vad vi kom in på, vad som är kvar, och exakt hur nästa
person tar vid.

## Första lärdomen: rubriken ljuger

"99 kommuner vi inte har event ifrån" stämmer inte. Mätt på riktigt — varje
framtida event tilldelat närmaste tätort (`tatorter`-tabellen, ≤20 km) — har
**283 av 290 kommuner minst ett event**, och bara **Sorsele och Åsele** står på
noll. Paraply-källorna (Svenska kyrkan, PRO, biblioteken, Riksteatern,
Hembygd, studieförbunden) täcker geografin.

Det `coverage.ts` mäter är något annat och nyttigare: **saknar kommunen en
LOKAL källa?** Det är stadens egna arrangörer — scener, museer, marknader,
föreningsliv — som gör kalendern läsvärd en vanlig söndag. Det var den luckan
svepet gick på.

## Metod (fem pass, alla i `scout/`)

| Pass | Skript | Vad det gör |
|---|---|---|
| 1 | `kommun-fingerprint.cjs` | Plattform + kalendersidor + API-signaturer för 99 kommunsajter |
| 2 | `restapp-dig2.cjs` | Gräver SiteVision-webbappens API-bas ur `registerInitialState` och testar tre kända anropssignaturer |
| 3 | `sibling-sweep.cjs` / `external-sweep.cjs` | Andra organisationer: gissade + faktiskt länkade turist-/biblioteks-/kulturdomäner |
| 4 | `lib-prefilter.cjs` + `axiell-discover.cjs` | Axiell Arena-bibliotek: HTTP-förfilter, sedan puppeteer för `customerId` |
| 5 | `xhr-batch-scout.cjs` | Puppeteer i batch över de 78 som inte gav något: fångar alla JSON-svar bakom JS-väggen |

Yield-lärdom: **gissade domäner gav 11 träffar på 891 försök**; att skörda de
länkar kommunen själv publicerar gav 12 på 73. Skörda, gissa inte.

## Resultat: 30 kommuner in, 18 källor, ~1 376 event i 30-dagarsfönstret

### Vända 1 — HTTP-svep (20 kommuner, 535 event)

| Källa | Motor | Kommuner den bär | Event i fönstret |
|---|---|---|---|
| `visitvarmland` | `turid` (NY) | Eda, Filipstad, Grums, Hagfors, Kristinehamn, Munkfors, Storfors, Torsby, Årjäng (+ Karlstad/Arvika/Sunne) | 357 |
| `visitvastramalardalen` | `sitevision` RESTApp | Köping, Kungsör (+ Arboga) | 65 |
| `osthammar-kommun` | `sitevision` | Östhammar | 35 |
| `visithallstahammar` | `sitevision` RESTApp | Hallstahammar | 28 |
| `overtornea-evenemang` | `wp-rest` (tribe) | Övertorneå | 21 (134 framtida totalt) |
| `bjuv-kommun` | `sitevision` | Bjuv | 10 |
| `lillaedet-kommun` | `sitevision` | Lilla Edet | 10 |
| `nordanstig-bibliotek` | `sitevision` | Nordanstig | 9 |
| `bibliotek` (+4 tenants) | `bibliotek` | Sjöbo 379, Östhammar 53, Timrå 25, Åre 1 | 458 framtida |


### Vända 2 — puppeteer-scout bakom JS-väggen (10 kommuner till, 383 event)

`scout/xhr-batch-scout.cjs` laddade de 78 kvarvarande i browser, fångade alla
JSON-svar och rankade dem på event-innehåll. Tre nya plattformar föll ut.

| Källa | Motor | Kommun | Event i fönstret |
|---|---|---|---|
| `varmdo-kommun` | `sitevision` /page (NY) | Värmdö | 128 |
| `lerum-kalender` | `bestevent` (NY) | Lerum | 114 |
| `osteraker-kommun` | `sitevision` eventSearch | Österåker | 39 |
| `astorp-kommun` | `hbgevent` (NY) | Åstorp | 22 |
| `hylte-kalender` | `bestevent` | Hylte | 20 |
| `vaggeryd-kommun` | `sitevision` | Vaggeryd | 19 |
| `ange-kommun` | `cruncho` /events (NY läge) | Ånge | 16 |
| `skurup-kommun` | `hbgevent` | Skurup | 13 |
| `danderyd-kalender` | `bestevent` | Danderyd | 13 |
| `degerfors-kommun` | `sitevision` /page | Degerfors | 0 (1 utanför fönstret) |

**`hbgevent` — Helsingborgs Event Manager.** Åstorps kalender anropar en ANNAN
kommuns API: `api.helsingborg.se/event/json/wp/v2/event/time?group-id=<N>`,
öppet, 135 avsändargrupper (`/user_groups?per_page=100`). Fällor: `link` är
null och URL-mönstret skiljer sig per kommun (Åstorp `?id=`, Skurup
`/visa-evenemang/`) — läs det ur listsidans renderade länkar, gissa inte; tomma
grupper svarar 404 med `{"code":"empty_result"}`; Åstorp har två grupp-id med
identiskt innehåll. Uncovered-kommuner på plattformen: bara Åstorp och Skurup
har kommande event (Simrishamn och Sjöbo finns men är tomma).

**`bestevent` — Innocode, `kalender.<kommun>.se`.** Egen subdomän som
kommunsajten knappt länkar till. Fälla: pagineringen är **per dygn** —
`page=1` är i dag, `page=2` i morgon, och `start`/`end`/`per_page`/`interval`
ignoreras tyst. Ett 30-dagarsfönster = 30 anrop. Probade alla 99 med
`scout/bestevent-probe.cjs`; tre träffar.

**`sitevision.pageApi` — /page-routen.** `appresource/<pageId>/<portletId>/page?p=N`
med `X-Requested-With`. `startDate`/`endDate` är **epoch-millisekunder**, inte ISO.
9/sida, ej kumulativ.

**`cruncho.eventsRoute`.** Nyare Cruncho-webapp där listan ligger bakom
portletens `/events`-route i stället för i sidans `initialState` (den gamla
motorn hittade ingenting). En rad per tillfälle med olika `uri` per dag →
serie-dedup obligatorisk.

**eventSearch-motorn utökad:** osteraker.se stavar länkfältet `URL` där
kalmar.com stavar `URl`, och bär ort per hit. Båda accepteras nu.

**Vaggeryd** aktiverad med nya opt-in-fälten `titleStripRe` +
`stripVenueFromTitle` — korten renderade rubriken som
`"Evenemang <titel> <venue>"`.

### Störst fynd: TURID

`hagfors.se`:s kalendersida proxade `/rest-api/visit-varmland/events`. Proxysvarets
bild-URL:er (`img.turid.visitvarmland.com`) pekade ut ursprunget:

```
GET https://turid.visitvarmland.com/api/v8/events?limit=50&page=N
```

Öppet, ingen auth, 14 sidor, 664 event / 2569 tillfällen för hela Värmland.
96 % exakta koordinater, 100 % bild, 100 % beskrivning, 88 % klockslag, 27 % pris.
Motor: `src/scrapers/turid.ts`.

**Fällor** (kodade och testade):
- `places[].address.city` och `.municipality` är tomma på **100 %** trots att
  fälten finns. Orten måste tas ur `organizers[].city` (79 %).
- `limit` klipps tyst till 50 — `limit=500` ger fortfarande 50.
- Utställningar ligger som **ett tillfälle per öppetdag** (30 st/månad). Utan
  serie-dedup dränker sex utställningar hela länet: 1058 tillfällen → 358 event.
- `slug` ger `visitvarmland.com/<slug>` som 301:ar till den kanoniska
  destinations-prefixade adressen. Vi lagrar den korta — prefixet finns inte i API-svaret.

**Uppföljning:** TURID hittades INTE på 24 andra destinationsdomäner
(visitdalarna, vastsverige, visitostersund, visitorebro m.fl. — se
`external-sweep.cjs`:s REGIONAL-lista). Plattformen verkar Värmlands-specifik,
men testet är billigt: `<host>/api/v8/events?limit=1` eller `turid.<host>/…`.

### SiteVision RESTApp — mönstret från Eskilstuna håller

Tre nya sajter kör exakt Eskilstunas anropssignatur, bara med olika ruttnamn:

```
GET <api>/events?num=200&query=&count=0&page=1&type=event&timestamp=0&filters={"type":"event"}
```

- `visitvastramalardalen.se/rest-api/evenemang` (204 event, Köping+Arboga+Kungsör)
- `visithallstahammar.se/rest-api/events-rest` (61)
- `visiteskilstuna.se/rest-api/Evenemang` (sedan tidigare)

API-basen står som `"api"`-nyckel i sidans `AppRegistry.registerInitialState`.
`filters` är obligatorisk — utan den 500. Pagineringen är kumulativ.

**Brus att filtrera bort vid grepning:** `/rest-api/svg-sources/lp-icons.svg#…`
är ikon-sprites, inte API:er. Sju av tolv "RESTAPP"-träffar i pass 1 var det.

Nytt config-fält `cities: string[]` i sitevision-motorn för regionala guider:
venue-namnet bär orten ("Arboga bibliotek", "Mötesplats Tallåsgården, Kungsör")
och `pickCityFromVenue` plockar ut den så geokodningen inte drar allt till en ort.

## Kvar att göra — sorterat på hur nära det är

### 1. Kalix (16 event) — färdigt recept, ej byggt
`data.accentapi.com/feed/35230.json` är en kurerad feed av Facebook-event för
Kalix: 26 poster, 25 med exakta koordinater, 100 % bild, 16 i 30-dagarsfönstret
och **noll överlapp** med våra 8 973 befintliga FB-event. Kräver en liten motor
plus URL-normalisering: feeden skriver `facebook.com/events/<id>` utan
avslutande slash, vår FB-scraper med — utan normalisering blir varje event en
dubblett. Feed-id:t (35230) är Kalix-specifikt; hur man hittar andra kommuners
är okänt.

### 2. Simrishamn (79 i poolen) — `filter`-routen släpper bara 12
`appresource/4.2b41ab0e18f3780f8c934a77/12.2b41ab0e18f3780f8c934c94/filter`
svarar `{articles: [12 st], allArticles: 79}` och ignorerar `page`/`p`/`start`/
`offset`/`limit`. `fromDate=2026-09-10&toDate=2026-09-30` gav 0 träffar, så
datumfiltret finns men formatet är inte knäckt. Payloaden är rik (`place`,
`mappoint`, `signupFee`, `startTime`) — värd en sniff av "visa fler"-knappen.

### 3. Bromölla — egen eventdomän
`evenemang.bromolla.se` med `/sv/activitywidget/…` och `/sv/se-och-gora/filters`.
Inte kartlagd.

### 4. Vellinge / Burlöv / Lomma — Cruncho i iframe
Kalendern är en inbäddad Next.js-app på `<kommun>.cruncho.co`. Den hostade
`api-ts.cruncho.co`-routen `/landing-page/recommendations` 404:ar när man
anropar den utifrån, medan `/categories/with-events/<dest>` svarar — anropen
måste sniffas inifrån iframen.

### 5. Vansbro — SiteVision `EventService`, ett fjärde RESTApp-mönster
```
GET https://www.vansbro.se/rest-api/EventService/items?start=0&num=200&paths=3.2a0514cf167c6092224998a4
```
Ger namn, `startDate` med tid, `location` med FULL gatuadress, bild, beskrivning.
`paths` är ett nod-id per sajt och står i `"paths":["3.…"]` intill
`"eventServiceRoute"` i kalendersidans initialState. Bara 30 poster / 4 framtida
i Vansbro — därför inte byggd. **Men samma sajt exponerar grannarnas endpoints**
(`morakommun.se`, `alvdalen.se`, `orsa.se` med egna `paths`), och de tre täcks
i dag av sitemap-källor. EventService är en bättre datakälla — värd ett byte.

### 6. Fem Arena-bibliotek där puppeteer inte fångade customerId
Danderyd, Härryda, Högsby, Markaryd, Strängnäs — sidorna har Arena-markörer men
inget `api.axiell.com/.../customers/<24hex>/search`-anrop syntes på 40 s. Troligen
lat-laddad kalender bakom en flik. Kör om `axiell-discover.cjs` med klick på
kalender-fliken, eller längre väntetid.

### 7. De ~30 kvarvarande JS-väggarna
Kalendersida finns men inga strukturerade datum i HTML:en. Största först:
Huddinge, Botkyrka, Danderyd, Kungsbacka, Trollhättan, Kävlinge, Mark, Lerum,
Mjölby, Stenungsund, Mariestad, Lomma, Avesta, Nora, Sala, Kungälv.
Verktyget finns nu i batch-form: `node scout/xhr-batch-scout.cjs <tasks.json> <ut.json>`.
Kungsbacka, Ljusdal, Strängnäs, Mark, Lerum-listsidan och Kävlinge gav inga
XHR alls i första körningen — antingen laddade sidan inte klart eller så sitter
kalendern bakom en flik. Kör om med klick på kalender-fliken och längre väntetid.
Brus att filtrera i svaren: vizzit, readspeaker, cookiebot, puzzel, rekai,
siteimprove, monsido, screen9.

Två med konkret spår:
- **Avesta** — `avesta.se/gora-och-uppleva` refererar `api.axiell.com`, alltså
  Axiell Arena inbäddat direkt i kommunsajten. `6a8598a332f6376a99673fe7` i
  sid-HTML:en är ett ASSET-id, inte customerId (search-endpointen 500:ar på det).
  Kör puppeteer mot `avesta.se/evenemang`.
- **Övertorneå-mönstret** — kommunen hade en HELT SEPARAT eventdomän
  (`overtorneaevenemang.se`, WordPress + The Events Calendar, 134 event) som
  bara syntes som oembed-länk i kommunsidans HTML. Leta samma sak hos de andra:
  grep kalendersidans HTML efter externa domäner innan du dömer ut en kommun.

### 8. De 24 utan kalender alls
Ingen kommunkalender att hitta. Här är biblioteket eller turistbolaget enda
vägen — flera har redan Axiell-tenant (Värnamo, Härnösand, Österåker, Salem).
Kvar som riktigt tomma: Grästorp, Högsby, Essunga, Malå, Bräcke, Sorsele.

## Filer

- `scout/*.cjs` — alla probe-pass, körbara igen som de är
- `scout/verdict.json` — dom per kommun
- `scout/fingerprint.json`, `restapp-hits.json`, `axiell-tenants.json` — rådata
