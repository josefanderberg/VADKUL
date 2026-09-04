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

# ─── Git-synk IN (bara nightly): hämta frontend-maskinens jobb ──────────────
# Arbetsdelning (2026-07-28): den här maskinen äger scraping + datafiler,
# den andra äger frontend. Pull med rebase+autostash så nattens kod är färsk;
# konflikt ⇒ abort + kör vidare på lokal kod (hellre en natt osynkad än en
# död nattkedja) — synka då manuellt på dagen.
if [ "$JOB_NAME" = "nightly" ]; then
    echo "" >> "$LOG_FILE"
    echo "── GIT PULL (rebase, autostash) ──" >> "$LOG_FILE"
    PRE_PULL_HEAD="$(git -C "$REPO_ROOT" rev-parse HEAD)"
    if git -C "$REPO_ROOT" pull --rebase --autostash origin main >> "$LOG_FILE" 2>&1; then
        echo "Git pull OK ($(git -C "$REPO_ROOT" rev-parse --short HEAD))" >> "$LOG_FILE"
        # Nya beroenden? Kör npm install BARA när pullen ändrade package-filer —
        # annars ligger node_modules kvar på gårdagens versioner fast locken är
        # ny (puppeteer 25-läxan 2026-08-23: lyftet krävde manuell install på
        # minin). Installen sker i workspace-ROTEN (scrapern resolvar därifrån).
        # Failar den loggas det och kedjan kör vidare på gamla node_modules —
        # gårdagens beroenden är alltid körbara.
        if git -C "$REPO_ROOT" diff --name-only "$PRE_PULL_HEAD"..HEAD -- '*package.json' '*package-lock.json' | grep -q .; then
            echo "── NPM INSTALL (beroenden ändrades i pullen) ──" >> "$LOG_FILE"
            if (cd "$REPO_ROOT" && npm install --no-audit --no-fund) >> "$LOG_FILE" 2>&1; then
                echo "npm install OK" >> "$LOG_FILE"
            else
                echo "⚠️ npm install misslyckades — kör vidare på gamla node_modules." >> "$LOG_FILE"
            fi
        else
            echo "Inga beroendeändringar — hoppar npm install." >> "$LOG_FILE"
        fi
    else
        git -C "$REPO_ROOT" rebase --abort >> "$LOG_FILE" 2>&1 || true
        echo "⚠️ Git pull misslyckades (konflikt?) — kör vidare på lokal kod. Synka manuellt!" >> "$LOG_FILE"
    fi
fi

# ─── IG-inbox (bara nightly): IG-tvillingar schemalagda från annan maskin ───
# schedule-city-posts kört på MacBooken lämnar IG-kön i en LOKAL, gitignorerad
# ig-queue.json som bara DEN HÄR maskinens launchd-jobb tömmer. Bryggan är den
# incheckade apps/scraper/ig-inbox.json: posterna merge:as in här efter pullen.
# Idempotent (bara saknade id:n läggs till, publicerade rörs aldrig) och
# inboxfilen lämnas orörd i trädet — whitelist-pushen får aldrig se lokala
# ändringar. Ett fel här får ALDRIG stoppa kedjan.
if [ "$JOB_NAME" = "nightly" ] && [ -f "$SCRAPER_DIR/ig-inbox.json" ]; then
    echo "" >> "$LOG_FILE"
    echo "── IG-INBOX → IG-KÖN ──" >> "$LOG_FILE"
    node "$SCRAPER_DIR/scripts/merge-ig-inbox.js" >> "$LOG_FILE" 2>&1 \
        || echo "⚠️ IG-inbox-mergen misslyckades — IG-kön lämnad orörd." >> "$LOG_FILE"
fi

# ─── Sync Firestore→SQLite (bara nightly): håll spegeln färsk ───────────────
# INKREMENTELL (updatedAt > cursor) — några hundra reads, inte hela ~29k-
# kollektionen. Hel sync körs automatiskt var 7:e dag (självläkning). Körs FÖRE
# skraporna så dubblettkollen (SQLite-först i dbHelper) svarar på färsk data.
if [ "$JOB_NAME" = "nightly" ]; then
    echo "" >> "$LOG_FILE"
    echo "── SYNC FIRESTORE→SQLITE (inkrementell) ──" >> "$LOG_FILE"
    if npm run sync-to-sqlite >> "$LOG_FILE" 2>&1; then
        echo "Sync OK" >> "$LOG_FILE"
    else
        echo "⚠️ Sync misslyckades — fortsätter ändå (spegeln är som senast synkad)." >> "$LOG_FILE"
    fi
