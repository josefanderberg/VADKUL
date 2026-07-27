# Friluftsfrämjandet

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `friluftsframjandet` |
| **Region** | national |
| **Engine** | `friluftsframjandet` |
| **Update frequency** | `daily` |

## Hur vi hittade den

- **Metod:** `manual`
- **Probe-URL:** https://www.friluftsframjandet.se/Search/AdventureSearch/Search
- **Upptäckt:** 2026-06-11

> JSON-POST bakom ASP.NET anti-forgery (token ur hidden input + cookies från söksidan). Endpoint hittad i /assets/build/index-bundlens fetch-anrop.

## Engine-config

```ts
{}
```

## Field-map (var fälten kommer ifrån i råsvaret)

_Ingen field-map definierad._

## Larmtrösklar & sample

- **expectedMinEvents:** 100 (under detta = potentiellt trasig källa)
- _Inget sample event-URL satt — vid nästa körning, hitta en känd-bra URL och pasta in._
- **Senast verifierad:** 2026-06-11

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
