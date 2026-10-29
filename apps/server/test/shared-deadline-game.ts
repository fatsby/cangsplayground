import { z } from "zod";
import type { GameModule } from "@cangsplayground/core";
import { Lobby } from "../src/lobby/Lobby.js";
import { registry } from "../src/games/registry.js";
import { TimerService } from "../src/timer/TimerService.js";

interface TestMatch {
  id: string;
  phase: "READY" | "VOTE" | "PLAY";
  endsAt: number | null;
  remaining: number | null;
}
export interface DeadlineState {
  matches: TestMatch[];
  expiredKeys: string[];
}
const VOTE_MS: Record<string, number> = { "match-a": 30_000, "match-b": 45_000 };

/** Two independent timed matches; each vote expiry starts a 60 s play deadline. */
export const deadlineGame: GameModule<Record<string, never>, null, DeadlineState> = {
  id: "test-deadlines",
  name: "Test deadlines",
  description: "",
  minPlayersPerGroup: 1,
  recommended: "",
  configSchema: z.object({}),
  defaultConfig: {},
  configFields: [],
  turnDurationMs: () => null,
  prepare: () => null,
  prepareShared: () => ({
    matches: ["match-a", "match-b"].map((id) => ({
      id,
      phase: "READY" as const,
      endsAt: null,
      remaining: null,
    })),
    expiredKeys: [],
  }),
  onSharedAction: ({ shared, action, now }) => {
    const next = structuredClone(shared);
    if (action.type === "start") {
      if (next.matches.some((m) => m.phase !== "READY")) return null;
      for (const m of next.matches) {
        m.phase = "VOTE";
        m.endsAt = now + VOTE_MS[m.id]!;
      }
    } else if (action.type === "pause") {
      for (const m of next.matches)
        if (m.endsAt !== null) {
          m.remaining = m.endsAt - now;
          m.endsAt = null;
        }
    } else if (action.type === "resume") {
      for (const m of next.matches)
        if (m.remaining !== null) {
          m.endsAt = now + m.remaining;
          m.remaining = null;
        }
    } else if (action.type === "noop") return shared;
    else return null;
    return next;
  },
  sharedDeadlines: ({ shared }) =>
    shared.matches.flatMap((m) =>
      m.endsAt === null ? [] : [{ key: `${m.id}:${m.phase.toLowerCase()}`, endsAt: m.endsAt }],
    ),
  onSharedDeadline: ({ shared, deadline, now }) => {
    const next = structuredClone(shared);
    const match = next.matches.find((m) => deadline.key.startsWith(`${m.id}:`));
    if (!match) return null;
    next.expiredKeys.push(deadline.key);
    if (match.phase === "VOTE") {
      match.phase = "PLAY";
      match.endsAt = now + 60_000;
    } else match.endsAt = null;
    return next;
  },
  onSharedPlayerLeft: ({ shared }) => shared,
  onSharedRosterChange: ({ shared }) => shared,
  sharedViewFor: ({ shared }) => shared,
  publicInfo: () => ({}),
  viewFor: () => null,
};

export function testState(lobby: Lobby): DeadlineState {
  return lobby.game!.shared as DeadlineState;
}

export function setupDeadlines() {
  if (!registry.has(deadlineGame.id)) registry.set(deadlineGame.id, deadlineGame);
  const timers = new TimerService(() => Date.now());
  const lobby = new Lobby({
    code: "DLN234",
    hostToken: "host-secret-token",
    seed: 1,
    now: () => Date.now(),
  });
  lobby.onChange = () => timers.reconcile(lobby);
  const players = Array.from({ length: 4 }, (_, i) => lobby.join(`P${i}`));
  for (const [i, p] of players.entries()) p.sockets.add(`s${i}`);
  lobby.selectGame(deadlineGame.id);
  lobby.assign("count", 2);
  lobby.control("prepare");
  return { lobby, timers, players };
}
