import { createRng, type RosterEntry, type Viewer } from "@cangsplayground/core";
import { guessTheCharacter as game } from "../src/logic.js";
import {
  configSchema,
  type ControlGuard,
  type GuessConfig,
  type GuessMatch,
  type GuessShared,
  type GuessView,
} from "../src/types.js";

export function groupsOf(sizes: number[]) {
  return sizes.map((size, index) => ({
    groupId: `g${index + 1}`,
    playerIds: Array.from({ length: size }, (_, i) => `g${index + 1}p${i + 1}`),
    round: 1,
  }));
}

/** Deterministic module harness: seed 1, now = 1000, every player connected. */
export function start(sizes: number[], options: Partial<GuessConfig> = {}, seed = 1) {
  const config = configSchema.parse(options);
  const rng = createRng(seed);
  let now = 1000;
  const groups = groupsOf(sizes);
  let roster: RosterEntry[] = groups.flatMap((group) =>
    group.playerIds.map((playerId) => ({ playerId, groupId: group.groupId, connected: true })),
  );
  let shared = game.prepareShared!({ config, groups, rng, now });
  const args = () => ({ config, shared, roster, rng, now });
  const expireDue = () => {
    const due = game.sharedDeadlines!(args())
      .filter((d) => d.endsAt <= now)
      .sort((a, b) => a.endsAt - b.endsAt || a.key.localeCompare(b.key));
    for (const deadline of due) {
      if (!game.sharedDeadlines!(args()).some((d) => d.key === deadline.key)) continue;
      const next = game.onSharedDeadline!({ ...args(), deadline });
      if (next) shared = next;
    }
  };
  return {
    config,
    rng,
    get now() {
      return now;
    },
    get shared() {
      return shared;
    },
    set shared(value: GuessShared) {
      shared = value;
    },
    get roster() {
      return roster;
    },
    match(index = 0): GuessMatch {
      return shared.matches[index]!;
    },
    act(actor: string, type: string, payload?: unknown) {
      expireDue();
      const viewer: Viewer =
        actor === "host" ? { kind: "host" } : { kind: "player", playerId: actor };
      const next = game.onSharedAction!({ ...args(), actor: viewer, action: { type, payload } });
      if (next !== null) shared = next;
      return next;
    },
    tick(ms: number) {
      now += ms;
    },
    expireDue,
    deadlines: () => game.sharedDeadlines!(args()),
    setConnected(playerId: string, connected: boolean) {
      roster = roster.map((r) => (r.playerId === playerId ? { ...r, connected } : r));
      expireDue();
      shared = game.onSharedRosterChange!(args());
    },
    leave(playerId: string) {
      const entry = roster.find((r) => r.playerId === playerId)!;
      roster = roster.filter((r) => r.playerId !== playerId);
      expireDue();
      shared = game.onSharedPlayerLeft!({ ...args(), playerId, groupId: entry.groupId });
    },
    join(playerId: string, groupId: string | null) {
      roster = [...roster, { playerId, groupId, connected: true }];
      shared = game.onSharedRosterChange!(args());
    },
    view(viewer: Viewer, viewerGroupId: string | null = null): GuessView {
      return game.sharedViewFor!({ config, shared, viewer, viewerGroupId }) as GuessView;
    },
  };
}
export type Harness = ReturnType<typeof start>;

export function guard(h: Harness, match: GuessMatch) {
  return { round: h.shared.round, matchId: match.id, phaseVersion: match.phaseVersion };
}
export function controlGuard(h: Harness, match: GuessMatch): ControlGuard {
  return { ...guard(h, match), turnId: match.turnId };
}

/** Start the round, vote and close the vote; returns the harness with every match PLAYING. */
export function playing(sizes: number[], options: Partial<GuessConfig> = {}, seed = 1) {
  const h = start(sizes, options, seed);
  h.act("host", "gc:start", { round: 1 });
  h.tick(h.config.voteSeconds * 1000);
  h.expireDue();
  return h;
}

/** Overwrite a playing match's secrets (test fixture only). */
export function setCharacters(h: Harness, index: number, first: string, second: string) {
  const next = structuredClone(h.shared);
  next.matches[index]!.teams[0].characterId = first;
  next.matches[index]!.teams[1].characterId = second;
  h.shared = next;
}

/** Fixed-order fixture: replace team orders and the first asking side. */
export function setOrder(
  h: Harness,
  index: number,
  orders: [string[], string[]],
  askingTeam: 0 | 1 = 0,
) {
  const next = structuredClone(h.shared);
  const m = next.matches[index]!;
  m.teams[0].members = orders[0];
  m.teams[1].members = orders[1];
  m.teams[0].nextIndex = 0;
  m.teams[1].nextIndex = 0;
  m.askingTeam = askingTeam;
  h.shared = next;
}
