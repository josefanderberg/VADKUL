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

REPO_ROOT="$(cd "$(dirname "$0")/../../../" && pwd)"
SCRAPER_DIR="$REPO_ROOT/apps/scraper"
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

# ─── K4: LLM-enrichment (Ollama) ────────────────────────────────────────────
echo "" >> "$LOG_FILE"
echo "── K4: LLM-ENRICHMENT ──" >> "$LOG_FILE"
if npm run llm-enrich >> "$LOG_FILE" 2>&1; then
    echo "K4 OK" >> "$LOG_FILE"
else
    echo "⚠️ K4 misslyckades — fortsätter ändå." >> "$LOG_FILE"
fi

# ─── Plocka ut nyckeltal från loggen ────────────────────────────────────────
SAVED_COUNT="$(grep -cE '✅ Saved:|✅ Sparat:|✅.*Sparade' "$LOG_FILE" || echo 0)"
SKIPPED_COUNT="$(grep -cE 'already exists:|Event already exists:' "$LOG_FILE" || echo 0)"
ERROR_COUNT="$(grep -cE '❌ Fel|^❌|kraschade|Error:|Failed to add' "$LOG_FILE" || echo 0)"

# ─── Hämta Firebase-statistik (dubbletter, daglig fördelning, FB-info) ──────
echo "" >> "$LOG_FILE"
echo "── STATS ──" >> "$LOG_FILE"
STATS_OUTPUT="$(npm run stats --silent 2>> "$LOG_FILE")"

# Parsa STAT_*=värde rader till shell-variabler
STAT_TOTAL_EVENTS=""
STAT_DUPLICATE_LOCATIONS=""
STAT_TOP_HOTSPOTS=""
STAT_DAILY_BREAKDOWN=""
STAT_FB_UNIQUE_URLS=""
STAT_FB_DUPLICATE_HITS=""
STAT_FB_TOP_KEYWORDS=""
STAT_FB_STATS_AGE_H=""
while IFS='=' read -r key value; do
    case "$key" in
        STAT_TOTAL_EVENTS)         STAT_TOTAL_EVENTS="$value" ;;
        STAT_DUPLICATE_LOCATIONS)  STAT_DUPLICATE_LOCATIONS="$value" ;;
        STAT_TOP_HOTSPOTS)         STAT_TOP_HOTSPOTS="$value" ;;
        STAT_DAILY_BREAKDOWN)      STAT_DAILY_BREAKDOWN="$value" ;;
        STAT_FB_UNIQUE_URLS)       STAT_FB_UNIQUE_URLS="$value" ;;
        STAT_FB_DUPLICATE_HITS)    STAT_FB_DUPLICATE_HITS="$value" ;;
        STAT_FB_TOP_KEYWORDS)      STAT_FB_TOP_KEYWORDS="$value" ;;
        STAT_FB_STATS_AGE_H)       STAT_FB_STATS_AGE_H="$value" ;;
    esac
done <<< "$STATS_OUTPUT"
echo "Stats: total=$STAT_TOTAL_EVENTS, dup-locations=$STAT_DUPLICATE_LOCATIONS, fb-urls=$STAT_FB_UNIQUE_URLS" >> "$LOG_FILE"

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
SKIPPED_COUNT="$SKIPPED_COUNT" \
ERROR_COUNT="$ERROR_COUNT" \
STAT_TOTAL_EVENTS="$STAT_TOTAL_EVENTS" \
STAT_DUPLICATE_LOCATIONS="$STAT_DUPLICATE_LOCATIONS" \
STAT_TOP_HOTSPOTS="$STAT_TOP_HOTSPOTS" \
STAT_DAILY_BREAKDOWN="$STAT_DAILY_BREAKDOWN" \
STAT_FB_UNIQUE_URLS="$STAT_FB_UNIQUE_URLS" \
STAT_FB_DUPLICATE_HITS="$STAT_FB_DUPLICATE_HITS" \
STAT_FB_TOP_KEYWORDS="$STAT_FB_TOP_KEYWORDS" \
STAT_FB_STATS_AGE_H="$STAT_FB_STATS_AGE_H" \
LOG_FILE_PATH="$LOG_FILE" \
/usr/bin/python3 - >"$PAYLOAD_FILE" <<'PYEOF'
import os, json

job        = os.environ["JOB_NAME"]
emoji      = os.environ["STATUS_EMOJI"]
status     = os.environ["STATUS_TEXT"]
color      = os.environ["STATUS_COLOR"]
duration_s = os.environ["DURATION"]
deleted    = os.environ.get("DELETED_COUNT", "")
saved      = os.environ["SAVED_COUNT"]
skipped    = os.environ.get("SKIPPED_COUNT", "0")
errors     = os.environ["ERROR_COUNT"]

