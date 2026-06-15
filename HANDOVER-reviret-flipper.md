# Handover — Reviret / Flipper (geo-läget) i VADKUL

> Skriven 2026-06-15 för nästa AI/utvecklare som tar över. Allt nedan är **otestat i WebGL** (se Gotchas) men `tsc --noEmit` + `next lint` är rena. Koden kompilerar.

## 1. Vad det här är
VADKUL är en svensk event-karta (Next.js + maplibre-gl 5.24, Firestore-backend). Ovanpå kartan finns ett **Flipper/pinball-läge** som har **pivoterat till en "geo-modell"** kallad internt geo-läget. Idén (användarens vision): en rund **glob över hela Sverige**, en liten **geo-förankrad boll** som man **skjuter** (flickar) över kartan, och på sikt **territorium** (Reviret) som bollen målar.

Nästan all kod lever i **`apps/web/src/components/v2/V2Map.tsx`** (~4900 rader). Stödfiler:
- `apps/web/src/lib/reviret.ts` — deterministisk geo-hex-grid + mercator-hjälpare (`lngLatToMerc`/`mercToLngLat` exporterade) + färg per spelare.
- `apps/web/src/services/reviretService.ts` — Firestore-lager för territorium (subscribe/claim).
- `apps/web/src/services/pinballVerifyService.ts` — **läser tillbaka canvas-pixlar** för att verifiera rendering utan att titta (se §6).
- `apps/web/src/app/globals.css` — `.pin-geo-ball` (bollmarkören + pulsring), `.pinball-canvas`.
- `apps/web/src/app/(v2)/page.tsx` — håller `pinballActive` (nu **default `true`**) och flipper-handlers.

## 2. Nuläget — vad som FUNGERAR (enligt användaren: "det funkar")
- **`PIN_GEO_MODE = true`** (modul-konstant överst bland `PIN_*`-konstanterna i V2Map). Är den `false` återfår man den GAMLA frysta-kamera-canvas-pinballen (se §4).
- Flipper är **på som standard** (`pinballActive` startar `true` i page.tsx). Geo-läget sätts upp först när kartan laddat — via en `mapReady`-state som sätts i `map.once('load')` och som ligger i flipper-effektens deps.
- I geo-läget: **globe-projektion**, kameran **inramad + låst till Sverige** (`SWEDEN_BOUNDS`/`SWEDEN_PAN_LIMIT`, `setMaxBounds`/`setMinZoom`), **fri zoom/pan**.
- **Bollen är en `maplibregl.Marker`** (`.pin-geo-ball`) → maplibre håller den på exakt samma lng/lat genom zoom/pan/globe. Den **stannar kvar på samma plats** när man zoomar (kärnkravet).
- **Flytta ⇄ Skjut-toggle** (`pinShootMode`, segmenterad knapp uppe till höger). En separat effekt stänger av `dragPan/scrollZoom` i Skjut-läget så ett drag siktar i stället för att panorera.
- **Skjutande (tween, inte fysik):** i Skjut drar man från bollen och släpper → mål = `mercToLngLat(ballMerc + (ballMerc - dragMerc) * GAIN)` klampat till `SWEDEN_BOUNDS`, sedan animeras markören dit med ease-out (~1.1 s) och `map.setCenter` följer (decelererande "rull"-känsla). `GAIN = 2.2`.
- **"Åk till mig"-knapp** + automatiskt vid start: `navigator.geolocation.getCurrentPosition` → bollen animeras till GPS-positionen.

Hela geo-flödet ligger i **en `if (PIN_GEO_MODE) { ... return cleanup; }`-gren högst upp i flipper-livscykel-effekten** (sök på `═══════════ GEO-LÄGE`). Den early-returnar sin egen cleanup, så den gamla canvas-koden under den är **död** medan flaggan är på.

