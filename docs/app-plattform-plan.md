# VADKUL som plattform: API + React Native-app — planeringsdokument

Status: **PLAN — inget av detta är byggt ännu.** Det här dokumentet är beslutsunderlaget
och färdplanen för den stora omorganiseringen: en riktig API-grund, ett eget repo för
mobilappen (React Native/Expo), och det här repot som fortsatt hem för webben + pipelinen.

---

## 1. Målbild

- **Webben (vadkul.se)** — kartan, stadssidorna, SEO, outreach. Bor kvar i det här repot.
- **Appen (vadkul-app, eget repo)** — React Native via Expo. Kartan + eventflödet,
  push-notiser ("event nära dig i helgen"), sparade favoriter. Det användarna frågar efter.
- **API:t (api.vadkul.se)** — en versionerad HTTP-yta som båda klienterna talar med för
  allt autentiserat. Läsdata (eventflödet) fortsätter gå via CDN-aggregat, inte via API-anrop.
- **Betalningar (boost)** — sker **aldrig i appen**. Appen säljer inget, visar inga priser
  och länkar inte till köp; arrangörer boostar på webben (mejl efter skapat event → länk).
  Det håller oss utanför Apples IAP-krav (jfr Metas boosted posts) och kräver noll ändring
  i Stripe-flödet. Omprövas först om datan visar att mobilköp behövs (då: IAP, Small
  Business Program 15 %).

### Vad som INTE ändras

- Pipelinen (`apps/scraper`), nattkedjan på minin, SQLite-spegeln, aggregat-JSON:erna.
- `stamped()`-regeln, `url` som primärnyckel, Firestore-egress-reglerna. Allt i CLAUDE.md står fast.
- Stripe-boostflödet (`createBoostCheckout` + `applyEventBoost`) — det återanvänds som det är.

---

## 2. Repostrategi

**Beslut: två repon + ett delat kontraktspaket i det här repot.**

| Repo | Innehåll | Deploy |
|---|---|---|
| `josefanderberg/VADKUL` (detta) | `apps/web`, `apps/scraper`, `apps/functions` (inkl. nya API:t), `packages/kontrakt`, `infra/` | Firebase Hosting + Functions, som idag |
| `josefanderberg/vadkul-app` (nytt) | Expo-appen | EAS Build → TestFlight / Play Console |

**Varför inte allt i ett monorepo?** Expo/Metro i npm-workspaces är känt hoisting-krångel,
appens releasetakt är butiksgranskningens (dagar), inte webbens (minuter), och minins
nattliga data-pushar + GitHub Actions ska inte trigga app-CI. Precedens finns redan:
`vadkulyt/` är ett eget repo av samma skäl.

**Hur delas kod då?** Via **ETT paket** i det här repot (workspaces-fältet pekar redan
på `packages/*`, mappen har bara aldrig skapats):

- **`packages/kontrakt`** (`@vadkul/kontrakt`) — allt som är kontrakt mellan
  klienterna: TypeScript-typer + zod-scheman för endpoints och aggregatformat, OCH
  den rena React-fria logik båda klienterna behöver (`eventShareSlug` — GULDTESTET
  flyttar med — datum-/stadslogik, feed-filtrering). Slug-formatet och datumreglerna
  ÄR kontrakt, precis som schemana. Publiceras till GitHub Packages (privat npm)
  med semver; appen installerar det som vanligt beroende, web/functions använder
  det via workspace. Subpath-exports (`@vadkul/kontrakt/core`) om det växer.

  *(Granskningsrundan 25/9 slog ihop de ursprungliga två paketen contract + core:
  båda klienterna behövde båda, och ett paket = en version att bumpa, en publish,
  en rad i .npmrc. Dela först den dag ett beroende faktiskt skiljer dem åt.)*

Kontraktspaketet är **enda** kopplingen mellan repona. Ingen kod kopieras för hand,
inga git-submoduler.

### Så ser det ut på disk (allt i samma projektmapp)

