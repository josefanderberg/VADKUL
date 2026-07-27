# Riksteatern

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `riksteatern` |
| **Region** | national |
| **Engine** | `riksteatern` |
| **Update frequency** | `every-3d` |

## Hur vi hittade den

- **Metod:** `manual`
- **Probe-URL:** https://www.riksteatern.se/api/performance/filter/all?onlyNationalProductions=false&showSubscribedPerformances=false&startDate=2026-06-12&endDate=2026-07-12&page=1&itemsPerPage=2000
- **Upptäckt:** 2026-06-12

> Öppet JSON-API hittat i performances.service.es5.js (AngularJS-bundle). itemsPerPage ignoreras — page=1 ger ALLT i datumfönstret, page=2 är tom.

## Engine-config

```ts
{}
```

## Field-map (var fälten kommer ifrån i råsvaret)

| Fält | Källa |
|---|---|
| `title` | title |
| `startDate` | date (ISO8601 — använd ALDRIG day/month/year, month är svensk text) |
| `venueName` | locationInfo ("Gräsplanen bakom Flora Biografteater, Sjöbo") |
| `city` | municipality |
| `imageUrl` | imageUrl (relativ) |
| `organizer` | orgName (lokalföreningen) |
| `dubbletter` | isCrossReference=true skippas |
| `url` | produktions-URL — unikgörs med #YYYY-MM-DD |

## Larmtrösklar & sample

- **expectedMinEvents:** 10 (under detta = potentiellt trasig källa)
- **Sample event-URL:** https://www.riksteatern.se/forening/fars-riksteaterforening/bravissimo/
- **Senast verifierad:** 2026-06-12

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
