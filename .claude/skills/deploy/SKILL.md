---
name: deploy
description: Deploya VADKUL till produktion (Firebase hosting, functions, Firestore rules). Använd ALLTID denna skill när något ska deployas, byggas för produktion, när "firebase deploy" nämns, när rules ska ut, eller när en deploy failat/timat ut — även om ordet "deploy" inte används ("lägg ut det", "pusha live", "få ut fixen").
---

# Deploy VADKUL

**Hosting deployas via GitHub Actions** — `deploy.yml` är lagad sedan 26/8 och triggas av varje push till main som rör webbkod (plus morgon-cron 06:00 UTC). Actionen tar BARA hosting; functions och Firestore rules deployas alltid för hand, lokalt.

Deploya aldrig oombedd — men när Josef **ber** om en deploy ska du köra **hela kedjan själv**: commit → build → deploy → verifiera. Han ber ofta från mobilen utan tillgång till VS Code eller terminal, så be honom aldrig "köra ett kommando" eller "committa först" — allt lokalt är ditt jobb.

## Remote-deploy (Josef på mobilen)

När deploy-begäran kommer utan att Josef sitter vid datorn:

1. `git status` — se vad som ligger okommittat. Committa det som hör till det han vill ha ut (atomära pathspec-commits, inte `git add -A` rakt av). Nämn i svaret om orelaterade okommittade filer lämnas kvar.
2. Döda dev-servrar, kör build + deploy enligt standardflödet nedan.
3. Vid timeout: kör om (se Felhantering) innan du rapporterar rött.
4. Rapportera ärligt vad som gick ut och vad som inte gjorde det — han kan inte själv kolla terminalen.

Deployen måste köras på en maskin med firebase-inloggning (den här Macen eller minin) — en cloud-session utan de credentialsen kan inte deploya, bara förbereda och pusha.

## Standardflöde (hosting)

1. Verifiera lokalt först: `npm run build` (med PATH-prefixet nedan) + tester + tsc.
2. Committa och `git push origin main`.
3. Följ deployen: `gh run list --workflow=deploy.yml --limit 1` → `gh run watch <id> --exit-status`.

**Kör INTE lokal `firebase deploy --only hosting`** — den failar sedan 28/8 på sharp-lock-osynk i den genererade SSR-bundlen ("Missing: sharp@0.33.5 from lock file" i Cloud Builds npm ci). Actions-vägen är grön; felsök inte den lokala.

Varför prefixen (gäller alla lokala node-/firebase-kommandon):
- Non-interactive bash får gammal node via nvm — prefixa `PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH"`.
- `NODE_OPTIONS=--dns-result-order=ipv4first` fixar återkommande nätverksflakighet mot Firebase.

**GOTCHA (upptäckt 31/8): aggregat-JSON:erna i repot deployas INTE rakt av.** Deploy-workflown skriver över `events-*.json` med färsk data från `https://vadkul.se/api/events/<layer>` (= Firestores `aggregatedEvents`) före bygget. Datafixar måste alltså nå **Firestore** (kör `npm run aggregate`, som laddar upp) — och Mac minins audit-daemon (`se.vadkul.audit-pending`) skriver `aggregatedEvents` efter varje audit-batch med den kod den hade **när processen startade**. Efter pipelineändringar som påverkar aggregatet: starta om daemonen på minin (`launchctl kickstart -k gui/$(id -u)/se.vadkul.audit-pending`, efter git pull), annars vinner den gamla koden inom minuter.

Före push:
- **Döda alla dev-servrar** om du bygger lokalt (kolla `lsof -i :3000` OCH `ps aux | grep -E "next dev|next-server"` — servern kan stå på en annan port, t.ex. 3001) — en levande dev-server kan skriva i `.next` under bygget, och `npm run build` kör `rm -rf .next` som slår undan fötterna på den.
- **GOTCHA (2/9): `kill` från Claude Codes sandlådade Bash BITER INTE på Josefs dev-server** (processen lever kvar, inget fel visas). Verifiera med `ps -p <pid>` efteråt; behövs det, kör kill-kommandot med `dangerouslyDisableSandbox: true`. Bygg aldrig vidare i tron att servern är nere.
- **Committa allt som ska med.** Mac minin pullar main nattligen — okommitterat arbete är konfliktkällan.

## Felhantering

- Röd Actions-körning: läs loggen med `gh run view <id> --log-failed` innan omkörning.
- "timed out" på `ssrvadkulf2cb2` (functions-deployer) kan vara **falskt** — kör om innan du felsöker något annat.
- En halvfailad deploy (hosting ute men inte rules/functions, eller tvärtom) är ett farligt blandläge — kör om tills allt är grönt, lämna aldrig halvvägs.

## Functions och rules

- `firebase deploy --only functions` respektive `--only firestore:rules` — körs separat och manuellt.
- **VARNING innan rules-deploy:** `firestore.rules` i repot bär ofta ändringar för features som ännu inte är deployade (flera features har historiskt väntat på rules-deploy). Läs igenom diffen mot vad som är live och bekräfta med Josef att allt i filen får gå ut.
- Functions har en egen KOPIA av `eventShareSlug`-logiken — om slug-logiken ändrats i webben måste kopian i functions synkas före functions-deploy.

## Functions via Actions (25/9)

`firebase deploy --only functions` kan numera också köras via workflown
**`deploy-functions.yml`** (workflow_dispatch — Actions-fliken eller API:t):
samma servicekonto (`secrets.FIREBASE_SERVICE_ACCOUNT`) och firebase-tools-
version som hosting-deployen. En cloud-session utan lokala credentials
deployar functions genom att trigga den. Rules deployas FORTFARANDE bara
för hand, med diffgranskningen ovan.
