#!/usr/bin/env bash
# klipp-till-minin.sh - skicka Grok-klipp från MacBooken till dagsinläggets
# inkorg på Mac minin. Vägen för klipp över 20 MB (Telegrams gräns för
# botar) eller när man genererat i batch på datorn.
#
#   npm run klipp-till-minin              (apps/scraper)
#
# Lägg klippen i ~/Movies/VADKUL-grok/inkorg/ först, gärna med temat i
# namnet så inkorgen förstår dem: ikvall, allt, hitta-pa, fredag, bjud-med,
# regnig, skapa-eget, helg-<stad>. Andra namn blir "okant" och granskaren
# får klassa dem. Filer som redan finns på minin skickas inte igen.
set -euo pipefail

KALLA="${VADKUL_GROK_INKORG:-$HOME/Movies/VADKUL-grok/inkorg}"
MAL="mini:~/Repos/VADKUL/apps/scraper/dagsinlagg/inkorg/"

if [ ! -d "$KALLA" ]; then
    echo "Ingen mapp $KALLA. Skapa den och lägg klippen (mp4/mov) där." >&2
    exit 1
fi

antal=$(find "$KALLA" -maxdepth 1 \( -iname '*.mp4' -o -iname '*.mov' \) | wc -l | tr -d ' ')
if [ "$antal" = "0" ]; then
    echo "Inga klipp i $KALLA."
    exit 0
fi

ssh mini 'mkdir -p ~/Repos/VADKUL/apps/scraper/dagsinlagg/inkorg'
echo "Skickar $antal klipp till minin ..."
rsync -av --ignore-existing --include='*.mp4' --include='*.MP4' --include='*.mov' --include='*.MOV' --exclude='*' "$KALLA/" "$MAL"
echo "Klart. Klippen granskas nästa morgon 07:00 (eller: ssh mini och kör npm run dagsinlagg -- --provkör --tema=video)."
