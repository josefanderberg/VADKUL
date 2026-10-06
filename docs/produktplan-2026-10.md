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
4. **Ta betalt direkt av användarna — även i appen — och få ut appen fort.** (Styrning 6/10.) Biljetter,
   anmälningar och avgifter för verkliga event ska kunna betalas i VADKUL utan butiksavgift; boost och
   eventuellt medlemskap säljs både på webben och i appen. Appen lanseras som läs-app först (v1.0),
   konton/API följer som v1.1. Reglerna och vägen står i spår 4 och spår 6.

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

- **B1. Prisfilter: Gratis + maxbelopp.** Chip "Gratis" i `CategoryChipRow` (sökpanelen, en-åt-gången-
  logiken) och ett "Max 200 kr"-läge (happymaps filter har exakt de två), + SEO-sida
  `/evenemang/[stad]/gratis` som tionde "kategori" i `categoryChips.ts`/`[kategori]`-routen med samma
  trösklar och sitemap-regler. Visa **"Pris okänt"** öppet i kort och listor där vi i dag tiger — det gör
  "Gratis" trovärdigt. Happymap har 971 gratis i Stockholm — vi har sannolikt fler när priset är ifyllt.
  *Beror på A4.* 2 dagar.
- **B2. Väder (SMHI).** SMHI:s öppna punktprognos (ingen nyckel, ingen Firestore-egress). Steg 1: en rad
  "☀️ 14° · uppehåll" vid tiden i kortet för event inom 10 dygn + temperatur i stadsplattan (samma anrop),
  cache i `sessionStorage`. 1–2 dagar. Steg 2 (nice-to-have, happymap har det): temperatur per ort på
  kartan vid låg zoom och en prognossida (timme för timme + tio dygn). Kartlagret rör kartytan → kart-ui.
- **B3. Platssidor `/plats/[stad]/[lokal]`.** Återanvänd arrangörssidans maskineri (`/arrangor/[slug]`,
  ISR 6 h, noindex < 20) men nycklat på `locationName` + geo-kluster, tröskel ≥ 5 event. Ger "Nalen
  program"/"Debaser kalender"-sökningarna, som happymap äger i dag. 3–4 dagar.
- **B4. "Lägg i kalender".** `utils/calendarLinks.ts` (.ics + Google) finns men är död kod — koppla in i
  kortets knapprad. En halv dag.
- **B5. Följ arrangör.** "Följ" på arrangörssidan och vid värdnamnet → push när arrangören får nytt event
  (samma FCM-väg som `eventReminders`). Vår motsvarighet till deras "följ serie". 3 dagar.
- **B5b. Hitta hit + arrangörslänk i kortet.** "Hitta hit ↗" (Apple/Google Maps-länk från lat/lng) bredvid
  platsen, och värdnamnet som **länk till arrangörssidan** (med bild när `coverImage`/logga finns) — i dag
  är värdnamnet bara ett filter fast sidorna finns. En halv dag.
- **B5c. Chatten läsbar utloggad.** Läsning öppen för alla (skriva kräver konto som i dag, `EventCard.tsx:2923`),
  och de senaste raderna renderas i `/e/`-sidan. happymap visar kommentarer publikt. En dag inkl. regler.
- **B5d. Förtroendestämpel i kortet.** "Från <källdomän> · kontrollerad <datum>" i härkomstraden — nattkedjan
  kontrollerar varje källa, så aggregatets `updatedAt` (eller ett `ls`-fält per event) räcker. En halv dag.
- **B5e. "Mer på <lokal>".** En rad i kortet med lokalens övriga kommande event (`locationName`, samma
  `viewEvents`-underlag som listan). Rör kortets innehåll, inte dess stopp — kart-ui-reglerna gäller. En dag.

### Spår 3 — Tillsammans: det minsta sociala lagret (horisont B)

**Princip:** bygg det som gör ett event bättre att gå på *med någon* — inte en ny social app. Ingen
presence-GPS, inga hangouts, inga DM, inga röstplaner i v1.

