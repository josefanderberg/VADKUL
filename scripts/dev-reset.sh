#!/usr/bin/env bash
# dev-reset.sh — Ren omstart av Next dev-servern.
#
# Varför: port 3000 hålls ofta av Claude-skrivbordsappen, så `next dev` hoppar
# till en annan port medan webbläsarfliken står kvar på :3000 → ChunkLoadError
# (chunkar hämtas från fel server). Dessutom kan dubbletter av dev-servrar bli
# kvar och slåss om portar. Det här skriptet städar och startar på en FAST port.
#
# Användning:
#   bash scripts/dev-reset.sh           # döda strays + rensa .next + starta (port 3001)
#   bash scripts/dev-reset.sh --check   # visa bara läget, döda inget
#   bash scripts/dev-reset.sh --no-start# döda + rensa men starta inte
#   PORT=3010 bash scripts/dev-reset.sh # annan port
set -uo pipefail

PORT="${PORT:-3001}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$ROOT/apps/web"

list_state() {
  echo "🔎 Next-processer:"
  ps ax -o pid=,command= | grep -E "next dev|next-server" | grep -v grep || echo "  (inga)"
  echo "🔌 Portar:"
  for p in 3000 3001 3002 3010; do
    pid=$(lsof -ti tcp:$p 2>/dev/null | head -1)
    if [ -n "$pid" ]; then echo "  $p: $(ps -o comm= -p "$pid" 2>/dev/null)"; else echo "  $p: fri"; fi
  done
}

if [ "${1:-}" = "--check" ]; then
  list_state
  exit 0
fi

echo "🧹 Dödar kvarglömda Next dev-servrar (rör ej Claude-appen)..."
pids=$(ps ax -o pid=,command= | grep -E "next dev|next-server" | grep -vi claude | grep -v grep | awk '{print $1}')
if [ -n "$pids" ]; then
  echo "$pids" | xargs kill -9 2>/dev/null || true
  echo "  dödade: $(echo "$pids" | tr '\n' ' ')"
else
  echo "  inga att döda"
fi

# Frigör vald port om något ICKE-Claude håller den.
pid=$(lsof -ti tcp:"$PORT" 2>/dev/null | head -1)
if [ -n "$pid" ]; then
  comm=$(ps -o comm= -p "$pid" 2>/dev/null)
  case "$comm" in
    *Claude*) echo "⚠️  Port $PORT hålls av Claude-appen. Välj en annan: PORT=3010 bash scripts/dev-reset.sh"; exit 1;;
    *) echo "  frigör port $PORT (pid $pid, $comm)"; kill -9 "$pid" 2>/dev/null || true;;
  esac
fi

echo "🗑️  Rensar byggcache: $WEB/.next"
rm -rf "$WEB/.next"

if [ "${1:-}" = "--no-start" ]; then
  echo "✅ Klart (startar inte). Kör 'npm run dev:reset' för att starta."
  exit 0
fi

echo ""
echo "🚀 Startar dev-servern på  →  http://localhost:$PORT"
echo "   Öppna EXAKT den URL:en (inte :3000 — den hålls av Claude-appen)."
echo ""
cd "$WEB" && exec npx next dev -p "$PORT"
