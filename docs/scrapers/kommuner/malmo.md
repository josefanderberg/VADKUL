# Malmö Stad

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `malmo` |
| **Region** | malmo |
| **Engine** | `sitevision` |
| **Update frequency** | `daily` |

## Hur vi hittade den

- **Metod:** `probe-xhr`
- **Probe-URL:** https://malmo.se/appresource/4.50574bcf196ed960a55408d/12.50574bcf196ed960a55409f/items?start=0&num=100
- **Upptäckt:** 2026-07-09
- **Antal events vid upptäckt:** 357

> "Visa fler evenemang"-knappens XHR avslöjade appresource-endpointen; num=100 funkar (server-default 18/sida).

## Engine-config

```ts
{
  "urls": [
    "https://malmo.se/evenemangskalender"
  ],
  "defaultCity": "Malmö",
  "itemsApi": {
    "pageId": "4.50574bcf196ed960a55408d",
    "portletId": "12.50574bcf196ed960a55409f"
  }
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
- **Senast verifierad:** 2026-07-09

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
