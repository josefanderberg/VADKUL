# Produktplan okt 2026 — så blir VADKUL bäst

_Arbetsdokument, skrivet 2026-10-06 utifrån `konkurrentgranskning-happymap.md`, SSD-planen
(`ssd-scraper-expansion.md`), plattformsplanen (`app-plattform-plan.md`), affiliate-/boost-underlaget
och ägarbesluten i `.claude/skills/kart-ui`. Inget här är byggt. Punkter märkta **[beslut]** är dina att ta._

## 0. Ställningstagande

happymap vinner på tre saker: ett **volymanspråk** (139 809 event / 1 156 orter), ett **socialt lager**
(vänner, "vänner kommer", inbjudningar, hangouts, planer, DM) och en **positionering** (ideell, noll
spårare, noll annonser). Vi vinner på **bästa kartan**, **kvalitet** (97 % verifierad plats, bilder, pris,
LLM-granskade kategorier), **SEO** (1 045 förrenderade sidor + 2 000 arrangörssidor) och
**arrangörsrelationer med intäktskrok** (boost, biljettlänkar).

Strategin i tre meningar:

1. **Kopiera inte deras sociala stack.** Bygg det *minsta* sociala lagret som gör kartan bättre att använda
   tillsammans: vänner + "jag kommer / vänner kommer" + bjud in till event. Det är ~20 % av deras byggjobb
   och fångar kärnan i "hitta någon att göra det med".
2. **Jaga inte 140k-siffran.** `city-gaps.ts`-insikten gäller: antalet ljuger, paraplykällor ger samma brus
   överallt. Mät **LOKALA arrangörer** per stad och "är söndagen tom?". Täpp utbyteshålen först.
3. **Möt positioneringshotet med transparens, inte med att bli ideella.** Gratis för användare, inga banners
   (redan ägarbeslut), intäkter = boost + märkta biljettlänkar — säg det öppet.

## 1. Färdplanen — fem spår, tre horisonter

| Horisont | Fokus | Tidsram |
|---|---|---|
| **A** | Täpp hålen: data, pris, billiga kortvinster | 2–4 veckor |
| **B** | Tillsammans: minsta sociala lagret | 1–2 månader |
| **C** | Plattform: arrangörs-CMS-bitar, API, app | kvartalet |

### Spår 1 — Data: utbyte före nya källor (horisont A)

Fakta från registerkollen 6/10 (449 källor):

| Källa | Status hos oss | Hos oss nu | Vad happymap visar |
|---|---|---|---|
| Nalen | `dead` | 6 som värd, 37 som plats (via Tickster/TM) | Holly Humberstone, Craig Finn, Woody, Bellvie BORIS … |
| Folkuniversitetet | `dead` | 22 | Kurser med startdatum |
| Debaser | `experimental` | 48 | Fler, med klockslag |
| Fotografiska | saknas | 0 | Fotokurser, visningar |
| Botkyrka Konsthall | saknas (vi har bara kommunen) | 0 | Workshops |
| Big Ben / Norra Brunn / Söder Stand up / Bacchi Syre | saknas | 0 | Stand-up, open mic, poesi |
| Glenn Miller Café, China Teatern | saknas | 0 | Jazz, föreläsningar |

- **A1. Återuppliva `nalen` och `folkuniversitetet`.** Kör `npm run alerts` + `npm run quality-coverage` på
  minin, läs varför de dog (sitemap-format? 403?), laga parsern. Nalen-konserter av turnéklass är det
  synligaste hålet i Stockholm.
- **A2. Debaser: lär text-tidsparsern "Dörrar HH.MM"** (redan noterat i registry-notes). Ger riktiga
  klockslag i stället för date-only, vilket också lyfter dem ur `NO_TIME_PAST_HOUR`-fällan.
- **A3. Stand-up-klustret + Fotografiska + Botkyrka Konsthall + Glenn Miller + China Teatern** som nya
  registerrader via `npm run scout` / `bulk-probe`. Stand-up-scenerna är små sajter men ger exakt den
  "vanlig onsdag"-täckning som avgör om kartan känns levande.
- **A4. Pris-täckning 20 % → 60 %.** `price` finns för 8 988 av 44 910 event. Audit-daemonen (Ollama)
  extraherar pris — kör en backfill över hela kommande fönstret, normalisera via `priceLabel.ts`
  (`FREE_PATTERNS` finns). Förutsättning för gratis-filtret (B1), annars ljuger det.
- **A5. Styr med `npm run city-gaps -- --sort=today`** på minin: maxa LOKALA i Stockholm, Göteborg, Malmö
  först, sedan Uppsala/Lund. Upprepa Stockholm-stickprovet (happymaps publika stadssida, JSON-LD, 100
  närmaste) om 4 veckor — **mål: saknade 46/100 → under 25/100.**
- **A6 [beslut]. Kurser.** SSD-planen klassar kurssajter som lågt ROI (`@type: Course`), men vi har redan
  4 821 event i `course`. Ska kurser med fast startdatum (Folkuniversitetet-typ) in? Rek: ja, bara
  startdatum-kurser, aldrig löpande.

