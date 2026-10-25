import { describe, expect, it } from "vitest";
import type { Stage } from "../src/types.js";
import { start } from "./helpers.js";

type Harness = ReturnType<typeof start>;
function advance(h: Harness) {
  const result = h.act("host", "st:next", {
    from: h.shared.stage,
    presenterIndex: h.shared.presenterIndex,
  });
  expect(result).not.toBeNull();
}
const presenter = (h: Harness) =>
  h.shared.companies.find((c) => c.groupId === h.shared.order[h.shared.presenterIndex])!;
const buyers = (h: Harness) => h.shared.companies.filter((c) => c.groupId !== presenter(h).groupId);
const company = (h: Harness, groupId: string) =>
  h.shared.companies.find((c) => c.groupId === groupId)!;
function qa(sizes = [4, 4, 4]) {
  const h = start(sizes);
  advance(h);
  expect(h.shared.stage).toBe("PITCH");
  advance(h);
  expect(h.shared.stage).toBe("QA");
  return h;
}
function huddle(sizes = [4, 4, 4], eligible = true) {
  const h = qa(sizes);
  if (eligible)
    for (const buyer of buyers(h))
      expect(h.act("host", "st:asked", { playerId: buyer.members[0] })).not.toBeNull();
  advance(h);
  expect(h.shared.stage).toBe("HUDDLE");
  return h;
}
function finish(h: Harness) {
  for (let i = 0; h.shared.stage !== "RESULTS" && i < 60; i++) advance(h);
  expect(h.shared.stage).toBe("RESULTS");
}

describe("pitch stages", () => {
  it("rejects otherwise valid pitch actions outside their allowed stages", () => {
    const h = huddle(),
      buyer = buyers(h)[0]!,
      actor = presenter(h).members[0]!;
    for (const stage of ["PREP", "PITCH", "DECISION", "RESULTS", "CLOSING"] as Stage[]) {
      h.shared.stage = stage;
      expect(h.act(buyer.members[0]!, "st:vote", { quantity: 1 })).toBeNull();
      expect(h.act("host", "st:asked", { playerId: buyer.members[0] })).toBeNull();
      expect(h.act(actor, "st:discount", { price: 20 })).toBeNull();
    }
    h.shared.stage = "QA";
    expect(h.act(buyer.members[0]!, "st:vote", { quantity: 1 })).toBeNull();
    h.shared.stage = "HUDDLE";
    expect(h.act(actor, "st:discount", { price: 20 })).toBeNull();
  });
  it("discounts once, only lower, at least minPrice, only presenter and only QA", () => {
    const h = qa();
    const seller = presenter(h),
      actor = seller.members[0]!;
    for (const price of [35, 36, 9, 10.5, "10", null])
      expect(h.act(actor, "st:discount", { price })).toBeNull();
    expect(h.act("host", "st:discount", { price: 10 })).toBeNull();
    expect(h.act(buyers(h)[0]!.members[0]!, "st:discount", { price: 10 })).toBeNull();
    expect(h.act(actor, "st:discount", { price: 10 })).not.toBeNull();
    expect(presenter(h)).toMatchObject({ price: 10, discounted: true, originalPrice: 35 });
    expect(h.act(actor, "st:discount", { price: 9 })).toBeNull();
    expect(h.act(actor, "st:discount", { price: 20 })).toBeNull();
    advance(h);
    expect(h.act(actor, "st:discount", { price: 10 })).toBeNull();
  });
  it("asked toggles only for a current non-presenter member and only by the host", () => {
    const h = qa();
    const id = buyers(h)[0]!.members[0]!,
      sellerId = presenter(h).groupId;
    expect(h.act(id, "st:asked", { playerId: id })).toBeNull();
    expect(h.act("host", "st:asked", { playerId: presenter(h).members[0] })).toBeNull();
    expect(h.act("host", "st:asked", { playerId: "missing" })).toBeNull();
    expect(h.act("host", "st:asked", { playerId: id })).not.toBeNull();
    expect(h.shared.asked[sellerId]).toEqual([id]);
    h.act("host", "st:asked", { playerId: id });
    expect(h.shared.asked[sellerId]).toEqual([]);
  });
  it("uses the configured stage durations, and timers never advance the pitch", () => {
    const h = start([3, 3], { pitchSeconds: 45, qaSeconds: 60, huddleSeconds: 30 });
    advance(h);
    expect(h.shared.timer).toEqual({ durationMs: 45000, endsAt: 46000, pausedRemainingMs: null });
    h.tick(50000);
    expect(h.shared.stage).toBe("PITCH");
    advance(h);
    expect(h.shared.timer).toEqual({ durationMs: 60000, endsAt: 111000, pausedRemainingMs: null });
    advance(h);
    expect(h.shared.timer).toEqual({ durationMs: 30000, endsAt: 81000, pausedRemainingMs: null });
    advance(h);
    expect(h.shared.timer).toEqual({ durationMs: 0, endsAt: null, pausedRemainingMs: null });
  });
  it("keeps ineligible buyers unlocked until a late question, then locks remaining ineligible buyers at zero", () => {
    const h = huddle(undefined, false);
    const [buyer, other] = buyers(h),
      id = buyer!.members[0]!;
    expect(h.shared.locked).toEqual([]);
    expect(h.act(id, "st:vote", { quantity: 1 })).toBeNull();
    expect(h.act("host", "st:asked", { playerId: id })).not.toBeNull();
    expect(h.act(id, "st:vote", { quantity: 1 })).not.toBeNull();
    advance(h);
    expect(h.shared.locked).toContain(other!.groupId);
    expect(h.shared.purchases.filter((p) => p.buyer === other!.groupId)).toEqual([]);
    expect(company(h, other!.groupId).wallet).toBe(400);
  });
  it("QA to HUDDLE locks only empty buyers automatically", () => {
    const h = qa();
    const [empty, active] = buyers(h);
    for (const id of empty!.members) h.leave(id);
    advance(h);
    expect(h.shared.locked).toEqual([empty!.groupId]);
    expect(h.shared.locked).not.toContain(active!.groupId);
    expect(h.shared.purchases).toEqual([]);
  });
});

