# Who's the Spy implementation result

Implemented Tasks 1–9 in order, with the docs copied and committed first, followed by one commit per task. Each task's tests were run failing before implementation and passing afterward; the full workspace suite was also run after each task. The coordinator then arranged an independent review and explicitly authorized two additional fix commits for its five findings.

The game includes 16 Location and 16 Food topics, shared topic selection, private roles, two speaking turns per player, server-timed voting, elimination, Continue without dealing again, final results, and a shared game clock. Server `viewFor` filters secrets for projector, spy, eliminated-player and non-member views. Free Talk and Secret Word regression tests pass.

## Commits

These are the commits on `feat-whos-the-spy` above `master`, oldest first. The final client-fix commit contains this report and can be identified as `HEAD` at delivery.

| Commit                  | Change                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| `4a42289`               | docs: Who's the Spy design spec and implementation plan                                     |
| `d670966`               | feat(core): voting phase with server timer and eliminations                                 |
| `239dc59`               | feat(core): continue without re-dealing, finished groups, leave hook                        |
| `52cb905`               | feat(core): session-wide game clock                                                         |
| `ec02cd6`               | feat: prepare hooks, conditional config fields, phase-aware host controls and game clock UI |
| `ae0b858`               | feat(whos-the-spy): topics, config, dealing and visibility                                  |
| `15886b0`               | feat(whos-the-spy): voting, eliminations and win conditions                                 |
| `3e7b054`               | feat(server): register Who's the Spy                                                        |
| `0ae7bb5`               | feat(web): Who's the Spy views                                                              |
| `050fe8b`               | chore(sim): play Who's the Spy end to end                                                   |
| `681d9d0`               | fix(core): preserve paused votes, clock controls and game membership                        |
| Final client-fix commit | fix(web): honor server vote locks after players leave                                       |

There are 12 commits. The two review fixes supersede the initial ten-commit acceptance requirement under the coordinator's explicit follow-up instruction.

## Verification

`pnpm lint && pnpm typecheck && pnpm test` passes. Lint reports no errors or warnings; all workspace type checks pass.

| Package      | Passing tests | Passing files |
| ------------ | ------------: | ------------: |
| core         |             8 |             1 |
| free-talk    |             2 |             1 |
| secret-word  |             5 |             1 |
| whos-the-spy |            16 |             1 |
| server       |            47 |            10 |
| web          |            32 |             5 |
| **Total**    |       **110** |        **19** |

`pnpm --filter @cangsplayground/server sim -- --game whos-the-spy` exits 0 with 30 clients and prints:

```text
Team Red: {"winner":"team","reason":"caught"}
Team Blue: {"winner":"team","reason":"caught"}
Team Yellow: {"winner":"team","reason":"caught"}
Team Green: {"winner":"team","reason":"caught"}
```

The simulator also collected 120 state patch latency samples; the last pre-report run reported p50 3.81 ms and p95 4.87 ms. These timings describe this local run, rather than a performance guarantee.

The socket privacy test records raw snapshots and patches before and after voting finishes. It verifies that projector traffic never contains the topic or hints, projector role/spy/vote fields stay null, and the spy receives no topic before the group's result. Members receive the topic and spy list at the result.

## Independent review and fixes

All five findings were reproduced with failing regression tests and fixed:

1. Opening a vote from PAUSED through Vote now, Skip on the last turn, or the last speaker leaving now creates a paused vote timer. The three regressions failed before the fix and pass afterward.
2. Whole-class clock Pause/Resume now works independently of group phases. The S2 scenario (resume each group separately, then resume the class clock) and waiting-for-Continue scenario failed before the fix and pass afterward. Host control availability follows the same rule.
3. Active voting games reject `groups:move` with `INVALID_STATE: Exit the game to move players.` The rejected move leaves state unchanged, including for spies, eliminated players and late joiners. An undealt summary member also receives no role or topic from `viewFor`; both regressions failed before the fix. Existing games retain their active move behavior.
4. Vote lock state comes only from server `myVote`. A mounted React test locks a vote, receives server confirmation, removes the target, and rerenders the same component with `myVote: null`; the other options become available again. This test failed before the fix and passes afterward. An invalid former selection cannot be submitted.
5. Free Talk and Secret Word again enter ROUND_END when every member leaves a PREPARED group. Both S8 regressions failed before the fix and pass afterward.

No review findings remain deferred.

## Plan adjustments and rulings

- Prepare resolves a candidate configuration before validation and commits it only after validation succeeds, following Task 4's Step 3. Failed Prepare therefore leaves the config unchanged; its RNG may still advance.
- Added `eliminated: []` and `clock: null` to existing web test fixtures because the new required wire types also apply there. This only changes fixture shape.
- Moved test-only vote helpers into `vote-game.ts` to avoid importing a test file and registering its tests twice. No production behavior changes.
- Added optional public `GameSessionView.voteDurationMs` capability metadata. It lets generic host controls enforce the Vote now phase rules while preserving existing games' PREPARED End round behavior; it carries no secret data.
- Kept the existing variadic controls-test session helper and applied timer overrides to group literals. The tested scenarios are the same.
- `spiesLeft` counts spies among active players, rather than just subtracting eliminated ids, so spies who leave are also excluded. This keeps the displayed count correct after departures.
- The spy votes for a civilian in the socket test; the other three votes catch the spy. The plan's instruction that every player vote for the spy would require a forbidden self-vote.
- Explicitly staged new tests, helpers, lockfile and UI files wherever `git commit -am` or the plan's add paths would omit them. This preserves the intended deliverables and commit boundaries.
- Added optional `GameViews.PlayerTurnTip` so the card and TurnIndicator remain outside YourTurn while the prescribed tip appears inside it. Existing games keep their previous rendering path; the new layout's visual fit still needs the skipped manual check.
- Static rendering tests verify that secret content is absent before a hold and render `SecretFace` separately to check held content. They do not exercise real pointer holding.
- Included the required UI `act` prop changes in Task 8's commit. Removed the unused `g2` test variable and used the existing `cp` CSS tokens for the clock; these have no game-rule effect.
- The Who's the Spy simulator starts and closes an isolated ephemeral server when no `--url` is supplied, because the requested standalone command otherwise fails with a websocket error. Explicit URLs and the existing Free Talk simulator path remain supported. Added a subprocess regression that failed before this change and now checks one result per group.
- Simulator bots wait for actual phase, turn or round advancement, rather than any intermediate host version update, to avoid submitting a second locked vote before the final voting patch arrives.
- Per coordinator rulings, paused vote openings preserve the paused timer; whole-class clock controls can succeed without a group transition; active voting-game moves are rejected; and unknown-role members lose card access. These resolve behavior gaps in the original plan and were approved before implementation.
- Per coordinator instruction, added one server fix commit and one client fix commit after the original ten commits.
- Added `happy-dom` 21.0.4 as a **web devDependency only** for the required mounted rerender regression. No additional runtime dependency was introduced.
- Task 8 Step 5's manual browser check was skipped exactly as instructed.

## Unverified

The manual projector/host/three-player browser walkthrough and visual comparison against `style-preview.html#arcade` and `new-screens.html` remain unverified. Real pointer-hold/release interactions, mobile sizing and projector readability were not checked in a browser. The mounted DOM regression verifies ballot interaction and rerendering, rather than those manual checks.

The branch and Orca worktree remain available for coordinator integration.