```
~/VADKUL/                          ← EN mapp, som idag
├── apps/
│   ├── web/                       Next.js (vadkul.se)           [detta repo]
│   ├── functions/                 Cloud Functions + API:t       [detta repo]
│   │   └── src/api/               ← api.vadkul.se/v1
│   │       ├── routes/v1/  middleware/  domain/
│   └── scraper/                   pipelinen, orörd              [detta repo]
├── packages/                      NYTT — delningsytan
│   └── kontrakt/                  API-typer + zod-scheman + ren logik (eventShareSlug m.m.)
├── docs/  infra/  scripts/                                      [detta repo]
├── vadkulyt/                      eget repo, git-ignorerat (som idag)
└── vadkul-app/                    NYTT eget repo, git-ignoreras likadant
    ├── app/                       expo-router-skärmar
    └── src/ (features/ api/ ui/)  installerar @vadkul/kontrakt
```

Samma upplägg som `vadkulyt/` alltså: appen ligger *i* projektmappen för enkel åtkomst
(en `vadkul-app/`-rad till i huvudrepots `.gitignore`), men har egen git-historik,
egen CI och egen releasetakt. Visuell version av hela strukturen (repona, dataflödet,
faserna): <https://claude.ai/artifact/2kqp9fZWjCuuLQ9kwao4pn>.

---

## 3. API-design

### 3.1 Principer

1. **Läsning är CDN, skrivning är API.** Kartan/flödet i appen läser samma aggregat-
   JSON:er som webben, via Hosting/CDN — de statiska filerna ÄR läskontraktet och
   får aldrig en API-spegel (se 3.3). Noll Firestore-reads per klient för flödet —
   det är det som gör driftkostnaden överlevbar (se CLAUDE.md).
2. **Versionerat från dag 1:** allt under `/v1/`. Appbutiksklienter kan inte tvångs-
   uppdateras; `/v1` fryses i beteende, brytande ändringar blir `/v2`.
3. **Ett kontrakt, en sanning:** varje endpoint har zod-schema i `packages/kontrakt`.
   Servern validerar in/ut med samma schema som klienten typar mot. OpenAPI-spec
   genereras ur zod-schemana (`zod-openapi`) — dokumentation kan aldrig ljuga.
4. **Tunna handlers, tjock domän.** HTTP-lagret parsar/validerar/svarar; logiken bor i
   `domain/`-moduler som är rena funktioner → testbara med vitest utan emulator.

### 3.2 Teknikval

- **Cloud Functions v2 (onRequest) + Hono** som router, deployat som EN funktion
  `api` bakom Hosting-rewrite `api.vadkul.se/** → api`. Hono är minimal, TS-först och
  Edge-portabel — flyttar vi till Cloud Run senare följer koden med orörd.
- **Firebase Auth** (finns redan) — appen och webben skickar ID-token i
  `Authorization: Bearer`. Middleware verifierar med Admin SDK.
- **Firebase App Check** — Play Integrity (Android), App Attest (iOS), reCAPTCHA
  Enterprise (web). Körs i **monitor-läge först** (metrics utan block) och slås
  över till enforcement när riktiga klienter bevisat passerar — enforcement dag 1
  låser ute varje felkonfigurerad klient utan felmeddelande.

### 3.3 Endpoints (v1)

**Läsdatan har inga API-endpoints alls** (granskningsrundan 25/9 strök dem):
aggregat-JSON:erna på CDN:et ÄR läskontraktet, för webben idag och appen imorgon —
deras format zod-schemas i `@vadkul/kontrakt` precis som API-svaren. Att spegla dem
bakom `/v1/feed/*` hade varit en andra väg till samma data. API:t är enbart det
autentiserade:

