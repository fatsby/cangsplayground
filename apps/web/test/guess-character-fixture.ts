import { vi } from "vitest";
import { createRng, type LobbyView, type RosterEntry, type Viewer } from "@cangsplayground/core";
import game, {
  configSchema,
  type GuessConfig,
  type GuessShared,
  type GuessView,
} from "@cangsplayground/game-guess-the-character";

export type Phase = "READY" | "CATEGORY_VOTE" | "PLAYING" | "FINISHED" | "ENDED";
export const NOW = 1_000_000;
const NAMES = ["Ada", "Bo", "Cy", "Dee", "Nguyễn Thị Phương Thảo Hoàng", "Fay", "Gus", "Hà"];

/**
 * Real module projections: g1 (Ada, Bo) vs g2 (Cy, Dee) in r1m1, holding Thor and
 * Spider-Man; with `groups: 4`, g3 vs g4 play Hulk vs Batman in r1m2.
 */
export function buildShared(
  phase: Phase,
  options: { groups?: 2 | 4; config?: Partial<GuessConfig> } = {},
) {
  const groups = options.groups ?? 2;
  const config = configSchema.parse(options.config ?? {});
  const rng = createRng(3);
  const ids = Array.from({ length: groups * 2 }, (_, i) => `p${i + 1}`);
  const roster: RosterEntry[] = ids.map((playerId, i) => ({
    playerId,
    groupId: `g${Math.floor(i / 2) + 1}`,
    connected: true,
  }));
  let shared = game.prepareShared!({
    config,
    rng,
    now: NOW,
    groups: Array.from({ length: groups }, (_, g) => ({
      groupId: `g${g + 1}`,
      playerIds: ids.slice(g * 2, g * 2 + 2),
      round: 1,
    })),
  });
  // Fixed pairing and order for readable fixtures.
  shared = structuredClone(shared);
  shared.matches.forEach((match, m) => {
    match.teams[0].groupId = `g${m * 2 + 1}`;
    match.teams[0].members = ids.slice(m * 4, m * 4 + 2);
    match.teams[1].groupId = `g${m * 2 + 2}`;
    match.teams[1].members = ids.slice(m * 4 + 2, m * 4 + 4);
    match.askingTeam = 0;
  });
  const args = (now = NOW) => ({ config, shared, roster, rng, now });
  if (phase === "READY") return { shared, config, roster };
  shared = game.onSharedAction!({
    ...args(),
    actor: { kind: "host" },
    action: { type: "gc:start", payload: { round: 1 } },
  })!;
  if (phase === "CATEGORY_VOTE") return { shared, config, roster };
  const closeAt = NOW + config.voteSeconds * 1000;
  for (const deadline of game.sharedDeadlines!(args(closeAt)))
    shared = game.onSharedDeadline!({ ...args(closeAt), deadline }) ?? shared;
  shared = structuredClone(shared);
  const secrets = [
    ["thor", "spider-man"],
    ["hulk", "batman"],
  ];
  shared.matches.forEach((match, m) => {
    match.categoryId = "superheroes";
    match.teams[0].characterId = secrets[m]![0]!;
    match.teams[1].characterId = secrets[m]![1]!;
  });
  if (phase === "FINISHED" || phase === "ENDED") {
    const m = shared.matches[0]!;
    m.phase = phase;
    m.phaseVersion++;
    m.winnerGroupId = phase === "FINISHED" ? "g1" : null;
    m.endReason = phase === "ENDED" ? "host" : null;
    m.timer = { endsAt: null, pausedRemainingMs: null, durationMs: m.timer.durationMs };
    m.speakerId = null;
    m.nextSpeakerId = null;
  }
  return { shared, config, roster };
}

export function project(
  shared: GuessShared,
  config: GuessConfig,
  viewer: Viewer,
  groupId: string | null,
) {
  return game.sharedViewFor!({ config, shared, viewer, viewerGroupId: groupId }) as GuessView;
}

export function lobbyFor(viewer: Viewer, shared: unknown, groups: 2 | 4 = 2): LobbyView {
  const ids = Array.from({ length: groups * 2 }, (_, i) => `p${i + 1}`);
  const own = viewer.kind === "player" ? viewer.playerId : null;
  return {
    viewer,
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
    players: ids.map((id, i) => ({
      id,
      name: NAMES[i]!,
      groupId: `g${Math.floor(i / 2) + 1}`,
      connected: true,
      away: false,
    })),
    groups: Array.from({ length: groups }, (_, g) => ({
      id: `g${g + 1}`,
      index: g,
      name: ["Team Red", "Team Blue", "Team Yellow", "Team Green"][g]!,
      playerIds: ids.slice(g * 2, g * 2 + 2),
    })),
    me: own
      ? {
          playerId: own,
          name: NAMES[ids.indexOf(own)] ?? "Late",
          groupId: own.startsWith("p")
            ? `g${Math.floor((Number(own.slice(1)) - 1) / 2) + 1}`
            : null,
        }
      : null,
    game: {
      gameId: "guess-the-character",
      name: "Guess the Character",
      stage: "ACTIVE",
      clock: null,
      config:
        viewer.kind === "host" ? { voteSeconds: 30, turnSeconds: 120, cooldownSeconds: 5 } : null,
      publicInfo: {},
      groups: [],
      shared,
    },
  };
}

/** Props for one viewer of a fixture state. */
export function propsFor(
  viewer: Viewer,
  phase: Phase,
  options: { groups?: 2 | 4; mutate?: (shared: GuessShared) => void; now?: number } = {},
) {
  const built = buildShared(phase, options);
  options.mutate?.(built.shared);
  const groupId =
    viewer.kind === "player"
      ? (built.roster.find((r) => r.playerId === viewer.playerId)?.groupId ?? null)
      : null;
  const view = project(built.shared, built.config, viewer, groupId);
  const lobby = lobbyFor(viewer, view, options.groups ?? 2);
  const now = options.now ?? NOW + (phase === "READY" || phase === "CATEGORY_VOTE" ? 0 : 30_000);
  return {
    lobby,
    session: lobby.game!,
    serverNow: () => now,
    act: vi.fn(async () => true),
    hostAct: vi.fn(async () => true),
    view,
    shared: built.shared,
    me: lobby.me ?? { playerId: "late", name: "Late", groupId: null },
  };
}
