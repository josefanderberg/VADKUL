# Kulturbiljetter

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `kulturbiljetter` |
| **Region** | national |
| **Engine** | `sitemap` |
| **Update frequency** | `every-3d` |

## Hur vi hittade den

- **Metod:** `probe-sitemap`
- **Probe-URL:** https://kulturbiljetter.se/sitemap.xml
- **Upptäckt:** 2026-07-02

## Engine-config

```ts
{
  "sitemapUrl": "https://kulturbiljetter.se/sitemap.xml",
  "urlPatterns": [
    {}
  ],
  "maxUrls": 250,
  "placeUrlReplace": [
    {},
    "/evenemang/map/"
  ]
}
```

## Field-map (var fälten kommer ifrån i råsvaret)

_Ingen field-map definierad._

## Larmtrösklar & sample

- _expectedMinEvents inte satt._
- _Inget sample event-URL satt — vid nästa körning, hitta en känd-bra URL och pasta in._
- **Senast verifierad:** 2026-07-02

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
