# Scraper-analys

Mappen håller analyser per scrapingkälla. En fil per källa (eller en gemensam för små/liknande). Syftet: spåra vad vi vet, vad vi inte vet, och vad vi väljer att göra — utan att rusa till en slutsats.

## Filer

- [facebook.md](facebook.md) — egen, störst (1073/1200)
- [tickster.md](tickster.md) — egen, näst störst (79)
- [övriga.md](övriga.md) — Meetup, VäxjöCo, Upplev (små men fungerar)
- [inaktiva.md](inaktiva.md) — Eventbrite, Billetto, Nöjesguiden, today-sweden (0 events)

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
