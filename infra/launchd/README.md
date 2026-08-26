# launchd-jobb (macOS)

Bakgrundsjobb för VADKUL-scrapern på Mac Mini:n.

## se.vadkul.scraper.nightly

DET ENDA scrape-jobbet (sedan 2026-06-12). Startar 00:30 och kör hela kedjan
sekventiellt — inga fler fasta tider för delsteg, varje steg startar när
föregående är klart:

1. **Cleanup** — `cleanup-old` (Firestore) + `prune-old` (SQLite)
2. **Scrape** (`npm run start` → `index.ts`) — Facebook FÖRST (volatilast),
   direkt `aggregate` så FB är live, sedan bespoke-scrapers och till sist
   Sources enligt hash-fas-schemat i `schedule.ts` (~85–95 källor/natt,
   jämnt fördelat — inga tomma nätter, inga peak-nätter)
3. **Post-pipeline en gång** — hide-foreign → hide-junk → fix-times (klockslag
   för midnatts-platshållare) → dedupe-cross → geo-refine (exakta adresser för
   stadscentrum-klumpade event) → storage-sync → image-migrate → llm-enrich →
   AI-audit → re-aggregate
4. **Stats + Teams-rapporter**

Ersätter de gamla jobben `se.vadkul.scraper.today` (00:30) och
`se.vadkul.scraper.full` (02:30), som körde post-pipelinen dubbelt varje natt
och överlappade varandras Puppeteer/Ollama-användning. Gamla plists ligger
kvar som `.bak-*` i `~/Library/LaunchAgents/`.

### Installera

```sh
cp infra/launchd/se.vadkul.scraper.nightly.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/se.vadkul.scraper.nightly.plist
launchctl list | grep vadkul.scraper
```

### Köra manuellt / felsöka

```sh
launchctl kickstart gui/$(id -u)/se.vadkul.scraper.nightly   # kör nu
tail -f ~/Library/Logs/vadkul-scraper/nightly.log            # kedjans logg
```

## se.vadkul.digest-daily — AVVECKLAD 2026-08-26

Jobbet (07:00: bygg dagens 10-lista → Telegram-utkast → auto-publicera till
Instagram-karusell + Facebook) är **borttaget på ägarens begäran**. Listorna
drog inget engagemang, och morgonutkastet i Telegram fyllde ingen funktion.
`--auto`-läget är borta ur `publish-digest.ts` och plisten är avinstallerad
(`~/Library/LaunchAgents/se.vadkul.digest-daily.plist.disabled-20260826`).

Det manuella `/list10` (bot-daemon → `npm run digest`) finns kvar för ad
hoc-listor med `byt`/`bild`/`klar` — inget publiceras utan att någon svarar
"klar". Torrkörning utan Telegram/IG/FB:

```sh
cd apps/scraper && npm run digest -- --dry
```

Återinför inte automatiken utan att fråga ägaren.

## se.vadkul.ig-queue

Stadsinläggens **Instagram-tvillingar**. Kör varje hel timme 06–21 och
publicerar det som förfallit i IG-kön (`apps/scraper/ig-queue.json`).

Varför ett eget jobb: Facebooks Graph API kan schemalägga sidinlägg,
Instagrams Content Publishing API kan inte schemalägga alls — bara
"publicera nu". Kön + det här jobbet ÄR schemaläggningen för IG.
`schedule-city-posts.ts --commit` schemalägger FB-inlägget hos Meta och
lägger IG-versionen i kön; jobbet tömmer den.

En post som blivit mer än 6 timmar gammal publiceras inte utan markeras
`förfallen` — ett veckoinlägg ska inte trilla ut ett dygn försent. Jobbet
skapar aldrig nya inlägg, det tömmer bara kön.

### Installera

```sh
cp infra/launchd/se.vadkul.ig-queue.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/se.vadkul.ig-queue.plist
launchctl list | grep vadkul.ig
```

### Köra manuellt / felsöka

```sh
cd apps/scraper
npm run ig-ko                                    # visa kön
npm run ig-ko -- --kolla                         # behörigheter + IG-koppling
npm run ig-ko -- --importera-fb-schema           # dry-run: vad skulle läggas till
npm run ig-ko -- --importera-fb-schema --commit  # fyll kön ur FB:s schemakö
npm run ig-ko -- --provkör                       # bild + IG-container, publicerar INTE
tail -f ~/Library/Logs/vadkul-scraper/ig-queue.log
```

`--provkör` är vägen att verifiera behörigheter och bildformat utan att
något hamnar i flödet: den bygger bilden, laddar upp den och skapar en
IG-container — men hoppar över `media_publish`, så containern förfaller av
sig själv efter 24 h.

⚠️ **Kräver att FB_PAGE_TOKEN har `instagram_basic` +
`instagram_content_publish`.** Saknas de svarar Meta `(#10) Application does
not have permission for this action` och inget går ut på Instagram — se
`docs/outreach/instagram-behorigheter.md`.

## se.vadkul.audit-pending

Kontinuerlig daemon som auditerar dagens-och-framåt events som ännu inte
klassats med nya taxonomin (`aiVerdict IS NULL` eller `emoji IS NULL`):
sätter verdict + kategori + emoji + pris via `auditEvent()`, auto-hider junk,
och kör `aggregate-events` efter varje batch så JSON + Firestore uppdateras live.

Källa: `apps/scraper/src/scripts/audit-pending-daemon.ts` (`npm run audit-daemon`).

### Installera

```sh
# 1. Kopiera plisten till LaunchAgents
cp infra/launchd/se.vadkul.audit-pending.plist ~/Library/LaunchAgents/

# 2. Ladda + starta (RunAtLoad startar den direkt)
launchctl load ~/Library/LaunchAgents/se.vadkul.audit-pending.plist

# 3. Verifiera att den kör
launchctl list | grep vadkul.audit-pending
tail -f ~/Library/Logs/vadkul-audit-pending.out.log
```

### Avinstallera / stoppa

```sh
launchctl unload ~/Library/LaunchAgents/se.vadkul.audit-pending.plist
rm ~/Library/LaunchAgents/se.vadkul.audit-pending.plist
```

### Starta om efter kodändring

```sh
launchctl kickstart -k gui/$(id -u)/se.vadkul.audit-pending
```

### Obs

- Sökvägarna i plisten antar repot på `/Users/ai/Repos/VADKUL`. Justera vid behov.
- Kräver att Ollama kör (`ollama serve`); daemonen väntar 60 s och försöker
  igen om Ollama är nere — den dör inte.
- `KeepAlive: true` → launchd startar om processen om den kraschar.
- Manuell körning utan launchd: `cd apps/scraper && npm run audit-daemon`
  (lägg till `--max-batches=1` för en enda batch).
