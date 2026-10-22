# Who's the Spy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the "Who's the Spy" minigame. Players in each group take turns speaking, vote with a timer, and get eliminated. The game ends with Team wins / Spy wins. To support this, the core gains a shared game clock, a voting phase, player elimination and a Continue command that keeps the dealt roles.

**Architecture:** The core (`packages/core`, `apps/server/src/lobby/Lobby.ts`, `TimerService`) gets generic, optional hooks on `GameModule`. Free Talk and Secret Word do not declare them, so their behavior does not change. The rules live in a new package, `packages/games/whos-the-spy` (logic + views), following the same pattern as `secret-word`. The web app (`apps/web`) only gets generic changes: phase-aware controls, per-game button labels, the game clock and a strikethrough for eliminated members.

**Tech Stack:** TypeScript, zod 4, Socket.IO, React 19, Vitest 5, pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-10-22-whos-the-spy-design.md` (references: `docs/superpowers/specs/2026-10-22-whos-the-spy/style-preview.html` at `#arcade`, `.../new-screens.html`)

## Global Constraints

- Every UI string is in English.
- Style: Arcade Night, using the existing tokens and components in `packages/ui`. Only add CSS where no existing component covers the need.
- `minPlayersPerGroup: 3`. Spies per group must satisfy `spies ≤ floor((n − 1) / 2)`. A group that breaks this blocks Prepare with the error `GROUPS_TOO_SMALL`.
- Turns before each vote: fixed at 2 per player (`turnsPerPlayer: 2`). Vote length: fixed at 30 s.
- Config defaults: `gameMinutes` 12 (5–30, step 1), `turnSeconds` 60 (15–300, step 15), `spies` 1.
- The whole class shares one topic. "Random" is resolved once, when Prepare is pressed.
- Secret data must never reach a client that is not allowed to see it (PRD §7). Filter in `viewFor` on the server. Hiding it in the UI is not enough.
- Free Talk and Secret Word behave exactly as before. All existing tests must pass.
- Lint/format: `pnpm lint`, Prettier. Tests: `pnpm test`. Types: `pnpm typecheck`.

## Review Focus

1. **A player leaves or is kicked during a vote.** Their own vote and any votes cast for them are dropped. If everyone left has already voted, the vote closes immediately. If that player was the last spy, the group ends with **Team wins**. Covered in Task 2 (core) and Task 6 (logic).
2. **The teacher presses Pause for the whole class during a vote.** Both the vote timer and the game clock stop. Votes sent while paused are rejected. After Resume, both continue from where they stopped. Covered in Tasks 1, 3 and 6.
3. **A double tap on "Lock my vote", or a vote cast again after reconnecting.** The second vote is rejected and the first one stands. After a reload the player sees their locked vote again (`myVote`). Covered in Task 6.
4. **The game clock runs out while a group is in a non-running state** (`ROUND_END` waiting for Continue, `PAUSED`, or `PREPARED`). That group still ends with Spy wins. Groups already `FINISHED` keep their result. Covered in Tasks 3 and 6.
5. **The projector receives an update while a group is voting or finished.** The raw payload contains no topic name, hint word or spy list. Covered in Task 7 (socket test).

---

## File map

| File | Change |
|---|---|
| `packages/core/src/types.ts` | `GamePhase` + `VOTING`, `FINISHED`; `ConfigField.showWhen`; `GroupGameView.eliminated`; `GameClockView`; `GameSessionView.clock` |
| `packages/core/src/game.ts` | `GroupRuntime.eliminated`; `ActionResult.closeVote`; `VoteOutcome`, `LeaveOutcome`; new optional `GameModule` hooks; `activePlayers()` |
| `apps/server/src/lobby/Lobby.ts` | vote phase, elimination, Continue, FINISHED, game clock, `validateGroup`, `resolveConfig`, `onPlayerLeft` |
| `apps/server/src/timer/TimerService.ts` | schedule `VOTING` timers and the session clock |
| `apps/server/src/broadcast.ts` | expose `eliminated`, `clock`, speaker null outside speaking phases |
| `apps/server/test/vote-cycle.test.ts`, `game-clock.test.ts` | new core tests with a test-only module |
| `packages/ui/src/game-views.ts` | `GameControl` type, `GameViews.controlLabels` |
| `packages/ui/src/components.tsx` + `styles/components.css` | `GameClock`; eliminated members in `GroupCard` |
| `apps/web/src/components/game-controls.ts`, `HostGame.tsx`, `config-fields.ts`, `ConfigForm.tsx`, `routes/Host.tsx`, `routes/Player.tsx`, `routes/Display.tsx` | generic support for the new phases, labels, clock, `showWhen` |
| `packages/games/whos-the-spy/**` | new game package: data, types, logic, views, css, tests |
| `apps/server/src/games/registry.ts`, `apps/web/src/games/registry.ts`, both `package.json` | register the game |
| `apps/server/test/whos-the-spy.test.ts` | socket privacy test |
| `apps/server/scripts/simulate.ts` | play a full round of the new game |

---

### Task 1: Core contract + voting phase in Lobby

**Files:**
- Modify: `packages/core/src/types.ts`, `packages/core/src/game.ts`
- Modify: `apps/server/src/lobby/Lobby.ts` (`advance`, `expire`, `control`, `action`, `prepareGroup`; new private `endTurns`, `startVote`, `closeVote`)
- Modify: `apps/server/src/timer/TimerService.ts`
- Modify: `apps/server/src/broadcast.ts`
- Modify: `packages/games/secret-word/test/logic.test.ts`, `packages/games/free-talk/test/logic.test.ts` (add `eliminated: []` to hand-built `GroupRuntime` objects)
- Test: `apps/server/test/vote-cycle.test.ts`

**Interfaces:**
- Produces (core):
  - `type GamePhase = "PREPARED" | "RUNNING" | "PAUSED" | "ROUND_END" | "VOTING" | "FINISHED"`
  - `GroupRuntime.eliminated: PlayerId[]`, and `GroupGameView.eliminated: PlayerId[]`, both core-managed, public tier.
  - `ActionResult<Data>.closeVote?: boolean`
  - `interface VoteOutcome<Data> { data: Data; eliminate?: PlayerId[]; finished?: boolean }`
  - `GameModule.voteDurationMs?(config): number | null`. When it returns a number, the end of the turn order goes to `VOTING` instead of `ROUND_END`.
  - `GameModule.onVoteEnd?(args: { config; state: GroupRuntime<Data> }): VoteOutcome<Data>`
  - `function activePlayers(state: Pick<GroupRuntime, "turnOrder">): PlayerId[]`: the unique ids of `turnOrder`, in first-seen order.
