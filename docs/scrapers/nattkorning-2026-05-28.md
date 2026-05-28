# Nattköning 2026-05-28 — Hypoteser & Förberedelser

> **Körning startar:** kl 01:00 (launchd `se.vadkul.scraper.full`)
> **Loggfil:** `~/Library/Logs/vadkul-scraper/full.log`
> **Följ i realtid:** `tail -f ~/Library/Logs/vadkul-scraper/full.log`
> **Facebook klar:** söker efter `⏱️ Facebook-skrapan tog:` i loggen

---

## Vad som gjorts sedan igår

### Kodändringar inför denna körning

| Fil | Ändring |
|-----|---------|
| `facebook/index.ts` | **+300 queries**: 110 städer + 40 sökord × 2 datumfilter (igår: ~40 queries) |
| `facebook/index.ts` | **Stads-kontext i kön**: varje URL i kön bär med sig vilken stad den hittades i → skickas till Nominatim |
| `facebook/location.ts` | **Chrome-läckage-fix**: body-wide adress-scanning borttagen, enbart isolerad pin-rad används |
| `utils/venueCoordinates.ts` | **isForeignAddress-filter**: hoppar över geokodning om adress pekar utomlands (USA, NZ, UK etc.) |
| `facebook/index.ts` | **Tidmätning**: `⏱️ Facebook-skrapan tog: X min Y sek` loggas i finally-blocket |
| `scripts/run-daily.sh` | **Teams-notis fungerar**: bash-krasch-fix (PYEOF-bugg) + duration formateras snyggt |
| `launchd plist` | **Schemalagd**: full-körning kl 01:00 (tidigare: 02:00) |

---

## Hypoteser för natten

### H1 — Antalet event ökar kraftigt (Hög tro)
**Förra natten:** ~1 073 FB-event (89% av totalen) med ~40 queries
**Prognos ikväll:** 300 queries → förväntad ökning med **3–5×** om varje stad ger 5–15 unika event

*Falsifieras om:* antalet sparade nya event < 500. Kan bero på att FB rate-limitar aggressivt mot headless.

---

### H2 — Chrome-läckaget är borta (Mycket hög tro)
De 61 event med `extractedAddress = "Universitetsplatsen 1, 35252 Växjö"` ska inte uppstå igen.

*Fix:* body-wide adress-scanning är borttagen i `location.ts`.
*Verifieras:* DB:n raderas och byggs om från grunden inatt → inga gamla läckor kan gömma sig.

*Falsifieras om:* SQL `SELECT COUNT(*) FROM link_events WHERE extracted_address LIKE '%Universitetsplatsen%'` returnerar > 0 imorgon.

---

### H3 — Koordinater förbättras för venues med stadsnamnslös adress (Medelhög tro)
Förra snapshottet: **275 event (26%) med lat=0, lng=0** — dvs 1 av 4 event utan position på kartan.

*Fix:* kön bär med sig discovery-staden och skickar den som kontext till Nominatim: `"Paddys Restaurang, Växjö"` istället för bara `"Paddys Restaurang"`.

*Förväntning:* andelen `lat=0` ska sjunka till < 15%.
*Falsifieras om:* andelen `lat=0` inte sjunker > 5 procentenheter.

---

### H4 — Utländska event koordinateras inte fel längre (Hög tro)
22 event med adresser i USA/NZ/Australien/UK fick tidigare svenska koordinater via Nominatim partial-match.

*Fix:* `isForeignAddress()`-check i `venueCoordinates.ts` hoppar helt över geokodning om address-texten matchar utländska indikatorer.

*Verifieras:* inga event med `lat > 69 || lat < 55` kombinerat med FB-URL imorgon.

---

### H5 — Teams-notisen levereras (Hög tro)
Igår: webhook-POST kraschade tyst pga PYEOF-bug i bash → ingen notis.

*Fix:* PYEOF-buggen rensad, duration formateras som "X min Y sek".

*Verifieras:* Teams-meddelande med status, duration och FB-stats dyker upp i kanalen.

---

## Kommunikationssystemet (för mig — AI)

När körningen är klar hittar jag resultaten här:

```bash
# 1. Loggfil (allt stdout från körningen)
~/Library/Logs/vadkul-scraper/full.log

# 2. Facebook-duration (söker i loggen)
grep "Facebook-skrapan tog" ~/Library/Logs/vadkul-scraper/full.log

# 3. Keyword-statistik (JSON — vilka sökord gav mest)
apps/scraper/keyword_stats.json

# 4. Scraped events (alla skrapade event, råformat)
apps/scraped_events.json

# 5. SQLite — faktisk DB-analys
sqlite3 apps/scraper/events.db "SELECT COUNT(*) FROM link_events WHERE url LIKE '%facebook%'"
sqlite3 apps/scraper/events.db "SELECT COUNT(*) FROM link_events WHERE lat=0 AND lng=0"
sqlite3 apps/scraper/events.db "SELECT COUNT(*) FROM link_events WHERE extracted_address LIKE '%Universitetsplatsen%'"
```

Teams-notisen innehåller:
- ✅/❌ status
- Körningtid (totalt + `⏱️ Facebook-skrapan tog`)
- Antal sparade / skippade / fel
- Top sökord
- Firebase-statistik

---

## Checklista imorgon bitti

- [ ] Teams-notis levererad?
- [ ] `⏱️ Facebook-skrapan tog: X min Y sek` — notera tid
- [ ] Antal nya event sparade (H1)
- [ ] `SELECT COUNT(*) FROM link_events WHERE extracted_address LIKE '%Universitetsplatsen%'` = 0? (H2)
- [ ] `SELECT COUNT(*) FROM link_events WHERE lat=0 AND lng=0` < 15%? (H3)
- [ ] Inga event med utländsk adress + svenska koordinater? (H4)
- [ ] Uppdatera `loggbok.txt` med resultat
- [ ] Uppdatera `facebook.md` med ny snapshot

---

*Skriven: 2026-05-27 23:51 — av AI tillsammans med Josef*

---

## Utfall (faktiska resultat)

> Körning avslutades: 2026-05-28 03:08:42 · duration 7716s

| Hypotes | Utfall | Resultat |
|---|---|---|
| H1: Antalet event ökar kraftigt | 1214 unika URLs, 252 sparade | ⚠️ Delvis — 7.65× fler queries, bara +13% fler unika. FB overlap stor. |
| H2: Chrome-läckaget borta | 0 NYA Universitetsplatsen-event | ✅ Fix verifierad. 61 gamla (pre-28/5) kvar i DB. |
| H3: lat=0 sjunker till <15% | 347/1325 = 26% | ❌ Oförändrat — city-context hjälper, retry-strategi ej implementerad. |
| H4: Utländska event borta | 4 event kvar (ner från 22) | ✅ Nästan klar — 4 danska/norska slipper igenom. |
| H5: Teams-notis levereras | HTTP 202 | ✅ Levererad. |

**Nytt fynd utanför hypoteserna:** `category='other'` = **100%** av alla FB-event — klassificeringsfunktionen körs inte.

Fullständigt körningsprotokoll: [runs/2026-05-28.md](runs/2026-05-28.md)
