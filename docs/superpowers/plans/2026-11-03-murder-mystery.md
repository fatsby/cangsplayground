# Murder Mystery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cooperative B1 murder mystery minigame in which teams of 3–4 share private clues, choose four investigations and explain one final accusation during a roughly 24-minute classroom session.

**Architecture:** A standalone shared-state GameModule owns one server-generated case, a class-wide phase clock and separate team investigation histories. A finite-world solver and exhaustive action-graph validator prove the authored case configurations before they are offered in play. Viewer projections deliver only assigned clues until the conclusion phase, and the browser imports presentation code without the generator or answer data.

**Tech Stack:** Existing TypeScript, React/Vite, Fastify/Socket.IO, Zod, pnpm workspaces and Vitest; Node >=22 and pnpm 12.14.0 as recorded in the repository. No new external dependencies or core framework redesign.

**Spec:** `docs/superpowers/specs/2026-11-03-murder-mystery-design.md` — approved by the user with “Ok duyệt” on 2026-11-03. Read both documents before implementation.

## Global Constraints

- “Mỗi đội có 3–4 người”; “trình độ khoảng B1”; “thời lượng khoảng 20–25 phút mỗi vụ.”
- “Các đội cùng phá một vụ, chơi đồng thời, công bố lời giải chung.” One team is valid; team count need not be even.
- “nhận vụ 2 phút, chia sẻ thông tin đầu 3 phút, bốn lượt điều tra tổng 12 phút, chốt lời giải 4 phút, công bố khoảng 3 phút”; four investigations are fixed.
- “Một nạn nhân; bốn nghi phạm; ba hung khí; bốn địa điểm gây án có thể chọn.” Exactly four starting clues; 1–2 new cards per investigation; cards contain 2–4 B1 English sentences.
- Four-person distribution is 1–1–1–1 and lead order A→B→C→D; three-person distribution is 2–1–1 and lead order A→B→C→A, after independent initial shuffles.
- Every offered investigation path using four actions must uniquely solve the case; at least two different action routes must exist. Never change the truth to accommodate a team choice.
- Three families: “ngoại phạm/thời gian”, “quyền tiếp cận/chìa khóa”, “trao đổi đồ vật/nhầm danh tính vật chứng”. Variation changes deduction as well as names.
- Score: culprit 3, weapon 2, room 2, plus 1 for each of three valid evidence selections; maximum 10. Each evidence slot uses at most two discovered cards. One confirmed submission; ties share rank; no speed points.
- NPC dialogue is structured selection. No live AI, microphone, recording, automatic speech assessment, dice movement, chat, campaign or content editor.
- Only confirmed findings constrain the truth; an unverified NPC statement must never silently count as established fact.
- Projector and other teams receive no private clues, answers, seed, logical configuration, semantic predicates or unrevealed scoring results. Host may inspect the entire case.
- Preserve the six existing unrelated edits in Guess the Character content/tests/phrases. Stage only files named in each task; never blanket-stage the workspace.

Implementation choices made by this plan: game ID `murder-mystery`; package `@cangsplayground/game-murder-mystery`; all timed settings allow 30–600 seconds, step 30. Defaults are briefing=120, sharing=180, investigation=180, conclusion=240 seconds. Reveal is host controlled, with an approximate three-minute teaching allowance rather than another automatic deadline.

## Review Focus

- An exhausted, delayed or retried request from a previous round/case, including exactly at a deadline, must not spend the next investigation or submit a newer draft (Tasks 3–4, 8).
- A kicked student reconnecting under the same display name or a late joiner assigned a group ID must not inherit frozen case membership, cards or command privileges (Tasks 5, 8).
- A family may have one solvable route but another route that needs a fifth action or lacks a two-card scoring proof; reject the entire logical configuration (Tasks 1–2).
- Private data can leak through bundled server imports, semantic IDs, enabled action metadata or the final score before Reveal; test payload allowlists and the client import boundary (Tasks 5, 8–9).
- On a 320px phone, storage failures, an acknowledgement timeout, a host reassignment or a phase change must leave clues readable and actions recoverable without sending a stale selection (Tasks 6–7).

## Repository grounding and execution prerequisite

The existing GameModule contract already supplies `prepareShared`, `onSharedAction`, `onSharedDeadline`, `sharedDeadlines`, `onSharedPlayerLeft`, `onSharedRosterChange` and `sharedViewFor`. Its shared-action arguments contain config, shared state, roster, now and RNG; viewer projection receives no live roster. Cache the roster information needed for views in module state. Existing Guess the Character uses these hooks; the earlier Guess the Character and Shark Tank plans document session view slots and Socket.IO test setup.

Navigation constraint: local AGENTS instructions require jCodeMunch for code exploration. That tool is absent from this planning session, so current grounding uses the contract previously read in this conversation and repository documentation, not a new source-code inspection. At execution start, resolve/index this repository with jCodeMunch and confirm `packages/core/src/game.ts`, `packages/ui/src/game-views.ts`, the two registries, existing package manifests and the cited test harnesses. Use its `register_edit` after code edits when hooks do not do so. Do not fall back to shell searches for code navigation. This prerequisite confirms integration details; it does not authorize redesigning the approved game.

