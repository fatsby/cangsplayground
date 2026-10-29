# Guess the Character Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the approved Guess the Character minigame with concurrent paired matches, individual category votes, rotating questions, protected character cards and team guessing.

**Architecture:** A standalone shared-state GameModule owns pairing and match rules, following Shark Tank's session-view pattern. Optional shared-deadline hooks extend the existing server timer service; the server owns time, category selection and winners. Existing lobby/group tools, ConfigForm, SecretCard, Timer, PlayerIdentity and TeamBadge provide the UI foundation.

**Tech Stack:** Existing TypeScript/React, Zod, Socket.IO, pnpm workspaces, Vitest and happy-dom; Node >=22, pnpm 12.14.0. No new external dependencies.

**Spec:** `docs/superpowers/specs/2026-10-28-guess-the-character-design.md` — approved by the user's “ok plan đi” after the nine-category expansion. Read it alongside this plan; character lists and English support requirements live there.

## Global Constraints

- Game ID `guess-the-character`; package `@cangsplayground/game-guess-the-character`.
- Minimum two groups; even group count; at least one member per group; unequal sizes supported.
- Default vote **30 seconds** (10–180, step 5), turn **120 seconds** (15–600, step 15), team cooldown **5 seconds** (1–60, step 1).
- One vote per student, editable until deadline; random among tied leaders, including all categories when no one votes.
- Each pair gets two different character IDs within its selected category; pairs play independently.
- Alternate teams, rotate each team's members, and repeat until a correct guess or host End match. A correct guess can end the match before every student has spoken.
- Only the current questioner can use **“I'm done”**; question and answer share one timer. Anyone in either playing team can guess outside their speaking turn.
- Cooldown belongs to the group. Pause preserves vote/turn time and both teams' remaining cooldowns.
- Nine categories, 10–12 characters each, from spec §5.1. Curated aliases, no fuzzy matching or automatic translation.
- Use existing Arcade Night tokens/fonts/components; reuse `SecretCard` itself, not a new implementation of hold-to-reveal.
- Host sees all characters; each playing student receives only their own team's secret. Completed-match participants may receive both answers; projector and other pairs never do.
- Existing games retain their behavior. No tournament framework, scoreboard, voice/AI features, live content editor or persistence beyond the existing in-memory server.
- `.superpowers/brainstorm/` contains throwaway mockups, not product code. Preserve unrelated workspace changes, including the existing `.gitignore` edit.

## Review Focus

- A queued old timer runs after exit/re-Prepare at the same wall-clock deadline: it must neither mutate the replacement session nor remove its scheduled callback (Task 2).
- A delayed/retried wrong guess arrives after its cooldown: it must not charge the group again or override a newer guess (Task 4).
- A removed student rejoins with the same visible name but a new ID: they must not inherit round membership, vote or secret access (Tasks 4–5).
- Storage is disabled, a request rejects or never acknowledges, or a player reloads: English help and actions must remain usable and the secret must start hidden (Task 6).
- Long Vietnamese names, nine categories and a 320px phone viewport: choices, countdown, guess field and action must remain readable and reachable (Tasks 6–8).

## File Map

Existing modifications:

- `packages/core/src/game.ts`: optional shared-deadline contract, exported automatically by `src/index.ts`.
- `apps/server/src/lobby/Lobby.ts`: expose and expire validated shared deadlines and settle due deadlines before actions.
- `apps/server/src/timer/TimerService.ts`: schedule shared deadlines with session ownership and safe stale-callback handling.
- `apps/server/src/games/registry.ts`, `apps/server/package.json`: register the server module.
- `apps/web/src/games/registry.ts`, `apps/web/package.json`: register its views.
- `pnpm-lock.yaml`: workspace links from adding the new package, using the existing pnpm version.
- `README.md`: concise game/settings note in the final task.

New game package files, under `packages/games/guess-the-character/`:

