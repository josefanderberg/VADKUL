# K1: Chrome-läckage + utländska events

Status: KLAR
Startad: 2026-05-27
Klart-kriterium: 0 events med adress "Universitetsplatsen 1, Växjö" där titeln inte är från Växjö.

## Problem

- 61 events hade adressen `Universitetsplatsen 1, 35252 Växjö, Sweden` trots att titeln pekade på andra städer (Karlskrona, Motala, Hässleholm, Alingsås).
- ~22 events utanför Norden (USA, NZ, UK) fick svenska koordinater eftersom Nominatim partial-matchade gatunamn inom Nordens bbox.

## Hypoteser

- *Hypotes:* en body-wide adress-scanning i [location.ts](../../../apps/scraper/src/scrapers/facebook/location.ts) plockade UI-text från Chromes sidopaneler när pin-raden saknades.
- *Hypotes:* Nominatim med `countrycodes=se,dk,no` returnerar fel träff för utländska adresser eftersom svenska bboxen tvingas fram.

## Plan

1. Ta bort body-wide-fallbacken i `location.ts`. Förlita oss enbart på pin-radens adress.
2. Lägg till `isForeignAddress`-check i [venueCoordinates.ts](../../../apps/scraper/src/utils/venueCoordinates.ts) — skippa geokodning helt om adressen innehåller utländska indikatorer.

## Resultat

Verifierat 2026-05-28 mot Firestore (277 events från nattens körning):

- `Universitetsplatsen 1`-läckage: **0** (var 61).
- Utländska events med svenska falska koord: nära 0 (de hamnar nu på lat=0,lng=0 istället — fångas av K2/oidentifierade-bucket).

Commit-hash: `220791d` *(feat: update scrapping)*.
