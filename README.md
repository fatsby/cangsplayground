# CangsPlayground — Phase 1 prototype

Real-time minigame platform for the ESL Speaking Club. Specs: `docs_v3/prototype/` (PRD, TECH-STACK, DESIGN, PHASE1-IMPLEMENTATION).

```bash
corepack enable pnpm      # pnpm 12
pnpm install
pnpm test                 # core, games, server, web
```

## Run

Development (server :3000, Vite :5173 with proxy):

```bash
pnpm dev
# if :3000 is taken
PORT=3100 pnpm --filter @cangsplayground/server dev
CANGSPLAYGROUND_SERVER_URL=http://localhost:3100 pnpm --filter @cangsplayground/web dev
```

Production (one service — Node serves the built web app + Socket.IO):

```bash
pnpm build
PORT=3000 PUBLIC_URL=https://your.domain LOBBY_TTL_MINUTES=180 pnpm start
```

`PUBLIC_URL` is what the QR codes point to (default: first LAN IPv4 + port, so phones on the same Wi-Fi work).
Load check: `pnpm --filter @cangsplayground/server sim -- --url http://localhost:3000 --clients 30`.

## Acceptance (PRD §17)

`pnpm acceptance http://localhost:3000 [screenshot-dir]` drives 24 emulated phones that join only by decoding the
projector QR, then checks group display time, max-size split, YOUR TURN + vibrate, reload mid-turn, token leaks and
repeated re-assign / game change. Needs Chromium (`CHROMIUM_PATH=…` or `pnpm exec playwright-core install chromium`).

## Deploy

`Dockerfile` builds the single service; `render.yaml` is a Render blueprint (1 instance — Phase 1 state is in RAM).
Set `PUBLIC_URL` to the public HTTPS URL so QR codes point there.

**Public via Cloudflare Tunnel:** create a tunnel in the Cloudflare dashboard (Networks → Tunnels), add the public
hostname `playground.fatsby.me` → service `http://cangsplayground:3000`, then put its token in `.env` as `TUNNEL_TOKEN`
(and `TUNNEL_PUBLIC_URL=https://playground.fatsby.me`). `scripts/docker-up.sh` then also starts the `cloudflared`
container and points QR codes at the public URL. Leave `TUNNEL_TOKEN` empty to go back to LAN mode.

**Local (Docker Compose):** `scripts/docker-up.sh [port]` builds and starts the `cangsplayground` container on host port
3100 (or `HOST_PORT` from `.env`, see `.env.example`), with `PUBLIC_URL` set to this machine's current LAN IP so phones
on the same network can scan the QR. Re-run it after the IP changes. Logs: `docker compose logs -f`; stop:
`docker compose down`. It restarts with Docker unless stopped.

## Views

| Route | Who |
|---|---|
| `/` | Laptop: create a lobby, or enter a code |
| `/display/:code` | Projector (public info only); "Pair host phone" QR |
| `/host/:code` | Teacher phone (opened from the pairing QR) |
| `/join/:code` → `/play/:code` | Students |

## Adding a game

Create `packages/games/<id>` exporting a `GameModule` (`.`) and `GameViews` (`./views`), then add one line to
`apps/server/src/games/registry.ts` and `apps/web/src/games/registry.ts`. `packages/games/secret-word` is the example.

## Guess the Character

Groups play in pairs, all at the same time. Make an **even number of groups** (at least 2); a group can have a single
player and the two groups in a pair can differ in size. Each round, every pair votes for one of nine categories, then
each team gets a different secret character (hold the card to see it). Teams take turns asking; inside each team the
members rotate. One **turn time** (default 120 s) covers a question and its answer, and only the current questioner
can tap **I'm done** to end it early. Anyone in a pair can type a guess at any time; a wrong guess locks the whole team
for the **wrong guess cooldown** (default 5 s). The host can pause, skip or end each match, and starts a New round
once every match is over. Vote, turn and cooldown times are set before Prepare; timers run on the server.
