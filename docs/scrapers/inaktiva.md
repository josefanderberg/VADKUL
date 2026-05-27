# Inaktiva: Eventbrite, Billetto, Nöjesguiden, today-sweden

Scrapers som är inkopplade i [index.ts](../../apps/scraper/src/index.ts) men gav 0 användbara events i senaste körningen.

| Källa | Events i DB | Status |
|---|---|---|
| Eventbrite | 0 | Tyst miss |
| Billetto | 0 | Tyst miss |
| Nöjesguiden (via today-sweden) | 0 | Tyst miss |
| Tickster-idag (via today-sweden) | 8 skräp | Felaktig matchning, sparar söklistor |

Källfiler: [eventbrite.ts](../../apps/scraper/src/scrapers/eventbrite.ts), [billetto.ts](../../apps/scraper/src/scrapers/billetto.ts), [today-sweden.ts](../../apps/scraper/src/scrapers/today-sweden.ts).

## Nu-läget

SQL: `SELECT COUNT(*) FROM link_events WHERE url LIKE '%eventbrite%'` → 0. Samma för billetto, ng.se.

Tickster-idag-skräpet: 8 rader med titel `"Tickster Event"` och URL som matchar mönstret `tickster.com/se/{sv,en,nb,da}/events/search?date_from=…`.

**Vi vet inte** ifall scraperna kraschade, fick `res.ok=false`, hittade noll selektorer som matchade, eller skippade allt pga filter. Loggen är inte sparad.

## Analys

Fyra olika *möjliga* orsaker per scraper — får inte slås ihop:

**Eventbrite** ([eventbrite.ts:75](../../apps/scraper/src/scrapers/eventbrite.ts:75)):
- Selektor: `a[href*="/e/"]` med filter `eventbrite.se`.
- *Hypotes A*: Eventbrite serverar nu Cloudflare-utmaning för icke-browser UA → tom HTML.
- *Hypotes B*: URL-struktur ändrad från `/d/sweden--{city}/events/` till något annat.
- *Hypotes C*: 21 städer × en fetch = 21 requests utan rate-limit-paus → blockerad.

**Billetto** ([billetto.ts:79](../../apps/scraper/src/scrapers/billetto.ts:79)):
- Selektor: `a[href]` filtrerad på `/(e|events)/[a-z0-9-]+/`.
- *Hypotes*: Billetto är SPA — länkarna renderas client-side, cheerio ser bara skelett-HTML.

**Nöjesguiden** ([today-sweden.ts:53](../../apps/scraper/src/scrapers/today-sweden.ts:53)):
- Selektor: `.event-list-item, .kalendarium-item`.
- *Hypotes*: klassnamnen ändrade. ng.se redesignar regelbundet.

**Tickster-idag** ([today-sweden.ts:88-93](../../apps/scraper/src/scrapers/today-sweden.ts:88)):
- Inte tyst — ger fel data.
- Buggen är konkret: `if (href.includes(todayStr))` matchar URL:n med `?date_from=2026-05-26`. Detta är *söklistans egen länk*, inte event-länkar.
- Detta är dubbel-arbete: huvudet [tickster.ts](../../apps/scraper/src/scrapers/tickster.ts) täcker idag redan idag-fönstret.

## Begränsningar

Den här rundan:

1. Ta bort eller stoppa **Tickster-idag** i today-sweden.ts. Den orsakar aktiv skada (8 skräpevents) och täcks redan av tickster.ts.
2. Lägg till **diagnostik-loggning** i Eventbrite/Billetto/Nöjesguiden: skriv ut `res.status`, antal selektor-träffar, antal events som föll bort på filter. Utan det kan vi inte avgöra vilken hypotes som stämmer.

Vi rör **inte**:
- Skriva om Eventbrite/Billetto-extraktionen. Vi vet inte ens om det är värt det förrän diagnostik visar var de tappar bort sig.
- Lägga till nya scrapers.

## Fortsättning

Öppna frågor:

- [ ] Är någon av Eventbrite/Billetto/NG värd ansträngningen? FB + Tickster + lokala täcker mycket redan.
- [ ] Hur ska vi mäta "scrape-hälsa" framöver? Krash-counter? Per-källa-rad i `keyword_stats.json`?
- [ ] Ska tysta scrapers larma i CI när de ger 0 events två körningar i rad?

Nästa beslut: kör en *en-fil*-test (`npx ts-node` på respektive scrapen) i isolation, fånga raw HTML, jämför mot selektorer. Bekräfta vilken hypotes som stämmer innan vi tar bort eller skriver om.
