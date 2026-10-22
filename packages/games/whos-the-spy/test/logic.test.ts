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
