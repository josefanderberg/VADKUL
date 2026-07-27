# Visit Eskilstuna

> Auto-genererad från `src/sources/registry.ts` + `src/sources/data/provenance.ts`.
> Re-generera med `npx ts-node src/scripts/gen-source-playbooks.ts`.

| | |
|---|---|
| **ID** | `visiteskilstuna` |
| **Region** | eskilstuna |
| **Engine** | `sitevision` |
| **Update frequency** | `daily` |

## Hur vi hittade den

- **Metod:** `probe-xhr`
- **Probe-URL:** https://visiteskilstuna.se/rest-api/Evenemang/events?count=0&filters=%7B%7D&page=1&query=&timestamp=1785173759100
- **Upptäckt:** 2026-07-27
- **Antal events vid upptäckt:** 481

> Sök-sidans XHR. timestamp-param krävs (annars server-JSONException). info.start "00:00" = heldagsevent.

## Engine-config

```ts
{
  "urls": [
    "https://visiteskilstuna.se/evenemangsguiden/evenemangsguiden/sok-evenemang"
  ],
  "defaultCity": "Eskilstuna",
  "guideApi": {
    "basePath": "/rest-api/Evenemang"
  }
}
```

## Field-map (var fälten kommer ifrån i råsvaret)

_Ingen field-map definierad._

## Larmtrösklar & sample

- _expectedMinEvents inte satt._
- _Inget sample event-URL satt — vid nästa körning, hitta en känd-bra URL och pasta in._
- **Senast verifierad:** 2026-07-27

## Troubleshooting

_Inga kända fallgropar dokumenterade._

## Manuell debug-historik

_Lägg dina manuella anteckningar här — bevaras mellan körningar._
