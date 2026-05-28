# Kampanjer

En kampanj = ett förbättringsspår med ett tydligt klart-kriterium. En kampanj löser **en sak**, inte tre.

## Statusvärden

- **PLAN** — beskriven, ej startad
- **PÅGÅR** — kod-fix gjord, ej verifierad mot ny körning
- **KLAR** — verifierad i en faktisk körning (länka till `runs/<datum>.md`)
- **OMVÄRDERAD** — vi backade eller bytte angreppssätt (förklara varför)

## Filmall

```
# K<n>: <kort titel>

Status: PLAN | PÅGÅR | KLAR | OMVÄRDERAD
Startad: 2026-MM-DD
Klart-kriterium: <mätbart, t.ex. "0 events med lat=0,lng=0 där adressen innehåller stad">

## Problem
Bara observerad data — siffror, citat ur DB, filrader. Inga gissningar.

## Hypoteser
Vad vi tror orsaken är. Markera `Hypotes:`.

## Plan
Konkreta steg. En per rad.

## Resultat
Fylls i vid KLAR. Före/efter-siffror + commit-hash + körningsdatum.
```

## Lista

| ID | Titel | Status | Beroende |
|---|---|---|---|
| [K1](k1-chrome-leak.md) | Chrome-läckage + utländska events | KLAR | — |
| [K2](k2-city-context.md) | City-context i Nominatim-fallback | PÅGÅR | — |
| [K3](k3-defaults-rensning.md) | Rensa defaults som maskar saknad data | PLAN | — |
| [K4](k4-lokal-ai.md) | Lokal AI-granskning (Mac mini + Ollama) | PLAN | K3 |
| [K5](k5-lank-enrichment.md) | Länk-baserad enrichment (re-scrape hål) | PLAN | Strategi 2 kräver K4 |
| [K6](k6-teams-rapport.md) | Teams-rapport som visar tratten ärligt | PLAN | Kvalitetsdelen helst efter K3 |
