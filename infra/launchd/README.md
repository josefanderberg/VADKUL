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
