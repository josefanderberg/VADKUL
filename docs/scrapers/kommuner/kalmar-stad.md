# Kalmar Kommun

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `kalmar-stad` |
| **Region** | kalmar |
| **Engine** | `sitevision` |
| **Update frequency** | `daily` |

## Hur vi hittade den

- **Metod:** `probe-xhr`
- **Probe-URL:** https://kalmar.com/appresource/4.2a057aed1776e064a774f0/12.2a057aed1776e064a77113f/events?fromDate=2026-07-27T00:00:00.000Z&toDate=2026-09-30T21:59:59.999Z&categories=&limit=500
- **Upptäckt:** 2026-07-27
- **Antal events vid upptäckt:** 171

> Kalendersidans egna XHR (fromDate/toDate/limit). Fältet "URl" (sic). local=venue, location=gatuadress.

## Engine-config

```ts
{
  "urls": [
    "https://kalmar.com/evenemang/"
  ],
  "defaultCity": "Kalmar",
  "eventSearchApi": {
    "pageId": "4.2a057aed1776e064a774f0",
    "portletId": "12.2a057aed1776e064a77113f"
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
- **Senast verifierad:** 2026-07-27

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
