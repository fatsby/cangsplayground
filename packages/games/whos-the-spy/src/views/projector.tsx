import { Chip, type GameViewProps } from "@cangsplayground/ui";
import type { WhosTheSpyGroupView } from "../types.js";
import { HostGroupStatus } from "./host.js";
import "./projector-host.css";
export function ProjectorGroupStatus(props: GameViewProps) {
  if (props.group.phase === "FINISHED") return <Chip>Done</Chip>;
  if (props.group.phase === "RUNNING" && props.session.clock?.timer.pausedRemainingMs == null)
    return null;
  return <HostGroupStatus {...props} />;
}
export function ProjectorMemberMark({ group, playerId }: GameViewProps & { playerId: string }) {
  const data = group.data as WhosTheSpyGroupView | null;
  return group.phase === "VOTING" && data?.voted.includes(playerId) ? (
    <span className="wts-member-mark" aria-label="Voted">
      ✓
    </span>
  ) : null;
}