One cohesive game is delivered by this plan. The solver, runtime and views are dependent parts, so they remain in one plan rather than separate projects. Create/reuse an isolated workspace at execution time through the applicable worktree skill; plan writing does not install packages or scaffold product code.

## File Map

All new game files live under `packages/games/murder-mystery/`:

| Files | Responsibility |
|---|---|
| `package.json`, `tsconfig.json` | Workspace scripts, server entry and independent `./views` entry |
| `src/config.ts`, `src/types.ts` | Config defaults/schema; runtime, action, conclusion and viewer DTO contracts |
| `src/model.ts` | Server-only logical worlds, predicates, clues and investigation definitions |
| `src/solver.ts`, `src/validate.ts` | Candidate inference, scoring proofs, exhaustive route validation |
| `src/cases/alibi.ts`, `access.ts`, `exchange.ts`, `catalogue.ts` | Authored logical configurations, B1 sentence templates and vocabulary |
| `src/generate.ts` | Seeded role/entity binding, opaque IDs, immutable compiled case and reveal |
| `src/round.ts`, `src/clock.ts` | Initial distribution, phase progression and shared deadlines |
| `src/actions.ts`, `src/scoring.ts` | Authorization, investigations, versioned drafts, submit, host controls, score |
| `src/lifecycle.ts`, `src/view.ts` | Roster changes, ownership transfers and explicit viewer projection |
| `src/logic.ts`, `src/index.ts` | GameModule wiring and server-only root exports |
| `src/phrases.ts` | Public B1 sentence frames; no case secrets or logical imports |
| `src/views/player.tsx`, `clue-card.tsx`, `conclusion.tsx`, `language-help.tsx`, `use-game-action.ts` | Private discovery, team action choice, final proof selection and action recovery |
| `src/views/host.tsx`, `projector.tsx`, `index.tsx`, `murder-mystery.css`, `css.d.ts` | Classroom controls, public display, GameViews export and existing visual style |
| `test/fixtures.ts`, `helpers.ts`, `solver.test.ts`, `validate.test.ts`, `content.test.ts`, `clock.test.ts`, `actions.test.ts`, `scoring.test.ts`, `lifecycle.test.ts`, `view.test.ts` | Meaningful domain and privacy checks |

Existing modifications: `apps/server/package.json`, `apps/web/package.json`, both `src/games/registry.ts` files and `pnpm-lock.yaml` for registration; `docs/games.md` and `README.md` for usage. Do not plan core timer rewrites. Modify `apps/web/src/components/game-controls.ts` or `HostGame.tsx` only if the execution-time contract check proves existing session slots cannot suppress incompatible legacy controls, and pin that behavior with the Task 7 test.

Integration tests: create `apps/server/test/murder-mystery.test.ts`, `murder-mystery-socket.test.ts`; create `apps/web/test/murder-mystery-fixture.ts`, `murder-mystery-player.test.tsx`, `murder-mystery-host-projector.test.tsx`. Final report: `docs/superpowers/reports/2026-11-03-murder-mystery-result.md`.

## Shared Interfaces

Task 1 defines the following in `model.ts`. These types are never imported by the browser:

```ts
type Answer = { suspectId: string; weaponId: string; roomId: string };
type Expr = { kind: 'fact'; id: string }
  | { kind: 'answer'; field: keyof Answer; id: string } | { kind: 'not'; expr: Expr }
  | { kind: 'all' | 'any'; items: Expr[] };
type WorldDomains = {
  suspectIds: string[]; weaponIds: string[]; roomIds: string[]; factIds: string[];
};
type World = { id: string; answer: Answer; facts: Record<string, boolean> };
type LogicalCard = {
  id: string; sourceKind: 'testimony' | 'verified'; claims: Expr[];
  constraint: Expr | null; sourceId: string;
};
type Investigation = {
  id: string; kind: 'alibi' | 'relationship' | 'inspect' | 'challenge';
  targetId: string; prompt: string; requiredCardIds: string[];
  requiredActionIds: string[]; resultCardIds: string[];
};
type CaseLogic = {
  domains: WorldDomains; worlds: World[]; actualWorldId: string; publicConstraint: Expr;
  initialCardIds: string[]; cards: LogicalCard[]; actions: Investigation[];
};
type Field = keyof Answer;
type ValidationReport = { ok: boolean; issues: string[]; terminalPaths: number };
```

CaseLogic includes every world consistent with the authored public rules, not a subset picked to make the intended answer unique. `enumerateWorlds(domains:WorldDomains, publicConstraint:Expr):World[]` enumerates the complete 4×3×4 answer domain and every assignment of the bounded boolean facts, then filters by publicConstraint. Keep at most eight independent boolean facts per logical configuration in this first catalogue; derived facts use expressions rather than extra independent variables. The validator independently regenerates this universe and checks equality with supplied worlds, preventing a hand-picked candidate list from manufacturing uniqueness. Distinct worlds may share an answer while differing in secondary secrets. Exact-one-solution means one distinct answer tuple after filtering. Source testimony has `constraint:null`; later confirmed findings can establish or contradict its claims. A confirmed constraint is the conjunction of the explicit confirmed claims, not an additional secret restriction. Case text renders from annotated sentence templates so the semantic content checked by the solver is actually told to the player.

