# ClubPlay — Phase 1 prototype

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
PORT=3100 pnpm --filter @clubplay/server dev
CLUBPLAY_SERVER_URL=http://localhost:3100 pnpm --filter @clubplay/web dev
```

Production (one service — Node serves the built web app + Socket.IO):

```bash
pnpm build
PORT=3000 PUBLIC_URL=https://your.domain LOBBY_TTL_MINUTES=180 pnpm start
```

`PUBLIC_URL` is what the QR codes point to (default: first LAN IPv4 + port, so phones on the same Wi-Fi work).
Load check: `pnpm --filter @clubplay/server sim -- --url http://localhost:3000 --clients 30`.

## Acceptance (PRD §17)

`pnpm acceptance http://localhost:3000 [screenshot-dir]` drives 24 emulated phones that join only by decoding the
projector QR, then checks group display time, max-size split, YOUR TURN + vibrate, reload mid-turn, token leaks and
repeated re-assign / game change. Needs Chromium (`CHROMIUM_PATH=…` or `pnpm exec playwright-core install chromium`).

## Deploy

`Dockerfile` builds the single service; `render.yaml` is a Render blueprint (1 instance — Phase 1 state is in RAM).
Set `PUBLIC_URL` to the public HTTPS URL so QR codes point there.

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
