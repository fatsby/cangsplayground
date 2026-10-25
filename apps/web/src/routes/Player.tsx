import type { GameAction } from "@cangsplayground/core";
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
  showTurnTimer,
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
    runtime = session?.groups.find((g) => g.groupId === group?.id),
    SessionScreen = session ? gameViews[session.gameId]?.PlayerSessionScreen : undefined;
  useWakeLock(
    runtime?.phase === "RUNNING" || !!(group && session?.stage === "ACTIVE" && SessionScreen),
  );
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
    if (busy || connection !== "online") return;
    setBusy(true);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        request("game:action", { type: "turn:done" }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("No reply")), 5000);
        }),
      ]);
      if (!result.ok) toast.error("Couldn't reach the server. Tap again.");
    } catch {
      toast.error("Couldn't reach the server. Tap again.");
    } finally {
      clearTimeout(timeout);
      setBusy(false);
    }
  };
  const act = async (action: GameAction) => {
    const result = await request("game:action", action);
    if (!result.ok) toast.error(result.error.message);
    return result.ok;
  };
  const TurnTip = session ? gameViews[session.gameId]?.PlayerTurnTip : undefined;
  const Screen = session ? gameViews[session.gameId]?.PlayerScreen : undefined;
  const isMine = runtime?.currentSpeakerId === view?.me?.playerId && runtime?.phase === "RUNNING";
  const gameScreen =
    view?.me && session && runtime && Screen ? (
      <Screen
        lobby={view}
        session={session}
        group={runtime}
        me={view.me}
        serverNow={serverNow}
        act={act}
      />
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
              {session?.clock && (
                <GameClock
                  clock={session.clock}
                  groups={session.groups}
                  serverNow={serverNow}
                  size="compact"
                />
              )}
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
                  <span>{view.players.length === 1 ? "player" : "players"} in the lobby</span>
                </Panel>
              </>
            ) : session?.stage === "ACTIVE" && SessionScreen ? (
              <section className="player-game cp-stack">
                <SessionScreen
                  lobby={view}
                  session={session}
                  me={view.me}
                  serverNow={serverNow}
                  act={act}
                />
              </section>
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
              <>
                <YourTurn
                  key={`${runtime.round}-${runtime.turnIndex}`}
                  timer={runtime.timer}
                  serverNow={serverNow}
                  onDone={() => void done()}
                  disabled={busy || connection !== "online"}
                  doneLabel={connection !== "online" ? "Offline…" : "I'm done"}
                >
                  {gameViews[session.gameId]?.roundLabel && (
                    <p className="player-round-label">
                      {gameViews[session.gameId]!.roundLabel!(runtime, group)}
                    </p>
                  )}
                  {TurnTip ? (
                    <TurnTip lobby={view} session={session} group={runtime} serverNow={serverNow} />
                  ) : (
                    gameScreen
                  )}
                </YourTurn>
                {TurnTip && gameScreen}
              </>
            ) : (
              <section className="player-game cp-stack">
                <div className="cp-row cp-spread">
                  <span className="cp-muted">
                    {runtime.phase === "PAUSED"
                      ? "Game paused"
                      : runtime.phase === "PREPARED"
                        ? "Get ready"
                        : (gameViews[session.gameId]?.roundLabel?.(runtime, group) ??
                          (runtime.phase === "VOTING"
                            ? "Vote now"
                            : runtime.phase === "FINISHED"
                              ? "Game over"
                              : runtime.phase === "ROUND_END"
                                ? "Round finished"
                                : "Listen to your team"))}
                  </span>
                  {runtime.phase !== "VOTING" && showTurnTimer(runtime) && (
                    <Timer timer={runtime.timer} serverNow={serverNow} />
                  )}
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