Task 2 defines `CompiledCase` in `model.ts`: `{seed:number, contentVersion:string, familyId:string, variantId:string, logic:CaseLogic, briefing:CaseBriefing, cards:Record<string,ClueFace>, reveal:CaseReveal}`. Public content types belong in `types.ts`; use type-only imports for Answer/Field across the server boundary:

```ts
type EntityFace = { id: string; name: string; description: string };
type CaseBriefing = {
  title: string; opening: string; victim: EntityFace; bodyFoundAt: string;
  suspects: EntityFace[]; weapons: EntityFace[]; rooms: EntityFace[];
};
type ClueFace = {
  id: string; sourceLabel: string; sourceKind: 'testimony' | 'verified';
  body: string; vocabulary: { en: string; vi: string }[];
};
type CaseReveal = {
  answer: Answer; events: string[];
  testimonyExplanations: { cardId: string; explanation: string }[];
};
```

Only the server CompiledCase carries logic/seed. Entity descriptions supply suspect occupation/relationship and simple weapon/room context without smuggling in the answer.

Task 3 defines runtime types in `types.ts`:

```ts
type Phase = 'READY' | 'BRIEFING' | 'SHARING' | 'INVESTIGATION'
  | 'CONCLUSION' | 'AWAITING_REVEAL' | 'REVEALED';
type MurderConfig = {
  briefingSeconds: number; sharingSeconds: number;
  investigationSeconds: number; conclusionSeconds: number;
};
type Clock = { endsAt: number | null; remainingMs: number | null };
type ProofSelection = Record<Field, string[]>;
type Conclusion = {
  suspectId: string | null; weaponId: string | null; roomId: string | null;
  evidence: ProofSelection;
};
type TeamState = {
  groupId: GroupId; members: PlayerId[]; connected: PlayerId[];
  leadOrder: PlayerId[]; owners: Record<string, PlayerId>;
  history: { round: number; actionId: string; recipientId: PlayerId }[];
  draft: Conclusion; draftVersion: number; submission: Conclusion | null;
  active: boolean;
};
type MurderShared = {
  caseNumber: number; phase: Phase; phaseVersion: number;
  investigationRound: number; paused: boolean; clock: Clock;
  caseData: CompiledCase; teams: TeamState[];
};
type PhaseGuard = { caseNumber: number; phaseVersion: number };
```

Use `import type` for the server-only CompiledCase reference in `types.ts`; no runtime import of content there. `investigationRound` is 0 before investigation, 1–4 during it, then retained for history. `leadOrder` is always four entries. State does not persist free-form spoken/text explanations. `owners` covers all cards already discovered by that team, including transferred cards.

Task 5 defines the viewer DTOs in `types.ts`:

```ts
type ActionOption = {
  id: string; kind: 'alibi' | 'relationship' | 'inspect' | 'challenge';
  targetId: string; targetLabel: string; prompt: string;
  evidence: { id: string; label: string }[];
};
type ScoreBreakdown = {
  suspect: number; weapon: number; room: number;
  evidence: Record<Field, number>; total: number;
};
type MurderView = PhaseGuard & {
  phase: Phase; paused: boolean; clock: Clock; investigationRound: number;
  briefing: CaseBriefing;
  progress: { groupId: GroupId; active: boolean; acted: boolean; submitted: boolean }[];
  ownTeam: null | {
    groupId: GroupId; members: PlayerId[]; connected: PlayerId[];
    leadId: PlayerId | null; submitterId: PlayerId | null;
    options: ActionOption[]; history: { round: number; label: string }[];
    myCards: ClueFace[]; sharedCards: ClueFace[] | null;
    draft: Conclusion | null; draftVersion: number; submission: Conclusion | null;
    canInvestigate: boolean; canEdit: boolean; canSubmit: boolean;
  };
  hostDetails: null | {
    solution: CaseReveal; cards: ClueFace[];
    teams: { groupId: GroupId; members: PlayerId[]; connected: PlayerId[];
      leadOrder: PlayerId[]; owners: Record<string, PlayerId>;
      draft: Conclusion; submission: Conclusion | null }[];
  };
  reveal: CaseReveal | null;
  results: { groupId: GroupId; rank: number; score: ScoreBreakdown }[] | null;
};
```

Construct allowlisted DTOs rather than spreading runtime state. Shared cards are null before CONCLUSION and include only own-team discoveries afterwards. Draft is null before CONCLUSION. An action option includes safe public labels only, never predicates, results or remaining candidate counts; prerequisite labels cannot reproduce someone else's private clue body. Reveal/results are null until REVEALED even for the submitting team. HostDetails is host-only and supplies inspection information without shipping solver worlds.

## Task 1: Logical model, solver and exhaustive validator

**Files:** Create manifests/tsconfig, `src/model.ts`, `src/config.ts`, `src/types.ts` (public content faces), `src/solver.ts`, `src/validate.ts`, `test/fixtures.ts`, `solver.test.ts`, `validate.test.ts`; workspace lock change only if required by the new package.