### Spår 2 — Kartan & kortet: billiga vinster som säljer (horisont A)

Alla inom ramen för kart-ui-besluten: inget nytt på kartytan, filtret bor i sökpanelen, botten-dockan rörs inte.

- **B1. Gratis-filter.** Chip "Gratis" i `CategoryChipRow` (sökpanelen, en-åt-gången-logiken) + SEO-sida
  `/evenemang/[stad]/gratis` som tionde "kategori" i `categoryChips.ts`/`[kategori]`-routen med samma
  trösklar och sitemap-regler. Happymap har 971 gratis i Stockholm — vi har sannolikt fler när priset är
  ifyllt. *Beror på A4.* 1–2 dagar.
- **B2. Väder (SMHI).** SMHI:s öppna punktprognos (ingen nyckel, ingen Firestore-egress) per valt event
  inom 10 dygn: en rad "☀️ 14° · uppehåll" under tid/plats i kortet, cache i `sessionStorage`. 1–2 dagar.
- **B3. Platssidor `/plats/[stad]/[lokal]`.** Återanvänd arrangörssidans maskineri (`/arrangor/[slug]`,
  ISR 6 h, noindex < 20) men nycklat på `locationName` + geo-kluster, tröskel ≥ 5 event. Ger "Nalen
  program"/"Debaser kalender"-sökningarna, som happymap äger i dag. 3–4 dagar.
- **B4. "Lägg i kalender".** `utils/calendarLinks.ts` (.ics + Google) finns men är död kod — koppla in i
  kortets knapprad. En halv dag.
- **B5. Följ arrangör.** "Följ" på arrangörssidan och vid värdnamnet → push när arrangören får nytt event
  (samma FCM-väg som `eventReminders`). Vår motsvarighet till deras "följ serie". 3 dagar.

### Spår 3 — Tillsammans: det minsta sociala lagret (horisont B)

**Princip:** bygg det som gör ett event bättre att gå på *med någon* — inte en ny social app. Ingen
presence-GPS, inga hangouts, inga DM, inga röstplaner i v1.

**Grund som redan finns:** Firestore-regler för `users/{uid}/friends` (incoming/outgoing-modell), `chats`
(participants), `notifications` (recipientId), `presence`, `waitlist`; `attendees` på events; FCM-push;
eventchatt per event; ♥ med räknare. **Ingen klientkod** använder vänner/chats/presence — allt är rester.
Bygg som API-endpoints enligt plattformsplanen (`/v1/…`) + typer i `@vadkul/kontrakt`, så appen får det gratis.

- **B6. Vänner via länk.** Vänförfrågan genom delbar länk/QR (`/v/[kod]` → `?van=`), accept i profilpanelen.
  `users/{uid}/friends/{friendId}` `{status: incoming | outgoing | accepted}`; Cloud Function `acceptFriend`
  gör dubbelskrivningen atomisk. **Ingen personsökning i v1** (spam, integritet). ~1 vecka.
- **B7. "Jag kommer" på alla event + "Vänner kommer".** I dag: ♥ = sparat (påminnelse 1 h), anmälan bara
  för VADKUL-arrangerade. Lägg explicit "Jag kommer"-knapp i kortets knapprad → `eventRsvps/{eventId}/{uid}`
  + spegel i `users/{uid}/going`. Kortet visar "👥 2 vänner kommer" — **bara ömsesidiga vänner, aldrig
  publikt**, reglage i Inställningar ("Visa vänner vad jag ska på", standard på). Profilpanelens sparade-vy får
  "Vänner ska på". ~1 vecka.
- **B8. Bjud in en vän till ett event.** "Bjud in" i knappraden → välj vänner → push "Josef bjöd in dig till
  X fredag" → Ja/Kanske/Nej. `/e/[slug]?fran=<uid>` så utloggade mottagare landar rätt och får "Skapa konto för
  att svara". Ingen gruppchatt i v1 — eventchatten finns redan och duger som "er chatt". ~1 vecka.
- **B9. Integritet i samma veva.** `/integritet` är redan inaktuell (hjärtan, Min plats, stad på kontot) —
  skriv om den när vänner landar. All vänsynlighet ömsesidig och avstängbar.

**Varför inte mer:** presence (regeln finns från spelen) kostar Firestore-writes och är integritetskänslig;
hangouts/planer kräver notis-inkorg, rösträkning och moderering. Omprövas när B6–B8 visar aktivering —
**mål: 20 % av nya konton lägger till minst en vän inom 7 dagar.**

### Spår 4 — Arrangörer & intäkter (horisont B–C)

- **C1. QR-affisch + webbmärke.** Vi har redan bildgenerering (`api/marketing/ad/*`) och arrangörssidor:
  lägg `/arrangor/[slug]/affisch` (A4 med QR till arrangörssidan) + `vadkul-badge.svg` med "Se oss på
  VADKUL"-snutt. Rakt av deras affisch/märke, offline-värvning utan konto. 2–3 dagar.
