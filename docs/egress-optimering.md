# Egress-optimering — nedladdad data per besökare (2026-09-11)

Arbetsdokument för att få ner Firebase Hosting-egressen. **Etapp 1 (slankt
kortlager) är byggd, granskad och utrullad via PR #82.** Resten av trappan är
utredd och mätt men inte byggd — siffrorna nedan är uppmätta på skarpa datat,
inte uppskattade, så nästa maskin/AI ska kunna fortsätta utan att göra om
analysen.

Framtagen efter att Hosting-grafen visade 10,1 GB på ett dygn (10/9) mot ~3 GB
normalt. Ägarens första hypotes var bilderna — den visade sig fel för just den
grafen, se "Fastslagna fakta" nedan.

---

## TL;DR — de fem sakerna som styr

1. **Det är inte bilderna.** Event-omslagen hotlänkas från externa värdar
   (`next.config.mjs` har `unoptimized: true`) och passerar aldrig Hosting.
   Kostnaden är de två JSON-lagren varje besökare hämtar via
   `/api/events/[layer]`: **4,62 MB brotli per färsk besökare** före etapp 1.
2. **10,1 GB-dygnet var normalt.** 1 100 besökare (rekord) × ~5 MB + JS-bundle,
   kartkakel och crawlers. Ingen incident — men det gjorde per-besökare-kostnaden
   värd att attackera. Bidragande: 35 commits den dagen, och varje kodpush till
   main deployar → CDN-cachen (`s-maxage=3600`) hann aldrig bli varm.
3. **Kortlagret var till ~60 % redundant.** Hela url:en skickades två gånger
   (`id` + `url`) plus sju fält som destinations redan bär. Åtgärdat i etapp 1:
   **cards 2,76 → 1,16 MB (−58 %), per besökare 4,62 → 3,02 MB (−35 %).**
4. **Läsningar är i praktiken gratis jämfört med bytes.** ~1 GB egress ≈
   250 000 Firestore-läsningar i listpris. Att dela upp datan i fler, mindre
   hämtningar är därför nästan alltid rätt affär — och komprimeringen tappar
   ingenting på uppdelning (mätt: konstant 0,05 kB/event oavsett slice-storlek).
5. **Tidsfönstret är det som gör tillväxt gratis.** 40 % av eventen ligger
   bortom 14 dagar, och skrapade säsongsscheman (jfr `ef2ef42`, hockeyn 7 → 788
   matcher) landar nästan uteslutande i den svansen. Bantningen är en
   engångsrabatt; fönstret är det som håller kostnaden nere när minin skrapar in
   mer.

---

## Utgångsläge (mätt 2026-09-11 på minin, 44 191 event)

Brotli q6 = det som faktiskt går över tråden, eftersom `/api/events/[layer]`
packar själv och inte litar på CDN:ens komprimering.

| Lager | Rått (kompakt) | gzip | **brotli q6** |
|---|---|---|---|
| destinations | ~14 MB | 2,93 MB | **1,86 MB** |
| cards | ~25 MB | 4,06 MB | **2,76 MB** |
| **per besökare** | | | **4,62 MB** |

`descriptions` (15 MB rått) hämtas redan lazy via `descriptionsRequested` och
ingår därför inte i grundkostnaden.

⚠️ **Mät alltid i brotli, inte gzip.** Brotli har ett mycket större fönster och
hittar upprepningar på avstånd som gzip missar. Platssortering gav −26 % i gzip
men bara −4 % i brotli. Slutsatser dragna ur gzip-siffror kan vara direkt
missvisande.

---

## Vad som är gjort — etapp 1 (PR #82)

**Slankt kortlager.** `CardLayer` i `aggregate-events.ts` bär bara det
destinations saknar, med `h = eventKey(url)` som join-nyckel i stället för hela
url:en. Tomma fält utelämnas. `url` skickas bara när `publicUrl()` faktiskt
skrivit om länken (affiliate-wrap, param-städning, värd-reparation) — ~2 % av
eventen; annars ÄR destinations-`id` länken.

**Destinations är orört** — samma innehåll, samma ordning (tidsordning).

| | före | efter | |
|---|---|---|---|
| destinations | 1,86 MB | 1,86 MB | ±0 |
| cards | 2,76 MB | 1,16 MB | −58 % |
| **summa** | **4,62 MB** | **3,02 MB** | **−35 %** |

Vid 1 100 besökare: ~5,1 → ~3,3 GB/dygn.

### Läsarna — ALLA måste klara båda formaten

Aggregatet byggs om av minin, webben deployas av GitHub Actions — de byter
format vid olika tidpunkter, och audit-daemonen kan skriva gammalt format tills
den startats om (se nedan). Därför slår varje läsare upp kortet tolerant: `h`
(slankt) eller `id` (gammalt), och exakt `id` vinner i ett blandat lager.

