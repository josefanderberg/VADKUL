# Visit Lund

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `visitlund` |
| **Region** | lund |
| **Engine** | `cruncho` |
| **Update frequency** | `every-3d` |

## Hur vi hittade den

- **Metod:** `manual`
- **Probe-URL:** https://visitlund.se/evenemangskalender?offset=400
- **Upptäckt:** 2026-07-09
- **Antal events vid upptäckt:** 297

> AppRegistry.registerInitialState-blob i sid-HTML; direkta api.cruncho.co-gissningar gav 404 — sidvägen är enda öppna dörren.

## Engine-config

```ts
{
  "pageUrl": "https://visitlund.se/evenemangskalender",
  "defaultCity": "Lund"
}
```

## Field-map (var fälten kommer ifrån i råsvaret)

_Ingen field-map definierad._

## Larmtrösklar & sample

- _expectedMinEvents inte satt._
- _Inget sample event-URL satt — vid nästa körning, hitta en känd-bra URL och pasta in._
- **Senast verifierad:** 2026-07-09

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
