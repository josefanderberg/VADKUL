# Visit Umeå

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `visitumea` |
| **Region** | umea |
| **Engine** | `cbis` |
| **Update frequency** | `every-3d` |

## Hur vi hittade den

- **Metod:** `probe-xhr`
- **Probe-URL:** https://visitumea.se/sv/api/cbis-product-list?nodeId=1262&page=0
- **Upptäckt:** 2026-07-02

## Engine-config

```ts
{
  "baseUrl": "https://visitumea.se",
  "nodeId": 1262,
  "defaultCity": "Umeå"
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