| Path                                                                                                              | Responsibility                                                               |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `package.json`, `tsconfig.json`                                                                                   | Workspace package, root and `./views` exports, test/typecheck scripts        |
| `data/characters.json`                                                                                            | Unique canonical character records and curated aliases                       |
| `data/categories.json`                                                                                            | Nine categories and their character ID memberships                           |
| `src/types.ts`                                                                                                    | Config schema, domain state, action payloads, role-filtered view types       |
| `src/content.ts`                                                                                                  | Server-only validated content lookups and exact name normalization           |
| `src/phrases.ts`                                                                                                  | Category/level/role English help with Vietnamese meanings, no secret pools   |
| `src/round.ts`                                                                                                    | Pairing, group validation, round construction                                |
| `src/match.ts`                                                                                                    | Vote closure, alternating speakers, timers and pause/resume helpers          |
| `src/actions.ts`                                                                                                  | Actor/action validation, guesses, host controls                              |
| `src/lifecycle.ts`                                                                                                | Permanent departure, disconnect handling, next-round validation              |
| `src/logic.ts`, `src/index.ts`                                                                                    | GameModule wiring and root exports                                           |
| `src/view.ts`                                                                                                     | Explicit viewer projection, without internal aliases or full candidate pools |
| `src/views/index.tsx`                                                                                             | GameViews exports and null legacy PlayerScreen                               |
| `src/views/player.tsx`                                                                                            | Session-level player states, guess form, timer and done action               |
| `src/views/language-help.tsx`                                                                                     | A1/A2 controls, sentence frames and vocabulary                               |
| `src/views/use-game-action.ts`                                                                                    | Pending/error/timeout recovery for player actions                            |
| `src/views/host.tsx`                                                                                              | Match cards, settings note, round and per-match controls                     |
| `src/views/projector.tsx`                                                                                         | Public match grid                                                            |
| `src/views/guess-the-character.css`, `src/views/css.d.ts`                                                         | Layout and CSS module declaration, using existing tokens                     |
| `test/helpers.ts`                                                                                                 | Deterministic module harness used by domain tests                            |
| `test/content.test.ts`, `test/match.test.ts`, `test/guess.test.ts`, `test/lifecycle.test.ts`, `test/view.test.ts` | Content, rules, lifecycle and secrecy tests                                  |

Server tests: `apps/server/test/shared-deadline-game.ts`, `shared-deadlines.test.ts`, `guess-the-character.test.ts`, `guess-the-character-socket.test.ts`.

Web tests: `apps/web/test/guess-character-fixture.ts`, `guess-character-player.test.tsx`, `guess-character-host-projector.test.tsx`.

## Shared interfaces to establish

These are implementation choices within the approved design. Define them in the named tasks; later tasks consume them unchanged.

### Content and configuration — Task 1, `src/types.ts` / `src/content.ts`

```ts
type GuessConfig = { voteSeconds: number; turnSeconds: number; cooldownSeconds: number };
type Character = { id: string; name: string; aliases: string[] };
type Category = { id: string; name: string; characterIds: string[] };
type CharacterFace = Pick<Character, 'id' | 'name'>;
type CategoryOption = { id: string; name: string; examples: string[] };
type LanguageHelp = {
  questions: { en: string; vi: string }[];
  answers: { en: string; vi: string }[];
  grammar: { en: string; vi: string };
  vocabulary: { en: string; vi: string }[];
};
normalizeGuess(input: string): string;
characters(): readonly Character[];
categories(): readonly Category[];
characterById(id: string): Character;
categoryOptions(): CategoryOption[]; // Static 2–3 examples per category, never selected from a match's secrets.
matchesCharacter(input: string, characterId: string): boolean;
languageHelp(categoryId: string, level: 'A1' | 'A2'): LanguageHelp;
```

### Generic shared deadlines — Task 2, `packages/core/src/game.ts`

```ts
interface SharedDeadline { key: string; endsAt: number }
// Optional GameModule hooks:
sharedDeadlines?(args: SharedArgs<Config, Shared>): SharedDeadline[];
onSharedDeadline?(args: SharedArgs<Config, Shared> & {
  deadline: SharedDeadline;
}): Shared | null; // null or the same reference means no state change.
```

Public `Lobby` methods added in Task 2:

```ts
sharedDeadlines(): SharedDeadline[];
expireSharedDeadline(expectedSession: Session, deadline: SharedDeadline): boolean;
settleSharedDeadlines(): void;
```

`expireSharedDeadline` rechecks open lobby, exact session identity, active shared game, a currently exported matching key/endsAt and `now >= endsAt`, then publishes a changed result. `settleSharedDeadlines` snapshots currently due deadlines, sorts by `(endsAt,key)`, and expires them through that same method. New game deadlines start from the current server time, so delayed callbacks do not replay hours of historical turns.

### Domain state and action guards — Task 3, `src/types.ts`

```ts
type MatchPhase = "READY" | "CATEGORY_VOTE" | "PLAYING" | "FINISHED" | "ENDED";
type MatchTeam = {
  groupId: GroupId;
  members: PlayerId[];
  nextIndex: number;
  characterId: string | null;
  cooldown: TimerState;
  guessVersion: number;
};
type GuessMatch = {
  id: string;
  phase: MatchPhase;
  phaseVersion: number;
  teams: [MatchTeam, MatchTeam];
  categoryId: string | null;
  votes: Record<PlayerId, string>;
  timer: TimerState;
  paused: boolean;
  pauseReason: "host" | "offline" | null;
  askingTeam: 0 | 1;
  speakerId: PlayerId | null;
  turnId: number;
  nextSpeakerId: PlayerId | null;
  connectedCounts: [number, number];
  winnerGroupId: GroupId | null;
  endReason: "host" | "empty-group" | null;
};
type GuessShared = {
  round: number;
  groups: { groupId: GroupId; members: PlayerId[] }[];
  matches: GuessMatch[];
};
type MatchGuard = { round: number; matchId: string; phaseVersion: number };
type ControlGuard = MatchGuard & { turnId: number | null };
```