## 3. ÅTERSTÅENDE — användarens begärda nästa steg (prioriterat)
1. **Sikt-linjens offset (DELVIS FIXAT — verifiera):** användaren rapporterade att "sträcket" när man skjuter hamnade uppe i högra hörnet (helt offset), MEN själva skottet stämmer (`unproject` är rätt). Orsak: canvasens backing-storlek/transform matchade inte CSS-px från `map.project`. Jag la in en robust fix i rAF-loopen (synkar `canvas.width` mot `canvas.clientWidth*dpr` varje frame och skalar med den exakta kvoten `canvas.width/canvas.clientWidth`). **Verifiera att linjen nu följer boll→finger.** Om den fortfarande är fel: kontrollera att overlay-canvasen (`pinCanvasRef`) och kart-containern (`mapContainerRef`) verkligen delar origin (båda `absolute inset-0` i z-0-roten på rad ~3784) — annars måste `aimFrom` (från `map.project`) konverteras via `getBoundingClientRect`-offset mellan dem.
2. **Flytta Flytta/Skjut-knapparna till HÖGER OM HJÄRTAT.** Hjärtat = "Sparade event"-knappen i `FloatingNavbar.tsx` (~rad 132–150, vänsterklustret efter profilen). Toggle-knapparna bor idag i V2Maps geo-HUD (uppe till höger, sök på `Flytta ⇄ Skjut-toggle`). För att lägga dem i navbaren bredvid hjärtat behöver `pinShootMode`-state **lyftas upp** (t.ex. till page.tsx) och skickas som props till både V2Map och FloatingNavbar — ELLER så positioneras V2Maps HUD så den visuellt ligger i linje med navbaren. Rekommendation: lyft state till page.tsx (renderar redan både V2Map och FloatingNavbar).
3. **Gör brickorna RUNDA.** Event-markörerna renderas i geo-läget via kartans vanliga väg. DOM-brickorna (`.pin-bubble` i den stora `<style>`-blocken i V2Map, + `globals.css`) är droppformade nål-brickor (se minnet `map-markers-keep-brickor`). Användaren vill ha **runda** (cirkulära) bumprar för pinball-känslan. Sannolikt en CSS-ändring av bubbel-formen + ta bort nålen, men **bekräfta med användaren** eftersom de tidigare uttryckligen ville ha brickan kvar bakom emojin — detta gäller troligen bara flipper-läget, så överväg en flipper-specifik markörstil.
4. **Kollision vid skott:** "om vi skjuter så krockar vi med dem" — bollen ska kollidera med event-brickorna (öppna eventet och/eller studsa). Detta är den STÖRSTA uppgiften: nuvarande skott är en rak tween utan kollision. För riktig kollision behövs fysik i **geo/mercator-rummet** (inte skärm-px, eftersom kameran är fri): integrera bollens mercator-position med friktion, testa varje frame mot event-positionernas mercator-koord (radie i meter), och vid träff anropa `onPinballHit(group)` (öppnar eventet, finns redan) och/eller studsa. `reviret.ts` har redan `lngLatToMerc`/`mercToLngLat`. Bygg vidare på tween-loopen i geo-grenen. När kollision finns är nästa naturliga steg att återinföra **Reviret-territoriet** (måla geo-hex längs skott-banan via `lngLatToCell`).

## 4. Den gamla (frysta) canvas-pinballen — fortfarande i koden
Bakom `PIN_GEO_MODE === false` finns hela den tidigare implementationen: fryst kamera, fysik i skärm-px (`stepPinball`, `PIN_DT_FIX`), metaball-bubblor, slangbella, Reviret-målning på canvas, ett inställningsverktyg (palett-knapp) + verifierings-HUD, samt en Flytta-mellan-skott-navigering (`pan-mellan-skott`, `pinReprojectBumpers`, Översikt/Spelyta-toggle). **Allt detta är inaktivt** men intakt. Om geo-modellen ratas kan man flippa tillbaka. Annars kan stora delar av den döda koden så småningom städas bort (men spar `stepPinball`/metaball som referens för §3.4-kollisionen).

