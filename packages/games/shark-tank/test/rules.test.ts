import { describe, expect, it } from "vitest";
import {
  assignParts,
  reassignParts,
  maxQuantity,
  medianFloor,
  minSpendTarget,
  minSpendLeft,
  spent,
  computeResults,
} from "../src/rules.js";
import { configSchema, type Company, type PartId, type SharkTankShared } from "../src/types.js";

const config = configSchema.parse({});
const awardsConfig = { ...config, minSpendPercent: 0, noQuestionPenalty: 0 };

function company(groupId: string, price = 20): Company {
  return {
    groupId,
    ideaId: "cat-umbrella",
    prepStep: 4,
    prepSteps: {},
    rerolled: false,
    rerollLocked: true,
    ideaLockVotes: [],
    price,
    discounted: false,
    members: [1, 2, 3, 4].map((i) => `${groupId}p${i}`),
    formerMembers: [],
    startMembers: 4,
    startWallet: 400,
    parts: {},
    scripts: {},
    wallet: 400,
    help: false,
  };
}

function shared(companies: Company[], extra: Partial<SharkTankShared> = {}): SharkTankShared {
  return {
    stage: "RESULTS",
    timer: { endsAt: null, pausedRemainingMs: null, durationMs: 0 },
    order: companies.map((c) => c.groupId),
    presenterIndex: 0,
    presented: companies.map((c) => c.groupId),
    companies,
    asked: {},
    votes: {},
    locked: [],
    purchases: [],
    announcers: {},
    closing: null,
    left: [],
    ...extra,
  };
}

describe("speaking parts", () => {
  it("assigns two parts each to two members", () => {
    expect(assignParts(["a", "b"])).toEqual({ a: ["problem", "product"], b: ["price", "ask"] });
  });
  it("keeps price and ask together for the third member", () => {
    expect(assignParts(["a", "b", "c"])).toEqual({
      a: ["problem"],
      b: ["product"],
      c: ["price", "ask"],
    });
  });
  it("assigns one part each to four members without story", () => {
    expect(assignParts(["a", "b", "c", "d"])).toEqual({
      a: ["problem"],
      b: ["product"],
      c: ["price"],
      d: ["ask"],
    });
  });
  it("includes story only for five members, preserving member order", () => {
    expect(assignParts(["a", "b", "c", "d", "e"])).toEqual({
      a: ["problem"],
      b: ["product"],
      c: ["story"],
      d: ["price"],
      e: ["ask"],
    });
  });
  it("reassigns to the member with fewest parts and sorts by part order without mutation", () => {
    const parts: Record<string, PartId[]> = { a: ["problem"], b: ["product"], c: ["price", "ask"] };
    const before = structuredClone(parts);
    expect(reassignParts(parts, "a", ["b", "c"])).toEqual({
      b: ["problem", "product"],
      c: ["price", "ask"],
    });
    expect(parts).toEqual(before);
  });
  it("uses the first remaining member on ties and transfers all the leaver's parts", () => {
    expect(
      reassignParts({ a: ["price", "ask"], b: ["problem"], c: ["product"] }, "a", ["c", "b"]),
    ).toEqual({ c: ["product", "price", "ask"], b: ["problem"] });
  });
  it("returns no parts when the last member leaves", () => {
    expect(reassignParts({ a: ["problem", "product", "price", "ask"] }, "a", [])).toEqual({});
  });
});

describe("quantity and median", () => {
  it("caps quantity by current members and the remaining wallet", () => {
    expect(maxQuantity(4, 400, 60)).toBe(4);
    expect(maxQuantity(4, 100, 60)).toBe(1);
    expect(maxQuantity(3, 5, 10)).toBe(0);
    expect(maxQuantity(4, 120, 60)).toBe(2);
    expect(maxQuantity(4, 0, 10)).toBe(0);
  });
  it("takes the floored median, including empty, odd and even votes", () => {
    expect(medianFloor([])).toBe(0);
    expect(medianFloor([1, 4])).toBe(2);
    expect(medianFloor([0, 3, 3])).toBe(3);
    expect(medianFloor([1, 2, 3, 4])).toBe(2);
    expect(medianFloor([4])).toBe(4);
  });
  it("does not change the order of votes", () => {
    const votes = [4, 1, 3, 2];
    expect(medianFloor(votes)).toBe(2);
    expect(votes).toEqual([4, 1, 3, 2]);
  });
});

