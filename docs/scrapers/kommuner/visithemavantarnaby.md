# Visit Hemavan Tärnaby

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `visithemavantarnaby` |
| **Region** | storuman |
| **Engine** | `sitemap` |
| **Update frequency** | `every-3d` |

## Hur vi hittade den

- **Metod:** `probe-sitemap`
- **Probe-URL:** https://visithemavantarnaby.se/sv/evenemang
- **Upptäckt:** 2026-07-03

## Engine-config

```ts
{
  "sitemapUrl": "https://visithemavantarnaby.se/sv/evenemang",
  "isHtmlCatalog": true,
  "urlPatterns": [
    {}
  ],
  "urlBlacklist": [
    {}
  ],
  "defaultCity": "Hemavan",
  "maxUrls": 40
}
```

## Field-map (var fälten kommer ifrån i råsvaret)

_Ingen field-map definierad._

## Larmtrösklar & sample

- _expectedMinEvents inte satt._
- _Inget sample event-URL satt — vid nästa körning, hitta en känd-bra URL och pasta in._
- **Senast verifierad:** 2026-07-03

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
