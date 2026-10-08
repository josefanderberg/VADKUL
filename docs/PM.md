# VADKUL – Produktplan

> Kort översikt. Den levande färdplanen (läget, nästa steg, löpande rutiner) är
> Claude-dokumentet [Vadkul – roadmap och nästa steg](https://claude.ai/code/artifact/e10eaead-e076-44cd-9c71-0066e5769864).
> Alla arbetsdokument listas i [README.md](README.md).

## Vision

**Hitta spontana events nära dig – i realtid.** En karta över allt som händer i Sverige,
på webben (vadkul.se) och i appen.

## Delarna

| Del | Var | Läs först |
|---|---|---|
| Webben (karta, stadssidor, arrangörssidor) | `apps/web` | `.claude/skills/kart-ui/` |
| Pipelinen (skrapning → Firestore → SQLite → aggregat) | `apps/scraper` | [scrapers/STATUS.md](scrapers/STATUS.md), `.claude/skills/pipeline/` |
| Cloud Functions och /v1-API:t | `apps/functions` | [app-plattform-plan.md](app-plattform-plan.md) |
| Kontraktet (`@vadkul/kontrakt` på npm) | `packages/kontrakt` | `../CLAUDE.md` |
| Appen (Expo, MapLibre) | repot `vadkul-app` | [app-plattform-plan.md](app-plattform-plan.md) |
| Marknadsföring och arrangörsmejl | repot `vadkulyt` (studion) | [outreach/README.md](outreach/README.md) |

## Kommandon

```sh
npm run dev       # dev-servern (kolla lsof -i :3000 först) + nattens larmlista
npm run alerts    # nattens samlade skraplarm
```

## Att verifiera

- [ ] På mobil i prod: eventkortet ska gå att dra/scrolla även när fingret börjar på en
      knapp (Anmäl/chatten/listan) — fixat 31/8 (`fe1f0c3`, pointer-capture på knappen
      själv + klick-svalning efter drag). Rena klick och chattfältets textmarkering ska
      funka som vanligt. **Ta bort raden så fort det är bekräftat.**
- [ ] Vänflödet och privata chatten i webbläsaren, se [socialt-lager.md](socialt-lager.md).
