# K6: Teams-rapport som faktiskt visar tratten

Status: PLAN
Startad: 2026-05-28
Klart-kriterium: Teams-meddelandet visar trattens steg från sökord → spara, med korrekta siffror (ingen dubbelräkning) och delta mot föregående körning. Det går att svara på "blev det bättre än igår?" direkt från Teams.

## Problem

Dagens meddelande blandar tre olika datakällor utan att förklara:

| Siffra | Sägs vara | Faktiskt |
|---|---|---|
| 1214 Unika FB-event | hittade events | URL:er i sökresultatet (ej försökta scrapas) |
| 551 Nya event sparade | sparningar | grep-träffar på `✅ Saved\|Sparat\|Sparade` — **två träffar per event** ([index.ts:519+539](../../../apps/scraper/src/scrapers/facebook/index.ts)) |
| 0 Redan i DB | duplikat | grep på engelska `already exists:` — scrapern loggar svenska, så matchar aldrig |
| 277 Totalt i Firebase | totalsumman | OK — men presenteras som "resultat av idag", utan delta mot igår |

Konsekvens: man kan inte avgöra om körningen blev bättre eller sämre. 551 vs 277 ser ut som en bugg men är troligen dubbelräknad grep — vi vet inte säkert eftersom siffrorna inte härrör från samma källa.

## Hypoteser

- *Hypotes:* SAVED_COUNT ≈ 2 × (faktiskt sparade), eftersom scrapern loggar `✅ Saved: ...` *och* `✅ Sparade: ...` per event. 551/2 = 275 ≈ 277.
- *Hypotes:* Det stora tappet 1214 → ~275 är legitimt (datum-filter, sidan kunde inte öppnas, foreign-filter) — men vi har ingen siffra per filtersteg.

## Plan

1. Räkna i scrapern, inte i grep. Lägg per-filter-räknare i [facebook/index.ts](../../../apps/scraper/src/scrapers/facebook/index.ts) — t.ex. `filteredOutsideWeek++`, `filteredForeign++`, `failedToOpen++`, `successfullySaved++`. Skriv till `keyword_stats.json` eller separat `run_stats.json`.
2. Läs in dem i [post-run-stats.ts](../../../apps/scraper/src/scripts/post-run-stats.ts) som nya `STAT_*=N`-rader.
3. Spara `STAT_TOTAL_EVENTS_PREVIOUS` mellan körningar (skriv till en liten fil efter varje körning) så Teams kan visa `+N` delta.
4. Lägg till kvalitetssiffror i `post-run-stats.ts`: andel med koord, andel med bild, andel med beskrivning, andel `category != 'other'`.
5. Skriv om Teams-payload i [run-daily.sh](../../../apps/scraper/scripts/run-daily.sh) till en trattvy:
   - Tratt: sökord → URL:er → filtrerade → försökta → sparade → delta i DB
   - Firebase nu: totalt, med koord, med bild, med beskrivning
   - Kommande 7 dagar + heta platser (oförändrat)
6. Ta bort `SKIPPED_COUNT`-grep:en — ersätt med exakt räknare från scrapern.

## Beroenden

- Kvalitetsmätningarna (steg 4) blir mest meningsfulla **efter K3** (defaults-rensning), eftersom annars ser allt "med koord/bild/desc" ut även när det är defaults.

## Resultat

(Fylls i efter pilot.)
