#!/bin/zsh
# Startar Android-emulatorn (Pixel_6) med VADKUL-appen och visar den i ett
# scrcpy-fönster.
#
# Varför scrcpy: på den här Intel-Macen blir emulatorns EGET fönster svart när
# den kör med grafikkortet (-gpu host), fast appen ritas rätt inuti. Med
# mjukvarugrafik syns bilden men datorn går på knäna (last 40+, appen slutar
# svara). scrcpy hämtar skärmen via adb och går runt det svarta fönstret.
# Felsökt 11/11 2026.
#
# Användning: scripts/android-emulator.sh        (starta + visa)
#             scripts/android-emulator.sh stopp  (stäng emulatorn)
set -u

SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
ADB="$SDK/platform-tools/adb"
EMULATOR="$SDK/emulator/emulator"
AVD="${VADKUL_AVD:-Pixel_6}"
PAKET="se.vadkul.app"
LOGG="${TMPDIR:-/tmp}/vadkul-android-emulator.log"

if [[ "${1:-}" == "stopp" ]]; then
    "$ADB" emu kill 2>/dev/null || pkill -f qemu-system-x86_64
    echo "Emulatorn stängd."
    exit 0
fi

# scrcpy: i PATH, annars det färdiga programmet från GitHub i ~/.local/scrcpy
# (Homebrew bygger allt från källkod på den här Macen - över 1,5 h, avbrutet 11/11).
SCRCPY="$(command -v scrcpy || ls -d "$HOME"/.local/scrcpy/scrcpy-macos-*/scrcpy 2>/dev/null | tail -1)"
if [[ -z "$SCRCPY" || ! -x "$SCRCPY" ]]; then
    echo "scrcpy saknas - hämta scrcpy-macos-x86_64 från github.com/Genymobile/scrcpy/releases och packa upp i ~/.local/scrcpy" >&2
    exit 1
fi
# Samma adb som emulatorn använder, annars startar scrcpy om adb-servern.
export ADB

if ! "$ADB" devices | grep -q "^emulator-.*device$"; then
    echo "Startar $AVD (kallstart tar ett par minuter) ..."
    # -no-window: emulatorns eget fönster är ändå svart, scrcpy visar bilden.
    nohup "$EMULATOR" -avd "$AVD" -gpu host -no-window -no-boot-anim -no-snapshot >"$LOGG" 2>&1 &
    disown
fi

"$ADB" wait-for-device
until [[ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; do
    sleep 3
done

# Skärmen ska inte somna (det var den "svarta skärmen" förr) och ingen låsskärm.
"$ADB" shell svc power stayon true
"$ADB" shell wm size reset
"$ADB" shell wm density reset
"$ADB" shell input keyevent KEYCODE_WAKEUP
"$ADB" shell wm dismiss-keyguard

if ! "$ADB" shell pm list packages | grep -q "$PAKET"; then
    echo "$PAKET är inte installerad i emulatorn - installera en apk med: $ADB install <fil.apk>" >&2
else
    "$ADB" shell monkey -p "$PAKET" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
fi

echo "Öppnar scrcpy. Android kan visa \"isn't responding\" första minuten efter en kallstart - tryck Wait."
exec "$SCRCPY" --window-title "VADKUL Android" --max-size 1280 --stay-awake
