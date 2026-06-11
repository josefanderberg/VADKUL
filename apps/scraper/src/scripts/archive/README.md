# Arkiv — färdigkörda engångsscript

Script som gjort sitt: daterade migrationer, engångs-backfills och utforsknings-
verktyg som inte längre refereras av `package.json`, `run-daily.sh` eller annan kod.

De ligger kvar (istället för att raderas) som mönsterbibliotek — nästa backfill/
migration börjar ofta som copy-paste av en gammal. Flytta ALDRIG hit något som
refereras av pipelinen; kör `grep -rn "<filnamn>" ..` innan.

Mappen är exkluderad från tsconfig (typecheckas inte). Importvägarna är medvetet
kvar relativa till `src/scripts/` — kopiera tillbaka dit innan körning, så stämmer de.

Levande verktyg som AVSIKTLIGT bor kvar i `src/scripts/` trots att de saknar
npm-script (radera inte):

- `dedupe-cross-source.ts` — ska kopplas in i nattjobbet (deferred tuning-plan)
- `bot-daemon.ts` — Telegram-daemon (launchd)
- `probe-jsonld.ts`, `probe-xhr.ts` — refereras av rediscoverCommand i fieldMaps/playbooks
- `hide-source-events.ts` — källkurerings-verktyg (användes mot Nalen/Katalin 2026-06-09)
- `import-sitemap-hits.ts` — discovery-flödets kandidat-import
- `test-sitemap-extract.ts` — manuellt testverktyg för sitemap-motorn
