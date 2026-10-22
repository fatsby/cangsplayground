/** Browser review data only; this module is never imported by the application. */
import { socket, saveToken } from "../src/socket";
import { useLobbyStore } from "../src/store";
import { teamName, type LobbyView, type ViewerKind } from "@cangsplayground/core";
const names = [
  "Thảo",
  "Bảo",
  "Quân",
  "Việt",
  "Ngọc",
  "Phúc",
  "Uyên",
  "Huy",
  "Lan",
  "Minh",
  "An",
  "Hà",
  "Linh",
  "Duy",
  "Mai",
  "Nam",
  "Thu",
  "Tuấn",
  "Trang",
  "Kiên",
  "Yến",
  "Long",
  "Hoa",
  "Tâm",
];
export function fixture(
  kind: ViewerKind,
  phase: "waiting" | "teams" | "game" | "turn" = "teams",
  count = 24,
  groupCount = 4,
): LobbyView {
  const groups = Array.from({ length: groupCount }, (_, i) => ({
    id: `g${i}`,
    index: i,
    name: teamName(i),
    playerIds: Array.from({ length: count }, (_, j) => j)
      .filter((j) => j % groupCount === i)
      .map((j) => `p${j}`),
  }));
  const players = Array.from({ length: count }, (_, i) => ({
    id: `p${i}`,
    name:
      names[i % names.length]! + (i >= names.length ? ` ${Math.floor(i / names.length) + 1}` : ""),
    groupId: phase === "waiting" ? null : `g${i % groupCount}`,
    connected: i % 8 !== 7,
    away: i % 12 === 11,
  }));
  return {
    viewer: kind === "player" ? { kind, playerId: "p0" } : { kind },
    code: "ABC234",
    status: "open",
    locked: false,
    hostConnected: true,
    createdAt: Date.now(),
    maxPlayers: 60,
    players,
    groups: phase === "waiting" ? [] : groups,
    groupsVersion: 1,
    me:
      kind === "player"
        ? { playerId: "p0", name: "Thảo", groupId: phase === "waiting" ? null : "g0" }
        : null,
    catalog:
      kind === "host"
        ? [
            {
              id: "free-talk",
              name: "Free Talk Timer",
              description: "Everyone has a turn to talk.",
              recommended: "2–8 per group",
              minPlayersPerGroup: 1,
              defaultConfig: {
                prompt: "What do you like to do with your friends?",
                turnSeconds: 60,
                turnsPerPlayer: 1,
              },
              configFields: [
                { key: "prompt", label: "Question", kind: "textarea" },
                {
                  key: "turnSeconds",
                  label: "Turn time",
                  kind: "number",
                  min: 15,
                  max: 300,
                  unit: "sec",
                },
                {
                  key: "turnsPerPlayer",
                  label: "Turns per player",
                  kind: "number",
                  min: 1,
                  max: 3,
                },
              ],
            },
          ]
        : [],
    warnings: [],
    version: 1,
    game: ["game", "turn"].includes(phase)
      ? {
          gameId: "free-talk",
          name: "Free Talk Timer",
          stage: "ACTIVE",
          config:
            kind === "host"
              ? {
                  prompt: "What do you like to do with your friends?",
                  turnSeconds: 60,
                  turnsPerPlayer: 1,
                }
              : null,
          publicInfo: { prompt: "What do you like to do with your friends?", turnSeconds: 60 },
          groups: groups
            .filter((g) => kind !== "player" || g.id === "g0")
            .map((g) => ({
              groupId: g.id,
              eliminated: [],
              phase: "RUNNING",
              round: 1,
              currentSpeakerId: g.playerIds[phase === "turn" ? 0 : 1]!,
              nextSpeakerId: g.playerIds[2]!,
              turnOrder: kind === "projector" ? null : g.playerIds,
              turnIndex: phase === "turn" ? 0 : 1,
              turnCount: g.playerIds.length,
              timer: { endsAt: Date.now() + 45000, pausedRemainingMs: null, durationMs: 60000 },
              revealed: false,
              data: { spoken: phase === "turn" ? [] : [g.playerIds[0]!] },
            })),
        }
      : null,
  };
}
export function installFixture(
  kind: ViewerKind,
  phase: Parameters<typeof fixture>[1] = "teams",
  count = 24,
  groupCount = 4,
) {
  const view = fixture(kind, phase, count, groupCount);
  socket.connected = false;
  socket.disconnect();
  saveToken("player", "ABC234", "test-player-token-1234567890");
  saveToken("host", "ABC234", "test-host-token-1234567890");
  socket.connected = true;
  socket.timeout = () => socket as any;
  socket.emit = ((
    event: string,
    _payload: unknown,
    ack: (error: null, result: unknown) => void,
  ) => {
    if (["host:attach", "display:watch", "session:resume"].includes(event))
      setTimeout(() => useLobbyStore.getState().sync(view), 10);
    ack?.(null, {
      ok: true,
      data: event === "time:sync" ? { clientNow: Date.now(), serverNow: Date.now() } : undefined,
    });
    return socket;
  }) as any;
  useLobbyStore.getState().setConnection("online");
  useLobbyStore.getState().sync(view);
  history.pushState(
    {},
    "",
    `/${kind === "projector" ? "display" : kind === "player" ? "play" : "host"}/ABC234`,
  );
  dispatchEvent(new PopStateEvent("popstate"));
  return view;
}