describe("votes and purchases", () => {
  it("locks all current connected voters at the median, records a purchase and debits the wallet once", () => {
    const h = huddle(),
      buyer = buyers(h)[0]!,
      seller = presenter(h);
    for (const [index, quantity] of [1, 2, 2, 4].entries()) {
      expect(h.act(buyer.members[index]!, "st:vote", { quantity })).not.toBeNull();
      expect(h.shared.locked.includes(buyer.groupId)).toBe(index === 3);
    }
    expect(h.shared.purchases).toEqual([
      { buyer: buyer.groupId, seller: seller.groupId, quantity: 2, price: 35 },
    ]);
    expect(company(h, buyer.groupId).wallet).toBe(330);
    expect(h.act(buyer.members[0]!, "st:vote", { quantity: 0 })).toBeNull();
    h.setConnected(buyer.members[3]!, false);
    h.setConnected(buyer.members[3]!, true);
    expect(company(h, buyer.groupId).wallet).toBe(330);
    expect(h.shared.purchases).toHaveLength(1);
    expect(h.shared.stage).toBe("HUDDLE");
  });
  it("rejects votes above membership or wallet caps and disallows buying your own product", () => {
    const h = huddle(),
      buyer = buyers(h)[0]!,
      actor = buyer.members[0]!;
    for (const quantity of [-1, 5, 1.5, "1", null])
      expect(h.act(actor, "st:vote", { quantity })).toBeNull();
    expect(h.act("host", "st:vote", { quantity: 1 })).toBeNull();
    expect(h.act(presenter(h).members[0]!, "st:vote", { quantity: 1 })).toBeNull();
    company(h, buyer.groupId).wallet = 20;
    expect(h.act(actor, "st:vote", { quantity: 1 })).toBeNull();
    expect(h.act(actor, "st:vote", { quantity: 0 })).not.toBeNull();
  });
  it("re-voting before lock replaces the vote and after lock is rejected", () => {
    const h = huddle(),
      buyer = buyers(h)[0]!;
    h.act(buyer.members[0]!, "st:vote", { quantity: 4 });
    h.act(buyer.members[0]!, "st:vote", { quantity: 0 });
    for (const id of buyer.members.slice(1)) h.act(id, "st:vote", { quantity: 0 });
    expect(h.shared.votes[buyer.groupId]![buyer.members[0]!]).toBe(0);
    expect(h.shared.locked).toContain(buyer.groupId);
    expect(h.shared.purchases).toEqual([]);
    expect(h.act(buyer.members[0]!, "st:vote", { quantity: 4 })).toBeNull();
  });
  it("disconnected members are not required but their already-cast votes still count", () => {
    const h = huddle(),
      buyer = buyers(h)[0]!;
    h.act(buyer.members[3]!, "st:vote", { quantity: 4 });
    h.setConnected(buyer.members[3]!, false);
    for (const [index, quantity] of [0, 0, 4].entries())
      h.act(buyer.members[index]!, "st:vote", { quantity });
    expect(h.shared.locked).toContain(buyer.groupId);
    expect(h.shared.purchases[0]!.quantity).toBe(2);
  });
  it("when nobody is connected, all current members are required and zero votes never lock a group", () => {
    const h = huddle(),
      buyer = buyers(h)[0]!;
    for (const id of buyer.members) h.setConnected(id, false);
    expect(h.shared.locked).not.toContain(buyer.groupId);
    for (const [index, id] of buyer.members.entries()) {
      h.act(id, "st:vote", { quantity: 1 });
      expect(h.shared.locked.includes(buyer.groupId)).toBe(index === 3);
    }
    expect(h.shared.purchases[0]!.quantity).toBe(1);
  });
  it("disconnecting the last non-voter locks the group without moving parts", () => {
    const h = huddle(),
      buyer = buyers(h)[0]!,
      parts = structuredClone(buyer.parts);
    for (const id of buyer.members.slice(0, 3)) h.act(id, "st:vote", { quantity: 2 });
    expect(h.shared.locked).not.toContain(buyer.groupId);
    h.setConnected(buyer.members[3]!, false);
    expect(h.shared.locked).toContain(buyer.groupId);
    expect(company(h, buyer.groupId).parts).toEqual(parts);
    expect(company(h, buyer.groupId).members).toEqual(buyer.members);
    expect(company(h, buyer.groupId).formerMembers).toEqual([]);
  });
  it("a reconnect adds the player to the required voters before locking", () => {
    const h = huddle(),
      buyer = buyers(h)[0]!;
    h.setConnected(buyer.members[3]!, false);
    for (const id of buyer.members.slice(0, 2)) h.act(id, "st:vote", { quantity: 1 });
    h.setConnected(buyer.members[3]!, true);
    h.act(buyer.members[2]!, "st:vote", { quantity: 1 });
    expect(h.shared.locked).not.toContain(buyer.groupId);
    h.act(buyer.members[3]!, "st:vote", { quantity: 1 });
    expect(h.shared.locked).toContain(buyer.groupId);
  });
  it("re-adding an asked mark rechecks pending votes and locked companies cannot be toggled", () => {
    const h = huddle(),
      buyer = buyers(h)[0]!,
      id = buyer.members[0]!;
    for (const voter of buyer.members.slice(0, 3)) h.act(voter, "st:vote", { quantity: 1 });
    h.act("host", "st:asked", { playerId: id });
    h.setConnected(buyer.members[3]!, false);
    expect(h.shared.locked).not.toContain(buyer.groupId);
    expect(h.act("host", "st:asked", { playerId: id })).not.toBeNull();
    expect(h.shared.locked).toContain(buyer.groupId);
    expect(h.act("host", "st:asked", { playerId: id })).toBeNull();
    expect(h.act("host", "st:asked", { playerId: buyer.members[1] })).toBeNull();
  });
  it("HUDDLE to DECISION locks incomplete ballots using votes present and chooses connected announcers", () => {
    const h = huddle(),
      [buyer, other] = buyers(h);
    for (const id of buyer!.members.slice(1)) h.setConnected(id, false);
    // Keep one further voter connected until the host closes, leaving this ballot incomplete.
    h.setConnected(buyer!.members[1]!, true);
    h.act(buyer!.members[0]!, "st:vote", { quantity: 3 });
    for (const id of other!.members) h.setConnected(id, false);
    advance(h);
    expect(h.shared.stage).toBe("DECISION");
    expect(h.shared.locked).toEqual(expect.arrayContaining([buyer!.groupId, other!.groupId]));
    expect(h.shared.purchases).toEqual([
      { buyer: buyer!.groupId, seller: presenter(h).groupId, quantity: 3, price: 35 },
    ]);
    expect(buyer!.members.slice(0, 2)).toContain(h.shared.announcers[buyer!.groupId]);
    expect(other!.members).toContain(h.shared.announcers[other!.groupId]);
    expect(company(h, other!.groupId).wallet).toBe(400);
  });
  it("records the discounted lock-time price, and discounts cannot change a huddle purchase", () => {
    const h = qa(),
      actor = presenter(h).members[0]!,
      buyer = buyers(h)[0]!;
    h.act(actor, "st:discount", { price: 20 });
    h.act("host", "st:asked", { playerId: buyer.members[0] });
    advance(h);
    for (const id of buyer.members) h.act(id, "st:vote", { quantity: 2 });
    expect(h.shared.purchases[0]).toMatchObject({ price: 20, quantity: 2 });
    expect(company(h, buyer.groupId).wallet).toBe(360);
    expect(h.act(actor, "st:discount", { price: 10 })).toBeNull();
    expect(h.shared.purchases[0]!.price).toBe(20);
  });
});

