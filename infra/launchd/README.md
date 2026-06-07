# launchd-jobb (macOS)

Bakgrundsjobb för VADKUL-scrapern på Mac Mini:n.

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
