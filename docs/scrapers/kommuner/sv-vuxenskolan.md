# Studieförbundet Vuxenskolan

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `sv-vuxenskolan` |
| **Region** | national |
| **Engine** | `sv-vuxenskolan` |
| **Update frequency** | `every-3d` |

## Hur vi hittade den

- **Metod:** `manual`
- **Probe-URL:** https://www.sv.se/kurser-och-evenemang?g_EventType=culture&sort_by=startdate&page=1
- **Upptäckt:** 2026-07-02
- **Antal events vid upptäckt:** 560

> Litium-plattform. JSON-API:t (/api/productFilter + litium-request-context-header ur window.__litium.requestContext) ger BARA facetter — produktkorten är enbart SSR-HTML. g_EventType=culture skiljer kulturarrangemang (~35 sidor á 16 kort) från kurskatalogen.

## Engine-config

```ts
{}
```

## Field-map (var fälten kommer ifrån i råsvaret)

| Fält | Källa |
|---|---|
| `title` | article.event-list__event-item .event-list__title |
| `startDate` | .event-list__date ("tis 2026-08-18") + .event-list__time ("19:00") |
| `city` | .event-list__location (BARA ort — ingen gatuadress i listan) |
| `imageUrl` | img.event-list__image[src] (relativ /storage/-URL) |

## Larmtrösklar & sample

- **expectedMinEvents:** 50 (under detta = potentiellt trasig källa)
- _Inget sample event-URL satt — vid nästa körning, hitta en känd-bra URL och pasta in._
- **Senast verifierad:** 2026-07-02

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
