# Astrid Lindgrens Värld

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `astrid-lindgrens-varld` |
| **Region** | kalmar |
| **Engine** | `sitemap` |
| **Update frequency** | `every-3d` |

## Hur vi hittade den

- **Metod:** `probe-sitemap`
- **Probe-URL:** https://astridlindgrensvarld.se/sitemap_index.xml
- **Upptäckt:** 2026-06-23

## Engine-config

```ts
{
  "sitemapUrl": "https://astridlindgrensvarld.se/sitemap_index.xml",
  "urlPatterns": [
    {}
  ],
  "defaultCity": "Vimmerby"
}
```

## Field-map (var fälten kommer ifrån i råsvaret)

_Ingen field-map definierad._

## Larmtrösklar & sample

- _expectedMinEvents inte satt._
- **Sample event-URL:** https://astridlindgrensvarld.se/teatern/forestallning/min-bror-jonatan-lejonhjarta/
- **Senast verifierad:** 2026-06-23

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
