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
OpenMapTiles-schemat, och de 71 bilderna som ligger ute nu är renderade ur
egna OpenMapTiles-kakel från planetiler. Sedan oktober hämtar Voyager CARTO:s
v2-kakel (`tiles.basemaps.cartocdn.com/v/<datum>/vectortiles/carto.streets/v2/`),
källan heter `protomaps` och lagren följer **Protomaps-schemat** (earth, water,
landuse, landcover, roads, places, pois, buildings, boundaries). CARTO:s v2-kakel
och Protomaps eget öppna bygge har exakt samma lager, attribut och antal objekt
(jämfört kakel för kakel 13/11 2026, zoom 6 och 12 över Sverige). De egna
kaklen tas därför nu som ett utdrag ur Protomaps bygge. Planetilers gamla
`sweden.pmtiles` passar inte längre: mot den nya stilen ritas bara vatten och
bakgrund.

Tre krediter behövs, och kartkrediten under heron namnger alla tre:

| Vad | Licens | Krav |
| --- | --- | --- |
| Kartdatan (OSM) | ODbL | synlig kredit |
| Utseendet (Voyager-stilen) | BSD-3 för koden, CC-BY 4.0 för designen | notis i källkod (finns i `v2MapBaseStyles.ts`) + **synlig** kredit till CARTO för designen |
| Kakelschemat | OpenMapTiles, CC-BY 4.0 (bilderna som ligger ute nu) | synlig kredit |

**När bilderna renderas om ur Protomaps-kakel:** byt OpenMapTiles-länken i
kartkrediten (`CityMapHero.tsx`) mot Protomaps (https://protomaps.com), som
står för schemat och bygget. Byt inte förrän bilderna är omrenderade, de som
ligger ute nu följer fortfarande OpenMapTiles-schemat.

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
https://build-metadata.protomaps.dev/builds.json). Filen är ~140 GB men behöver
inte laddas ner: `pmtiles extract` läser bara Sveriges del med HTTP-range.
Ta ett bygge från samma period som Voyager-stilens kakel
(`/v/<datum>/` i stilens källa) så att schemaversionen stämmer.

```bash
brew install pmtiles
```
```bash
pmtiles extract https://build.protomaps.com/20261113.pmtiles sweden.pmtiles --bbox=10.5,55.0,24.5,69.5
```

Lägg filen någonstans utanför repot, den ska inte committas. Den gamla
`sweden.pmtiles` från planetiler (OpenMapTiles) går inte att använda längre,
schemavakten stoppar den.

### 2. Kakelservern

MapLibre behöver kaklen över HTTP. Minimal server (`serve-tiles.mjs`, kräver
`npm i pmtiles`):

```js
import { createServer } from 'http';
import { PMTiles, FileSource } from 'pmtiles';
import { openAsBlob } from 'fs';
const FILE = '/sökväg/till/sweden.pmtiles';
const blob = await openAsBlob(FILE);
const pm = new PMTiles(new FileSource(Object.assign(blob, { name: FILE })));
createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const m = req.url.match(/^\/(\d+)\/(\d+)\/(\d+)\.(?:pbf|mvt)/);
    if (!m) { res.writeHead(404).end(); return; }
    const t = await pm.getZxy(+m[1], +m[2], +m[3]);
    if (!t) { res.writeHead(204).end(); return; }
    // INGEN Content-Encoding: biblioteket packar redan upp kaklen. Påstår man
    // gzip här misslyckas avkodningen tyst och kartan blir en tom grön platta.
    res.writeHead(200, { 'Content-Type': 'application/x-protobuf' });
    res.end(Buffer.from(t.data));
}).listen(8099);
```

### 3. Rendera

Tre terminaler:

```bash
node serve-tiles.mjs                                   # 1
```
```bash
cd apps/web && NEXT_PUBLIC_VECTOR_TILES_URL='http://localhost:8099/{z}/{x}/{y}.pbf' npm run dev   # 2
```
```bash
cd apps/web && node scripts/render-city-maps.mjs       # 3
```

Dev-servern kan också startas som `web-kartbilder` i `.claude/launch.json`,
som redan har miljövariabeln satt.

Flaggor: `--city=malmo,vaxjo`, `--keep` (hoppa över befintliga), `--base=`.

Skriptet kräver node 22.18 eller senare: vakterna ligger i
`src/utils/cartoTiles.ts` och node kör TypeScript-filen direkt.

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