| Läsare | Var | Används av |
|---|---|---|
| `buildCardIndex` | `apps/web/src/utils/eventKey.ts` | kartan (`linkEventService`), stadssidorna (`cityData`), delningssidorna (`shareData`), djuplänks-API:t (`lib/deepLinkEventIndex` → `/api/event`) |
| `sameEvent` | `apps/scraper/src/scripts/seed-sqlite-from-aggregate.ts` | **Stadsinlägg-workflowen** (FB-inlägg från CI) — seedar SQLite ur de incheckade filerna |
| `cards.get` | `docs/outreach/generate-arrangorer.mjs` | arrangörs-outreachens bocklista |

Molnsessionens första version av PR:en missade de tre sista — granskningen på
minin fångade dem med negativa kontroller: grenens djuplänkskod gav avvikelser
på alla 44 191 event (inga bilder/värdar/affiliate-länkar i snabbkortet),
seedern seedade 0 event och avbröt (Stadsinlägg hade kraschat), och
outreach-listan blev tom.

### Ekvivalensbevis — så verifierades det (gör om vid varje formatändring)

Gammal och ny aggregator kördes mot SAMMA ögonblicksbild av `events.db` i
separata worktrees, med `config/firebase` utbytt mot `db = null` (ingen
Firestore). Sedan kördes varje läsares RIKTIGA kod — gammal kod på gammalt
format mot ny kod på nytt format — och utdata jämfördes fält för fält:

- kartan (`linkEventService.getAll` med stubbad fetch): 44 191 event, 0 skillnader
- `/api/event`-indexet: 44 191 event, 0 skillnader (url utelämnas när den = id; klienten faller tillbaka dit)
- stadssidorna: 142 listor, 36 541 event, 524 BOKA-knappar — 0 skillnader
- delningssidorna: 44 191 slugs, 0 skillnader
- seedern: identiska rader i alla kolumner den skriver
- outreach-listan: identisk (120 arrangörer)
- **övergången** (ny kod på GAMMALT format): också identiskt i alla läsare

Varför platssorteringen ströks: den sparade bara 0,13 MB (−4 %) per besökare,
men kartans tidssortering i `(v2)/page.tsx` — som körs vid varje callback — gick
från 0,4 till 6,8 ms på 44k event (mätt på minin; flera gånger mer på mobil)
eftersom indatan inte längre var försorterad. Tidsordningen är dessutom grunden
för tidsfönster-steget nedan.

### ⚠️ Audit-daemonen håller GAMMAL aggregatorkod i minnet

`se.vadkul.audit-pending` kör `runAggregation()` efter varje audit-batch och har
`MAX_BATCHES = ∞` — processen lever tills den dödas, och ts-node kompilerade
koden när den startade. **Varje ändring i `aggregate-events.ts` når alltså inte
daemonens omaggregeringar förrän daemonen startats om** — tills dess skriver
den gammalt format om vartannat med nattkedjans nya. (Ofarligt med toleranta
läsare, men vinsten uteblir.) Omstart efter att minin pullat:

```bash
launchctl kickstart -k gui/$(id -u)/se.vadkul.audit-pending
```

Pågående batch går förlorad men eventen ligger kvar som pending och tas om.

---

## Fastslagna fakta — gräv inte upp dessa igen

- **Bilderna passerar inte Hosting.** `unoptimized: true` + `remotePatterns:
  ['**']` → `<Image>` renderar rena `<img>` mot externa värdar.
- **MEN 23 475 av 28 792 omslag ligger i vår egen bucket**, länkade som råa
  `storage.googleapis.com/vadkul-f2cb2.firebasestorage.app/...`. Direkta
  GCS-länkar går **utanför CDN:en** → full egress per visning, varje gång. Det
  är en **separat faktura-rad** (Cloud Storage), inte Hosting-grafen. Inte
  utrett vidare — se "Kvar att göra".
- **`approxGeo` är oanvänd i hela repot** (bara skrivningar i
  `aggregate-events.ts`). **Behålls ändå** — kostar ~14 kB (0,5 %) och kan komma
  till nytta för "ungefär i {stad}". `geoPrecision` som den härleds ur är
  däremot högst levande i SQLite (`bulk-repair-centroids`, `geo-refine`,
  `llm-refine-centroids`).
- **FB-inläggen från minin** (`publish-fb.ts`, `schedule-city-posts.ts` lokalt)
  läser SQLite direkt — men **Stadsinlägg-workflowen i CI läser aggregatet** via
  `seed-sqlite-from-aggregate.ts`. Den är en läsare av kortformatet.
- **`id` är rå url, `url` är `publicUrl(id)`.** De skiljer sig för ~2 % av
  eventen. Ingen rå url är i dag redan en affiliate-länk (0 av 791), men
  stadssidornas BOKA-knapp faller ändå tillbaka på id:t (`card.url ?? id`) så
  den överlever även det fallet.