# Formatera varaktighet (duration) snyggt
try:
    secs = int(duration_s)
    mins = secs // 60
    rem_s = secs % 60
    duration_formatted = f"{mins} min {rem_s} sek" if mins > 0 else f"{rem_s} sek"
except Exception:
    duration_formatted = f"{duration_s} sek"

total_events    = os.environ.get("STAT_TOTAL_EVENTS", "")
dup_locations   = os.environ.get("STAT_DUPLICATE_LOCATIONS", "")
top_hotspots    = os.environ.get("STAT_TOP_HOTSPOTS", "")
daily_breakdown = os.environ.get("STAT_DAILY_BREAKDOWN", "")
fb_urls         = os.environ.get("STAT_FB_UNIQUE_URLS", "")
fb_dup_hits     = os.environ.get("STAT_FB_DUPLICATE_HITS", "")
fb_top_kw       = os.environ.get("STAT_FB_TOP_KEYWORDS", "")
fb_age_h        = os.environ.get("STAT_FB_STATS_AGE_H", "")

try:
    with open(os.environ["LOG_FILE_PATH"], "r", encoding="utf-8", errors="replace") as f:
        lines = f.readlines()
    tail = "".join(lines[-6:]).rstrip() or "(tom logg)"
except Exception as e:
    tail = f"(kunde inte läsa logg: {e})"

# ── Scraper-resultat ──
run_facts = [
    {"title": "Status",              "value": f"{emoji} {status}"},
    {"title": "Körde (duration)",    "value": duration_formatted},
]
if deleted:
    run_facts.append({"title": "🗑️ Cleanup", "value": f"{deleted} gamla event raderade"})
run_facts.append({"title": "✅ Nya event sparade",       "value": saved})
run_facts.append({"title": "⏭️ Redan i DB (skippade)",   "value": skipped})
run_facts.append({"title": "❌ Fel i logg",              "value": errors})

# ── Kartstats ──
map_facts = []
if total_events:
    map_facts.append({"title": "📍 Totalt i Firebase",        "value": f"{total_events} event"})
if dup_locations:
    map_facts.append({"title": "📌 Platser med 1+ event",      "value": f"{dup_locations} platser"})
if top_hotspots:
    map_facts.append({"title": "🔥 Heta platser (lat,lng)",    "value": top_hotspots})
if daily_breakdown:
    map_facts.append({"title": "📅 Kommande 7 dagar",          "value": daily_breakdown})

# ── Facebook-stats ──
fb_facts = []
if fb_urls:
    fb_facts.append({"title": "🔗 Unika FB-event hittade",  "value": fb_urls})
if fb_dup_hits:
    fb_facts.append({"title": "🔁 Dubblett-träffar",        "value": fb_dup_hits})
if fb_top_kw:
    fb_facts.append({"title": "🎯 Bästa sökord",             "value": fb_top_kw})
if fb_age_h:
    age_note = "(senaste körning)" if float(fb_age_h) < 4 else f"({fb_age_h}h sedan)"
    fb_facts.append({"title": "⏰ FB-stats ålder",           "value": age_note})

body = [
    {
        "type": "TextBlock",
        "text": f"{emoji} VADKUL daily — {job}",
        "weight": "Bolder",
        "size": "Large",
        "color": color,
    },
    # Scraper-resultat
    {"type": "TextBlock", "text": "🚀 Scraper-resultat", "weight": "Bolder", "spacing": "Medium"},
    {"type": "FactSet", "facts": run_facts},
]

if map_facts:
    body.append({"type": "TextBlock", "text": "🗺️ Kartstatistik", "weight": "Bolder", "spacing": "Medium"})
    body.append({"type": "FactSet", "facts": map_facts})

if fb_facts:
    body.append({"type": "TextBlock", "text": "👤 Facebook Events", "weight": "Bolder", "spacing": "Medium"})
    body.append({"type": "FactSet", "facts": fb_facts})

body += [
    {"type": "TextBlock", "text": "📝 Logg (tail)", "weight": "Bolder", "spacing": "Medium"},
    {
        "type": "TextBlock",
        "text": tail,
        "wrap": True,
        "fontType": "Monospace",
        "size": "Small",
        "isSubtle": True,
    },
]

card = {
    "type": "message",
    "attachments": [{
        "contentType": "application/vnd.microsoft.card.adaptive",
        "content": {
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "type": "AdaptiveCard",
            "version": "1.4",
            "msteams": {"width": "Full"},
            "body": body,
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
