# Medborgarskolan

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `medborgarskolan` |
| **Region** | national |
| **Engine** | `medborgarskolan` |
| **Update frequency** | `every-3d` |

## Hur vi hittade den

- **Metod:** `manual`
- **Probe-URL:** https://www.medborgarskolan.se/wt/api/v2/eventsearch/?type=10000,10090,10020,30150,10060,10030&sort=date&p=1
- **Upptäckt:** 2026-06-12

> Wagtail-API (samma plattform som Sensus men ANNAN route — eventsearch vs search). type-id:n filtrerar arrangemang ur 4676-kurskatalogen: 10000 Föreläsning, 10090 Konsert, 10020 Workshop, 30150 Prova på, 10060 Utställning, 10030 Föreställning → ~404.

## Engine-config

```ts
{}
```

## Field-map (var fälten kommer ifrån i råsvaret)

| Fält | Källa |
|---|---|
| `title` | list.items[].title |
| `startDate` | meta[type=start].text ("30 Sep 2025") + meta[type=time] ("10:00-15:00") |
| `city` | meta[type=location].text (BARA ort — ingen adress finns) |
| `imageUrl` | ld_entity.image.url |

## Larmtrösklar & sample

- **expectedMinEvents:** 50 (under detta = potentiellt trasig källa)
- _Inget sample event-URL satt — vid nästa körning, hitta en känd-bra URL och pasta in._
- **Senast verifierad:** 2026-06-12

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
