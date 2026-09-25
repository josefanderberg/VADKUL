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
| `josefanderberg/VADKUL` (detta) | `apps/web`, `apps/scraper`, `apps/functions` (inkl. nya API:t), `packages/contract`, `packages/core`, `infra/` | Firebase Hosting + Functions, som idag |
| `josefanderberg/vadkul-app` (nytt) | Expo-appen | EAS Build → TestFlight / Play Console |

**Varför inte allt i ett monorepo?** Expo/Metro i npm-workspaces är känt hoisting-krångel,
appens releasetakt är butiksgranskningens (dagar), inte webbens (minuter), och minins
nattliga data-pushar + GitHub Actions ska inte trigga app-CI. Precedens finns redan:
`vadkulyt/` är ett eget repo av samma skäl.

**Hur delas kod då?** Via `packages/` i det här repot (workspaces-fältet pekar redan på
`packages/*`, mappen har bara aldrig skapats):

- **`packages/contract`** — API-kontraktet: TypeScript-typer + zod-scheman för varje
  endpoint och för aggregatformaten (events-cards m.fl.). Publiceras som
  `@vadkul/contract` till GitHub Packages (privat npm) med semver. Appen installerar den
  som vanligt beroende; web/functions använder den via workspace.
- **`packages/core`** — ren, React-fri logik som båda klienterna behöver:
  `eventShareSlug` (GULDTESTET flyttar med), datum-/stadslogik, feed-filtrering.
  Samma publiceringsväg.

Kontraktspaketet är **enda** kopplingen mellan repona. Ingen kod kopieras för hand,
inga git-submoduler.

---

## 3. API-design

### 3.1 Principer

1. **Läsning är CDN, skrivning är API.** Kartan/flödet i appen läser samma aggregat-
   JSON:er som webben, via Hosting/CDN (`vadkul.se/events-cards.json` → på sikt
   `api.vadkul.se/v1/feed/...` med CDN-cache framför). Noll Firestore-reads per klient
   för flödet — det är det som gör driftkostnaden överlevbar (se CLAUDE.md).
2. **Versionerat från dag 1:** allt under `/v1/`. Appbutiksklienter kan inte tvångs-
   uppdateras; `/v1` fryses i beteende, brytande ändringar blir `/v2`.
3. **Ett kontrakt, en sanning:** varje endpoint har zod-schema i `packages/contract`.
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
- **Firebase App Check** med enforcement — Play Integrity (Android), App Attest (iOS),
  reCAPTCHA Enterprise (web). Strimlar bort skriptad missbrukstrafik.

### 3.3 Endpoints (v1)

```
GET  /v1/feed/cards           aggregat, CDN-cachad, publik (idag events-cards.json)
GET  /v1/feed/descriptions    aggregat, CDN-cachad, publik
GET  /v1/events/:id           ett event (för deep links/push-landning)

POST /v1/user-events          skapa användarevent          [auth]
PATCH/DELETE /v1/user-events/:id  ägarens redigering        [auth, ägarskap]
GET  /v1/me                   profil, stjärnor, egna event  [auth]
PUT  /v1/me/stars/:eventId    stjärnmärk / av               [auth]
PUT  /v1/me/reminders/:eventId påminnelse                   [auth]
POST /v1/me/push-tokens       registrera FCM/APNs-token     [auth]
POST /v1/boost/checkout       wrappar createBoostCheckout   [auth]  ← anropas ENDAST av webben
```

Befintliga callables (`placeStar`, `redeemCode`, …) lever parallellt tills webben
migrerats; inga dubbla sanningar — callablen och endpointen delar domänfunktion.

### 3.4 Aggregat: en app-brygga, inte en ombyggnad

`events-cards.json` är 11 MB — okej för webben (cachas, streamas), för tungt som
mobil-payload. Nytt steg i befintliga aggregatjobbet (scraper-repot, samma nattkedja):
**`events-app-feed.json` per stad/region**, slimmad fältlista (id, titel, tid, plats,
koordinater, bild-thumb, boost-flagga). Skrivs till samma whitelist-mapp som övriga
aggregat. Appen laddar sin region + delta-uppdaterar. Ingen ändring i skrapningen själv.

---

## 4. Säkerhet (OWASP-baserad, API Security Top 10 + MASVS)

| Risk | Åtgärd |
|---|---|
| API1/API5 (BOLA/BFLA) | Ägarskapskontroll i domänlagret på varje objekt-endpoint (`uid === resource.ownerUid`), aldrig bara i Firestore rules. Admin-roller via custom claims, inte mejllistor i klientkod. |
| API2 (broken auth) | Enbart Firebase ID-token-verifiering server-side; ingen egen sessionshantering. Korta token-TTL:er sköts av SDK:t. |
| API3 (excessive data) | Svar byggs ur zod-**output**-scheman — fält som inte står i schemat lämnar aldrig servern. Inga PII i aggregat (publika filer!). |
| API4 (rate limiting) | App Check-enforcement + per-uid rate limit i middleware (Firestore-fri räknare: in-memory per instans + max-instances-tak; hårdare gräns på skriv-endpoints). |
| API8 (injection) | zod-validering av all input; inga strängbyggda queries (Admin SDK är parametriserat); URL-fält valideras mot scheman (returnUrl-allowlisten i boost behålls). |
| Secrets | Som idag: Functions `secrets: [...]`, aldrig i repo. App-repot har **inga** hemligheter alls — bara publika Firebase-configvärden. |
| Mobil (MASVS) | Ingen känslig data i AsyncStorage okrypterat (expo-secure-store för tokens), certifikatspinning bedöms i fas 2, inga API-nycklar med skrivbehörighet i bundlen. |
| Betalning | Belopp/pris ägs av backend (redan löst i `createBoostCheckout`); appen exponerar inte köpytan alls. |
| Beroenden | Dependabot + `npm audit` i CI i båda repona; lockfiles committade. |

