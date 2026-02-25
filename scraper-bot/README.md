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

## Hur det fungerar i koden:

- `src/index.ts`: Själva startpunkten för botten. Den ropar på alla valda skrapor en och en.
- `src/scrapers/vaxjoco.ts`: Ett exempelskript som öppnar en osynlig Chrome-webbläsare och går till vaxjoco.se för att läsa ut eventdata. **OBS:** Denna kod måste anpassas för varje hemsidas unika HTML-struktur.
- `src/utils/dbHelper.ts`: Går förbi säkerhetsreglerna via Firebase Admin SDK och pratar rakt med databasen för att lägga till nya event och hoppa över dubbletter.

## Automatisk Schemaläggning (Cron)
När skriptet fungerar felfritt kan du schemalägga det med t.ex. GitHub Actions för att köra det helt gratis kl 02:00 varje natt.
