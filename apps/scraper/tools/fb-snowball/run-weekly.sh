#!/bin/bash
# FB-snöbollens veckokörning (launchd: se.vadkul.fb-snowball, måndagar 09:00).
#
# Kedjan: snowball (arrangörssidor + seed-fil) → probe (verifiera /events)
# → generate (regenerera watchlist-national.ts) → tsc-vakt.
#
# OBS: regenererar KÄLLKOD (watchlist-national.ts) i working tree utan commit —
# ts-node läser källan färskt varje natt, så ändringen är live direkt.
# Failar typkollen rullas filen tillbaka (git checkout) och felet loggas.

set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$DIR/../../../.." && pwd)"
LOG_DIR="$HOME/Library/Logs/vadkul-scraper"
LOG_FILE="$LOG_DIR/fb-snowball.log"
WATCHLIST="$REPO/apps/scraper/src/scrapers/facebook/watchlist-national.ts"

mkdir -p "$LOG_DIR"
{
    echo "=========================================="
    echo "FB-snöboll veckokörning — $(date '+%Y-%m-%d %H:%M:%S')"
    echo "=========================================="
} > "$LOG_FILE"

cd "$DIR" || { echo "❌ cd $DIR misslyckades" >> "$LOG_FILE"; exit 1; }

run_step() {
    local name="$1"; shift
    echo "--- $name ---" >> "$LOG_FILE"
    if "$@" >> "$LOG_FILE" 2>&1; then
        echo "✅ $name klart" >> "$LOG_FILE"
    else
        echo "❌ $name misslyckades — avbryter kedjan" >> "$LOG_FILE"
        exit 1
    fi
}

run_step "snowball (sid-slugs + seed-fil)" node snowball.cjs
run_step "probe (verifiera /events-flikar)" node probe-national.cjs
run_step "generate (watchlist-national.ts)" node generate-watchlist.cjs

echo "--- tsc-vakt ---" >> "$LOG_FILE"
cd "$REPO/apps/scraper" || exit 1
if npx tsc --noEmit >> "$LOG_FILE" 2>&1; then
    echo "✅ typkoll ok — ny watchlist live från nästa nattkörning" >> "$LOG_FILE"
    grep -c "slug:" "$WATCHLIST" | xargs -I{} echo "📄 watchlist-national: {} poster" >> "$LOG_FILE"
else
    echo "❌ typkollen failade — rullar tillbaka watchlist-national.ts" >> "$LOG_FILE"
    git -C "$REPO" checkout -- "$WATCHLIST" >> "$LOG_FILE" 2>&1
    exit 1
fi

echo "🎉 Klart $(date '+%H:%M:%S')" >> "$LOG_FILE"