## 5. Reviret-territoriet (Firestore) — byggt men inaktivt i geo-läget
`territory/{cellId}` = `{owner, color, region, claimedAt}`. `reviretService.ts` har `subscribeTerritory` (lyssnar på vyns `region`-buckets, max 30), `claimCells` (writeBatch). Säkerhetsregel #12 finns i `infra/firebase/firestore.rules` (publik läsning; inloggad claimar sig själv som ägare). **Reglerna måste deployas manuellt** innan det funkar live: `firebase deploy --only firestore:rules`. I geo-läget körs INGEN territorie-prenumeration än (den låg i den frysta canvas-vägen). Återinför i §3.4.

## 6. Hur man VERIFIERAR utan att lita på ögat
WebGL-previewen är flaky och degraderar vid reload (användaren föredrar statisk granskning). MEN: pinball-canvasen är en **vanlig 2D-canvas** → `pinballVerifyService.ts` kan läsa tillbaka pixlar. I konsolen (eller via preview_eval):
```js
window.__pinballVerifyCenter('#rrggbb')  // → { match, actual, expected, distance }
window.__pinballSampleCenter()           // → { r,g,b,a,hex }
```
(I den frysta canvas-läget finns även ett "Utseende"-verktyg som ritar en solid testboll i mitten. I geo-läget ritar canvasen bara sikt-linjen, så verifieringen är mest relevant där canvasen faktiskt ritar.)

## 7. Gotchas / miljö
- **Node:** icke-interaktiv Bash får node v11 → prefixa `PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH"`. (nvm-default ÄR v22.22.0 sedan 2026-06-10, så interaktivt funkar `node`/`npm` rakt av.)
- **Typecheck:** `cd apps/web && npx --no-install tsc --noEmit`. Bruset `error TS6053 ... .next/types ...` är stale glob — ignorera; filtrera `grep -v TS6053`.
- **Lint:** `react-hooks/refs`-felen (`xRef.current = x` under render) är filens etablerade idiom (~78 st) — inte nya. Bygget gatar inte på lint/ts (`next.config` har `ignoreDuringBuilds`/`ignoreBuildErrors`).
- **Deploy är MANUELL:** `npm run build && firebase deploy` (node v22). `deploy.yml` är trasig (saknar GH-secrets). Webben är strippad till map-only statiska routes.
- **maplibre globe:** `map.setProjection({type:'globe'})` (5.24). Allt globe/bounds är `try/catch`:at så det inte kraschar default-på-laddningen.
- **Koordinatsystem (viktigt för §3):** `map.project(lnglat)` ger CSS-px relativt kart-containern; `map.unproject([x,y])` tar samma. Overlay-canvasen och kart-containern delar origin (båda `absolute inset-0` i samma rot). DPR hanteras genom `setTransform` med kvoten `canvas.width/canvas.clientWidth`.

## 8. Relevanta minnesnoteringar
Det finns auto-minne i `~/.claude/projects/-Users-josefanderberg-source-VADKUL/memory/` — särskilt `pinball-flipper-mode.md` (full historik inkl. denna pivot), `reviret-territory-game.md`, `preview-flaky-review-statically.md`, `map-markers-keep-brickor.md`, `v2-map-ui-stripdown.md`, `vadkul-improvement-roadmap.md`.

---
**TL;DR för nästa AI:** Geo-läget (glob över Sverige + geo-förankrad boll + tween-skott) funkar och är default-på bakom `PIN_GEO_MODE`. Fyra TODO i prioritet: (1) verifiera sikt-linje-fixen, (2) flytta Flytta/Skjut-knapparna till höger om hjärtat (lyft `pinShootMode` till page.tsx), (3) runda flipper-brickor (bekräfta scope), (4) **skott-kollision mot event i geo/mercator-rummet** (största jobbet; återinför sedan Reviret-territoriet längs banan).