**Interfaces:** Produces `configSchema`; `enumerateWorlds(domains:WorldDomains, publicConstraint:Expr):World[]`; `candidateAnswers(logic:CaseLogic, knownCardIds:readonly string[]):Answer[]`; `availableActions(logic:CaseLogic, usedActionIds:readonly string[], knownCardIds:readonly string[]):Investigation[]`; `proofSets(logic:CaseLogic, knownCardIds:readonly string[], field:Field):string[][]`; `validateCase(logic:CaseLogic):ValidationReport`. Test fixture `makeLogicFixture()` supplies a complete small, internally consistent case with four initial cards and at least two four-action routes; `withUnverifiedAccusation(logic)` adds an unverified statement naming the true culprit.

- [ ] **Step 1: Add failing inference and route tests.** Assert the following, plus reject unknown fact references, impossible truth, invalid option/card counts and challenges without relevant required evidence:

```ts
const c = makeLogicFixture();
expect(candidateAnswers(c, c.initialCardIds).length).toBeGreaterThan(1);
expect(new Set(candidateAnswers(c, c.initialCardIds).map(x => x.suspectId)).size).toBeGreaterThan(1);
expect(validateCase(c)).toMatchObject({ ok: true });
expect(validateCase(c).terminalPaths).toBeGreaterThanOrEqual(2);
const u = withUnverifiedAccusation(c);
expect(candidateAnswers(u, [...c.initialCardIds, 'unverified'])).toEqual(candidateAnswers(c, c.initialCardIds));
```

Add named mutations `route-needs-five-actions`, `one-route-has-no-two-card-proof`, `confirmed-claim-false-in-truth`, `single-card-reveals-entire-answer`, `unused-initial-card`, `alternate-world-removed-from-universe`, each with `expect(validateCase(mutated).ok).toBe(false)`.

- [ ] **Step 2: Run** `pnpm --filter @cangsplayground/game-murder-mystery test solver validate`; expect failures from missing inference/validation behavior, not an invalid test setup.
- [ ] **Step 3: Implement the signatures above.** Enumerate every reachable state `(usedActionIds, knownCardIds, remainingActions)` to depth four; memoize canonical sets. For every offered edge, recurse; reject dead ends before four, ambiguous terminals, fewer than two routes and missing proof sets at any terminal. Runtime availability uses authored prerequisites and non-repetition only; do not silently prune choices using the solver. Proof sets enumerate all one-/two-card combinations that fix the true field across the complete public-world model; a two-card set may include an unverified statement only when confirmed evidence explicitly establishes that statement. Validate every card's claims against its source rules and true world; every false statement needs a reveal explanation. Set config defaults/ranges from Global Constraints.
- [ ] **Step 4: Run** the same command and package typecheck; expect all inference/negative-fixture tests to pass.
- [ ] **Step 5: Commit** only Task 1 files: `feat(murder-mystery): validate finite case logic and investigation routes`.

## Task 2: Three case families and deterministic generation

**Files:** Create `src/cases/{alibi,access,exchange,catalogue}.ts`, `src/generate.ts`, `test/content.test.ts`; extend `src/types.ts` and `src/model.ts` with the content contracts above.

**Interfaces:** Consumes Task 1. Produces `logicalConfigurations():readonly CaseLogic[]`; `generateCase(seed:number, selection?:{familyId:string;variantId:string}):CompiledCase`; `drawCaseSeed(rng:Rng):number`. The catalogue contains six bounded logical configurations: alibi `window`/`route`, access `key-transfer`/`door-access`, exchange `swapped-items`/`swapped-recipients`. Each has its own annotated facts, prerequisites and reveal; entity bindings use existing seeded RNG and bijective mappings. IDs delivered to players are neutral tokens with no answer/family/role encoded.

- [ ] **Step 1: Add failing content tests.** For all six configurations, assert `validateCase(logic).ok === true`; every terminal has one distinct answer and proof sets for all fields; and all four initial cards matter to at least one inference/proof. Assert `generateCase(17)` deep-equals a second `generateCase(17)`, has 4 suspects/3 weapons/4 rooms/4 initial cards and every action returns 1–2 cards. Assert each family has two different prerequisite/fact structures after canonicalizing names, and the three families differ in the relationships needed for deduction. Confirm body-found and crime locations have separate fields.
- [ ] **Step 2: Run** `pnpm --filter @cangsplayground/game-murder-mystery test content`; expect missing catalogue/generator failures.
- [ ] **Step 3: Author and implement the six configurations and generator.** Store public rules explicitly; include all alternate worlds consistent with them. Map role/entity/fact IDs consistently, render B1 sentences from semantic annotations, and remap every action/proof/reveal reference. Do not attach additional hidden filtering predicates to prose. Each family includes meaningful suspicion of at least two people, at least one explained misleading statement, useful investigations and an event-based reveal. Validate the actual instantiated case before returning; throw a descriptive generation error on invalid configuration, so Prepare fails rather than offering broken play. No dependencies or runtime network requests.
- [ ] **Step 4: Run** content plus solver/validator tests and typecheck; expect all six logical configurations exhaustively checked. Test all finite logical configurations; sampling cosmetic names is supplementary. Review every authored English sentence against its annotation and for B1 readability; record contentVersion `1` and a deterministic seed in server state only.
- [ ] **Step 5: Commit:** `feat(murder-mystery): generate three families of solvable cases`.

