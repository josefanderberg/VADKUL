# Korpen

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `korpen` |
| **Region** | national |
| **Engine** | `korpen` |
| **Update frequency** | `every-3d` |

## Hur vi hittade den

- **Metod:** `manual`
- **Probe-URL:** https://korpenlund.zoezi.se/api/public/workout/get/all?fromDate=2026-06-12&toDate=2026-07-12
- **Upptäckt:** 2026-06-12
- **Kör om probet:** `curl -s "https://www.korpen.se/foreningar/" | grep -oE 'href="/[a-z0-9-]+"'`

> Katalogen korpen.se/foreningar/ är statisk SSR — slug = Zoezi-subdomän (1:1). ~102/136 slugs har live Zoezi-instans. Inget centralt Zoezi-register finns.

## Engine-config

```ts
{}
```

## Field-map (var fälten kommer ifrån i råsvaret)

| Fält | Källa |
|---|---|
| `title` | workouts[].extra_title (fallback workoutType.name) |
| `startDate` | workouts[].startTime ("YYYY-MM-DD HH:mm:ss" lokal väggtid) |
| `venueName` | workouts[].resources[resourceType=location].lastname |
| `city` | workouts[].resources[].city (ibland VERSALER) |
| `coords` | workouts[].resources[].position — STRÄNG "lat,lng", LATITUD FÖRST |
| `status` | workouts[].status — filtrera "Cancelled" |

## Larmtrösklar & sample

- **expectedMinEvents:** 100 (under detta = potentiellt trasig källa)
- **Sample event-URL:** https://korpenlund.zoezi.se/schema
- **Senast verifierad:** 2026-06-12

## Troubleshooting

- Tom workouts-lista överallt? Kolla datumformatet (bindestreck!) före allt annat.
- korpen.se/sitemap.xml ger ASP.NET 500 — använd /foreningar/-HTML:en för enumeration.

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
