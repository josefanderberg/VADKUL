#!/usr/bin/env bash
# dev-guard.sh - stoppar en ANDRA dev-server innan den hinner starta.
#
# Varför: `next dev` tömmer hela apps/web/.next (allt utom cache/) i samma
# stund som den startar (HotReloaderWebpack.clean). Kör det redan en
# dev-server där försvinner dess filer under den: själva sidan svarar 200,
# men event-API:t ger 500 ("Cannot find module './vendor-chunks/...'"),
# main-app.js ger 404 och kartan fastnar på "Laddar event…". Den andra
# servern behöver inte ens bli kvar - det räcker att den startade.
# Hände 21/11 2026 (#269).
#
# Körs som predev i apps/web/package.json (alltså av både `npm run dev` i
# roten och i apps/web) och före `next dev` i .claude/launch.json.
#
# Släpper igenom vid minsta tvekan (processlistan går inte att läsa o.s.v.):
# vakten får aldrig vara skälet till att dev inte startar.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
WEB="$ROOT/apps/web"

running=""
while read -r pid args; do
  # Bara själva serverprocesserna: `node …/next dev` och dess barn
  # `next-server`. Skalet som kör den här raden har också "next dev" i sin
  # kommandorad (launch.json) och får inte räknas.
  if [[ "$args" == next-server* ]] || [[ "$args" =~ ^([^[:space:]]*/)?node[[:space:]].*next[[:space:]]dev ]]; then
    cwd=$(lsof -a -d cwd -p "$pid" -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)
    [ "$cwd" = "$WEB" ] && running="$running $pid"
  fi
done < <(ps ax -o pid=,args= 2>/dev/null)

[ -z "$running" ] && exit 0

port=""
for pid in $running; do
  p=$(lsof -nP -a -iTCP -sTCP:LISTEN -p "$pid" -Fn 2>/dev/null | sed -n 's/^n.*://p' | head -1)
  if [ -n "$p" ]; then port="$p"; break; fi
done

echo ""
echo "⛔ Dev-servern kör redan${port:+ på http://localhost:$port} (pid$running)."
echo "   En andra hade tömt apps/web/.next under den och gjort den trasig."
echo "   Använd den som kör, eller stoppa den först (npm run dev:reset startar om rent)."
echo ""
exit 1
