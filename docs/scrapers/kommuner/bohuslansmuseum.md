# Bohusläns Museum

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `bohuslansmuseum` |
| **Region** | uddevalla |
| **Engine** | `wp-rest` |
| **Update frequency** | `every-3d` |

## Hur vi hittade den

- **Metod:** `probe-wp`
- **Probe-URL:** https://www.bohuslansmuseum.se/wp-json/tribe/events/v1/events
- **Upptäckt:** 2026-07-03

## Engine-config

```ts
{
  "baseUrl": "https://www.bohuslansmuseum.se",
  "variant": "tribe",
  "defaultCity": "Uddevalla"
}
```

## Field-map (var fälten kommer ifrån i råsvaret)

_Ingen field-map definierad._

## Larmtrösklar & sample

- _expectedMinEvents inte satt._
- _Inget sample event-URL satt — vid nästa körning, hitta en känd-bra URL och pasta in._
- **Senast verifierad:** 2026-07-03

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