```
POST /v1/user-events          skapa användarevent          [auth]
PATCH/DELETE /v1/user-events/:id  ägarens redigering        [auth, ägarskap]
GET  /v1/me                   profil, stjärnor, egna event  [auth]
DELETE /v1/me                 kontoradering + dataradering  [auth]  ← App Store-KRAV (5.1.1)
PUT  /v1/me/stars/:eventId    stjärnmärk / av               [auth]
PUT  /v1/me/reminders/:eventId påminnelse                   [auth]
POST /v1/me/push-tokens       registrera FCM-token          [auth]
POST /v1/boost/checkout       wrappar createBoostCheckout   [auth]  ← anropas ENDAST av webben
```

Kontoraderingen är inte valfri: App Store-regel 5.1.1(v) kräver radering inifrån
appen så fort konton kan skapas, och Google Play kräver en raderingsväg i sin
Data Safety-deklaration. Den byggs i fas 3, inte som eftertanke i granskningskön.

Befintliga callables (`placeStar`, `redeemCode`, …) lever parallellt tills webben
migrerats; inga dubbla sanningar — callablen och endpointen delar domänfunktion.

### 3.4 Aggregat: en app-brygga, inte en ombyggnad — ✅ BYGGD (fas 1, 25/9)

Destinations-lagret är 21 MB — okej för webben (cachas, streamas), för tungt som
mobil-payload. **Byggt så här** (viktig kurskorrigering under implementationen:
statiska filer i `public/` når prod bara vid DEPLOY — nattens data når produktionen
via blob-vägen, så flödet går samma väg som huvudlagren):

- **`utils/appFeed.ts` i scrapern**: per-region-payloader (län-slug ur CITIES,
  region = närmaste stadens län, haversine utan radietak). Fält: id, titel, tid,
  ev. slutdatum, koordinater, plats, kategori, emoji, pop, bild (joinad ur cards
  via eventKey). **Horisont 14 dagar** — samma fönster som kartan laddar; 30 dagar
  sprängde 200 kB-målet för storstadsregionerna (Sthlm 277 kB br), 14 klarar det.
- **Nattkedjans `aggregate` laddar upp dem som förpackade blobbar** (brotli q11 +
  gzip, `uploadPrepackedBlobs`) + ett metadatadokument per region. Inga statiska
  filer, ingen git-churn, inga workflow-ändringar — minin behöver bara `git pull`.
- **`/api/events/app-<region>`**: befintliga CDN-routen utökad med app-lagren,
  BLOB-ONLY (utan blob → 503 no-store; nästa natt läker). Regionlistan härleds ur
  CITIES — ingen egen sanning.
- **Uppmätt på skarpa datat 25/9**: 23 430 event i 20 regioner, största regionen
  (Västra Götaland) **198 kB brotli** — alla under 200 kB-målet. ✓
- Boost-flagga ingår INTE (aggregatet bär inte boost och nattens fil hade missat
  dagens köp) — appen får boost via API:t i fas 3. Beskrivningar hämtas per event.

---

## 4. Säkerhet (OWASP-baserad, API Security Top 10 + MASVS)

| Risk | Åtgärd |
|---|---|
| API1/API5 (BOLA/BFLA) | Ägarskapskontroll i domänlagret på varje objekt-endpoint (`uid === resource.ownerUid`), aldrig bara i Firestore rules. Admin-roller via custom claims, inte mejllistor i klientkod. |
| API2 (broken auth) | Enbart Firebase ID-token-verifiering server-side; ingen egen sessionshantering. Korta token-TTL:er sköts av SDK:t. |
| API3 (excessive data) | Svar byggs ur zod-**output**-scheman — fält som inte står i schemat lämnar aldrig servern. Inga PII i aggregat (publika filer!). |
| API4 (rate limiting) | App Check + per-uid rate limit i middleware (Firestore-fri räknare: in-memory per instans + `maxInstances`-tak; hårdare gräns på skriv-endpoints). ÄRLIGT TALAT en mjuk gräns — per instans, nollas vid omstart. Medvetet vald: Firestore-räknare bryter egress-regeln och Memorystore är ny infra. Räcker ihop med App Check för v1; omprövas om missbruk syns i loggarna. |
| API8 (injection) | zod-validering av all input; inga strängbyggda queries (Admin SDK är parametriserat); URL-fält valideras mot scheman (returnUrl-allowlisten i boost behålls). |
| Secrets | Som idag: Functions `secrets: [...]`, aldrig i repo. App-repot har **inga** hemligheter alls — bara publika Firebase-configvärden. |
| Mobil (MASVS) | Ingen känslig data i AsyncStorage okrypterat (expo-secure-store för tokens), certifikatspinning bedöms i fas 2, inga API-nycklar med skrivbehörighet i bundlen. |
| Betalning | Belopp/pris ägs av backend (redan löst i `createBoostCheckout`); appen exponerar inte köpytan alls. |
| Beroenden | Dependabot + `npm audit` i CI i båda repona; lockfiles committade. |

