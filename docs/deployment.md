# Deployment guide

CangsPlayground ships as a single service: Node serves the built web app and Socket.IO. Phase 1 keeps all lobby
state in RAM, so run exactly **one instance**.

## Production build

```bash
pnpm build
PORT=3000 PUBLIC_URL=https://your.domain LOBBY_TTL_MINUTES=180 pnpm start
```

`PUBLIC_URL` is what the QR codes point to (default: first LAN IPv4 + port, so phones on the same Wi-Fi work).

## Deploy

`Dockerfile` builds the single service; `render.yaml` is a Render blueprint (1 instance — Phase 1 state is in RAM).
Set `PUBLIC_URL` to the public HTTPS URL so QR codes point there.

## Public via Cloudflare Tunnel

Create a tunnel in the Cloudflare dashboard (Networks → Tunnels), add the public hostname `playground.fatsby.me` →
service `http://cangsplayground:3000`, then put its token in `.env` as `TUNNEL_TOKEN` (and
`TUNNEL_PUBLIC_URL=https://playground.fatsby.me`). `scripts/docker-up.sh` then also starts the `cloudflared`
container and points QR codes at the public URL. Leave `TUNNEL_TOKEN` empty to go back to LAN mode.

## Local (Docker Compose)

`scripts/docker-up.sh [port]` builds and starts the `cangsplayground` container on host port 3100 (or `HOST_PORT`
from `.env`, see `.env.example`), with `PUBLIC_URL` set to this machine's current LAN IP so phones on the same
network can scan the QR. Re-run it after the IP changes. Logs: `docker compose logs -f`; stop:
`docker compose down`. It restarts with Docker unless stopped.

## Environment variables

| Variable | Purpose |
|---|---|
| `PORT` | Port the server listens on (Dockerfile default `3000`) |
| `PUBLIC_URL` | URL the QR codes point to; must be reachable from players' phones |
| `LOBBY_TTL_MINUTES` | Lobby lifetime (default `180`) |
| `HOST_PORT` | Host port published by Docker Compose (default `3100`) |
| `TUNNEL_TOKEN`, `TUNNEL_PUBLIC_URL` | Optional Cloudflare Tunnel (see above) |

The container exposes `/healthz` for health checks.
