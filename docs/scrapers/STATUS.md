# Status

Entry-point. Läs först. Hålls under 60 rader.

## Senaste körning

| | |
|---|---|
| Datum | 2026-05-28 |
| Källa | nattens `dailyScraper` (Cloud Functions) |
| Nya event i Firebase | 277 |
| Lokala saved-stats | 551 (Teams-rapport) — diskrepans, se K3 |
| Detaljer | [runs/2026-05-28.md](runs/2026-05-28.md) |

## Aktiva kampanjer

**Nästa att ta:** [K3 — Rensa defaults som maskar saknad data](kampanjer/k3-defaults-rensning.md).

| Ordning | ID | Titel | Status |
|---|---|---|---|
| 1 | [K3](kampanjer/k3-defaults-rensning.md) | Rensa defaults som maskar saknad data | PLAN |
| 2 | [K6](kampanjer/k6-teams-rapport.md) | Teams-rapport som visar tratten ärligt | PLAN |
| 3 | [K2](kampanjer/k2-city-context.md) | City-context i Nominatim-fallback | PÅGÅR (72/277 lat=0,lng=0) |
| 4 | [K5 S1](kampanjer/k5-lank-enrichment.md) | Länk-enrichment, Strategi 1 (re-scrape) | PLAN |
| 5 | [K4](kampanjer/k4-lokal-ai.md) | Lokal AI-granskning (Mac mini + Ollama) | PLAN |
| 6 | [K5 S2](kampanjer/k5-lank-enrichment.md) | Länk-enrichment, Strategi 2 (LLM-extraktion) | PLAN |
| — | [K1](kampanjer/k1-chrome-leak.md) | Chrome-läckage + utländska events | KLAR 2026-05-27 |

Varför just den ordningen:

- **K3 först** — utan att defaults är borta luras alla efterföljande mätningar/granskningar (inkl. K4-AI:n).
- **K6 näst** — utan en ärlig tratt-rapport kan vi inte mäta om följande kampanjer faktiskt hjälper.
- **K2** — billigt fix, räddar 26 % av events direkt.
- **K5 Strategi 1** — re-scrape med längre väntetid, oberoende.
- **K4** — lokal AI sist eftersom den kräver att data är ärlig (K3) och mätbar (K6).
- **K5 Strategi 2** — LLM-extraktion ovanpå K4.

## Topp-3 öppna problem (per 2026-05-28)

1. **lat=0,lng=0 på 26 %** — många har stad i adressen men Nominatim returnerar tomt (K2).
2. **String-defaults maskar saknad data** — t.ex. `extractedAddress || 'Växjö'`, `category || 'other'`. Försvårar både manuell granskning och kommande AI-granskning (K3).
3. **551 sparade → 277 i DB**. Stats ljuger någonstans. Sannolikt dedup via deterministiska doc-ID:n eller post-save-filter. Mer i [runs/2026-05-28.md](runs/2026-05-28.md).

## Konventioner

- En kampanj = ett spårbart förbättringsspår med tydligt klart-kriterium.
- En run-fil per datum då scrapern kört — kort, max 60 rader.
- Aldrig skriva om historik. Lägg ny rad: `2026-MM-DD: omvärderat — <skäl>`.
- Innan kod-fix på en kampanj — kort plan i kampanj-filen, sedan implementera, sedan markera `KLAR` med commit-hash.

## Vägar att veta

- DB-läsning i prod: `cd apps/scraper && DB_TARGET=1 npx tsx <script>.ts`
- Cloud-loggar (senaste): `firebase functions:log --only dailyScraper --project=vadkul-f2cb2`
- Skrivregler: [README.md](README.md)