## Task 3: Distribution, phase clock and investigation turns

**Files:** Create `src/round.ts`, `src/clock.ts`, `test/helpers.ts`, `test/clock.test.ts`; extend `src/types.ts` with runtime types.

**Interfaces:** Consumes generated cases/config. Produces `prepareCase(groups:GroupContext[], caseNumber:number, rng:Rng):MurderShared`; `advancePhase(shared:MurderShared, config:MurderConfig, now:number):MurderShared`; `deadlines(shared:MurderShared):SharedDeadline[]`; `expireDeadline(shared:MurderShared, expected:SharedDeadline, config:MurderConfig, now:number):MurderShared|null`; `toTimerState(clock:Clock):TimerState`. Test `start(sizes:number[], config?:Partial<MurderConfig>)` creates g1p1-style IDs, seed 1, now=1000, and returns shared/config/now getters plus `host(type:string,payload?:unknown):boolean`, `player(id:PlayerId,type:string,payload?:unknown):boolean`, `tick(ms:number):void`, `expireDue():void`, `disconnect(id:PlayerId):void`, `reconnect(id:PlayerId):void`, `leave(id:PlayerId):void`; action helpers are connected to Task 4 as it lands. Helpers attach the current PhaseGuard by default; explicit supplied guard fields override those defaults for stale-command tests. The harness settles due deadlines before commands, mirroring Lobby.

- [ ] **Step 1: Write failing clock/distribution tests.** Defaults must parse to `{briefingSeconds:120,sharingSeconds:180,investigationSeconds:180,conclusionSeconds:240}`. READY has no deadline; Start reaches BRIEFING with endsAt=121000. Subsequent durations are 180000, four times 180000, then 240000ms, then AWAITING_REVEAL without deadline. Assert 3-person owner counts sort to `[1,1,2]`, 4-person counts `[1,1,1,1]`; all teams receive identical initial content; lead order is four entries with each member covered before repetition. Reject Prepare sizes 2/5/empty, accept one team of three. Explicitly expire an old deadline after a phase change and a new case at the same wall time; both return null and preserve replacement state.
- [ ] **Step 2: Run** `pnpm --filter @cangsplayground/game-murder-mystery test clock`; expect missing phase behavior.
- [ ] **Step 3: Implement the interfaces.** Start at READY, then BRIEFING→SHARING→INVESTIGATION rounds 1–4→CONCLUSION→AWAITING_REVEAL. Deadline keys include caseNumber/phaseVersion/round; every phase/round transition increments phaseVersion and starts a fresh full duration at server now. Due callbacks do not replay several historical phases after a long delay. Prepare shuffles members and four starting cards independently; no phase starts at Prepare. Preserve the case across all teams.
- [ ] **Step 4: Run** clock tests plus typecheck; verify late callbacks, 3/4-person distribution and exact 21 minutes of default timed phases before host reveal.
- [ ] **Step 5: Commit:** `feat(murder-mystery): coordinate classroom phases and clue distribution`.

## Task 4: Investigations, guarded conclusions, host controls and scoring

**Files:** Create `src/actions.ts`, `src/scoring.ts`, `test/actions.test.ts`, `test/scoring.test.ts`; complete action helpers in `test/helpers.ts`.

**Interfaces:** `reduceAction(shared:MurderShared, ctx:SharedArgs<MurderConfig,MurderShared>, actor:Viewer, action:GameAction):MurderShared|null`; `scoreConclusion(caseData:CompiledCase, discoveredCardIds:readonly string[], submission:Conclusion|null):ScoreBreakdown`. Define ScoreBreakdown as specified in the viewer contract above. Rejected requests return null without mutating state. Validate payloads with strict Zod schemas and bound array lengths.

| Action | Payload beyond PhaseGuard | Allowed actor and effect |
|---|---|---|
| `mm:start` | none | Host in READY; starts briefing |
| `mm:investigate` | `round:number, actionId:string` | Current frozen-member lead in INVESTIGATION, before deadline, unspent team round; commit one available action and give its result cards to actor |
| `mm:saveDraft` | `draftVersion:number, conclusion:Conclusion` | Designated submitter in CONCLUSION; increments draftVersion; other teammates only view |
| `mm:submit` | `draftVersion:number` | Same submitter, complete current draft, all references valid/discovered; freeze once |
| `mm:pause`, `mm:resume` | none | Host; pause only running timed phase, resume only paused |
| `mm:extend` | `seconds:30` | Host in timed phase; add to live deadline or paused remaining time |
| `mm:next` | none | Host; advance current timed phase/round early, including while paused; preserve paused state for the next timed phase |
| `mm:reveal` | none | Host in AWAITING_REVEAL; unlock reveal/results |
| `mm:newCase` | none | Host in REVEALED; validate current roster has 3–4 per retained group; prepare next case in READY |
| `mm:transfer` | `groupId,fromPlayerId,toPlayerId` | Host; Task 5 transfers cards and remaining lead/submit responsibilities within a team |

