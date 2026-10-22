# Phase 1 — Implementation design (CangsPlayground)

Source of truth for product: `PRD-ESL-Minigame-Platform.md`. Stack: `TECH-STACK-CangsPlayground.md`. UI: `DESIGN.md`.
This file fixes the decisions the PRD leaves open so server and web can be built in parallel.

## 0. Already in the repo (do not redesign)

| Path | What |
|---|---|
| `packages/core/src/types.ts` | `LobbyView` (the only thing a client ever receives), `Viewer`, `TimerState`, `GroupGameView`, `GameSessionView`, constants |
| `packages/core/src/events.ts` | Zod `schemas` for every C→S event, `Ack<T>`, `ErrorCode`, `C2SResults`, typed `ClientToServerEvents` / `ServerToClientEvents`, `diffView` / `applyPatch` |
| `packages/core/src/game.ts` | `GameModule` contract (server half), `GroupRuntime`, `catalogEntry()` |
| `packages/core/src/groups.ts` | `planGroupSizes`, `assignGroups`, `validatePlan`, `describePlan` (use these — client preview and server must agree) |
| `packages/core/src/teams.ts` | Team palette (DESIGN §3.8) — `teamStyle(index)`, `teamName(index)` |
| `packages/core/src/rng.ts`, `lobbyCode.ts`, `time.ts` | seeded RNG + shuffle, lobby codes, clock offset + `remainingMs` |
| `packages/games/free-talk/src/types.ts` | Free Talk config schema + data/view shapes |

All deps are installed. Workspace packages export TypeScript source directly (no build step); server runs with `tsx`, web with Vite.
If you must change a core type, keep it backward compatible and mention it in your report.

## 1. Decisions on open questions (PRD §15)

1. Turn order is reshuffled **every round** (on prepare and nextRound).
2. No projector "mirror one group" mode in Phase 1.
3. No scoring, no presets in Phase 1.
4. Deploy is out of scope for the code (needs an account); the server must run as one service: `pnpm build && pnpm start`.

## 2. Sessions, tokens, pairing

- Tokens: `crypto.randomBytes(24).toString("base64url")` (≥128-bit, NFR-06). Player ids: `nanoid`-like random 10 chars (use `crypto.randomUUID()` slice is fine).
- Server keeps a global index `token → { code, role: "host" | "player", playerId? }`.
- **Create (laptop):** `/` → [Create lobby] → `lobby:create` → store `hostToken` in `localStorage["cangsplayground:host:<CODE>"]` → navigate `/display/<CODE>`.
- **Projector:** `display:watch {code}` → socket is a `projector` viewer (public view only). If the laptop has the hostToken for this code it shows a **[Pair host phone]** button → `host:pair {code, hostToken}` → one-time `pairToken` valid **2 minutes** → QR `${PUBLIC_URL}/host/<CODE>#pair=<pairToken>`. QR is hidden when `view.hostConnected` becomes true or the token expires. This satisfies LOB-03 and the edge case "host lost phone → rescan, needs the laptop" without ever printing the real hostToken on the projector.
- **Host phone:** `/host/<CODE>#pair=…` → `host:claim` → store hostToken → `host:attach`. Without `#pair`, use the stored hostToken; none → show "Scan the host QR on the projector".
- **Player:** `/join/<CODE>` (QR target; `/join` without code shows a code input) → name → `lobby:join` → store `playerToken` in `localStorage["cangsplayground:player:<CODE>"]` → `/play/<CODE>` → `session:resume {token}` on every (re)connect. `NOT_FOUND` → clear token, go to `/join/<CODE>`.
- Same token in two tabs = same player (JOIN-03, edge case). Player is `connected` while ≥1 socket is attached; `away` after 5 min offline (NFR-05).
- Rate limit (NFR-06): per IP, max 10 failed code/token lookups per minute across `display:watch`, `lobby:join`, `host:claim`, `session:resume` → `RATE_LIMITED`.
- Names (JOIN-02): trimmed, 1–20 chars, case-insensitive unique; on clash return `NAME_TAKEN` with `suggestion` = first free `Name2`, `Name3`….
- `lobby:closed` / `session:kicked` → client clears its token and shows a plain screen ("This lobby has ended." / "You were removed by the teacher.").

## 3. Broadcasting (the security core — PRD §7, AC "DevTools")

- `apps/server/src/broadcast.ts` is the **only** place that emits `state:sync` / `state:patch`.
- For each socket: `view = buildView(lobby, viewer)`; keep the last view sent to that socket; send `diffView(last, view)` as `state:patch` (skip if null). First send after attach is `state:sync`.
- `buildView` filtering rules:

