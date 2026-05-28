# Processen — vad händer i en körning

Två trigger-vägar finns. Stegen är likartade men inte identiska.

## Väg A: Lokal nattkörning (Mac mini / annan dator)

Triggas av `launchd`/cron. Skript: [run-daily.sh](../../apps/scraper/scripts/run-daily.sh).

1. **Setup** — laddar secrets (`TEAMS_WEBHOOK_URL`), öppnar loggfil i `~/Library/Logs/vadkul-scraper/`.
2. **Cleanup** (om `--with-cleanup`) — kör [cleanup-old-events.ts](../../apps/scraper/src/scripts/cleanup-old-events.ts). Tar bort gamla events från Firestore.
3. **Scrape** — kör ett npm-script, t.ex. `npm run scrape-fb`. Per scraper sker stegen i avsnittet "Per scraper" nedan.
4. **post-run-stats** — kör [post-run-stats.ts](../../apps/scraper/src/scripts/post-run-stats.ts). Räknar Firestore + läser `keyword_stats.json`. Skriver `STAT_*=N` till stdout.
5. **Bygg Teams-payload** — bash + python3 läser stats + plockar tail av loggen, bygger Adaptive Card.
6. **POST till Teams** — via webhook.

## Väg B: Cloud Functions (`dailyScraper`)

Triggas av Firebase scheduler `0 6 * * *` Europe/Stockholm. Entry: [functions/src/index.ts](../../apps/functions/src/index.ts).

1. **Init firebase-admin** — service-account via runtime.
2. **Scrape** — kör bara scrapers som inte kräver Puppeteer (Tickster, Eventbrite).
3. **Ingen post-run-stats, ingen Teams**. Cloud-körningen är "tyst" — bara loggrader.

FB-scrapern körs **bara på Väg A** (Puppeteer fungerar inte i Cloud Functions utan extra setup).

## Per scraper (samma mönster)

1. **Discovery** — hitta event-URL:er. FB: sökord-loop över ortsnamn + kategorier. Tickster: en söksida. Etc.
2. **Dedup mot kö** — samma URL via flera sökord räknas en gång. Den första staden vinner som "city-context".
3. **Per URL — Deep-scrape**:
   1. Öppna sidan med Puppeteer (`networkidle2`).
   2. Stäng cookie-banners + login-modaler ([facebook/index.ts:14-42](../../apps/scraper/src/scrapers/facebook/index.ts)).
   3. Extrahera: title, datum, image, locationName, address, description, host, attendees.
   4. **Datum-filter**: skippa om > 7 dagar framåt eller < idag ([facebook/index.ts:476](../../apps/scraper/src/scrapers/facebook/index.ts)).
   5. **Foreign-filter**: skippa geokodning om adressen är utländsk ([venueCoordinates.ts:163](../../apps/scraper/src/utils/venueCoordinates.ts)).
   6. **Geocode** — `geocodeVenueSweden(address)` → Nominatim med `countrycodes=se,dk,no`. Om tomt → `lat=0, lng=0`.
   7. **Image-fallback** — om bilden är tom eller FB-rsrc-default: `searchGoogleImage(title)` ([imageSearch.ts](../../apps/scraper/src/utils/imageSearch.ts)).
   8. **Spara** — `addEventToDb(event)` skriver till Firestore + lokal SQLite ([dbHelper.ts](../../apps/scraper/src/utils/dbHelper.ts)).

## Var siffrorna kommer ifrån i Teams

Se [kampanjer/k6-teams-rapport.md](kampanjer/k6-teams-rapport.md) för full tabell. Kort: `1214 hittade URL:er` kommer från sökord-fasen, `551 sparade` är en grep på loggen (dubbelräknar), `277 i Firebase` är hela `linkEvents`-collectionen.
