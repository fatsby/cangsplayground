import type { PlayerId, Viewer } from "@cangsplayground/core";
import type { MyState } from "./MyState.js";
import { livingIds, rolesOf } from "./players.js";
import { tallyVotes, voteThreshold } from "./rules.js";
import type { WerewolfShared } from "./WerewolfShared.js";
import type { WerewolfView } from "./WerewolfView.js";

function myState(shared: WerewolfShared, id: PlayerId): MyState | null {
  const me = shared.players[id];
  if (!me) return null;
  const night = shared.stage === "NIGHT";
  const inPlay = !me.pending;
  const isWolf = inPlay && me.role === "werewolf";
  return {
    role: inPlay ? me.role : null,
    alive: me.alive,
    pending: me.pending,
    teammates: isWolf
      ? Object.entries(shared.players)
          .filter(([other, p]) => other !== id && p.role === "werewolf" && !p.pending)
          .map(([other]) => other)
      : [],
    wolfVotes: isWolf && night ? { ...shared.wolfVotes } : null,
    seerLog: inPlay && me.role === "seer" ? shared.seerLog.map((e) => ({ ...e })) : null,
    guardSelfUsed: inPlay && me.role === "guard" ? shared.guardSelfUsed : null,
    myVote: shared.stage === "VOTE" ? (shared.dayVotes[id] ?? null) : null,
    myNightPick: !night || !inPlay
      ? null
      : me.role === "werewolf"
        ? (shared.wolfVotes[id] ?? null)
        : me.role === "seer"
          ? shared.seerPick
          : me.role === "guard"
            ? shared.guardPick
            : null,
  };
}

/**
 * Filters the server state for one viewer. This is the only place that decides who may see what:
 * - host: every role, tonight's live choices, and who voted for whom;
 * - projector: public information only (no roles until ENDED, vote totals but never voters);
 * - player: their own role and the extra knowledge their role grants; a waiting joiner has no role;
 * - everyone: the winner and every role once the game has ENDED.
 */
export function viewForViewer(shared: WerewolfShared, viewer: Viewer): WerewolfView {
  const ended = shared.stage === "ENDED";
  const host = viewer.kind === "host";
  const living = livingIds(shared);
  return {
    stage: shared.stage,
    night: shared.night,
    deadlineAt: shared.deadline?.endsAt ?? null,
    players: shared.order
      .filter((id) => shared.players[id])
      .map((id) => {
        const p = shared.players[id]!;
        return p.pending ? { id, alive: p.alive, pending: true as const } : { id, alive: p.alive };
      }),
    roles: host || ended ? rolesOf(shared) : null,
    me: viewer.kind === "player" ? myState(shared, viewer.playerId) : null,
    dawn: shared.dawn ? { ...shared.dawn } : null,
    voteCounts: shared.stage === "VOTE" ? tallyVotes(shared.dayVotes, living) : {},
    needed: voteThreshold(living.length),
    lastVote:
      shared.stage === "VERDICT" && shared.lastVote
        ? { eliminatedId: shared.lastVote.eliminatedId, counts: { ...shared.lastVote.counts } }
        : null,
    winner: ended ? shared.winner : null,
    hostNight:
      host && shared.stage === "NIGHT"
        ? { wolfVotes: { ...shared.wolfVotes }, seerPick: shared.seerPick, guardPick: shared.guardPick }
        : null,
    hostVotes: host && shared.stage === "VOTE" ? { ...shared.dayVotes } : null,
  };
}