All guards bind caseNumber and phaseVersion; investigate also binds exact round; draft commands bind draftVersion. Rejections never expose the true answer. Phase-changing controls, pause/resume and extend increment phaseVersion to invalidate pending old requests. UI retries use the existing commandId mechanism; module guards also prevent duplicate spending with a new commandId. Draft save checks known option IDs and card ownership/discovery, but correctness is not scored or returned until Reveal.

- [ ] **Step 1: Write failing action/scoring tests.** Assert lead-only acceptance, one history item and 1–2 new owned cards per accepted action; invalid/duplicate/unmet-prerequisite action leaves shared state deeply unchanged. Save version 0 creates version 1; submit version 0 rejects; submit version 1 freezes; subsequent saves/submits reject. At exact endsAt settle the phase first and reject the old round command. Pause for 90 seconds preserves remaining time, disables player edits, and resume preserves it; extend adds exactly 30000ms; a paused Next stays paused. For every valid terminal proof assert total 10, a correct triple without valid evidence totals 7, a null submission totals 0, and undiscovered or wrong proof cards earn 0 evidence. No score is returned in action acknowledgements.
- [ ] **Step 2: Run** `pnpm --filter @cangsplayground/game-murder-mystery test actions scoring`; expect missing authorization/scoring behavior.
- [ ] **Step 3: Implement the signatures and table.** Discoveries derive from immutable caseData, never team-specific truth. The submitter is the fourth lead entry, subject to Task 5 reassignment. New case uses the current roster including existing disconnected members; mid-case newcomers get no retroactive membership. Store the submission, not its correctness feedback. Score only from true fields and proofSets constrained to discovered cards; a wrong field also scores 0 in its evidence slot. Rank totals descending with shared ranks, calculated for public reveal only. When a paused Next reaches AWAITING_REVEAL, clear pause and leave no clock/deadline; no resume is needed for Reveal.
- [ ] **Step 4: Run** actions/scoring/clock tests plus typecheck; expect pass including stale-case/round/draft and offline-time boundaries.
- [ ] **Step 5: Commit:** `feat(murder-mystery): enforce investigation turns and final accusations`.

## Task 5: Membership lifecycle, private views and GameModule

**Files:** Create `src/lifecycle.ts`, `src/view.ts`, `src/logic.ts`, `src/index.ts`, `test/lifecycle.test.ts`, `test/view.test.ts`; complete viewer DTOs in `src/types.ts` and transfer dispatch in `src/actions.ts`.

**Interfaces:** `transferResponsibilities(shared:MurderShared, groupId:GroupId, from:PlayerId, to:PlayerId):MurderShared|null`; `handlePlayerLeft(args:SharedArgs<MurderConfig,MurderShared>&{playerId:PlayerId;groupId:GroupId|null}):MurderShared`; `handleRosterChange(args:SharedArgs<MurderConfig,MurderShared>):MurderShared`; `viewFor(args:{config:MurderConfig;shared:MurderShared;viewer:Viewer;viewerGroupId:GroupId|null}):MurderView`. Export `murderMystery:GameModule<MurderConfig,null,MurderShared>` and default from server entry. Keep legacy group prepare/view null, publicInfo free of generated case data, turnDurationMs null; disable legacy controls superseded by the session panel.

- [ ] **Step 1: Write failing lifecycle/privacy tests.** A disconnect preserves owners/order; a permanent leave transfers each card to the remaining member with fewest cards, breaking ties by frozen member order, and fills vacated current/future leads using next connected member or next remaining member. A host transfer requires same-team connected target, moves all source cards plus current/future responsibilities and persists on source reconnect. An empty team becomes inactive and preserves any frozen submission. One/two survivors keep playing. A new ID with the same visible name, a same-group late joiner and a removed ID all get public-only views and cannot act. Verify host all-data access; player only own cards through investigation; conclusion exposes only own-team discovered cards; projector has public progress only; reveal opens full explanation/results for everyone. Serialize adversarial views and assert an allowlist of keys, including absence of seed, actualWorldId, constraints, proofSets and unopened card bodies.
- [ ] **Step 2: Run** `pnpm --filter @cangsplayground/game-murder-mystery test lifecycle view`; expect missing lifecycle/view behavior.
- [ ] **Step 3: Implement the interfaces and module wiring.** Use frozen membership IDs as well as viewerGroupId; update cached connected IDs via roster hook. Both live transfers and departures preserve already-discovered knowledge and never consume another investigation. Empty team history does not block class progression. Reassignment while paused is a host operation and remains available; other player mutations stay locked. Project only safe action metadata. When no one remains, expose a host warning and no player controls. Catch generation failure through the existing Prepare error path without creating an active partial case.
- [ ] **Step 4: Run** the complete game package tests and typecheck; expect all domain/privacy cases to pass.
- [ ] **Step 5: Commit:** `feat(murder-mystery): protect clues and recover team membership`.

## Task 6: Player investigation and conclusion experience