fi

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

    # SQLite-housekeeping: rensa passerade events ur lokala events.db (default 30d).
    # Firestore rensas av cleanup-old ovan; detta håller den lokala spegeln slank.
    echo "── PRUNE SQLITE (gamla events) ──" >> "$LOG_FILE"
    if npm run prune-old >> "$LOG_FILE" 2>&1; then
        PRUNED_COUNT="$(grep -oE '"deleted":[[:space:]]*[0-9]+' "$LOG_FILE" | tail -1 | grep -oE '[0-9]+')"
        echo "Prune OK (raderade=${PRUNED_COUNT:-0})" >> "$LOG_FILE"
    else
        echo "⚠️ Prune misslyckades — fortsätter ändå." >> "$LOG_FILE"
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

# ─── Auto-karantän: pausa källor utan livstecken ────────────────────────────
# N raka körningar med found=0 och inga skips ⇒ quarantine.json (läses av
# schedule.scheduledForToday). Vecko-retry ger självläkning. ⏸️/▶️-raderna
# plockas upp i Teams-kortet nedan. Friska-men-tysta källor (found>0) rörs ej.
echo "" >> "$LOG_FILE"
echo "── AUTO-KARANTÄN (källor utan livstecken) ──" >> "$LOG_FILE"
if npm run quarantine >> "$LOG_FILE" 2>&1; then
    echo "Auto-karantän OK" >> "$LOG_FILE"
else
    echo "⚠️ Auto-karantän misslyckades — fortsätter ändå." >> "$LOG_FILE"
fi

# ─── DB-janitor + kostnadsvakt (bara nightly): ren databas + larm ───────────
# Janitorn raderar bevisat döda markörer (eventReminders m.m. — incidenten
# 2026-08-19: 46 920 docs varav 2 med mottagare). Kostnadsvakten snapshotar
# alla kollektioners docantal i SQLite och ⚠️-varnar vid tillväxt/tak —
# raderna landar i Teams-kortet nedan. Läsningarna är count-aggregat (~gratis).
if [ "$JOB_NAME" = "nightly" ]; then
    echo "" >> "$LOG_FILE"
    echo "── DB-JANITOR (döda reminder-markörer) ──" >> "$LOG_FILE"
    if npm run db-janitor >> "$LOG_FILE" 2>&1; then
        echo "Janitor OK" >> "$LOG_FILE"
    else
        echo "⚠️ Janitor misslyckades — fortsätter ändå." >> "$LOG_FILE"
    fi
    echo "" >> "$LOG_FILE"
    echo "── KOSTNADSVAKT (kollektionstillväxt) ──" >> "$LOG_FILE"
    if npm run cost-guard >> "$LOG_FILE" 2>&1; then
        echo "Kostnadsvakt OK" >> "$LOG_FILE"
    else
        echo "⚠️ Kostnadsvakt misslyckades — fortsätter ändå." >> "$LOG_FILE"
    fi
fi

# ─── Dölj events i fel land (locationName matchar utländsk markör) ─────────
# Konservativt — bara geografi-fält, inte title/description.
# Hittar ~10/dygn typiskt. Idempotent (skipper redan hidden).
echo "" >> "$LOG_FILE"
echo "── HIDE FOREIGN MISCLASSIFIED ──" >> "$LOG_FILE"
if npm run hide-foreign -- --apply >> "$LOG_FILE" 2>&1; then
    HIDDEN_FOREIGN="$(grep -oE 'Hidden [0-9]+ utländska' "$LOG_FILE" | tail -1 | grep -oE '[0-9]+')"
    echo "Hide-foreign OK (gömda=${HIDDEN_FOREIGN:-0})" >> "$LOG_FILE"
else
    echo "⚠️ Hide-foreign misslyckades — fortsätter ändå." >> "$LOG_FILE"
fi

# ─── Dölj junk-keywords (vaccin etc) — deterministisk regex-filter ──────────
# Lägg till nya patterns i JUNK_PATTERNS-arrayen i hide-junk-keywords.ts.
# Körs efter hide-foreign så samma "filtreringssvep" är klart innan audit.
echo "" >> "$LOG_FILE"
echo "── HIDE JUNK-KEYWORDS (vaccin etc) ──" >> "$LOG_FILE"
if npm run hide-junk -- --apply >> "$LOG_FILE" 2>&1; then
    HIDDEN_JUNK="$(grep -oE 'SQLite hidden:[[:space:]]+[0-9]+' "$LOG_FILE" | tail -1 | grep -oE '[0-9]+')"
    echo "Hide-junk OK (gömda=${HIDDEN_JUNK:-0})" >> "$LOG_FILE"
