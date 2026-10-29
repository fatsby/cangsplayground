# Development guide

Specs for the platform live in `docs_v3/prototype/` (PRD, TECH-STACK, DESIGN, PHASE1-IMPLEMENTATION).

## Setup

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

Production-style run (one service — Node serves the built web app + Socket.IO) is described in the
[Deployment guide](deployment.md#production-build).

Load check: `pnpm --filter @cangsplayground/server sim -- --url http://localhost:3000 --clients 30`.

## Acceptance (PRD §17)

`pnpm acceptance http://localhost:3000 [screenshot-dir]` drives 24 emulated phones that join only by decoding the
projector QR, then checks group display time, max-size split, YOUR TURN + vibrate, reload mid-turn, token leaks and
repeated re-assign / game change. Needs Chromium (`CHROMIUM_PATH=…` or `pnpm exec playwright-core install chromium`).

## Adding a game

Create `packages/games/<id>` exporting a `GameModule` (`.`) and `GameViews` (`./views`), then add one line to
`apps/server/src/games/registry.ts` and `apps/web/src/games/registry.ts`. `packages/games/secret-word` is the example.

## Repository layout

| Path | Contents |
|---|---|
| `apps/server` | Fastify + Socket.IO server: lobbies, pairing/auth, groups, server-side timers |
| `apps/web` | React web app: home, projector, host console and player routes |
| `packages/core` | Shared types, events, grouping, RNG, time and avatar helpers, the `GameModule` contract |
| `packages/ui` | Shared UI components, styles and design tokens |
| `packages/games/*` | One package per minigame |
| `scripts/` | `acceptance.mjs` and `docker-up.sh` |

## Documentation screenshots

The images in `docs/assets/screenshots/` were captured from a local production build with Playwright (8 emulated
players, 2 teams) and compressed. Re-capture them after visible UI changes.
