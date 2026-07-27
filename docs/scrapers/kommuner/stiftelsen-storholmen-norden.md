# Stiftelsen Storholmen Norden

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `stiftelsen-storholmen-norden` |
| **Region** | hembygd |
| **Engine** | `sitemap` |
| **Update frequency** | `weekly` |

## Hur vi hittade den

- **Metod:** `probe-sitemap`
- **Probe-URL:** https://www.storholmen.org/post-sitemap.xml
- **Upptäckt:** 2026-06-11

## Engine-config

```ts
{
  "sitemapUrl": "https://www.storholmen.org/post-sitemap.xml",
  "urlPatterns": [
    {}
  ],
  "defaultCity": "Stiftelsen Storholmen Norden",
  "maxUrls": 200
}
```

## Field-map (var fälten kommer ifrån i råsvaret)

_Ingen field-map definierad._

## Larmtrösklar & sample

- _expectedMinEvents inte satt._
- _Inget sample event-URL satt — vid nästa körning, hitta en känd-bra URL och pasta in._
- **Senast verifierad:** 2026-06-11

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
