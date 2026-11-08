import { vi } from "vitest";
import type { LobbyView } from "@cangsplayground/core";
import type { MyState, WerewolfView } from "@cangsplayground/game-werewolf";

export const NAMES = ["Ada", "Bo", "Cy", "Dee", "Eve", "Fay"];
export const ids = NAMES.map((_, i) => `p${i + 1}`);

/** A NIGHT-stage view with six living players and nothing decided yet. */
export function wwView(over: Partial<WerewolfView> = {}): WerewolfView {
  return {
    stage: "NIGHT",
    night: 1,
    deadlineAt: 30_000,
    stageMs: 30_000,
    players: ids.map((id) => ({ id, alive: true })),
    roles: null,
    me: null,
    dawn: null,
    voteCounts: {},
    needed: 3,
    lastVote: null,
    winner: null,
    hostNight: null,
    hostVotes: null,
    ...over,
  };
}

/** What the server sends a player holding `role` (everything not allowed for the role stays null). */
export function myState(over: Partial<MyState> = {}): MyState {
  return {
    role: "villager",
    alive: true,
    pending: false,
    teammates: [],
    wolfVotes: null,
    seerLog: null,
    guardSelfUsed: null,
    myVote: null,
    myNightPick: null,
    ...over,
  };
}

/** The props a view receives, for a viewer of the given kind. */
export function props(
  shared: WerewolfView,
  viewer: "player" | "host" | "projector" = "player",
  playerId = "p1",
) {
  const lobby: LobbyView = {
    viewer: viewer === "player" ? { kind: "player", playerId } : { kind: viewer },
    code: "ABC234",
    status: "open",
    locked: false,
    hostConnected: true,
    createdAt: 0,
    maxPlayers: 60,
    groupsVersion: 1,
    catalog: [],
    warnings: [],
    version: 1,
    players: NAMES.map((name, i) => ({
      id: `p${i + 1}`,
      name,
      groupId: "g1",
      connected: true,
      away: false,
      avatar: { seed: `seed-${name}`, backgroundColor: "efe6ff" },
    })),
    groups: [{ id: "g1", index: 0, name: "Team Red", playerIds: ids }],
    me:
      viewer === "player"
        ? { playerId, groupId: "g1", name: NAMES[Number(playerId.slice(1)) - 1]! }
        : null,
    game: {
      gameId: "werewolf",
      name: "Werewolf",
      stage: "ACTIVE",
      clock: null,
      config: null,
      publicInfo: null,
      groups: [],
      shared,
    },
  } as unknown as LobbyView;
  return {
    lobby,
    session: lobby.game!,
    me: lobby.me!,
    serverNow: () => 0,
    act: vi.fn(async () => true),
    hostAct: vi.fn(async () => true),
    busy: false,
  };
}
