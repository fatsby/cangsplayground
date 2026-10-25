import { useState } from "react";
import type { GameAction, GameSessionView, GroupGameView, LobbyView } from "@cangsplayground/core";
import {
  Button,
  Chip,
  EmptyState,
  Panel,
  TeamBadge,
  Timer,
  GameClock,
  allGroupsFinished,
  showTurnTimer,
} from "@cangsplayground/ui";
import { gameViews } from "../games/registry";
import { ConfigForm } from "./ConfigForm";
import { canControl, mainControl, supportsControl, type Control } from "./game-controls";
export function HostGame({
  view,
  busy,
  serverNow,
  select,
  configure,
  control,
  hostAct,
}: {
  view: LobbyView;
  busy: boolean;
  serverNow: () => number;
  select: (id: string) => void;
  configure: (config: Record<string, unknown>) => Promise<boolean>;
  control: (cmd: Control, groupId?: string) => void;
  hostAct?: (action: GameAction) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<{ gameId: string; config: Record<string, unknown> } | null>(
    null,
  );
  const game = view.game,
    entry = view.catalog.find((e) => e.id === game?.gameId);
  if (!game)
    return (
      <div className="cp-stack">
        <h1>Pick a game</h1>
        <p className="cp-muted">Small games. More chances to speak.</p>
        {view.catalog.map((game) => (
          <Panel key={game.id} className="cp-stack">
            <Chip>{game.recommended}</Chip>
            <h2>{game.name}</h2>
            <p className="cp-muted">{game.description}</p>
            <Button disabled={busy} onClick={() => select(game.id)}>
              Choose game
            </Button>
          </Panel>
        ))}
        {!view.catalog.length && <EmptyState message="No games are ready yet" />}
      </div>
    );
  const views = gameViews[game.gameId];
  const labels = views?.controlLabels;
  const Status = views?.HostGroupStatus;
  const Note = views?.HostConfigNote;
  const SessionPanel = views?.HostSessionPanel;
  const finished = allGroupsFinished(game.groups);
  const allowed =
    view.groups.length > 0 &&
    view.groups.every((g) => g.playerIds.length >= (entry?.minPlayersPerGroup ?? 1));
  return (
    <div className="cp-stack">
      <div className="cp-row cp-spread">
        <h1>{game.name}</h1>
        <Chip>{game.stage === "CONFIGURING" ? "Set up" : finished ? "Finished" : "Playing"}</Chip>
      </div>
      {game.clock && <GameClock clock={game.clock} groups={game.groups} serverNow={serverNow} />}
      {entry && (
        <Panel className="cp-stack">
          <details key={`${game.gameId}-${game.stage}`} open={game.stage === "CONFIGURING"}>
            <summary>Game settings</summary>
            <ConfigForm
              key={game.gameId}
              fields={entry.configFields}
              defaults={entry.defaultConfig}
              config={game.config ?? entry.defaultConfig}
              disabled={busy}
              onSave={configure}
              onValuesChange={(config) => setDraft({ gameId: game.gameId, config })}
            />
            {Note && (
              <Note
                lobby={view}
                session={draft?.gameId === game.gameId ? { ...game, config: draft.config } : game}
              />
            )}
          </details>
        </Panel>
      )}
      {!allowed && (
        <p className="cp-error">
          Each group needs at least {entry?.minPlayersPerGroup ?? 1}{" "}
          {(entry?.minPlayersPerGroup ?? 1) === 1 ? "player" : "players"}. Make groups first.
        </p>
      )}
      {game.stage === "ACTIVE" &&
        (SessionPanel ? (
          <SessionPanel
            lobby={view}
            session={game}
            serverNow={serverNow}
            busy={busy}
            hostAct={hostAct}
          />
        ) : (
          <>
            {!finished && (
              <Panel className="cp-stack">
                <h2>All groups</h2>
                <SecondaryControls game={game} disabled={busy} control={control} />
              </Panel>
            )}
            {game.groups.map((runtime) => {
              const group = view.groups.find((g) => g.id === runtime.groupId);
              return (
                group && (
                  <Panel key={runtime.groupId} className="cp-stack">
                    <div className="cp-row cp-spread">
                      <TeamBadge teamIndex={group.index} />
                      {Status ? (
                        <Status lobby={view} session={game} group={runtime} serverNow={serverNow} />
                      ) : (
                        <Chip>
                          {runtime.phase === "RUNNING"
                            ? "Speaking"
                            : runtime.phase === "VOTING"
                              ? "Voting"
                              : runtime.phase === "ROUND_END"
                                ? "Waiting"
                                : runtime.phase === "FINISHED"
                                  ? "Finished"
                                  : runtime.phase === "PAUSED"
                                    ? "Paused"
                                    : "Get ready"}
                        </Chip>
                      )}
                    </div>
                    <p className="cp-muted">
                      {views?.roundLabel?.(runtime, group) ?? `Round ${runtime.round}`}
                    </p>
                    {showTurnTimer(runtime) && (
                      <Timer timer={runtime.timer} serverNow={serverNow} />
                    )}
                    {(runtime.phase === "RUNNING" || runtime.phase === "PAUSED") && !Status && (
                      <p className="cp-person">
                        Now:{" "}
                        {view.players.find((p) => p.id === runtime.currentSpeakerId)?.name ?? "—"}
                      </p>
                    )}
                    {runtime.phase !== "FINISHED" && (
                      <>
                        <div className="cp-row">
                          <Button
                            hidden={labels?.[mainControl(game, runtime).cmd] === null}
                            disabled={
                              busy || !canControl(mainControl(game, runtime).cmd, game, runtime)
                            }
                            onClick={() => control(mainControl(game, runtime).cmd, runtime.groupId)}
                          >
                            {labels?.[mainControl(game, runtime).cmd] ??
                              mainControl(game, runtime).label}
                          </Button>
                        </div>
                        <SecondaryControls
                          game={game}
                          group={runtime}
                          disabled={busy}
                          control={control}
                        />
                      </>
                    )}
                  </Panel>
                )
              );
            })}
          </>
        ))}
      <Button disabled={busy} onClick={() => control("exit")}>
        Exit game
      </Button>
    </div>
  );
}
function SecondaryControls({
  game,
  group,
  disabled,
  control,
}: {
  game: GameSessionView;
  group?: GroupGameView;
  disabled: boolean;
  control: (cmd: Control, groupId?: string) => void;
}) {
  return (
    <div className="host-control-grid">
      {(
        [
          ["skip", "Skip turn"],
          ["extend", "+30s"],
          ["endRound", "End round"],
          ["reveal", "Reveal"],
          ["nextRound", "Next round"],
          ["pause", "Pause"],
          ["resume", "Resume"],
        ] as const
      )
        .filter(
          ([cmd]) =>
            (!group || mainControl(game, group).cmd !== cmd) &&
            supportsControl(cmd, game) &&
            gameViews[game.gameId]?.controlLabels?.[cmd] !== null,
        )
        .map(([cmd, label]) => (
          <Button
            key={cmd}
            disabled={disabled || !canControl(cmd, game, group)}
            onClick={() => control(cmd, group?.groupId)}
          >
            {gameViews[game.gameId]?.controlLabels?.[cmd] ?? label}
          </Button>
        ))}
    </div>
  );
}
