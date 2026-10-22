import { createRng, type GroupRuntime, type Viewer } from "@cangsplayground/core";
import { describe, expect, it } from "vitest";
import {
  whosTheSpy,
  topicsFor,
  topicById,
  type WhosTheSpyData,
  type WhosTheSpyGroupView,
} from "../src/index.js";
const config = { ...whosTheSpy.defaultConfig, locationTopic: "airport" };
const players = ["a", "b", "c", "d"];
function runtime(
  data: Partial<WhosTheSpyData> = {},
  options: Partial<GroupRuntime<WhosTheSpyData>> = {},
): GroupRuntime<WhosTheSpyData> {
  return {
    groupId: "g1",
    phase: "RUNNING",
    round: 1,
    eliminated: [],
    turnOrder: [...players, ...players],
    turnIndex: 0,
    timer: { endsAt: 30_000, pausedRemainingMs: null, durationMs: 30_000 },
    revealed: false,
    ...options,
    data: {
      topicId: "airport",
      spies: ["b"],
      votes: {},
      voteNumber: 0,
      lastVote: null,
      result: null,
      ...data,
    },
  };
}
function view(
  state: GroupRuntime<WhosTheSpyData>,
  viewer: Viewer,
  isMember = viewer.kind === "player",
): WhosTheSpyGroupView {
  return whosTheSpy.viewFor({ config, state, viewer, isMember }) as WhosTheSpyGroupView;
}
describe("Who's the Spy", () => {
  it("ships 16–20 topics per category, 4 hints each, unique ids", () => {
    for (const c of ["location", "food"] as const) {
      expect(topicsFor(c).length).toBeGreaterThanOrEqual(16);
      expect(topicsFor(c).length).toBeLessThanOrEqual(20);
      for (const t of topicsFor(c)) {
        expect(t.hints).toHaveLength(4);
        expect(topicById(t.id)).toEqual({ ...t, category: c });
      }
    }
    const ids = [...topicsFor("location"), ...topicsFor("food")].map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("defaults and rejects unknown topics", () => {
    expect(whosTheSpy.defaultConfig).toEqual({
      category: "location",
      locationTopic: "random",
      foodTopic: "random",
      spies: 1,
      gameMinutes: 12,
      turnSeconds: 60,
    });
    expect(whosTheSpy.configSchema.safeParse({ ...config, foodTopic: "airport" }).success).toBe(
      false,
    );
    expect(whosTheSpy.configSchema.safeParse({ ...config, locationTopic: "unknown" }).success).toBe(
      false,
    );
  });
  it("resolveConfig picks one topic of the active category only when random", () => {
    const c = whosTheSpy.resolveConfig!({
      config: { ...whosTheSpy.defaultConfig, category: "food" },
      rng: createRng(3),
    });
    expect(topicsFor("food").map((t) => t.id)).toContain(c.foodTopic);
    expect(c.locationTopic).toBe("random");
    expect(whosTheSpy.resolveConfig!({ config, rng: createRng(3) })).toEqual(config);
  });
  it("validateGroup enforces spies < others", () => {
    const group = (n: number) => ({
      id: "g1",
      index: 0,
      name: "Team Red",
      playerIds: Array.from({ length: n }, (_, i) => `p${i}`),
    });
    expect(whosTheSpy.validateGroup!({ config: { ...config, spies: 2 }, group: group(4) })).toBe(
      "Team Red has 4 players. 2 spies need at least 5.",
    );
    expect(
      whosTheSpy.validateGroup!({ config: { ...config, spies: 2 }, group: group(5) }),
    ).toBeNull();
    expect(whosTheSpy.validateGroup!({ config, group: group(3) })).toBeNull();
  });
  it("prepare deals exactly spies distinct spies from the group", () => {
    const members = ["a", "b", "c", "d", "e", "f"];
    const dealt = whosTheSpy.prepare({
      config: { ...config, spies: 2 },
      group: { groupId: "g1", playerIds: members, round: 1 },
      rng: createRng(7),
    });
    expect(dealt.spies).toHaveLength(2);
    expect(new Set(dealt.spies).size).toBe(2);
    expect(dealt.spies.every((id) => members.includes(id))).toBe(true);
    expect(dealt).toMatchObject({
      topicId: "airport",
      votes: {},
      voteNumber: 0,
      lastVote: null,
      result: null,
    });
    expect(whosTheSpy.turnsPerPlayer!(config)).toBe(2);
    expect(whosTheSpy.voteDurationMs!(config)).toBe(30000);
    expect(whosTheSpy.gameDurationMs!(config)).toBe(720000);
  });
  it("viewFor: civilian sees topic+hints, spy sees only category, projector sees neither", () => {
    const state = runtime({
      votes: { a: "b" },
      lastVote: { out: "c", wasSpy: false, tally: { c: 2 } },
    });
    expect(view(state, { kind: "player", playerId: "a" })).toMatchObject({
      role: "civilian",
      topic: { name: "Airport" },
      spies: null,
      votes: null,
      myVote: "b",
      voted: ["a"],
    });
    const spy = view(state, { kind: "player", playerId: "b" });
    expect(spy).toMatchObject({ role: "spy", topic: null, spies: null });
    expect(JSON.stringify(spy)).not.toMatch(/Airport|passport/);
    for (const viewer of [
      { kind: "projector" },
      { kind: "player", playerId: "outsider" },
    ] as Viewer[]) {
      const v = view(state, viewer, false);
      expect(v).toMatchObject({
        role: null,
        topic: null,
        spies: null,
        votes: null,
        myVote: null,
        spiesLeft: null,
        lastVote: { out: "c", wasSpy: null, tally: null },
      });
      expect(JSON.stringify(v)).not.toMatch(/Airport|passport/);
    }
    expect(view(state, { kind: "host" })).toMatchObject({
      topic: { name: "Airport" },
      spies: ["b"],
      votes: { a: "b" },
      myVote: null,
      role: null,
    });
  });
  it("viewFor: eliminated member loses the card; result reveals topic+spies to members, never to projector", () => {
    const state = runtime({}, { eliminated: ["a"] });
    expect(view(state, { kind: "player", playerId: "a" })).toMatchObject({
      role: null,
      topic: null,
      spies: null,
      myVote: null,
    });
    state.data.result = { winner: "team", reason: "caught" };
    for (const id of ["a", "b"])
      expect(view(state, { kind: "player", playerId: id })).toMatchObject({
        role: id === "b" ? "spy" : "civilian",
        topic: { name: "Airport" },
        spies: ["b"],
        votes: null,
      });
    expect(view(state, { kind: "projector" })).toMatchObject({
      topic: null,
      spies: null,
      role: null,
      result: { winner: "team", reason: "caught" },
    });
  });
  it("publicInfo never contains the topic", () => {
    expect(whosTheSpy.publicInfo(config)).toEqual({ category: "location", turnSeconds: 60 });
    expect(JSON.stringify(whosTheSpy.publicInfo(config))).not.toMatch(/airport/i);
  });
});

function vote(state: GroupRuntime<WhosTheSpyData>, actor: string, targetId: unknown) {
  return whosTheSpy.onAction!({
    config,
    state,
    actor: { kind: "player", playerId: actor },
    action: { type: "vote", payload: { targetId } },
    rng: createRng(1),
  });
}
it("accepts one locked vote per active player and asks to close when everyone voted", () => {
  const state = runtime({}, { phase: "VOTING", turnOrder: ["a", "b", "c"] });
  const first = vote(state, "a", "b")!;
  expect(first.closeVote).toBe(false);
  state.data = first.data!;
  expect(vote(state, "a", "c")).toBeNull();
  expect(vote(state, "b", "b")).toBeNull();
  expect(vote(state, "d", "a")).toBeNull();
  expect(vote(state, "b", "x")).toBeNull();
  expect(vote(state, "b", 42)).toBeNull();
  state.data = vote(state, "b", "a")!.data!;
  expect(vote(state, "c", "a")!.closeVote).toBe(true);
  expect(view(state, { kind: "player", playerId: "a" }).myVote).toBe("b");
  expect(
    vote(runtime({}, { phase: "VOTING", turnOrder: ["a", "b", "c"], eliminated: ["x"] }), "x", "a"),
  ).toBeNull();
});
it("rejects votes while the vote timer is paused or outside VOTING", () => {
  for (const phase of ["PREPARED", "RUNNING", "PAUSED", "ROUND_END", "FINISHED"] as const)
    expect(vote(runtime({}, { phase }), "a", "b")).toBeNull();
  expect(
    vote(
      runtime(
        {},
        { phase: "VOTING", timer: { endsAt: null, pausedRemainingMs: 9000, durationMs: 30000 } },
      ),
      "a",
      "b",
    ),
  ).toBeNull();
});
it("onVoteEnd: plurality eliminates; tie or no votes eliminates nobody", () => {
  const end = (votes: Record<string, string>) =>
    whosTheSpy.onVoteEnd!({ config, state: runtime({ votes }, { phase: "VOTING" }) });
  const plural = end({ a: "b", c: "b", b: "a" });
  expect(plural.eliminate).toEqual(["b"]);
  expect(plural.data).toMatchObject({
    votes: {},
    voteNumber: 1,
    lastVote: { out: "b", wasSpy: true, tally: { b: 2, a: 1 } },
  });
  expect(end({ a: "b", b: "a" }).data.lastVote!.out).toBeNull();
  expect(end({}).data.lastVote).toEqual({ out: null, wasSpy: false, tally: {} });
  expect(end({ a: "b", c: "b", outsider: "a", b: "gone" }).data.lastVote!.tally).toEqual({ b: 2 });
});
it("team wins when the last spy is voted out; spies win when civilians <= spies", () => {
  const end = (
    votes: Record<string, string>,
    spies: string[] = ["b"],
    turnOrder = ["a", "b", "c"],
  ) =>
    whosTheSpy.onVoteEnd!({
      config,
      state: runtime({ votes, spies }, { phase: "VOTING", turnOrder }),
    });
  expect(end({ a: "b", c: "b", b: "a" })).toMatchObject({
    finished: true,
    data: { result: { winner: "team", reason: "caught" } },
  });
  expect(end({ a: "b", c: "a", b: "a" })).toMatchObject({
    finished: true,
    data: { result: { winner: "spies", reason: "outnumbered" } },
  });
  expect(end({ b: "a", c: "a", d: "a" }, ["b", "d"], ["a", "b", "c", "d", "e"])).toMatchObject({
    finished: true,
    data: { result: { winner: "spies", reason: "outnumbered" } },
  });
});
it("onPlayerLeft drops votes, can finish, can close the vote", () => {
  const left = (state: GroupRuntime<WhosTheSpyData>, playerId: string) =>
    whosTheSpy.onPlayerLeft!({ config, state, playerId });
  expect(left(runtime({}, { turnOrder: ["a", "c"] }), "b")).toMatchObject({
    finished: true,
    data: { result: { winner: "team", reason: "left" } },
  });
  expect(left(runtime({}, { turnOrder: ["b", "c"] }), "a")).toMatchObject({
    finished: true,
    data: { result: { winner: "spies", reason: "outnumbered" } },
  });
  const outcome = left(
    runtime(
      { spies: ["d"], votes: { a: "c", c: "a", b: "d", d: "b" } },
      { phase: "VOTING", turnOrder: ["a", "c", "d"] },
    ),
    "b",
  );
  expect(outcome.data.votes).toEqual({ a: "c", c: "a" });
  expect(outcome.closeVote).toBe(false);
  expect(
    left(
      runtime(
        { spies: ["d"], votes: { a: "c", c: "a", d: "a" } },
        { phase: "VOTING", turnOrder: ["a", "c", "d"] },
      ),
      "b",
    ).closeVote,
  ).toBe(true);
  expect(left(runtime({}, { phase: "VOTING", turnOrder: ["a", "c", "d"] }), "b").closeVote).toBe(
    false,
  );
});
it("onGameTimeUp sets spies/time only when unfinished", () => {
  for (const phase of ["RUNNING", "VOTING", "ROUND_END", "PAUSED", "PREPARED"] as const) {
    const state = runtime({}, { phase });
    expect(whosTheSpy.onGameTimeUp!({ config, state }).result).toEqual({
      winner: "spies",
      reason: "time",
    });
  }
  const state = runtime({ result: { winner: "team", reason: "caught" } });
  expect(whosTheSpy.onGameTimeUp!({ config, state }).result).toEqual(state.data.result);
});
it("onContinue clears votes and lastVote, keeps spies/topic/voteNumber", () => {
  const state = runtime({
    votes: { a: "b" },
    voteNumber: 2,
    lastVote: { out: "a", wasSpy: false, tally: { a: 2 } },
  });
  expect(whosTheSpy.onContinue!({ config, state, rng: createRng(1) })).toEqual({
    ...state.data,
    votes: {},
    lastVote: null,
  });
});
it("a summary member without a dealt role cannot see a role or topic before the result", () => {
  const state = runtime({}, { turnOrder: ["a", "b", "c"], eliminated: [] });
  expect(view(state, { kind: "player", playerId: "d" }, true)).toMatchObject({
    role: null,
    topic: null,
    spies: null,
  });
});