else
    echo "⚠️ Hide-junk misslyckades — fortsätter ändå." >> "$LOG_FILE"
fi

# ─── Dölj slutna sällskap: Rotary (clubrunner.ca) — ägarbeslut 2026-09-04 ────
# Klubbmöten för medlemmar, inte publika event. Källan är 'dead' i registret;
# det här gömmer det som redan ligger i DB:n. Idempotent.
echo "" >> "$LOG_FILE"
echo "── HIDE ROTARY (clubrunner.ca, slutna klubbmöten) ──" >> "$LOG_FILE"
if npm run hide-source -- --url-like=clubrunner.ca --apply >> "$LOG_FILE" 2>&1; then
    echo "Hide Rotary OK" >> "$LOG_FILE"
else
    echo "⚠️ Hide Rotary misslyckades — fortsätter ändå." >> "$LOG_FILE"
fi

# ─── Salong → byggnad: biografsalonger geokodade var för sig (Piteå 2026-09-04) ─
# Ticksters koordinat per SALONG spretar ("Saga - Bio 3:an" låg 14 km utanför
# stan). Nya event geokodar byggnaden först i skrapan; det här flyttar de
# redan sparade. En geokodning per byggnad+stad (cachad), idempotent.
echo "" >> "$LOG_FILE"
echo "── REPAIR-SALONG (salong → byggnad) ──" >> "$LOG_FILE"
if npm run repair-salong -- --apply --limit=300 >> "$LOG_FILE" 2>&1; then
    echo "Repair-salong OK" >> "$LOG_FILE"
else
    echo "⚠️ Repair-salong misslyckades — fortsätter ändå." >> "$LOG_FILE"
fi

# ─── Fixa platshållar-midnatt: re-fetcha detail-sidor efter klockslag ────────
# Kandidater väljs på hasSpecificTime=0 (runnerns flagga) med max 3 försök per
# event — sedan ger vi upp (sidan saknar klockslag) och eventet ligger kvar på
# lokal midnatt, som webben visar som "datum utan tid" (aldrig "00:00"/"02:00").
echo "" >> "$LOG_FILE"
echo "── FIX EVENT-TIMES (klockslag för midnatts-platshållare) ──" >> "$LOG_FILE"
if npm run fix-times -- --apply --limit=300 >> "$LOG_FILE" 2>&1; then
    FIXED_TIMES="$(grep -oE '✅ Fixade:[[:space:]]+[0-9]+' "$LOG_FILE" | tail -1 | grep -oE '[0-9]+')"
    echo "Fix-times OK (fixade=${FIXED_TIMES:-0})" >> "$LOG_FILE"
else
    echo "⚠️ Fix-times misslyckades — fortsätter ändå." >> "$LOG_FILE"
fi

# ─── Cross-source-dedup: samma event från flera källor → göm sämsta ────────
# Kommun+Tickster+FB+paraplyer ser ofta samma event. Nyckel: titel+dag+plats
# (~5km-koordinatrundning); bästa kandidaten per poäng behålls (bild/desc/geo).
# Körs FÖRE llm-enrich och aggregate så förlorare varken berikas eller exporteras.
echo "" >> "$LOG_FILE"
echo "── CROSS-SOURCE DEDUP ──" >> "$LOG_FILE"
if npm run dedupe-cross -- --apply >> "$LOG_FILE" 2>&1; then
    DEDUPED_N="$(grep -oE '✅ [0-9]+ events gömda' "$LOG_FILE" | tail -1 | grep -oE '[0-9]+')"
    echo "Dedup OK (gömda=${DEDUPED_N:-0})" >> "$LOG_FILE"
else
    echo "⚠️ Dedup misslyckades — fortsätter ändå." >> "$LOG_FILE"
fi

