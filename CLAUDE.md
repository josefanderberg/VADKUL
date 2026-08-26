# VADKUL

Eventkarta för Sverige — skrapade + användarskapade event på en Mapbox-karta.

## Struktur

- `apps/web` — Next.js-appen (kartan, stadssidor, outreach-konsolen). Deployas till Firebase Hosting.
- `apps/scraper` — event-pipelinen: skrapning → Firestore (`linkEvents`) → lokal SQLite-spegel (`events.db`) → aggregat-JSON:er i `apps/web/public/`.
- `apps/functions` — Cloud Functions (boost, notiser, digest).
- `infra/launchd` — schemalagda jobb (nattkedjan 00:30, digest 07:00, audit-daemon).
- `docs/` — arbetsdokument per område.

## Två maskiner, en main

- **MacBook Pro (josefanderberg)** äger frontend-arbetet.
- **Mac mini (user "ai", klon `~/Repos/VADKUL`)** äger backend/pipelinen och kör nattkedjan (`apps/scraper/scripts/run-daily.sh`). Den pushar nattens data med hård whitelist (aggregat-JSON:er + FB-watchlist) — aldrig kod. GitHub Actions `deploy.yml` ignorerar de datafilerna.
- Okommitterat arbete + minins nattliga pull/push = känd konfliktkälla. Committa färdigt arbete samma dag.

## Hårda regler

- **Deploya aldrig oombedd.** På uttrycklig begäran: följ skillen `.claude/skills/deploy/SKILL.md`.
- **Starta aldrig en andra dev-server** — delad `.next` korrumperas. Kolla `lsof -i :3000` först. Se `.claude/skills/dev-miljo/`.
- **Alla skrivningar till `linkEvents` MÅSTE gå via `stamped()`** (`apps/scraper/src/utils/firestoreStamp.ts`) — annars missar den inkrementella SQLite-syncen dokumenten.
- **`url` är primärnyckel i hela pipelinen.** Länklösa event hör hemma på userCreated-spåret.
- **Läs aldrig hela Firestore-kollektioner i nya skript** — läs SQLite-spegeln (`sqliteHelper.ts`) eller använd `count()`-aggregering. Firestore-reads/egress är den största driftkostnaden.
- Kart-/UI-ändringar: läs `.claude/skills/kart-ui/` först — där ligger fastslagna ägarbeslut (borttagna features ska inte tillbaka).
- Pipelineändringar: läs `.claude/skills/pipeline/` först.

## Miljö-gotchas

- Icke-interaktiv shell får gammal node — prefixa: `PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH"`.
- Deploy-nätverksflakighet: `NODE_OPTIONS=--dns-result-order=ipv4first`.
- Konstiga JSON-/curl-fel kan vara full disk — kolla `df -h`.
- **Ta inte bort `overrides.sharp` i `apps/web/package.json`.** Den gäller bara firebase-tools genererade SSR-bundle (firebase-frameworks har optional peer `sharp ^0.32 || ^0.33`, och Nexts egen sharp hoistas annars dit och fäller Cloud Builds `npm ci`). Rotens lockfil påverkas inte — workspace-overrides ignoreras där. Deployerna var röda 23–26/8 av exakt det här.

## Test & verifiering

- Scraper: `cd apps/scraper && npm test` (vitest, 300+ tester).
- Web: `cd apps/web && npm test` (vitest, rena funktioner — inget nät/Firebase i tester) + `npx tsc --noEmit`.
- **Kör alltid berörd apps tester + typecheck efter kodändringar, innan du rapporterar klart.** Ny ren logik (utils/, lib/, React-fria moduler) ska få tester i samma veva.
- `eventShareSlug.test.ts` är ett GULDTEST — går det rött har du brutit alla delade /e/-länkar; backa ändringen i stället för att uppdatera testvärdena.
- CI (`.github/workflows/typecheck.yml`) kör tsc för båda apparna + webbens tester på varje push till main.
- Kod som rör kartan granskas hellre statiskt än via preview (WebGL degraderar vid reload).
