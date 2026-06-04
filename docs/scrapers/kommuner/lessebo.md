# Lessebo Kommun

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `lessebo` |
| **Region** | lessebo |
| **Engine** | `sitevision` |
| **Update frequency** | `every-3d` |

## Hur vi hittade den

- **Metod:** `probe-sitevision`
- **Probe-URL:** https://www.lessebo.se/evenemang
- **Upptäckt:** 2026-06-04
- **Kör om probet:** `npm run probe-sitevision -- --only=lessebo`

## Engine-config

```ts
{
  "urls": [
    "https://www.lessebo.se/evenemang"
  ],
  "defaultCity": "Lessebo"
}
```

## Field-map (var fälten kommer ifrån i råsvaret)

| Fält | Källa |
|---|---|
| `title` | eventListing.events[].title  (XHR: /api/event-search eller liknande) |
| `startDate` | eventListing.events[].startDate (ISO eller "YYYY-MM-DD HH:mm") |
| `endDate` | eventListing.events[].endDate |
| `url` | eventListing.events[].url (relativ — joinas med urls[0]) |
| `venueName` | eventListing.events[].location.name |
| `address` | eventListing.events[].location.address |
| `city` | eventListing.events[].location.city || config.defaultCity |
| `description` | eventListing.events[].description eller .summary |
| `imageUrl` | eventListing.events[].image.url |
| `organizer` | config.hostName |
| `engineHint` | se.soleil.eventListingLocal — SiteVisions standard-modul |

## Larmtrösklar & sample

- _expectedMinEvents inte satt._
- _Inget sample event-URL satt — vid nästa körning, hitta en känd-bra URL och pasta in._

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