`/security-review` körs på API-fasens PR innan den mergas.

---

## 5. Omorganisering av detta repo

Stegvis, aldrig big-bang — varje steg grönt (test + tsc) innan nästa:

1. **`packages/kontrakt` skapas.** Typerna i `apps/web/src/types/index.ts`
   och de rena utils som appen behöver flyttar in; web importerar från paketet.
   `eventShareSlug.test.ts` flyttar med och ska vara grönt utan ändrade testvärden.
   `typecheck.yml` får ett packages-steg i samma veva.
   **DEPLOY-GOTCHA (verifierad mot firebase.json):** functions deployas med
   `source: apps/functions` och packas ensam med egen lockfil — Cloud Build kan
   ALDRIG lösa en workspace-dependency på `packages/kontrakt` (`npm ci` ser inte
   `../../packages`). Lösningen är att **bundla**: functions-bygget byter tsc →
   esbuild så kontrakt-paketet kompileras IN i `lib/` och aldrig står i runtime-
   package.json. (Alternativet `isolate-package` prövas bara om bundlingen
   krånglar.) Webben berörs inte — rotens lockfil täcker workspace-paket och
   Next transpilerar dem med `transpilePackages`.
2. **`apps/functions/src/index.ts` (~1000 rader) styckas:**
   `boost/`, `stars/`, `notifications/`, `digest/`, `api/` — `index.ts` blir bara exports.
   Ren refaktor, ingen beteendeändring; befintliga vitest-sviter låser beteendet.
3. **`apps/functions/src/api/`** — Hono-appen: `middleware/` (auth, appCheck, rateLimit),
   `routes/v1/`, `domain/`. Hosting-rewrite för `api.vadkul.se` i `firebase.json`.
4. **Web migrerar service för service** (`starService`, `linkEventService`, …) till API:t
   när det är stabilt — lågprio, callables funkar under tiden.

Minins push-whitelist och `deploy.yml`-ignoren uppdateras i fas 1 (nya aggregatfilerna);
deploy-skillen ses över i fas 3 (nya functions-exporten). Inget annat i infra ändras.

---

## 6. App-repot (`vadkul-app`)

- **Expo + TypeScript + expo-router.** EAS Build/Submit; `development`/
  `preview`/`production`-kanaler. OTA-uppdateringar via EAS Update för JS-fixar.
  OBS: kartan, App Check och FCM är native-moduler → appen körs i en **EAS dev
  build (custom dev client)**, aldrig i Expo Go.
- **Karta: `@maplibre/maplibre-react-native`** — INTE Mapbox. Webben kör maplibre-gl
  mot CARTO:s Voyager-kakel med vår nöjesfälts-transform (CLAUDE.md:s "Mapbox-karta"
  är historisk formulering); appen använder samma transformerade stil-JSON via
  `packages/kontrakt`. MapLibre RN är gratis — ingen MAU-prissättning alls. Direktvisning
  av CARTO-kakel för besökare är samma §9.c.i-fall som webben; skulle mobilvillkor
  eller volym bli ett problem finns reservvägen redan byggd: egna Sverige-kakel
  (`sweden.pmtiles`, se docs/kartbilder.md) bakom en kakel-endpoint. Kart-UI-besluten
  i `.claude/skills/kart-ui/` gäller även appen — borttagna features återuppstår inte.
