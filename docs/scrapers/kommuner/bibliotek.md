# Biblioteken

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `bibliotek` |
| **Region** | national |
| **Engine** | `bibliotek` |
| **Update frequency** | `every-3d` |

## Hur vi hittade den

- **Metod:** `manual`
- **Probe-URL:** https://api.axiell.com/event/api/customers/5de8fb519cf47722f2bb9871/search?queryString=*&size=2
- **Upptäckt:** 2026-06-12

> Axiell Arena Nova — ETT delat auth-fritt API för alla tenants (api.axiell.com/event/api). Kontraktet hittat i calendar-impl.service.js. API-roten är 401 men per-tenant-sök öppet. Nya tenants: hämta sajtens HTML → scopeGroupId via regex return"(\d{4,})" → GET <sajt>/api/jsonws/arenacalendar.calendar/get-calendar-config/group-id/<id> → customerId. Kandidatlista: axiell.com/se/bibliotek-med-arena-nova/ + bibliotek.<kommun>.se-mönstret.

## Engine-config

```ts
{}
```

## Field-map (var fälten kommer ifrån i råsvaret)

| Fält | Källa |
|---|---|
| `title` | hits[].event.title |
| `startDate` | event.startDate (ISO UTC) |
| `venueName` | event.location.value (FILIALEN — konsortier har 18–27 filialer per tenant) |
| `description` | event.description (HTML — strippas) |
| `imageUrl` | event.images[primaryImage].imageUrl |
| `status` | PUBLISHED filtreras i query |
| `audience` | event.targetAudiences[].value |

## Larmtrösklar & sample

- **expectedMinEvents:** 300 (under detta = potentiellt trasig källa)
- _Inget sample event-URL satt — vid nästa körning, hitta en känd-bra URL och pasta in._
- **Senast verifierad:** 2026-06-12

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
