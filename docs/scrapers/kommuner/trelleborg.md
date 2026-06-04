# Trelleborgs Kommun

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `trelleborg` |
| **Region** | trelleborg |
| **Engine** | `wp-rest` |
| **Update frequency** | `every-3d` |

## Hur vi hittade den

- **Metod:** `probe-wp`
- **Probe-URL:** https://www.trelleborg.se/wp-json/wp/v2/event
- **Upptäckt:** 2026-06-01
- **Antal events vid upptäckt:** 33
- **Kör om probet:** `npm run probe-wp -- --only=trelleborg`

> Probe 2026-06: 33 events. wp/v2 + content-parser.

## Engine-config

```ts
{
  "baseUrl": "https://www.trelleborg.se",
  "variant": "wp-v2",
  "defaultCity": "Trelleborg"
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

- **expectedMinEvents:** 16 (under detta = potentiellt trasig källa)
- _Inget sample event-URL satt — vid nästa körning, hitta en känd-bra URL och pasta in._

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
