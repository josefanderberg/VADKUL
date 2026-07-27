# Equmenia

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `equmenia` |
| **Region** | national |
| **Engine** | `wp-rest` |
| **Update frequency** | `every-3d` |

## Hur vi hittade den

- **Metod:** `probe-wp`
- **Probe-URL:** https://equmenia.se/wp-json/tribe/events/v1/events?per_page=50&start_date=2026-06-12
- **Upptäckt:** 2026-06-12

> The Events Calendar REST, öppen. ~61 kommande (scoutläger, barn/ungdom). venue är oftast bara ett NAMN utan geo_lat/adress → geokodas.

## Engine-config

```ts
{
  "baseUrl": "https://equmenia.se",
  "variant": "tribe",
  "defaultCity": ""
}
```

## Field-map (var fälten kommer ifrån i råsvaret)

_Ingen field-map definierad._

## Larmtrösklar & sample

- **expectedMinEvents:** 20 (under detta = potentiellt trasig källa)
- _Inget sample event-URL satt — vid nästa körning, hitta en känd-bra URL och pasta in._
- **Senast verifierad:** 2026-06-12

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
