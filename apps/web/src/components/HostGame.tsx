import type { GameSessionView, GroupGameView, LobbyView } from "@cangsplayground/core";
import { Button, Chip, EmptyState, Panel, TeamBadge, Timer } from "@cangsplayground/ui";
import { ConfigForm } from "./ConfigForm";
import { canControl, mainControl, type Control } from "./game-controls";
export function HostGame({
  view,
  busy,
  serverNow,
  select,
  configure,
  control,
}: {
  view: LobbyView;
  busy: boolean;
  serverNow: () => number;
  select: (id: string) => void;
  configure: (config: Record<string, unknown>) => Promise<boolean>;
  control: (cmd: Control, groupId?: string) => void;
}) {
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
  const allowed =
    view.groups.length > 0 &&
    view.groups.every((g) => g.playerIds.length >= (entry?.minPlayersPerGroup ?? 1));
  return (
    <div className="cp-stack">
      <div className="cp-row cp-spread">
        <h1>{game.name}</h1>
        <Chip>{game.stage === "CONFIGURING" ? "Set up" : "Playing"}</Chip>
      </div>
      {entry && (
        <Panel className="cp-stack">
          <h2>Game settings</h2>
          <ConfigForm
            key={game.gameId}
            fields={entry.configFields}
            defaults={entry.defaultConfig}
            config={game.config ?? entry.defaultConfig}
            disabled={busy}
            onSave={configure}
          />
        </Panel>
      )}
      {!allowed && (
        <p className="cp-error">
          Each group needs at least {entry?.minPlayersPerGroup ?? 1} players. Make groups first.
        </p>
      )}
      {game.stage === "ACTIVE" && (
        <>
          <Panel className="cp-stack">
            <h2>All groups</h2>
            <SecondaryControls game={game} disabled={busy} control={control} />
          </Panel>
          {game.groups.map((runtime) => {
            const group = view.groups.find((g) => g.id === runtime.groupId);
            return (
              group && (
                <Panel key={runtime.groupId} className="cp-stack">
                  <div className="cp-row cp-spread">
                    <TeamBadge teamIndex={group.index} />
                    <span className="cp-muted">Round {runtime.round}</span>
                  </div>
                  <Timer timer={runtime.timer} serverNow={serverNow} />
                  <p className="cp-person">
                    Now: {view.players.find((p) => p.id === runtime.currentSpeakerId)?.name ?? "—"}
                  </p>
                  <div className="cp-row">
                    <Button
                      disabled={busy || !canControl(mainControl(game, runtime).cmd, game, runtime)}
                      onClick={() => control(mainControl(game, runtime).cmd, runtime.groupId)}
                    >
                      {mainControl(game, runtime).label}
                    </Button>
                  </div>
                  <SecondaryControls
                    game={game}
                    group={runtime}
                    disabled={busy}
                    control={control}
                  />
                </Panel>
              )
            );
          })}
        </>
      )}
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
      ).map(([cmd, label]) => (
        <Button
          key={cmd}
          disabled={disabled || !canControl(cmd, game, group)}
          onClick={() => control(cmd, group?.groupId)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
