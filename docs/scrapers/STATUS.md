# Status

Entry-point. Läs först. Hålls under 60 rader.

## Senaste riktade insats

2026-09-04: **Källsvep storstadsscener + svagaste städerna** — Stockholm Lives
fem arenor, Berwaldhallen, Debaser, Got Event (Scandinavium/Ullevi), Visit
Luleå, Visit Roslagen in; Pustervik + Konserthuset lagade. Två nya motorer
(`gotevent`, `visitlulea`), tre motorfixar. Ticketmasters API har bara ~200
SE-event — arenorna måste tas från egna sajter. Recept för det som inte
byggdes (Ystad-Österlen, Svensk Jazz, Malmö Arena) i
[runs/2026-09-04.md](runs/2026-09-04.md).

2026-07-27: **Dammsugning Borås/Kalmar/Östersund/Eskilstuna** (GSC-topstäderna) —
9 nya/väckta källor, ~560 nya event. Ny `wp-graphql`-engine + 2 sitevision-API-
varianter. Detaljer: [runs/2026-07-27.md](runs/2026-07-27.md).

## Senaste körning

| | |
|---|---|
| Datum | 2026-05-29 |
| Källa | launchd 01:00 lokal Mac |
| FB-queries | 304 (113 städer + 39 kw × 2 datumfilter) |
| Unika FB-URLs | 1336 |
| Nya sparade | 332 (312 FB + 19 Tickster + 1 Meetup) |
| Pre-save utländskt filter | 279 stoppade |
| FB-events i DB | 1576 |
| Detaljer | [runs/2026-05-29.md](runs/2026-05-29.md) · [post-session 29b](runs/2026-05-29b.md) |

## Kvalitet (trend)

| Mått | 2026-05-28 | 2026-05-29 | 29b (backfill) | Trend |
|---|---|---|---|---|
| lat=0 | 26.2% | 16.2% | 16.2% | ✅ −10pp |
| isLocationVerified | 73.8% | 83.8% | 83.8% | ✅ +10pp |
| category='other' | 100% | 71.4% | **26.3%** | ✅✅ −45.1pp |
| locationName saknas | 5.7% | 4.0% | 4.0% | ✅ −1.7pp |

## Aktiva kampanjer

| ID | Titel | Status |
|---|---|---|
| [K1](kampanjer/k1-chrome-leak.md) | Chrome-läckage + utländska events | KLAR 2026-05-27 |
| [K2](kampanjer/k2-city-context.md) | City-context + geocoding-retry | KLAR (de facto) |
| [K3](kampanjer/k3-defaults-rensning.md) | Rensa defaults som maskar saknad data | KLAR (de facto) |
| [K4](kampanjer/k4-lokal-ai.md) | Lokal AI-granskning (Mac mini + Ollama) | AKTIV — gräns höjd 200→500 |
| [K5](kampanjer/k5-lank-enrichment.md) | Länk-enrichment | PLAN |
| [K6](kampanjer/k6-teams-rapport.md) | Teams-rapport som visar tratten ärligt | PLAN |
| K7 | Eventbrite + Eventim scrapers (Puppeteer) | KLAR 2026-05-29c |
| [K9](kampanjer/k9-datakvalitet.md) | Datakvalitet: kapade beskrivningar, å/ä/ö, pris ur text | KOD KLAR 2026-09-03 — data läks av nattkedjan |

## Topp-3 öppna problem (per 2026-05-29b)

1. **lat=0 = 16.2%** — 256 events saknar koordinater. K4-gräns höjd 200→500 inför nästa körning. Strukturella miss: lokala venues saknas i Nominatim.
2. **category='other' = 26.3%** — ner från 71.4%. 415 kvar; kräver LLM eller manuell insats. K4 tar dessa natt för natt.
3. **O'Learys-dedup** — samma event sparas på 5 datum-URLs. title+date-dedup saknas.

## Konventioner

- En kampanj = ett spårbart förbättringsspår med tydligt klart-kriterium.
- En run-fil per datum då scrapern kört — kort, max 60 rader.
- Aldrig skriva om historik. Lägg ny rad: `2026-MM-DD: omvärderat — <skäl>`.
- Innan kod-fix på en kampanj — kort plan i kampanj-filen, sedan implementera, sedan markera `KLAR` med commit-hash.

## Vägar att veta

- DB-läsning: `sqlite3 apps/scraper/events.db "<SQL>"`
- Loggfil senaste körning: `~/Library/Logs/vadkul-scraper/full.log`
- Cloud-loggar: `firebase functions:log --only dailyScraper --project=vadkul-f2cb2`