**Ordning, reviderad 6/10 kväll efter Josefs skärmbilder: B8 → B6 → B7.** happymaps "Fråga någon" är en
vanlig delningslänk via telefonens delningsark — mottagaren svarar utan app, och vängrafen växer ur
accepterade inbjudningar. Vi gör likadant: inbjudan först (vi har redan native share av `/e/`-länken och
en anonym session), vänner som biprodukt, "vänner kommer" sist.

**Grund som redan finns:** Firestore-regler för `users/{uid}/friends` (incoming/outgoing-modell), `chats`
(participants), `notifications` (recipientId), `presence`, `waitlist`; `attendees` på events; FCM-push;
eventchatt per event; ♥ med räknare. **Ingen klientkod** använder vänner/chats/presence — allt är rester.
Bygg som API-endpoints enligt plattformsplanen (`/v1/…`) + typer i `@vadkul/kontrakt`, så appen får det gratis.

- **B6. Vänner — ur inbjudningarna.** När någon svarar Ja/Kanske på en inbjudan (B8) och har/skaffar konto
  blir ni vänner automatiskt (`users/{uid}/friends/{friendId}` `{status: accepted, via: inbjudan}`); en
  separat vänförfrågan via länk/QR (`/v/[kod]`) finns också, accept i profilpanelen. Cloud Function
  `acceptFriend` gör dubbelskrivningen atomisk. **Ingen personsökning i v1** (spam, integritet). ~3 dagar
  ovanpå B8.
- **B7. "Jag kommer" på alla event + "Vänner kommer".** I dag: ♥ = sparat (påminnelse 1 h), anmälan bara
  för VADKUL-arrangerade. Lägg explicit "Jag kommer"-knapp i kortets knapprad → `eventRsvps/{eventId}/{uid}`
  + spegel i `users/{uid}/going`. Kortet visar "👥 2 vänner kommer" — **bara ömsesidiga vänner, aldrig
  publikt**, reglage i Inställningar ("Visa vänner vad jag ska på", standard på). Profilpanelens sparade-vy får
  "Vänner ska på". ~1 vecka.
