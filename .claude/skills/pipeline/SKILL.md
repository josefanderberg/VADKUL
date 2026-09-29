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
- **Datumkapning**: `cheerioFallback` tar första `startDate` globalt på sidan — på källor med flera event per sida (Kulturbolaget-buggen) blir alla event feldaterade. Var misstänksam mot listsidor. Samma fälla med sajtvida datum: banners (Malmö Live: "3 oktober passerar Malmö Marathon") och "Andra event"-kort (Havremagasinet). Botemedlet är `detailDateSelector` på sidans eget datumfält.
- **Sajter byter URL-struktur tyst** (Visit Isabergsregionen, Spritmuseum 28/9): sitemapen har hundratals URL:er men `urlPatterns` matchar 0. Symptom: "N totalt → 0 matchande" i torrkörningen. Redirectar gamla adresser med samma slug → `canonicalUrl` i SitemapConfig så `url`-nyckeln består (inga dubbletter).
- **WAF/bot-spärrar på Mozilla-UA från node** (Waldemarsudde, KB 28/9): 403 eller JS-utmaning trots att curl fungerar → `userAgent: 'VadKul/1.0 (+https://vadkul.se)'`.
- **Plats bara i titeln/sidans fält** (regionsajter): `titlePlaces` (ort ur titel/venue) och `detailVenueSelector` i SitemapConfig — annars hamnar allt på `defaultCity`:s centroid.

## Verktyg för felsökning

- `npm run sources -- --ids=<id> --dry-run` — kör källan mot live-sajten utan att skriva något. Första steget vid varje "källan ger 0".
- `npm run alerts` — samlad larmlista (tysta källor, krascher, datumkluster, 0,0-event, invariant-larm, karantän) → `scraper-alerts.json`. Nattkedjan kör och pushar den; rotens `npm run dev` skriver ut den.
- Karantän (`quarantine.json`) släpps genom att ta bort källans post när den är fixad — annars står den pausad tills veckoretryn ser liv.
- `SCRAPE_FORCE_REFRESH=1` — tvinga refresh av kända URL:er (rättar tid/plats efter en motorfix). Rättar INTE event motorn slutat returnera; de kräver en riktad döljning (se `oneoff-hide-stale-dateclusters.ts`).

## Nattjobbet på Mac minin

- Kedjan är schemalagd 00:30 via launchd, men `StartCalendarInterval` väcker **inte** en sovande Mac — jobbet körs först vid uppvaknande. Fixen är en pmset-väckning 00:25 på minin.
- Saknas färsk data på morgonen: kolla först om minin sov, inte koden.
- Efter ändringar i scrapern: minin behöver `git pull` (och `npm install` vid nya beroenden) innan nästa körning — den kör sin egen kopia från `main`.
- Ordning sedan 28/9: bespoke + Sources → aggregat → **Facebook sist** → slutaggregat. FB körs EN gång (today-sweden kör inte FB), FB-söket är av (`FB_SEARCH=1` slår på), och `fb-reject-memory.json` håller avfärdade sid-/seed-event borta. Kedjan tog ~21 h innan.
- `run-daily.sh` exporterar `NODE_OPTIONS` med IPv4 först + längre anslutningsförsök — utan det ~200 "fetch failed"/natt mot Nominatim m.fl.
- Ändra inte `run-daily.sh` medan kedjan kör (bash läser skriptet löpande) — kolla `pgrep -fl run-daily`.

## App-flödet (plattformsplanen fas 1, 25/9)

`aggregate` bygger även APPENS per-region-flöde: `utils/appFeed.ts` delar upp
destinations per län (region = närmaste stadens län ur webbens CITIES, som
regex-läses ur `cityUtils.ts`), joinar bilder ur cards via eventKey och laddar
upp som blobbar (`app-<region>`) + metadatadok. 14-dagarshorisont — samma
fönster som kartan. Serveras BLOB-ONLY av `/api/events/app-<region>`; utan
blob svarar routen 503 och nästa nattaggregat läker. Ändras fälten MÅSTE
spegeln i `packages/kontrakt` (AppFeedEvent) följa med.
