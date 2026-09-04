#!/usr/bin/env bash
# Snabbkedja på Mac mini:n — dagens innehållsfixar UTAN att vänta på nattkedjan.
#
# Användning (som användare ai på minin):
#   bash ~/Repos/VADKUL/apps/scraper/scripts/run-quickfix.sh --fb-city=Piteå
#   bash ~/Repos/VADKUL/apps/scraper/scripts/run-quickfix.sh --no-fb --no-push
#
# Flaggor:
#   --fb-city=STAD   Facebook bara för STAD (stadssök + dess sidbevakningar,
#                    omskrapar tomma beskrivningar/generiska värdar). Utan
#                    flaggan körs INGEN FB (hela svepet tar timmar — nattkedjan).
#   --sources=ID     Källor med ID i registret (t.ex. visitpitea) i full-refresh
#                    (kända URL:er re-fetchas → "Plats:" ur detaljsidan).
#   --no-push        Committa/pusha inte aggregatet (bara lokalt).
#
# Steg: vägra om nattkedjan kör → git pull → [FB stad] → [källor] →
#       repair-salong → hide rotary → K9 backfill-content → aggregate →
#       whitelist-commit + push (samma filer som nattkedjan, aldrig kod).
# Varje steg loggar till ~/Library/Logs/vadkul-scraper/quickfix.log och ett
# fel stoppar inte kedjan — det står ⚠️ i terminalen.

FB_CITY=""
SOURCES_ID=""
DO_PUSH=1
for arg in "$@"; do
    case "$arg" in
        --fb-city=*) FB_CITY="${arg#*=}" ;;
        --sources=*) SOURCES_ID="${arg#*=}" ;;
        --no-fb) FB_CITY="" ;;
        --no-push) DO_PUSH=0 ;;
        *) echo "Okänd flagga: $arg"; exit 2 ;;
    esac
done

REPO_ROOT="$(cd "$(dirname "$0")/../../../" && pwd)"
SCRAPER_DIR="$REPO_ROOT/apps/scraper"
LOG_DIR="$HOME/Library/Logs/vadkul-scraper"
LOG_FILE="$LOG_DIR/quickfix.log"
SECRET_FILE="$HOME/.vadkul-secrets/env"
mkdir -p "$LOG_DIR"

# Icke-interaktiv shell får gammal node (CLAUDE.md) — samma node som nattkedjan.
export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH"
export NODE_OPTIONS=--dns-result-order=ipv4first

if [ -f "$SECRET_FILE" ]; then
    # shellcheck disable=SC1090
    set -a; . "$SECRET_FILE"; set +a
fi

log() { echo "$*" | tee -a "$LOG_FILE"; }

# Kör ett steg: stdout/stderr till loggen, en rad ✅/⚠️ i terminalen.
run_step() {
    local name="$1"; shift
    log ""
    log "── $name ── $(date '+%H:%M:%S')"
    if "$@" >> "$LOG_FILE" 2>&1; then
        log "✅ $name OK"
    else
        log "⚠️ $name misslyckades — se $LOG_FILE (fortsätter)"
    fi
}

if pgrep -f "run-daily.sh" > /dev/null 2>&1; then
    echo "❌ Nattkedjan (run-daily.sh) kör fortfarande — vänta tills den är klar:"
    echo "   tail -f $LOG_DIR/nightly.log"
    exit 1
fi

{
    echo "=========================================="
    echo "VADKUL quickfix — startad $(date '+%Y-%m-%d %H:%M:%S')"
    echo "fb-city=${FB_CITY:-–} sources=${SOURCES_ID:-–} push=$DO_PUSH"
    echo "=========================================="
} > "$LOG_FILE"

cd "$SCRAPER_DIR" || { echo "❌ Kunde inte cd till $SCRAPER_DIR"; exit 1; }

# ─── Git pull (samma regler som nattkedjan: rebase+autostash, npm install bara vid package-ändring)
log "── GIT PULL ──"
PRE_PULL_HEAD="$(git -C "$REPO_ROOT" rev-parse HEAD)"
if git -C "$REPO_ROOT" pull --rebase --autostash origin main >> "$LOG_FILE" 2>&1; then
    log "✅ Git pull OK ($(git -C "$REPO_ROOT" rev-parse --short HEAD))"
    if git -C "$REPO_ROOT" diff --name-only "$PRE_PULL_HEAD"..HEAD -- '*package.json' '*package-lock.json' | grep -q .; then
        run_step "NPM INSTALL (beroenden ändrades)" bash -c "cd '$REPO_ROOT' && npm install --no-audit --no-fund"
    fi
else
    git -C "$REPO_ROOT" rebase --abort >> "$LOG_FILE" 2>&1 || true
    log "⚠️ Git pull misslyckades (konflikt?) — kör vidare på lokal kod. Synka manuellt!"
fi

# ─── Facebook för EN stad (frivilligt) ───────────────────────────────────────
if [ -n "$FB_CITY" ]; then
    run_step "FACEBOOK ($FB_CITY)" npm run scrape-fb -- "--city=$FB_CITY"
else
    log "(hoppar Facebook — ge --fb-city=STAD för en riktad körning)"
fi

# ─── Källor i full-refresh (frivilligt) ──────────────────────────────────────
if [ -n "$SOURCES_ID" ]; then
    run_step "SOURCES ($SOURCES_ID, full refresh)" env SCRAPE_FORCE_REFRESH=1 npm run sources -- "--id=$SOURCES_ID"
fi

# ─── Reparationer + K9 ───────────────────────────────────────────────────────
run_step "REPAIR-SALONG (salong → byggnad)" npm run repair-salong -- --apply
run_step "HIDE ROTARY (clubrunner.ca)"      npm run hide-source -- --url-like=clubrunner.ca --apply
run_step "K9 CONTENT-QUALITY (pris, 🎬, �)" npm run backfill-content -- --apply
run_step "AGGREGATE"                         npm run aggregate

# ─── Whitelist-commit + push (samma paths som nattkedjan, aldrig kod) ────────
if [ "$DO_PUSH" = "1" ]; then
    log ""
    log "── GIT PUSH (aggregat) ──"
    git -C "$REPO_ROOT" add \
        apps/web/public/events-cards.json \
        apps/web/public/events-descriptions.json \
        apps/web/public/events-destinations.json \
        apps/scraped_events.json \
        apps/scraper/quarantine.json >> "$LOG_FILE" 2>&1
    if git -C "$REPO_ROOT" diff --cached --quiet; then
        log "Inget nytt att committa (datafilerna oförändrade)."
    else
        git -C "$REPO_ROOT" commit -q -m "data: snabbfix-aggregat $(date '+%Y-%m-%d %H:%M') [auto]" >> "$LOG_FILE" 2>&1
        if git -C "$REPO_ROOT" pull --rebase --autostash origin main >> "$LOG_FILE" 2>&1 \
           && git -C "$REPO_ROOT" push origin main >> "$LOG_FILE" 2>&1; then
            log "✅ Git push OK ($(git -C "$REPO_ROOT" rev-parse --short HEAD))"
        else
            git -C "$REPO_ROOT" rebase --abort >> "$LOG_FILE" 2>&1 || true
            log "⚠️ Git push misslyckades — data-committen ligger kvar lokalt. Synka manuellt!"
        fi
    fi
else
    log "(hoppar push — --no-push)"
fi

log ""
log "Klart $(date '+%H:%M:%S'). Full logg: $LOG_FILE"
