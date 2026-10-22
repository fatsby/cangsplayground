import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Button,
  Panel,
  TeamBadge,
  TeamShape,
  Timer,
  GameClock,
  Waiting,
  YourTurn,
  teamVars,
} from "@cangsplayground/ui";
import { toast } from "sonner";
import { MobileToaster } from "../components/MobileToaster";
import { gameViews } from "../games/registry";
import { readToken, request } from "../socket";
import { useLobbyStore } from "../store";
import { Loading, SessionBoundary, useRole, useWakeLock } from "../components/session";
export default function Player() {
  const code = useParams().code!.toUpperCase(),
    token = readToken("player", code),
    navigate = useNavigate();
  const error = useRole("player", code, token ?? undefined);
  const { view, serverNow, connection, terminal } = useLobbyStore();
  const [busy, setBusy] = useState(false);
  const session = view?.game,
    group = view?.groups.find((g) => g.id === view.me?.groupId),
    runtime = session?.groups.find((g) => g.groupId === group?.id);
  useWakeLock(runtime?.phase === "RUNNING");
  if (!token && !terminal)
    return (
      <main className="mobile-screen">
        <Waiting message="Join your class to play">
          <Button variant="primary" onClick={() => navigate(`/join/${code}`)}>
            Join lobby
          </Button>
        </Waiting>
      </main>
    );
  const done = async () => {
    setBusy(true);
    const result = await request("game:action", { type: "turn:done" });
    setBusy(false);
    if (!result.ok) toast.error(result.error.message);
  };
  const Screen = session ? gameViews[session.gameId]?.PlayerScreen : undefined;
  const isMine = runtime?.currentSpeakerId === view?.me?.playerId && runtime?.phase === "RUNNING";
  const gameScreen =
    view?.me && session && runtime && Screen ? (
      <Screen lobby={view} session={session} group={runtime} me={view.me} serverNow={serverNow} />
    ) : null;
  return (
    <SessionBoundary code={code} error={error}>
      <MobileToaster />
      <main
        className={`mobile-screen player-screen ${group ? "player-team" : ""}`}
        style={group ? teamVars(group.index) : undefined}
      >
        {!view || !view.me ? (
          <Loading />
        ) : (
          <>
            <header className="player-header">
              <strong className="cp-person">{view.me.name}</strong>
              {session?.clock && <GameClock clock={session.clock} serverNow={serverNow} />}
              {group && <TeamBadge teamIndex={group.index} />}
            </header>
            {!group ? (
              <>
                <Waiting
                  message={
                    view.groups.length
                      ? "Your teacher will add you to a group"
                      : "Waiting for the teacher to make groups"
                  }
                />
                <Panel className="waiting-info">
                  <strong>{view.players.length}</strong>
                  <span>players in the lobby</span>
                </Panel>
              </>
            ) : !runtime || !session || session.stage === "CONFIGURING" ? (
              <section className="team-stage cp-stack">
                <div className="team-symbol">
                  <TeamShape teamIndex={group.index} size={96} />
                </div>
                <TeamBadge className="team-received" teamIndex={group.index} />
                <h1>Find your team</h1>
                <p className="cp-muted">Say hello. Get ready to play.</p>
                <Panel>
                  <ul className="team-member-list">
                    {group.playerIds.map((id) => (
                      <li className="cp-person" key={id}>
                        {view.players.find((p) => p.id === id)?.name}
                      </li>
                    ))}
                  </ul>
                </Panel>
                <p className="cp-muted">Wait for your teacher</p>
              </section>
            ) : isMine ? (
              <YourTurn
                key={`${runtime.round}-${runtime.turnIndex}`}
                timer={runtime.timer}
                serverNow={serverNow}
                onDone={() => void done()}
                disabled={busy || connection !== "online"}
              >
                {gameScreen}
              </YourTurn>
            ) : (
              <section className="player-game cp-stack">
                <div className="cp-row cp-spread">
                  <span className="cp-muted">
                    {runtime.phase === "PAUSED"
                      ? "Game paused"
                      : runtime.phase === "PREPARED"
                        ? "Get ready"
                        : runtime.phase === "VOTING"
                          ? "Vote now"
                          : runtime.phase === "FINISHED"
                            ? "Game over"
                            : runtime.phase === "ROUND_END"
                              ? "Round finished"
                              : "Listen to your team"}
                  </span>
                  <Timer timer={runtime.timer} serverNow={serverNow} />
                </div>
                {gameScreen}
              </section>
            )}
          </>
        )}
      </main>
    </SessionBoundary>
  );
}
