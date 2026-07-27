# Svenska kyrkan

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `svenska-kyrkan` |
| **Region** | national |
| **Engine** | `svenskakyrkan` |
| **Update frequency** | `daily` |

## Hur vi hittade den

- **Metod:** `manual`
- **Probe-URL:** https://svk-apim-prod.azure-api.net/calendar/v1/event/search/
- **Upptäckt:** 2026-06-11

> Subscription-key hittad i /kalender-sidans XHR (Chromium-UA krävs mot svenskakyrkan.se).

## Engine-config

```ts
{}
```

## Field-map (var fälten kommer ifrån i råsvaret)

_Ingen field-map definierad._

## Larmtrösklar & sample

- **expectedMinEvents:** 500 (under detta = potentiellt trasig källa)
- _Inget sample event-URL satt — vid nästa körning, hitta en känd-bra URL och pasta in._
- **Senast verifierad:** 2026-06-11

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
