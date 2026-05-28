# K3: Rensa defaults som maskar saknad data

Status: PLAN
Startad: 2026-05-28
Klart-kriterium: Inga string-defaults i scrapern. Saknade fält är `null`/tom sträng + en boolean-flagga som markerar att default användes.

## Problem

Scrapern fyller idag i hårdkodade defaults när data saknas. Det gör datat svårt att granska — både för människor och för en AI-granskning vi planerar köra på Mac mini (Ollama). Ett event som saknar plats ser ut som ett event i Växjö.

| Fil | Rad | Default |
|---|---|---|
| [facebook/extractor.ts](../../../apps/scraper/src/scrapers/facebook/extractor.ts) | 14 | `title || 'Facebook Event'` |
| [facebook/extractor.ts](../../../apps/scraper/src/scrapers/facebook/extractor.ts) | 62 | location-extractor returnerar `'Växjö'` |
| [facebook/index.ts](../../../apps/scraper/src/scrapers/facebook/index.ts) | 347-353 | existing-event-flöde: `'Okänd'`, `'Växjö'`, `'Växjö'`, `'other'` |
| [upplev.ts](../../../apps/scraper/src/scrapers/upplev.ts) | 181, 327 | `'Växjö'` |
| [vaxjoco.ts](../../../apps/scraper/src/scrapers/vaxjoco.ts) | 291 | `'Växjö'` |
| [eventbrite.ts](../../../apps/scraper/src/scrapers/eventbrite.ts) | 120 | `'Växjö'` |
| [utils/venueCoordinates.ts](../../../apps/scraper/src/utils/venueCoordinates.ts) | 128-130 | `VAXJO_VENUES.DEFAULT = [56.8796, 14.8094]` (Stortorget) — stum bomb |
| [scripts/aggregate-events.ts](../../../apps/scraper/src/scripts/aggregate-events.ts) | 62, 70 | `category || 'other'` |
| [scripts/publish-fb.ts](../../../apps/scraper/src/scripts/publish-fb.ts) | 46 | `📍 ${event.locationName || 'Växjö'}` |

## Hypoteser

- *Hypotes:* `category = 'other'` på 270/277 (97 %) är delvis defaultens fel, inte enbart klassificerarens — vi behöver mäta efter K3 om "other"-andelen sjunker.
- *Hypotes:* `VAXJO_VENUES.DEFAULT` har aldrig triggat i nuvarande körning, men finns som risk-yta. Bör verifieras genom att söka i loggen.

## Plan

1. Byt alla `|| 'Växjö'` / `|| 'Okänd'` / `|| 'Facebook Event'` till `|| null` (eller tom sträng).
2. Lägg till boolean-fält i event-objektet: `titleVerified`, `locationVerified` (finns delvis), `categoryVerified`. Sätt `false` när default ersatt data.
3. Ta bort `VAXJO_VENUES.DEFAULT`-nyckeln. `getVenueCoordinates` ska returnera `null` om ingen riktig match finns.
4. Uppdatera `publish-fb.ts` och `aggregate-events.ts` att hantera null på visnings-sidan istället för i datan.
5. Verifiera mot Firestore efter nästa körning: andel `locationName=null`, `lat=0,lng=0`, `category=null` ska stiga (det är önskat — det visar var datat faktiskt är hål).

## Resultat

(Fylls i efter nästa körning.)