- **State/data:** TanStack Query mot CDN-aggregaten + API:t; favoriter/stjärnor cacheas
  lokalt (offlineläge = appens mervärde). Ingen Firestore-SDK i appen — allt via API:t
  (mindre bundle, ingen rules-yta att underhålla, egress-kontrollen kvar på servern).
- **Auth:** Firebase Auth via `@react-native-firebase/auth`; Sign in with Apple är
  OBLIGATORISK på iOS så fort Google-inloggning finns (App Store-regel 4.8).
- **Push: `@react-native-firebase/messaging`** — appens tokens landar i samma
  `fcmTokens`-samling som webbens, så hela befintliga sändkedjan
  (`sendPushToUser`/digest, `admin.messaging().sendEachForMulticast`) funkar orörd
  för båda klienterna. Registrering via `/v1/me/push-tokens`. Expos egen push-tjänst
  (expo-notifications-tokens) valdes bort: den hade gett en ANDRA sändväg att
  underhålla parallellt med FCM.
- **Butiksgranskning (regel 4.2):** appens egenvärde = push nära dig, offline-favoriter,
  native karta — inte ett webbskal. Ingen köpyta, inga priser, ingen "boost"-text.
- **CI:** typecheck + vitest på ren logik + EAS-bygge på tag. Egen `CLAUDE.md` med
  appens regler (bl.a. betalningsregeln ovan).

---

## 7. Faser & ordning

Granskningsrundan 25/9 flyttade API-bygget: **app-MVP:n behöver inget API alls**
(den läser CDN-aggregat), så API:t byggs när dess första konsument kommer —
kontona i fas 3 — inte en säsong i förväg. Det kortar vägen till TestFlight och
ingen API-yta står och skräpar utan anropare.

| Fas | Innehåll | Klart när |
|---|---|---|
| **0. Kontrakt** ✅ 25/9 | `packages/kontrakt`, typflytt, functions-styckning (esbuild-bundling) | allt grönt, webben oförändrad i beteende ✓ |
| **1. App-flödet** ✅ 25/9 | slimmat per-region-flöde som blobbar i befintliga nattkedjan + `/api/events/app-<region>` (se §3.4) | uppmätt lokalt: alla regioner < 200 kB br ✓ — curl mot prod kvitteras efter merge + deploy + nästa nattaggregat |
| **2. App-MVP** 🔨 | vadkul-app-repot: karta + flöde + eventkort + djuplänkar (`/e/`-slugs via `@vadkul/kontrakt`; AASA/assetlinks.json upp på vadkul.se — finns inte idag). **Byggt 25/9:** repot uppe (github.com/josefanderberg/vadkul-app), regionval + flödesklient + karta, nöjesfälts-transformen portad (testad), teardrop-brickor som förbakade kategori-PNG:er i symbol-lager (MapLibre kan inte rendera färg-emoji som text; eventets fria emoji kräver runtime-bakning — senare steg), GPS-regionval via MapLibre RN:s LocationManager, eventkort med `/e/`-utlänk. **Kvar:** kontraktspubliceringen (§9.1 — `file:../packages/kontrakt` löser INTE i EAS-molnbyggen), EAS dev build på riktig enhet, AASA/assetlinks, Crashlytics/Sentry | intern TestFlight |
| **3. API + Konton** | Hono-skelettet, `api.vadkul.se`, App Check (monitor→enforce); auth, stjärnor, påminnelser, user-events, push-tokens, kontoradering | funktionsparitet med inloggad webb (minus boost) |
| **4. Lansering** | butiksmaterial, App Privacy/Data Safety-deklarationer, granskning, mejlet "ditt event är ute → boosta på webben" | live i App Store + Play |
| **5. Webbmigrering** | web-services → API:t, callables pensioneras | lågprio, städfas |

Fas 0–1 är rena PR:ar i det här repot och kan börja direkt. App-repot skapas i
fas 2. Krascher och API-fel ska synas: Crashlytics (eller Sentry) in i appen från
fas 2, strukturerade fel-loggar i API:t från fas 3 — inga tysta haverier.

