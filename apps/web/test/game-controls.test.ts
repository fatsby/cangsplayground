import { describe, expect, it } from "vitest";
import type { GameSessionView, GroupGameView } from "@cangsplayground/core";
import { freeTalk } from "@cangsplayground/game-free-talk";
import { secretWord } from "@cangsplayground/game-secret-word";
import { canControl, mainControl, supportsControl } from "../src/components/game-controls";
const group = (phase: GroupGameView["phase"]): GroupGameView => ({
  groupId: "g1",
  eliminated: [],
  phase,
  round: 1,
  currentSpeakerId: "p1",
  nextSpeakerId: "p2",
  turnOrder: ["p1", "p2"],
  turnIndex: 0,
  turnCount: 2,
  timer: { endsAt: null, pausedRemainingMs: null, durationMs: 60000 },
  revealed: false,
  data: null,
});
const session = (...phases: GroupGameView["phase"][]): GameSessionView => ({
  clock: null,
  gameId: "free-talk",
  name: "Free Talk",
  stage: "ACTIVE",
  config: null,
  publicInfo: null,
  unsupportedControls: freeTalk.unsupportedControls,
  groups: phases.map(group),
});
describe("host lifecycle availability", () => {
  it("only offers controls accepted by the current phase", () => {
    expect(canControl("start", session("PREPARED"))).toBe(true);
    expect(canControl("pause", session("PREPARED"))).toBe(false);
    expect(canControl("extend", session("PAUSED"))).toBe(true);
    expect(canControl("skip", session("ROUND_END"))).toBe(false);
    expect(canControl("nextRound", session("ROUND_END"))).toBe(true);
    expect(canControl("reveal", session("ROUND_END"))).toBe(false);
  });
  it("enables all-group commands if any group can accept them, with per-group checks", () => {
    const mixed = session("RUNNING", "PAUSED");
    expect(canControl("pause", mixed)).toBe(true);
    expect(canControl("resume", mixed)).toBe(true);
    expect(canControl("pause", mixed, mixed.groups[1])).toBe(false);
    expect(mainControl(mixed)).toEqual({ cmd: "pause", label: "Pause" });
    expect(mainControl(mixed, mixed.groups[1])).toEqual({ cmd: "resume", label: "Resume" });
  });
  it("offers Prepare while configuring and Next round at the end", () => {
    expect(mainControl({ ...session(), stage: "CONFIGURING" }).cmd).toBe("prepare");
    expect(mainControl(session("ROUND_END")).cmd).toBe("nextRound");
  });
  it("filters unsupported controls without hiding supported controls in other phases", () => {
    const free = session("RUNNING");
    const secret = {
      ...free,
      clock: null,
      gameId: secretWord.id,
      unsupportedControls: secretWord.unsupportedControls,
    };
    expect(supportsControl("reveal", free)).toBe(false);
    expect(supportsControl("reveal", secret)).toBe(true);
    expect(canControl("reveal", secret)).toBe(false);
    expect(canControl("reveal", { ...secret, groups: [group("ROUND_END")] })).toBe(true);
    for (const cmd of ["skip", "extend", "endRound", "nextRound", "pause", "resume"] as const) {
      expect(supportsControl(cmd, free)).toBe(true);
      expect(supportsControl(cmd, secret)).toBe(true);
    }
  });
  it("uses module capabilities rather than game ids, including for the main control", () => {
    const game = {
      ...session("RUNNING"),
      clock: null,
      gameId: "another-game",
      unsupportedControls: ["pause"] as const,
    };
    expect(canControl("pause", game)).toBe(false);
    expect(mainControl(game).cmd).toBe("start");
    expect(mainControl({ ...game, groups: [group("PAUSED")] }).cmd).toBe("resume");
  });
  it("keeps existing controls when capability metadata is absent", () => {
    const game = { ...session("ROUND_END"), unsupportedControls: undefined };
    expect(supportsControl("reveal", game)).toBe(true);
    expect(canControl("reveal", game)).toBe(true);
  });
});

it("handles VOTING and FINISHED", () => {
  const voting = {
    ...session("VOTING"),
    groups: [
      { ...group("VOTING"), timer: { endsAt: 1, pausedRemainingMs: null, durationMs: 30_000 } },
    ],
  };
  expect(canControl("pause", voting)).toBe(true);
  expect(canControl("resume", voting)).toBe(false);
  expect(canControl("skip", voting)).toBe(true);
  expect(canControl("endRound", voting)).toBe(false);
  const pausedVote = {
    ...voting,
    groups: [
      { ...group("VOTING"), timer: { endsAt: null, pausedRemainingMs: 9000, durationMs: 30_000 } },
    ],
  };
  expect(canControl("resume", pausedVote)).toBe(true);
  expect(mainControl(pausedVote).cmd).toBe("resume");
  for (const cmd of [
    "start",
    "pause",
    "resume",
    "skip",
    "extend",
    "endRound",
    "reveal",
    "nextRound",
  ] as const)
    expect(canControl(cmd, session("FINISHED"))).toBe(false);
});
it("only offers Vote now while speaking", () => {
  expect(canControl("endRound", { ...session("PREPARED"), voteDurationMs: 30_000 })).toBe(false);
});
it("offers whole-class clock controls independently of group phases", () => {
  const waiting = {
    ...session("ROUND_END"),
    clock: {
      done: false,
      timer: { endsAt: 120_000, pausedRemainingMs: null, durationMs: 120_000 },
    },
  };
  expect(canControl("pause", waiting)).toBe(true);
  expect(canControl("pause", waiting, waiting.groups[0])).toBe(false);
  const paused = {
    ...waiting,
    clock: {
      done: false,
      timer: { endsAt: null, pausedRemainingMs: 120_000, durationMs: 120_000 },
    },
  };
  expect(canControl("resume", paused)).toBe(true);
  expect(mainControl(paused).cmd).toBe("resume");
  expect(canControl("resume", paused, paused.groups[0])).toBe(false);
});
