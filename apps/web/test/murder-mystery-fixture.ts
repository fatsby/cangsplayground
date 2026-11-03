import { vi } from "vitest";
import {
  createRng,
  type GameAction,
  type LobbyView,
  type RosterEntry,
  type Viewer,
} from "@cangsplayground/core";
import game, {
  type MurderShared,
  type MurderView,
  type Phase,
} from "@cangsplayground/game-murder-mystery";

export type { Phase };
export const NOW = 1_000_000;
const NAMES = ["Ada", "Bo", "Cy", "Dee", "Eli", "Fay", "Gus"];
const TEAM_NAMES = ["Team Red", "Team Blue", "Team Yellow"];

type BuildOptions = {
  /** Players per team; default one team of three and one of four. */
  sizes?: number[];
  /** INVESTIGATION and later: every team's lead has already spent round 1. */
  acted?: boolean;
  /** CONCLUSION: team 1's submitter has saved a complete draft. */
  draftSaved?: boolean;
  /** CONCLUSION and later: team 1 has confirmed its answer. */
  submitted?: boolean;
};

/**
 * Real module state, reached with real commands: the same reducers a socket session uses.
 * Teams are g1 (p1-p3) and g2 (p4-p7) unless `sizes` says otherwise.
 */
export function buildShared(phase: Phase, options: BuildOptions = {}) {
  const sizes = options.sizes ?? [3, 4];
  const config = game.defaultConfig;
  const rng = createRng(3);
  let next = 1;
  const groups = sizes.map((size, g) => ({
    groupId: `g${g + 1}`,
    playerIds: Array.from({ length: size }, () => `p${next++}`),
    round: 1,
  }));
  const roster: RosterEntry[] = groups.flatMap((g) =>
    g.playerIds.map((playerId) => ({ playerId, groupId: g.groupId, connected: true })),
  );
  let shared = game.prepareShared!({ config, groups, rng, now: NOW });
  const send = (actor: Viewer, type: string, payload: Record<string, unknown> = {}) => {
    const result = game.onSharedAction!({
      config,
      shared,
      roster,
      rng,
      now: NOW,
      actor,
      action: {
        type,
        payload: {
          caseInstanceId: shared.caseInstanceId,
          caseNumber: shared.caseNumber,
          phaseVersion: shared.phaseVersion,
          ...payload,
        },
      },
    });
    if (!result) throw new Error(`fixture command ${type} was rejected`);
    shared = result;
  };
  const host = (type: string, payload?: Record<string, unknown>) =>
    send({ kind: "host" }, type, payload);
  const upTo: Phase[] = [
    "READY",
    "INTRO",
    "BRIEFING",
    "SHARING",
    "INVESTIGATION",
    "CONCLUSION",
    "AWAITING_REVEAL",
    "REVEALED",
  ];
  const reach = upTo.indexOf(phase);
  if (reach >= 1) host("mm:start");
  for (let i = 2; i <= Math.min(reach, 4); i++) host("mm:next");

  const logic = shared.caseData.logic;
  const firstOffered = (team: MurderShared["teams"][number]) => {
    const used = team.history.map((h) => h.actionId);
    const known = Object.keys(team.owners);
    return logic.actions.find(
      (a) =>
        !used.includes(a.id) &&
        a.requiredActionIds.every((id) => used.includes(id)) &&
        a.requiredCardIds.every((id) => known.includes(id)),
    )!.id;
  };
  const playRound = (round: number) => {
    for (const team of shared.teams) {
      send({ kind: "player", playerId: team.leadOrder[round - 1]! }, "mm:investigate", {
        round,
        actionId: firstOffered(team),
      });
    }
  };
  if (reach === 4 && options.acted) playRound(1);
  if (reach >= 5) {
    for (let round = 1; round <= 4; round++) {
      playRound(round);
      host("mm:next");
    }
    if (options.draftSaved || options.submitted) {
      const team = shared.teams[0]!;
      const cards = Object.keys(team.owners);
      const { answer } = shared.caseData.reveal;
      const conclusion = {
        ...answer,
        evidence: { suspectId: [cards[0]!], weaponId: [cards[1]!], roomId: [cards[2]!] },
      };
      const submitter = { kind: "player" as const, playerId: team.leadOrder[3]! };
      send(submitter, "mm:saveDraft", { draftVersion: 0, conclusion });
      if (options.submitted) send(submitter, "mm:submit", { draftVersion: 1 });
    }
  }
  if (reach >= 6) host("mm:next");
  if (reach >= 7) host("mm:reveal");
  return { shared, config, roster, groups };
}

export function project(shared: MurderShared, viewer: Viewer, groupId: string | null): MurderView {
  return game.sharedViewFor!({
    config: game.defaultConfig,
    shared,
    viewer,
    viewerGroupId: groupId,
  }) as MurderView;
}

export function lobbyFor(
  viewer: Viewer,
  view: MurderView,
  groups: { groupId: string; playerIds: string[] }[],
): LobbyView {
  const all = groups.flatMap((g) => g.playerIds.map((id) => ({ id, groupId: g.groupId })));
  const own = viewer.kind === "player" ? viewer.playerId : null;
  const mine = all.find((p) => p.id === own);
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
    players: all.map((p, i) => ({
      id: p.id,
      name: NAMES[i] ?? p.id,
      groupId: p.groupId,
      connected: true,
      away: false,
    })),
    groups: groups.map((g, i) => ({
      id: g.groupId,
      index: i,
      name: TEAM_NAMES[i] ?? g.groupId,
      playerIds: g.playerIds,
    })),
    me: own
      ? {
          playerId: own,
          name: NAMES[all.findIndex((p) => p.id === own)] ?? "Late",
          groupId: mine?.groupId ?? null,
        }
      : null,
    game: {
      gameId: "murder-mystery",
      name: "Murder Mystery",
      stage: "ACTIVE",
      clock: null,
      unsupportedControls: game.unsupportedControls,
      config: viewer.kind === "host" ? game.defaultConfig : null,
      publicInfo: {},
      groups: [],
      shared: view,
    },
  } as LobbyView;
}

/** Props for one viewer of a fixture state, with spy `act`/`hostAct` that accept everything. */
export function propsFor(
  viewer: Viewer,
  phase: Phase,
  options: BuildOptions & { elapsedMs?: number } = {},
) {
  const built = buildShared(phase, options);
  const groupId =
    viewer.kind === "player"
      ? (built.roster.find((r) => r.playerId === viewer.playerId)?.groupId ?? null)
      : null;
  const view = project(built.shared, viewer, groupId);
  const lobby = lobbyFor(viewer, view, built.groups);
  const now = NOW + (options.elapsedMs ?? 0);
  return {
    lobby,
    session: lobby.game!,
    serverNow: () => now,
    act: vi.fn(async (_action: GameAction) => true),
    hostAct: vi.fn(async (_action: GameAction) => true),
    view,
    shared: built.shared,
    me: lobby.me ?? { playerId: "late", name: "Late", groupId: null },
  };
}

/** The player who leads round `round` of a team. */
export const leadOf = (shared: MurderShared, groupId: string, round: number) =>
  shared.teams.find((t) => t.groupId === groupId)!.leadOrder[round - 1]!;

/** The player who submits the final answer for a team. */
export const submitterOf = (shared: MurderShared, groupId: string) =>
  shared.teams.find((t) => t.groupId === groupId)!.leadOrder[3]!;

export const player = (id: string): Viewer => ({ kind: "player", playerId: id });