describe("minimum spending", () => {
  it("uses the maximum configured price for unpriced sellers during PREP", () => {
    const buyer = { ...company("g1"), price: null };
    const state = shared(
      [buyer, { ...company("g2"), price: null }, { ...company("g3"), price: null }],
      { stage: "PREP", presented: [] },
    );
    expect(minSpendLeft(buyer, state, config)).toBe(240);
    expect(minSpendTarget(buyer, state, config)).toBe(0);
  });
  it("limits the target to the maximum available purchases even if no questions were asked", () => {
    const buyer = company("g1", 60);
    const state = shared([buyer, company("g2", 10), company("g3", 10)]);
    expect(minSpendTarget(buyer, state, config)).toBe(80);
  });
  it("caps the target at the configured percentage of the starting wallet", () => {
    const buyer = company("g1");
    const state = shared([buyer, company("g2", 50), company("g3", 60)]);
    expect(minSpendTarget(buyer, state, config)).toBe(240);
    expect(minSpendTarget(buyer, state, { ...config, minSpendPercent: 100 })).toBe(400);
  });
  it("uses current membership but the fixed starting wallet regardless of money settings", () => {
    const buyer = { ...company("g1"), members: ["g1p1"], wallet: 5 };
    const state = shared([buyer, company("g2", 10), company("g3", 10)]);
    expect(minSpendTarget(buyer, state, { ...config, moneyPerMember: 1000 })).toBe(20);
    expect(minSpendLeft(buyer, state, config)).toBe(20);
    expect(computeResults(state, config).scores.find((s) => s.groupId === "g1")!.shortfall).toBe(
      20,
    );
  });
  it("floors the percentage before comparing against available purchases", () => {
    const buyer = { ...company("g1"), startWallet: 101 };
    expect(minSpendTarget(buyer, shared([buyer, company("g2", 60)]), config)).toBe(60);
  });
  it("only counts other presented sellers for the final target", () => {
    const buyer = company("g1", 60);
    const state = shared([buyer, company("g2", 10), company("g3", 10)], {
      presented: ["g1", "g2"],
    });
    expect(minSpendTarget(buyer, state, config)).toBe(40);
    expect(minSpendLeft(buyer, state, config)).toBe(80);
    state.presented = ["g1"];
    expect(minSpendTarget(buyer, state, config)).toBe(0);
  });
  it("includes presented empty sellers but excludes empty sellers that never presented in the live figure", () => {
    const buyer = company("g1");
    const empty = { ...company("g3", 10), members: [] };
    const state = shared([buyer, company("g2", 10), empty], { presented: ["g2"] });
    expect(minSpendLeft(buyer, state, config)).toBe(40);
    state.presented.push("g3");
    expect(minSpendLeft(buyer, state, config)).toBe(80);
    expect(minSpendTarget(buyer, state, config)).toBe(80);
  });
  it("uses current discounted prices and subtracts actual spending for the live figure", () => {
    const buyer = company("g1");
    const state = shared([buyer, company("g2", 5), company("g3", 10)], {
      purchases: [{ buyer: "g1", seller: "g2", quantity: 1, price: 10 }],
    });
    expect(minSpendLeft(buyer, state, config)).toBe(50);
    expect(minSpendLeft(buyer, state, { ...config, minSpendPercent: 0 })).toBe(0);
  });
});

