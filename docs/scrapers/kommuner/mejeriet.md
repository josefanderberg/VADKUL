# Kulturmejeriet

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `mejeriet` |
| **Region** | lund |
| **Engine** | `slagthuset` |
| **Update frequency** | `every-3d` |

## Hur vi hittade den

- **Metod:** `manual`
- **Probe-URL:** https://cms.mejeriet.net/wp-json/wp/v2/program?per_page=3&acf_format=standard
- **Upptäckt:** 2026-07-10
- **Antal events vid upptäckt:** 99

> bulk-probe FAIL:ade (Next-frontend utan sitemap/JSON-LD) men bild-URL:erna i sid-HTML avslöjade cms.mejeriet.net — öppen wp/v2 med samma ACF-schema som Slagthuset.

## Engine-config

```ts
{
  "apiUrl": "https://cms.mejeriet.net/wp-json/wp/v2/program?per_page=100&acf_format=standard",
  "eventBaseUrl": "https://mejeriet.se/program",
  "defaultCity": "Lund"
}
```

## Field-map (var fälten kommer ifrån i råsvaret)

_Ingen field-map definierad._

## Larmtrösklar & sample

- _expectedMinEvents inte satt._
- _Inget sample event-URL satt — vid nästa körning, hitta en känd-bra URL och pasta in._
- **Senast verifierad:** 2026-07-10

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
