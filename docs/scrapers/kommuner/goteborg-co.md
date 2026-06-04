# Göteborg & Co

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `goteborg-co` |
| **Region** | goteborg |
| **Engine** | `nuxt-data` |
| **Update frequency** | `daily` |

## Hur vi hittade den

- **Metod:** `probe-xhr`
- **Probe-URL:** https://www.goteborg.com/en/events
- **Upptäckt:** 2026-06-04
- **Kör om probet:** `npx ts-node src/scripts/probe-xhr.ts --only=goteborg`

> Nuxt 3 __NUXT_DATA__ (devalue-format) dereferensering.

## Engine-config

```ts
{
  "urls": [
    "https://www.goteborg.com/en/events"
  ],
  "defaultCity": "Göteborg"
}
```

## Field-map (var fälten kommer ifrån i råsvaret)

| Fält | Källa |
|---|---|
| `title` | window.__NUXT__.data.<...>.title |
| `startDate` | window.__NUXT__.data.<...>.startDate || .startsAt |
| `endDate` | window.__NUXT__.data.<...>.endDate || .endsAt |
| `url` | relativ slug joinat med config.urls[0] |
| `venueName` | window.__NUXT__.data.<...>.venue.name |
| `city` | window.__NUXT__.data.<...>.venue.city || config.defaultCity |
| `description` | window.__NUXT__.data.<...>.description || .body |
| `imageUrl` | window.__NUXT__.data.<...>.image || .heroImage |
| `engineHint` | Sök igenom __NUXT__ rekursivt efter array med event-liknande objekt |

## Larmtrösklar & sample

- _expectedMinEvents inte satt._
- _Inget sample event-URL satt — vid nästa körning, hitta en känd-bra URL och pasta in._

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
