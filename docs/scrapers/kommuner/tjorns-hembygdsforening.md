# Tjörns Hembygdsförening

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `tjorns-hembygdsforening` |
| **Region** | hembygd |
| **Engine** | `wp-rest` |
| **Update frequency** | `weekly` |

## Hur vi hittade den

- **Metod:** `probe-wp`
- **Probe-URL:** http://www.tjornshembygdsforening.se
- **Upptäckt:** 2026-06-11

## Engine-config

```ts
{
  "baseUrl": "http://www.tjornshembygdsforening.se",
  "variant": "wp-v2",
  "defaultCity": "Tjörns Hembygdsförening",
  "fetchDetailPage": true,
  "maxPages": 5,
  "endpoint": "/wp-json/wp/v2/tribe_events"
}
```

## Field-map (var fälten kommer ifrån i råsvaret)

_Ingen field-map definierad._

## Larmtrösklar & sample

- _expectedMinEvents inte satt._
- _Inget sample event-URL satt — vid nästa körning, hitta en känd-bra URL och pasta in._
- **Senast verifierad:** 2026-06-11

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
