#!/usr/bin/env bash
# Démarre UN serveur de production sur le build courant, et refuse de rendre la main
# tant qu'un chunk statique n'est pas réellement servi comme du JavaScript.
set -u
cd "$(dirname "$0")/../.."
S="$(mktemp -d)"
for p in $(pgrep -f "next-server" 2>/dev/null); do kill -9 "$p" 2>/dev/null; done
for p in $(pgrep -f "next/dist/bin/next" 2>/dev/null); do kill -9 "$p" 2>/dev/null; done
for i in $(seq 1 15); do
  c=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://127.0.0.1:3000/connexion 2>/dev/null)
  [ "$c" = "000" ] && break
  sleep 1
done
rm -f "$S/start.log"
set -a; . ./.env.local; set +a
setsid nohup node node_modules/next/dist/bin/next start -p 3000 > "$S/start.log" 2>&1 < /dev/null &
for i in $(seq 1 40); do
  c=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://127.0.0.1:3000/connexion 2>/dev/null)
  [ "$c" = "200" ] && break
  sleep 1
done
chunk=$(curl -s --max-time 10 http://127.0.0.1:3000/connexion | grep -o '/_next/static/chunks/[^"]*\.js' | head -1)
ct=$(curl -s -o /dev/null -w "%{content_type}" --max-time 10 "http://127.0.0.1:3000$chunk")
echo "build      : $(cat .next/BUILD_ID)"
echo "page      : $c"
echo "chunk     : $chunk"
echo "type servi: $ct"
case "$ct" in *javascript*) echo "OK banc sain";; *) echo "ÉCHEC : le serveur ne sert pas ce build"; exit 1;; esac
