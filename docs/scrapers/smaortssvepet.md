# Småortssvepet — de 40 nya sidorna, 3/9 2026

De 40 småortssidorna (`small: true` i `cityData.ts`, tillagda 1/9) valdes mot
datat, men urvalskriteriet räknade **allt** utbud. Det här svepet mätte i
stället det som gör en stadssida läsvärd — ortens EGNA arrangörer — och
täppte de värsta hålen.

## Måttet

Samma filter som stadssidorna själva använder: 20 km-radie, opt-in-källorna
(Svenska kyrkan/PRO/Korpen) borträknade, sedan uppdelning i PARAPLY /
AGGREGAT / **LOKALA** enligt `city-gaps.ts`-taxonomin. Volym ljuger — 
Norrtälje har 138 event men 108 av dem är stadsbibliotekets.

Nio orter låg under 25 lokala event. Efter svepet:

| Ort | Lokala före | Efter | Vad som gjorde det |
|---|---|---|---|
| Ystad | 39 | **76** | `ystad` fanns redan — 30-dagarsfönstret slängde 37 event |
| Tranås | 27 | **41** | fönstret |
| Kinna | 11 | **24** | `vastsverige-mark` (ny) + fönstret på `mark-kommun` |
| Ljungby | 4 | **10** | `sagobygden` (ny) |
| Stenungsund | 9 | **13** | `vastsverige-stenungsund` (ny) |
| Enköping | 8 | **11** | fönstret |
| Sölvesborg | 21 | **25** | fönstret |
| Älmhult | 26 | **28** | fönstret |
| Markaryd | 4 | **4** | ingen källa finns — se dead-ends |

Säffle (+24) och Karlshamn (+9) kördes också på vidgat fönster.
Totalt **117 nya event**, 0 fel.

## Lärdom 1: fönstret var den största spaken, inte nya källor

`windowDays` default är 30. För en småort med gles kalender ligger det mesta
längre fram — Ystad hade 44 event inom 180 dagar men bara 7 inom 30. Första
omgången satte `windowDays: 180` på elva källor: ystad, tranas, enkoping,
almhult, solvesborg, mark-kommun, karlshamn, saffle + de tre nya.

Efter ägarbeslut samma dag kördes ÄVEN de nio källorna på orter som redan hade
bra utbud (kostnaden kollades först: 524 event ≈ +1,2 % av korpusen ≈ 54 KB
brotli per besökare — försumbart). Utfall **525 sparade, 0 fel**:

| Källa | 30d | 180d | sparade |
|---|---|---|---|
| sb-visitarboga-se | 90 | 247 | 159 |
| trosa | 101 | 199 | 103 |
| vimmerby | 113 | 195 | 89 |
| cruncho-varnamo | 102 | 179 | 77 |
| cruncho-strangnas | 67 | 107 | 40 |
| vastervik | 62 | 98 | 38 |
| mullsjo | 32 | 45 | 12 |
| hoor | 21 | 27 | 6 |
| oland | 33 | 48 | 1 |

Totalt står nu **20 källor** på `windowDays: 180`. Kostnadsramen att hålla sig
inom: eagert laddade lager (destinations + cards) är 4,59 MB brotli över 45 310
event ≈ 106 byte/event. Ett GLOBALT `windowDays: 180` över alla 459 källor är
däremot augusti-scenariot igen — se hosting-egress-anteckningarna.

Fältkvalitet på de 525: bild 99 %, geo 98 %, tid 97 %, kategori 100 %,
beskrivning 69 %, pris 17 %.

## Mätfälla: `createdAt` går inte att jämföra med `datetime('now')`

`link_events.createdAt` lagras som ISO med T och Z (`2026-09-03T17:48:18.643Z`)
medan `datetime('now')` ger `2026-09-03 17:49:26`. Strängjämförelsen bryts på
position 10 där `T` (0x54) > mellanslag (0x20), så
`createdAt > datetime('now','-1 hours')` matchar **allt som skapats idag** —
inklusive nattkörningen. Använd en ISO-sträng som gräns i stället.

## Lärdom 2: kommuner som lagt ner sin egen kalender

Stenungsund och Mark **har ingen egen evenemangskalender kvar**.
`stenungsund.se/uppleva-och-gora/evenemang` är en landningssida vars enda
kalenderlänk pekar på `vastsverige.com/stenungsund/evenemang/`. Rydals museum
länkar likadant till `vastsverige.com/mark/evenemang/`.

Vastsverige.com är alltså enda vägen in till de kommunernas utbud. Två fällor:

1. **Sitemapen är trasig.** `vastsverige.com/sitemap.xml` innehåller 24 535
   URL:er som ALLA pekar på `demo.vgregion.se` — noll produktions-URL:er.
   Befintliga `sb-vastsverige-com` i `registry-snowball.ts` jagar `/events/` i
   just den sitemapen och ger därför ~0 event. Discovery måste gå via
   listsidan (`isHtmlCatalog` + `useBrowser`, korten byggs i JS).
2. **JSON-LD:n är maskerad.** Script-taggen skrivs `application/ld&#x2B;json`,
   så en grep på `application/ld+json` säger "ingen JSON-LD" fast den finns —
   komplett med startDate, endDate, image och location med gatuadress.

