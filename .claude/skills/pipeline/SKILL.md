---
name: pipeline
description: Arbeta med VADKUL:s event-pipeline — skrapning, Firestore-skrivningar, SQLite-spegeln, aggregate och nattjobbet på Mac minin. Använd ALLTID denna skill vid ändringar i apps/scraper, vid skrivningar mot linkEvents, när aggregat/dammsugning/sync nämns, när event saknas eller har fel datum/bild, eller när nattjobbet inte verkar ha körts.
---

# Event-pipelinen

## Järnregler

1. **`url` är primärnyckel i HELA pipelinen.** Länklösa event MÅSTE ligga på userCreated-live-spåret — annars kolliderar de på tomma nyckeln och fäller descriptions-uppladdningen.
2. **ALLA skrivningar mot `linkEvents` går via `stamped()`** i `apps/scraper/src/utils/firestoreStamp.ts`. Den sätter `updatedAt`-cursorn som den inkrementella syncen bygger på — en oststämplad skrivning blir osynlig för syncen och spegeln driftar.
3. **Läsningar går via SQLite-spegeln först** (dbHelper) — det är kostnadsfixen som håller Firestore-reads nere. Läs inte direkt mot Firestore i skript utan skäl.

## Ordningen som alltid gäller

`aggregate` läser **lokala SQLite**, inte Firestore. Kör därför alltid:

```bash
cd apps/scraper && npm run sync-to-sqlite && npm run aggregate
```

Hoppar man över syncen aggregerar man gammal data och undrar var de nya eventen tog vägen.

## Kända fällor i skrapad data

- **Omslagsbilder är delvis skräp**: `data:`-platshållare och rotrelativa `/images`-sökvägar förekommer i källdata (fällde Search Consoles "Ogiltig webbadress i fältet image"). Filtrera vid inläsning, lita aldrig blint på `image`.
- **Datumkapning**: `cheerioFallback` tar första `startDate` globalt på sidan — på källor med flera event per sida (Kulturbolaget-buggen) blir alla event feldaterade. Var misstänksam mot listsidor.

## Nattjobbet på Mac minin

- Kedjan är schemalagd 00:30 via launchd, men `StartCalendarInterval` väcker **inte** en sovande Mac — jobbet körs först vid uppvaknande. Fixen är en pmset-väckning 00:25 på minin.
- Saknas färsk data på morgonen: kolla först om minin sov, inte koden.
- Efter ändringar i scrapern: minin behöver `git pull` (och `npm install` vid nya beroenden) innan nästa körning — den kör sin egen kopia från `main`.
