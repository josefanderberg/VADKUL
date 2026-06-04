# Visit Östersund

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `ostersund` |
| **Region** | ostersund |
| **Engine** | `wp-rest` |
| **Update frequency** | `every-3d` |

## Hur vi hittade den

- **Metod:** `probe-wp`
- **Probe-URL:** https://www.visitostersund.se/wp-json/wp/v2/evenemang
- **Upptäckt:** 2026-06-01
- **Antal events vid upptäckt:** 226
- **Kör om probet:** `npm run probe-wp -- --only=ostersund`

> Probe 2026-06: 226 events. Svensk CPT + content-parser.

## Engine-config

```ts
{
  "baseUrl": "https://www.visitostersund.se",
  "variant": "wp-v2",
  "endpoint": "/wp-json/wp/v2/evenemang",
  "defaultCity": "Östersund"
}
```

## Field-map (var fälten kommer ifrån i råsvaret)

| Fält | Källa |
|---|---|
| `title` | item.title.rendered |
| `startDate` | parsad ur item.content.rendered (svensk datumtext) eller item.acf.start_date |
| `endDate` | parsad ur item.content.rendered eller item.acf.end_date |
| `url` | item.link |
| `venueName` | parsad ur content.rendered, ex. "Plats: X" eller "på X" |
| `address` | parsad ur content.rendered (gatunamn + nr + postnr + stad) |
| `city` | config.defaultCity om inget hittas i content.rendered |
| `description` | item.excerpt.rendered (HTML→text) eller item.content.rendered |
| `imageUrl` | item._embedded["wp:featuredmedia"][0].source_url |
| `organizer` | config.hostName (sajten själv) |
| `categories` | item._embedded["wp:term"][0][].name |
| `slug` | item.slug |

## Larmtrösklar & sample

- **expectedMinEvents:** 113 (under detta = potentiellt trasig källa)
- _Inget sample event-URL satt — vid nästa körning, hitta en känd-bra URL och pasta in._

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