- **Statikfilerna i `public/` skrivs om vid deploy** från live-API:t
  (`deploy.yml`, "Uppdatera eventdata från produktion") — formatet i
  deploy-snapshoten följer alltså API:t. Minins nattliga data-commit uppdaterar
  de INCHECKADE filerna, som Stadsinlägg-workflowen läser.

---

## Invarianter som INTE får brytas

- **`eventKey` har tvillingar.** `apps/scraper/src/utils/eventKey.ts` och
  `apps/web/src/utils/eventKey.ts` (plus kopian i
  `docs/outreach/generate-arrangorer.mjs`, som facit-kollar sig själv) måste ge
  identiska värden — scrapern stämplar nycklarna, läsarna slår upp på dem. Går
  de isär hittar inget kort sitt event **utan att något kastar fel**. Båda
  paketens `eventKey.test.ts` låser samma facit-tabell. Ändra aldrig facit för
  att få testet grönt.
- **Nya läsare av cards-lagret slår upp via `buildCardIndex`** (eller `h`/`id`
  som i seedern) — aldrig `cards.set(c.id, …)`.
- **`cards[i]` och `destinations[i]` är index-linjerade** (samma varv i
  aggregatorn, båda hoppar över url-lösa rader). Seedern bygger på det.
- **`eventShareSlug.test.ts` är guldtest** (se CLAUDE.md). Orört av etapp 1.

---

## Mätmetod — så reproducerar du siffrorna

Kör mot `apps/web/public/events-*.json`. Brotli via Nodes `zlib`, kompakt JSON
som routen skickar:

```js
const br = (o, q = 6) => zlib.brotliCompressSync(
    Buffer.from(JSON.stringify(o)),
    { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: q } },
).length / 1e6;
```

---

## Trappan — status och kvarvarande steg

### ✅ 1. Brotli q11 förpackat i scrapern (byggt 2026-09-11, etapp 2)

`utils/aggregateBlobs.ts` packar q11 + gzip 9 vid aggregeringen (~40 s totalt,
gratis på minin) och laddar upp som `blob_<layer>`(+`_<enc>_<N>`-shards, Bytes,
index sist). Routen använder blobben BARA vid exakt updatedAt-match — annars
q6-vägen som förut. Uppmätt på skarpa slanka datat: destinations 1,96 → 1,66,
cards 1,19 → 1,04, descriptions 3,80 → 3,19 MB (−12 till −16 %). Bonus:
kallstarten läser ~5 MB färdiga bytes i stället för ~35 MB JSON + ompackning.
Vaktposter: hotfix-aggregate-venue stämplar nytt updatedAt → blobben
missmatchar av sig själv; venue-läsvakten gäller bara bygg-vägen (blobben bär
scraperns fixar från aggregeringen — brådskande fix går via data-hotfix).
**Audit-daemonen måste startas om** efter pull, som vid varje aggregatorändring.

### ✅ 2. Lazy cards (byggt 2026-09-11, etapp 2)

Kortlagret (~1 MB brotli) hämtas nu först vid begäran, samma gate-mönster som
descriptions: `requestCards()` triggas av (1) LinkEventCard vid mount och
(2) första söktermen i (v2)/page.tsx — sökningen matchar hostName + kortets
url, som bor i lagret. Markörer/räknare/dagslistor/filter bygger helt på
destinations och påverkas inte. Besökare som bara tittar på kartan laddar
aldrig lagret: **grundkostnaden är nu 1,66 MB per besökare** (destinations
q11), 2,70 MB för den som öppnar kort.

### 3. Tidsfönster

Kvantiserat, aldrig rå viewport-bbox. Routen har redan slice-stödet
(`?from=&to=`) och gör redan rätt sak för dagsslicen: *"alla besökare i samma
tidszon bygger IDENTISKA from/to-strängar → CDN cachar EN slice per dag."*
Förläng den principen. Aggregatet är tidsordnat, så ett fönster är ett
sammanhängande prefix av lagren.

Fördelning (10/9): 7 dagar = 42 % av eventen, 14 dagar = 60 %, 30 dagar = 81 %.

⚠️ **Fällan:** slicar man på rå viewport-bbox får varje besökare en unik
cache-nyckel → 0 % CDN-träff → varje besök blir en funktionsinvokation med
brotli-packning. Då exploderar funktionstid och latens även om läsningarna
förblir billiga. Kvantisera nyckeln: fasta tidsfönster, och om geografi — fasta
rutor (län eller grov geohash), aldrig besökarens faktiska bbox.

### ✅ 4. Bilderna i egen bucket (byggt 2026-09-11, etapp 3)