`/security-review` körs på API-fasens PR innan den mergas.

---

## 5. Omorganisering av detta repo

Stegvis, aldrig big-bang — varje steg grönt (test + tsc) innan nästa:

1. **`packages/contract` + `packages/core` skapas.** Typerna i `apps/web/src/types/index.ts`
   och de rena utils som appen behöver flyttar in; web importerar från paketen.
   `eventShareSlug.test.ts` flyttar med och ska vara grönt utan ändrade testvärden.
2. **`apps/functions/src/index.ts` (~1000 rader) styckas:**
   `boost/`, `stars/`, `notifications/`, `digest/`, `api/` — `index.ts` blir bara exports.
   Ren refaktor, ingen beteendeändring; befintliga vitest-sviter låser beteendet.
3. **`apps/functions/src/api/`** — Hono-appen: `middleware/` (auth, appCheck, rateLimit),
   `routes/v1/`, `domain/`. Hosting-rewrite för `api.vadkul.se` i `firebase.json`.
4. **Web migrerar service för service** (`starService`, `linkEventService`, …) till API:t
   när det är stabilt — lågprio, callables funkar under tiden.

Deploy-skillens whitelist och `deploy.yml` ses över i steg 3 (nya functions-exporten),
inget annat i infra ändras.

---

## 6. App-repot (`vadkul-app`)

- **Expo (managed) + TypeScript + expo-router.** EAS Build/Submit; `development`/
  `preview`/`production`-kanaler. OTA-uppdateringar via EAS Update för JS-fixar.
- **Karta:** `@rnmapbox/maps` (samma Mapbox-konto/stilar som webben). Kart-UI-besluten i
  `.claude/skills/kart-ui/` gäller även appen — borttagna features återuppstår inte där.
- **State/data:** TanStack Query mot CDN-aggregaten + API:t; favoriter/stjärnor cacheas
  lokalt (offlineläge = appens mervärde). Ingen Firestore-SDK i appen — allt via API:t
  (mindre bundle, ingen rules-yta att underhålla, egress-kontrollen kvar på servern).
- **Auth:** Firebase Auth (Apple/Google-inloggning krävs av butikerna om inloggning finns).
- **Push:** FCM/APNs via befintliga `sendPushNotification`/digest-funktionerna;
  token-registrering via `/v1/me/push-tokens`.
- **Butiksgranskning (regel 4.2):** appens egenvärde = push nära dig, offline-favoriter,
  native karta — inte ett webbskal. Ingen köpyta, inga priser, ingen "boost"-text.
- **CI:** typecheck + vitest på ren logik + EAS-bygge på tag. Egen `CLAUDE.md` med
  appens regler (bl.a. betalningsregeln ovan).

---

## 7. Faser & ordning

| Fas | Innehåll | Klart när |
|---|---|---|
| **0. Kontrakt** | `packages/contract` + `packages/core`, typflytt, functions-styckning | allt grönt, webben oförändrad i beteende |
| **1. API-läs** | Hono-skelett, `api.vadkul.se`, feed-endpoints + app-aggregatet, App Check | curl mot prod ger regionflöde < 200 kB |
| **2. App-MVP** | vadkul-app-repot, karta + flöde + eventkort + deep links (`/e/`-slugs via `packages/core`) | intern TestFlight |
| **3. Konton** | auth i app, stjärnor/påminnelser/user-events via API, push-tokens | funktionsparitet med inloggad webb (minus boost) |
| **4. Lansering** | butiksmaterial, granskning, mejlet "ditt event är ute → boosta på webben" | live i App Store + Play |
| **5. Webbmigrering** | web-services → API:t, callables pensioneras | lågprio, städfas |

Fas 0–1 är rena PR:ar i det här repot och kan börja direkt. App-repot skapas i fas 2.

---

## 8. Öppna frågor (avgörs innan respektive fas)

1. **Mapbox-kostnad i app** — mobile SDK har egen prissättning (MAU-baserad); räkna på
   det innan fas 2, annars MapLibre + egna tiles som fallback.
2. **GitHub Packages vs. enklare delning** — om privat npm känns tungt för en person:
   alternativet är att appen vendorerar en genererad klient från OpenAPI-specen.
   Beslut i fas 0.
3. **Domän:** `api.vadkul.se` som eget Hosting-site eller rewrite på huvudsajten.
4. **Android-push-nivå** — bara FCM via Expo, eller notifee för rikare notiser. Fas 3.