- **C2. Deltagarlista-export (.csv) + väntelista** för "Jag arrangerar"-event (regeln `waitlist` finns). 2 dagar.
- **C3. Boost dag/månad.** Backend klar, bara Stripe-priserna saknas. En halv dag.
- **C4. "Det här är mitt event" (arrangörs-claim)** på skrapade event → konto kopplas till `hostName` →
  automatiskt mejl med klickstatistik (`eventStats`/`outreachStats` finns) + boost-erbjudande. Vår
  motsvarighet till deras organizer claims — med intäktskrok. ~1 vecka.
- **C5. Ansöknings-anmälan** (frågor, Ja/Kanske/Nej, reducerat pris) — **inte nu.** Bygg först när vi
  har > 50 VADKUL-arrangerade event/månad.

### Spår 5 — Positionering & förtroende (horisont A, mest beslut)

- **"Så funkar VADKUL"-sida:** gratis för användare, inga banners (ägarbeslut i `affiliate.md`), intäkter =
  boost + biljettlänkar märkta "Annons" (BOKA är redan märkt). Neutraliserar "noll annonser"-argumentet.
- **[beslut] Hotjar.** Session-replay är det som sticker ut i en spårar-skanner. Rek: ta bort, behåll
  Firebase Analytics.
- **Lyft kvalitetsmåtten de inte visar:** verifierad plats (97 %), bild, pris, kategori. "Nära dig i realtid"
  (visionen i `PM.md`) + kvalitet är vårt budskap.

## 2. Vad vi medvetet inte gör

- **Hangouts, presence, DM, röstplaner** — annan produkt, hög kostnad, moderering. Omprövas efter spår 3.
- **Jaga råa eventantal** — paraplybrus. LOKALA-andelen är måttet.
- **Native app före API:t** — plattformsplanen gäller; det sociala byggs som endpoints så appen ärver det.
- **Återinföra borttagna kartfunktioner** — kart-ui-listan står fast.
- **Smakprofil/rekommendationer** — se beslut 2 nedan.

## 3. Beslut som är dina

1. **♥ eller egen knapp?** Ska ♥ betyda "jag kommer", eller behåller vi ♥ = sparat och lägger "Jag kommer"
   som egen knapp? Rek: egen knapp (happymap skiljer också på sparat och kommer).
2. **Personalisering.** "Tips för dig"-sektionen är borttagen på ägarbeslut. Happymaps smakprofil är ett
   nytt beslut. Rek: vänta — "vänner kommer" är bättre personalisering än en smakprofil i vår storlek.
3. **Hotjar** kvar eller bort?
4. **Var bor "Vänner ska på"?** Listan under kortet har två låsta flikar (23/9). Rek: profilpanelen i v1.
5. **Kurser** med fast startdatum in eller inte (A6)?

## 4. Mätpunkter

| Område | Nu | Mål |
|---|---|---|
| Stockholm-stickprov, saknade av 100 | 46 | < 25 (4 v) |
| Event med pris | 20 % | 60 % |
| LOKALA-andel per storstad (`city-gaps`) | mät | upp, "tom söndag" borta |
| Nya konton med ≥ 1 vän inom 7 d | — | 20 % |
| Inbjudningar/vecka, RSVP per event | — | följ från dag 1 |
| Affischer genererade, claims, boost-konvertering | — | följ från dag 1 |

## 5. Ordning och grov uppskattning

| # | Vad | Spår | Storlek | Beror på |
|---|---|---|---|---|
| 1 | A1–A3 återuppliva + nya källor | 1 | 1–2 v (minin) | — |
| 2 | A4 pris-backfill | 1 | 2–3 d + daemon | — |
| 3 | B4 kalenderexport | 2 | 0,5 d | — |
| 4 | C3 boost dag/månad | 4 | 0,5 d | — |
| 5 | B2 väder | 2 | 1–2 d | — |
| 6 | B1 gratis-filter + SEO-sida | 2 | 1–2 d | A4 |
| 7 | C1 affisch + märke | 4 | 2–3 d | — |
| 8 | B3 platssidor | 2 | 3–4 d | — |
| 9 | Spår 5 sida + Hotjar-beslut | 5 | 1–2 d | beslut 3 |
| 10 | B6 vänner | 3 | 1 v | beslut 1, 4 |
| 11 | B7 kommer / vänner kommer | 3 | 1 v | B6 |
| 12 | B8 bjud in | 3 | 1 v | B6, B7 |
| 13 | B9 integritetspolicy | 3 | 1 d | B6–B8 |
| 14 | C4 arrangörs-claim | 4 | 1 v | — |
| 15 | C2 export + väntelista | 4 | 2 d | — |
| 16 | B5 följ arrangör | 2 | 3 d | — |

Steg 1–9 är horisont A och kan gå parallellt (minin tar 1–2, webben 3–9). Allt som rör ren logik får
tester i samma veva, och berörd apps tester + `tsc --noEmit` körs innan något rapporteras klart (CLAUDE.md).
