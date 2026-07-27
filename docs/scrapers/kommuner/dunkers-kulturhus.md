# Dunkers Kulturhus

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `dunkers-kulturhus` |
| **Region** | helsingborg |
| **Engine** | `wp-rest` |
| **Update frequency** | `every-3d` |

## Hur vi hittade den

- **Metod:** `probe-wp`
- **Probe-URL:** https://dunkerskulturhus.se/wp-json/wp/v2/event
- **Upptäckt:** 2026-06-24

## Engine-config

```ts
{
  "baseUrl": "https://dunkerskulturhus.se",
  "variant": "wp-v2",
  "defaultCity": "Helsingborg",
  "fetchDetailPage": true,
  "maxPages": 5
}
```

## Field-map (var fälten kommer ifrån i råsvaret)

_Ingen field-map definierad._

## Larmtrösklar & sample

- _expectedMinEvents inte satt._
- _Inget sample event-URL satt — vid nästa körning, hitta en känd-bra URL och pasta in._
- **Senast verifierad:** 2026-07-02

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