`phaseVersion` increments on phase changes and pause/resume, but not on votes, ordinary guesses or question changes. `turnId` changes every time a new question slot is created, including one paused while awaiting an online speaker. `nextIndex` points to the next candidate in a team's fixed round order, advancing past the chosen speaker. Resolve current members by ID against the round snapshot and live roster; groupId alone never grants round membership. `nextSpeakerId` and `connectedCounts` are cached public roster-derived fields: refresh them on start, accepted actions, deadline transitions and roster changes, since sharedViewFor does not receive a live roster.

Actions validated with Zod in `src/actions.ts`:

| Action                                       | Payload and authorized actor                                                                         |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `gc:start`                                   | `{ round }`, host, all matches READY                                                                 |
| `gc:vote`                                    | `MatchGuard & { categoryId }`, snapshot member of that voting match                                  |
| `gc:done`                                    | `MatchGuard & { turnId }`, current questioner                                                        |
| `gc:guess`                                   | `MatchGuard & { guessVersion, name }`, playing snapshot member, own team off cooldown                |
| `gc:pause`, `gc:resume`, `gc:skip`, `gc:end` | `ControlGuard`, host; skip requires PLAYING; end supports READY/vote/play, including paused          |
| `gc:pauseAll`, `gc:resumeAll`                | `{ round, matches: ControlGuard[] }`, host; apply only guards still matching, reject if none applies |
| `gc:newRound`                                | `{ round }`, host, all matches terminal, current groups still valid                                  |

Every player action is bound to current round, match and phase version. Done/skip also bind to the exact turn; guessVersion increments only when that team's guess is accepted. This makes a stale guess reject even after cooldown has elapsed. Keep raw guessed text out of persisted shared state and views.

### View contract — Task 4, `src/types.ts` / `src/view.ts`

```ts
type MatchPublicView = Pick<GuessMatch,
  'id' | 'phase' | 'phaseVersion' | 'categoryId' | 'paused' | 'pauseReason' |
  'speakerId' | 'turnId' | 'winnerGroupId' | 'endReason' | 'timer'> & {
  groupIds: [GroupId, GroupId]; nextSpeakerId: PlayerId | null; connectedCounts: [number, number];
  votedCount: number; voterCount: number;
};
type MatchPrivateView = {
  matchId: string;
  characters: { groupId: GroupId; character: CharacterFace | null }[];
  votes: Record<PlayerId, string> | null;
  teams: { groupId: GroupId; cooldown: TimerState; guessVersion: number }[];
};
type GuessView = {
  round: number; categories: CategoryOption[]; matches: MatchPublicView[];
  ownMatchId: string | null; privateMatches: MatchPrivateView[];
  myVote: string | null; canStart: boolean; canNewRound: boolean;
};
viewFor(args: {
  config: GuessConfig; shared: GuessShared; viewer: Viewer;
  viewerGroupId: GroupId | null;
}): GuessView;
```

Host gets all privateMatches and individual votes. An eligible player gets only their match's private entry: own character during PLAYING, both characters after terminal state, own team's cooldown/guessVersion, and `votes:null`. Projector, other-match spectators and late joiners get `privateMatches:[]`; their canStart/canNewRound are false. `myVote` is only the eligible viewer's vote. Public timer/counters/results never carry character IDs or wrong guess text.

---

### Task 1: Curated content, configuration and language support

**Files:** Create package manifests, `data/*.json`, `src/types.ts` (content/config types), `src/content.ts`, `src/phrases.ts`, `src/index.ts` (content/config exports initially), `test/content.test.ts`. Update `pnpm-lock.yaml` only as required for workspace install.

**Interfaces:** Produces the content/config/help signatures above. `configSchema` is exported and parses defaults `{voteSeconds:30, turnSeconds:120, cooldownSeconds:5}`. No app registration yet.

- [x] **Step 1: Create the workspace manifest and meaningful failing content tests.** Follow Shark Tank's TS/JSX config and package scripts; root export points at src/index.ts, with the views export added in Task 6. Use existing core/ui/zod and React type dependencies, no confetti/motion dependency. Include these assertions:

```ts
expect(configSchema.parse({})).toEqual({ voteSeconds: 30, turnSeconds: 120, cooldownSeconds: 5 });
expect(categories()).toHaveLength(9);
for (const c of categories()) {
  expect(c.characterIds.length).toBeGreaterThanOrEqual(10);
  expect(c.characterIds.length).toBeLessThanOrEqual(12);
  expect(new Set(c.characterIds).size).toBe(c.characterIds.length);
  for (const level of ["A1", "A2"] as const) {
    const h = languageHelp(c.id, level);
    expect(h.questions.length).toBeGreaterThanOrEqual(3);
    expect(h.answers.length).toBeGreaterThanOrEqual(3);
    expect(h.vocabulary.length).toBeGreaterThanOrEqual(6);
    expect(h.grammar.en).not.toBe("");
    expect(h.grammar.vi).not.toBe("");
  }
}
expect(matchesCharacter("  SPIDER—MAN  ", "spider-man")).toBe(true);
expect(matchesCharacter("Spidermen", "spider-man")).toBe(false);
expect(matchesCharacter("Thanh Giong", "thanh-giong")).toBe(true);
```