describe("results", () => {
  it("scores a full three-company game with prices 20/40/60 and hand-computed totals", () => {
    const state = shared([company("g1", 20), company("g2", 40), company("g3", 60)], {
      purchases: [
        { buyer: "g1", seller: "g2", quantity: 2, price: 40 },
        { buyer: "g1", seller: "g3", quantity: 1, price: 60 },
        { buyer: "g2", seller: "g1", quantity: 3, price: 20 },
        { buyer: "g2", seller: "g3", quantity: 2, price: 60 },
        { buyer: "g3", seller: "g1", quantity: 2, price: 20 },
        { buyer: "g3", seller: "g2", quantity: 1, price: 40 },
      ],
      asked: {
        g1: ["g2p1", "g3p1", "g3p2"],
        g2: ["g1p1", "g1p2", "g3p3"],
        g3: ["g1p3", "g2p2", "g2p3", "g2p4"],
      },
    });
    const before = structuredClone(state);
    expect(spent(state, "g1")).toBe(140);
    expect(computeResults(state, config)).toEqual({
      scores: [
        { groupId: "g1", revenue: 100, spent: 140, shortfall: 100, noQuestion: 20, total: -20 },
        { groupId: "g3", revenue: 180, spent: 80, shortfall: 160, noQuestion: 20, total: 0 },
        { groupId: "g2", revenue: 120, spent: 180, shortfall: 60, noQuestion: 0, total: 60 },
      ],
      bestStartup: ["g2"],
      bestShark: ["g1"],
    });
    expect(state).toEqual(before);
  });
  it("uses the recorded purchase price for spending and revenue", () => {
    const state = shared([company("g1", 10), company("g2", 10)], {
      purchases: [{ buyer: "g2", seller: "g1", quantity: 2, price: 35 }],
    });
    expect(spent(state, "g2")).toBe(70);
    expect(spent(state, "missing")).toBe(0);
    expect(
      computeResults(state, awardsConfig).scores.find((s) => s.groupId === "g1")!.revenue,
    ).toBe(70);
  });
  it("never gives a negative shortfall when spending exceeds the target", () => {
    const state = shared([company("g1"), company("g2")], {
      purchases: [{ buyer: "g1", seller: "g2", quantity: 4, price: 20 }],
    });
    const result = computeResults(state, { ...config, minSpendPercent: 10, noQuestionPenalty: 0 });
    expect(result.scores.find((score) => score.groupId === "g1")).toEqual({
      groupId: "g1",
      revenue: 0,
      spent: 80,
      shortfall: 0,
      noQuestion: 0,
      total: 0,
    });
  });
  it("counts each current member who never asked once, and never penalizes former members", () => {
    const buyer = { ...company("g1"), members: ["g1p1", "g1p2"], formerMembers: ["g1p3", "g1p4"] };
    const state = shared([buyer, company("g2")], { asked: { g1: ["g1p3"], g2: ["g1p1", "g1p1"] } });
    expect(
      computeResults(state, { ...config, minSpendPercent: 0 }).scores.find(
        (s) => s.groupId === "g1",
      )!.noQuestion,
    ).toBe(20);
  });
  it("keeps an empty company's revenue and removes both penalties", () => {
    const empty = { ...company("g1"), members: [], formerMembers: company("g1").members };
    const state = shared([empty, company("g2")], {
      purchases: [{ buyer: "g2", seller: "g1", quantity: 2, price: 20 }],
    });
    expect(computeResults(state, config).scores.find((s) => s.groupId === "g1")).toEqual({
      groupId: "g1",
      revenue: 40,
      spent: 0,
      shortfall: 0,
      noQuestion: 0,
      total: 40,
    });
  });
  it("shares Best Startup on a tie and omits Best Shark for a two-company game", () => {
    const state = shared([company("g1"), company("g2")], {
      purchases: [
        { buyer: "g1", seller: "g2", quantity: 1, price: 20 },
        { buyer: "g2", seller: "g1", quantity: 1, price: 20 },
      ],
    });
    expect(computeResults(state, awardsConfig).bestStartup).toEqual(["g1", "g2"]);
    expect(computeResults(state, awardsConfig).bestShark).toEqual([]);
  });
  it("includes every seller tied at second revenue in the Best Shark calculation", () => {
    const state = shared([company("g1"), company("g2"), company("g3"), company("g4")], {
      purchases: [
        { buyer: "g1", seller: "g2", quantity: 2, price: 20 },
        { buyer: "g1", seller: "g3", quantity: 2, price: 20 },
        { buyer: "g4", seller: "g1", quantity: 3, price: 20 },
        { buyer: "g2", seller: "g1", quantity: 2, price: 20 },
        { buyer: "g2", seller: "g3", quantity: 1, price: 20 },
        { buyer: "g3", seller: "g2", quantity: 1, price: 20 },
      ],
    });
    // Revenue is 100/60/60/0; spending on those top three is 80/60/20/60.
    expect(computeResults(state, awardsConfig).bestShark).toEqual(["g1"]);
  });
  it("includes all first-place ties and shares Best Shark when spending ties", () => {
    const state = shared([company("g1"), company("g2"), company("g3")], {
      purchases: [
        { buyer: "g1", seller: "g2", quantity: 1, price: 20 },
        { buyer: "g2", seller: "g3", quantity: 1, price: 20 },
        { buyer: "g3", seller: "g1", quantity: 1, price: 20 },
      ],
    });
    expect(computeResults(state, awardsConfig).bestShark).toEqual(["g1", "g2", "g3"]);
  });
  it("chooses the top sellers for Best Shark by revenue rather than final score", () => {
    const state = shared([company("g1"), company("g2"), company("g3")], {
      purchases: [
        { buyer: "g3", seller: "g1", quantity: 3, price: 20 },
        { buyer: "g2", seller: "g1", quantity: 2, price: 20 },
        { buyer: "g1", seller: "g2", quantity: 3, price: 20 },
        { buyer: "g1", seller: "g3", quantity: 2, price: 20 },
      ],
      asked: { g1: [...company("g2").members, ...company("g3").members] },
    });
    // Revenue is 100/60/40; totals are -300/60/40 after g1's question penalties.
    const result = computeResults(state, { ...awardsConfig, noQuestionPenalty: 100 });
    expect(result.bestStartup).toEqual(["g2"]);
    expect(result.bestShark).toEqual(["g1", "g3"]);
  });
  it("counts empty companies toward the three-company award threshold", () => {
    const state = shared([company("g1"), company("g2"), { ...company("g3"), members: [] }], {
      purchases: [{ buyer: "g3", seller: "g1", quantity: 1, price: 20 }],
    });
    expect(computeResults(state, awardsConfig).bestShark).toEqual(["g3"]);
  });
  it("does not award Best Shark when nobody spent", () => {
    expect(
      computeResults(shared([company("g1"), company("g2"), company("g3")]), config).bestShark,
    ).toEqual([]);
  });
  it("returns no scores or awards for an empty session", () => {
    expect(computeResults(shared([]), config)).toEqual({
      scores: [],
      bestStartup: [],
      bestShark: [],
    });
  });
});
