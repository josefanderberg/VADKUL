# Visit Stockholm

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `visit-stockholm` |
| **Region** | stockholm |
| **Engine** | `nextjs-data` |
| **Update frequency** | `daily` |

## Hur vi hittade den

- **Metod:** `probe-xhr`
- **Probe-URL:** https://www.visitstockholm.com/events/
- **Upptäckt:** 2026-06-04
- **Kör om probet:** `npx ts-node src/scripts/probe-xhr.ts --only=stockholm`

> Next.js __NEXT_DATA__ extraction — events i contentBlocks[].value.items.

## Engine-config

```ts
{
  "urls": [
    "https://www.visitstockholm.com/events/"
  ],
  "defaultCity": "Stockholm"
}
```

## Field-map (var fälten kommer ifrån i råsvaret)

| Fält | Källa |
|---|---|
| `title` | __NEXT_DATA__.props.pageProps.<...>.title (path varierar per sajt) |
| `startDate` | __NEXT_DATA__.props.pageProps.<...>.startDate (eller .date / .start) |
| `endDate` | __NEXT_DATA__.props.pageProps.<...>.endDate |
| `url` | relativ slug joinat med config.urls[0] |
| `venueName` | __NEXT_DATA__.props.pageProps.<...>.location.name |
| `city` | __NEXT_DATA__.props.pageProps.<...>.location.city || config.defaultCity |
| `description` | __NEXT_DATA__.props.pageProps.<...>.description |
| `imageUrl` | __NEXT_DATA__.props.pageProps.<...>.image.url |
| `engineHint` | Sök igenom __NEXT_DATA__ rekursivt efter array med {title, startDate} |

## Larmtrösklar & sample

- _expectedMinEvents inte satt._
- _Inget sample event-URL satt — vid nästa körning, hitta en känd-bra URL och pasta in._

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
