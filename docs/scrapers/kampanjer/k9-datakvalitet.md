# K9 — Datakvalitet: kapade beskrivningar, å/ä/ö, pris ur text

Status: **KOD KLAR 2026-09-03** (branch `claude/event-data-quality`). Datan läks av nattkedjan + refresh-körningar.

## Nu-läget

Snapshot: `apps/web/public/events-cards.json` + `events-descriptions.json` 2026-09-03 (45 312 publicerade event).

| Mått | Antal | Var |
|---|---|---|
| Pris saknas | 36 654 (81 %) | alla källor |
| Pris står i beskrivningen men fältet är tomt | 901 | FB 222, PRO 177, SvK 60, Göteborg 32 |
| Beskrivning kapad vid exakt 500 tecken | 1 509 | Nortic 441, SvK 315, PRO 184, Hembygd 102, Rotary 98 |
| Kapad vid 600/617 (bibliotek, sitemap) / 800 (Göteborg) | ~600 | Axiell-bibliotek, sitemap-källor, goteborg.se |
| Slutar i "…" (WP-auto-excerpt) | 1 275 | Billetto 325, Visit Eskilstuna 183, Visit Norrköping 180 |
| Saknar å/ä/ö (mellanslagshål, buggen före 2026-07-09) | 159 | Rotary 78, Hembygd 44, Röda Korset 19, Nortic 18 |
| Ersättningstecken "�" i beskrivning | 25 | bara Facebook |
| Tickster-"beskrivning" = sidans meta-text ("… - Tickster.com") | 2 049 av 2 082 | Tickster |
| Placeholder-beskrivning ("ABF-evenemang i X.", genre-hint) | 355 + 795 | ABF, Ticketmaster |
| Titel "X Tickets" från biljett-återförsäljare (USA-arenor) | ~30 | FB: Laugh Seats 22, Ticket Deals 4 |

Verifiera: `node` över JSON-filerna, eller `sqlite3 events.db "SELECT LENGTH(description), COUNT(*) FROM link_events WHERE hidden=0 GROUP BY 1 ORDER BY 2 DESC LIMIT 5"`.

## Analys

- **500-taket** var `cleanDescription(raw, maxLen = 500)` + `.slice()` — mitt i ordet, ingen markering. Engines med egna `slice(0, 600)`: bibliotek, sitemap-backfill, sitevision, cbis, medborgarskolan; goteborgstad 800.
- **Kända URL:er hoppas över** i runnern ⇒ en beskrivning som en gång sparades kapad/strippad/med � blev kvar för alltid, även när motorn sedan länge levererar rätt text. Hypotes bekräftad: de 159 å/ä/ö-lösa ligger alla i API-källor som fixades 2026-07-09.
- **�-tecknen**: bara FB, bara 25 av 1 685, medan 8 FB-event har emoji intakta. *Hypotes:* äldre skrapväg/Chrome-version; roten är inte identifierad i koden. Defensiv fix: U+FFFD och ensamma surrogat strippas i `cleanDescription`, och trunkering klipper aldrig mitt i ett surrogatpar.
- **Pris**: Facebook har inget prisfält — texten är enda källan. SiteVision-kommunkalendrar har inget prisfält alls (verifierat av parallell-sessionen 2026-09-03, 25 domäner). Ticksters HTML bär "800 kr" som är deras serviceavgift — pris får ALDRIG regex-plockas ur Tickster-text.
- **"Okänd"** i FB-kort är `hostName || 'Okänd'`-fallbacken i `LinkEventCard`, inte priset — prischippen döljs helt när pris saknas (`normalizePriceLabel` → null).

## Begränsningar (den här rundan)

Gjort:
- `utils/text.ts`: `DEFAULT_DESCRIPTION_MAX = 1500`, `truncateAtBoundary` (mening → ord → "…"), U+FFFD/surrogat-strip. Alla `slice(0, 600/800)` i engines utbytta.
- `utils/priceFromText.ts`: konservativ prisextraktor (etikett/entré-fras/per person; spärrord för vinst, lott, medlems-/serviceavgift). Kopplad i `normalizeRawEvent` (alla engines) + FB-skrapan.
- `utils/contentRefresh.ts` + runnerns refresh-gren: kända event får ny beskrivning BARA när den bevisligen är bättre (längre fortsättning, återfunna å/ä/ö, utan �, platshållare → text); pris fylls bara på där det saknas.
- wp-rest: hela `content` när `excerpt` är WP:s auto-utdrag ("[…]"). Tickster: meta-text räknas som saknad → stycke-fallback; offers-array/lowPrice; "Entrébiljetter/Tickets"-titlar hoppas. FB: återförsäljar-junk (`facebook/junk.ts`), titelstäd, `normalizeDescription`. ABF: og:description för nya event (max 80/natt). Ticketmaster: `info/pleaseNote/description`.
- `scripts/backfill-content-quality.ts` (`npm run backfill-content -- --apply`) i nattkedjan som steg K9 före K4: pris ur text + �-städning på befintliga rader, rapport över kapade/strippade per domän.

Rörs inte:
- Firestore/SQLite på minin — datan läks av nattkedjan. Kapade/strippade texter kräver källan: `SCRAPE_FORCE_REFRESH=1 npm run sources -- --engine=svenskakyrkan` (och nortic, pro, hembygd, rotary, bibliotek) på minin.
- `registry.ts`, `json-ld.ts` (parallell-sessionen "Scraper för nya städer" äger dem).
- Nortic/hembygd/rotary-motorerna i sig — deras text är rätt sedan 2026-07-09; problemet var att den aldrig skrevs om.

## Fortsättning

- [ ] Efter första nattkörningen: läs K9-blocket i `nightly.log` — hur många priser ur text, hur ser exemplen ut? Falska positiva ⇒ skärp `GUARD_RE`.
- [ ] Kör `SCRAPE_FORCE_REFRESH=1 npm run sources -- --engine=svenskakyrkan` (dagtid, minin) och räkna om 500-kapade: ska gå från 315 mot 0.
- [ ] Tickster: verifiera stycke-fallbacken headless på 3 event (dokumentera i tickster.md) — ändringen är skriven blind (ingen nätåtkomst i molnsessionen).
- [ ] Hitta roten till �-emojin i FB-skrapan (jämför 25 drabbade mot 8 intakta: skrapdatum, Chrome-version, seed-fil vs sök).
- [ ] Pris-täckning efter K9: mät `price=''` per källa igen; överväg Ollama-prompt för FB-event utan textpris.
