# Stadssidornas kartbilder

Stads-heron laddar ingen kartmotor. Kartbotten är en färdig bild per stad i
`apps/web/public/kartbilder/<slug>.webp` (71 st, ~3,4 MB totalt). Brickorna
ligger som levande DOM ovanpå — bara BAKGRUNDEN är förrenderad.

Varför: hero-kameran är låst per stad, så kartan ser alltid likadan ut. Ändå
laddade varje besök MapLibre (269 kB gzippad JS, ~1 MB att parsa), hämtade
stil-JSON och sedan vektorkakel innan första kartpixeln ritades — på en sida
vars hela HTML är 121 kB gzippad.

## Licensläget — läs detta innan du rör kedjan

Bilderna får **inte** renderas ur CARTO:s kakel. Deras villkor tillåter att
kaklen visas direkt för besökare (§9.c.i) men förbjuder att vi cachar
innehållet på vår server (§9.c.iii), och en förrenderad bild är precis det.

Det som gör bilderna möjliga ändå: Voyager-stilen är BSD-3-licensierad och
skriven mot ett öppet kakelschema. Vi renderar därför samma stil mot egna
kakel: identiskt utseende, egna kakel.

**Schemat bytte i oktober 2026 (#205).** Voyager var skriven mot
OpenMapTiles-schemat. Sedan oktober hämtar Voyager CARTO:s v2-kakel
(`tiles.basemaps.cartocdn.com/v/<datum>/vectortiles/carto.streets/v2/`),
källan heter `protomaps` och lagren följer **Protomaps-schemat** (earth, water,
landuse, landcover, roads, places, pois, buildings, boundaries). CARTO:s v2-kakel
och Protomaps eget öppna bygge har exakt samma lager, attribut och antal objekt
(jämfört kakel för kakel 13/11 2026, zoom 6 och 12 över Sverige). De egna
kaklen tas därför som ett utdrag ur Protomaps bygge. Planetilers gamla
`sweden.pmtiles` passar inte längre: mot den nya stilen ritas bara vatten och
bakgrund.

**Bilderna renderades om ur Protomaps-kakel 20/11 2026 (#267)**, bygget
`20261118`, med platsskyltarna inbakade (se nedan). Kartkrediten under heron
namnger sedan dess Protomaps i stället för OpenMapTiles.

Tre krediter behövs, och kartkrediten under heron namnger alla tre:

| Vad | Licens | Krav |
| --- | --- | --- |
| Kartdatan (OSM) | ODbL | synlig kredit |
| Utseendet (Voyager-stilen) | BSD-3 för koden, CC-BY 4.0 för designen | notis i källkod (finns i `v2MapBaseStyles.ts`) + **synlig** kredit till CARTO för designen |
| Kaklen och schemat | Protomaps bygge (kartdatan ODbL, schemat öppet) | synlig kredit |

**Huvudkartan rörs inte.** Den hämtar kakel direkt från CARTO i besökarens
webbläsare, vilket är uttryckligen tillåtet.

Renderingsskriptet har två vakter. Ta inte bort dem.

- **Licensvakten** vägrar spara en bild om något kartinnehåll hämtats från
  `cartocdn.com`. Allt därifrån räknas som kartinnehåll utom stilens
  formgivning: style.json och sprite (under `/gl/`) och typsnitten (under
  `/fonts/`), som ska hämtas från CARTO. Okända CARTO-adresser fäller alltså
  vakten. Den gamla vakten letade efter `/vector/` och missade v2-kaklen.
- **Schemavakten** läser lagernamnen i några av de egna kaklen och vägrar om de
  följer OpenMapTiles eller om inga Protomaps-kakel alls hämtades.

Båda bor i `apps/web/src/utils/cartoTiles.ts` med tester, och samma modul byter
CARTO-källan mot de egna kaklen i `v2MapBaseStyles.ts` (oavsett vad källan heter).

## Bygga om bilderna

Behövs bara när en stad tillkommer eller kartstilen ändras. Inte i CI.

### 1. Kakel (ett utdrag ur Protomaps bygge)

Protomaps lägger ut ett färdigt bygge av hela världen varje dag
(`https://build.protomaps.com/<ÅÅÅÅMMDD>.pmtiles`, listan finns på
https://build-metadata.protomaps.dev/builds.json; bara de senaste dagarna
ligger kvar). Filen är ~140 GB men behöver inte laddas ner: `pmtiles extract`
läser bara det begärda området med HTTP-range. Ta ett färskt bygge.

Utdraget täcker bara en ruta per stad (`scripts/city-map-region.mjs` skriver
området ur `cityPages.ts`), till zoom 15 eftersom skyltpunkterna hämtas där.
71 städer blev 419 MB och tog cirka 9 minuter (20/11 2026).

```bash
brew install pmtiles
```
```bash
mkdir -p ~/kartkakel && cd apps/web && node scripts/city-map-region.mjs > ~/kartkakel/stader.geojson
```
```bash
pmtiles extract https://build.protomaps.com/20261118.pmtiles ~/kartkakel/stader.pmtiles --region=$HOME/kartkakel/stader.geojson --maxzoom=15
```

Filen ska ligga utanför repot, den ska inte committas. Den gamla
`sweden.pmtiles` från planetiler (OpenMapTiles) går inte att använda längre,
schemavakten stoppar den.

### 2. Kakelservern

`pmtiles serve` ger kaklen över HTTP, på adressen
`http://localhost:8099/stader/{z}/{x}/{y}.mvt` (filnamnet utan ändelse är
första ledet). Kakel som saknas svarar 204.

```bash
pmtiles serve ~/kartkakel --port=8099 --cors='*' --interface=127.0.0.1
```

### 3. Rendera

Dev-servern MED egna kakel (profilen `web-kartbilder` i `.claude/launch.json`
har miljövariabeln satt; kolla först att ingen annan dev-server kör):

```bash
cd apps/web && NEXT_PUBLIC_VECTOR_TILES_URL='http://localhost:8099/stader/{z}/{x}/{y}.mvt' npm run dev
```
```bash
cd apps/web && node scripts/render-city-maps.mjs
```

Flaggor: `--city=malmo,vaxjo`, `--keep` (hoppa över befintliga), `--base=`.

Skriptet kräver node 22.18 eller senare: vakterna ligger i
`src/utils/cartoTiles.ts` och node kör TypeScript-filen direkt.

Titta på ett par bilder efteråt (en liten och en stor stad). Bilderna är
webp; `sips -s format png <fil> --out <fil>.png` gör dem läsbara överallt.

## Platsskyltarna i bilden (#267)

Badplatser, museer, bibliotek, naturreservat, golfbanor, biografer, teatrar
och arenor står som skyltar i bilden, samma skyltar som på stora kartan. På
stora kartan tänds de först vid zoom 12-13, eftersom kaklen inte bär platserna
tidigare. Stadssidans karta står på zoom 11, så vid renderingen hämtar
`CityMapHeroCanvas` punkterna ur zoom 15-kaklen för kartrutan och lägger dem
som en egen källa med kontraktets skyltlager (`src/utils/heroPoiSigns.ts`,
testad). Det sker bara när `NEXT_PUBLIC_VECTOR_TILES_URL` är satt: en stad utan
förrenderad bild får alltså inga skyltar hos besökaren förrän bilden finns.

Lekplatser, parker, bollplaner, idrottsanläggningar och matställen är inte med
(för många för en bild över hela staden). Skyltarna är 0,6 av full storlek
(`HERO_POI_ICON_SIZE`) och har inga namn.

- Skriptet väntar på `data-hero-signs="done"` och vägrar spara om skyltarna
  inte gick att rita. Antalet skyltpunkter skrivs ut per stad.
- **Skyltbilderna läggs in FÖRE lagret** (`preloadPoiSignImages`). Kartan står
  still, och en bild som kommer via `styleimagemissing` efter att kaklet lagts
  ut ritas aldrig: första försöket gav 3 skyltar av 38 i Växjö.

## Fällor som vakter redan fångar

- **Kartytan är 630×318**, inte 632×320 — hero-rutans 1 px ram. Skriptet vägrar
  fotografera om måtten inte stämmer med `HERO_IMG_W/H` i `CityMapHero.tsx`.
- **Rundade hörn får inte bakas in** — `object-cover` beskär i sidled på smala
  skärmar och då hamnar rundningen fel. Skriptet nollar `borderRadius`.
- **Tomhetsvakt**: en bild under 8 kB är en enfärgad platta, inte en karta.
  Hände på riktigt när kakelservern ljög om `Content-Encoding`.
- **Licensvakten** och **schemavakten** ovan.

Saknas bilden för en stad renderas den riktiga GL-kartan i stället, precis som
förr. En nytillagd stad ser alltså rätt ut direkt — bara tyngre tills
skriptet körts om. Det är också den mekanismen skriptet självt utnyttjar för
att kunna fotografera.
