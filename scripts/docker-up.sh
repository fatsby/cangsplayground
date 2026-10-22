#!/usr/bin/env bash
# Build and start CangsPlayground in Docker with PUBLIC_URL set to this machine's current LAN IP,
# or, when TUNNEL_TOKEN is set in .env, behind the Cloudflare Tunnel with PUBLIC_URL=TUNNEL_PUBLIC_URL.
# Usage: scripts/docker-up.sh [host-port]   (default 3100, or HOST_PORT from .env)
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] && set -a && . ./.env && set +a
port="${1:-${HOST_PORT:-3100}}"
ip="$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "src") print $(i + 1)}')"
ip="${ip:-$(hostname -I | awk '{print $1}')}"

export HOST_PORT="$port" PUBLIC_URL="http://${ip}:${port}"
if [ -n "${TUNNEL_TOKEN:-}" ]; then
  export PUBLIC_URL="${TUNNEL_PUBLIC_URL:?set TUNNEL_PUBLIC_URL in .env}" COMPOSE_PROFILES=tunnel
fi
docker compose up -d --build
echo "CangsPlayground: ${PUBLIC_URL}  (local: http://localhost:${port})"