Also assert every ID resolves, no normalization-empty names or aliases, no alias maps to two different IDs in a category, and cross-listed Snow White/Cinderella/Rapunzel reuse their IDs. Test min/max boundaries for all settings. Use category IDs `superheroes`, `disney-princesses`, `classic-cartoons`, `animated-movies`, `anime-manga`, `video-game-characters`, `fairy-tales`, `vietnamese-folk-tales`, `famous-villains`.

- [x] **Step 2: Run `pnpm install`, then `pnpm --filter @cangsplayground/game-guess-the-character test -- test/content.test.ts`.** Expect failing content assertions or missing exports, not an unrelated environment failure.
- [x] **Step 3: Implement the interfaces and the exact nine pools from spec §5.1.** Use Unicode NFKC, lowercase and removal of all non-letter/non-number characters. Curate short English aliases and explicit Vietnamese unaccented aliases; aliases never cross different characters in the same category. Unknown internal IDs throw developer-facing content errors. `phrases.ts` must not import server content or candidate pools. Give all nine categories A1/A2 questions, answers, grammar and vocabulary.
- [x] **Step 4: Rerun the targeted test and package typecheck.** Both pass; content file itself remains server-only. Public options contain only category label/ID and 2–3 static examples.
- [x] **Step 5: Commit** the new package/content and lockfile: `feat: add Guess the Character content and English support`.

### Task 2: Server-owned shared deadlines with lifecycle isolation

**Files:** Modify core `src/game.ts`, server `Lobby.ts`, `TimerService.ts`. Create `apps/server/test/shared-deadline-game.ts` and `shared-deadlines.test.ts`; extend existing shared-state tests where needed.

**Interfaces:** Consumes existing SharedArgs/Session/TimerState. Produces the deadline hooks and three Lobby methods above; no existing module must implement the optional hooks.

- [x] **Step 1: Write failing server tests with fake time and a small shared test module.** Follow `shared-game.ts`, marking test players connected via socket sets. Use `lobby.onChange = () => timers.reconcile(lobby)` and clean up TimerService/registry/fake timers after each test. Required assertions:

```ts
// READY exports none; two matches can have distinct deadlines.
expect(lobby.sharedDeadlines()).toHaveLength(2);
vi.advanceTimersByTime(30_000);
expect(testState(lobby).expiredKeys).toEqual(["match-a:vote"]);
// Old captured session cannot mutate replacement even with identical key/deadline.
expect(lobby.expireSharedDeadline(oldSession, oldDeadline)).toBe(false);
expect(testState(lobby).expiredKeys).toEqual([]);
```

`testState(lobby)` is a typed fixture accessor defined in the new test fixture. Add tests for pause/cancellation, exit/re-Prepare with identical key AND endsAt, close/dispose cleanup, duplicate expiry, early/stale callbacks, and due settlement before a rejected player action still producing the expiry broadcast. Assert the replacement timer still fires exactly once after its predecessor's queued callback. Existing legacy/group/clock timers must still work.

- [x] **Step 2: Run `pnpm --filter @cangsplayground/server test -- test/shared-deadlines.test.ts`.** Expect missing hook/method or expiry assertions to fail.
- [x] **Step 3: Implement the optional hooks and scheduler.** Keep schedule records bound to both `endsAt` and the exact Session owner. A callback deletes its map record only if that record is still the one it scheduled, then rechecks its session. Namespace shared keys separately from group and clock keys. `expireSharedDeadline` is the only path that invokes the module hook and calls changed on a genuinely new result. Before player/host actions and permanent player removal/roster callbacks, settle deadlines after basic lobby/session/actor guards but before applying the command's rule mutation. Publish expiry even if the subsequently attempted action rejects. Do not replace existing `turn:done` routing or existing timer priorities.
- [x] **Step 4: Run the new file plus `test/shared-state.test.ts test/game-clock.test.ts test/turn-end.test.ts`, and core/server typechecks.** All pass; timer progression works with no clients polling.
- [x] **Step 5: Commit:** `feat: support server deadlines for shared-state games`.

### Task 3: Pairing, category voting and alternating timed turns

**Files:** Create `src/round.ts`, `src/match.ts`, `src/actions.ts`, `src/logic.ts`, `src/index.ts`, `test/helpers.ts`, `test/match.test.ts`; extend `src/types.ts` with domain state/action types.

**Interfaces:** Consumes Task 1 content/config and Task 2 hooks. Produces:

```ts
validateGroups(groups: readonly GroupContext[]): string | null; // Local helper, adapted to module validateGroups.
prepareRound(groups: GroupContext[], round: number, rng: Rng): GuessShared;
startRound(shared: GuessShared, args: SharedArgs<GuessConfig, GuessShared>): GuessShared | null;
closeCategoryVote(match: GuessMatch, args: SharedArgs<GuessConfig, GuessShared>): void;
advanceTurn(match: GuessMatch, args: SharedArgs<GuessConfig, GuessShared>): void;
pauseMatch(match: GuessMatch, now: number, reason: 'host' | 'offline'): void;
deadlines(args: SharedArgs<GuessConfig, GuessShared>): SharedDeadline[];
expireDeadline(args: SharedArgs<GuessConfig, GuessShared> & { deadline: SharedDeadline }): GuessShared | null;
reduceAction(args: SharedArgs<GuessConfig, GuessShared> & { actor: Viewer; action: GameAction }): GuessShared | null;
```

`closeCategoryVote`/`advanceTurn` mutate only an already-cloned match owned by the caller. Public module handlers clone accepted changes; invalid actions return null. Export `guessTheCharacter: GameModule<GuessConfig, null, GuessShared>`, its default alias and relevant domain types. `prepare:()=>null`, `turnDurationMs:()=>null`, `viewFor:()=>null`, `publicInfo:()=>({})`; Task 4 wires the required safe sharedViewFor before registration. Hide legacy start/pause/resume/skip/extend/endRound/reveal/nextRound controls via unsupportedControls; Prepare/Exit remain core controls.

The deterministic test harness `start(sizes:number[], config?:Partial<GuessConfig>)` returns `{config, now getter, shared getter, act(actorIdOrHost,type,payload), tick(ms), expireDue(), setConnected(playerId,connected), leave(playerId)}`. Initialize connected roster IDs `g1p1`, etc., seed 1 and now=1000; `act` settles due deadlines before reducing. Add `guard(match):MatchGuard` and `controlGuard(match):ControlGuard` fixture helpers that capture the current round and versions.

- [x] **Step 1: Write failing `match.test.ts` tests.** Assert [1,1] works; [1,1,1] and a zero-sized group reject; [1,2,3,4] pairs every group exactly once. Start produces four independent voting teams in two matches and 30,000ms vote deadlines. Edited votes count once; vote closes only at expiry; ties/no votes choose only among tied candidates. Each pair receives two different category member IDs.

```ts
expect(match.timer.durationMs).toBe(120_000);
expect(match.timer.endsAt).toBe(now + 120_000);
// With fixture orders A/C versus B/D, and Red selected first:
expect(speakersAcrossFourTurns).toEqual(["A", "B", "C", "D"]);
// One versus three remains strictly alternating.
expect(speakersAcrossSixTurns).toEqual(["A", "B", "A", "C", "A", "D"]);
```

Build fixed-order match fixtures explicitly for those two order assertions; seeded pairing tests need not depend on a particular shuffled order. Assert wrong-speaker done, mismatched match/round/phase/turn IDs and stale timer callbacks do not advance. A timeout followed by the old done advances once, resets the next turn to a fresh 120s at current server time, and does not change the other pair. Vote at the exact deadline rejects after vote settlement.

- [x] **Step 2: Run the package's `test/match.test.ts`; expect failures for the absent rules.**
- [x] **Step 3: Implement the interfaces and guards above.** Generate match IDs from round and pair index. Randomize pairings/member order/start side using existing seeded RNG. `advanceTurn` selects the opposite team, creates a new turnId and fresh turn timer, and consumes its next connected member; if either team has none connected, pause for host intervention with speakerId=null, without consuming the waiting team's next candidate. `pauseMatch` saves remaining phase/cooldown milliseconds, clears endsAt values, sets paused/reason and increments phaseVersion. Add a test asserting this offline boundary retains the new turn's full configured time. Each exported deadline key includes round/match/phaseVersion/turnId; its endsAt is the match's current timer. Ensure the shared projection required by prepareShared exists before committing (a temporary `sharedViewFor:()=>null` is safe and replaced in Task 4).
- [x] **Step 4: Run `test/content.test.ts test/match.test.ts` and game typecheck.** Expect all pass with default and a custom 15s turn/10s vote.
- [x] **Step 5: Commit:** `feat: add paired character matches and timed speaking turns`.

### Task 4: Team guessing, cooldown and role-filtered views

**Files:** Extend `src/actions.ts`, `src/types.ts`; create `src/view.ts`, `test/guess.test.ts`, `test/view.test.ts`; wire `src/logic.ts` and exports.

**Interfaces:** Consumes Task 3 guards/match state and Task 1 matching. Produces `viewFor` / GuessView defined above and the completed `gc:guess` reduction branch. Validate names as trimmed strings of 1–80 Unicode code points before accepting the attempt; a normalization-empty name rejects without cooldown.

- [x] **Step 1: Write failing guessing/security tests.** In a playing fixture, set Red's character to Thor and Blue's to Spider-Man; ensure each actor guesses the opposite ID. Required assertions:

