# Norsjö Kommun

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `norsjo` |
| **Region** | norsjo |
| **Engine** | `wp-rest` |
| **Update frequency** | `every-3d` |

## Hur vi hittade den

- **Metod:** `probe-wp`
- **Probe-URL:** https://www.norsjo.se/wp-json/tribe/events/v1/events
- **Upptäckt:** 2026-06-01
- **Antal events vid upptäckt:** 47
- **Kör om probet:** `npm run probe-wp -- --only=norsjo`

> Probe 2026-06: 47 events. The Events Calendar (Tribe) — guld!

## Engine-config

```ts
{
  "baseUrl": "https://www.norsjo.se",
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

- **expectedMinEvents:** 23 (under detta = potentiellt trasig källa)
- _Inget sample event-URL satt — vid nästa körning, hitta en känd-bra URL och pasta in._

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
