# Borås TME

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `boras-com` |
| **Region** | boras |
| **Engine** | `wp-graphql` |
| **Update frequency** | `daily` |

## Hur vi hittade den

- **Metod:** `probe-xhr`
- **Probe-URL:** https://cms.boras.com/graphql
- **Upptäckt:** 2026-07-27
- **Antal events vid upptäckt:** 246

> WPGraphQL med öppen introspection; acfEvents-fältgruppen bär eventDateFrom/eventTime/eventPlace/eventVisitingAddress.

## Engine-config

```ts
{
  "endpoint": "https://cms.boras.com/graphql",
  "eventBaseUrl": "https://www.boras.com",
  "defaultCity": "Borås"
}
```

## Field-map (var fälten kommer ifrån i råsvaret)

_Ingen field-map definierad._

## Larmtrösklar & sample

- _expectedMinEvents inte satt._
- _Inget sample event-URL satt — vid nästa körning, hitta en känd-bra URL och pasta in._
- **Senast verifierad:** 2026-07-27

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