```ts
// A wrong accepted guess at now=1000:
expect(red.cooldown).toEqual({ endsAt: 6000, pausedRemainingMs: null, durationMs: 5000 });
expect(red.guessVersion).toBe(previousGuessVersion + 1);
expect(match.turnId).toBe(previousTurnId);
// Another Red member and a replay after cooldown cannot reuse the old guessVersion.
expect(replayedGuess).toBeNull();
// Correct normalized guess from a non-current speaker wins immediately.
expect(match.winnerGroupId).toBe(red.groupId);
expect(match.phase).toBe("FINISHED");
expect(match.timer.endsAt).toBeNull();
```

Also test custom cooldown 9s; exactly-on-boundary release; invalid/empty/punctuation-only/non-string/81-code-point names do not charge; two competing correct guesses yield one winner; own-name guess is wrong when opposite secret differs. A waiting player from another match, a removed player and a same-name/new-ID replacement cannot vote/guess/read secrets.

Project host/player/projector for READY, vote, play, paused and terminal states. Assert opponent character IDs AND names/aliases are absent from unauthorized private fields; don't use a blanket string assertion that mistakes the allowed static category examples for leaked selected answers. Assert projection has no raw shared object, full characterIds pools, guess input/history or aliases. Host sees all, own player only own secret, terminal participants both secrets, other pairs/projector none. Mutating a returned view must not mutate the state.

- [x] **Step 2: Run `test/guess.test.ts test/view.test.ts`; expect new assertions to fail.**
- [x] **Step 3: Implement matching and projection.** Reject guesses while paused/terminal/cooling down or with stale guessVersion. Increment version only on an accepted attempt; charge only incorrect valid guesses. Clear active timer on win, reveal both only to eligible terminal participants. Build explicit objects in view.ts and deep-copy owned arrays/records. Project cached nextSpeakerId/connectedCounts maintained using the live roster by reducers; advance selection always rechecks the roster. Never send internal content pools to clients.
- [x] **Step 4: Run all game package tests and typecheck.** Test both short aliases such as Conan/Luffy and explicit unaccented Vietnamese aliases through the reducer, not just content lookup.
- [x] **Step 5: Commit:** `feat: add team guessing cooldowns and private match views`.

### Task 5: Host controls, departures and round restart through Lobby

**Files:** Create `src/lifecycle.ts`, `test/lifecycle.test.ts`, `apps/server/test/guess-the-character.test.ts`; extend match/actions/logic. Modify server package.json/registry and `pnpm-lock.yaml`.

**Interfaces:** Consumes Task 3's `pauseMatch` and produces:

```ts
resumeMatch(match: GuessMatch, now: number): void;
handlePlayerLeft(args: SharedArgs<GuessConfig, GuessShared> & {
  playerId: PlayerId; groupId: GroupId | null;
}): GuessShared;
handleRosterChange(args: SharedArgs<GuessConfig, GuessShared>): GuessShared;
newRound(args: SharedArgs<GuessConfig, GuessShared>): GuessShared | null;
```

Pause stores remaining ms for the active phase timer and each active cooldown, sets endsAt=null and records paused/reason; resume restores deadlines from now. New round uses the current roster grouped by the stored group IDs, validates no empty groups/even count, increments round and immediately starts category vote. Core Prepare creates READY for round 1; subsequent New round needs no extra Start press.

- [x] **Step 1: Write failing lifecycle and Lobby tests.** Assert pause after 2s of a 5s cooldown preserves exactly 3s through a minute paused, and resume restores that 3s plus the remaining vote/turn time. Assert player actions reject during pause, stale global guards don't pause a newer phase, and skip works only on a matching playing turn. End match sets ENDED/no winner and stops its timer. New round rejects while any match is active; after all terminal, reshuffle and reset votes/secrets/cooldowns/versions and start vote with new IDs.

Permanent departure removes unclosed votes and turn membership; current-speaker leave advances once; an empty group ends only its match without awarding a win. Temporary disconnect retains the current turn until expiry, skips disconnected candidates at future selection and pauses when either side lacks any connected member at a new-turn boundary. If vote closes with one side offline, assign category/secrets then pause PLAYING with its full fresh turn time. Host resume requires both teams to have a connected member and selects a connected speaker when the current candidate is offline. Reconnect never auto-resumes a host/offline pause. A removed student who rejoins under a new ID remains a spectator; existing round members who reconnect retain their rights.

- [x] **Step 2: Run the new domain/server files and observe failures.** Register the game with an existing-pattern workspace dependency so Lobby tests can select it; run pnpm install to refresh workspace links.
- [x] **Step 3: Implement lifecycle/host actions and module registration.** Match guards are checked after deadline settlement. Late joiners remain outside the round snapshot; unassigned players still require host's existing grouping workflow before participation. Don't add a game-specific bypass to live group editing. Use module-owned UI status for matches; keep legacy runtimes PREPARED and their timers idle, as Shark Tank does.
- [x] **Step 4: Run all game tests, `test/shared-deadlines.test.ts test/guess-the-character.test.ts`, server/core/game typechecks.** Also assert setting changes reject once shared session is active and Prepare rejects odd groups with a clear message.
- [x] **Step 5: Commit:** `feat: add character match host controls and roster lifecycle`.

### Task 6: Player experience and protected secrets

