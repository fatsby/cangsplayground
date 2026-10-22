import {
  AWAY_AFTER_MS,
  catalogEntry,
  diffView,
  MAX_PLAYERS_PER_LOBBY,
  validatePlan,
  type ClientToServerEvents,
  type LobbyView,
  type ServerToClientEvents,
  type Viewer,
} from "@cangsplayground/core";
import type { Socket } from "socket.io";
import type { Lobby } from "./lobby/Lobby.js";
import { registry } from "./games/registry.js";
export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function buildView(lobby: Lobby, viewer: Viewer): LobbyView {
  const host = viewer.kind === "host";
  const own = viewer.kind === "player" ? lobby.players.get(viewer.playerId) : undefined;
  const game = lobby.game;
  const warnings = [...lobby.warnings];
  if (lobby.groups.length && [...lobby.players.values()].some((p) => p.groupId === null))
    warnings.push({ code: "UNASSIGNED_PLAYERS", message: "Some players have no group yet." });
  if (game && lobby.groups.length) {
    const check = validatePlan(
      lobby.groups.map((g) => g.playerIds.length),
      game.module.minPlayersPerGroup,
    );
    if (!check.ok) warnings.push({ code: "GROUPS_TOO_SMALL", message: check.reason! });
  }
  return {
    viewer: { ...viewer },
    code: lobby.code,
    status: lobby.status,
    locked: lobby.locked,
    hostConnected: lobby.hostSockets.size > 0,
    createdAt: lobby.createdAt,
    maxPlayers: MAX_PLAYERS_PER_LOBBY,
    players: [...lobby.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      groupId: p.groupId,
      connected: p.sockets.size > 0,
      away: p.sockets.size === 0 && lobby.now() - p.lastSeenAt >= AWAY_AFTER_MS,
    })),
    groups: lobby.groups.map((g) => ({ ...g, playerIds: [...g.playerIds] })),
    groupsVersion: lobby.groupsVersion,
    game: game
      ? {
          gameId: game.module.id,
          name: game.module.name,
          stage: game.stage,
          config: host ? structuredClone(game.config) : null,
          publicInfo: structuredClone(game.module.publicInfo(game.config)),
          groups: game.groups
            .filter((g) => viewer.kind !== "player" || g.groupId === own?.groupId)
            .map((group) => ({
              groupId: group.groupId,
              phase: group.phase,
              round: group.round,
              currentSpeakerId:
                group.phase === "ROUND_END" ? null : (group.turnOrder[group.turnIndex] ?? null),
              nextSpeakerId:
                group.phase === "ROUND_END" ? null : (group.turnOrder[group.turnIndex + 1] ?? null),
              turnOrder:
                host || (viewer.kind === "player" && own?.groupId === group.groupId)
                  ? [...group.turnOrder]
                  : null,
              turnIndex: group.turnIndex,
              turnCount: group.turnOrder.length,
              timer: { ...group.timer },
              revealed: group.revealed,
              data: structuredClone(
                game.module.viewFor({
                  config: game.config,
                  state: group,
                  viewer,
                  isMember: own?.groupId === group.groupId,
                }),
              ),
            })),
        }
      : null,
    catalog: host ? [...registry.values()].map(catalogEntry) : [],
    me: own ? { playerId: own.id, name: own.name, groupId: own.groupId } : null,
    warnings: host ? warnings : [],
    version: lobby.version,
  };
}

/** All state traffic must pass through this per-viewer boundary. */
export class Broadcaster {
  private subscriptions = new Map<
    string,
    { socket: AppSocket; lobby: Lobby; viewer: Viewer; last?: LobbyView }
  >();
  private pending = new Set<Lobby>();
  attach(socket: AppSocket, lobby: Lobby, viewer: Viewer) {
    this.subscriptions.set(socket.id, { socket, lobby, viewer });
    this.send(socket.id, true);
  }
  detach(socketId: string) {
    this.subscriptions.delete(socketId);
  }
  queue(lobby: Lobby) {
    if (this.pending.has(lobby)) return;
    this.pending.add(lobby);
    queueMicrotask(() => {
      this.pending.delete(lobby);
      if (lobby.status !== "open") return;
      for (const [id, sub] of this.subscriptions) if (sub.lobby === lobby) this.send(id, false);
    });
  }
  private send(id: string, sync: boolean) {
    const sub = this.subscriptions.get(id);
    if (!sub) return;
    const view = buildView(sub.lobby, sub.viewer);
    if (sync || !sub.last) sub.socket.emit("state:sync", view);
    else {
      const patch = diffView(sub.last, view);
      if (patch) sub.socket.emit("state:patch", patch);
    }
    sub.last = structuredClone(view);
  }
}