## Lärdom 3: `[object Object]`-buggen

Vastsverige skickar språktaggade JSON-LD-värden:

```json
"name": { "@value": "Bibliotekets IT-hjälp", "@language": "sv" }
```

`jsonLdToRawEvent` gjorde `String(node.name)` → **varje event fick titeln
"[object Object]"**. Fixat med `plainText()` i `engines/json-ld.ts` (packar upp
`@value`, väljer svenska ur en flerspråkig array) — gäller name, description,
venueName, city, address och organizer. Test: `engines/json-ld.test.ts`.

## Lärdom 4: wp-v2 ger spökevent

`bulk-probe` föreslog `sagomuseet.se` som wp-rest/wp-v2. Endpointen returnerar
20 poster — men kalendersidan listar bara 6. Resten är avpublicerade arkivsidor
(t.ex. "Kulturarvsdag 2024"), och eftersom datumet bara står som "7 september"
i brödtexten utan årtal skjuter textparsern fram dem till nästa förekomst.
**Gamla event skulle återuppstå varje år.** Registryts header varnar redan för
wp/v2 på datum-grund; det här är samma fälla från andra hållet.

Lösningen: kör listsidan som `isHtmlCatalog` i stället. Då är det kalendern som
bestämmer vad som finns, och detaljsidan bara vad det handlar om.

## Pris: finns inte i de här källorna

Priskolumnen ligger på 19 % totalt och 0 % för de nya källorna. Det är inte ett
extraktionsfel — det kontrollerades:

- **SiteVision-kommunkalendrar** (~150 källor): detaljsidans `<dl>` har Plats,
  Arrangör, E-post, Telefon, Extern länk. Inget prisfält. Stickprov på 25
  domäner gav 0 träffar på `<dt>Pris</dt>`.
- **vastsverige.com**: JSON-LD saknar `offers`-nod.
- **Tickster** (1969 event, 0,3 % pris): biljettpriset renderas i JS. Enda
  "800kr" i statiska HTML:en är Ticksters egen säljtext om *deras*
  serviceavgift — skrapas den får varje Tickster-event fel pris. **Rör inte.**

De motorer som KAN läsa pris gör det redan: `json-ld` (offers), `cruncho`
(isFree/price), `wp-rest` (Tribe `cost`). Nortic ligger på 100 % pris.

## Dead-ends — proba inte om

| Kandidat | Varför |
|---|---|
| `markaryd.se` | Ingen kalender i sitemapen. Kommunens egen länk går till `markaryd.com/evenemangskalender/` — **domänen är parkerad hos Loopia**. Markaryd har ingen kalender att skrapa. |
| `sjobo.se/arkiv/evenemang` | Bara passerade event (7 st, äldsta juli). Kommunen underhåller den inte. |
| `visitenkoping.se`, `visitmarkaryd.se` | Renderar noll eventlänkar. |
| `visitljungby.se` | Redirectar till 404 på ljungby.se. |
| `ljungbergmuseet.se` | Katalogsidan ger 5 event, alla passerade eller >180 d fram. wp-v2-vägen ger 37 men med spökevent (se lärdom 4). |
| `visitroslagen.se`, `fregatten.se`, `cineteket.se`, `rackstadmuseet.se`, `teckningsmuseet.se`, `rydalsmuseum.se`, `borgholm.se`, `visitoland.com`, `ikeamuseum.com`, `gislaved.se` | bulk-probe FAIL — inga strukturerade framtida event. |
| `ystadsteater.se` | DUBBLETT — samma innehåll som befintliga `ystad`-källan serverar från ystad.se. |

## Kommun-sitevision-svepet

`npm run probe-sitevision` över alla 290 kommuner gav 32 träffar — men samtliga
för orter som redan har en källa (Ljungby, Vetlanda, Lessebo, Uppvidinge,
Malmö, Tranemo, Svenljunga …). Den vägen är i praktiken uttömd; nya källor
måste hittas via destinationssajter och enskilda arrangörer.

## Latent bugg i sitevision-motorn: fetchDetailDesc nådde aldrig API-vägarna

Dispatchen gjorde `return scrapeXApi(config, ctx)` för sina sju API-varianter,
medan `fetchDetailDesc`-blocket låg efter dem i funktionskroppen. Flaggan var
alltså **tyst verkningslös på alla 13 API-källor**. Fixat 3/9: blocket är
utbrutet till `backfillDescriptions()` och körs på båda vägarna.

Den blev dock ingen vinst i praktiken, och det är värt att inte upprepa:
`restApi`-källorna saknar description i API-svaret (222 framtida event på
Visit Arboga ligger på 0 %), men deras detaljsidor duger inte som fallback
heller — visitarboga/visitvastramalardalen har `<meta name="description"
content="">`, surahammar.se ger **arrangörsnamnet** och visithallstahammar
**eventtiteln**. De två sista passerar 20-teckensgränsen och hade skrivit falsk
beskrivning på varje event. Flaggan är därför medvetet AV på alla fyra
restApi-källorna. Deras text finns bara i brödtexten, bakom cookie- och
translate-boilerplate.
