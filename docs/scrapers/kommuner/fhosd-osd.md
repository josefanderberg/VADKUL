# OSD / Folkets Hus Östersund

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `fhosd-osd` |
| **Region** | ostersund |
| **Engine** | `sitemap` |
| **Update frequency** | `every-3d` |

## Hur vi hittade den

- **Metod:** `probe-sitemap`
- **Probe-URL:** https://www.fhosd.se/evenemang/oversikt
- **Upptäckt:** 2026-07-27
- **Antal events vid upptäckt:** 27

> osd.nu = placeholder; fhosd.se är den levande sajten.

## Engine-config

```ts
{
  "sitemapUrl": "https://www.fhosd.se/evenemang/oversikt",
  "isHtmlCatalog": true,
  "urlPatterns": [
    {}
  ],
  "defaultCity": "Östersund",
  "maxUrls": 100
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