- Produces (Lobby):
  - In `VOTING`, `timer` is the vote timer.
  - Pausing during `VOTING` keeps the phase at `VOTING` and only pauses the timer: `endsAt=null`, `pausedRemainingMs` set.
  - `closeVote` applies the outcome. Each id in `eliminate` is pushed to `eliminated` and removed from `turnOrder`, then `turnIndex = turnOrder.length`. The phase becomes `FINISHED` if `finished`, otherwise `ROUND_END`. The timer goes idle.

Control rules (server `control()` and Task 4's `canControl()` must agree):

| cmd | allowed when | effect in new phases |
|---|---|---|
| pause | `RUNNING`, or `VOTING` with `timer.endsAt !== null` | VOTING: pause the timer, keep the phase |
| resume | `PAUSED`, or `VOTING` with `timer.pausedRemainingMs !== null` | VOTING: resume the timer |
| skip | `RUNNING`, `PAUSED`, `VOTING` | VOTING: `closeVote` now |
| extend | `RUNNING`, `PAUSED`, `VOTING` | +30 s on the vote timer |
| endRound | not `ROUND_END` / `VOTING` / `FINISHED`. For a module with `voteDurationMs`, only `RUNNING`/`PAUSED` | voting module: `startVote` ("Vote now"). Otherwise unchanged |
| reveal | `ROUND_END && !revealed` | unchanged |
| nextRound | `ROUND_END` | Task 2 |
| start | `PREPARED` | unchanged |

Other Lobby rules:
- `action()`: `turn:done` still requires `RUNNING`. After the module's `onAction`, if `result.closeVote && group.phase === "VOTING"`, call `closeVote`.
- `expire()`: also accepts `VOTING`. Expiry calls `closeVote`, not `advance`.
- `buildView`: `currentSpeakerId`/`nextSpeakerId` are `null` unless the phase is `PREPARED`, `RUNNING` or `PAUSED`. Pass through `eliminated: [...group.eliminated]`.
- `TimerService.reconcile`: schedule groups whose phase is `RUNNING` or `VOTING` and that have `endsAt`.

- [ ] **Step 1: Write the failing test** `apps/server/test/vote-cycle.test.ts`

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { activePlayers, type GameModule } from "@cangsplayground/core";
import { Lobby } from "../src/lobby/Lobby.js";
import { TimerService } from "../src/timer/TimerService.js";
import { buildView } from "../src/broadcast.js";
import { registry } from "../src/games/registry.js";

type D = { closes: number };
export const voteGame: GameModule<Record<string, never>, D> = {
  id: "test-vote", name: "Test vote", description: "", minPlayersPerGroup: 2, recommended: "",
  configSchema: z.object({}), defaultConfig: {}, configFields: [],
  turnDurationMs: () => 10_000, turnsPerPlayer: () => 2, voteDurationMs: () => 30_000,
  prepare: () => ({ closes: 0 }),
  onAction: ({ state, action }) =>
    action.type === "everyone-voted" && state.phase === "VOTING" ? { data: state.data, closeVote: true } : null,
  onVoteEnd: ({ state }) => ({ data: { closes: state.data.closes + 1 }, eliminate: [activePlayers(state)[0]!] }),
  publicInfo: () => ({}),
  viewFor: ({ state }) => state.data,
};
export function setupVote(n = 3, groups = 1) {
  if (!registry.has(voteGame.id)) registry.set(voteGame.id, voteGame);
  const lobby = new Lobby({ code: "ABC234", hostToken: "host-secret-token", seed: 1, now: () => Date.now() });
  const players = Array.from({ length: n }, (_, i) => lobby.join(`P${i}`));
  lobby.selectGame(voteGame.id);
  lobby.assign("count", groups);
  lobby.control("prepare");
  return { lobby, players, group: () => lobby.game!.groups[0]! };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); registry.delete(voteGame.id); });

