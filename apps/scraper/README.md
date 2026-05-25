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

## Hur det fungerar i koden:

- `src/index.ts`: Själva startpunkten för botten. Den ropar på alla valda skrapor en och en.
- `src/scrapers/vaxjoco.ts`: Ett exempelskript som öppnar en osynlig Chrome-webbläsare och går till vaxjoco.se för att läsa ut eventdata. **OBS:** Denna kod måste anpassas för varje hemsidas unika HTML-struktur.
- `src/utils/dbHelper.ts`: Går förbi säkerhetsreglerna via Firebase Admin SDK och pratar rakt med databasen för att lägga till nya event och hoppa över dubbletter.

## Automatisk Schemaläggning (Cron)
När skriptet fungerar felfritt kan du schemalägga det med t.ex. GitHub Actions för att köra det helt gratis kl 02:00 varje natt.

