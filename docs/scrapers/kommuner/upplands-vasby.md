# Upplands Väsby Kommun

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `upplands-vasby` |
| **Region** | upplands-vasby |
| **Engine** | `sitemap` |
| **Update frequency** | `every-3d` |

## Hur vi hittade den

- **Metod:** `probe-sitemap`
- **Probe-URL:** https://upplandsvasby.se/sitemap.xml
- **Upptäckt:** 2026-06-04
- **Kör om probet:** `npm run probe-sitemap -- --filter=upplands-vasby`

> Probe-sitemap 2026-06-04: 244 event-URLs (evenemang-mönster).

## Engine-config

```ts
{
  "sitemapUrl": "https://upplandsvasby.se/sitemap.xml",
  "urlPatterns": [
    {}
  ],
  "defaultCity": "Upplands Väsby"
}
```

## Field-map (var fälten kommer ifrån i råsvaret)

| Fält | Källa |
|---|---|
| `title` | detalj-sidans <h1> eller JSON-LD Event.name |
| `startDate` | JSON-LD Event.startDate eller microdata itemprop="startDate" |
| `endDate` | JSON-LD Event.endDate |
| `url` | sitemap.xml <loc> |
| `venueName` | JSON-LD Event.location.name eller fritext-parsing |
| `address` | JSON-LD Event.location.address |
| `city` | JSON-LD Event.location.address.addressLocality eller config.defaultCity |
| `coords` | [Event.location.geo.latitude, Event.location.geo.longitude] |
| `description` | JSON-LD Event.description eller <meta name="description"> |
| `imageUrl` | JSON-LD Event.image eller <meta property="og:image"> |
| `organizer` | JSON-LD Event.organizer.name eller config.hostName |
| `engineHint` | Generisk sitemap-driven scraper — funkar oavsett CMS. |
| `urlPatterns` | config.urlPatterns = lista av regex som matchar event-URLs i sitemap |

## Larmtrösklar & sample

- _expectedMinEvents inte satt._
- _Inget sample event-URL satt — vid nästa körning, hitta en känd-bra URL och pasta in._
- **Senast verifierad:** 2026-06-04

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