# ─── Geo-refine: exakta adresser för stadscentrum-klumpade event ────────────
# Event vars geokodning föll tillbaka på stadens mittpunkt får ett nytt försök:
# gatuadress ur extractedAddress/description/locationName (strukturerad
# Nominatim-sökning) eller strikt venue+stad. Bara träffar som flyttar eventet
# >150 m men <60 km accepteras. Körs EFTER dedup (färre rader att förfina)
# och FÖRE re-aggregate så nya koordinater publiceras samma natt.
echo "" >> "$LOG_FILE"
echo "── GEO-REFINE (exakta adresser för kluster-event) ──" >> "$LOG_FILE"
# 350 sedan 24/8: round-robin sprider budgeten över ALLA kluster (tidigare åt
# storstäderna allt), och kandidat 0 (known_venues, Overpass-seedad) gör många
# uppslag gratis — högre limit utan motsvarande Nominatim-kostnad.
if npm run geo-refine -- --apply --limit=350 >> "$LOG_FILE" 2>&1; then
    REFINED_N="$(grep -oE 'Förfinade:[[:space:]]+[0-9]+' "$LOG_FILE" | tail -1 | grep -oE '[0-9]+')"
    echo "Geo-refine OK (förfinade=${REFINED_N:-0})" >> "$LOG_FILE"
else
    echo "⚠️ Geo-refine misslyckades — fortsätter ändå." >> "$LOG_FILE"
fi

# ─── Backfill-geocode: geokoda null-island-event (lat≈0) ────────────────────
# geo-refine ovan FÖRFINAR redan-geokodade event men avvisar null-island
# (flytten >60 km). Event som aldrig fick koordinater (lat≈0,lng≈0) fångas här:
# soonest-first, Nominatim-budget via --limit. Skriver SQLite + Firestore.
# Körs FÖRE K4/re-aggregate så nya koordinater publiceras samma natt. K4 nedan
# tar FB-specifika fall via Ollama; detta täcker icke-FB-källorna.
echo "" >> "$LOG_FILE"
echo "── BACKFILL-GEOCODE (null-island lat≈0) ──" >> "$LOG_FILE"
if npm run backfill-geocode -- --apply --limit=300 >> "$LOG_FILE" 2>&1; then
    GEOCODED_N="$(grep -oE '📍 Geokodade:[[:space:]]+[0-9]+' "$LOG_FILE" | tail -1 | grep -oE '[0-9]+')"
    echo "Backfill-geocode OK (geokodade=${GEOCODED_N:-0})" >> "$LOG_FILE"
else
    echo "⚠️ Backfill-geocode misslyckades — fortsätter ändå." >> "$LOG_FILE"
fi

# ─── Repair-geo: flytta hem event i FEL STAD (Örebro-buggen-klassen) ────────
# backfill-geocode ovan tar event UTAN koordinater; detta tar event med FEL
# koordinater: förväntad stad härleds ur församlings-/ortsnamn (bara otvetydiga
# städer, kompound- + reverse-tvetydighetsvakter) och event >60 km bort
# re-geokodas stads-ankrat. Liten nattbudget → drift självläker gradvis.
echo "" >> "$LOG_FILE"
echo "── REPAIR-GEO (felplacerade event) ──" >> "$LOG_FILE"
if npm run repair-geo -- --apply --limit=60 >> "$LOG_FILE" 2>&1; then
    REPAIRED_N="$(grep -oE '✅ Reparerade:[[:space:]]+[0-9]+' "$LOG_FILE" | tail -1 | grep -oE '[0-9]+')"
    echo "Repair-geo OK (reparerade=${REPAIRED_N:-0})" >> "$LOG_FILE"
else
    echo "⚠️ Repair-geo misslyckades — fortsätter ändå." >> "$LOG_FILE"
fi

# ─── Synca redan-i-Storage-bilder med Firestore coverImage ─────────────────
# Idempotent + snabbt: kollar bara Storage.exists() för varje events sha1.
# Fixar fall där upload lyckades historiskt men coverImage inte uppdaterades.
# Smoke-test gav 84% framgång (84/100 hittade bild i Storage).
echo "" >> "$LOG_FILE"
echo "── SYNC STORAGE-URLS (FB) ──" >> "$LOG_FILE"
if npm run sync-storage-urls -- --apply --fb-only >> "$LOG_FILE" 2>&1; then
    SYNCED_COUNT="$(grep -oE 'Synkade Firestore:[[:space:]]+[0-9]+' "$LOG_FILE" | tail -1 | grep -oE '[0-9]+')"
    echo "Sync OK (synkade=${SYNCED_COUNT:-0})" >> "$LOG_FILE"
