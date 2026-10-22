import { useEffect, useState } from "react";
import { useParams } from "react-router";
import {
  Users,
  Shuffle,
  Gamepad2,
  EyeOff,
  ScanLine,
  Play,
  Pause,
  SkipForward,
  Plus,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { MobileToaster } from "../components/MobileToaster";
import {
  describePlan,
  planGroupSizes,
  validatePlan,
  type PlayerSummary,
} from "@cangsplayground/core";
import {
  Button,
  Drawer,
  EmptyState,
  HostSecretRow,
  Input,
  Panel,
  PlayerList,
  Switch,
  Tabs,
  Waiting,
} from "@cangsplayground/ui";
import { connect, hostCommand, readToken, request, saveToken } from "../socket";
import { useLobbyStore } from "../store";
import { Loading, SessionBoundary, useRole } from "../components/session";
import { HostGame } from "../components/HostGame";
import { canControl, mainControl, type Control } from "../components/game-controls";
import { gameViews } from "../games/registry";
const claims = new Map<string, ReturnType<typeof request<"host:claim">>>();
export default function Host() {
  const code = useParams().code!.toUpperCase();
  const [token, setToken] = useState(() => readToken("host", code)),
    [claimError, setClaimError] = useState(""),
    [claiming, setClaiming] = useState(false);
  const error = useRole("host", code, token ?? undefined),
    { view, serverNow, connection } = useLobbyStore();
  const [tab, setTab] = useState("players"),
    [busy, setBusy] = useState(false),
    [mode, setMode] = useState<"count" | "maxSize">("count"),
    [value, setValue] = useState(4),
    [player, setPlayer] = useState<PlayerSummary | null>(null),
    [showSecrets, setShowSecrets] = useState(false);
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    action: () => Promise<void>;
    danger?: boolean;
  } | null>(null);
  useEffect(() => {
    const pair = new URLSearchParams(location.hash.slice(1)).get("pair");
    if (!pair) return;
    let active = true;
    setClaiming(true);
    connect();
    let claim = claims.get(pair);
    if (!claim) {
      claim = request("host:claim", { code, pairToken: pair });
      claims.set(pair, claim);
    }
    void claim.then((result) => {
      if (!active) return;
      setClaiming(false);
      history.replaceState(null, "", location.pathname);
      if (result.ok) {
        saveToken("host", code, result.data.hostToken);
        setToken(result.data.hostToken);
      } else setClaimError(result.error.message);
    });
    return () => {
      active = false;
    };
  }, [code]);
  useEffect(() => {
    if (!showSecrets) return;
    const timer = setTimeout(() => setShowSecrets(false), 15000);
    const hide = () => setShowSecrets(false);
    window.addEventListener("blur", hide);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("blur", hide);
    };
  }, [showSecrets]);
  const execute = async (action: () => Promise<{ ok: boolean; error?: { message: string } }>) => {
    setBusy(true);
    try {
      const result = await action();
      if (!result.ok) toast.error(result.error?.message ?? "Please try again.");
      return result.ok;
    } finally {
      setBusy(false);
    }
  };
  const control = (cmd: Control, groupId?: string) => {
    const action = async () => {
      await execute(() => hostCommand("game:control", { cmd, ...(groupId ? { groupId } : {}) }));
    };
    if (["exit", "endRound"].includes(cmd))
      setConfirm({
        title:
          cmd === "exit"
            ? "Exit this game?"
            : gameViews[view!.game!.gameId]?.controlLabels?.endRound
              ? `${gameViews[view!.game!.gameId]!.controlLabels!.endRound}?`
              : "End this round?",
        description:
          cmd === "exit"
            ? "Teams stay the same. You can pick a new game."
            : view?.game?.voteDurationMs != null
              ? `Speaking ends now for ${groupId ? "this group" : "all groups"}.`
              : "The timer will stop for this round.",
        action,
        danger: true,
      });
    else void action();
  };
  const assign = async (confirmed = false) => {
    setBusy(true);
    try {
      const result = await hostCommand("groups:assign", {
        mode,
        value,
        ...(confirmed ? { confirm: true } : {}),
      });
      if (!result.ok) {
        if (result.error.code === "CONFIRM_REQUIRED")
          setConfirm({
            title: "Make new groups?",
            description: "The current game will end for all groups.",
            action: () => assign(true),
            danger: true,
          });
        else toast.error(result.error.message);
      }
    } finally {
      setBusy(false);
    }
  };
  if (claiming) return <Loading />;
  if (!token)
    return (
      <main className="mobile-screen">
        <EmptyState
          message={claimError || "Scan the host QR on the projector"}
          icon={<ScanLine size={64} strokeWidth={2.25} />}
        />
      </main>
    );
  const selected = view?.catalog.find((game) => game.id === view.game?.gameId),
    sizes = planGroupSizes(view?.players.length ?? 0, mode, value),
    plan = validatePlan(sizes, selected?.minPlayersPerGroup ?? 1),
    game = view?.game;
  const action = game ? mainControl(game) : null;
  const canPrepare =
    !!view?.groups.length &&
    view.groups.every((g) => g.playerIds.length >= (selected?.minPlayersPerGroup ?? 1));
  return (
    <SessionBoundary code={code} error={error}>
      <MobileToaster />
      <main className="mobile-screen host-screen">
        <header className="host-header">
          <div>
            <p className="eyebrow">HOST CONSOLE</p>
            <span className="host-code">{code}</span>
          </div>
          <span className="cp-muted">{view?.players.length ?? 0} / 60 players</span>
        </header>
        {!view ? (
          <Loading />
        ) : (
          <>
            <div className="host-content cp-stack">
              {view.warnings.map((w) => (
                <p className="host-warning" key={`${w.code}-${w.groupId}-${w.playerId}`}>
                  {w.message}
                </p>
              ))}
              {tab === "players" && (
                <>
                  <div className="cp-row cp-spread">
                    <h1>Your players</h1>
                    <span className="cp-muted">
                      {view.players.filter((p) => p.connected).length} online
                    </span>
                  </div>
                  <Panel className="cp-stack">
                    <Switch
                      label="Lock lobby"
                      checked={view.locked}
                      disabled={busy}
                      onCheckedChange={(locked) =>
                        void execute(() => hostCommand("lobby:lock", { locked }))
                      }
                    />
                    <p className="cp-muted">
                      {view.locked
                        ? "New players cannot join."
                        : "New players can join with the code."}
                    </p>
                  </Panel>
                  {view.players.length ? (
                    <PlayerList players={view.players} groups={view.groups} onMore={setPlayer} />
                  ) : (
                    <Waiting message="Players will appear here" />
                  )}
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      setConfirm({
                        title: "Close this lobby?",
                        description: "Everyone will leave. You cannot open this lobby again.",
                        danger: true,
                        action: async () => {
                          await execute(() => hostCommand("lobby:close", {}));
                        },
                      })
                    }
                  >
                    Close lobby
                  </Button>
                </>
              )}
              {tab === "groups" && (
                <>
                  <h1>Make your teams</h1>
                  <p className="cp-muted">Everyone gets a colour, a shape, and a team.</p>
                  <Panel className="cp-stack">
                    <div className="cp-row mode-buttons">
                      <Button aria-pressed={mode === "count"} onClick={() => setMode("count")}>
                        Group count
                      </Button>
                      <Button aria-pressed={mode === "maxSize"} onClick={() => setMode("maxSize")}>
                        Max size
                      </Button>
                    </div>
                    <Input
                      label={mode === "count" ? "Number of groups" : "Max players per group"}
                      type="number"
                      min={1}
                      max={60}
                      value={value}
                      onChange={(e) =>
                        setValue(Math.max(1, Math.min(60, Math.floor(Number(e.target.value) || 1))))
                      }
                    />
                    <p className="group-plan" aria-live="polite">
                      {describePlan(view.players.length, mode, value)}
                    </p>
                    {!plan.ok && <p className="cp-error">{plan.reason}</p>}
                  </Panel>
                  <div className="cp-sticky-action">
                    <Button
                      variant={game ? "secondary" : "primary"}
                      size="lg"
                      disabled={busy || !plan.ok || view.players.length === 0}
                      onClick={() => {
                        if (game?.stage === "ACTIVE")
                          setConfirm({
                            title: "Make new groups?",
                            description: "The current game will end for all groups.",
                            danger: true,
                            action: () => assign(true),
                          });
                        else void assign();
                      }}
                    >
                      <Shuffle strokeWidth={2.25} />
                      {view.groups.length ? "Re-assign groups" : "Assign groups"}
                    </Button>
                  </div>
                </>
              )}
              {tab === "game" && (
                <HostGame
                  view={view}
                  serverNow={serverNow}
                  busy={busy}
                  select={(gameId) => void execute(() => hostCommand("game:select", { gameId }))}
                  configure={(config) => execute(() => hostCommand("game:configure", { config }))}
                  control={control}
                />
              )}
              {tab === "secrets" && (
                <>
                  <h1>Group details</h1>
                  <p className="cp-muted">Hold a row to see it. Let go to hide it.</p>
                  {!game?.groups.length ? (
                    <EmptyState
                      message="Prepare a game to see group details"
                      icon={<EyeOff size={64} strokeWidth={2.25} />}
                    />
                  ) : (
                    <>
                      {game.groups.map((runtime) => {
                        const group = view.groups.find((g) => g.id === runtime.groupId),
                          HostPanel = gameViews[game.gameId]?.HostGroupPanel;
                        return (
                          group && (
                            <HostSecretRow
                              key={group.id}
                              teamIndex={group.index}
                              revealed={showSecrets}
                            >
                              {HostPanel ? (
                                <HostPanel
                                  lobby={view}
                                  session={game}
                                  group={runtime}
                                  serverNow={serverNow}
                                />
                              ) : (
                                "No secret details for this game."
                              )}
                            </HostSecretRow>
                          )
                        );
                      })}
                      <Button
                        onClick={() =>
                          showSecrets
                            ? setShowSecrets(false)
                            : setConfirm({
                                title: "Show all group details?",
                                description:
                                  "People near your phone may see these details. They hide again after 15 seconds.",
                                action: async () => setShowSecrets(true),
                              })
                        }
                      >
                        {showSecrets ? "Hide all" : "Show all"}
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
            {game && (
              <div className="host-fixed-controls">
                <Button
                  variant="primary"
                  disabled={
                    busy ||
                    connection !== "online" ||
                    !action ||
                    !canControl(action.cmd, game) ||
                    (action.cmd === "prepare" && !canPrepare)
                  }
                  onClick={() => action && control(action.cmd)}
                >
                  {action?.cmd === "pause" ? (
                    <Pause size={20} strokeWidth={2.25} />
                  ) : (
                    <Play size={20} strokeWidth={2.25} />
                  )}
                  {action
                    ? (gameViews[game.gameId]?.controlLabels?.[action.cmd] ??
                      (
                        {
                          prepare: "Prepare",
                          start: "Start",
                          pause: "Pause",
                          resume: "Resume",
                          nextRound: "Next",
                        } as Partial<Record<Control, string>>
                      )[action.cmd] ??
                      action.label)
                    : "Start"}
                </Button>
                <Button
                  aria-label="Skip turn for all groups"
                  disabled={busy || !canControl("skip", game)}
                  onClick={() => control("skip")}
                >
                  <SkipForward strokeWidth={2.25} />
                </Button>
                <Button
                  aria-label="Add 30 seconds to all groups"
                  disabled={busy || !canControl("extend", game)}
                  onClick={() => control("extend")}
                >
                  <Plus size={18} strokeWidth={2.25} />
                  30s
                </Button>
                <Button
                  hidden={gameViews[game.gameId]?.controlLabels?.endRound === null}
                  aria-label={`${gameViews[game.gameId]?.controlLabels?.endRound ?? "End round"} for all groups`}
                  disabled={busy || !canControl("endRound", game)}
                  onClick={() => control("endRound")}
                >
                  <Square size={18} strokeWidth={2.25} />
                  {gameViews[game.gameId]?.controlLabels?.endRound}
                </Button>
              </div>
            )}
          </>
        )}
        <Tabs
          className="host-tabs"
          value={tab}
          onValueChange={setTab}
          items={[
            { value: "players", label: "Players", icon: <Users strokeWidth={2.25} /> },
            { value: "groups", label: "Groups", icon: <Shuffle strokeWidth={2.25} /> },
            { value: "game", label: "Game", icon: <Gamepad2 strokeWidth={2.25} /> },
            { value: "secrets", label: "Secrets", icon: <EyeOff strokeWidth={2.25} /> },
          ]}
        />
      </main>
      <Drawer
        open={!!player}
        onOpenChange={(open) => !open && setPlayer(null)}
        title={player?.name ?? "Player actions"}
        description="Move this player or remove them from the lobby."
      >
        <Button
          onClick={() => {
            const p = player!;
            setPlayer(null);
            void execute(() => hostCommand("groups:move", { playerId: p.id, toGroupId: null }));
          }}
        >
          No group
        </Button>
        {view?.groups.map((g) => (
          <Button
            key={g.id}
            onClick={() => {
              const p = player!;
              setPlayer(null);
              void execute(() => hostCommand("groups:move", { playerId: p.id, toGroupId: g.id }));
            }}
          >
            {g.name}
          </Button>
        ))}
        <Button
          variant="danger"
          onClick={() => {
            const p = player!;
            setPlayer(null);
            setConfirm({
              title: `Remove ${p.name}?`,
              description: "They will need to join again.",
              danger: true,
              action: async () => {
                await execute(() => hostCommand("lobby:kick", { playerId: p.id }));
              },
            });
          }}
        >
          Remove player
        </Button>
        <Button variant="ghost" onClick={() => setPlayer(null)}>
          Cancel
        </Button>
      </Drawer>
      <Drawer
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm?.title ?? "Confirm"}
        description={confirm?.description}
      >
        <Button
          variant={confirm?.danger ? "danger" : "secondary"}
          disabled={busy}
          onClick={() => {
            const action = confirm?.action;
            setConfirm(null);
            void action?.();
          }}
        >
          Confirm
        </Button>
        <Button variant="ghost" onClick={() => setConfirm(null)}>
          Cancel
        </Button>
      </Drawer>
    </SessionBoundary>
  );
}
