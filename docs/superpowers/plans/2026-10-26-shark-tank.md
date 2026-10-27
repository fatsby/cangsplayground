# Shark Tank Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the "Shark Tank" minigame. Each group pitches a weird product and sets a price. The other groups ask questions, haggle, then decide together how many to buy from a shared group wallet. The highest score wins. To support this, the core gains optional **session-wide shared state**, which lets one group act on another group's data.

**Architecture:**
- **Core.** `GameModule` gets optional "shared" hooks: `prepareShared`, `onSharedAction`, `onSharedPlayerLeft`, `sharedViewFor`, `validateGroups`. `Lobby` stores `game.shared`, routes player `game:action` and a new host event `game:hostAction` to the module, and `buildView` filters the shared state per viewer. Games that do not declare the hooks behave exactly as before.
- **Shark Tank logic.** The whole game lives in shared state. Per-group runtimes stay `PREPARED` and are unused. Stage timers are display-only (state on the server, countdown on the client). Nothing auto-advances on expiry, so `TimerService` does not change.
- **Web.** `GameViews` gets three optional session-level slots: `ProjectorScreen`, `HostSessionPanel`, `PlayerSessionScreen`. The routes render those instead of the group-centric UI when a game provides them.

**Tech Stack:** TypeScript, zod 4, Socket.IO, React 19, Vitest 5 (happy-dom + `renderToStaticMarkup` for views), pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-10-26-shark-tank-design.md`

## Global Constraints

- Every UI string is in English. Keyword meanings in the idea cards are Vietnamese (content only).
- Style: Arcade Night, using the existing tokens and components in `packages/ui`. Only add CSS where no existing component covers the need.
- Group size: 2–5 (`minPlayersPerGroup: 2`, `maxPlayersPerGroup: 5`). At least 2 groups. Breaking either blocks Prepare with `GROUPS_TOO_SMALL`.
- Config defaults (all host-editable before Prepare): `prepMinutes` 15, `pitchSeconds` 120, `qaSeconds` 180, `huddleSeconds` 90, `moneyPerMember` 100, `minPrice` 10, `maxPrice` 60, `minSpendPercent` 60, `noQuestionPenalty` 20.
- Group wallet = `moneyPerMember × members at Prepare`. Max quantity per product = members at Prepare, further capped by `floor(wallet / price)`.
- Timers never auto-advance a stage. The teacher presses Next. The only automatic step is locking a group's vote once every required voter has voted. That check runs again when a player connects or disconnects.
- A game with `onSharedAction` uses only its own host actions. `Lobby.control` rejects every core control except `prepare` and `exit`, and the web hides the core control bar for it.
- A disconnect does **not** move a student's parts. Only leaving or being kicked does, so a phone that drops for a few seconds doesn't reshuffle the pitch **(deviation from spec §8, Claude's call)**.
- Quantities bought, wallets and revenue never reach the projector or another group before `RESULTS`. Filter in `sharedViewFor` on the server. Hiding them in the UI is not enough.
- Free Talk, Secret Word and Who's the Spy behave exactly as before. All existing tests must pass.
- Commands: `pnpm test`, `pnpm typecheck`, `pnpm lint`. Run a single package with `pnpm --filter <name> test`.

## Review Focus

1. **A student leaves mid-huddle, and everyone left has already voted.** The group's vote locks right away, using only the remaining members' votes. Their parts move to the teammate with the fewest parts. Test added in Task 6.
2. **Nobody in the buying lobby has a socket** (server tests, or a projector-only rehearsal). "Required voters" falls back to all current members, so votes don't lock instantly with zero votes. Test added in Task 6.
3. **The presenting group lowers its price after another group has already voted.** It can't: discounts only happen in `QA`, and votes only in `HUDDLE`. A purchase always records the price at lock time. Test added in Task 6.
4. **The teacher double-taps Next.** `hostCommand` makes a new `commandId` per call, so idempotency doesn't help. `st:next` carries `{ from: Stage, presenterIndex }`, and a stale press returns `null`, so it can't skip Q&A. The panel also disables its buttons while `busy`. Test added in Task 5.
5. **The projector reconnects during HUDDLE or DECISION.** Its `state:sync` payload has no `votes`, `wallet`, `purchases` or `revenue` for any group. Test added in Task 8.

---

## File map

| File | Change |
|---|---|
| `packages/core/src/game.ts` | `RosterEntry`, `SharedArgs`; optional `GameModule` hooks `prepareShared`, `onSharedAction`, `onSharedPlayerLeft`, `sharedViewFor`, `validateGroups`; third generic `Shared` |
| `packages/core/src/types.ts` | `GameSessionView.shared?: unknown` |
| `packages/core/src/events.ts` | `game:hostAction` schema + result |
| `apps/server/src/lobby/Lobby.ts` | `Session.shared`, `hostAction()`, routing in `action()`, `removePlayer()`, `move()`, `control("prepare")` |
| `apps/server/src/broadcast.ts` | `game.shared` via `sharedViewFor` |
| `apps/server/src/handlers/game.ts` | register `game:hostAction` |
| `apps/server/test/shared-state.test.ts` + `shared-game.ts` | core tests with a test-only module |
| `packages/ui/src/game-views.ts` | `SessionViewProps`; slots `ProjectorScreen`, `HostSessionPanel`, `PlayerSessionScreen` |
| `apps/web/src/routes/Display.tsx`, `Host.tsx`, `Player.tsx`, `components/HostGame.tsx` | render the session slots; `hostAct` |
| `apps/web/test/session-slots.test.tsx` | shell tests for the slots |
| `packages/games/shark-tank/**` | new package: data, types, phrases, rules, logic, views, css, tests |
| `apps/server/src/games/registry.ts`, `apps/web/src/games/registry.ts`, both `package.json` | register the game |
| `apps/server/test/shark-tank.test.ts` | full-game + socket privacy tests |

---

### Task 1: Core shared-state contract

**Files:**
- Modify: `packages/core/src/game.ts`, `packages/core/src/types.ts`, `packages/core/src/events.ts`
- Modify: `apps/server/src/lobby/Lobby.ts`, `apps/server/src/broadcast.ts`, `apps/server/src/handlers/game.ts`
- Create: `apps/server/test/shared-game.ts`, `apps/server/test/shared-state.test.ts`

**Interfaces:**
- Produces (in `packages/core/src/game.ts`, exported from `@cangsplayground/core`):
  ```ts
  export interface RosterEntry { playerId: PlayerId; groupId: GroupId | null; connected: boolean }
  export interface SharedArgs<Config, Shared> {
    config: Config; shared: Shared; roster: RosterEntry[]; now: number; rng: Rng;
  }
  // added to GameModule<Config = any, Data = any, Shared = any>:
  validateGroups?(args: { config: Config; groups: GroupSummary[] }): string | null;
  prepareShared?(args: { config: Config; groups: GroupContext[]; rng: Rng; now: number }): Shared;
  /** Player game:action (except turn:done) and host game:hostAction. Return null to reject. */
  onSharedAction?(args: SharedArgs<Config, Shared> & { action: GameAction; actor: Viewer }): Shared | null;
  onSharedPlayerLeft?(args: SharedArgs<Config, Shared> & { playerId: PlayerId; groupId: GroupId | null }): Shared;
  /** A player connected or disconnected (roster.connected changed). */
  onSharedRosterChange?(args: SharedArgs<Config, Shared>): Shared;
  /** REQUIRED when prepareShared is declared: filter shared state for this viewer (PRD §7). */
  sharedViewFor?(args: { config: Config; shared: Shared; viewer: Viewer; viewerGroupId: GroupId | null }): unknown;
  ```
- Produces: `GameSessionView.shared?: unknown` (server always sets it, `null` when the module has no `sharedViewFor`).
- Produces: event `"game:hostAction": z.object({ type: z.string().min(1).max(64), payload: z.unknown().optional(), commandId })`, with `C2SResults["game:hostAction"] = undefined`. Registered as a host command (`on(..., true)`), calling `hostLobby(ctx).hostAction({ type, payload })`.
- Produces: `Lobby.hostAction(action: GameAction): void`, which ends with `this.changed()` like `action()`. Also `Session.shared: unknown` (`null` until Prepare).
- Produces: `Lobby.connectionChanged(): void`. When a shared game is ACTIVE and declares `onSharedRosterChange`, it calls the hook and then `changed()`. In `apps/server/src/index.ts`, call it from the attach and detach paths, after the player's `sockets` set has been updated.
- Modifies: `apps/server/src/index.ts` (attach/detach).

- [ ] **Step 1: Write the test module `apps/server/test/shared-game.ts`**

  `sharedGame: GameModule<Record<string, never>, null, { log: string[] }>` with `id: "test-shared"`, `minPlayersPerGroup: 1`, `turnDurationMs: () => null`, and:
  - `prepare: () => null`
  - `prepareShared: ({ groups }) => ({ log: [\`prepared:${groups.length}\`] })`
  - `onSharedAction: ({ shared, action, actor, roster }) => (action.type === "reject" ? null : { log: [...shared.log, \`${actor.kind}:${action.type}:${roster.length}\`] })`
  - `onSharedPlayerLeft: ({ shared, playerId, roster }) => ({ log: [...shared.log, \`left:${playerId}:${roster.length}\`] })`
  - `onSharedRosterChange: ({ shared, roster }) => ({ log: [...shared.log, \`roster:${roster.filter((r) => r.connected).length}\`] })`
  - `sharedViewFor: ({ shared, viewer }) => (viewer.kind === "projector" ? null : shared)`
  - `validateGroups: ({ groups }) => (groups.length < 2 ? "Make at least 2 groups." : null)`

  Plus `setupShared(n = 4, groups = 2)`, mirroring `setupVote` in `vote-game.ts`.

- [ ] **Step 2: Write the failing tests in `apps/server/test/shared-state.test.ts`**

  ```ts
  it("prepare stores prepareShared output", () => {
    const { lobby } = setupShared();
    expect(lobby.game!.shared).toEqual({ log: ["prepared:2"] });
  });
  it("validateGroups blocks prepare", () => {
    // 3 players, 1 group: selectGame + assign("count", 1)
    expect(() => lobby.control("prepare")).toThrow(/at least 2 groups/);
  });
  it("routes player actions (not turn:done) to onSharedAction with the roster", () => {
    lobby.action(players[0]!.id, { type: "ping" });
    expect(lobby.game!.shared).toEqual({ log: ["prepared:2", "player:ping:4"] });
  });
  it("rejects when onSharedAction returns null", () => {
    expect(() => lobby.action(players[0]!.id, { type: "reject" })).toThrow();
  });
  it("hostAction routes with a host actor; fails for modules without onSharedAction", () => {
    lobby.hostAction({ type: "next" });
    expect((lobby.game!.shared as { log: string[] }).log.at(-1)).toBe("host:next:4");
    // with voteGame (setupVote): expect(() => lobby.hostAction({ type: "next" })).toThrow();
  });
  it("core controls other than prepare/exit are rejected for a shared game", () => {
    for (const cmd of ["start", "pause", "resume", "skip", "extend", "endRound", "reveal", "nextRound"] as const)
      expect(() => lobby.control(cmd)).toThrow(/own controls/);
    expect(lobby.game!.groups.every((g) => g.phase === "PREPARED")).toBe(true);
  });
  it("removePlayer calls onSharedPlayerLeft with a roster without the leaver, and leaves runtimes/warnings alone", () => {
    lobby.removePlayer(players[1]!.id);
    expect(log.at(-1)).toBe(`left:${players[1]!.id}:3`);
    expect(lobby.warnings).toEqual([]);
    expect(lobby.game!.groups.every((g) => g.phase === "PREPARED")).toBe(true);
  });
  it("connectionChanged calls onSharedRosterChange", () => {
    lobby.players.get(players[0]!.id)!.sockets.add("s1");
    lobby.connectionChanged();
    expect(log.at(-1)).toBe("roster:1");
  });
  it("configure is rejected while a shared game is active", () => {
    expect(() => lobby.configure({})).toThrow(/Exit the game/);
  });
  it("move is blocked while a shared game is active", () => {
    expect(() => lobby.move(players[0]!.id, otherGroupId)).toThrow(/Exit the game/);
  });
  it("buildView exposes filtered shared state", () => {
    expect(buildView(lobby, { kind: "projector" }).game!.shared).toBeNull();
    expect(buildView(lobby, { kind: "host" }).game!.shared).toEqual({ log: ["prepared:2"] });
    // voteGame session: expect(buildView(...).game!.shared).toBeNull()
  });
  ```

- [ ] **Step 3: Run the tests and confirm they fail**

  Run: `pnpm --filter @cangsplayground/server test shared-state`
  Expected: FAIL. `prepareShared` is never called, and `hostAction` is not a function.

- [ ] **Step 4: Implement the contract**

  - Add the types and hooks above to `game.ts`, `shared?: unknown` to `GameSessionView`, and the schema and result to `events.ts`.
  - In `Lobby`:
    - `private roster(): RosterEntry[]` built from `this.players`, with `connected = sockets.size > 0`.
    - In `control("prepare")`, after `validateGroups`: call `module.validateGroups?.({ config, groups: this.groups })`. A message fails with `GROUPS_TOO_SMALL`. Then `game.shared = module.prepareShared?.({ config, groups: game.groups.map(g => ({ groupId: g.groupId, playerIds: activePlayers(g), round: 1 })), rng: this.rng, now: this.now() }) ?? null`.
    - In `action()`, for any type other than `turn:done`, when `module.onSharedAction` exists: call it with `actor: { kind: "player", playerId }`. `null` fails `INVALID_STATE` with "This action is not ready.". Otherwise store the result in `game.shared`.
    - `hostAction()`: fail `INVALID_STATE` when there is no active game or no `onSharedAction`. Otherwise do the same as above with `actor: { kind: "host" }`.
    - In `removePlayer()`: for a module with `onSharedAction`, skip the existing per-group block (the warning, `removeTurns`, `onPlayerLeft`). Instead, when stage is `ACTIVE` and `onSharedPlayerLeft` exists, call it before the player is deleted. Pass `groupId: player.groupId` and a roster that already excludes the leaver.
    - In `control()`: right after the `prepare`/`exit` branches, a module with `onSharedAction` fails `INVALID_STATE` with "This game uses its own controls.".
    - In `move()`: extend the existing `voteDurationMs` guard to `|| this.game.module.onSharedAction`.
    - In `configure()`: when stage is `ACTIVE` and the module has `onSharedAction`, fail `INVALID_STATE` with "Exit the game to change settings.".
    - `connectionChanged()`, as in Interfaces.
  - In `buildView`, add `shared` next to `publicInfo`: `structuredClone(sharedViewFor(...))`, with `viewerGroupId: own?.groupId ?? null`. `null` when the module has no `sharedViewFor`.
  - In `handlers/game.ts`, register `game:hostAction`.

- [ ] **Step 5: Run the server tests and the core tests**

  Run: `pnpm --filter @cangsplayground/server test && pnpm --filter @cangsplayground/core test && pnpm typecheck`
  Expected: PASS, including every existing test.

- [ ] **Step 6: Commit**

  `git commit -m "feat(core): optional session-wide shared state for games"`

---

### Task 2: Web session slots

**Files:**
- Modify: `packages/ui/src/game-views.ts`
- Modify: `apps/web/src/routes/Display.tsx`, `apps/web/src/routes/Host.tsx`, `apps/web/src/routes/Player.tsx`, `apps/web/src/components/HostGame.tsx`
- Create: `apps/web/test/session-slots.test.tsx`

**Interfaces:**
- Consumes: `GameSessionView.shared`, event `game:hostAction` (Task 1).
- Produces (in `packages/ui/src/game-views.ts`):
  ```ts
  export interface SessionViewProps {
    lobby: LobbyView; session: GameSessionView; serverNow: () => number;
    busy?: boolean;                                      // host: a command is in flight
    act?: (action: GameAction) => Promise<boolean>;      // players
    hostAct?: (action: GameAction) => Promise<boolean>;  // host
  }
  // added to GameViews:
  ProjectorScreen?: React.ComponentType<SessionViewProps>;   // replaces the group grid while stage is ACTIVE
  HostSessionPanel?: React.ComponentType<SessionViewProps>;  // replaces "All groups" + per-group panels while ACTIVE
  PlayerSessionScreen?: React.ComponentType<SessionViewProps & { me: NonNullable<LobbyView["me"]> }>;
  ```
- Produces: an optional prop on `HostGame`, `hostAct?: (action: GameAction) => Promise<boolean>`. `Host.tsx` passes `(a) => execute(() => hostCommand("game:hostAction", a))`.

- [ ] **Step 1: Write the failing tests in `apps/web/test/session-slots.test.tsx`**

  Register a fake game in `gameViews["test-session"]` whose three slots render `<p>projector-slot</p>`, `<p>host-slot</p>` and `<p>player-slot</p>`. Build an ACTIVE `LobbyView` with that `gameId` (reuse the shape in `whos-the-spy-player.test.tsx`).
  - `HostGame` renders `host-slot`, with no "All groups" heading and no "Start" button.
  - The same view with stage `CONFIGURING` does not render `host-slot`.
  - Who's the Spy (`spyLobby()` from `spy-ux-fixture.ts`) still renders "All groups".
  - `Host` route (mount it like `host-console-controls.test.tsx`): the fixed bottom control bar is not rendered for the session game.
  - `Player` route (mount it like `player-shell-interaction.test.tsx`): renders `player-slot` and not "Get ready". Even with a runtime in `RUNNING` where `currentSpeakerId` is me, it does not render YourTurn.
  - `Display`: no test mounts it today, because of qrcode, confetti, `fetch` and motion. Pull the "ACTIVE + ProjectorScreen ? slot : grid" decision into an exported helper, `projectorBody(session, views)`, and unit-test that helper.

- [ ] **Step 2: Run them and confirm they fail**

  Run: `pnpm --filter @cangsplayground/web test session-slots`
  Expected: FAIL, because the slots are not rendered.

- [ ] **Step 3: Implement**

  - `Display.tsx`: when `session?.stage === "ACTIVE" && views?.ProjectorScreen`, render it in place of the `projector-grid` section. The header and footer stay.
  - `HostGame.tsx`: when `game.stage === "ACTIVE" && views?.HostSessionPanel`, render `<HostSessionPanel lobby={view} session={game} serverNow={serverNow} hostAct={hostAct} />` in place of the "All groups" panel and the group panels. Settings and Exit stay.
  - `Host.tsx`:
    - Hide the fixed bottom control bar (`Host.tsx` ~349–405, built on `mainControl`) when the game has `HostSessionPanel` and stage is ACTIVE.
    - Pass `busy` and `hostAct` through `HostGame` to the panel.
  - `Player.tsx`: when the player has a group, `session.stage === "ACTIVE"` and `PlayerSessionScreen` exists, render it inside `<section className="player-game cp-stack">` with no phase label. Check this **before** the `isMine`/YourTurn branch. `useWakeLock` is also on in that case.

- [ ] **Step 4: Run the web tests and typecheck**

  Run: `pnpm --filter @cangsplayground/web test && pnpm typecheck`
  Expected: PASS.

- [ ] **Step 5: Commit**

  `git commit -m "feat(web): session-level view slots for games with shared state"`

---

### Task 3: Shark Tank package, config and content

**Files:**
- Create: `packages/games/shark-tank/package.json`, `tsconfig.json` (copy from `whos-the-spy`, renamed to `@cangsplayground/game-shark-tank`)
- Create: `packages/games/shark-tank/src/types.ts`, `src/ideas.ts`, `src/phrases.ts`, `src/index.ts`, `data/ideas.json`
- Create: `packages/games/shark-tank/test/content.test.ts`
- Modify: `apps/server/package.json`, `apps/web/package.json` (add the workspace dep), then run `pnpm install`

**Interfaces:**
- Produces (in `src/types.ts`):
  ```ts
  export const GAME_ID = "shark-tank";
  export const configSchema; // zod object with the Global Constraints defaults; refine minPrice <= maxPrice
  export type SharkTankConfig = z.infer<typeof configSchema>;
  export type PartId = "problem" | "product" | "story" | "price" | "ask";
  export const PART_ORDER: PartId[] = ["problem", "product", "story", "price", "ask"];
  export type Stage = "PREP" | "PITCH" | "QA" | "HUDDLE" | "DECISION" | "RESULTS" | "CLOSING";
  export interface Idea { id: string; name: string; emoji: string; pitch: string;
    keywords: { en: string; vi: string }[]; sellingPoints: string[] }
  export type IdeaPublic = Pick<Idea, "id" | "name" | "emoji" | "pitch">;
  export interface Company {
    groupId: GroupId; ideaId: string; prepStep: 1 | 2 | 3 | 4;
    rerolled: boolean; rerollLocked: boolean;     // rerollLocked: has ever moved past step 1
    price: number | null; discounted: boolean;
    members: PlayerId[];            // current members, in part order
    formerMembers: PlayerId[];      // left or kicked; their "asked" marks still count
    startMembers: number;           // members at Prepare: quantity cap
    startWallet: number;            // moneyPerMember × startMembers, fixed at Prepare
    parts: Record<PlayerId, PartId[]>;
    scripts: Partial<Record<PartId, string[]>>;  // filled blanks, per part
    wallet: number; help: boolean;
  }
  export interface Purchase { buyer: GroupId; seller: GroupId; quantity: number; price: number }
  export interface SharkTankShared {
    stage: Stage; timer: TimerState;
    order: GroupId[]; presenterIndex: number; presented: GroupId[];
    companies: Company[];
    asked: Record<GroupId, PlayerId[]>;               // keyed by presenter
    votes: Record<GroupId, Record<PlayerId, number>>; // current pitch, keyed by buyer
    locked: GroupId[];                                // buyers locked this pitch
    purchases: Purchase[];
    announcers: Record<GroupId, PlayerId>;
    closing: { order: PlayerId[]; index: number } | null;
    left: PlayerId[];
  }
  ```
- Produces: `ideas(): Idea[]` and `ideaById(id: string): Idea` (throws on an unknown id) in `src/ideas.ts`.
- Produces in `src/phrases.ts`:
  - `PART_FRAMES: Record<PartId, string>`. Blanks are `___`, and `{price}` is filled in at render time. Use the copy in spec §3.4; for `price`, use `"It costs ${price}. That's cheaper than ___."`.
  - `blankCount(frame: string): number`.
  - `QUESTION_BANK: string[]` (about 10), `ANSWER_FRAMES: string[]`, `HUDDLE_FRAMES: string[]`, `DECISION_FRAMES: { buy: string; pass: string }`, `CLOSING_FRAME: string`.

- [ ] **Step 1: Write the failing `test/content.test.ts`**

  ```ts
  it("has 25–30 ideas with unique ids", () => { expect(ideas().length).toBeGreaterThanOrEqual(25); expect(ideas().length).toBeLessThanOrEqual(30); /* unique ids */ });
  it("each idea has 6–8 keywords with en+vi and 2–3 selling points", ...);
  it("every part frame has at least one blank; price frame has {price}", ...);
  it("blankCount counts ___", () => expect(blankCount("Our product is ___. It can ___.")).toBe(2));
  it("config defaults match the spec", () => expect(configSchema.parse({})).toEqual({ prepMinutes: 15, pitchSeconds: 120, qaSeconds: 180, huddleSeconds: 90, moneyPerMember: 100, minPrice: 10, maxPrice: 60, minSpendPercent: 60, noQuestionPenalty: 20 }));
  it("rejects minPrice > maxPrice", () => expect(configSchema.safeParse({ minPrice: 70 }).success).toBe(false));
  ```

- [ ] **Step 2: Run it and confirm it fails**

  Run: `pnpm --filter @cangsplayground/game-shark-tank test`
  Expected: FAIL, because the modules don't exist yet.

- [ ] **Step 3: Write the types, phrases and `data/ideas.json`**

  - Write 28 weird but easy-to-picture products (spec §6.1). Each pitch is one A2-level sentence. Each keyword has a Vietnamese meaning.
  - Config ranges for the form, used by Task 5's `configFields`:

    | Field | Range | Step |
    |---|---|---|
    | `prepMinutes` | 5–40 | 1 |
    | `pitchSeconds` | 30–600 | 15 |
    | `qaSeconds` | 30–900 | 15 |
    | `huddleSeconds` | 30–300 | 15 |
    | `moneyPerMember` | 10–1000 | 10 |
    | `minPrice` | 1–1000 | 5 |
    | `maxPrice` | 1–1000 | 5 |
    | `minSpendPercent` | 0–100 | 10 |
    | `noQuestionPenalty` | 0–500 | 5 |

- [ ] **Step 4: Run the test and confirm it passes**

  Run: `pnpm --filter @cangsplayground/game-shark-tank test`
  Expected: PASS.

- [ ] **Step 5: Commit**

  Include `pnpm-lock.yaml`, because the Dockerfile installs with `--frozen-lockfile`.

  `git commit -m "feat(shark-tank): package, config, ideas and phrases"`

---

### Task 4: Scoring rules (pure functions)

**Files:**
- Create: `packages/games/shark-tank/src/rules.ts`, `test/rules.test.ts`

**Interfaces:**
- Consumes: the types from Task 3.
- Produces:
  ```ts
  export function assignParts(members: PlayerId[]): Record<PlayerId, PartId[]>;
  export function reassignParts(parts: Record<PlayerId, PartId[]>, leaver: PlayerId, remaining: PlayerId[]): Record<PlayerId, PartId[]>;
  export function maxQuantity(startMembers: number, wallet: number, price: number): number;
  export function medianFloor(votes: number[]): number;
  export function minSpendTarget(buyer: Company, shared: SharkTankShared, config: SharkTankConfig): number;
  /** Live figure for the phone: the same formula as minSpendTarget, over every other seller that
      has presented or still has members (current prices), minus what the buyer has spent; never < 0. */
  export function minSpendLeft(buyer: Company, shared: SharkTankShared, config: SharkTankConfig): number;
  export function spent(shared: SharkTankShared, groupId: GroupId): number;
  export interface Score { groupId: GroupId; revenue: number; spent: number; shortfall: number; noQuestion: number; total: number }
  export interface Results { scores: Score[]; bestStartup: GroupId[]; bestShark: GroupId[] }
  export function computeResults(shared: SharkTankShared, config: SharkTankConfig): Results;
  ```

- [ ] **Step 1: Write the failing tests**

  ```ts
  // assignParts (members already in order)
  expect(assignParts(["a","b"])).toEqual({ a: ["problem","product"], b: ["price","ask"] });
  expect(assignParts(["a","b","c"])).toEqual({ a: ["problem"], b: ["product"], c: ["price","ask"] });
  expect(assignParts(["a","b","c","d"])).toEqual({ a: ["problem"], b: ["product"], c: ["price"], d: ["ask"] });
  expect(assignParts(["a","b","c","d","e"]).c).toEqual(["story"]);
  // reassignParts: leaver's parts go to the remaining member with the fewest parts (first on ties), kept in PART_ORDER
  expect(reassignParts({ a: ["problem"], b: ["product"], c: ["price","ask"] }, "a", ["b","c"])).toEqual({ b: ["problem","product"], c: ["price","ask"] });
  // maxQuantity
  expect(maxQuantity(4, 400, 60)).toBe(4); expect(maxQuantity(4, 100, 60)).toBe(1); expect(maxQuantity(3, 5, 10)).toBe(0);
  // medianFloor
  expect(medianFloor([])).toBe(0); expect(medianFloor([1,4])).toBe(2); expect(medianFloor([0,3,3])).toBe(3); expect(medianFloor([1,2,3,4])).toBe(2);
  // minSpendTarget = min(floor(pct × startWallet / 100), min(startWallet, Σ over presented sellers ≠ buyer of startMembers(buyer) × seller.price))
  //  4 members, $400, two presented sellers at $10: min(240, 2×4×10 = 80) = 80
  //  4 members, $400, sellers at $50 and $60: min(240, 4×50 + 4×60 = 440, capped at 400) = 240
  // computeResults
  //  revenue = Σ purchases where seller = g of quantity × price; spent = the same with buyer = g
  //  minSpendTarget uses company.startWallet (fixed at Prepare), never the current config
  //  shortfall = max(0, minSpendTarget − spent); 0 for a company with no members left (spec §8)
  //  noQuestion = noQuestionPenalty × (current members who never appear in any asked list)
  //  total = revenue − shortfall − noQuestion (may be negative)
  //  bestStartup = groupIds with max total (ties all win)
  //  bestShark: [] when there are fewer than 3 companies (empty companies still count).
  //    Otherwise sort by revenue (descending); threshold = the revenue of the 2nd entry;
  //    top set = every group with revenue >= threshold (handles a tie for 1st or 2nd).
  //    The winners are the groups with the max spend on top-set sellers other than themselves,
  //    and only if that max is > 0.
  //  scores are returned sorted by total ascending (the reveal order); empty companies are scored normally
  //  minSpendLeft: 4 members, $400, nobody spent, two other sellers at $10 still in play → min(240, 80) − 0 = 80
  ```

  Include one full scenario with 3 companies (prices 20/40/60) and hand-computed totals, one tie for Best Startup, one tie at 2nd place for Best Shark, and one 2-company game where `bestShark` is `[]`.

- [ ] **Step 2: Run them and confirm they fail**

  Run: `pnpm --filter @cangsplayground/game-shark-tank test rules`
  Expected: FAIL.

- [ ] **Step 3: Implement `rules.ts`**

  Code must match the formulas in the test comments exactly.

- [ ] **Step 4: Run the tests and confirm they pass**

  Run: `pnpm --filter @cangsplayground/game-shark-tank test rules`
  Expected: PASS.

- [ ] **Step 5: Commit**

  `git commit -m "feat(shark-tank): scoring rules"`

---

### Task 5: Module, preparation stage and timer controls

**Files:**
- Create: `packages/games/shark-tank/src/logic.ts`, `test/logic-prep.test.ts`, `test/helpers.ts`
- Modify: `src/index.ts` (export the module as default), `apps/server/src/games/registry.ts` (register it)

**Interfaces:**
- Consumes: Task 1 hooks, Task 3 types, Task 4 `assignParts`.
- Produces: `sharkTank: GameModule<SharkTankConfig, null, SharkTankShared>` with:
  - `minPlayersPerGroup: 2`, `maxPlayersPerGroup: 5`, `recommended: "3–4 per group"`, `turnDurationMs: () => null`, `prepare: () => null`, and `publicInfo: () => ({})`.
  - `unsupportedControls`: every optional control.
  - `viewFor: () => null`.
  - `configFields` for every config key, in the order of spec §3.1, with the ranges from Task 3.
- Produces: `validateGroup` returns `"Shark Tank needs 2–5 players in each group."` when a group has more than 5 players. `validateGroups` returns `"Shark Tank needs at least 2 groups."`.
- Produces: `prepareShared`:
  - one `Company` per group, each with a distinct random idea;
  - `members` = the group's `playerIds`, `parts = assignParts(members)`, `startMembers = members.length`, `wallet = moneyPerMember × startMembers`;
  - `prepStep: 1`, `price: null`;
  - `stage: "PREP"`, and the timer running for `prepMinutes`.
- Produces: action types handled in `onSharedAction` (exported as `const ACTIONS`). Any other type, a wrong stage, a wrong actor, or a bad payload returns `null`.

  | Type | Who | Stage | Payload | Effect |
  |---|---|---|---|---|
  | `st:reroll` | player | PREP | — | own company `!rerolled && !rerollLocked` → new random idea not used by any company; `rerolled = true` |
  | `st:step` | player | PREP | `{ step: 1–4 }` | set own `prepStep`; any step > 1 sets `rerollLocked = true` for good |
  | `st:price` | player | PREP | `{ price: int }` | `minPrice ≤ price ≤ maxPrice` → set own price |
  | `st:script` | player | PREP | `{ part, blanks: string[] }` | `part` ∈ actor's parts, `blanks.length === blankCount(PART_FRAMES[part])`, each trimmed blank ≤ 80 chars → store |
  | `st:help` | player | any | `{ on: boolean }` | set own company `help` |
  | `st:clearHelp` | host | any | `{ groupId }` | `help = false` |
  | `st:pause` / `st:resume` | host | timed stage | — | the same arithmetic as `Lobby.control` on `TimerState` |
  | `st:extend` | host | timed stage | — | `durationMs += EXTEND_MS`. Running: `endsAt = max(endsAt, now) + EXTEND_MS`, so an expired timer comes back to 30 s. Paused: `pausedRemainingMs += EXTEND_MS` |
  | `st:next` | host | any | `{ from: Stage, presenterIndex: number }` | `null` unless both match the current state (stale double tap). This task implements PREP → PITCH |

- [ ] **Step 1: Write the test helpers**

  In `test/helpers.ts`: `start(sizes: number[], config?: Partial<SharkTankConfig>)` builds the groups `g1…`, players `g1p1…`, a roster with everyone connected, and `createRng(1)`. It then calls `prepareShared` with `now = 1000` and returns `{ shared, act(actor, type, payload?), tick(ms), setConnected(playerId, connected), leave(playerId) }`. `tick` advances `now`, `setConnected` edits the roster, and `leave` calls `onSharedPlayerLeft` and drops the player from the roster. `act` calls `onSharedAction` and replaces `shared` on success. Players are identified by id; `"host"` means a host actor.

- [ ] **Step 2: Write the failing `test/logic-prep.test.ts`**

  ```ts
  it("prepareShared deals distinct ideas, parts and wallets", () => {
    const { shared } = start([4, 3]);
    expect(new Set(shared.companies.map((c) => c.ideaId)).size).toBe(2);
    expect(shared.companies[0]!.wallet).toBe(400); expect(shared.companies[1]!.wallet).toBe(300);
    expect(shared.timer).toEqual({ durationMs: 900_000, endsAt: 901_000, pausedRemainingMs: null });
  });
  it("reroll once, never after the group moved past step 1 (even back on step 1), never to an idea in use", ...);
  it("extend on an expired running timer gives 30 s from now", ...);
  it("st:next with a stale { from, presenterIndex } is rejected", ...);   // Review Focus 4
  it("price must be within range and an integer", ...);   // 9 → null, 61 → null, 12.5 → null, 35 → ok
  it("script only for own part with the right blank count", ...);
  it("player actions are rejected outside PREP; host-only actions reject players", ...);
  it("pause/resume/extend move the stage timer", ...);    // now advances via helper option
  it("next from PREP fills missing prices with the midpoint and starts PITCH with a random order", () => {
    // config 10/60, one group never set a price → 35
    // stage "PITCH", order is a permutation of group ids, presenterIndex 0, timer = pitchSeconds
  });
  it("validateGroup / validateGroups messages", ...);
  ```

- [ ] **Step 3: Run them and confirm they fail**

  Run: `pnpm --filter @cangsplayground/game-shark-tank test logic-prep`
  Expected: FAIL.

- [ ] **Step 4: Implement `logic.ts`**

  - Use one small reducer per action type.
  - `startTimer(seconds, now)` and `idleTimer()` helpers. Idle is `{ durationMs: 0, endsAt: null, pausedRemainingMs: null }`.
  - Each `st:next` transition is a function `next(shared, ctx)`. This task implements PREP → PITCH: set missing prices to `Math.round((minPrice + maxPrice) / 2)`, set `order = shuffle(groups that still have members, rng)`, and reset the per-pitch state: `asked[presenter] = []`, `votes = {}`, `locked = []`, `announcers = {}`.

- [ ] **Step 5: Run the tests and confirm they pass**

  Run: `pnpm --filter @cangsplayground/game-shark-tank test`
  Expected: PASS.

- [ ] **Step 6: Commit**

  `git commit -m "feat(shark-tank): module, preparation stage and stage timer"`

---

### Task 6: Pitch cycle, results and leavers

**Files:**
- Modify: `packages/games/shark-tank/src/logic.ts`
- Create: `test/logic-cycle.test.ts`

**Interfaces:**
- Consumes: Task 4 rules, Task 5 reducers and helpers.
- Produces: more actions:

  | Type | Who | Stage | Payload | Effect |
  |---|---|---|---|---|
  | `st:discount` | player in presenter | QA | `{ price: int }` | `!discounted && minPrice ≤ price < current` → set price, `discounted = true` |
  | `st:asked` | host | QA, HUDDLE | `{ playerId }` | the player must be a member of a non-presenter company; toggle in `asked[presenter]`. In HUDDLE it can't touch a locked company. A late mark makes the group eligible right away |
  | `st:vote` | player in a non-presenter, unlocked, eligible company | HUDDLE | `{ quantity: int }` | `0 ≤ q ≤ maxQuantity(startMembers, wallet, presenter price)` → set `votes[g][actor]`, then `tryLock(g)` |

  Eligible means at least one id in `asked[presenter]` belongs to the company's `members` or `formerMembers`. It is computed live, never stored.

- Produces: the remaining `st:next` transitions:
  - **PITCH → QA**: timer `qaSeconds`.
  - **QA → HUDDLE**: timer `huddleSeconds`. Auto-lock with quantity 0 only the non-presenter companies that have no members. Ineligible companies stay unlocked, so a late `st:asked` can still make them eligible.
  - **HUDDLE → DECISION**: lock every remaining buyer, eligible ones with `medianFloor` of their current members' votes and ineligible ones with 0. Pick an announcer for each non-presenter company that has members: a random connected member, or a random member when none is connected. Idle timer.
  - **DECISION → PITCH or RESULTS**: push the presenter to `presented`. Move to the next index whose company still has members, and reset the per-pitch state. If there is none, go to `RESULTS` (idle timer).
  - **RESULTS → CLOSING**: `closing = { order: all current members, company by company in `order`, members in part order; index: 0 }`.
  - **CLOSING**: `index++` while `index < order.length - 1`. After that, `st:next` returns `null`.
- Produces: `tryLock(g)`:
  - Required voters = the connected current members, or all current members if none are connected.
  - When all of them have voted, lock with `medianFloor`.
  - Locking with q > 0 appends `{ buyer, seller: presenter, quantity: q, price: seller.price }` and subtracts from the wallet. Locking pushes `g` to `locked`.
- Produces: `onSharedPlayerLeft`:
  - Move the player from `members` to `formerMembers`, and `reassignParts`; scripts stay attached to their part.
  - Delete their vote. Push them to `left`.
  - In HUDDLE: lock the company with 0 if it is now empty, otherwise `tryLock`.
- Produces: `onSharedRosterChange`. In HUDDLE, `tryLock` every unlocked, eligible buyer. Parts never move on a disconnect.

- [ ] **Step 1: Write the failing `test/logic-cycle.test.ts`**

  ```ts
  it("discount: once, lower, not below minPrice, only presenter, only QA", ...);
  it("asked toggles; presenter's own members can't be marked", ...);
  it("ineligible buyers can't vote; a late st:asked in HUDDLE lets them vote; still ineligible at DECISION → locked at 0", ...);
  it("an asked mark by a member who later left still makes the group eligible", ...);
  it("onSharedRosterChange: the last non-voter disconnects → the group locks", ...);
  it("vote over the cap or wallet is rejected", ...);
  it("all connected members voted → locks with median, records the purchase and debits the wallet", () => {
    // buyer 4 members votes 1,2,2,4 → median floor 2; price 35 → wallet 400 → 330
  });
  it("disconnected members are not required; nobody connected → all members required", ...); // Review Focus 2
  it("re-voting before lock replaces the vote; after lock is rejected", ...);
  it("HUDDLE → DECISION locks the rest with the votes present and picks connected announcers", ...);
  it("price at purchase is the discounted price", ...);           // Review Focus 3
  it("an empty company is skipped in the presenting order", ...);
  it("last DECISION → RESULTS → CLOSING; CLOSING stops at the last speaker", ...);
  it("leaver mid-huddle: parts move, vote dropped, group locks when the rest already voted", ...); // Review Focus 1
  ```

- [ ] **Step 2: Run them and confirm they fail**

  Run: `pnpm --filter @cangsplayground/game-shark-tank test logic-cycle`
  Expected: FAIL.

- [ ] **Step 3: Implement the transitions, `tryLock`, the new actions and `onSharedPlayerLeft`**

- [ ] **Step 4: Run the tests and confirm they pass**

  Run: `pnpm --filter @cangsplayground/game-shark-tank test`
  Expected: PASS.

- [ ] **Step 5: Commit**

  `git commit -m "feat(shark-tank): pitch cycle, purchases, results and leavers"`

---

### Task 7: Per-viewer filtering

**Files:**
- Create: `packages/games/shark-tank/src/view.ts`, `test/view.test.ts`
- Modify: `src/logic.ts` (`sharedViewFor: viewFor` from `view.ts`), `src/types.ts` (view types)

**Interfaces:**
- Consumes: `SharkTankShared`, `computeResults`, `minSpendTarget`.
- Produces (in `types.ts`):
  ```ts
  export interface CompanyView {
    groupId: GroupId; prepStep: 1 | 2 | 3 | 4; members: PlayerId[]; discounted: boolean; voted: boolean;
    idea: Idea | IdeaPublic | null; price: number | null; parts: Record<PlayerId, PartId[]> | null;
    help: boolean | null; scripts: Partial<Record<PartId, string[]>> | null;
    wallet: number | null; minSpendLeft: number | null; votes: Record<PlayerId, number> | null;
    eligible: boolean | null; purchases: Purchase[] | null; revenue: number | null;
  }
  export interface SharkTankView {
    stage: Stage; timer: TimerState; order: GroupId[] | null; presenter: GroupId | null;
    companies: CompanyView[]; asked: PlayerId[] | null;
    announcers: Record<GroupId, PlayerId> | null; myDecision: boolean | null;
    results: Results | null; closing: { order: PlayerId[]; index: number } | null;
  }
  ```
- Produces: `viewFor(args: { config; shared; viewer; viewerGroupId }): SharkTankView`. The rules follow spec §4. In the table, "own" means `viewerGroupId === company.groupId`.

  | Field | Host | Own group | Others / projector |
  |---|---|---|---|
  | `idea` | full | full | `null` in PREP, then `IdeaPublic` |
  | `price` | yes | yes | `null` in PREP |
  | `parts` | yes | yes | `null` in PREP |
  | `scripts`, `help` | yes | yes | `null` |
  | `wallet`, `minSpendLeft`, `votes`, `eligible` | yes | yes | `null` |
  | `purchases` (as buyer) | yes | yes | `null` until RESULTS |
  | `revenue` | yes | `null` until RESULTS | `null` until RESULTS |
  | `asked` (current pitch) | all | own members only | projector `null` |

  - `minSpendLeft` comes from `rules.minSpendLeft`, for own group and host only (`null` for others).
  - `eligible` is computed live with the Task 6 rule.
  - `order` and `presenter` are `null` in PREP.
  - `announcers` only in DECISION.
  - `myDecision` is set only for the player who is an announcer: `true` if their company bought anything from the current presenter.
  - `results` only in RESULTS and CLOSING.

- [ ] **Step 1: Write the failing `test/view.test.ts`**

  One test per table row, for each viewer kind. Add a JSON-string check: `JSON.stringify(viewFor(projector in HUDDLE))` contains no `"wallet":<number>`, no `"votes":{` and no `"quantity"`.

- [ ] **Step 2: Run them and confirm they fail**

  Run: `pnpm --filter @cangsplayground/game-shark-tank test view`
  Expected: FAIL.

- [ ] **Step 3: Implement `view.ts`**

- [ ] **Step 4: Run the tests and confirm they pass**

  Run: `pnpm --filter @cangsplayground/game-shark-tank test`
  Expected: PASS.

- [ ] **Step 5: Commit**

  `git commit -m "feat(shark-tank): per-viewer filtering"`

---

### Task 8: Server integration and socket privacy

**Files:**
- Create: `apps/server/test/shark-tank.test.ts`

**Interfaces:**
- Consumes: `Lobby`, `buildView`, the registered `sharkTank`, and the Socket.IO test setup used in `whos-the-spy.test.ts`.
- Note: spec §9 suggests `apps/server/scripts/simulate.ts`. These Lobby-level tests cover the same full game, so the script is not extended **(Claude's call)**.

- [ ] **Step 1: Write the tests**

  ```ts
  it("plays a full 3-group game through Lobby", () => {
    // 10 players, assign count 3, configure defaults, prepare
    // each group: st:price; host st:next ×… with st:asked + st:vote per pitch; until RESULTS
    // buildView(host).game.shared.results.scores has 3 entries; totals equal computeResults(lobby.game.shared, config)
  });
  it("plays a 2-group game: bestShark is empty", ...);
  it("a kicked player mid-game: parts move, the game continues", ...);
  it("prepare fails with 1 group or a 6-player group", ...);
  it("projector socket during HUDDLE/DECISION never receives wallet, votes, purchases or revenue", ...); // Review Focus 5
  it("a player's reconnect (session:resume) returns their own scripts", ...);
  ```

- [ ] **Step 2: Run them**

  Run: `pnpm --filter @cangsplayground/server test shark-tank`
  Expected: PASS. If one fails, fix the cause in Tasks 1, 5, 6 or 7, not in the test.

- [ ] **Step 3: Commit**

  `git commit -m "test(server): Shark Tank full game and privacy"`

---

### Task 9: Player screens

**Files:**
- Create: `packages/games/shark-tank/src/views/player.tsx`, `src/views/shark-tank.css`, `src/views/css.d.ts`, `src/views/index.tsx` (exports `GameViews` with `PlayerScreen: () => null` and `PlayerSessionScreen`)
- Modify: `apps/web/src/games/registry.ts`
- Create: `apps/web/test/shark-tank-player.test.tsx`

**Interfaces:**
- Consumes: `SharkTankView` (as `session.shared`), `SessionViewProps` (Task 2), phrases (Task 3), and the action types (Tasks 5–6) via `act`.
- Produces: the default export `sharkTankViews: GameViews`.

Each screen states the next step (spec anti-goal). There is always a **Need help** toggle (`st:help`) and a **Hide sentence frames** switch, which is local state stored in `localStorage` under `cangsplayground:st-frames` and wrapped in try/catch.

| Stage | Own group presenting? | Shows |
|---|---|---|
| PREP | — | step tabs 1–4 (`st:step`)<br>1: idea card with keywords and selling points; "Change idea" (`st:reroll`, only when allowed)<br>2: price input with range (`st:price`)<br>3: the frames for my parts with inputs per blank (`st:script`, saved on blur)<br>4: the whole group's script in part order |
| PITCH / QA | yes | my parts with my filled script in large type<br>in QA: answer frames, and a "Give a discount" input (`st:discount`) when not yet used |
| PITCH / QA | no | presenter product card + price<br>question bank<br>"Your group can buy" / "Ask a question so your group can buy" (from `eligible`) |
| HUDDLE | no | huddle frames, quantity stepper 0..max (`st:vote`), teammates' votes, wallet and `minSpendLeft`; ineligible → locked at 0 with "Nobody in your group asked a question" |
| HUDDLE | yes | "Wait. The sharks are deciding." |
| DECISION | — | announcer: `DECISION_FRAMES.buy` or `.pass` according to `myDecision`; others: "Listen to {name}" |
| RESULTS | — | own score breakdown |
| CLOSING | — | `CLOSING_FRAME`; "Your turn" when `closing.order[index]` is me |

- [ ] **Step 1: Write the failing `apps/web/test/shark-tank-player.test.tsx`**

  Render with `renderToStaticMarkup` and a fixture `SharkTankView`. Cover:
  - PREP step 3 shows exactly my frames.
  - QA as a buyer shows the question bank and the eligibility line.
  - HUDDLE ineligible shows the locked message.
  - DECISION as announcer shows the buy frame.
  - Need help is always present.

- [ ] **Step 2: Run it and confirm it fails**

  Run: `pnpm --filter @cangsplayground/web test shark-tank-player`
  Expected: FAIL.

- [ ] **Step 3: Implement**

  Use the `@cangsplayground/ui` components (`Panel`, `Button`, `Chip`, `Timer`, `TeamBadge`, `Switch`). Show the stage timer from `shared.timer` with `<Timer>`.

- [ ] **Step 4: Run it, the full web suite and typecheck**

  Run: `pnpm --filter @cangsplayground/web test && pnpm typecheck`
  Expected: PASS.

- [ ] **Step 5: Commit**

  `git commit -m "feat(shark-tank): player screens"`

---

### Task 10: Projector, host panel and config note

**Files:**
- Create: `packages/games/shark-tank/src/views/projector.tsx`, `src/views/host.tsx`
- Modify: `src/views/index.tsx` (add `ProjectorScreen`, `HostSessionPanel`, `HostConfigNote`), `src/views/shark-tank.css`
- Create: `apps/web/test/shark-tank-host-projector.test.tsx`

**Interfaces:**
- Consumes: `SharkTankView`, `SessionViewProps` with `hostAct`, the host action types.

**ProjectorScreen**
- Stage banner (Preparing / Pitch / Q&A / Shark huddle / Decision / Results / I bought…) and a large `<Timer>`.
- When the timer reaches 0 in a timed stage:
  - show a "Time's up" label and a 2 s screen flash (a CSS class; skip the flash under reduced motion);
  - play one short beep through Web Audio. The beep is on by default, can be muted with a toggle next to Projector Boost, and its state is stored in `localStorage` under `cangsplayground:st-sound`, wrapped in try/catch.
  - The Host Console shows the same label.
- PREP: group tiles with the step label, and no idea.
- PITCH and QA: big product card (emoji, name, pitch, price), and the presenter's members with their part labels. When `discounted`, the old price is struck through.
- HUDDLE: a tick per voted company.
- DECISION: announcer names, very large.
- RESULTS: scores revealed by final total, lowest to highest (the order `computeResults` returns), one every 1.5 s (respect `useReducedMotion`), then Best Startup and Best Shark (when not empty), with confetti like `Display.tsx`. Deductions show amounts only, no names.
- CLOSING: speaker list with the current one highlighted.

**HostSessionPanel**
- Every button is disabled while `busy`.
- Main button `st:next` with payload `{ from: stage, presenterIndex }` taken from the view, labelled by stage: "Start pitches", "Start Q&A", "Start huddle", "Lock votes", "Next group" / "Show results", "I bought… round", "Next speaker". Plus Pause, Resume and +30s.
- In QA and HUDDLE: a grid of chips for every member of the non-presenting groups; tapping sends `st:asked`. Marked chips are highlighted, and chips of locked groups are disabled during HUDDLE.
- A status table per group:
  - PREP step, and whether the price is set (a warning when it isn't and the stage is PREP);
  - voted / not voted during HUDDLE;
  - a Need help flag with a clear button (`st:clearHelp`);
  - live wallet, purchases and revenue.

**HostConfigNote**
- Under the settings: "Group 1 (4): $400 · Group 2 (3): $300", computed from `lobby.groups` and the draft `moneyPerMember`.

- [ ] **Step 1: Write the failing tests**

  - Projector in HUDDLE: no "$" amounts other than the presenter price.
  - Projector in RESULTS: shows Best Startup.
  - Host in QA: renders a chip per non-presenter member and none for presenter members.
  - Host main-button label per stage.
  - HostConfigNote text for groups of 4 and 3 at $100.

- [ ] **Step 2: Run them and confirm they fail**

  Run: `pnpm --filter @cangsplayground/web test shark-tank-host-projector`
  Expected: FAIL.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run everything**

  Run: `pnpm test && pnpm typecheck && pnpm lint`
  Expected: PASS.

- [ ] **Step 5: Manual check in the real app** (`run` skill or `pnpm dev`)

  Open the host, the projector and 4 player tabs (2 groups × 2). Play through PREP → one full pitch → RESULTS. Confirm the projector never shows quantities before RESULTS, and that a reload of a player tab keeps their script.

- [ ] **Step 6: Commit**

  `git commit -m "feat(shark-tank): projector, host panel and config note"`