else
    echo "⚠️ Storage-sync misslyckades — fortsätter ändå." >> "$LOG_FILE"
fi

# ─── Migrate FB-bilder till Storage (innan fbcdn-URL:er expirar efter 7d) ───
# Räddar BARA FB-bilder — kommun/extern bilder är stabila (expirar inte) och
# blir bara onödiga fetch-fel. Filter på createdAt så vi slipper de redan-döda.
echo "" >> "$LOG_FILE"
echo "── MIGRATE FB-IMAGES → STORAGE ──" >> "$LOG_FILE"
if npm run migrate-images -- --apply --max-age=7 --fb-only >> "$LOG_FILE" 2>&1; then
    MIGRATED_COUNT="$(grep -oE 'TOTAL: [0-9]+/' "$LOG_FILE" | tail -1 | grep -oE '[0-9]+' | head -1)"
    echo "Migration OK (migrerade=${MIGRATED_COUNT:-0})" >> "$LOG_FILE"
else
    echo "⚠️ Image migration misslyckades — fortsätter ändå." >> "$LOG_FILE"
fi

# ─── K9: Innehållskvalitet — pris ur beskrivningstext, trasiga tecken ──────
# Deterministiskt (regex, utils/priceFromText) och idempotent. Körs FÖRE K4
# så Ollama bara får de event som texten inte kunde prissätta. Rapporterar
# också kapade/å-ä-ö-lösa beskrivningar per domän (lagas av refresh-körningar).
# Ett fel här får aldrig stoppa kedjan.
echo "" >> "$LOG_FILE"
echo "── K9: CONTENT-QUALITY (pris ur text, �-rensning) ──" >> "$LOG_FILE"
if npm run backfill-content -- --apply >> "$LOG_FILE" 2>&1; then
    echo "Content-quality OK" >> "$LOG_FILE"
else
    echo "⚠️ Content-quality misslyckades — fortsätter ändå." >> "$LOG_FILE"
fi

# ─── K4: LLM-enrichment (Ollama) ────────────────────────────────────────────
echo "" >> "$LOG_FILE"
echo "── K4: LLM-ENRICHMENT ──" >> "$LOG_FILE"
if npm run llm-enrich >> "$LOG_FILE" 2>&1; then
    echo "K4 OK" >> "$LOG_FILE"
else
    echo "⚠️ K4 misslyckades — fortsätter ändå." >> "$LOG_FILE"
fi

# ─── K8: AI-audit av events (qwen3:8b granskar nya events) ─────────────────
# Auto-hide junk-events med hög confidence ELLER markerade som ej-Sverige.
# Bara nya events (--only-new) för att inte slösa GPU. Limit för säkerhet.
echo "" >> "$LOG_FILE"
echo "── K8: AI-AUDIT ──" >> "$LOG_FILE"
if npm run audit-events -- --apply --only-new --auto-hide-junk --check-gps --auto-hide-wrong-gps --limit=500 >> "$LOG_FILE" 2>&1; then
    AUDIT_HIDDEN="$(grep -oE 'hidden:[[:space:]]+[0-9]+' "$LOG_FILE" | tail -1 | grep -oE '[0-9]+')"
    echo "AI-audit OK (auto-gömda=${AUDIT_HIDDEN:-0})" >> "$LOG_FILE"
else
    echo "⚠️ AI-audit misslyckades — fortsätter ändå." >> "$LOG_FILE"
fi

# ─── Re-aggregate så audit-fyllda fält (price/category/emoji + hidden) når web ──
# Aggregate kördes redan av npm-scriptet ovan (start/today), men då hade audit
# inte hunnit fylla i price/category/emoji eller dölja junk för dagens nya events.
# Ny aggregate nu garanterar att dagens audit-resultat publiceras samma dygn.
echo "" >> "$LOG_FILE"
echo "── RE-AGGREGATE (efter audit, så priser/kategorier/döljningar syns idag) ──" >> "$LOG_FILE"
if npm run aggregate >> "$LOG_FILE" 2>&1; then
    echo "Re-aggregate OK" >> "$LOG_FILE"
else
    echo "⚠️ Re-aggregate misslyckades — fortsätter ändå." >> "$LOG_FILE"
fi

