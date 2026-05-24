#!/usr/bin/env bash
# Daglig wrapper för VADKUL-scrapern.
#
# Användning:
#   run-daily.sh <jobname> <npm-script> [--with-cleanup]
#
# Exempel:
#   run-daily.sh today today --with-cleanup     # Cleanup + today-scrapern
#   run-daily.sh facebook scrape-fb             # Bara FB (cleanup redan kört)
#
# Förväntar sig:
#   TEAMS_WEBHOOK_URL   — sätts i ~/.vadkul-secrets/env eller via launchd plist
#
# Skriver:
#   ~/Library/Logs/vadkul-scraper/<jobname>.log   (stdout/stderr från jobbet)
#   En POST till Teams med ✅/❌ + duration + extraherade siffror

set -u  # Bråka om odefinierade variabler. Ingen -e — vi vill alltid kunna posta.

JOB_NAME="${1:-unknown}"
NPM_SCRIPT="${2:-}"
WITH_CLEANUP="${3:-}"

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCRAPER_DIR="$REPO_ROOT/scraper"
LOG_DIR="$HOME/Library/Logs/vadkul-scraper"
LOG_FILE="$LOG_DIR/$JOB_NAME.log"
SECRET_FILE="$HOME/.vadkul-secrets/env"

mkdir -p "$LOG_DIR"

# Ladda hemligheter (TEAMS_WEBHOOK_URL m.m.) om filen finns
if [ -f "$SECRET_FILE" ]; then
    # shellcheck disable=SC1090
    set -a; . "$SECRET_FILE"; set +a
fi

START_TS="$(date +%s)"
START_HUMAN="$(date '+%Y-%m-%d %H:%M:%S')"

# Trunkera loggfilen vid varje körning för att hålla den hanterbar
{
    echo "=========================================="
    echo "VADKUL daily run — $JOB_NAME"
    echo "Startad: $START_HUMAN"
    echo "=========================================="
} > "$LOG_FILE"

cd "$SCRAPER_DIR" || {
    echo "❌ Kunde inte cd till $SCRAPER_DIR" >> "$LOG_FILE"
    exit 1
}

# ─── Cleanup (frivilligt) ───────────────────────────────────────────────────
DELETED_COUNT=""
if [ "$WITH_CLEANUP" = "--with-cleanup" ]; then
    echo "" >> "$LOG_FILE"
    echo "── CLEANUP ──" >> "$LOG_FILE"
    if npm run cleanup-old >> "$LOG_FILE" 2>&1; then
        DELETED_COUNT="$(grep -oE '"deleted":[[:space:]]*[0-9]+' "$LOG_FILE" | tail -1 | grep -oE '[0-9]+')"
        echo "Cleanup OK (deleted=$DELETED_COUNT)" >> "$LOG_FILE"
    else
        echo "⚠️ Cleanup misslyckades — fortsätter ändå med scrapern." >> "$LOG_FILE"
    fi
fi

# ─── Scraper ────────────────────────────────────────────────────────────────
echo "" >> "$LOG_FILE"
echo "── SCRAPER: $NPM_SCRIPT ──" >> "$LOG_FILE"

if [ -z "$NPM_SCRIPT" ]; then
    echo "❌ Inget npm-script angivet." >> "$LOG_FILE"
    EXIT_CODE=2
else
    npm run "$NPM_SCRIPT" >> "$LOG_FILE" 2>&1
    EXIT_CODE=$?
fi

END_TS="$(date +%s)"
DURATION=$(( END_TS - START_TS ))

# ─── Plocka ut nyckeltal från loggen ────────────────────────────────────────
SAVED_COUNT="$(grep -cE '✅ Saved:' "$LOG_FILE" || echo 0)"
ERROR_COUNT="$(grep -cE '^❌|kraschade|Error:' "$LOG_FILE" || echo 0)"

# ─── Status ─────────────────────────────────────────────────────────────────
if [ "$EXIT_CODE" -eq 0 ]; then
    STATUS_EMOJI="✅"
    STATUS_TEXT="OK"
    STATUS_COLOR="good"