| Field | projector | host | player |
|---|---|---|---|
| players, groups, groupsVersion, status, locked, hostConnected, code | yes | yes | yes |
| `catalog`, `warnings` | `[]` | full | `[]` |
| `me` | null | null | own |
| `game.config` | null | full | null |
| `game.publicInfo` | yes | yes | yes |
| `game.groups` | all | all | own group only |
| `group.turnOrder` | null | full | own group: full |
| `group.data` | `module.viewFor(projector)` | `viewFor(host)` | `viewFor(player, isMember)` |

- Tokens never appear in any view. Tests must assert: serialised projector/player payloads contain no token strings and no `host`-tier or other players' `private` data.
- Throttle: coalesce broadcasts per lobby with `queueMicrotask` (one fan-out per tick).

## 4. Groups

- `groups:assign {mode, value, confirm?}`: players to deal = all players currently in the lobby (connected or not). Use `assignGroups` with the lobby RNG. Validate with `validatePlan(sizes, selectedGame?.minPlayersPerGroup ?? 1)` → `GROUPS_TOO_SMALL` (message from validatePlan). 0 players → `GROUPS_TOO_SMALL` "No players yet.".
- If `game.stage === "ACTIVE"` and `!confirm` → `CONFIRM_REQUIRED`. With confirm: cancel the game (set `game` back to **null** = game select screen, PRD edge case), then assign.
- If a game is only CONFIGURING it stays selected (keeps its config).
- Group ids are fresh each assign (`g1`, `g2`… plus groupsVersion suffix is fine); `index` = position → team colour.
- `groups:move {playerId, toGroupId|null}`: during an ACTIVE game remove the player from the old group's `turnOrder` (if they were the current speaker, advance as "skip"), append to the new group's `turnOrder`.
- Late joiners have `groupId: null` (JOIN-05); host warning `UNASSIGNED_PLAYERS` while groups exist and someone has no group.

## 5. Game lifecycle (core, generic — GAME-03/04/05, TMR-*)

Session: `game:select {gameId}` (only when `game` is null or CONFIGURING) → `{ stage: "CONFIGURING", config: module.defaultConfig }`. `game:configure {config}` merges into current config and parses with `module.configSchema` (allowed in any stage; timing changes apply from the next turn).

`game:control {cmd, groupId?}` — no groupId = every group where the command is valid; if no group accepts it → `INVALID_STATE`.

| cmd | from → to | effect |
|---|---|---|
| prepare | stage CONFIGURING → ACTIVE, groups → PREPARED | requires groups; validatePlan with module min; per group: turnOrder = shuffle(members) repeated `turnsPerPlayer` times, turnIndex 0, timer idle, `data = module.prepare()` |
| start | PREPARED → RUNNING | current turn timer `endsAt = now + turnDurationMs` |
| pause / resume | RUNNING ⇄ PAUSED | `pausedRemainingMs = endsAt − now` / `endsAt = now + pausedRemainingMs` |
| skip | RUNNING, PAUSED | advance turn (a paused group stays paused with a full fresh turn) |
| extend | RUNNING, PAUSED | +30 s to endsAt or pausedRemainingMs, and to durationMs |
| endRound | PREPARED, RUNNING, PAUSED → ROUND_END | timer idle |
| reveal | ROUND_END | `revealed = true` |
| nextRound | ROUND_END → PREPARED | round+1, reshuffle, `module.prepare()`, revealed false |
| exit | any | `game = null` (back to game select; groups kept — GAME-06) |

- Advance turn: `module.onTimerEnd` (only on timer expiry) → `turnIndex++`; past the end → ROUND_END. Timer of a RUNNING group restarts for the new speaker.
- `game:action {type:"turn:done"}` from the current speaker of a RUNNING group → advance (TMR-05). Other types → `module.onAction`, null → `INVALID_STATE`.
- A disconnected speaker keeps the turn (TMR-06).
- TimerService: one `setTimeout` per running group keyed by `endsAt`; inject a clock (`now()`) so tests can use fake timers. Emit `time:sync {serverNow}` to every socket every 30 s.
- Kicked / leaving player who is in an ACTIVE group's turnOrder: remove them (advance if current) and add host warning `PLAYER_LEFT_MID_ROUND` (clears on nextRound/exit/assign).

## 6. Lobby

- Code: `generateLobbyCode` until unused. Max 60 players (`LOBBY_FULL`), locked → `LOBBY_LOCKED` for *new* joins only (resume still works).
- `lastActiveAt` bumps on every accepted command / join / resume. Sweep every 60 s; idle > `LOBBY_TTL_MINUTES` (default 180) → close with reason `expired`. `lobby:close` → reason `host`. Closing deletes the lobby and all its tokens (NFR-07).
- Idempotency: per lobby keep the last 200 `commandId → ack`; a repeat returns the stored ack without re-running.

