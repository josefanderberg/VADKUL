---
name: dev-miljo
description: Köra och felsöka VADKUL:s dev-miljö — dev-servern på port 3000, korrupt .next-cache, node-version i skript, full disk. Använd ALLTID denna skill innan en dev-server startas, när något ska verifieras i webbläsaren, när bygget/servern beter sig konstigt (markörer på fel plats, oförklarliga JSON-/nätverksfel), eller när node-kommandon failar i skript.
---

# Dev-miljön

## Dev-servern: starta aldrig en andra

Josefs egen dev-server kör på port 3000. Starta **aldrig** en till — de delar `.next` och cachen korrumperas. Detta har hänt på riktigt och kostar timmar.

Verifiera hellre ändringar genom **statisk kodläsning** än via preview: kart-WebGL:en degraderar vid reload i preview, så det Josef föredrar är kodgranskning framför en snurrande dev-server.

Behöver miljön nollställas finns `npm run dev:reset` (kör `scripts/dev-reset.sh`; `dev:check` för torrkörning).

## Symptomlexikon

- **Markörer utanför Sverige som rör sig vid zoom** = korrupt `.next`-cache. Döda alla dev-servrar, `rm -rf apps/web/.next`, starta om.
- **curl exit 23 eller oförklarliga JSON-fel** = ofta full disk. Kör `df -h` FÖRE du börjar felsöka koden.
- **node-kommandon failar konstigt i skript** = non-interactive bash får node **v11**. Prefixa: `PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH"`.

## Samarbete med Josef

Josef live-editar ofta i VS Code. Om du redigerar en fil han kan ha öppen: säg till så han laddar om filen innan han fortsätter, annars skriver hans editor över din ändring.
