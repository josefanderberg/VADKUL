# Facebook

Källa: 1073/1200 events (89%). Scraper: [src/scrapers/facebook/](../../apps/scraper/src/scrapers/facebook/).

**Status 2026-09-28 (gäller före allt nedan):**
- Eventsöket (städer + sökord) är dött utloggat sedan juli 2026 → **avstängt som standard**, `FB_SEARCH=1` slår på det. Sökvakten finns kvar.
- FB-flödet bärs av **sidbevakning** (`watchlist*.ts`, ~640 sidors /events-flikar) och **seed-filen** `fb-seed-urls.json` (snöbollen, måndagar). ~730 nya event/natt 28/9.
- Körs **sist** i nattkedjan och bara EN gång (`today-sweden` körde förr hela FB en gång till).
- `rejectMemory.ts` + lokala `fb-reject-memory.json`: sid-/seed-event som avfärdats på datum (passerade, bortom 30 d, utan datum) laddas inte om varje natt — det var ~2 700 onödiga sidladdningar/natt.

**Status 2026-05-27:** chrome-läckage-fix applicerad — body-wide adress-scanning borttagen i [location.ts](../../apps/scraper/src/scrapers/facebook/location.ts). Singel-URL-test mot en tidigare läckande event: nu tom (✅). Regressionscheck mot verifierat event (Norrmalmstorg): adress kvar (✅). Hela DB:n behöver re-scrapas för att rensa de 61 gamla läckorna.

## Nu-läget

Snapshot: `events.db` 2026-05-28.

| Mått | Antal | % av FB |
|---|---|---|
| Totalt | 1325 | 100 |
| `lat=0, lng=0` | 347 | 26 |
| `locationName` saknas | 76 | 6 |
| `hostName` anonym | 636 | 48 |
| `isLocationVerified=1` | 978 | 74 |
| `isHostVerified=1` | 0 | 0 |
| `category='other'` | 1325 | **100** |
| Utländska koord | 4 | 0.3 |

Tre observerade *fel-mönster*:

1. **Chrome-läckage**: 61 events har `extractedAddress = "Universitetsplatsen 1, 35252 Växjö, Sweden"`. Titlarna är från Karlskrona, Motala, Hässleholm, Alingsås — alltså inte Växjö. Koord landar på LNU.
2. **Utländska events**: 22 events med adress i USA/NZ/Australien/UK. Får svenska koord via Nominatim partial match (t.ex. NZ-quiz → norsk kustpunkt, FL-show → svensk bbox).
3. **Anonym host**: 509 events har `hostName='Facebook'`. Inte fel i sig, men betyder att host-extractorn ofta misslyckas.

SQL: `SELECT lat, lng, COUNT(*) FROM link_events WHERE url LIKE '%facebook%' GROUP BY lat, lng HAVING COUNT(*) > 3`.

## Analys

**Chrome-läckage** (61):
- [location.ts:150](../../apps/scraper/src/scrapers/facebook/location.ts:150) scannar `document.body` när pin-raden saknas.
- *Hypotes*: noise (sidopanel/footer/related events) får högt address-score när själva eventet inte har en pin-rad.
- *Risk*: fix-broken-addresses.ts vet om det, men körs inte automatiskt — datan i DB är fortfarande trasig.

**Utländska events** (22):
- [venueCoordinates.ts:194](../../apps/scraper/src/utils/venueCoordinates.ts:194) accepterar hela Norden-bboxen.
- *Hypotes*: Nominatim partial-matchar ord ur en NZ/US-adress mot SE/NO/DK och returnerar fel träff.
- Alt-hypotes: en del events är legitima nordiska (Norge/Danmark ligger i bboxen avsiktligt). Behöver särskilja.

**Anonym host** (509):
- [extractor.ts:117-152](../../apps/scraper/src/scrapers/facebook/extractor.ts:117) försöker matcha "evenemang av"-trigger och fallbackar till första `/groups/`-länk.
- *Hypotes*: ej inloggad → FB döljer host-länken i många fall.
- Inte verifierat. Måste öppna en URL och titta.

**Koord=0** (275):
- [index.ts:421](../../apps/scraper/src/scrapers/facebook/index.ts:421) skippar geocoding om `extractedAddress` är tom.
- *Hypotes*: när bara venue-namn finns (t.ex. "Paddys Restaurang") matchar Nominatim inte utan stad.

## Begränsningar

Den här rundan tar vi *bara* chrome-läckaget vid källan. Skäl:
- Störst signal-till-brus: 61 events med deterministisk symptomtext.
- Existerande fix-skript bekräftar att problemet är förstått — vi flyttar fixen uppströms.

Vi rör **inte**:
- Nominatim-strategin (bredare scope, måste designas).
- Host-extractionen (kräver att vi förstår FB:s utloggade UI bättre).
- Filtrering av utländska events (separat fråga: behåll eller släng?).

## Fortsättning

Öppna frågor:

- [ ] Ska FB-scrapern slänga events utan svensk adress, eller behålla för att låta klienten filtrera?
- [ ] Kan vi vara inloggade utan att triggra FB:s rate-limit?
- [ ] Är de 9 ”exact_vaxjo_center"-events legitima (verifierade=ja) eller en dold default-väg?

Nästa beslut: läs igenom [location.ts:90-162](../../apps/scraper/src/scrapers/facebook/location.ts:90) tillsammans, identifiera den exakta raden som plockar upp chrome-adressen.
