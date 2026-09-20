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
skriven mot det öppna **OpenMapTiles-schemat**. Vi genererar därför egna kakel
ur OSM-data och renderar samma stil mot dem — identiskt utseende, egna kakel.

Tre krediter behövs, och kartkrediten under heron namnger alla tre:

| Vad | Licens | Krav |
| --- | --- | --- |
| Kartdatan (OSM) | ODbL | synlig kredit |
| Utseendet (Voyager-stilen) | BSD-3 för koden, CC-BY 4.0 för designen | notis i källkod (finns i `v2MapBaseStyles.ts`) + **synlig** kredit till CARTO för designen |
| Kakelschemat | OpenMapTiles, CC-BY 4.0 | synlig kredit |

**Huvudkartan rörs inte.** Den hämtar kakel direkt från CARTO i besökarens
webbläsare, vilket är uttryckligen tillåtet.

Renderingsskriptet har en **licensvakt** som vägrar spara en bild om något
kakel hämtats från CARTO:s `/vector/`-sökväg. Ta inte bort den. Stilens övriga
delar (style.json, sprite, fonts) hämtas fortfarande därifrån och ska göra det.

## Bygga om bilderna

Behövs bara när en stad tillkommer eller kartstilen ändras. Inte i CI.

### 1. Kakel (en gång, tar ~45 min)

Kräver Java 21. Planetiler laddar ner Sverige-extraktet från Geofabrik plus
vattenpolygoner och Natural Earth (~1,9 GB) och bygger `sweden.pmtiles` (~1,2 GB).

```bash
curl -L -o planetiler.jar https://github.com/onthegomap/planetiler/releases/latest/download/planetiler.jar
java -Xmx6g -jar planetiler.jar --download --area=sweden --output=sweden.pmtiles
```

Lägg filen någonstans utanför repot — den ska inte committas.

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

## Fällor som vakter redan fångar

- **Kartytan är 630×318**, inte 632×320 — hero-rutans 1 px ram. Skriptet vägrar
  fotografera om måtten inte stämmer med `HERO_IMG_W/H` i `CityMapHero.tsx`.
- **Rundade hörn får inte bakas in** — `object-cover` beskär i sidled på smala
  skärmar och då hamnar rundningen fel. Skriptet nollar `borderRadius`.
- **Tomhetsvakt**: en bild under 8 kB är en enfärgad platta, inte en karta.
  Hände på riktigt när kakelservern ljög om `Content-Encoding`.
- **Licensvakten** ovan.

Saknas bilden för en stad renderas den riktiga GL-kartan i stället, precis som
förr. En nytillagd stad ser alltså rätt ut direkt — bara tyngre tills
skriptet körts om. Det är också den mekanismen skriptet självt utnyttjar för
att kunna fotografera.
