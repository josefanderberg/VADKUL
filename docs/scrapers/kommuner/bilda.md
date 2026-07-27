# Bilda

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `bilda` |
| **Region** | national |
| **Engine** | `bilda` |
| **Update frequency** | `every-3d` |

## Hur vi hittade den

- **Metod:** `probe-wp`
- **Probe-URL:** https://www.bilda.nu/wp-json/wp/v2/arr?arr-type=674&per_page=2
- **Upptäckt:** 2026-06-12

> CPT arr; arr-type=674 = Kulturprogram (publika kulturarrangemang, skiljer från studiecirklar 673 / annan folkbildning 672). meta["arr-meta-data"] = JSON-sträng med HELA interna Gustav-posten: starttid (klockslag), lokaladress+postnr+ort, avgift.

## Engine-config

```ts
{}
```

## Field-map (var fälten kommer ifrån i råsvaret)

| Fält | Källa |
|---|---|
| `title` | arr-meta-data.webbrubrik |
| `startDate` | arr-meta-data.starttid (ISO m. klockslag, lokal tid) |
| `venueName` | arr-meta-data.lokal |
| `address` | arr-meta-data.lokaladress (+postnr+ort — EXAKT) |
| `city` | arr-meta-data.lokalort (VERSALER → titleCase) |
| `koordinater` | longitud/latitud i posten är AVRUNDADE/0 — använd ALDRIG, geokoda adressen |

## Larmtrösklar & sample

- **expectedMinEvents:** 30 (under detta = potentiellt trasig källa)
- _Inget sample event-URL satt — vid nästa körning, hitta en känd-bra URL och pasta in._
- **Senast verifierad:** 2026-06-12

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
