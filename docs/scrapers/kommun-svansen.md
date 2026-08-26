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

## Metod (fyra pass, alla i `scout/`)

| Pass | Skript | Vad det gör |
|---|---|---|
| 1 | `kommun-fingerprint.cjs` | Plattform + kalendersidor + API-signaturer för 99 kommunsajter |
| 2 | `restapp-dig2.cjs` | Gräver SiteVision-webbappens API-bas ur `registerInitialState` och testar tre kända anropssignaturer |
| 3 | `sibling-sweep.cjs` / `external-sweep.cjs` | Andra organisationer: gissade + faktiskt länkade turist-/biblioteks-/kulturdomäner |
| 4 | `lib-prefilter.cjs` + `axiell-discover.cjs` | Axiell Arena-bibliotek: HTTP-förfilter, sedan puppeteer för `customerId` |

Yield-lärdom: **gissade domäner gav 11 träffar på 891 försök**; att skörda de
länkar kommunen själv publicerar gav 12 på 73. Skörda, gissa inte.

## Resultat: 20 kommuner in, 8 nya källor, ~535 event i 30-dagarsfönstret

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

### 1. Vaggeryd (19 event) — behöver titel-städning först
`vaggeryd.se/uppleva-och-gora/upplev-vaggeryds--kommun.html` ger 19 framtida
event via vanliga sitevision-motorn, men titlarna kommer ut som
`"Evenemang Mareld - Piratlajv Berghems Lajvby, Skillingaryd"` — kategoriordet
"Evenemang" som prefix och venue-namnet upprepat som suffix. Venue extraheras
korrekt separat, så en generisk regel (stryk trailing venueName från titeln)
plus ett `titleStripRe`-config löser det. Inte aktiverad förrän titlarna är rena.

### 2. Vansbro — SiteVision `EventService`, ett fjärde RESTApp-mönster
```
GET https://www.vansbro.se/rest-api/EventService/items?start=0&num=200&paths=3.2a0514cf167c6092224998a4
```
Ger namn, `startDate` med tid, `location` med FULL gatuadress, bild, beskrivning.
`paths` är ett nod-id per sajt och står i `"paths":["3.…"]` intill
`"eventServiceRoute"` i kalendersidans initialState. Bara 30 poster / 4 framtida
i Vansbro — därför inte byggd. **Men samma sajt exponerar grannarnas endpoints**
(`morakommun.se`, `alvdalen.se`, `orsa.se` med egna `paths`), och de tre täcks
i dag av sitemap-källor. EventService är en bättre datakälla — värd ett byte.

### 3. Fem Arena-bibliotek där puppeteer inte fångade customerId
Danderyd, Härryda, Högsby, Markaryd, Strängnäs — sidorna har Arena-markörer men
inget `api.axiell.com/.../customers/<24hex>/search`-anrop syntes på 40 s. Troligen
lat-laddad kalender bakom en flik. Kör om `axiell-discover.cjs` med klick på
kalender-fliken, eller längre väntetid.

### 4. De 42 med JS-vägg — kräver network-scout
Kalendersida finns men inga strukturerade datum i HTML:en. Största först:
Huddinge, Botkyrka, Danderyd, Kungsbacka, Trollhättan, Kävlinge, Mark, Lerum,
Mjölby, Stenungsund, Mariestad, Lomma, Avesta, Nora, Sala, Kungälv.
Verktyget finns: `npm run scout -- <kalender-URL>` (puppeteer, fångar alla
XHR-svar). Det var så Eskilstuna, Göteborgs Stad och Norrköping knäcktes.

Två med konkret spår:
- **Avesta** — `avesta.se/gora-och-uppleva` refererar `api.axiell.com`, alltså
  Axiell Arena inbäddat direkt i kommunsajten. `6a8598a332f6376a99673fe7` i
  sid-HTML:en är ett ASSET-id, inte customerId (search-endpointen 500:ar på det).
  Kör puppeteer mot `avesta.se/evenemang`.
- **Övertorneå-mönstret** — kommunen hade en HELT SEPARAT eventdomän
  (`overtorneaevenemang.se`, WordPress + The Events Calendar, 134 event) som
  bara syntes som oembed-länk i kommunsidans HTML. Leta samma sak hos de andra:
  grep kalendersidans HTML efter externa domäner innan du dömer ut en kommun.

### 5. De 24 utan kalender alls
Ingen kommunkalender att hitta. Här är biblioteket eller turistbolaget enda
vägen — flera har redan Axiell-tenant (Värnamo, Härnösand, Österåker, Salem).
Kvar som riktigt tomma: Grästorp, Högsby, Essunga, Malå, Bräcke, Sorsele.

## Filer

- `scout/*.cjs` — de fyra probe-passen, körbara igen som de är
- `scout/verdict.json` — dom per kommun
- `scout/fingerprint.json`, `restapp-hits.json`, `axiell-tenants.json` — rådata