# ─── Git-synk UT (bara nightly): committa nattens data + pusha ──────────────
# BARA whitelistade paths (aldrig add -A): aggregat-JSON:erna, FB-körloggen
# och den genererade FB-watchlisten (skrivs om av måndags-snöbollen; om den
# är orörd är add en no-op). Pågående kodarbete i working tree lämnas ifred.
# Push-fel stoppar aldrig kedjan — det loggas och tas manuellt på dagen.
if [ "$JOB_NAME" = "nightly" ]; then
    echo "" >> "$LOG_FILE"
    echo "── GIT PUSH (nattens data) ──" >> "$LOG_FILE"
    git -C "$REPO_ROOT" add \
        apps/web/public/events-cards.json \
        apps/web/public/events-descriptions.json \
        apps/web/public/events-destinations.json \
        apps/scraped_events.json \
        apps/scraper/quarantine.json \
        apps/scraper/web-snowball-state.json \
        apps/scraper/src/sources/registry-snowball.ts \
        apps/scraper/src/scrapers/facebook/watchlist-national.ts >> "$LOG_FILE" 2>&1
    if git -C "$REPO_ROOT" diff --cached --quiet; then
        echo "Inget nytt att committa (datafilerna oförändrade)." >> "$LOG_FILE"
    else
        git -C "$REPO_ROOT" commit -q -m "data: nattligt aggregat $(date '+%Y-%m-%d') [auto]" >> "$LOG_FILE" 2>&1
        # Frontend-maskinen kan ha pushat under natten — rebase:a innan push.
        if git -C "$REPO_ROOT" pull --rebase --autostash origin main >> "$LOG_FILE" 2>&1 \
           && git -C "$REPO_ROOT" push origin main >> "$LOG_FILE" 2>&1; then
            echo "Git push OK ($(git -C "$REPO_ROOT" rev-parse --short HEAD))" >> "$LOG_FILE"
        else
            git -C "$REPO_ROOT" rebase --abort >> "$LOG_FILE" 2>&1 || true
            echo "⚠️ Git push misslyckades — data-committen ligger kvar lokalt. Synka manuellt!" >> "$LOG_FILE"
        fi
    fi
fi

# ─── Plocka ut nyckeltal från loggen ────────────────────────────────────────
SAVED_COUNT="$(grep -cE '✅ Saved:|✅ Sparat:|✅.*Sparade' "$LOG_FILE" || echo 0)"
SKIPPED_COUNT="$(grep -cE 'already exists:|Event already exists:' "$LOG_FILE" || echo 0)"
ERROR_COUNT="$(grep -cE '❌ Fel|^❌|kraschade|Error:|Failed to add' "$LOG_FILE" || echo 0)"

# Auto-karantänens utfall (sätts av npm run quarantine ovan)
QUAR_SUMMARY="$(grep -oE 'Karantän-summering: .*' "$LOG_FILE" | tail -1 | sed 's/Karantän-summering: //')"
QUAR_NAMES="$(grep '⏸️ KARANTÄN:' "$LOG_FILE" | sed 's/.*KARANTÄN: //;s/ — .*//' | tr '\n' ',' | sed 's/,$//;s/,/, /g' | cut -c1-250)"
QUAR_RELEASED="$(grep '▶️ SLÄPPT:' "$LOG_FILE" | sed 's/.*SLÄPPT: //;s/ — .*//' | tr '\n' ',' | sed 's/,$//;s/,/, /g' | cut -c1-250)"

# Janitorns och kostnadsvaktens utfall (sätts av stegen ovan)
JANITOR_SUMMARY="$(grep -oE 'Janitor-summering: .*' "$LOG_FILE" | tail -1 | sed 's/Janitor-summering: //')"
COST_SUMMARY="$(grep -oE 'Kostnadsvakt-summering: .*' "$LOG_FILE" | tail -1 | sed 's/Kostnadsvakt-summering: //')"
COST_WARNINGS="$(grep '⚠️ KOSTNADSVAKT:' "$LOG_FILE" | sed 's/.*KOSTNADSVAKT: //' | head -5 | tr '\n' '|' | sed 's/|$//;s/|/ — /g' | cut -c1-400)"

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
QUAR_SUMMARY="$QUAR_SUMMARY" \
QUAR_NAMES="$QUAR_NAMES" \
QUAR_RELEASED="$QUAR_RELEASED" \
JANITOR_SUMMARY="$JANITOR_SUMMARY" \
COST_SUMMARY="$COST_SUMMARY" \
COST_WARNINGS="$COST_WARNINGS" \
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

