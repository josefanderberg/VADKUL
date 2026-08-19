#!/bin/bash
# Webb-snöbollens veckokörning (launchd: se.vadkul.web-snowball, tisdagar 09:00).
#
# Kedjan (allt i src/scripts/web-snowball.ts): skörda kandidat-domäner ur
# eventdatan → bulk-probe → smoke-test med rimlighetskontroller → skriv
# godkända till src/sources/registry-snowball.ts (status experimental) + tsc-vakt.
#
# OBS: regenererar KÄLLKOD (registry-snowball.ts) i working tree utan commit —
# ts-node läser källan färskt varje natt, så nya källor är live från nästa
# nattkörning. Nattjobbet committar filen (whitelistad i run-daily.sh).
# Failar typkollen rullar web-snowball.ts själv tillbaka filen.

set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
SCRAPER="$(cd "$DIR/../.." && pwd)"
LOG_DIR="$HOME/Library/Logs/vadkul-scraper"
LOG_FILE="$LOG_DIR/web-snowball.log"

mkdir -p "$LOG_DIR"
{
    echo "=========================================="
    echo "Webb-snöboll veckokörning — $(date '+%Y-%m-%d %H:%M:%S')"
    echo "=========================================="
} > "$LOG_FILE"

cd "$SCRAPER" || { echo "❌ cd $SCRAPER misslyckades" >> "$LOG_FILE"; exit 1; }

if npm run web-snowball >> "$LOG_FILE" 2>&1; then
    echo "🎉 Klart $(date '+%H:%M:%S')" >> "$LOG_FILE"
else
    echo "❌ web-snowball misslyckades ($(date '+%H:%M:%S')) — se ovan." >> "$LOG_FILE"
    exit 1
fi
