import type { GameSessionView, LobbyView } from "@cangsplayground/core";
import type { SessionViewProps } from "@cangsplayground/ui";
import type { WerewolfView } from "../WerewolfView.js";
import { HostGodView } from "./HostGodView.js";
import { RoleEditor } from "./RoleEditor.js";
import { useRoster } from "./shared.jsx";

/** The host's panel: the role editor before the game starts, the god view afterwards. */
export function HostSessionPanel({
  lobby,
  session,
  serverNow,
  busy = false,
  hostAct,
}: SessionViewProps) {
  const roster = useRoster(lobby);
  const view = session.shared as WerewolfView | null;
  const extra = hostAct ? { hostAct } : {};
  return (
    <div className="ww-root ww-host">
      {!view ? null : view.stage === "SETUP" ? (
        <RoleEditor view={view} roster={roster} busy={busy} {...extra} />
      ) : (
        <HostGodView view={view} roster={roster} busy={busy} serverNow={serverNow} {...extra} />
      )}
    </div>
  );
}

/** A short reminder shown next to the timing settings. */
export function HostConfigNote({ session }: { lobby: LobbyView; session: GameSessionView }) {
  void session;
  return (
    <p className="cp-muted">
      Roles are dealt automatically (about one Werewolf per four players, one Seer, one Guard). You
      can change any role before you press Start. The host does not play.
    </p>
  );
}
