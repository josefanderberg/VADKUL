# Röda Korset

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `roda-korset` |
| **Region** | national |
| **Engine** | `rodakorset` |
| **Update frequency** | `daily` |

## Hur vi hittade den

- **Metod:** `manual`
- **Probe-URL:** https://www.rodakorset.se/api/episerver/v3.0/content?contentUrl=<url>
- **Upptäckt:** 2026-06-11

> EPiServer/Optimizely Content API, öppen. Sitemap → /kalendarium/-URL:er → resolva var och en.

## Engine-config

```ts
{}
```

## Field-map (var fälten kommer ifrån i råsvaret)

_Ingen field-map definierad._

## Larmtrösklar & sample

- **expectedMinEvents:** 30 (under detta = potentiellt trasig källa)
- _Inget sample event-URL satt — vid nästa körning, hitta en känd-bra URL och pasta in._
- **Senast verifierad:** 2026-06-11

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
