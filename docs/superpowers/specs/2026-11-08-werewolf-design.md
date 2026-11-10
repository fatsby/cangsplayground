# Werewolf — Design

Status: draft for review. Date: 2026-11-08.

## 1. Intent

Add **Werewolf** (a.k.a. Mafia), a social-deduction minigame, to cangsplayground.

The use case is a classroom. Everyone sits in the same room, each person on their own phone, joined to one lobby. A host runs the session from a host device, and a projector shows the class a public view. Players get a secret role, then spend nights acting in secret and days debating and voting someone out.

The key product decision: **the app is the moderator.** In a normal Werewolf game a human narrator says "everyone close your eyes, werewolves wake up…". Here the app does all of that. The host only starts the game and watches. This removes the need for a narrator who cannot play, and makes the game run on its own pace.

Why it matters: it is a game the whole class can play together, in one lobby, with no setup beyond opening a phone.

## 2. Goals

- One Werewolf game for the **whole lobby** (no splitting into groups).
- Fully automatic moderation: night phase, morning announcement, discussion, vote, win detection.
- Four roles: Werewolf, Villager, Seer, Guard.
- Host has a "god view": phase, every player's role, who is alive or eliminated, and the live vote tally and who voted for whom.
- Host can edit roles before the game starts.
- Players can join after the game has started.
- A projector view that shows public information only.
- All UI text and content in **English only**.

## 3. Non-goals

- No extra roles (Witch, Hunter, Cupid, etc.).
- No in-app chat or voice. Discussion happens out loud in the room.
- No multiple parallel groups or games per lobby.
- No localization, no Vietnamese strings.
- No overall game time limit, no scoring or leaderboard across games.
- No spectator-only joiners; a late joiner is a full player.

## 4. Anti-goals (what would make this a failure even if it technically works)

- **Information leaks.** A player must never be able to learn another player's role, who acted at night, or what the wolves chose from anything on their phone or the projector — including timing, layout differences between roles, or network payloads. Per-viewer filtering is mandatory (the repo already enforces it through `viewFor`).
- **The host being a hidden player.** The host does not play, so the god view cannot spoil anything. It must not be visible to the projector.
- A game that stalls because one phone disconnects or one player does not act.

## 5. Constraints

- Built as a `GameModule` (`packages/core/src/game.ts`), registered in the server and web game registries, with player, host and projector views, like the other games under `packages/games/`.
- The closest existing game is **Who's the Spy** (`packages/games/whos-the-spy`): secret roles, vote to eliminate, host sees everything. Reuse its shape where it fits.
- Wherever a player is shown (player phones, host console, projector), use the avatar that player customised in the lobby, rendered with the existing `PlayerAvatar` component from `packages/ui`. Never show initials. The app only lets players change their avatar before the host selects a game, so a late joiner keeps the default seeded avatar.
- Follow the repo's engineering principles: reuse existing helpers, no nested types, doc comments on public APIs, English only.
- The existing framework assumes players are split into groups, each playing a separate game with a speaking-turn timer and one vote phase. Werewolf needs things the framework does not do today (section 11). The builder decides how to implement them, preferring to extend the shared framework over parallel code.
- Not examined while designing: the Murder Mystery game (not in the code index at design time) and the host character-assignment editor in Guess the Character. The builder should look at both before building the role editor.

## 6. Roles

| Role | Team | Night ability |
|------|------|---------------|
| Werewolf | Wolves | Votes with the other wolves on one player to attack. |
| Villager | Village | None. |
| Seer | Village | Investigates one other player; learns only **"Werewolf" or "not Werewolf"**. |
| Guard | Village | Protects one player. A protected player does not die if attacked. The Guard may protect themselves **once per game**. |

Wolves know who the other wolves are. Nobody else learns anything about anyone's role.

### Default role split (host can change it before the game starts)

- Werewolves: about 1 per 4 players, rounded, minimum 1.
- Seer: 1. Guard: 1.
- Everyone else: Villager.

## 7. Game flow

1. **Lobby.** Players join. Host may edit roles (section 8). Host presses **Start**. Minimum **5 players**.
2. **Role reveal.** Each player sees their role on their own phone for a short, fixed period.
3. **Night N.** Runs for a fixed length. See 7.1.
4. **Dawn.** The app resolves the night and announces the result publicly. Win check.
5. **Day N — discussion.** Timer. No app interaction required.
6. **Day N — vote.** Timer. See 7.2. At the end of the timer the vote is resolved. Win check.
7. Repeat from Night N+1 until a team wins.
8. **Game end.** Everyone's role is revealed on every screen.

### 7.1 Night

- Wolves, Seer and Guard act on their own phones. Choices are made simultaneously and in secret.
- **Wolves:** each living wolf votes for one living non-wolf. The target is the player with the most wolf votes. A tie is broken at random among the tied players. If no wolf voted, no one is attacked. Wolves see each other's votes so they can coordinate.
- **Seer:** picks one living player other than themselves and immediately gets the result on their phone. The Seer keeps a private log of previous results.
- **Guard:** picks one living player to protect (may pick the same player on consecutive nights). They may pick themselves once per game.
- The night **always lasts its full duration**, even if every actor has already chosen or an acting role is dead. This keeps timing from revealing who holds which role. Every player's night screen has the same overall shape.
- Dead players' actions do not count. A player who does not act in time simply skips their action.

### 7.2 Dawn announcement

- If the wolves' target was **not** protected: that player is eliminated and the announcement names them.
- If the target **was** protected, or nobody was attacked: the announcement says that no one died. The two cases look identical, so the Guard's success is not revealed.
- An eliminated player's role is **not** revealed until the game ends.