**Uppmätt via Cloud Monitoring** (`storage.googleapis.com/network/sent_bytes_count`,
frågas med scraperns service-account): bucketen `vadkul-f2cb2.firebasestorage.app`
skickade **1,0–3,7 GB/DYGN** senaste veckan — omslagen går som råa
storage-länkar utanför all CDN, och gamla `max-age=86400` lät webbläsarna
ladda om samma bilder varje dygn.

Gjort: (a) `storageHelper` sätter numera `public, max-age=31536000, immutable`
på nya uppladdningar — säkert eftersom sökvägen är innehållsadresserad (sha1
av käll-URL:en); (b) `oneoff-storage-cache-backfill` satte samma på alla
36 432 befintliga objekt; (c) `oneoff-clear-broken-images` raderade 345
felsidor-som-bild (content-type text/html bakom .jpg — trasig bild på korten)
och nollade coverImage på 175 rader. OBS: HTTP-headern kan visa gamla värdet
upp till ett dygn efter backfillen (Googles edge cachar svaret under gamla
max-age) — verifiera via `file.getMetadata()`, inte curl.

Kvar på bildspåret (ej byggt): omkomprimering. Uppladdningen sparar
ORIGINALBYTES (upp till 8 MB-taket, typiskt 30–140 kB). In-place-recompress
(samma sökväg/ext, mindre bytes) + resize till ~800 px skulle halvera
unika-besökare-egressen; sharp är tillåtet i scrapern (förbudet gäller
apps/web).

### ✅ 5. Deploy-vikten (byggt 2026-09-11, etapp 3) + deploy-hygien

**Uppmätt:** `gcf-v2-sources`-bucketen (frameworks-deployens funktionskälla)
skickade **0,5–5,3 GB/DYGN** — `function-source.zip` är **528 MB** och laddas
upp + ner vid varje deploy. Obduktion av zipen (978 MB rått):

| | |
|---|---|
| `.next/server/app/evenemang` | **639,5 MB** — statiskt bakade stadssidor, ~4,8 MB HTML/stad |
| `.next/cache` (webpack-packs) | **277,8 MB** — byggcache, ren barlast i CI |
| `public/events-*.json` | 38,2 MB — data-snapshoten |

Gjort: `next.config.mjs` stänger av webpack-cachen när `CI` är satt (runnern
är färsk varje gång — cachen återanvänds aldrig; lokala byggen behåller den).
Dör vikten (3,8 MB about-PNG:er, punkt 6) borttagen samtidigt. Väntad effekt:
zip ~528 → ~330 MB. **Verifiera efter nästa deploy** genom att lista
`gcf-v2-sources-888495806926-europe-north1`-bucketens objektstorlek.

Kvar (ej byggt): stadssidornas 639 MB är nästa stora bit — 4,8 MB HTML per
stad drabbar också VARJE sidvisning. Naturlig lösning = kapa SSR-listan till
tidsfönster (steg 3) — men det är ett SEO-/ägarbeslut (body-HTML:en är
SEO-grunden, se seo-foundation). Deploy-FREKVENSEN kvarstår också som
beteendefråga: squasha småfixar (35 deployer 10/9).

### ✅ 6. Död vikt — borttagen 11/9 (ingick i etapp 3)

---

## Testat och förkastat

- **Platssortering av lagren** — se etapp 1: −4 % i brotli mot 17× dyrare
  klientsortering och förlorad tidsordning.
- **Kolumnär kodning** (parallella arrayer i stället för array av objekt):
  −17 % på destinations, men kräver omskrivning av varje läsare — `cityData`,
  `shareData`, `sitemap`, outreach, marketing-routerna. Fel risk/vinst mot
  resten av trappan.
- **Ordlistor för platsnamn** (11 691 unika av 47 613): **noll** vinst ovanpå
  brotli, som redan fångar upprepningarna.
- **Heltalsindex som join-nyckel** i stället för hash: ~0,3 MB bättre ≈ under
  en dollar i månaden. Förkastat ändå: felläget är att en besökare som får
  destinations från ett aggregat och cards från ett annat **tyst får fel bilder
  på fel event**. Innehållshärledd hash är stabil över ombyggen; index är det
  inte.

---

## Ekonomin bakom prioriteringen

Ungefärliga listpriser — **stäm av mot faktisk faktura**, europe-north2 kan
avvika:

- Hosting-egress: ~$0,15/GB
- Firestore-läsningar: ~$0,06 per 100 000

**1 GB sparad egress ≈ 250 000 läsningar** man har råd med i stället. Bytes är
i praktiken alltid dyrare än reads.

Men notera: läsningarna är redan nästan noll. `s-maxage=3600` gör att routen
träffar Firestore ~1 gång i timmen per lager; med `SHARD_SIZE = 700` blir det
~3 300 läsningar/dygn totalt. **Det som ska skyddas är inte läsantalet utan
CDN:ens träffkvot.**
