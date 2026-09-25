# vadkul-app: bootstrap-recept (fas 2)

Exekverbart recept för att skapa app-repot — skrivet i förväg (25/9) så fas 2
börjar med att göra, inte utreda. Förutsätter att PR:en med fas 0–1 är mergad
och att kontraktsfrågan (plan §9.1) är avgjord. Versioner pinnas vid
utförandet — ta senaste stabila Expo SDK då, inte det som råkar stå här.

## 1. Skapa repot

```bash
cd ~/VADKUL                       # mappen är redan git-ignorerad i huvudrepot
npx create-expo-app@latest vadkul-app --template default   # TS + expo-router
cd vadkul-app && git init && git add -A && git commit -m "Expo-skelettet"
# GitHub: skapa PRIVAT repo josefanderberg/vadkul-app, sätt remote, pusha.
```

## 2. Kärnberoenden

```bash
npx expo install @maplibre/maplibre-react-native        # kartan — INTE Mapbox
npx expo install @react-native-firebase/app @react-native-firebase/auth \
                 @react-native-firebase/messaging       # auth + push (fas 3)
npm i @tanstack/react-query zod
npm i @vadkul/kontrakt            # enligt beslutet i plan §9.1
npm i -D typescript vitest
```

Native-moduler ⇒ **EAS dev build, aldrig Expo Go**:
`npx eas build --profile development --platform ios` (kräver EAS-konto +
Apple Developer). `eas.json`: `development` / `preview` / `production`.

## 3. Struktur (plan §6)

```
app/                    expo-router-skärmar
├─ (karta)/index.tsx    kartan + eventkortet — MVP:ns hem
├─ event/[slug].tsx     djuplänkar /e/<slug> (slug ur @vadkul/kontrakt!)
└─ profil/              fas 3
src/
├─ features/            flöde · favoriter · push
├─ api/                 klient mot CDN-flödet (fas 2) + /v1 (fas 3)
└─ ui/                  delade komponenter
```

## 4. Dataflödet i MVP:n

- Regionflöde: `GET https://vadkul.se/api/events/app-<region>` —
  `AppFeedPayload` ur `@vadkul/kontrakt`. Regionval: enhetens position →
  närmaste stad (samma CITIES-tänk som webben); fallback: fråga användaren.
- TanStack Query + persist (AsyncStorage) = offline-favoriterna gratis.
- Beskrivning per event: samma väg som webben (`/api/event`-uppslaget via
  slug). Ingen Firestore-SDK i appen — allt via HTTPS (plan §6).
- Djuplänkar: `vadkul.se/e/<slug>` ska öppna appen → AASA + assetlinks.json
  läggs i webbens `public/.well-known/` NÄR bundle-id/team-id finns
  (Apple: `applinks:`, Android: sha256-fingeravtryck från EAS credentials).

## 5. CLAUDE.md för app-repot (utkast — kopiera in)

```markdown
# vadkul-app

React Native/Expo-appen för VADKUL. Huvudrepot (VADKUL) äger pipelinen,
webben och API:t — det här repot äger BARA appen.

## Hårda regler
- **APPEN SÄLJER INGENTING.** Ingen boost-knapp, inga priser, ingen länk
  till köp, ordet "boost" förekommer inte i UI:t. Betalningar sker på
  webben (Apples IAP-regler — se huvudrepots docs/app-plattform-plan.md).
- **Ingen Firestore/firebase-js-SDK.** Data via CDN-flödet + /v1-API:t.
  Auth/push via @react-native-firebase.
- **Kartbeslut ärvs från huvudrepots `.claude/skills/kart-ui/`** — borttagna
  features återuppstår inte i appen.
- **@vadkul/kontrakt är sanningen** för typer, kategori-nycklar och
  eventShareSlug. Definiera aldrig egna kopior.
- EAS dev build, aldrig Expo Go (native-moduler).

## Test & verifiering
- `npm test` (vitest, ren logik) + `npx tsc --noEmit` före varje rapport.
- Sekretess: inga tokens i AsyncStorage — expo-secure-store.
```

## 6. Ordning i fas 2

1. Recept §1–2, tom karta renderar i dev build (MapLibre + nöjesfältsstilen —
   stil-URL:en/transformen delas från webben, se `v2MapBaseStyles`).
2. Regionflödet in: brickor på kartan + enkel lista.
3. Eventkort + utlänk (id ÄR länken; `url` bara när flödet skickar den).
4. Djuplänkarna + AASA/assetlinks i webben (egen liten PR i huvudrepot).
5. Intern TestFlight → först då är fas 2 "klar" enligt planen §7.
