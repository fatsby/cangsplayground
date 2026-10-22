import { describe, expect, it } from "vitest";
import type { GameSessionView, GroupGameView } from "@cangsplayground/core";
import { canControl, mainControl } from "../src/components/game-controls";
const group = (phase: GroupGameView["phase"]): GroupGameView => ({
  groupId: "g1",
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
  gameId: "free-talk",
  name: "Free Talk",
  stage: "ACTIVE",
  config: null,
  publicInfo: null,
  groups: phases.map(group),
});
describe("host lifecycle availability", () => {
  it("only offers controls accepted by the current phase", () => {
    expect(canControl("start", session("PREPARED"))).toBe(true);
    expect(canControl("pause", session("PREPARED"))).toBe(false);
    expect(canControl("extend", session("PAUSED"))).toBe(true);
    expect(canControl("skip", session("ROUND_END"))).toBe(false);
    expect(canControl("nextRound", session("ROUND_END"))).toBe(true);
    expect(canControl("reveal", session("ROUND_END"))).toBe(true);
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
});