# ── Auto-karantän ──
quar_summary  = os.environ.get("QUAR_SUMMARY", "")
quar_names    = os.environ.get("QUAR_NAMES", "")
quar_released = os.environ.get("QUAR_RELEASED", "")
quar_facts = []
if quar_summary:
    quar_facts.append({"title": "⏸️ Status",        "value": quar_summary})
if quar_names:
    quar_facts.append({"title": "🆕 Nya i karantän", "value": quar_names})
if quar_released:
    quar_facts.append({"title": "▶️ Släppta",        "value": quar_released})

# ── Databas & kostnad ──
janitor_summary = os.environ.get("JANITOR_SUMMARY", "")
cost_summary    = os.environ.get("COST_SUMMARY", "")
cost_warnings   = os.environ.get("COST_WARNINGS", "")
db_facts = []
if janitor_summary:
    db_facts.append({"title": "🧹 Janitor",       "value": janitor_summary})
if cost_summary:
    db_facts.append({"title": "📊 Kollektioner",  "value": cost_summary})
if cost_warnings:
    db_facts.append({"title": "🚨 VARNINGAR",     "value": cost_warnings})

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

if quar_facts:
    body.append({"type": "TextBlock", "text": "⏸️ Källkarantän", "weight": "Bolder", "spacing": "Medium"})
    body.append({"type": "FactSet", "facts": quar_facts})

if db_facts:
    header_color = "attention" if cost_warnings else "default"
    body.append({"type": "TextBlock", "text": "🧹 Databas & kostnadsvakt", "weight": "Bolder", "spacing": "Medium", "color": header_color})
    body.append({"type": "FactSet", "facts": db_facts})

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

# ─── Per-scraper-kort: byggt på scrape_runs (30s efter huvudkortet) ─────────
# Egen Adaptive Card direkt från scrape_runs-tabellen (ej logg-grep): aktiva/
# inaktiva scrapers, top-producenter, källor som behöver ses över. Detacheras
# och staggras så den inte krockar visuellt med huvudkortet.
echo "" >> "$LOG_FILE"
echo "── PER-SCRAPER RAPPORT (postas om 30s) ──" >> "$LOG_FILE"
(
    sleep 30
    cd "$SCRAPER_DIR" && npm run daily-report >> "$LOG_FILE" 2>&1
) &
REPORT_PID=$!
echo "Per-scraper-rapport schemalagd (PID $REPORT_PID)" >> "$LOG_FILE"

# ─── Andra Teams-kort: kvalitet + 7-dagars trend (60s efter huvudkortet) ────
# Detacheras så vi inte blockerar exit. Sover en minut för att inte krocka
# visuellt med huvudkortet i samma Teams-tråd.
echo "" >> "$LOG_FILE"
echo "── QUALITY-STATS (postas om 60s) ──" >> "$LOG_FILE"
(
    sleep 60
    cd "$SCRAPER_DIR" && npm run quality-stats >> "$LOG_FILE" 2>&1
) &
QUALITY_PID=$!
echo "Quality-stats schemalagd (PID $QUALITY_PID, postas ~$(date -v+1M '+%H:%M' 2>/dev/null || date -d '+1 minute' '+%H:%M'))" >> "$LOG_FILE"

# ─── Tredje Teams-kort: fält-täckning PER scraper + trend (90s efter huvudkortet) ──
# quality-coverage --md skriver docs/scrapers/coverage/ÅÅÅÅ-MM-DD.md (full per-scraper-
# tabell) + lägger en rad i TREND.md (TOTAL-procenten, en rad/natt) → "koll på
# strukturen" över tid. --teams postar ett kort med TOTAL + källor under kvalitets-
# baren. Detacheras + staggras 90s så den inte krockar med de två tidigare korten.
echo "" >> "$LOG_FILE"
echo "── FÄLT-TÄCKNING PER SCRAPER (postas om 90s) ──" >> "$LOG_FILE"
(
    sleep 90
    cd "$SCRAPER_DIR" && npm run quality-coverage -- --md --teams >> "$LOG_FILE" 2>&1
) &
COVERAGE_PID=$!
echo "Fält-täckning schemalagd (PID $COVERAGE_PID)" >> "$LOG_FILE"

echo "" >> "$LOG_FILE"
echo "Klart: $(date '+%Y-%m-%d %H:%M:%S') (exit=$EXIT_CODE, duration=${DURATION}s)" >> "$LOG_FILE"

exit "$EXIT_CODE"