**Files:** Create `src/phrases.ts`, `src/views/{player,clue-card,conclusion,language-help}.tsx`, `src/views/use-game-action.ts`, `src/views/murder-mystery.css`, `src/views/css.d.ts`, `src/views/index.tsx`; add `./views` export and the workspace dependency in `apps/web/package.json`/`pnpm-lock.yaml` so the web test runner can resolve the new package before final registry integration; create `apps/web/test/murder-mystery-fixture.ts`, `murder-mystery-player.test.tsx`.

**Interfaces:** `PlayerSessionScreen(props:SessionViewProps&{me:NonNullable<LobbyView['me']>}):ReactNode`; `LanguageHelp({hidden,onHiddenChange}:{hidden:boolean;onHiddenChange:(hidden:boolean)=>void}):ReactNode`; `useGameAction(act:SessionViewProps['act']):{pending:boolean;error:string|null;send(action:GameAction):Promise<boolean>}`. Consume only MurderView DTO and Task 4 actions; `./views` never imports root entry, model, catalogue, generate, solver or scoring.

- [ ] **Step 1: Write failing UI interaction tests.** SHARING shows only assigned cards; INVESTIGATION gives only current lead actionable options, names that lead for peers, and confirms target/topic/evidence before dispatch. A successful response shows owned new clues; a late phase update clears an old unconfirmed action. CONCLUSION shows all own-team discovered cards and shared draft, limits evidence to two IDs per field, and permits only submitter save/submit with current draftVersion. Assert exactly one dispatch for double-tap; false/rejection/5000ms timeout releases pending with retry feedback; a late ack cannot clear newer pending state. Mock throwing localStorage and verify help still toggles; a new mount starts private clue cards concealed. Public-only/newcomer view explains waiting for next case.
- [ ] **Step 2: Run** `pnpm --filter @cangsplayground/web test murder-mystery-player`; expect missing view behavior.
- [ ] **Step 3: Implement the components/hook.** Use existing SecretCard, Timer, panel/button/type tokens and Arcade Night styling; preserve clue text legibility. Save draft explicitly before confirm-submit so draftVersion is authoritative. Only show lock/confirmation after server state or acknowledged action; never auto-submit on deadline. Persist help preference under `cangsplayground:mm-help` with try/catch. Frames cover sharing, clarification, proposals, disagreement, uncertainty and conclusion; difficult clue vocabulary has Vietnamese meanings. Provide feedback for paused state, spent round, lost connection, new lead and server errors. Keep free team discussion untimed by individual speaker slots.
- [ ] **Step 4: Run** player tests plus game/web typecheck. At 320px use wrapping labels, vertical options and reachable confirmation buttons; functional viewport/browser verification follows in Task 9 rather than snapshot-only layout claims.
- [ ] **Step 5: Commit:** `feat(murder-mystery): build cooperative player investigation screens`.

## Task 7: Host and projector classroom controls

**Files:** Create `src/views/host.tsx`, `src/views/projector.tsx`, `apps/web/test/murder-mystery-host-projector.test.tsx`; modify `src/views/index.tsx` and CSS. Only if necessary, modify the two shell control files listed in File Map with a regression assertion.

**Interfaces:** Export `HostSessionPanel:ComponentType<SessionViewProps>`, `HostConfigNote:ComponentType<{lobby:LobbyView;session:GameSessionView}>`, `HostGroupPanel:ComponentType<GameViewProps>` rendering null, and `ProjectorScreen:ComponentType<SessionViewProps>`. Default GameViews includes these, PlayerSessionScreen and legacy PlayerScreen returning null. `hostAct` uses existing asynchronous host command path and Task 4 guards.

- [ ] **Step 1: Write failing host/projector interaction tests.** READY shows Start; timed phases show pause/resume, +30s and Next; Next requires confirmation naming unfinished teams and the lost investigation where applicable. AWAITING_REVEAL shows Reveal; REVEALED shows New case and shared-rank results. Host transfer lists connected same-team targets and dispatches exact source/target; all controls resist double-tap and recover from timeout. Config note reports 21 timed minutes plus approximately three for reveal at defaults and explains the 3–4-person condition. Projector before reveal contains no clue bodies, draft, answers or scores; at reveal it shows the complete event explanation and score breakdown. Assert no conflicting generic skip/reveal/next-round controls render for this module.
- [ ] **Step 2: Run** `pnpm --filter @cangsplayground/web test murder-mystery-host-projector`; expect missing host/display behavior.
- [ ] **Step 3: Implement the components.** Projector shows briefing, phase/round, shared clock and action/submission completion per team. Host privately inspects full case, each student's assigned cards, teams missing leads/members and submitted/unfinished status. Allow extending paused time; confirm early advance, but Reveal after deadline needs no additional confirmation. Public scores appear only after explicit Reveal. Show generation/Prepare failures in existing host error surface. Include long-name wrapping and reduced-motion behavior consistent with existing components; no new visual dependency.
- [ ] **Step 4: Run** both murder-mystery web test files and web typecheck; confirm shell-control regression test passes if changed.
- [ ] **Step 5: Commit:** `feat(murder-mystery): add classroom host controls and shared reveal`.

## Task 8: Registration, real Socket.IO sessions and deadline regression