## 7. Server layout (`apps/server`)

```
src/index.ts            Fastify + Socket.IO; GET /healthz; GET /api/config → { publicUrl };
                        production: serve apps/web/dist with SPA fallback (index.html)
src/config.ts           PORT (3000), PUBLIC_URL (default http://<first LAN IPv4>:PORT), LOBBY_TTL_MINUTES
src/lobby/LobbyManager.ts   lobbies, token index, expiry sweep
src/lobby/Lobby.ts      state + pure-ish command methods (unit-testable without sockets)
src/auth/               tokens, pairing, rate limiter
src/handlers/           lobby.ts, groups.ts, game.ts, session.ts — validate with core `schemas`, check role, call Lobby, ack
src/timer/TimerService.ts
src/games/registry.ts   gameId → GameModule  (adding a game = one import line here)
src/broadcast.ts        buildView + per-socket diff + emit
test/                   vitest: lobby/groups/lifecycle unit tests, viewFor filtering, socket integration (30 clients)
scripts/simulate.ts     `pnpm --filter @cangsplayground/server sim -- --url http://localhost:3000 --clients 30`
```

## 8. Web layout (`apps/web`, `packages/ui`)

- Routes (React Router): `/` (create lobby / enter code), `/join` and `/join/:code`, `/play/:code`, `/host/:code`, `/display/:code`. Lazy-load each route so the Player bundle stays < 200 KB gzip (NFR-04) — QR libs only in display/host chunks.
- `src/socket/`: one `socket.io-client` per tab; on every `connect` re-run the role's attach (`display:watch` / `host:attach` / `session:resume`); `time:sync` 5 probes on connect (keep min-RTT sample via `clockSample`), again every 30 s and on server beacon.
- `src/store/`: Zustand — `view`, `connection: "connecting" | "online" | "reconnecting"`, `offset`, `serverNow()`.
- Dev: Vite on 5173 proxies `/socket.io` and `/api` to `http://localhost:3000` (ws: true); `server.host: true` so phones on the LAN can open it.
- Projector: lobby code + join QR + join list (JOIN-06); after assign: group grid with shuffle animation on `groupsVersion` change (GRP-07); during game: per group speaker, next, timer, round + `publicInfo`. Never secrets.
- Host Console: tabs Players / Groups / Game / Secrets per PRD §6.6; Groups tab has mode switch + value + live `describePlan` preview + validate; [Assign groups] / [Re-assign] (Drawer confirm when a game is active → resend with confirm). Game tab: catalog cards → config form rendered from `configFields` → lifecycle buttons (all groups + per-group). Secrets: per group, module `HostGroupPanel`, hidden until press-and-hold.
- Player: waiting room (name, count, "Waiting for the teacher to make groups"); full-screen team colour + team name + members after assign; game: module `PlayerScreen`, YOUR TURN takeover + `navigator.vibrate` (TMR-03), [Done] button for current speaker; "Reconnecting…" banner.
- `packages/ui`: DESIGN.md components (Panel, Button, TeamBadge, GroupCard, Timer, TurnIndicator, YourTurn, SecretCard/FlipCard, LobbyCodeDisplay, …) + `GameViews` type:

```ts
export interface GameViewProps { lobby: LobbyView; session: GameSessionView; group: GroupGameView; serverNow: () => number }
export interface GameViews {
  ProjectorGroupCard?: React.ComponentType<GameViewProps>; // extra body inside the core group card
  HostGroupPanel?: React.ComponentType<GameViewProps>;     // Secrets tab
  PlayerScreen: React.ComponentType<GameViewProps & { me: NonNullable<LobbyView["me"]> }>;
  ProjectorHeader?: React.ComponentType<{ session: GameSessionView }>; // public info, e.g. prompt
}
```
- `apps/web/src/games/registry.ts`: `gameId → GameViews` (adding a game = one import line here).

## 9. Definition of done for Phase 1 (PRD §17 mapped to checks)

| AC | Check |
|---|---|
| 24 phones join via QR | manual; QR encodes `${publicUrl}/join/<CODE>`; simulate.ts joins 30 |
| 4 groups shown < 1 s, projector matches | integration test: assign → every player socket's `me.groupId` matches the projector view |
| max 7 with 24 → 6,6,6,6 | core unit test |
| reload mid-game → same group, turn, timer ±1 s | integration test: disconnect a player socket mid-turn, resume, compare `timer.endsAt` |
| DevTools shows no host/private data | broadcast tests on serialised payloads |
| change game / re-assign many times | integration test loop |
| 2nd game = new package + registry | `packages/games/secret-word` (private word per speaker) registered in both registries |
