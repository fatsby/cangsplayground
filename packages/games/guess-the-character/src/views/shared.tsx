import { useEffect, useState } from "react";
import type { GroupId, LobbyView, PlayerId } from "@cangsplayground/core";
import { PlayerIdentity, TeamBadge } from "@cangsplayground/ui";
import type { GuessView, MatchPublicView } from "../types.js";

export const LEVEL_KEY = "cangsplayground:gc-level";

export function guessView(session: { shared?: unknown }): GuessView | null {
  const shared = session.shared as GuessView | null | undefined;
  return shared && Array.isArray(shared.matches) ? shared : null;
}

export function teamIndex(lobby: LobbyView, groupId: GroupId): number {
  return lobby.groups.find((g) => g.id === groupId)?.index ?? 0;
}

export function playerOf(lobby: LobbyView, id: PlayerId | null) {
  return id ? lobby.players.find((p) => p.id === id) : undefined;
}

export function online(lobby: LobbyView, ids: PlayerId[]): number {
  return ids.filter((id) => lobby.players.find((p) => p.id === id)?.connected).length;
}

export function categoryName(view: GuessView, id: string | null): string {
  return (id && view.categories.find((c) => c.id === id)?.name) || "Not chosen yet";
}

/** "Match 1" from "r2m1". */
export function matchLabel(match: MatchPublicView): string {
  return `Match ${match.id.replace(/^r\d+m/, "")}`;
}

export const phaseLabels: Record<MatchPublicView["phase"], string> = {
  READY: "Get ready",
  CATEGORY_VOTE: "Choosing a category",
  PLAYING: "Playing",
  FINISHED: "Finished",
  ENDED: "Ended",
};

export function pauseText(match: MatchPublicView): string {
  return match.pauseReason === "offline"
    ? "Paused: a team has nobody online"
    : "Paused by the teacher";
}

/** Re-renders on a short interval while `active`, returning the server clock. */
export function useServerNow(serverNow: () => number, active: boolean): number {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    setNow(serverNow());
    if (!active) return;
    const id = setInterval(() => setNow(serverNow()), 250);
    return () => clearInterval(id);
  }, [serverNow, active]);
  return now;
}

export function Versus({ lobby, groupIds }: { lobby: LobbyView; groupIds: [GroupId, GroupId] }) {
  return (
    <div className="gc-versus">
      <TeamBadge teamIndex={teamIndex(lobby, groupIds[0])} />
      <span className="gc-vs" aria-label="versus">
        vs
      </span>
      <TeamBadge teamIndex={teamIndex(lobby, groupIds[1])} />
    </div>
  );
}

export function Person({
  lobby,
  id,
  size = 28,
}: {
  lobby: LobbyView;
  id: PlayerId | null;
  size?: number;
}) {
  if (!id) return <span className="cp-muted">—</span>;
  return <PlayerIdentity player={playerOf(lobby, id)} playerId={id} size={size} />;
}

/** The winning team, or the end reason, in plain words. */
export function resultText(lobby: LobbyView, match: MatchPublicView): string {
  if (match.phase === "FINISHED" && match.winnerGroupId) {
    const group = lobby.groups.find((g) => g.id === match.winnerGroupId);
    return `${group?.name ?? "A team"} guessed it!`;
  }
  return match.endReason === "empty-group"
    ? "Match ended: a team has no players"
    : "Match ended by the teacher";
}
