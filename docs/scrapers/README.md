# Scraper-analys

Mappen håller analyser per scrapingkälla samt löpande spårning av förbättringar. Syftet: spåra vad vi vet, vad vi inte vet, och vad vi väljer att göra — utan att rusa till en slutsats.

## Var börjar jag?

1. [STATUS.md](STATUS.md) — entry-point. Senaste körning, aktiva kampanjer, topp-3 problem. Läs först.
2. [processen.md](processen.md) — vad händer i en körning, steg för steg. Läs om du är ny.
3. [kampanjer/](kampanjer/) — vad vi jobbar med just nu. En kampanj = en sak.
4. [runs/](runs/) — kort daganteckning per körning. Spårar framsteg över tid.

## Per källa

- [facebook.md](facebook.md) — egen, störst (1073/1200)
- [tickster.md](tickster.md) — egen, näst störst (79)
- [övriga.md](övriga.md) — Meetup, VäxjöCo, Upplev (små men fungerar)
- [inaktiva.md](inaktiva.md) — Eventbrite, Billetto, Nöjesguiden, today-sweden (egna scrapers, 0 events)
- [kommuner/](kommuner/) — **auto-genererade playbooks** för alla registry-källor. En `.md` per kommun med discovery + field-map + troubleshooting. Re-generera: `npm run provenance`.

## Källa-status (registry)

Varje källa i [registry.ts](../../apps/scraper/src/sources/registry.ts) bär ett `status`-fält — vår **medvetna** klassning (skild från `health` som gissar ur körhistorik):

- 🟢 **active** — i rotation (default).
- 🧪 **experimental** — tillagd men underpresterar; utveckla vidare (fel mönster, behöver overlap-fönster, sommaruppehåll). Körs fortfarande, oftast `weekly`.
- ⚰️ **dead** — bevisat tom (stale sitemap, landningssidor). **Hoppas över av schemaläggare + runner** — så vi inte probar om den. Kräver `notes` (varför) + `lastVerified` (när).

**Så dokumenterar vi en upptäckt:** probe (`npm run probe-sitemap` / `probe-venues`) → snapshot i [probe-snapshots/](../../apps/scraper/src/sources/data/probe-snapshots/) → lägg i registry med `status` + `notes` + `lastVerified`.

**Inventarium & hälsa:**
- `npm run sources-list` — hela registret grupperat på status + senaste utfall. `-- --status=experimental` filtrerar.
- `npm run health` — STABLE/WATCH/BROKEN ur körhistorik.
- `npm run coverage` — kommun-täckning (vilka av 290 vi når).

## Skrivregler

Korta meningar. En fakta per rad. Punktlistor framför prosa.

Varje fil följer fyra sektioner — i ordning, alltid:

1. **Nu-läget** — bara observerad data. Siffror, citat ur DB, filrader. Inga gissningar.
2. **Analys** — hypoteser, **markerade som hypoteser**. Risker. Vad vi inte vet ännu.
3. **Begränsningar** — vad vi *väljer* att göra i den här rundan. Lika viktigt: vad vi inte rör.
4. **Fortsättning** — öppna frågor + nästa beslut. Aldrig avslutad förrän scrapen är borta.

## Försiktighet

- En hypotes är inte ett fynd. Skriv `Hypotes:` framför.
- Antal i `Nu-läget` ska gå att verifiera med en SQL-fråga som står i filen.
- Om vi ändrar slutsats — uppdatera, inte skriv om historiken. Lägg ny rad: `2026-MM-DD: omvärderat — <skäl>`.
- Lös inte tre buggar i en fil. En i taget.

## Hålla det kort

- Cap: 80 rader per fil. Går vi över — något ska brytas ut, inte sväljas.
- Inga inledningar (`I detta dokument ska vi…`). Hoppa till sak.
- Citat ur kod: max 3 rader. Annars länka filrad: `[file.ts:123](path)`.
- Förkortningar OK om de definieras i samma fil.

## Datumformat

ISO: `2026-05-27`. Inga "förra veckan".