---

## 8. Övervägda alternativ (granskningsrundan 25/9)

Beslut som prövats mot alternativ och HÅLLIT — så resonemangen inte tappas bort:

| Beslut | Alternativ som vägdes | Varför alternativet föll |
|---|---|---|
| Två repon | Allt-i-ett-monorepo (Expo stöder workspaces numera) | Går tekniskt, men nattdatapusharna/CI-filtren, butiksreleasetakten och vadkulyt-precedensen väger tyngre än bekvämare delning; delningskostnaden är begränsad till kontraktspaketen. |
| Hono på Functions v2 | Next.js route handlers (`app/api` finns redan) | Kopplar appens API till webbens deploy och den ömtåliga firebase-frameworks-bundlen (sharp-incidenten 23–26/8 i CLAUDE.md), tunga cold starts. |
| — | Cloud Run direkt | Functions v2 ÄR Cloud Run under huven; Hono gör koden flyttbar den dagen det behövs. Ingen ny deploy-pipeline nu. |
| REST + zod/OpenAPI | tRPC | Trevlig DX men låser varje framtida klient till TS + tRPC-runtime; REST med genererad spec åldras bättre. |
| FCM i appen | Expos push-tjänst | Expo-tokens hade krävt en andra sändväg bredvid befintliga FCM-kedjan. |
| React Native (Expo) | Swift/SwiftUI native | Swift är bara iOS — Sverige är ~hälften Android, så native betyder TVÅ kodbaser (Swift + Kotlin) i språk vi inte skriver, noll återanvändning av kontraktet/zod/React-tänket. Kartmotorn är native C++ i BÅDA fallen (MapLibre RN wrappar maplibre-native), så prestandan där är samma. Native blir rätt först om appen behöver det RN inte når (widgets som huvudfeature, AR, extrema animationer) — inget av det är på kartan. |
| MapLibre RN | `@rnmapbox/maps` | Ursprungsplanen antog fel att webben körde Mapbox — det gör den inte. MapLibre RN är gratis och tar vår befintliga stil rakt av. |
| Ett kontraktspaket | Två (`contract` + `core`) | Båda klienterna behövde båda; ett paket = en version, en publish, en `.npmrc`-rad. Delas först när ett beroende faktiskt skiljer dem. |
| API:t byggs i fas 3 | API-läs som fas 1 | MVP:n läser CDN — feed-endpoints hade varit en andra väg till samma data, och API-ytan hade stått utan konsument tills kontona kom. |

## 9. Öppna frågor (avgörs innan respektive fas)

1. **Kontraktsdelningen — beslutspunkt SKÄRPT under fas 0 (25/9):** GitHub Packages
   kräver att npm-scopet matchar repo-ägaren — `@vadkul/kontrakt` kan alltså INTE
   publiceras dit utan att döpas om till `@josefanderberg/kontrakt`. Tre vägar:
   (a) **publikt npmjs under gratis `@vadkul`-org** — rekommenderas: innehållet är
   inte hemligt (slug-algoritmen ligger redan i webbens publika bundle), namnet
   behålls, EAS behöver ingen auth alls; (b) GitHub Packages med ägar-scope
   (namnbyte + läs-PAT i EAS); (c) codegen-synk från OpenAPI-specen. Josef väljer
   inför fas 2 — koden är opåverkad tills dess (workspace-namnet funkar internt
   oavsett).
2. **CARTO-villkoren för mobil** — verifiera innan fas 2 att direktvisning i app
   ryms i basemap-villkoren (webbens §9.c.i-fall). Reservvägen (egna Sverige-kakel)
   finns redan, se §6.
3. **Domän:** `api.vadkul.se` som eget Hosting-site eller rewrite på huvudsajten.
   Avgörs i fas 1 — eget site ger renare cache-regler.
4. **Android-push-nivå** — räcker FCM-notiser rakt av, eller behövs notifee för
   rikare notiser. Fas 3.