describe("vote phase", () => {
  it("enters VOTING with a 30s timer after every member spoke twice", () => {
    const { lobby, group } = setupVote(3);
    lobby.control("start");
    for (let i = 0; i < 6; i++) lobby.control("skip");
    expect(group().phase).toBe("VOTING");
    expect(group().timer.durationMs).toBe(30_000);
    expect(group().timer.endsAt).toBe(Date.now() + 30_000);
    expect(buildView(lobby, { kind: "projector" }).game!.groups[0]!.currentSpeakerId).toBeNull();
  });
  it("closes on timer expiry, eliminates and goes to ROUND_END", () => {
    const { lobby, group } = setupVote(3);
    const timers = new TimerService(() => Date.now());
    lobby.onChange = () => timers.reconcile(lobby);
    lobby.control("start");
    lobby.control("endRound"); // "Vote now"
    expect(group().phase).toBe("VOTING");
    const first = activePlayers(group())[0]!;
    vi.advanceTimersByTime(30_000);
    expect(group().phase).toBe("ROUND_END");
    expect(group().eliminated).toEqual([first]);
    expect(group().turnOrder).not.toContain(first);
    expect(group().data).toEqual({ closes: 1 });
    timers.dispose();
  });
  it("closes early when the module says everyone voted", () => {
    const { lobby, players, group } = setupVote(3);
    lobby.control("start");
    lobby.control("endRound");
    lobby.action(players[0]!.id, { type: "everyone-voted" });
    expect(group().phase).toBe("ROUND_END");
  });
  it("pauses, resumes, extends and skips the vote timer without leaving VOTING", () => {
    const { lobby, group } = setupVote(3);
    lobby.control("start");
    lobby.control("endRound");
    vi.advanceTimersByTime(10_000);
    lobby.control("pause");
    expect(group().phase).toBe("VOTING");
    expect(group().timer).toMatchObject({ endsAt: null, pausedRemainingMs: 20_000 });
    lobby.control("resume");
    expect(group().timer.endsAt).toBe(Date.now() + 20_000);
    lobby.control("extend");
    expect(group().timer.endsAt).toBe(Date.now() + 50_000);
    lobby.control("skip");
    expect(group().phase).toBe("ROUND_END");
  });
  it("rejects endRound while VOTING and turn:done outside RUNNING", () => {
    const { lobby, players } = setupVote(3);
    lobby.control("start");
    lobby.control("endRound");
    expect(() => lobby.control("endRound")).toThrow("not ready");
    expect(() => lobby.action(players[0]!.id, { type: "turn:done" })).toThrow();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm --filter @cangsplayground/server exec vitest run test/vote-cycle.test.ts`
Expected: FAIL. `activePlayers` is not exported, and `voteDurationMs` does not exist on the type.

- [ ] **Step 3: Implement the core types and the Lobby voting phase as described in the Interfaces block**

`prepareGroup` initializes `eliminated: []`. Add a private `endTurns(group)`: `startVote` if `module.voteDurationMs?.(config)` is a number, otherwise the existing `ROUND_END` + `idle`. `advance` and `removeTurns` call it. `removeTurns` may only call `endTurns` when the phase is `RUNNING` or `PAUSED`. Add `eliminated: []` to the hand-built runtimes in the two game logic tests.

- [ ] **Step 4: Run the new and the existing tests**

Run: `pnpm --filter @cangsplayground/server test && pnpm --filter @cangsplayground/game-secret-word test && pnpm --filter @cangsplayground/game-free-talk test && pnpm typecheck`
Expected: all PASS. `typecheck` will fail in `apps/web` wherever exhaustive phase maps exist. If so, add the two phases with `false`/neutral text there; Task 4 finishes that work.

- [ ] **Step 5: Commit**

```bash
git add packages/core apps/server packages/games/*/test apps/web
git commit -m "feat(core): voting phase with server timer and eliminations"
```

---

### Task 2: Continue keeps roles, FINISHED, players leaving mid-game

**Files:**
- Modify: `packages/core/src/game.ts`
- Modify: `apps/server/src/lobby/Lobby.ts` (`control` `nextRound` branch and the guard for `FINISHED`, `removePlayer`)
- Test: `apps/server/test/vote-cycle.test.ts` (append)

**Interfaces:**
- Consumes: Task 1 (`setupVote`, `voteGame`, `closeVote`, `endTurns`).
- Produces:
  - `GameModule.onContinue?(args: { config; state: GroupRuntime<Data>; rng: Rng }): Data`. When defined, `nextRound` on a `ROUND_END` group does **not** call `prepare` and does not run `validateGroups`. Instead it sets `data = onContinue(...)` and `round + 1`, and rebuilds `turnOrder = activePlayers(state)` repeated `turnsPerPlayer` times with the same order (no shuffle). It also sets `turnIndex = 0`, `phase = "RUNNING"` and calls `freshTurn`. When the hook is not defined, behavior is unchanged.
  - `interface LeaveOutcome<Data> { data: Data; finished?: boolean; closeVote?: boolean }`
  - `GameModule.onPlayerLeft?(args: { config; state: GroupRuntime<Data>; playerId: PlayerId }): LeaveOutcome<Data>`. In `removePlayer`, it is called for the leaving player's runtime group, after `removeTurns`. `finished` → `FINISHED` + idle timer. `closeVote` while `VOTING` → `closeVote`.
  - A `FINISHED` group accepts no control command except `exit`. Every control `continue`s past it.

- [ ] **Step 1: Write the failing tests** (append to `vote-cycle.test.ts`. Extend `voteGame` locally with `{ ...voteGame, onContinue, onPlayerLeft }` and register it under the same id.)

```ts
describe("continue and leaving", () => {
  it("Continue keeps data, drops eliminated players, keeps order and starts RUNNING", () => {
    const prepare = vi.fn(() => ({ closes: 0 }));
    registry.set(voteGame.id, { ...voteGame, prepare, onContinue: ({ state }) => ({ closes: state.data.closes + 10 }) });
    const { lobby, group } = setupVote(4);
    lobby.control("start");
    const order = activePlayers(group());
    lobby.control("endRound");
    lobby.control("skip"); // close vote → eliminates order[0]
    lobby.control("nextRound", group().groupId);
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(group()).toMatchObject({ phase: "RUNNING", round: 2, turnIndex: 0, data: { closes: 11 } });
    expect(group().turnOrder).toEqual([...order.slice(1), ...order.slice(1)]);
  });
  it("onPlayerLeft can finish the group or close the vote", () => {
    registry.set(voteGame.id, { ...voteGame, onPlayerLeft: ({ state }) => ({ data: state.data, finished: true }) });
    const { lobby, players, group } = setupVote(3);
    lobby.control("start");
    lobby.removePlayer(players[2]!.id);
    expect(group().phase).toBe("FINISHED");
    expect(() => lobby.control("start")).toThrow("not ready");
    expect(() => lobby.control("nextRound")).toThrow("not ready");
  });
  it("closeVote from onPlayerLeft while VOTING", () => {
    registry.set(voteGame.id, { ...voteGame, onPlayerLeft: ({ state }) => ({ data: state.data, closeVote: true }) });
    const { lobby, players, group } = setupVote(4);
    lobby.control("start");
    lobby.control("endRound");
    lobby.removePlayer(players[3]!.id);
    expect(group().phase).toBe("ROUND_END");
  });
  it("leaving while VOTING does not end the vote by itself", () => {
    const { lobby, players, group } = setupVote(4);
    lobby.control("start");
    lobby.control("endRound");
    lobby.removePlayer(players[3]!.id);
    expect(group().phase).toBe("VOTING");
  });
});
```

- [ ] **Step 2: Run and confirm it fails** — `pnpm --filter @cangsplayground/server exec vitest run test/vote-cycle.test.ts` → FAIL (`nextRound` calls `prepare`, there is no `FINISHED`).

- [ ] **Step 3: Implement the hooks and Lobby rules as described in Interfaces**

- [ ] **Step 4: Run** — `pnpm --filter @cangsplayground/server test` → PASS, including `lobby.test.ts` (Free Talk `nextRound` unchanged).

- [ ] **Step 5: Commit** — `git commit -am "feat(core): continue without re-dealing, finished groups, leave hook"`

---

### Task 3: Session-wide game clock

**Files:**
- Modify: `packages/core/src/types.ts`, `packages/core/src/game.ts`
- Modify: `apps/server/src/lobby/Lobby.ts` (`Session.clock`, `control` prepare/start/pause/resume/exit, new `expireClock`)
- Modify: `apps/server/src/timer/TimerService.ts`, `apps/server/src/broadcast.ts`
- Test: `apps/server/test/game-clock.test.ts`

**Interfaces:**
- Consumes: Task 1/2 test helpers (`voteGame`, `setupVote` exported from `vote-cycle.test.ts`. Move them to `apps/server/test/vote-game.ts` if Vitest complains about importing a test file).
- Produces:
  - `interface GameClockView { timer: TimerState; done: boolean }`. `GameSessionView.clock: GameClockView | null` (public tier, every viewer).
  - `GameModule.gameDurationMs?(config): number | null`
  - `GameModule.onGameTimeUp?(args: { config; state: GroupRuntime<Data> }): Data`
  - `Session.clock: { timer: TimerState; done: boolean } | null`:
    - Created at `prepare` as idle `{ endsAt: null, pausedRemainingMs: null, durationMs }` when the hook returns a number, otherwise `null`.
    - It starts (`endsAt = now + durationMs`) the first time a `start` command is accepted while it is idle and not `done`.
    - `pause` **without** `groupId` pauses it, and `resume` without `groupId` resumes it, as long as at least one group was accepted.
    - Commands that carry a `groupId` never touch it.
  - `Lobby.expireClock(endsAt: number)`: ignored unless `clock.timer.endsAt === endsAt && now >= endsAt`. Each group that is not `FINISHED` gets `data = onGameTimeUp?.(...) ?? data`, `phase = "FINISHED"` and an idle timer. Then `clock = { timer: idle, done: true }`, followed by `changed()`.
  - TimerService key: `${lobby.code}:clock`.

- [ ] **Step 1: Write the failing test** `apps/server/test/game-clock.test.ts`

```ts
it("starts on first start, pauses only for whole-class pause, ends every unfinished group", () => {
  const onGameTimeUp = vi.fn(({ state }) => ({ closes: -1 }));
  registry.set(voteGame.id, { ...voteGame, gameDurationMs: () => 120_000, onGameTimeUp });
  const { lobby } = setupVote(6, 2);
  const timers = new TimerService(() => Date.now());
  lobby.onChange = () => timers.reconcile(lobby);
  expect(lobby.game!.clock!.timer.endsAt).toBeNull();
  lobby.control("start");
  expect(lobby.game!.clock!.timer.endsAt).toBe(Date.now() + 120_000);
  const [g1, g2] = lobby.game!.groups;
  lobby.control("pause", g1!.groupId);
  expect(lobby.game!.clock!.timer.endsAt).not.toBeNull();
  lobby.control("pause");
  expect(lobby.game!.clock!.timer).toMatchObject({ endsAt: null, pausedRemainingMs: 120_000 });
  lobby.control("resume");
  vi.advanceTimersByTime(120_000);
  expect(lobby.game!.groups.map((g) => g.phase)).toEqual(["FINISHED", "FINISHED"]);
  expect(onGameTimeUp).toHaveBeenCalledTimes(2);
  expect(buildView(lobby, { kind: "projector" }).game!.clock).toMatchObject({ done: true });
  timers.dispose();
});
it("groups already FINISHED keep their data; ROUND_END groups still finish", () => { /* finish g1 via onPlayerLeft finished:true, put g2 in ROUND_END via endRound+skip, expire → g1 data unchanged, onGameTimeUp called once */ });
it("modules without gameDurationMs have clock null", () => {
  const { lobby } = setupVote(3);
  expect(buildView(lobby, { kind: "host" }).game!.clock).toBeNull();
});
```

- [ ] **Step 2: Run and confirm it fails** — `pnpm --filter @cangsplayground/server exec vitest run test/game-clock.test.ts` → FAIL.

- [ ] **Step 3: Implement as described in Interfaces**

- [ ] **Step 4: Run** — `pnpm --filter @cangsplayground/server test` → PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat(core): session-wide game clock"`

---

### Task 4: Prepare hooks, conditional config fields, generic web support

**Files:**
- Modify: `packages/core/src/types.ts` (`ConfigField.showWhen`), `packages/core/src/game.ts`
- Modify: `apps/server/src/lobby/Lobby.ts` (`control("prepare")`, `validateGroups`)
- Modify: `packages/ui/src/game-views.ts`, `packages/ui/src/components.tsx`, `packages/ui/src/styles/components.css`
- Modify: `apps/web/src/components/game-controls.ts`, `config-fields.ts`, `ConfigForm.tsx`, `HostGame.tsx`, `apps/web/src/routes/Host.tsx`, `Player.tsx`, `Display.tsx`
- Test: `apps/server/test/vote-cycle.test.ts` (append), `apps/web/test/game-controls.test.ts`, `apps/web/test/helpers.test.ts`

**Interfaces:**
- Produces (core/server):
  - `GameModule.validateGroup?(args: { config; group: GroupSummary }): string | null`. `validateGroups` calls it for each summary after the min-size check. A non-null result → `fail("GROUPS_TOO_SMALL", message)`.
  - `GameModule.resolveConfig?(args: { config; rng: Rng }): Config`. Called once in `prepare`, before `validateGroups`. The result replaces `game.config`.
  - `ConfigField.showWhen?: { key: string; equals: string }`
- Produces (ui):
  - `export type GameControl = C2SPayload<"game:control">["cmd"]` in `game-views.ts`.
  - `GameViews.controlLabels?: Partial<Record<GameControl, string | null>>`: a string renames the button, `null` hides it.
  - `export function GameClock({ clock, serverNow, size = "sm" }: { clock: GameClockView; serverNow: () => number; size?: "sm" | "lg" })`: shows the label "Game time" with a `<Timer>`, or "Time's up" when `done`.
  - `GroupCard` adds the class `cp-member-out` to members listed in `game.eliminated` (dimmed, line-through). `cp-group-speaking` stays tied to `RUNNING` only.
- Produces (web):
  - `canControl` follows the table in Task 1 exactly. `mainControl` keeps its order.
  - `visibleFields(fields: ConfigField[], values: Record<string, unknown>): ConfigField[]` in `config-fields.ts` drops a field whose `showWhen` does not match. `ConfigForm` renders only those fields, but saves every value.
  - Labels: `HostGame` `SecondaryControls`, the per-group main button, the `Host.tsx` fixed bar and its confirm dialog all read `gameViews[gameId]?.controlLabels`. The confirm title for `endRound` becomes `` `${label}?` `` when a label exists. Its description for a voting game is "Speaking ends now for this group." (or "for all groups." when there is no `groupId`).
  - `Player.tsx` status text: `VOTING` → "Vote now", `FINISHED` → "Game over".
  - `Player.tsx` header, the top of `HostGame` and the `Display` projector-public area each render `GameClock` when `session.clock` is set (`lg` on the projector).
  - `HostGame` shows a phase chip per group: "Speaking" / "Voting" / "Waiting" (ROUND_END) / "Finished".

- [ ] **Step 1: Write the failing tests**

`apps/web/test/game-controls.test.ts`: keep the existing `session(phase)` helper and give it an optional timer override.
```ts
it("handles VOTING and FINISHED", () => {
  const voting = session("VOTING", { endsAt: 1, pausedRemainingMs: null, durationMs: 30_000 });
  expect(canControl("pause", voting)).toBe(true);
  expect(canControl("resume", voting)).toBe(false);
  expect(canControl("skip", voting)).toBe(true);
  expect(canControl("endRound", voting)).toBe(false);
  const pausedVote = session("VOTING", { endsAt: null, pausedRemainingMs: 9_000, durationMs: 30_000 });
  expect(canControl("resume", pausedVote)).toBe(true);
  expect(mainControl(pausedVote).cmd).toBe("resume");
  for (const cmd of ["start", "pause", "resume", "skip", "extend", "endRound", "reveal", "nextRound"] as const)
    expect(canControl(cmd, session("FINISHED"))).toBe(false);
});
```
`apps/web/test/helpers.test.ts`:
```ts
it("visibleFields hides fields whose showWhen does not match", () => {
  const fields = [{ key: "category", label: "C", kind: "select" },
    { key: "foodTopic", label: "F", kind: "select", showWhen: { key: "category", equals: "food" } }] as ConfigField[];
  expect(visibleFields(fields, { category: "location" }).map((f) => f.key)).toEqual(["category"]);
  expect(visibleFields(fields, { category: "food" }).map((f) => f.key)).toEqual(["category", "foodTopic"]);
});
```
`vote-cycle.test.ts`:
```ts
it("resolveConfig runs once at prepare; validateGroup blocks prepare", () => {
  const resolveConfig = vi.fn(({ config }) => ({ ...config, resolved: true }));
  registry.set(voteGame.id, { ...voteGame, resolveConfig, validateGroup: ({ group }) => group.playerIds.length < 4 ? `${group.name} is small.` : null });
  // 3 players: prepare throws "Team Red is small." and resolveConfig is still allowed to have run; config unchanged after failure
  // 4 players: prepare succeeds, resolveConfig called once, lobby.game.config.resolved === true
});
```

- [ ] **Step 2: Run and confirm they fail** — `pnpm --filter @cangsplayground/web test && pnpm --filter @cangsplayground/server exec vitest run test/vote-cycle.test.ts` → FAIL.

- [ ] **Step 3: Implement everything in Interfaces.** When validation fails, `prepare` must not keep the resolved config: assign it only after `validateGroups` passes.

- [ ] **Step 4: Run** — `pnpm test && pnpm typecheck` → PASS (Free Talk/Secret Word render exactly as before: no labels, no clock).

- [ ] **Step 5: Commit** — `git commit -am "feat: prepare hooks, conditional config fields, phase-aware host controls and game clock UI"`

---

### Task 5: Who's the Spy package — data, config, dealing, visibility

**Files:**
- Create: `packages/games/whos-the-spy/package.json`, `tsconfig.json` (copy from `secret-word`, name `@cangsplayground/game-whos-the-spy`)
- Create: `packages/games/whos-the-spy/data/topics.json`
- Create: `packages/games/whos-the-spy/src/index.ts`, `src/types.ts`, `src/logic.ts`
- Test: `packages/games/whos-the-spy/test/logic.test.ts`

**Interfaces:**
- Consumes: the core hooks from Tasks 1–4.
- Produces (`src/types.ts`):
```ts
export const GAME_ID = "whos-the-spy";
export const VOTE_MS = 30_000;
export const TURNS_BEFORE_VOTE = 2;
export type Category = "location" | "food";
export interface Topic { id: string; name: string; hints: [string, string, string, string] }
export const configSchema; // z.object({ category: enum default "location", locationTopic: string default "random",
//   foodTopic: string default "random", spies: int 1..29 default 1, gameMinutes: int 5..30 default 12,
//   turnSeconds: int 15..300 default 60 }) with a refine that each *Topic is "random" or an id in that category
export type WhosTheSpyConfig = z.infer<typeof configSchema>;
export interface VoteResult { out: PlayerId | null; wasSpy: boolean; tally: Record<PlayerId, number> }
export interface GameResult { winner: "team" | "spies"; reason: "caught" | "left" | "outnumbered" | "time" }
export interface WhosTheSpyData {
  topicId: string; spies: PlayerId[]; votes: Record<PlayerId, PlayerId>;
  voteNumber: number; lastVote: VoteResult | null; result: GameResult | null;
}
export interface WhosTheSpyPublicInfo { category: Category; turnSeconds: number }
export interface WhosTheSpyGroupView {
  category: Category;
  role: "civilian" | "spy" | null;
  topic: { name: string; hints: string[] } | null;
  spies: PlayerId[] | null;
  voted: PlayerId[];
  myVote: PlayerId | null;
  votes: Record<PlayerId, PlayerId> | null;
  voteNumber: number;
  lastVote: { out: PlayerId | null; wasSpy: boolean | null; tally: Record<PlayerId, number> | null } | null;
  spiesLeft: number | null;
  result: GameResult | null;
}
export function topicsFor(category: Category): Topic[]; // in logic.ts or a small topics.ts
export function topicById(id: string): Topic & { category: Category };
```
- Produces (`whosTheSpy: GameModule<WhosTheSpyConfig, WhosTheSpyData>` in `src/logic.ts`, default export from `index.ts`):
  - `name: "Who's the Spy"`, `description: "Find the spy. Talk about the topic, but don't say its name."`, `minPlayersPerGroup: 3`, `recommended: "3–8 per group"`.
  - `configFields`:
    - `category` select (Location/Food)
    - `locationTopic` and `foodTopic` selects with `showWhen` on the category. The first option is `{ value: "random", label: "🎲 Random" }`, then every topic of that category.
    - `spies` number, 1–29, label "Spies per group", help "Always fewer spies than other players."
    - `gameMinutes` number, 5–30, step 1, unit "min", label "Game time"
    - `turnSeconds` number, 15–300, step 15, unit "sec", label "Time for each turn"
  - `turnDurationMs = turnSeconds*1000`, `turnsPerPlayer = 2`, `voteDurationMs = VOTE_MS`, `gameDurationMs = gameMinutes*60_000`.
  - `resolveConfig`: if the active category's topic is `"random"`, pick one with `rng` and write its id back to that key.
  - `validateGroup`: let `n = group.playerIds.length`. If `config.spies > Math.floor((n - 1) / 2)`, return `` `${group.name} has ${n} players. ${s} ${s === 1 ? "spy needs" : "spies need"} at least ${2 * s + 1}.` `` with `s = config.spies`.
  - `prepare`: `spies = shuffle(unique(group.playerIds), rng).slice(0, config.spies)`, `topicId` = the resolved topic of the active category, `votes: {}`, `voteNumber: 0`, `lastVote: null`, `result: null`.
  - `publicInfo`: returns `{ category, turnSeconds }`. It never includes the topic.
  - `viewFor` (spec §4). Let `out = state.eliminated.includes(viewer.playerId)`.
    - **host**: everything. `role: null`, `myVote: null`, `votes` = all, `spiesLeft` = spies not eliminated.
    - **player member, no result, not out**: `role`. `topic` only if civilian. `spies: null`, `votes: null`, `myVote` = their own vote, `lastVote` full, `spiesLeft`.
    - **player member, no result, out**: `role: null`, `topic: null`, `myVote: null`, `lastVote` full, `spiesLeft`.
    - **player member with result**: everything except `votes` (`null`). `role` stays set.
    - **projector / non-member**: `role`, `topic` and `spies` are `null`. `myVote: null`, `votes: null`, `spiesLeft: null`. `lastVote` becomes `{ out, wasSpy: null, tally: null }`. `result` is shown.
    - `voted` = `Object.keys(votes)` for every viewer.
- `topics.json`: `{ "location": Topic[], "food": Topic[] }`, with 16–20 topics per category and 4 hints each. Use simple A2–B1 English (e.g. Airport: passport, gate, luggage, boarding pass). Use the lists in spec §6 as the starting set. Ids are kebab-case and unique across both categories.

- [ ] **Step 1: Write the failing tests** `packages/games/whos-the-spy/test/logic.test.ts` (pattern of `secret-word` test, helper `runtime(data overrides, { phase, eliminated })`)

```ts
it("ships 16–20 topics per category, 4 hints each, unique ids", () => {
  for (const c of ["location", "food"] as const) {
    expect(topicsFor(c).length).toBeGreaterThanOrEqual(16);
    expect(topicsFor(c).length).toBeLessThanOrEqual(20);
    for (const t of topicsFor(c)) expect(t.hints).toHaveLength(4);
  }
  const ids = [...topicsFor("location"), ...topicsFor("food")].map((t) => t.id);
  expect(new Set(ids).size).toBe(ids.length);
});
it("defaults and rejects unknown topics", () => {
  expect(whosTheSpy.defaultConfig).toEqual({ category: "location", locationTopic: "random", foodTopic: "random", spies: 1, gameMinutes: 12, turnSeconds: 60 });
  expect(whosTheSpy.configSchema.safeParse({ ...whosTheSpy.defaultConfig, foodTopic: "airport" }).success).toBe(false);
});
it("resolveConfig picks one topic of the active category only when random", () => {
  const c = whosTheSpy.resolveConfig!({ config: { ...whosTheSpy.defaultConfig, category: "food" }, rng: createRng(3) });
  expect(topicsFor("food").map((t) => t.id)).toContain(c.foodTopic);
  expect(c.locationTopic).toBe("random");
  const fixed = { ...whosTheSpy.defaultConfig, locationTopic: "airport" };
  expect(whosTheSpy.resolveConfig!({ config: fixed, rng: createRng(3) })).toEqual(fixed);
});
it("validateGroup enforces spies < others", () => {
  const g = (n: number) => ({ id: "g1", index: 0, name: "Team Red", playerIds: Array.from({ length: n }, (_, i) => `p${i}`) });
  const two = { ...whosTheSpy.defaultConfig, spies: 2 };
  expect(whosTheSpy.validateGroup!({ config: two, group: g(4) })).toBe("Team Red has 4 players. 2 spies need at least 5.");
  expect(whosTheSpy.validateGroup!({ config: two, group: g(5) })).toBeNull();
  expect(whosTheSpy.validateGroup!({ config: whosTheSpy.defaultConfig, group: g(3) })).toBeNull();
});
it("prepare deals exactly `spies` distinct spies from the group", () => { /* spies: 2, 6 players → 2 unique members */ });
it("viewFor: civilian sees topic+hints, spy sees only category, projector sees neither", () => {
  // state with topicId "airport", spies ["b"]; assert:
  // a (member) → role "civilian", topic.name "Airport", spies null
  // b (member) → role "spy", topic null; JSON.stringify(view) not.toContain("Airport") and not.toContain("passport")
  // projector → role/topic/spies null; JSON.stringify not.toContain("Airport"), not.toContain('"b"' in spies)
  // host → topic + spies ["b"]
});
it("viewFor: eliminated member loses the card; result reveals topic+spies to members, never to projector", () => {});
it("publicInfo never contains the topic", () => {
  const cfg = { ...whosTheSpy.defaultConfig, locationTopic: "airport" };
  expect(JSON.stringify(whosTheSpy.publicInfo(cfg))).not.toContain("airport");
});
```

- [ ] **Step 2: Run and confirm it fails** — `pnpm install && pnpm --filter @cangsplayground/game-whos-the-spy test` → FAIL (module missing).

- [ ] **Step 3: Implement** the files listed in this task's Interfaces block.

- [ ] **Step 4: Run** — `pnpm --filter @cangsplayground/game-whos-the-spy test && pnpm --filter @cangsplayground/game-whos-the-spy typecheck` → PASS.

- [ ] **Step 5: Commit** — `git add packages/games/whos-the-spy pnpm-lock.yaml && git commit -m "feat(whos-the-spy): topics, config, dealing and visibility"`

---

### Task 6: Who's the Spy package — votes and outcomes

**Files:**
- Modify: `packages/games/whos-the-spy/src/logic.ts`
- Test: `packages/games/whos-the-spy/test/logic.test.ts` (append)

**Interfaces:**
- Consumes: `WhosTheSpyData` and the other types from Task 5. `activePlayers`, `VoteOutcome` and `LeaveOutcome` from core.
- Produces:
  - `onAction` for `{ type: "vote", payload: { targetId: string } }`. The vote is accepted only when **all** of these hold:
    - `state.phase === "VOTING"` and `state.timer.endsAt !== null` (the timer is not paused)
    - the actor is a player in `activePlayers(state)`
    - the actor has not voted yet
    - the target is in `activePlayers(state)` and is not the actor

    Anything else returns `null`. When accepted, it returns `{ data: { ...votes, [actor]: target }, closeVote: every active player has voted }`.
  - `onVoteEnd`:
    - Count `tally` only for votes from active players for active targets. The top count wins only if there is a single leader with ≥1 vote; otherwise `out: null`.
    - `voteNumber + 1`. `lastVote = { out, wasSpy: spies.includes(out), tally }`. Votes reset to `{}`.
    - Win check on the active players after removing `out`:
      - no spies left → `{ winner: "team", reason: "caught" }`
      - else if civilians ≤ spies → `{ winner: "spies", reason: "outnumbered" }`
    - Returns `{ data, eliminate: out ? [out] : [], finished: result !== null }`.
  - `onContinue`: returns `{ ...data, votes: {}, lastVote: null }`.
  - `onPlayerLeft`:
    - Delete the votes cast by the leaver and the votes cast for them.
    - Win check on `activePlayers(state)`. Core has already removed the leaver from `turnOrder` at this point. A spy leaving makes the team win only when no spies are left, with reason `"left"`. Outnumbered → spies win, reason `"outnumbered"`.
    - Returns `{ data, finished, closeVote: phase VOTING && every remaining active player has voted && at least one vote exists }`.
  - `onGameTimeUp`: if `result` is null, set it to `{ winner: "spies", reason: "time" }`.

- [ ] **Step 1: Write the failing tests** (append)

```ts
it("accepts one locked vote per active player and asks to close when everyone voted", () => {
  // VOTING, timer running, active a,b,c
  // a→b ok (closeVote false), a→c again → null, a→a → null, d (not member) → null, eliminated x → null
  // b→a, c→a → closeVote true
});
it("rejects votes while the vote timer is paused or outside VOTING", () => {});
it("onVoteEnd: plurality eliminates; tie or no votes eliminates nobody", () => {
  // votes {a:b, c:b, b:a} → out b, tally {b:2, a:1}
  // votes {a:b, b:a} → out null; votes {} → out null; voteNumber increments; votes reset
});
it("team wins when the last spy is voted out; spies win when civilians <= spies", () => {
  // spies [b], active a,b,c: out b → finished, result {team, caught}
  // spies [b], active a,b,c: out a → active b,c → 1 civ vs 1 spy → {spies, outnumbered}
  // spies [b,d], active a,b,c,d,e: out a → 2 civ vs 2 spy → {spies, outnumbered}
});
it("onPlayerLeft drops votes, can finish, can close the vote", () => {
  // spy b leaves, spies [b] → finished, {team, left}
  // during VOTING a→c, c→a, b leaves (b not voted) → closeVote true and no vote mentions b
});
it("onGameTimeUp sets spies/time only when unfinished", () => {});
it("onContinue clears votes and lastVote, keeps spies/topic/voteNumber", () => {});
```

- [ ] **Step 2: Run and confirm it fails** — `pnpm --filter @cangsplayground/game-whos-the-spy test` → FAIL.

- [ ] **Step 3: Implement** the hooks listed in this task's Interfaces block.

- [ ] **Step 4: Run** — same command → PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat(whos-the-spy): voting, eliminations and win conditions"`

---

### Task 7: Register on the server + end-to-end privacy test

**Files:**
- Modify: `apps/server/package.json` (dependency `"@cangsplayground/game-whos-the-spy": "workspace:*"`), `apps/server/src/games/registry.ts`
- Test: `apps/server/test/whos-the-spy.test.ts` (copy the socket harness from `secret-word.test.ts`)

**Interfaces:**
- Consumes: `whosTheSpy` (default export) from Task 5/6. `WhosTheSpyGroupView` for typing views.

- [ ] **Step 1: Write the failing test**

```ts
it("never sends the topic to the projector or the spy, and never sends spy ids to the projector", async () => {
  // create lobby, 4 players join, projector watches; host: select "whos-the-spy",
  // configure { locationTopic: "airport" }, assign count 1, prepare, start
  // find spy via host view (data.spies[0]); skip 8 turns → VOTING; every player votes for the spy
  // await until group phase FINISHED
  // expect(projector.raw).not.toMatch(/Airport|passport|boarding pass/)
  // expect(spyClient.raw before FINISHED).not.toMatch(/Airport|passport/)  (record raw length at FINISHED transition)
  // projector views never include a non-null `spies` or `role`
  // a civilian's view at FINISHED: data.result {winner:"team", reason:"caught"}, data.spies === [spyId]
});
it("blocks prepare when a group is too small for the spy count", async () => {
  // 4 players, configure { spies: 2 } → prepare ack error GROUPS_TOO_SMALL "Team Red has 4 players. 2 spies need at least 5."
});
```

- [ ] **Step 2: Run and confirm it fails** — `pnpm install && pnpm --filter @cangsplayground/server exec vitest run test/whos-the-spy.test.ts` → FAIL (`Game not found`).

- [ ] **Step 3: Register** `whosTheSpy` in `registry.ts`, after `secretWord`.

- [ ] **Step 4: Run** — `pnpm --filter @cangsplayground/server test` → PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat(server): register Who's the Spy"`

---

### Task 8: Who's the Spy views (Arcade Night)

**Files:**
- Create: `packages/games/whos-the-spy/src/views/index.tsx`, `src/views/whos-the-spy.css`, `src/views/css.d.ts` (copy the secret-word pattern)
- Modify: `apps/web/package.json`, `apps/web/src/games/registry.ts`, `packages/ui/src/game-views.ts` (`act`), `apps/web/src/routes/Player.tsx` (pass `act`)
- Test: `apps/web/test/rendering.test.tsx` (append)

**Interfaces:**
- Consumes: `WhosTheSpyGroupView`, `WhosTheSpyPublicInfo`, `topicsFor`, `GAME_ID`. From the UI: `SecretCard`, `TurnIndicator`, `Panel`, `Chip`, `Button`, `Timer`, `GameClock`, `GameViews`. Votes go through a new optional prop `GameViewProps.act?: (action: GameAction) => Promise<boolean>` (add it in `packages/ui/src/game-views.ts`). `Player.tsx` passes `act = async (a) => { const r = await request("game:action", a); if (!r.ok) toast.error(r.error.message); return r.ok; }`. The vote button calls `act({ type: "vote", payload: { targetId } })`.
- Produces: `whosTheSpyViews: GameViews` (default export of `./views`) with `ProjectorHeader`, `ProjectorGroupCard`, `HostGroupPanel`, `PlayerScreen`, and `controlLabels: { endRound: "Vote now", nextRound: "Continue", reveal: null }`.

The text on screen must match the spec mockups (`style-preview.html#arcade` for the screens that already exist, `new-screens.html` for the new ones). Exact copy:

| Screen (PlayerScreen branch, checked in this order) | Copy |
|---|---|
| `result` set | "Team wins!" / "Spy wins!". Subline by reason: caught → "You found every spy.", left → "The last spy left the game.", outnumbered → "The spies outnumber the team.", time → "Time's up. A spy is still in the game.". Then "The topic was" + topic name, and "Spy: X" or "Spies: X, Y". Footer "Wait for your teacher…" |
| me in `group.eliminated` | "You're out", "Stay quiet and watch. No talking, no voting.", "Now speaking" + name, "Still in" + names |
| phase `VOTING` | "Who's the spy?", "Vote {voteNumber+1} · Pick one player", options are the active players except me, "{k} of {m} voted", button "Lock my vote". After locking: "Vote locked" (disabled), with the chosen option highlighted |
| phase `ROUND_END` with `lastVote` | "Voted out" + name + "was NOT the spy" / "was a SPY!". When `out` is null: "No one was voted out" + "It's a tie." (when tally has votes) or "No votes.". Tally list. Then "The spy is still here." when `spiesLeft === 1` and `wasSpy` was false, otherwise "{n} spy left." / "{n} spies left.". Then "2 more rounds, then vote again." and "Wait for your teacher…" |
| otherwise | `SecretCard`. Civilian: kicker category name, topic name, hint chips, "Don't say the word.". Spy: kicker "Your role", "You are the SPY", chip "Category: Location"/"Category: Food", "Listen well. Guess the topic.". Below the card: `TurnIndicator` (not inside `YourTurn`). Inside `YourTurn` add the tip "Describe the place. Don't say its name." / "Describe the food. Don't say its name." |

- `ProjectorHeader`: chip "Category: {Location|Food}". The clock comes from Task 4's generic `Display`, so do not duplicate it here.
- `ProjectorGroupCard`: VOTING → "Voting {k}/{m}" plus a ✓ list of the names that have voted. FINISHED → "Team wins!" / "Spy wins!". It shows no topic and no spies.
- `HostGroupPanel`: "Spy: {names}" / "Spies: …", "Topic: {name}", and during VOTING "{voter} → {target}" lines.

- [ ] **Step 1: Write the failing rendering tests** (append to `rendering.test.tsx`, using its existing render helper)

```ts
it("spy PlayerScreen shows role and category, no topic", () => { /* data role "spy", topic null → text "You are the SPY", "Category: Location" after hold; no "Airport" */ });
it("vote screen excludes me and locks", () => { /* phase VOTING, active a,b,c, me a → options b,c; myVote "b" → button text "Vote locked" disabled */ });
it("result screen for spies by time", () => { /* "Spy wins!", "Time's up. A spy is still in the game.", "The topic was", "Airport" */ });
it("controlLabels rename and hide host buttons", () => { /* HostGame with gameId whos-the-spy → "Vote now", "Continue", no "Reveal" */ });
```

- [ ] **Step 2: Run and confirm it fails** — `pnpm install && pnpm --filter @cangsplayground/web test` → FAIL.

- [ ] **Step 3: Implement the views and register `"whos-the-spy": whosTheSpyViews`**

- [ ] **Step 4: Run** — `pnpm --filter @cangsplayground/web test && pnpm typecheck && pnpm lint` → PASS.

- [ ] **Step 5: Manual check** — `pnpm dev`. Open the projector, the host phone and 3 player tabs, and play one round: deal, vote wrong once, Continue, catch the spy. Compare each screen with `new-screens.html` and `style-preview.html#arcade`.

- [ ] **Step 6: Commit** — `git add -A packages/games/whos-the-spy apps/web pnpm-lock.yaml && git commit -m "feat(web): Who's the Spy views"`

---

### Task 9: Simulation + full verification

**Files:**
- Modify: `apps/server/scripts/simulate.ts`

- [ ] **Step 1: Extend the simulator.** With `--game whos-the-spy` it selects the game. When a player's group is `VOTING`, each bot votes for a random active member other than itself. When a group is `ROUND_END` with no result, the host bot sends `nextRound` for that group. The run ends when every group is `FINISHED`, and it prints each group's `result`.

- [ ] **Step 2: Run** — `pnpm --filter @cangsplayground/server sim -- --game whos-the-spy` → exits 0 and prints one result per group.

- [ ] **Step 3: Full suite** — `pnpm lint && pnpm typecheck && pnpm test` → all PASS.

- [ ] **Step 4: Commit** — `git commit -am "chore(sim): play Who's the Spy end to end"`
