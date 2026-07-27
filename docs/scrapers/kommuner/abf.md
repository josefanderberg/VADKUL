# ABF

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `abf` |
| **Region** | national |
| **Engine** | `abf` |
| **Update frequency** | `every-3d` |

## Hur vi hittade den

- **Metod:** `manual`
- **Probe-URL:** https://www.abf.se/kurs-sok/?type=event&page=1
- **Upptäckt:** 2026-06-12

> WordPress + HTMX — söksidan ÄR API:et (server-renderad HTML, EventCard-BEM-klasser). type=event skiljer Evenemang (736) från Kurser (1639). /wp-json/abf/v1/* är nonce-401.

## Engine-config

```ts
{}
```

## Field-map (var fälten kommer ifrån i råsvaret)

| Fält | Källa |
|---|---|
| `title` | .EventCard-title a |
| `startDate` | .EventCard-date time[datetime=YYYY-MM-DD] + .EventCard-time time[datetime=HH.MM] |
| `city` | .EventCard-location strong (BARA ort i listan; detaljsidan har gatuadress om det behövs senare) |
| `imageUrl` | .EventCard-image img[src] |

## Larmtrösklar & sample

- **expectedMinEvents:** 100 (under detta = potentiellt trasig källa)
- _Inget sample event-URL satt — vid nästa körning, hitta en känd-bra URL och pasta in._
- **Senast verifierad:** 2026-06-12

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