describe("departures and ending", () => {
  it("an asked mark by a member who left still makes the company eligible", () => {
    const h = qa(),
      buyer = buyers(h)[0]!,
      leaver = buyer.members[0]!;
    h.act("host", "st:asked", { playerId: leaver });
    h.leave(leaver);
    advance(h);
    expect(h.act("host", "st:asked", { playerId: leaver })).toBeNull();
    for (const id of company(h, buyer.groupId).members)
      expect(h.act(id, "st:vote", { quantity: 4 })).not.toBeNull();
    expect(h.shared.purchases[0]).toMatchObject({ buyer: buyer.groupId, quantity: 4 });
    expect(company(h, buyer.groupId)).toMatchObject({
      startMembers: 4,
      startWallet: 400,
      wallet: 260,
      formerMembers: [leaver],
    });
  });
  it("a leaver mid-huddle loses their vote, parts move, and remaining completed voters lock immediately", () => {
    const pending = huddle(),
      pendingBuyer = buyers(pending)[0]!;
    for (const id of pendingBuyer.members.slice(0, 3)) pending.act(id, "st:vote", { quantity: 2 });
    company(pending, pendingBuyer.groupId).scripts.ask = ["it is useful"];
    pending.leave(pendingBuyer.members[3]!);
    const after = company(pending, pendingBuyer.groupId);
    expect(pending.shared.locked).toContain(pendingBuyer.groupId);
    expect(pending.shared.purchases[0]!.quantity).toBe(2);
    expect(after.parts[pendingBuyer.members[0]!]).toEqual(["problem", "ask"]);
    expect(after.parts[pendingBuyer.members[3]!]).toBeUndefined();
    expect(after.scripts.ask).toEqual(["it is useful"]);
    expect(pending.shared.votes[pendingBuyer.groupId]).not.toHaveProperty(pendingBuyer.members[3]!);
    expect(pending.shared.left).toContain(pendingBuyer.members[3]);
    expect(after.startWallet).toBe(400);
  });
  it("drops a leaver's cast vote so only remaining members decide the median", () => {
    const h = huddle(),
      buyer = buyers(h)[0]!;
    h.act(buyer.members[0]!, "st:vote", { quantity: 0 });
    h.act(buyer.members[1]!, "st:vote", { quantity: 4 });
    h.act(buyer.members[3]!, "st:vote", { quantity: 4 });
    h.leave(buyer.members[3]!);
    expect(h.shared.votes[buyer.groupId]).not.toHaveProperty(buyer.members[3]!);
    expect(h.shared.locked).not.toContain(buyer.groupId);
    h.act(buyer.members[2]!, "st:vote", { quantity: 0 });
    expect(h.shared.locked).toContain(buyer.groupId);
    expect(h.shared.purchases).toEqual([]);
  });
  it("locks an empty buyer at zero and never treats the presenter as a buyer on leave", () => {
    const h = huddle(),
      buyer = buyers(h)[0]!,
      seller = presenter(h);
    h.act("host", "st:asked", { playerId: buyer.members[0] });
    for (const id of buyer.members) h.leave(id);
    expect(h.shared.locked).toContain(buyer.groupId);
    expect(h.shared.purchases).toEqual([]);
    h.leave(seller.members[0]!);
    expect(h.shared.locked).not.toContain(seller.groupId);
  });
  it("skips a future empty company and resets per-pitch voting while keeping history", () => {
    const h = huddle(),
      old = presenter(h).groupId,
      emptyId = h.shared.order[1]!;
    const activeBuyer = company(h, h.shared.order[2]!);
    for (const id of activeBuyer.members) h.act(id, "st:vote", { quantity: 1 });
    const purchases = structuredClone(h.shared.purchases);
    for (const id of company(h, emptyId).members) h.leave(id);
    advance(h);
    advance(h);
    expect(h.shared.stage).toBe("PITCH");
    expect(h.shared.presenterIndex).toBe(2);
    expect(presenter(h).groupId).not.toBe(emptyId);
    expect(h.shared.presented).toEqual([old]);
    expect(h.shared.purchases).toEqual(purchases);
    expect(company(h, activeBuyer.groupId).wallet).toBe(365);
    expect(h.shared).toMatchObject({ votes: {}, locked: [], announcers: {} });
    expect(h.shared.asked[old]!.length).toBeGreaterThan(0);
    expect(h.shared.asked[presenter(h).groupId]).toEqual([]);
  });
  it("an emptied current presenter keeps the normal stages and can still receive purchases", () => {
    const h = qa(),
      seller = presenter(h),
      buyer = buyers(h)[0]!;
    for (const id of seller.members) h.leave(id);
    expect(h.shared.stage).toBe("QA");
    h.act("host", "st:asked", { playerId: buyer.members[0] });
    advance(h);
    for (const id of buyer.members) h.act(id, "st:vote", { quantity: 1 });
    expect(h.shared.purchases[0]).toMatchObject({ seller: seller.groupId, quantity: 1 });
  });
  it("replaces a departing announcer and removes the entry when their company becomes empty", () => {
    const h = huddle([2, 2]),
      buyer = buyers(h)[0]!;
    advance(h);
    const selected = h.shared.announcers[buyer.groupId]!;
    h.leave(selected);
    const remaining = company(h, buyer.groupId).members;
    expect(h.shared.announcers[buyer.groupId]).toBe(remaining[0]);
    h.leave(remaining[0]!);
    expect(h.shared.announcers).not.toHaveProperty(buyer.groupId);
  });
  it("finishes the last pitch at RESULTS, then speaks each current member once in closing", () => {
    const h = huddle([2, 3]);
    finish(h);
    expect(h.shared.presented).toEqual(h.shared.order);
    expect(h.shared.timer).toEqual({ durationMs: 0, endsAt: null, pausedRemainingMs: null });
    const expected = h.shared.order.flatMap((id) => company(h, id).members);
    advance(h);
    expect(h.shared.stage).toBe("CLOSING");
    expect(h.shared.closing).toEqual({ order: expected, index: 0 });
    for (let i = 1; i < expected.length; i++) {
      advance(h);
      expect(h.shared.closing!.index).toBe(i);
    }
    expect(
      h.act("host", "st:next", { from: "CLOSING", presenterIndex: h.shared.presenterIndex }),
    ).toBeNull();
  });
  it("removes closing leavers, preserves the current position and stops safely on an empty order", () => {
    const h = huddle([2, 3]);
    finish(h);
    advance(h);
    advance(h);
    advance(h);
    const original = [...h.shared.closing!.order];
    h.leave(original[0]!);
    expect(h.shared.closing!.index).toBe(1);
    expect(h.shared.closing!.order[h.shared.closing!.index]).toBe(original[2]);
    h.leave(original[2]!);
    expect(h.shared.closing!.index).toBe(1);
    expect(h.shared.closing!.order[1]).toBe(original[3]);
    for (const id of h.shared.companies.flatMap((c) => c.members)) h.leave(id);
    expect(h.shared.closing!.order).toEqual([]);
    expect(
      h.act("host", "st:next", { from: "CLOSING", presenterIndex: h.shared.presenterIndex }),
    ).toBeNull();
  });
});
