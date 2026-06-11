# Vadkul Scraper Bot

En automatiserad skrapa byggd i Node.js och TypeScript med Puppeteer. 
Dess syfte är att hämta events från externa källor och automatiskt spara dem i Vadkuls Firebase-databas som `linkEvents`.

## 🛠️ Setup

1. **Hämta Firebase Service Account-nyckel**
   - Logga in på [Firebase Console](https://console.firebase.google.com/).
   - Gå till ditt projekt (vadkul) -> Project Settings (Kugghjulet) -> Service Accounts.
   - Klicka på "Generate new private key".
   - Spara JSON-filen som laddas ner i ROTEN av detta projekt (`vadkul-scraper/`) och döp om den till `service-account.json`.

2. **Miljövariabler**
   Kopiera `.env.example` till `.env` och fyll i (än så länge tom, men bra att ha).

3. **Installera beroenden**
   (Redan gjort, men om du laddar ner koden igen kör `npm install`)

## 🚀 Kör Botten

För att starta skrapningen:
```bash
npm run start
```

Detta kompilerar TypeScript-koden i minnet och kör igång Puppeteer.

## 🗄️  Databas-target (`DB_TARGET`)

För att inte bränna Firebase-läsningar under utveckling finns tre databas-target:

| Värde | Mål | Beskrivning |
|-------|-----|-------------|
| `1` (default) | **PROD Firebase** | Använder `service-account.json`. Skarpa läs/skriv. |
| `2` | **LOKAL emulator** (`localhost:8080`) | Firestore-emulator för utveckling. Gratis. |
| `3` | **TEST emulator** (`localhost:8081`) | Separat emulator-instans för engångsexperiment. Gratis. |

Sätt med env-variabel i `.env` eller inline.

### Starta emulator(er)

I en separat terminal:

```bash
npm run emulator:dev    # port 8080  → DB_TARGET=2
npm run emulator:test   # port 8081  → DB_TARGET=3
```

Detta använder `npx firebase-tools emulators:start`, så ingen global install behövs (men första körningen laddar ner CLI:n).

Du kan inspektera datan i emulator-UI:t:
- DB_TARGET=2 → http://localhost:4000
- DB_TARGET=3 → http://localhost:4001

### Kör script mot ett target

Genvägar (sätter `DB_TARGET` åt dig):

```bash
npm run dashboard:local    # dashboard mot target 2
npm run dashboard:test     # dashboard mot target 3
npm run scrape-fb:local    # FB-scrape mot target 2
npm run scrape-fb:test     # FB-scrape mot target 3
```

Eller manuellt:

```bash
DB_TARGET=3 npm run scrape-fb
DB_TARGET=2 npm run fix-addresses
```

Alla script skriver ut ett tydligt banner när de startar så du ser vilken DB de pratar med — t.ex.:

```
════════════════════════════════════════════════════════════
  🗄️  DB_TARGET=3 → TEST emulator :8081
════════════════════════════════════════════════════════════
```

### Typiskt utvecklingsflöde

1. `npm run emulator:test` (terminal A)
2. `npm run scrape-fb:test` (terminal B) — fyller test-DB med data
3. `npm run dashboard:test` (terminal C) — inspektera resultatet
4. Justera kod, iterera. Allt sker gratis lokalt.
5. När det ser bra ut: kör mot PROD utan target-flagga.

## Arkitektur

Två nivåer — och **registryt är default-hemmet för alla nya källor**:

1. **Sources-systemet** (`src/sources/`) — deklarativt registry ([registry.ts](src/sources/registry.ts))
   med ~300 källor som körs genom återanvändbara engines (`sitemap`, `wp-rest`,
   `sitevision`, …). En ny källa = en config-entry, ingen kod.
   - **Runnern** ([runner.ts](src/sources/runner.ts)) äger den gemensamma pipelinen:
     validera → datumfönster → dedup → geocoding → klassificering → DB-skrivning →
     run-historik (`scrape_runs`). Engines gör BARA extraction (`RawEvent[]`).
   - **Nätverks-engines**: paraply-API:er där EN engine täcker hela nätverket
     (Hembygd, Svenska kyrkan, Naturskyddsföreningen, Rotary, Röda Korset).
     Koden bor i `src/scrapers/<id>.ts`, registreras i `ENGINES` (`src/sources/index.ts`)
     och får schemaläggning/dry-run/run-historik gratis via registryt.
     Kör en enskild: `npm run sources -- --ids=svenska-kyrkan --dry-run`
   - **Schemaläggning**: `updateFrequency` (hourly/daily/every-3d/weekly) sprider
     körningar över veckan — se [schedule.ts](src/sources/schedule.ts).

2. **Bespoke-scrapers** (`src/index.ts` → `src/scrapers/`) — Puppeteer/HTML-tunga
   källor som inte passar engine-formen än (Facebook, Eventbrite, Tickster,
   Meetup, lokala Växjö-sajter). Skriver direkt via `dbHelper`. Nya källor ska
   i första hand byggas som engines, inte här.

- `src/utils/dbHelper.ts`: skriver till lokal SQLite (`events.db`) + Firestore parallellt.
- `src/scripts/aggregate-events.ts`: exporterar publicerade events till `apps/web/public/*.json`.

## Tester

```bash
npm test          # vitest — runner-pipeline, engine-mappers, schedule, registry-sanity
npm run test:watch
```

Testerna kör mot `:memory:`-SQLite och mockar allt nätverk/Firebase — de kan aldrig
röra riktiga databaser. Registry-sanity-testet fångar felkonfig (dubblerade ids,
engine-namn utan implementation) innan nattjobbet gör det.

## Automatisk Schemaläggning
Nattliga körningar orkestreras av `scripts/run-daily.sh` (launchd) som kör
scrapers + cleanup/enrich/audit-stegen och postar resultat till Teams.

