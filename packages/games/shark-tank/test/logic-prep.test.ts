import { createRng, type GroupSummary } from "@cangsplayground/core";
import { describe, expect, it } from "vitest";
import sharkTank, { ACTIONS } from "../src/index.js";
import { ideas } from "../src/ideas.js";
import { PART_FRAMES, blankCount } from "../src/phrases.js";
import { assignParts } from "../src/rules.js";
import type { PartId, Stage } from "../src/types.js";
import { start } from "./helpers.js";

const group = (n: number, id = "g1"): GroupSummary => ({
  id,
  index: 0,
  name: "Team Red",
  playerIds: Array.from({ length: n }, (_, i) => `${id}p${i + 1}`),
});
const next = (h: ReturnType<typeof start>) =>
  h.act("host", "st:next", { from: h.shared.stage, presenterIndex: h.shared.presenterIndex });

describe("Shark Tank preparation", () => {
  it("prepareShared deals distinct ideas, parts and wallets", () => {
    const { shared } = start([4, 3]);
    expect(shared.stage).toBe("PREP");
    expect(new Set(shared.companies.map((c) => c.ideaId)).size).toBe(2);
    expect(shared.timer).toEqual({ durationMs: 900_000, endsAt: 901_000, pausedRemainingMs: null });
    for (const [index, size] of [4, 3].entries()) {
      const company = shared.companies[index]!;
      expect(company).toMatchObject({
        groupId: `g${index + 1}`,
        prepStep: 1,
        price: null,
        wallet: size * 100,
        startWallet: size * 100,
        startMembers: size,
        rerolled: false,
        rerollLocked: false,
        discounted: false,
        help: false,
        scripts: {},
        formerMembers: [],
      });
      expect(company.parts).toEqual(assignParts(company.members));
      expect(ideas().some((idea) => idea.id === company.ideaId)).toBe(true);
    }
    expect(shared).toMatchObject({
      presented: [],
      purchases: [],
      votes: {},
      locked: [],
      asked: {},
      announcers: {},
      closing: null,
      left: [],
    });
  });
  it("uses configured preparation time and member money", () => {
    const h = start([2, 5], { prepMinutes: 5, moneyPerMember: 50 });
    expect(h.shared.timer.endsAt).toBe(301000);
    expect(h.shared.companies.map((c) => c.startWallet)).toEqual([100, 250]);
    expect(start([4, 3]).shared).toEqual(start([4, 3]).shared);
  });
  it("rerolls once to an unused idea without changing other companies", () => {
    const h = start([4, 3]);
    const before = structuredClone(h.shared);
    expect(h.act("g1p2", "st:reroll")).not.toBeNull();
    expect(h.shared.companies[0]!.ideaId).not.toBe(before.companies[0]!.ideaId);
    expect(h.shared.companies[0]!.ideaId).not.toBe(h.shared.companies[1]!.ideaId);
    expect(h.shared.companies[0]!.rerolled).toBe(true);
    expect(h.shared.companies[1]).toEqual(before.companies[1]);
    expect(before.companies[0]!.rerolled).toBe(false);
    expect(h.act("g1p1", "st:reroll")).toBeNull();
  });
  it("rejects a reroll defensively if every idea is already in use", () => {
    const h = start(Array.from({ length: ideas().length }, () => 2));
    expect(h.act("g1p1", "st:reroll")).toBeNull();
    expect(h.shared.companies[0]!.rerolled).toBe(false);
  });
  it("never rerolls after moving past step 1, even after returning to it", () => {
    const h = start([3, 3]);
    expect(h.act("g1p1", "st:step", { step: 2 })).not.toBeNull();
    expect(h.shared.companies[0]!.prepStep).toBe(2);
    expect(h.act("g1p2", "st:step", { step: 1 })).not.toBeNull();
    expect(h.shared.companies[0]!.rerollLocked).toBe(true);
    expect(h.act("g1p3", "st:reroll")).toBeNull();
    for (const step of [0, 5, 1.5, "2", null])
      expect(h.act("g1p1", "st:step", { step })).toBeNull();
  });
  it("price must be within range and an integer, and any current member can update it", () => {
    const h = start([3, 3]);
    for (const price of [9, 61, 12.5, "35", null])
      expect(h.act("g1p1", "st:price", { price })).toBeNull();
    expect(h.act("g1p1", "st:price", { price: 35 })).not.toBeNull();
    expect(h.act("g1p2", "st:price", { price: 60 })).not.toBeNull();
    expect(h.shared.companies[0]!.price).toBe(60);
    expect(h.shared.companies[1]!.price).toBeNull();
  });
  it("scripts require an owned part, the right blank count and trimmed blanks up to 80 characters", () => {
    const h = start([4, 3]);
    const part: PartId = h.shared.companies[0]!.parts.g1p1![0]!;
    const blanks = Array.from(
      { length: blankCount(PART_FRAMES[part]) },
      () => "  a small problem  ",
    );
    expect(h.act("g1p1", "st:script", { part, blanks })).not.toBeNull();
    expect(h.shared.companies[0]!.scripts[part]).toEqual(blanks.map((v) => v.trim()));
    expect(h.act("g1p2", "st:script", { part, blanks })).toBeNull();
    for (const bad of [[], ["x".repeat(81)], [12], "hello"])
      expect(h.act("g1p1", "st:script", { part, blanks: bad })).toBeNull();
    expect(h.act("g1p1", "st:script", { part: "invalid", blanks })).toBeNull();
    expect(
      h.act("g1p1", "st:script", { part, blanks: [" ".repeat(10) + "x".repeat(80) + " "] }),
    ).not.toBeNull();
  });
  it("accepts exactly two blanks for the product part", () => {
    const h = start([4, 3]);
    expect(h.act("g1p2", "st:script", { part: "product", blanks: ["an umbrella"] })).toBeNull();
    expect(
      h.act("g1p2", "st:script", { part: "product", blanks: ["an umbrella", "keep cats dry"] }),
    ).not.toBeNull();
    expect(h.shared.companies[0]!.scripts.product).toEqual(["an umbrella", "keep cats dry"]);
  });
  it("only current members can set their own help, and only the host can clear it", () => {
    const h = start([3, 3]);
    expect(h.act("g1p1", "st:help", { on: true })).not.toBeNull();
    expect(h.shared.companies[0]!.help).toBe(true);
    expect(h.shared.companies[1]!.help).toBe(false);
    expect(h.act("g2p1", "st:clearHelp", { groupId: "g1" })).toBeNull();
    expect(h.act("host", "st:clearHelp", { groupId: "missing" })).toBeNull();
    expect(h.act("host", "st:clearHelp", { groupId: "g1" })).not.toBeNull();
    expect(h.shared.companies[0]!.help).toBe(false);
    next(h);
    expect(h.act("g1p1", "st:help", { on: true })).not.toBeNull();
    expect(h.act("g1p1", "st:help", { on: false })).not.toBeNull();
    expect(h.act("host", "st:help", { on: true })).toBeNull();
    expect(h.act("outsider", "st:help", { on: true })).toBeNull();
  });
  it("player preparation actions reject other stages, hosts and unknown players", () => {
    const h = start([3, 3]);
    for (const actor of ["host", "outsider"])
      for (const [type, payload] of [
        ["st:reroll", undefined],
        ["st:step", { step: 2 }],
        ["st:price", { price: 35 }],
        ["st:script", { part: "problem", blanks: ["test"] }],
      ] as const)
        expect(h.act(actor, type, payload)).toBeNull();
    next(h);
    for (const type of ["st:reroll", "st:step", "st:price", "st:script"])
      expect(
        h.act("g1p1", type, { step: 2, price: 35, part: "problem", blanks: ["test"] }),
      ).toBeNull();
  });
  it("rejects unknown actions, projector actors and malformed payloads without changing state", () => {
    const h = start([3, 3]);
    const before = structuredClone(h.shared);
    for (const type of ["missing", "toString", "__proto__"]) expect(h.act("host", type)).toBeNull();
    for (const type of ["st:step", "st:price", "st:script", "st:help", "st:clearHelp", "st:next"])
      for (const payload of [undefined, null, 1, "wrong", {}])
        expect(h.act("g1p1", type, payload)).toBeNull();
    for (const type of ["st:reroll", "st:pause", "st:resume", "st:extend"])
      expect(h.act(type === "st:reroll" ? "g1p1" : "host", type, {})).toBeNull();
    expect(
      sharkTank.onSharedAction!({
        config: sharkTank.defaultConfig,
        shared: h.shared,
        roster: [],
        now: 1000,
        rng: createRng(1),
        actor: { kind: "projector" },
        action: { type: "st:next", payload: { from: "PREP", presenterIndex: 0 } },
      }),
    ).toBeNull();
    expect(h.shared).toEqual(before);
  });
  it("pause, resume and extend move the stage timer without advancing it", () => {
    const h = start([3, 3]);
    h.tick(10000);
    expect(h.act("host", "st:pause")).not.toBeNull();
    expect(h.shared.timer).toEqual({ durationMs: 900000, endsAt: null, pausedRemainingMs: 890000 });
    expect(h.act("host", "st:pause")).toBeNull();
    expect(h.act("host", "st:extend")).not.toBeNull();
    expect(h.shared.timer).toEqual({ durationMs: 930000, endsAt: null, pausedRemainingMs: 920000 });
    h.tick(5000);
    expect(h.act("host", "st:resume")).not.toBeNull();
    expect(h.shared.timer.endsAt).toBe(936000);
    expect(h.act("host", "st:resume")).toBeNull();
    expect(h.act("host", "st:extend")).not.toBeNull();
    expect(h.shared.timer).toEqual({ durationMs: 960000, endsAt: 966000, pausedRemainingMs: null });
    expect(h.shared.stage).toBe("PREP");
  });
  it("extending an expired running timer gives 30 seconds from now", () => {
    const h = start([3, 3]);
    h.tick(901000);
    expect(h.shared.stage).toBe("PREP");
    h.act("host", "st:extend");
    expect(h.shared.timer).toEqual({ durationMs: 930000, endsAt: 932000, pausedRemainingMs: null });
  });
  it("rejects player timer controls and timer controls in untimed stages", () => {
    const h = start([3, 3]);
    for (const type of ["st:pause", "st:resume", "st:extend", "st:next"])
      expect(h.act("g1p1", type)).toBeNull();
    for (const stage of ["DECISION", "RESULTS", "CLOSING"] as Stage[]) {
      h.shared.stage = stage;
      for (const type of ["st:pause", "st:resume", "st:extend"])
        expect(h.act("host", type)).toBeNull();
    }
  });
  it("next fills missing prices with the rounded midpoint and starts PITCH in a random group order", () => {
    const h = start([4, 3, 2], { minPrice: 10, maxPrice: 61, pitchSeconds: 45 });
    h.act("g1p1", "st:price", { price: 20 });
    h.tick(5000);
    expect(next(h)).not.toBeNull();
    expect(h.shared).toMatchObject({
      stage: "PITCH",
      presenterIndex: 0,
      presented: [],
      votes: {},
      locked: [],
      announcers: {},
    });
    expect([...h.shared.order].sort()).toEqual(["g1", "g2", "g3"]);
    expect(h.shared.companies.map((c) => c.price)).toEqual([20, 36, 36]);
    expect(h.shared.timer).toEqual({ durationMs: 45000, endsAt: 51000, pausedRemainingMs: null });
    expect(h.shared.asked[h.shared.order[0]!]).toEqual([]);
  });
  it("st:next rejects a stale stage or presenter index, so a repeated press cannot skip Q&A", () => {
    const h = start([3, 3]);
    expect(h.act("host", "st:next", { from: "PREP", presenterIndex: 1 })).toBeNull();
    expect(h.act("host", "st:next", { from: "PITCH", presenterIndex: 0 })).toBeNull();
    const command = { from: "PREP", presenterIndex: 0 };
    expect(h.act("host", "st:next", command)).not.toBeNull();
    const before = structuredClone(h.shared);
    expect(h.act("host", "st:next", command)).toBeNull();
    expect(h.shared).toEqual(before);
  });
  it("next omits empty companies from presenting order", () => {
    const h = start([3, 3]);
    h.shared.companies[0]!.members = [];
    next(h);
    expect(h.shared.order).toEqual(["g2"]);
  });
  it("validates group sizes and the minimum number of groups", () => {
    const config = sharkTank.defaultConfig;
    expect(sharkTank.validateGroup!({ config, group: group(6) })).toBe(
      "Shark Tank needs 2–5 players in each group.",
    );
    expect(sharkTank.validateGroup!({ config, group: group(5) })).toBeNull();
    expect(sharkTank.validateGroups!({ config, groups: [group(3)] })).toBe(
      "Shark Tank needs 2–12 groups.",
    );
    expect(
      sharkTank.validateGroups!({
        config,
        groups: Array.from({ length: 13 }, (_, i) => group(2, `g${i}`)),
      }),
    ).toBe("Shark Tank needs 2–12 groups.");
    expect(
      sharkTank.validateGroups!({
        config,
        groups: Array.from({ length: 12 }, (_, i) => group(2, `g${i}`)),
      }),
    ).toBeNull();
    expect(sharkTank.validateGroups!({ config, groups: [group(3), group(3, "g2")] })).toBeNull();
  });
  it("declares its module metadata and every host-editable config field", () => {
    expect(sharkTank).toMatchObject({
      id: "shark-tank",
      name: "Shark Tank",
      minPlayersPerGroup: 2,
      maxPlayersPerGroup: 5,
      recommended: "3–4 per group",
    });
    expect(sharkTank.turnDurationMs(sharkTank.defaultConfig)).toBeNull();
    expect(sharkTank.publicInfo(sharkTank.defaultConfig)).toEqual({});
    expect(sharkTank.unsupportedControls).toEqual([
      "pause",
      "resume",
      "skip",
      "extend",
      "endRound",
      "reveal",
      "nextRound",
    ]);
    const expected = [
      ["prepMinutes", 5, 40, 1],
      ["pitchSeconds", 30, 600, 15],
      ["qaSeconds", 30, 900, 15],
      ["huddleSeconds", 30, 300, 15],
      ["moneyPerMember", 10, 1000, 10],
      ["minPrice", 1, 1000, 5],
      ["maxPrice", 1, 1000, 5],
      ["minSpendPercent", 0, 100, 10],
      ["noQuestionPenalty", 0, 500, 5],
    ];
    expect(sharkTank.configFields.map((f) => [f.key, f.min, f.max, f.step])).toEqual(expected);
    expect(sharkTank.configFields.every((f) => f.kind === "number" && f.label.length > 0)).toBe(
      true,
    );
    expect(Object.keys(ACTIONS)).toEqual(
      expect.arrayContaining([
        "st:reroll",
        "st:step",
        "st:price",
        "st:script",
        "st:help",
        "st:clearHelp",
        "st:pause",
        "st:resume",
        "st:extend",
        "st:next",
      ]),
    );
  });
});
