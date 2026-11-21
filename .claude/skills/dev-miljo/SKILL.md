---
name: dev-miljo
description: Köra och felsöka VADKUL:s dev-miljö — dev-servern på port 3000, korrupt .next-cache, node-version i skript, full disk. Använd ALLTID denna skill innan en dev-server startas, när något ska verifieras i webbläsaren, när bygget/servern beter sig konstigt (markörer på fel plats, oförklarliga JSON-/nätverksfel), eller när node-kommandon failar i skript.
---

# Dev-miljön

## Dev-servern: starta aldrig en andra

Josefs egen dev-server kör på port 3000. Starta **aldrig** en till - de delar `.next` och cachen korrumperas. Detta har hänt på riktigt och kostar timmar. Sedan 21/11 2026 stoppar `scripts/dev-guard.sh` en andra start (se symptomlexikonet), men kolla ändå `lsof -i :3000` först.

Verifiera hellre ändringar genom **statisk kodläsning** än via preview: kart-WebGL:en degraderar vid reload i preview, så det Josef föredrar är kodgranskning framför en snurrande dev-server.

Behöver miljön nollställas finns `npm run dev:reset` (kör `scripts/dev-reset.sh`; `dev:check` för torrkörning).

## Symptomlexikon

- **Markörer utanför Sverige som rör sig vid zoom** = korrupt `.next`-cache. Döda alla dev-servrar, `rm -rf apps/web/.next`, starta om.
- **Kartan fastnar på "Laddar event…", event-API:t svarar 500 med `Cannot find module './vendor-chunks/@opentelemetry.js'` och `main-app.js` ger 404** = filerna i `.next` har försvunnit under en server som kör (21/11 2026, #269). Själva sidan svarar fortfarande 200, så det ser ut som ett datafel. Orsaken: `next dev` TÖMMER hela `apps/web/.next` utom `cache/` i samma stund som den startar, så en andra start drar undan filerna för den första - även om den andra hamnar på en annan port eller stängs direkt. Det är samma sak som ligger bakom "starta aldrig en andra". Laga: stoppa servern, `rm -rf apps/web/.next`, starta om. Vakten `scripts/dev-guard.sh` (predev i apps/web/package.json och i `.claude/launch.json`) vägrar numera starta en andra server och säger vilken port som redan kör. `npm run dev:reset` går förbi vakten med flit - den dödar de gamla först. (Vem som startade den andra servern 21/11 är inte utrett.)
- **curl exit 23 eller oförklarliga JSON-fel** = ofta full disk. Kör `df -h` FÖRE du börjar felsöka koden.
- **node-kommandon failar konstigt i skript** = non-interactive bash får node **v11**. Prefixa: `PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"`.

## Samarbete med Josef

Josef live-editar ofta i VS Code. Om du redigerar en fil han kan ha öppen: säg till så han laddar om filen innan han fortsätter, annars skriver hans editor över din ändring.
