# Status

Entry-point. Läs först. Hålls under 60 rader.

## Senaste körning

| | |
|---|---|
| Datum | 2026-05-28 |
| Källa | launchd 01:00 lokal + Cloud Functions 04:00 UTC |
| FB-queries | 306 (113 städer + 40 kw × 2 datumfilter) |
| Unika FB-URLs | 1214 |
| Nya sparade | 252 lokal / ~275 cloud |
| Firebase | 277 aktiva event |
| Duration | FB 120 min, total 128 min |
| Detaljer | [runs/2026-05-28.md](runs/2026-05-28.md) |

## Aktiva kampanjer

**Nästa att ta:** [K3 — Rensa defaults](kampanjer/k3-defaults-rensning.md) + K2-geocoding-retry + regelbaserad kategori-classifier (alla inför ikväll).

| Ordning | ID | Titel | Status |
|---|---|---|---|
| 1 | [K3](kampanjer/k3-defaults-rensning.md) | Rensa defaults som maskar saknad data | PLAN |
| 2 | [K2](kampanjer/k2-city-context.md) | City-context + geocoding-retry | PÅGÅR (26% lat=0) |
| 3 | [K6](kampanjer/k6-teams-rapport.md) | Teams-rapport som visar tratten ärligt | PLAN |
| 4 | [K5 S1](kampanjer/k5-lank-enrichment.md) | Länk-enrichment, Strategi 1 (re-scrape) | PLAN |
| 5 | [K4](kampanjer/k4-lokal-ai.md) | Lokal AI-granskning (Mac mini + Ollama) | PLAN |
| 6 | [K5 S2](kampanjer/k5-lank-enrichment.md) | Länk-enrichment, Strategi 2 (LLM-extraktion) | PLAN |
| — | [K1](kampanjer/k1-chrome-leak.md) | Chrome-läckage + utländska events | KLAR 2026-05-27 |

## Topp-3 öppna problem (per 2026-05-28)

1. **category='other' = 100%** — ingen klassificeringslogik körs alls. Snabb fix: regelbaserad classifier (konsert→music, teater→performing-arts osv). Kollar också om K3-defaults maskar felet.
2. **lat=0,lng=0 på 26%** — många har stad i adressen men Nominatim returnerar tomt. K2-retry-strategi löser estim. halva (K2).
3. **String-defaults maskar saknad data** — `extractedAddress || 'Växjö'`, `category || 'other'` gör att saknad data ser ut som riktig data (K3).

SQL-rensning att köra: `DELETE FROM link_events WHERE extractedAddress LIKE '%Universitetsplatsen%'` (61 gamla K1-läckor).

## Konventioner

- En kampanj = ett spårbart förbättringsspår med tydligt klart-kriterium.
- En run-fil per datum då scrapern kört — kort, max 60 rader.
- Aldrig skriva om historik. Lägg ny rad: `2026-MM-DD: omvärderat — <skäl>`.
- Innan kod-fix på en kampanj — kort plan i kampanj-filen, sedan implementera, sedan markera `KLAR` med commit-hash.

## Vägar att veta

- DB-läsning: `sqlite3 apps/scraper/events.db "<SQL>"`
- Loggfil senaste körning: `~/Library/Logs/vadkul-scraper/full.log`
- Cloud-loggar: `firebase functions:log --only dailyScraper --project=vadkul-f2cb2`
