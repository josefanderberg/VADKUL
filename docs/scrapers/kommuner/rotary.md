# Rotary

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `rotary` |
| **Region** | national |
| **Engine** | `rotary` |
| **Update frequency** | `daily` |

## Hur vi hittade den

- **Metod:** `manual`
- **Probe-URL:** https://rotary2325.se/<siteId>/Event/GetDistrictEvents
- **Upptäckt:** 2026-06-11

> ClubRunner per distrikt; siteId runtime-upptäcks från /events. US-datumformat "MMM d, yyyy" KRÄVS (ISO ger 0).

## Engine-config

```ts
{
  "districts": [
    "2325",
    "2335",
    "2355",
    "2365",
    "2395",
    "2405"
  ]
}
```

## Field-map (var fälten kommer ifrån i råsvaret)

_Ingen field-map definierad._

## Larmtrösklar & sample

- **expectedMinEvents:** 50 (under detta = potentiellt trasig källa)
- _Inget sample event-URL satt — vid nästa körning, hitta en känd-bra URL och pasta in._
- **Senast verifierad:** 2026-06-11

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
