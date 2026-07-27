# RaceID

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `raceid` |
| **Region** | national |
| **Engine** | `raceid` |
| **Update frequency** | `every-3d` |

## Hur vi hittade den

- **Metod:** `manual`
- **Probe-URL:** https://api.raceid.com/api/v2/web/races?limit=200&page=1
- **Upptäckt:** 2026-06-12

> Endpoint ur static.raceid.com/main.*.js. 5583 lopp totalt sedan 2019, id ASC — INGA server-side datumfilter fungerar; paginera allt + filtrera klient-side. POST /api/v1/web/search finns (GET=405) om server-filter behövs senare.

## Engine-config

```ts
{}
```

## Field-map (var fälten kommer ifrån i råsvaret)

| Fält | Källa |
|---|---|
| `title` | name |
| `startDate` | race_date (YYYY-MM-DD, INGET klockslag → hasSpecificTime=false) |
| `address` | location.street_address (ofta null) |
| `city` | location.city |
| `imageUrl` | image |
| `filter` | published && !is_secret && is_searchable && country=Sweden |

## Larmtrösklar & sample

- **expectedMinEvents:** 50 (under detta = potentiellt trasig källa)
- **Sample event-URL:** https://raceid.com/races/11
- **Senast verifierad:** 2026-06-12

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
