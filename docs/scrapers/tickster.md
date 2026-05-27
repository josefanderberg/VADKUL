# Tickster

Källa: 79/1200 events (6.6%). Scraper: [src/scrapers/tickster.ts](../../apps/scraper/src/scrapers/tickster.ts).

**Status 2026-05-27:** fält-fix applicerad. Singel-URL-test: `extractedAddress` fylls från microdata/text-fallback (`Magasinsgatan 8, Stockholm`). `description` fortfarande tomt — **bekräftat: Tickster har ingen JSON-LD alls** på event-sidor (grep mot live-HTML, 0 träffar). För description krävs separat HTML-selektor (utanför scope, se Fortsättning).

## Nu-läget

Snapshot: `events.db` 2026-05-27.

| Mått | Antal | % av Tickster |
|---|---|---|
| Totalt | 79 | 100 |
| `description = ''` | 79 | 100 |
| `extractedAddress = ''` | 79 | 100 |
| `geocodedQuery = ''` | 79 | 100 |
| `isLocationVerified = 0` | 79 | 100 |
| `isHostVerified = 0` | 79 | 100 |
| Koord `(0,0)` | 0 | 0 |

Plus 8 events med titel `"Tickster Event"` och URL i form av en söklist-URL (`/events/search?date_from=…`). Skapade av [today-sweden.ts](../../apps/scraper/src/scrapers/today-sweden.ts), inte tickster.ts.

SQL: `SELECT title, url FROM link_events WHERE title='Tickster Event'`.

## Analys

**Två separata problem som ser ut som ett:**

1. **Tickster.ts sparar bara halva schemat.** [tickster.ts:360-373](../../apps/scraper/src/scrapers/tickster.ts:360) bygger event-objektet utan `extractedAddress`, `description`, `geocodedQuery`, `isHostVerified`. SQLite-helpern defaultar till `''`/`0`.
   - Inte ett extraktionsfel — datan plockas (JSON-LD ger street/city/postal) men slängs efter byggandet av `locationName`-strängen.
   - *Risk*: vi har fält i schemat som *aldrig* fylls för Tickster. Klienten kan inte skilja "inte extraherat" från "fanns inte".

2. **today-sweden.ts sparar söklistor som events.** [today-sweden.ts:88-93](../../apps/scraper/src/scrapers/today-sweden.ts:88):
   ```js
   if (href.includes(todayStr)) { … }
   ```
   Söklistans egen URL innehåller datumet i query-stringen. Den matchar. Den sparas. Titel hårdkodas till `"Tickster Event"`.
   - *Hypotes*: regexen var skriven för event-URL:er av typen `/events/abc123/2026-05-26/...` men hamnar fel pga query-string-matchning.

**Vad funkar:** koord-extraktionen via JSON-LD ger korrekt lat/lng för alla 79. Att `isLocationVerified=0` är *bara* för att fältet aldrig sätts — koord är korrekta.

## Begränsningar

Den här rundan: fixa **bara** den hårdkodade defaulten i tickster.ts (sätt `extractedAddress`, `description`, `isLocationVerified` i objektet).

Vi rör **inte**:
- today-sweden.ts → egen fil ([inaktiva.md](inaktiva.md)).
- Description-extraktion (Tickster har det inte i JSON-LD, kräver separat fält-läsning).
- Att gå från 79 → fler events. Volymen är inte huvudfrågan.

## Fortsättning

Öppna frågor:

- [ ] Hur ska `description` hämtas? Schemat i markupen har det inte. Cheerio-läs `.event-description` eller liknande?
- [ ] Vill vi `isLocationVerified=true` när koord kommer från JSON-LD utan extra check? (Sannolikt ja — JSON-LD är auktoritativ.)
- [ ] Tickster har många dubletter mot Facebook (samma event på båda). Dedup-strategi?

Nästa beslut: peka på en specifik tickster-event-URL och spec:a vilka av schemats fält som ska populeras, från vilken källa.