**Files:** Create player/language-help/action-hook/CSS files in the file map, `apps/web/test/guess-character-fixture.ts`, `guess-character-player.test.tsx`; add web workspace dependency/lockfile. Establish `./views` export and `views/index.tsx` with the player slot; host/projector slots follow in Task 7.

**Interfaces:** `PlayerSessionScreen(props: SessionViewProps & {me:NonNullable<LobbyView['me']>}): ReactNode`; `LanguageHelp({categoryId, role, level, onLevelChange})` uses role `'question'|'answer'` and level `'A1'|'A2'`. `useGameAction(act:SessionViewProps['act'])` returns `{pending:boolean, error:string|null, send(action:GameAction):Promise<boolean>}`. Timeout is 5,000ms; rejection/false/timeout releases pending and shows a generic retry message. Ignore late completion after unmount or a newer send; do not auto-retry guesses. This is a planning choice for UI recovery consistent with existing shell behavior.

- [x] **Step 1: Write failing happy-dom behavior tests, using real SecretCard and fixture GuessView projections.** Assert nine category choices, change-vote payload, countdown derived from supplied serverNow and waiting-for-host state. During PLAYING, only current questioner has enabled “I'm done”; it sends `gc:done` with current guard/turnId. Other members can still submit guesses with their team's guessVersion. Cooldown/paused/terminal disable submission. No raw actor guess is broadcast through props; wrong-guess feedback is the group's cooldown state.

```ts
expect(container.textContent).not.toContain("Thor"); // Fixture's secret is not a public example on this screen.
// Hold using pointer/keyboard interactions; release, cancel, blur and visibility change hide it.
expect(container.querySelector(".cp-secret-card")).not.toBeNull();
expect(sentDone).toEqual({ type: "gc:done", payload: { ...guard, turnId } });
```

Use existing React act/createRoot test helpers rather than adding a testing library. Test a fresh mount after viewing a secret is hidden, both asking/answering help, A1/A2 switching, stored preference, localStorage throwing, negative/rejected/no-ack responses and pending recovery at 5 seconds. The helper has to catch rejected requests; the package must not import the web application's Zustand store.

- [x] **Step 2: Run `pnpm --filter @cangsplayground/web test -- test/guess-character-player.test.tsx`; expect missing components or behavior assertions to fail.**
- [x] **Step 3: Implement the player states using existing UI components.** SecretCard mounts only eligible own-team face during play and terminal answers only after result; instructions always say “your character”, never include the secret outside the card. Render Timer with serverNow and use it for vote/turn/cooldown displays, no client phase-changing callbacks. Default A1 preference key `cangsplayground:gc-level`, catch storage errors. Current questioner sees question frames; responding team sees answer frames; other members of asking team see listen/wait and question support. Keep guess field reachable while the hold card and help remain above it; scroll normally, no fixed keyboard-obscured action. Use body/display fonts and token colors, with comfortable text and input sizes.
- [x] **Step 4: Run player tests and web/game typechecks.** Validate the content in nine-category voting and long Vietnamese-name fixtures; no undefined labels or clipped essential actions in markup. Actual viewport geometry is checked in Task 8.
- [x] **Step 5: Commit:** `feat: add character game player screens and hold-to-reveal cards`.

### Task 7: Host console, projector and view registration

**Files:** Create `src/views/host.tsx`, `projector.tsx`, extend views/index/CSS, create `apps/web/test/guess-character-host-projector.test.tsx`, update web game registry. Add integration assertions to existing host-control/session-slot tests only where the new game affects their expectations.

**Interfaces:** Exports `HostSessionPanel: ComponentType<SessionViewProps>`, `HostConfigNote: ComponentType<{lobby:LobbyView;session:GameSessionView}>`, `HostGroupPanel: ComponentType<GameViewProps>` (render null to avoid duplicate legacy runtime cards), `ProjectorScreen: ComponentType<SessionViewProps>`. Final default GameViews includes these plus `PlayerSessionScreen`, `PlayerScreen:()=>null`. Consume GuessView, MatchGuard/ControlGuard and categoryOptions already filtered by the server.

- [x] **Step 1: Write failing host/projector tests.** Default settings show 30/120/5 with correct limits; config note explains even groups and minimum one member, using draft config when present. READY host has Start round; each active match has pause/resume/skip/end controls guarded to that card. Global controls carry the displayed match guards. New round enables only when every match terminal. Paused cards name the pause reason, display stopped remaining time and don't enable impossible resume when a team has nobody online. Every control disables while busy.

```ts
expect(hostText).toContain("Thor");
expect(projector.querySelector(".cp-secret-card")).toBeNull();
expect(projectorText).not.toContain("Thor");
expect(projectorText).not.toContain("Spider-Man"); // Exclude static examples in this fixture.
```

Also assert terminal match results never expose either answer on projector while another pair is still playing. Test long Vietnamese names, multiple rows, and MatchPublicView lookup with changing pairing.

