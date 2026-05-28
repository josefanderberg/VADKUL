# K2: City-context i Nominatim-fallback

Status: PÅGÅR
Startad: 2026-05-27
Klart-kriterium: <10 % events i körning där `lat=0,lng=0` trots att en svensk stad finns i `extractedAddress`.

## Problem

72/277 (26 %) av nattens körning har `lat=0, lng=0`. Många har faktiskt stad i adressen:

- "Magasinsvisning – omvärlden i Malmö" — addr: `Malmö Stadsarkiv`
- "Zumba Gold®…Linköping" — addr: `S:t Larsgatan 3, Linköping (ingång Järnvägsgatan)`
- "Dansfest - Örebro Salsafriends" — addr: `Foajén - Örebro Konserthus`
- "Morgonmässa" — addr: `Härnösands domkyrka - Svenska kyrkan Härnösand`

SQL: `SELECT title, locationName FROM link_events WHERE lat=0 AND lng=0` (Firestore-ekvivalent i [runs/2026-05-28.md](../runs/2026-05-28.md)).

## Hypoteser

- *Hypotes A:* Nominatim returnerar tomt för adresser som "Foajén - Örebro Konserthus" eftersom "Foajén" inte är en gata. Retry med enbart staden ("Örebro") triggas inte.
- *Hypotes B:* Stad-kontexten från sök-kön ([index.ts:426](../../../apps/scraper/src/scrapers/facebook/index.ts)) läggs på endast om staden inte redan finns i adressen — men då hjälper det inte ovanstående fall där staden *finns* men adressen ändå inte träffar.

## Plan

1. Lägg in geocoding-loggning per försök (input → svar) så vi kan se exakt vilken query som faller.
2. Explicit retry-strategi: om första försöket returnerar tomt, retry på bara staden (städer kan vi extrahera från adressen lika gärna som från kön).
3. Markera resultatet med en `locationPrecision`-flagga: `exact` | `city` | `none`. Då kan kartan visa stads-nivå-träffar annorlunda än exakta pin.

## Resultat

(Fylls i efter nästa körning.)