else
    STATUS_EMOJI="❌"
    STATUS_TEXT="FAIL (exit $EXIT_CODE)"
    STATUS_COLOR="attention"
fi

# ─── Bygg Adaptive Card-payload via python3 (säker JSON-serialisering) ──────
PAYLOAD_FILE="$(mktemp -t vadkul-teams).json"
JOB_NAME="$JOB_NAME" \
STATUS_EMOJI="$STATUS_EMOJI" \
STATUS_TEXT="$STATUS_TEXT" \
STATUS_COLOR="$STATUS_COLOR" \
DURATION="$DURATION" \
DELETED_COUNT="$DELETED_COUNT" \
SAVED_COUNT="$SAVED_COUNT" \
ERROR_COUNT="$ERROR_COUNT" \
LOG_FILE_PATH="$LOG_FILE" \
/usr/bin/python3 - >"$PAYLOAD_FILE" <<'PYEOF'
import os, json

job = os.environ["JOB_NAME"]
emoji = os.environ["STATUS_EMOJI"]
status = os.environ["STATUS_TEXT"]
color = os.environ["STATUS_COLOR"]
duration = os.environ["DURATION"]
deleted = os.environ.get("DELETED_COUNT", "")
saved = os.environ["SAVED_COUNT"]
errors = os.environ["ERROR_COUNT"]

try:
    with open(os.environ["LOG_FILE_PATH"], "r", encoding="utf-8", errors="replace") as f:
        lines = f.readlines()
    tail = "".join(lines[-8:]).rstrip() or "(tom logg)"
except Exception as e:
    tail = f"(kunde inte läsa logg: {e})"

facts = [
    {"title": "Status", "value": f"{emoji} {status}"},
    {"title": "Duration", "value": f"{duration}s"},
]
if deleted:
    facts.append({"title": "Cleanup", "value": f"{deleted} event raderade"})
facts.append({"title": "Sparade event", "value": saved})
facts.append({"title": "Fel i logg", "value": errors})

card = {
    "type": "message",
    "attachments": [{
        "contentType": "application/vnd.microsoft.card.adaptive",
        "content": {
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "type": "AdaptiveCard",
            "version": "1.4",
            "msteams": {"width": "Full"},
            "body": [
                {
                    "type": "TextBlock",
                    "text": f"{emoji} VADKUL daily — {job}",
                    "weight": "Bolder",
                    "size": "Large",
                    "color": color,
                },
                {"type": "FactSet", "facts": facts},
                {
                    "type": "TextBlock",
                    "text": "Tail",
                    "weight": "Bolder",
                    "spacing": "Medium",
                },
                {
                    "type": "TextBlock",
                    "text": tail,
                    "wrap": True,
                    "fontType": "Monospace",
                    "size": "Small",
                    "isSubtle": True,
                },
            ],
        },
    }],
}
print(json.dumps(card))
PYEOF

# ─── Posta till Teams ───────────────────────────────────────────────────────
if [ -z "${TEAMS_WEBHOOK_URL:-}" ]; then
    echo "" >> "$LOG_FILE"
    echo "⚠️ TEAMS_WEBHOOK_URL inte satt — hoppar över Teams-notis." >> "$LOG_FILE"
else
    HTTP_CODE="$(curl -s -o /tmp/vadkul-teams-resp -w '%{http_code}' \
        -H 'Content-Type: application/json' \
        --data-binary "@$PAYLOAD_FILE" \
        "$TEAMS_WEBHOOK_URL")"
    echo "" >> "$LOG_FILE"
    echo "Teams POST → HTTP $HTTP_CODE" >> "$LOG_FILE"
    if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "202" ]; then
        echo "Teams svar:" >> "$LOG_FILE"
        cat /tmp/vadkul-teams-resp >> "$LOG_FILE" 2>/dev/null || true
    fi
fi

rm -f "$PAYLOAD_FILE" /tmp/vadkul-teams-resp

echo "" >> "$LOG_FILE"
echo "Klart: $(date '+%Y-%m-%d %H:%M:%S') (exit=$EXIT_CODE, duration=${DURATION}s)" >> "$LOG_FILE"

exit "$EXIT_CODE"
