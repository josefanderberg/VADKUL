# Båstad

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `bastad` |
| **Region** | bastad |
| **Engine** | `wp-rest` |
| **Update frequency** | `daily` |

## Hur vi hittade den

- **Metod:** `probe-wp`
- **Probe-URL:** https://www.bastad.com/wp-json/tribe/events/v1/events
- **Upptäckt:** 2026-06-01
- **Antal events vid upptäckt:** 48
- **Kör om probet:** `npm run probe-wp -- --only=bastad`

> Probe 2026-06: 48 events. The Events Calendar (Tribe).

## Engine-config

```ts
{
  "baseUrl": "https://www.bastad.com",
  "variant": "tribe"
}
```

## Field-map (var fälten kommer ifrån i råsvaret)

| Fält | Källa |
|---|---|
| `title` | item.title |
| `startDate` | item.start_date (ISO) |
| `endDate` | item.end_date (ISO) |
| `url` | item.url |
| `venueName` | item.venue.venue |
| `address` | item.venue.address + item.venue.city + item.venue.zip |
| `city` | item.venue.city |
| `coords` | [item.venue.geo_lat, item.venue.geo_lng] |
| `description` | item.description (HTML→text) |
| `imageUrl` | item.image.url || item.image.sizes.full.url |
| `organizer` | item.organizer[0].organizer |
| `categories` | item.categories[].name |
| `cost` | item.cost |

## Larmtrösklar & sample

- **expectedMinEvents:** 24 (under detta = potentiellt trasig källa)
- _Inget sample event-URL satt — vid nästa körning, hitta en känd-bra URL och pasta in._

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