- [x] **Step 2: Run `test/guess-character-host-projector.test.tsx`; expect missing-slot/behavior failures.**
- [x] **Step 3: Implement and register the views.** Host console shows both characters and cooldowns; projector gets the public grid with category label, names, timer and winner. Use exact existing TeamBadge/PlayerIdentity and make names wrap rather than truncate. Only import server domain types with `import type`; production views import phrases and UI, never content.ts/data JSON or the module root. HostConfigNote supplies explicit odd-count warning; server remains authoritative. Existing core Prepare/Exit remain accessible; no duplicate generic start/done controls.
- [x] **Step 4: Run both new web files, existing `test/game-controls.test.ts test/session-slots.test.tsx test/host-console-controls.test.tsx`, and typechecks.** Verify the lazy route path resolves the registered views and existing games keep their slots.
- [x] **Step 5: Commit:** `feat: add character match host and projector views`.

### Task 8: Full session verification and delivery

**Files:** Create `apps/server/test/guess-the-character-socket.test.ts`; update `README.md`; adjust only files where these checks reveal a defect.

**Interfaces:** Uses `createServer`, real Socket.IO clients, `state:sync`/`state:patch`, existing host commandId envelopes, and the public game actions above. Follow `integration.test.ts`/`shark-tank.test.ts`; no new protocol event names or new client-side authority.

- [x] **Step 1: Write the failing Socket.IO integration test.** Create four teams, attach host/projector and students, configure vote=10s, turn=15s, cooldown=1s, Prepare then Start. Choose different categories in the two pairs. Use the existing `createServer({now:()=>testNow, seed:3})`; advance `testNow` and invoke `server.manager.get(code).settleSharedDeadlines()` to process exact boundaries, then wait for real socket sync/patch delivery with expect.poll as existing integration tests do. Scheduler autonomy is separately proved with fake timers in Tasks 2–5; do not combine fake network timers or 10–120 second wall-clock sleeps. No server test-injection API change is required.

Required assertions: filtered sync AND patches never leak the other team's secret; a correct non-speaker guess ends one match and leaves the other active; stale done and a guess replay do not change winners/turns; second match can finish independently; host New round produces new pairing/round/vote deadline and rejects previous-round actions. Disconnect/resume restores actual timer/cooldown in the permitted payload; Task 6's remount test proves the secret card starts hidden. Confirm ordinary players/projector cannot invoke host-only actions.

- [x] **Step 2: Run the targeted integration file and observe any failing acceptance assertions.** If the covered behavior already passes, record that; don't add an artificial failing assertion.
- [x] **Step 3: Fix only observed gaps and add a README note.** Mention even group count, single-player groups, 120s shared question/answer turns, I'm done and configurable team cooldown. Keep production defaults unchanged.
- [x] **Step 4: Run the repo checks once after integration fixes:**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expect exit 0 for each. Diagnose failures before claiming success; record pre-existing failures separately if they cannot be attributed to this feature. Use `pnpm exec prettier --check` on changed TS/TSX/JSON/CSS/Markdown files, formatting only those files when necessary. No dependency/version upgrades as a side effect.

- [x] **Step 5: Validate the built UI in the browser with two simultaneous matches.** Start app using README commands on available ports. At 320px and a typical 390px phone width, inspect nine-category voting, holding/releasing/blur of the card, keyboard-open guess entry, visible 02:00 initial turn, done, cooldown, pause and terminal states; test long Vietnamese names. Inspect projector grid on desktop. Exercise at least one 1-vs-3 pair and one 1-vs-1 pair. Check the production network/bundle does not import the full characters/categories JSON into player views; curated category examples and the viewer's permitted secret are expected. Keep any screenshots as local review artifacts, not committed runtime assets.
- [x] **Step 6: Commit** the acceptance test, README and any validated integration corrections: `test: verify concurrent Guess the Character sessions`. Update this plan's checkboxes and report exact commands/results plus any limitations. Obtain the execution workflow's required whole-branch review before merge; no deployment or merge is implied by this plan.

## Self-review and execution handoff

- Spec coverage: §1–3 → Tasks 1,3,5,7; §4.1–4.3 → Tasks 2,3,5; §4.4 → Task 4; §4.5 → Tasks 5,7; §5 → Tasks 1,6; §6 → Tasks 4,6,7; §7 → Tasks 2–5,8; §8 → task-specific tests and Task 8.
- Dependency order: 1 and 2 establish independent foundations; 3 consumes both; 4–5 complete server behavior; 6–7 consume the role-filtered view and action contracts; 8 verifies the integrated product.
- Type consistency: one MatchGuard/ControlGuard/GuessView definition; names and payloads above are authoritative. No `turn:done` for this module, no raw characters in publicInfo.
- Review Focus: stale session callbacks → Task 2; replayed guess → Task 4; replacement identity → Tasks 4–5; storage/request/reload → Task 6; long names and mobile geometry → Tasks 6–8.
- This plan only delivers the implementation instructions. Execution starts after the user reviews it and selects native or subagent-driven execution; no product code is written during planning.
