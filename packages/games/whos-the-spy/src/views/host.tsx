import { Chip, type GameViewProps } from "@cangsplayground/ui";
import type { WhosTheSpyGroupView } from "../types.js";
import "./projector-host.css";
export function HostGroupStatus({ lobby, session, group }: GameViewProps) {
  const data = group.data as WhosTheSpyGroupView | null;
  let label: string;
  if (group.phase === "FINISHED")
    label = data?.result?.winner === "team" ? "Team wins!" : "Spy wins!";
  else if (
    group.phase === "PAUSED" ||
    session.clock?.timer.pausedRemainingMs != null ||
    (group.phase === "VOTING" && group.timer.pausedRemainingMs !== null)
  )
    label = "Paused";
  else if (group.phase === "VOTING") {
    const active =
      lobby.groups
        .find((g) => g.id === group.groupId)
        ?.playerIds.filter((id) => !group.eliminated.includes(id)) ?? [];
    label = `Voting ${data?.voted.filter((id) => active.includes(id)).length ?? 0}/${active.length}`;
  } else if (group.phase === "ROUND_END") label = "Waiting for Continue";
  else if (group.phase === "PREPARED") label = "Get ready";
  else
    label = `Speaking · ${lobby.players.find((p) => p.id === group.currentSpeakerId)?.name ?? "Player"}`;
  return <Chip>{label}</Chip>;
}
export function HostConfigNote({ lobby, session }: Pick<GameViewProps, "lobby" | "session">) {
  if (!lobby.groups.length) return null;
  const n = Math.min(...lobby.groups.map((group) => group.playerIds.length));
  const k = Math.max(0, Math.floor((n - 1) / 2));
  const invalid = Number(session.config?.spies ?? 1) > k;
  return (
    <p className={invalid ? "cp-error" : "cp-muted"} role={invalid ? "alert" : undefined}>
      Your smallest team has {n} {n === 1 ? "player" : "players"}: up to {k}{" "}
      {k === 1 ? "spy" : "spies"}.
    </p>
  );
}
