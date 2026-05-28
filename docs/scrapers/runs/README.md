# Körningar (runs)

En fil per datum då scrapern faktiskt körts. Syftet: spåra framsteg över tid mot kampanjer.

Filnamn: `YYYY-MM-DD.md`. ISO. Inga "förra veckan".

Max 60 rader. Om en körning har djupanalys — bryt ut till en kampanj.

## Mall

```
# 2026-MM-DD

## Snapshot

| | |
|---|---|
| Källa | dailyScraper i prod / lokal / annan dator |
| Nya event i Firebase | <antal> |
| Lokala saved-stats | <antal> (Teams) — diskrepans? |

## Vad nattens körning visade

3-5 punkter. Före/efter mot kampanjer.

## Aktiva kampanjer (delta)

- K<n> <titel>: vad gick framåt/bakåt sedan förra körningen.

## Nya observationer

Bara nya saker. Inte upprepningar. Hänvisa till kampanjer.

## Nästa beslut

En rad. Vad gör vi nu, idag?
```
