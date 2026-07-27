# Gotska Sandöns Hembygdsförening

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `gotska-sandons-hembygdsforening` |
| **Region** | hembygd |
| **Engine** | `sitemap` |
| **Update frequency** | `weekly` |

## Hur vi hittade den

- **Metod:** `probe-sitemap`
- **Probe-URL:** https://www.gsh.nu/wp-sitemap-posts-post-1.xml
- **Upptäckt:** 2026-06-11

## Engine-config

```ts
{
  "sitemapUrl": "https://www.gsh.nu/wp-sitemap-posts-post-1.xml",
  "urlPatterns": [
    {}
  ],
  "defaultCity": "Gotska Sandöns Hembygdsförening",
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
