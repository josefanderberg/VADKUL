# PRO

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `pro` |
| **Region** | national |
| **Engine** | `pro` |
| **Update frequency** | `daily` |

## Hur vi hittade den

- **Metod:** `manual`
- **Probe-URL:** https://pro.se/appresource/4.<pageId>/12.4d4eef20190100e8b7a784c7/activities
- **Upptäckt:** 2026-06-11

> SiteVision WebApp-portlet (id konstant över alla föreningar — delad mall). JSESSIONID från valfri sida räcker; pageId per förening ur HTML (pageId: '4.<hex>').

## Engine-config

```ts
{}
```

## Field-map (var fälten kommer ifrån i råsvaret)

_Ingen field-map definierad._

## Larmtrösklar & sample

- **expectedMinEvents:** 200 (under detta = potentiellt trasig källa)
- _Inget sample event-URL satt — vid nästa körning, hitta en känd-bra URL och pasta in._
- **Senast verifierad:** 2026-06-11

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