- **B8. "Fråga någon" — inbjudan via delningslänk, utan vängraf.** Kort i eventkortet: "Gå tillsammans —
  fråga någon du känner om de vill följa med." Knappen öppnar **native share** med `/e/[slug]?fran=<uid>&inb=<kod>`
  (vi har redan delningsflödet i `LinkEventCard`). Mottagaren landar på `/e/`-sidan → kartan med kortet
  öppet och en rad "Josef undrar om du följer med · Ja / Kanske / Nej" — **svar kräver inget konto**
  (anonym session som för tips; svaret knyts till kontot om hen skapar ett). Ja-sägare syns i kortet
  ("Du + Anna går"), och eventchatten (finns redan) blir "er chatt" — ingen ny chatt i v1. Push till
  inbjudaren vid svar (FCM finns). Kontrakt + `/v1/invites`-endpoint så appen ärver det. ~1 vecka.
  **Startar först i spår 3** — kräver bara konton för inbjudaren.
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
  motsvarighet till deras organizer claims — med intäktskrok. ~1 vecka. **Tillägg efter skärmbilderna:**
  happymap löser det som ett skapa-flöde ("Ny arrangörssida": namn med dubblettkoll "vi visar om ni redan
  finns hos oss", ort, en rad, intressen, webbplats, bild — och "Ställe" för bar/scen/kafé). Vår variant:
  i +-flödet lägg "Arrangör/ställe" som tredje val → sök mot `hostName`/`locationName` → finns den: claim;
  annars: skapa sida som får skrapade event matchade på namn. Återanvänder arrangörssidorna och B3.
- **C5. Betalning för verkliga event direkt i VADKUL (webb + app).** Biljett, anmälningsavgift eller
  deltagaravgift för "Jag arrangerar"-event betalas i kortet via **Stripe Connect** (arrangören onboardas
  som connected account, pengarna går till arrangören, Stripe är den licensierade betalningsinstitutet —
  vi håller aldrig medel, jfr PSD2) med **Swish + kort + Apple/Google Pay** som betalsätt (Stripe stöder
  Swish i Sverige). Vi kan ta en **plattformsavgift** per transaktion (`application_fee`), eller köra 0 %
  som happymap — **[beslut 7]**. Samma Checkout-/webhook-mönster som boosten (`createBoostCheckout`,
  `firestore-stripe-payments`), så det mesta av kedjan finns. Deltagarlistan (C2) blir kvittot.
  ~1–2 veckor webb, +3–4 dagar i appen (öppnas i in-app-webbläsare eller Stripes RN-SDK).
- **C6. Boost i appen.** Boost är en digital tjänst som konsumeras i appen → i butiken gäller IAP eller
  externa betalningar med butiksprovision (se rutan nedan). Rek: **IAP-produkter för boost dag/vecka/månad
  (15 % under Small Business Program)** för konverteringens skull, och behåll Stripe på webben till 0 %.
  Backend: en `applyEventBoost`-väg till för verifierade App Store-/Play-kvitton (server-side
  verifiering, aldrig lita på klienten). **[beslut 6]**. ~1 vecka efter att konton finns i appen (v1.1).
- **C7. Ansöknings-anmälan** (frågor, Ja/Kanske/Nej, reducerat pris) — **inte nu.** Bygg först när vi
  har > 50 VADKUL-arrangerade event/månad. Betalningen i C5 fungerar med först-till-kvarn redan.

> **Butiksreglerna, läget 6 oktober 2026** (verifierade mot aktuella källor, se PR-beskrivningen —
> **kontrollera igen vid inlämning, de ändras ofta**):
> - **Apple, verkliga varor/tjänster (riktlinje 3.1.3 e):** betalning för fysiska varor och tjänster som
>   konsumeras utanför appen — **eventbiljetter nämns uttryckligen** — *får inte* gå via IAP utan ska
>   tas med andra betalsätt (Apple Pay, kort, Swish). **Ingen Apple-provision.** Det är C5:s grund.
> - **Apple, digitalt (boost, medlemskap):** IAP 30 % / **15 % Small Business** (< 1 M USD/år). Nya
>   EU-villkoren (annonserade aug 2026, gäller från 1 okt 2026) tillåter externa betalningar och IAP
>   sida vid sida, men tar **10–20 % provision även på externa köp** — så "länka ut för att slippa
>   Apple" sparar nästan inget längre. Plattformsplanens gamla skäl för "aldrig i appen" är därmed borta;
>   kvar är bara UX och provisionen.
> - **Google Play (EES, från 30 juni 2026):** serviceavgift **10 %** på första 1 M USD på *alla*
>   digitala transaktioner (även externa länkar/alternativ fakturering) + 5 % faktureringsavgift bara
>   om Play Billing används. Verkliga varor/tjänster omfattas inte alls av Plays betalpolicy.
> - **Sverige = EU/EES** — det är dessa villkor som gäller oss, inte de amerikanska (Epic-domarna).

### Spår 5 — Positionering & förtroende (horisont A, mest beslut)

- **"Så funkar VADKUL"-sida:** gratis för användare, inga banners (ägarbeslut i `affiliate.md`), intäkter =
  boost + biljettlänkar märkta "Annons" (BOKA är redan märkt). Neutraliserar "noll annonser"-argumentet.
- **[beslut] Hotjar.** Session-replay är det som sticker ut i en spårar-skanner. Rek: ta bort, behåll
  Firebase Analytics.
- **Lyft kvalitetsmåtten de inte visar:** verifierad plats (97 %), bild, pris, kategori. "Nära dig i realtid"
  (visionen i `PM.md`) + kvalitet är vårt budskap.

### Spår 6 — Appen, påskyndad (horisont A–B)

**Läget i `vadkul-app` 6/10** (HEAD `4cdb537`, senast pushad 29/9) är längre än plattformsplanens
fas 2-text: karta med nöjesfälts-stilen och teardrop-brickor, GPS-regionval, eventkort som dragbart
bottenark med ANMÄL + Dela och samma innehåll som webbens kort, mörkt läge, "fler event"-lista med
MÅNADEN/POPULÄRT, flikar, dagväljare, städer, sök, profil, webbens kromlayout + stadssidor, `eas init`
med Android-konfig (`se.vadkul.app`, expo-dev-client), **kontraktet publicerat** (`@vadkul/kontrakt@0.1.0`
på npm — fas 2:s största blockerare är borta). **Saknas:** iOS-bygge/TestFlight, Sentry/Crashlytics,
AASA/assetlinks (djuplänkar), auth, push, API, butiksmaterial.

**Snabbaste trovärdiga vägen: dela lanseringen i två.**

- **v1.0 — läs-appen (mål: butikerna inom 4–6 veckor).** Inga konton → ingen kontoradering (5.1.1 v)
  och inget API krävs. Egenvärde mot regel 4.2 (inte ett webbskal): native karta, **lokala favoriter**
  (AsyncStorage, utan konto), **regionpush "helgtips"** via FCM-topics per län (klienten prenumererar
  själv på `helgtips-<region>`; digesten får en topic-sändning bredvid dagens per-användare-push — liten
  backend-ändring), djuplänkar `/e/` via AASA/assetlinks, Dela. ANMÄL/BOKA länkar ut som i dag.
  Checklista: (1) EAS iOS-bygge + Apple Developer-konto + TestFlight, (2) Sentry in, (3) AASA +
  assetlinks.json upp på vadkul.se, (4) `@react-native-firebase/messaging` + topics, (5) App Privacy /
  Data Safety-deklarationer (utan konton är de korta), (6) butiksmaterial — skärmbilder kan tas ur dev-bygget,
  (7) granskning. CARTO-villkoren för mobil (plan §9.2) verifieras i (1).
- **v1.1 — konton, socialt, betalning (plattformsplanens fas 3, direkt efter).** Hono-API:t,
  App Check, Firebase Auth **inkl. Sign in with Apple** (krav 4.8 så fort Google-inloggning finns),
  kontoradering, sparade/stjärnor/påminnelser synkade, push-tokens per användare, spår 3:s vänner/kommer/
  bjud in, C5-betalning i kortet och C6-boost via IAP. JS-ändringar går ut via EAS Update utan ny
  butiksgranskning; auth/IAP är native-moduler och kräver ett nytt bygge — planera det som v1.1-bygget.

**Två saker att ändra nu:** `vadkul-app/CLAUDE.md` har den hårda regeln "APPEN SÄLJER INGENTING" —
den ska skrivas om till "verkliga tjänster utanför IAP, digitalt via IAP, aldrig egen prislogik i
klienten" (det repot har jag bara läsrätt till i den här sessionen). Och plattformsplanen §1/§6/§7 är
reviderade i samma PR som det här dokumentet.

## 2. Vad vi medvetet inte gör

- **Hangouts, presence, DM, röstplaner** — annan produkt, hög kostnad, moderering. Omprövas efter spår 3.
- **Jaga råa eventantal** — paraplybrus. LOKALA-andelen är måttet.
- **Vänta med appen tills API:t är klart** — tvärtom: app v1.0 är en läs-app utan konton och behöver inget
  API (plattformsplanen §7 säger redan det). Det sociala och boost i appen byggs som endpoints och kommer i v1.1.
- **Återinföra borttagna kartfunktioner** — kart-ui-listan står fast.
- **Smakprofil/rekommendationer** — se beslut 2 nedan.

## 3. Beslut som är dina

1. **♥ eller egen knapp?** Ska ♥ betyda "jag kommer", eller behåller vi ♥ = sparat och lägger "Jag kommer"
   som egen knapp? Rek: egen knapp. Skärmbilderna 6/10 bekräftar att happymap har **"Jag kommer" och
   "Intresserad" sida vid sida** i eventsidan — ♥ ≈ Intresserad, "Jag kommer" egen.
2. **Personalisering.** "Tips för dig"-sektionen är borttagen på ägarbeslut. Happymaps smakprofil är ett
   nytt beslut. Rek: vänta — "vänner kommer" är bättre personalisering än en smakprofil i vår storlek.
3. **Hotjar** kvar eller bort?
4. **Var bor "Vänner ska på"?** Listan under kortet har två låsta flikar (23/9). Rek: profilpanelen i v1.
5. **Kurser** med fast startdatum in eller inte (A6)?
6. **Boost i appen:** IAP (15 %) för konvertering, eller bara webben (0 %) med länk? Rek: IAP i v1.1.
7. **Plattformsavgift på biljetter/anmälningar:** 0 % som happymap (ren förtroendeposition), eller
   t.ex. 3–5 % + Stripes avgift (intäkt som skalar med arrangörerna)? Rek: starta på 0 % med avgiften
   byggd men avstängd, slå på när volymen finns — kommunicera det öppet från dag ett.
8. **Kategorier: flerval och finare taxonomi?** 16/9 låste *en* kategori åt gången i sökpanelen. Happymap
   kör flerval över 16 kategorier (Nattliv, Karaoke, Film, Quiz, Föreläsningar, Festivaler …); vår taxonomi
   är 11 och bor i `@vadkul/kontrakt` (delas med appen och audit-daemonen), och `other` rymmer 5 004 event.
   Rek: behåll en-åt-gången i UI:t tills vidare, men **utöka taxonomin** med 3–4 nycklar som tömmer `other`
   (Film, Föreläsning, Nattliv, Festival) — det är pipeline + kontrakt, inte kartyta.

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
| 10 | B8 "Fråga någon" — inbjudan via delningslänk | 3 | 1 v | beslut 1 |
| 11 | B6 vänner ur inbjudningarna (+ länk/QR) | 3 | 3 d | B8 |
| 12 | B7 kommer / vänner kommer | 3 | 1 v | B6, beslut 4 |
| 13 | B9 integritetspolicy | 3 | 1 d | B6–B8 |
| 14 | C4 arrangörs-claim | 4 | 1 v | — |
| 15 | C2 export + väntelista | 4 | 2 d | — |
| 16 | B5 följ arrangör | 2 | 3 d | — |
| 17 | **App v1.0** läs-app: iOS-bygge, Sentry, AASA, topic-push, butiksmaterial, granskning | 6 | 4–6 v (parallellt med 1–9) | — |
| 18 | C5 betalning för verkliga event (Stripe Connect + Swish), webb | 4 | 1–2 v | beslut 7 |
| 19 | **App v1.1** API + konton + Sign in with Apple + kontoradering | 6 | 3–4 v | v1.0 ute |
| 20 | C6 boost i appen via IAP + kvittoverifiering | 4 | 1 v | 19, beslut 6 |
| 21 | C5 i appen (in-app-webbläsare/Stripe RN) + spår 3 i appen | 4/6 | 1–2 v | 18, 19 |
| 22 | B5b Hitta hit + arrangörslänk i kortet | 2 | 0,5 d | — |
| 23 | Taxonomi-utökning (beslut 8): kontrakt + audit-daemon + omklassning av `other` | 1 | 3–4 d | beslut 8 |
| 24 | B5c chatten läsbar utloggad | 2 | 1 d | — |
| 25 | B5d förtroendestämpel "Från · kontrollerad" | 2 | 0,5 d | — |
| 26 | B5e "Mer på <lokal>" i kortet | 2 | 1 d | — |

**Reviderad prioritet (6/10):** appen (17) startar omedelbart och går parallellt med horisont A —
den är inte beroende av något annat spår. Steg 18 lyfts före spår 3, eftersom betalning för
verkliga event är intäkt utan butiksavgift och återanvänder boost-kedjan.

Steg 1–9 är horisont A och kan gå parallellt (minin tar 1–2, webben 3–9). Allt som rör ren logik får
tester i samma veva, och berörd apps tester + `tsc --noEmit` körs innan något rapporteras klart (CLAUDE.md).