**Files:** Modify server/web package manifests and game registries, `pnpm-lock.yaml`; create `apps/server/test/murder-mystery.test.ts`, `murder-mystery-socket.test.ts`.

**Interfaces:** Consume `murderMystery` server entry and default views from `@cangsplayground/game-murder-mystery/views`. Use existing `createServer({now:()=>testNow,seed:3})`, Lobby and Socket.IO harness documented by Guess the Character tests; no new test injection API. `settleSharedDeadlines()` exercises exact timestamps; fake-timer scheduler tests separately prove autonomous transitions.

- [ ] **Step 1: Write failing registration and integration tests.** Create seven players in teams of three/four, host and projector; Prepare same case; start and advance with injected time. Take different valid investigation paths, submit valid proofs and reach AWAITING_REVEAL; assert both totals remain absent until host Reveal, then both total 10. Reconnect a card owner, transfer an offline lead, kick one player, add a same-name late joiner, and inspect actual socket snapshots/patches for correct ownership and no leaks. Replayed old case/round/submit commandIds cannot alter new state. Fake timers advance without any client command; pause/extend invalidates old callbacks; an old callback after Exit/re-Prepare cannot mutate replacement state. Configure invalid team sizes and assert Prepare rejects. In a separate test, mock `generateCase` with Vitest to throw on Prepare and assert no half-prepared views; do not add a production test-injection API.
- [ ] **Step 2: Run** `pnpm --filter @cangsplayground/server test murder-mystery`; expect unregistered-game/missing-integration failures.
- [ ] **Step 3: Register both entries and workspace dependencies.** Use the package's split exports; preserve existing games and workspace dependency conventions. Install workspace links with the repository pnpm version and inspect lockfile changes. If tests expose an existing core deadline boundary bug, first reproduce it in `apps/server/test/shared-deadlines.test.ts` and apply the smallest general fix; no speculative core rewrite.
- [ ] **Step 4: Run** `pnpm --filter @cangsplayground/server test murder-mystery` plus existing `shared-deadlines` tests, then `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`; expect exit 0. Attribute pre-existing failures separately rather than editing unrelated Guess the Character work. Inspect built web JavaScript and its import graph: generator/catalogue/solver/scoring modules, seed and case-specific hidden records must not be bundled; public word lists alone are allowed. Payload leakage tests remain necessary even if bundle inspection passes.
- [ ] **Step 5: Commit:** `feat(murder-mystery): register game and verify classroom socket flow`.

## Task 9: Live acceptance, teacher instructions and result report

**Files:** Modify `docs/games.md`, `README.md`; create `docs/superpowers/reports/2026-11-03-murder-mystery-result.md`. Capture targeted screenshots in `docs/assets/screenshots/` if needed for the updated usage guide; do not commit temporary test media.

**Interfaces:** Completed registered module and all Task 8 checks. This task validates the user-visible flow and records the remaining real-classroom acceptance requirement; it does not add another testing framework.

- [ ] **Step 1: Start the existing app on an available port and perform a live browser acceptance using the applicable e2e skill.** Use projector, host and seven player contexts in teams of three/four. At 320px on at least one player: share initial clues, complete four investigations with changing leads, read a new result, save/submit proofs and reveal both results. Reload during a turn and simulate lead disconnect/transfer; verify cards and permissions remain correct. Use configured short phase times or host advance for automation, preserving full default durations in separate clock tests. Stop only task-owned servers afterwards.
- [ ] **Step 2: Fix any observed defect in its owning task and rerun the targeted check plus affected package checks.** The check passes when every action/control is reachable, private information stays on its intended devices and all teams reach one shared reveal. If no defects are observed, proceed without adding redundant tests.
- [ ] **Step 3: Write teacher instructions and result report.** Include 3–4 players, B1, four actions, private clue sharing, how to ask/challenge NPCs, designated submitter, scoring, pause/extend/transfer and why speaking is encouraged through information sharing. State that a real B1 group playtest is still required to judge discussion quality and 24-minute pacing; automated clicks do not demonstrate spoken English. Record exact commands/outcomes, seed/content version for acceptance, and any actual limitations.
- [ ] **Step 4: Verify the final diff and documentation links; run affected checks after any final code changes.** No code changes after the full green Task 8 suite need another full rerun unless acceptance exposed an unresolved concern. Never claim the real-classroom test happened unless it did.
- [ ] **Step 5: Commit:** `docs(murder-mystery): document play rules and verified acceptance`.

## Self-review and execution handoff

Coverage: spec §§1–3 → Global Constraints/Tasks 1–9; §4 → Task 2; §5 → Tasks 3–4, 6–8; §6 → Tasks 4/6; §7 → Tasks 1–2; §8 → Tasks 3–5/7–8; §9 → Tasks 8–9; §10 → File Map and implementation choices. Review Focus maps to explicit checks in its named tasks. Every new cross-task function/type is owned by a task above; existing framework signatures require the jCodeMunch confirmation described earlier.

All tasks remain unchecked until implementation. Plan self-review is performed by the author, not another dispatched agent. Product code has not been started. After the user reviews this plan and selects the execution method, use the corresponding execution skill; preserve that choice throughout implementation.