### 7.3 Day vote

- Each living player votes for one other living player. Voting for oneself is not allowed. A player may change their vote until the vote timer ends.
- Votes are **only resolved when the timer ends** (not early, even if everyone voted).
- A player is eliminated if they receive votes from **at least half of the living players, rounded up** (5 living → 3 votes; 4 living → 2; 6 living → 3).
- If **nobody** reaches the threshold, **or two players both reach it (a tie)**, no one is eliminated.
- Visibility: the host sees each voter's choice live. Players and the projector see only the vote count per player. After resolution, the outcome (who was eliminated, or no one) is announced publicly.

### 7.4 Win conditions

Checked after each dawn and after each day vote.
- **Village wins** when no werewolves remain.
- **Wolves win** when the number of living werewolves is greater than or equal to the number of living non-wolves.

## 8. Host

- Host does **not** play.
- Before the game starts the host can set any player's role. Validation on Start: at least 5 players, at least 1 Werewolf, and strictly fewer Werewolves than non-Werewolves. The host may use 0, 1 or more Seers and Guards.
- Host starts the game with one press. Roles of existing players are then fixed; only pending late joiners can still be given a role (section 10).
- Host god view during the game: current phase and timer, every player's role and alive/eliminated status, each night's choices as they are made, and the live vote with who voted for whom.
- Host config (defaults): night 30 s, discussion 3 min, vote 60 s. Role-reveal period is a fixed short value (builder's call).
- Standard shared host controls that the framework already provides (pause, end game, etc.) should work if they fit.

## 9. Players

- **Role card.** Shown at role reveal and available during the game.
- **Night screens.** Wolf, Seer and Guard each get a selection UI; everyone else gets a neutral waiting screen of the same overall form.
- **Day screens.** Living players see the list of living players, current vote counts per player, their own vote, and the timer.
- **Eliminated players** become spectators: they see the public information and the day/night flow, can no longer vote or act, and do not see anyone's role until the game ends.
- **Disconnects.** A disconnected player keeps their seat and rejoins by name (the lobby already supports this). Until they return, they skip any action they were due to make.
- **Leaving for good.** A player who leaves is treated as eliminated, and win conditions are re-checked.

## 10. Late joiners

Players may join after the game has started.
- **The host chooses the late joiner's role** (decided by the product owner). The default is Villager.
- A late joiner appears in the host's god view as a **pending player**. The host can set their role (any of the four) at any time before the next dawn. If the host does nothing, the default (Villager) applies automatically at dawn, so the game never waits on the host.
- They enter play at the **start of the next day phase** (dawn), so they can take part in the following discussion and vote. Until then they see a short "you'll join at dawn" screen, and their role is shown to them only when they enter play.
- They count as living players for the vote threshold and for win conditions from the moment they enter.
- The pending-role editor is the only role editing allowed after Start. Existing players' roles stay fixed.
- Players and the projector are not told that a late joiner's role was chosen by the host, so joining late does not reveal a role.
- Validation: the host may not set a role that would end the game immediately on entry (the section 7.4 win checks must not already be true once the joiner enters).

## 11. Projector (public information only)

Shows: current phase and timer, night/day number, the living players and eliminated players (names and avatars, no roles), the dawn announcement, vote counts per player during the vote, the vote outcome, and — at game end — the winner and every player's role.
Never shows: roles during the game, who acted at night, the wolves' choices, the Seer's results, who voted for whom.

## 12. What the framework does not do today (the builder must solve)

The framework was read at design time; these gaps were found.

1. **Night phase.** Multiple roles acting in secret and simultaneously, resolved together. The framework has a single timed vote and speaking turns. The shared-state-with-deadlines mechanism used by Shark Tank is probably the closest fit; not verified in depth.
2. **Different vote rule.** Who's the Spy eliminates the player with the most votes. Werewolf uses a threshold with no-elimination on a tie.
3. **Late join.** `Lobby.join` accepts new players when the lobby is not locked, but they start with no group, and reassigning groups stops a running game. A way to add a player to the running game is needed. Check how this interacts with the lobby lock.
4. **Host role editing** before start, plus role assignment for pending late joiners during the game.
5. **Whole-lobby game**, not one game per group.
6. **Projector** with public-only data.
7. **Per-viewer data filtering** must hide all hidden information (section 4).

## 13. Left to the builder

- Module structure and where shared helpers live.
- UI design, layout and copy (English), consistent with the other games.
- Exact role-reveal duration and any other secondary timings.
- How to make the night screens look equivalent so layout does not leak roles.
- Test strategy. At minimum: night resolution, vote threshold and tie cases, win conditions, late join, disconnect, and a leak test that checks each viewer type's payload.

## 14. Designer's calls (not stated by the product owner — please check)

- Defaults: 5 players minimum; night 30 s, discussion 3 min, vote 60 s.
- Night always runs its full duration.
- Guard may protect the same player on consecutive nights.
- Seer cannot investigate themselves; may investigate the same player again.
- Wolves cannot attack wolves; wolves see each other's votes.
- Dawn announcement does not distinguish "protected" from "no attack".
- Eliminated players' roles stay hidden until the game ends; eliminated players spectate.
- No self-votes; votes can be changed until the timer ends.
- Voter identities visible to host only; vote counts per player visible to everyone.
- Late joiner enters at the next dawn. Their role is chosen by the host (the product owner's decision), defaulting to Villager if the host does nothing. My calls here: the automatic Villager fallback at dawn, and the rule that a role choice may not end the game on entry.
- No overall time limit.
