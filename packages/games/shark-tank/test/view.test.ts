import { expect, it } from "vitest";
import type { Viewer } from "@cangsplayground/core";
import { viewFor } from "../src/view.js";
import { sharkTank } from "../src/logic.js";
import { ideaById } from "../src/ideas.js";
import { computeResults, minSpendLeft } from "../src/rules.js";
import { configSchema, type CompanyView, type Stage } from "../src/types.js";
import { start } from "./helpers.js";

const config = configSchema.parse({});
const roles = ["host", "own", "other", "projector"] as const;
type Role = (typeof roles)[number];
function fixture(stage: Stage = "HUDDLE") {
  const shared = start([3, 3, 3]).shared;
  shared.stage = stage;
  shared.order = ["g1", "g2", "g3"];
  shared.presenterIndex = 0;
  shared.presented = ["g3"];
  shared.asked = { g1: ["g2p1", "g2-former", "g3p2"], g3: ["g2p2"] };
  shared.locked = ["g2"];
  shared.votes = { g2: { g2p1: 1, g2p2: 3 }, g3: { g3p1: 2 } };
  shared.purchases = [
    { buyer: "g2", seller: "g1", quantity: 2, price: 35 },
    { buyer: "g3", seller: "g2", quantity: 1, price: 40 },
  ];
  shared.announcers = { g2: "g2p2", g3: "g3p1" };
  for (const [index, company] of shared.companies.entries()) {
    company.prepStep = 3;
    company.price = 35 + index * 5;
    company.scripts = { problem: [`private script ${company.groupId}`] };
    company.help = true;
    company.wallet = 300 - index * 70;
  }
  shared.companies[1]!.formerMembers = ["g2-former"];
  const args = (role: Role) => {
    const viewer: Viewer =
      role === "host"
        ? { kind: "host" }
        : role === "projector"
          ? { kind: "projector" }
          : { kind: "player", playerId: role === "own" ? "g2p2" : "g3p2" };
    return {
      config,
      shared,
      viewer,
      viewerGroupId: role === "own" ? "g2" : role === "other" ? "g3" : null,
    };
  };
  const view = (role: Role) => viewFor(args(role));
  const target = (role: Role): CompanyView => view(role).companies.find((c) => c.groupId === "g2")!;
  return { shared, args, view, target };
}

it.each(roles)(
  "filters ideas for %s during preparation and exposes only public product content afterward",
  (role) => {
    const f = fixture("PREP"),
      full = ideaById(f.shared.companies[1]!.ideaId);
    const privileged = role === "host" || role === "own";
    expect(f.target(role).idea).toEqual(privileged ? full : null);
    f.shared.stage = "PITCH";
    const { id, name, emoji, pitch } = full;
    expect(f.target(role).idea).toEqual(privileged ? full : { id, name, emoji, pitch });
  },
);

it.each(roles)("filters preparation prices for %s and shows them after preparation", (role) => {
  const f = fixture("PREP");
  expect(f.target(role).price).toBe(role === "host" || role === "own" ? 40 : null);
  f.shared.stage = "PITCH";
  expect(f.target(role).price).toBe(40);
});

it.each(roles)("filters speaking part assignments for %s during preparation", (role) => {
  const f = fixture("PREP"),
    parts = f.shared.companies[1]!.parts;
  expect(f.target(role).parts).toEqual(role === "host" || role === "own" ? parts : null);
  f.shared.stage = "PITCH";
  expect(f.target(role).parts).toEqual(parts);
});

it.each(roles)("keeps scripts and help private for %s in every stage", (role) => {
  const f = fixture();
  for (const stage of [
    "PREP",
    "PITCH",
    "QA",
    "HUDDLE",
    "DECISION",
    "RESULTS",
    "CLOSING",
  ] as Stage[]) {
    f.shared.stage = stage;
    const target = f.target(role),
      privileged = role === "host" || role === "own";
    expect(target.scripts).toEqual(privileged ? f.shared.companies[1]!.scripts : null);
    expect(target.help).toBe(privileged ? true : null);
  }
});

it.each(roles)("filters wallet, live spending target, ballots and eligibility for %s", (role) => {
  const f = fixture(),
    target = f.target(role),
    privileged = role === "host" || role === "own";
  expect(target.wallet).toBe(privileged ? 230 : null);
  expect(target.minSpendLeft).toBe(
    privileged ? minSpendLeft(f.shared.companies[1]!, f.shared, config) : null,
  );
  expect(target.votes).toEqual(privileged ? { g2p1: 1, g2p2: 3 } : null);
  expect(target.eligible).toBe(privileged ? true : null);
  // Eligibility is live, including an asked mark from a former member.
  f.shared.asked.g1 = ["g2-former"];
  expect(f.target(role).eligible).toBe(privileged ? true : null);
  f.shared.asked.g1 = [];
  expect(f.target(role).eligible).toBe(privileged ? false : null);
});

it.each(roles)("filters buyer purchase history for %s until results", (role) => {
  const f = fixture(),
    outgoing = [f.shared.purchases[0]!];
  expect(f.target(role).purchases).toEqual(role === "host" || role === "own" ? outgoing : null);
  for (const stage of ["RESULTS", "CLOSING"] as Stage[]) {
    f.shared.stage = stage;
    expect(f.target(role).purchases).toEqual(outgoing);
  }
});

it.each(roles)("reveals revenue to %s only with the appropriate timing", (role) => {
  const f = fixture();
  expect(f.target(role).revenue).toBe(role === "host" ? 40 : null);
  for (const stage of ["RESULTS", "CLOSING"] as Stage[]) {
    f.shared.stage = stage;
    expect(f.target(role).revenue).toBe(40);
  }
});

it.each(roles)("filters the current pitch's asked list for %s", (role) => {
  const f = fixture();
  expect(f.view(role).asked).toEqual(
    role === "host"
      ? ["g2p1", "g2-former", "g3p2"]
      : role === "own"
        ? ["g2p1"]
        : role === "other"
          ? ["g3p2"]
          : null,
  );
});

it("exposes public group progress and vote completion to every viewer", () => {
  const f = fixture();
  for (const role of roles)
    expect(f.target(role)).toMatchObject({
      groupId: "g2",
      prepStep: 3,
      members: ["g2p1", "g2p2", "g2p3"],
      discounted: false,
      voted: true,
    });
});

it("hides presentation order and presenter in PREP for every viewer", () => {
  const f = fixture("PREP");
  for (const role of roles) expect(f.view(role)).toMatchObject({ order: null, presenter: null });
  f.shared.stage = "PITCH";
  for (const role of roles)
    expect(f.view(role)).toMatchObject({ order: ["g1", "g2", "g3"], presenter: "g1" });
});

it("shows announcers only in DECISION and the real decision only to the nominated player", () => {
  const f = fixture();
  for (const role of roles)
    expect(f.view(role)).toMatchObject({ announcers: null, myDecision: null });
  f.shared.stage = "DECISION";
  for (const role of roles) expect(f.view(role).announcers).toEqual({ g2: "g2p2", g3: "g3p1" });
  expect(f.view("own").myDecision).toBe(true);
  expect(f.view("other").myDecision).toBeNull();
  expect(f.view("host").myDecision).toBeNull();
  expect(f.view("projector").myDecision).toBeNull();
  expect(
    viewFor({ ...f.args("own"), viewer: { kind: "player", playerId: "g2p1" } }).myDecision,
  ).toBeNull();
  expect(
    viewFor({ ...f.args("other"), viewer: { kind: "player", playerId: "g3p1" } }).myDecision,
  ).toBe(false);
});

it("shows results only in RESULTS and CLOSING, and closing order only in CLOSING", () => {
  const f = fixture();
  f.shared.closing = { order: ["g1p1", "g2p1"], index: 1 };
  for (const role of roles) expect(f.view(role)).toMatchObject({ results: null, closing: null });
  f.shared.stage = "RESULTS";
  for (const role of roles) {
    expect(f.view(role).results).toEqual(computeResults(f.shared, config));
    expect(f.view(role).closing).toBeNull();
  }
  f.shared.stage = "CLOSING";
  for (const role of roles)
    expect(f.view(role)).toMatchObject({
      results: computeResults(f.shared, config),
      closing: f.shared.closing,
    });
});

it.each(["HUDDLE", "DECISION"] as const)(
  "never sends private financial or ballot values to the projector during %s",
  (stage) => {
    const f = fixture(stage),
      json = JSON.stringify(f.view("projector"));
    expect(json).not.toMatch(/"wallet":\d/);
    expect(json).not.toContain('"votes":{');
    expect(json).not.toContain('"quantity"');
    expect(json).not.toMatch(/"revenue":\d/);
    expect(json).not.toContain("private script");
  },
);

it("gives ungrouped players only the public tier", () => {
  const f = fixture();
  const view = viewFor({ ...f.args("other"), viewerGroupId: null });
  expect(view.asked).toEqual([]);
  for (const c of view.companies)
    expect(c).toMatchObject({
      scripts: null,
      help: null,
      wallet: null,
      votes: null,
      minSpendLeft: null,
      eligible: null,
      purchases: null,
      revenue: null,
    });
});

it("does not grant a projector private access even if a group id is supplied", () => {
  const f = fixture();
  const view = viewFor({ ...f.args("projector"), viewerGroupId: "g2" });
  expect(view.companies[1]).toMatchObject({
    scripts: null,
    help: null,
    wallet: null,
    votes: null,
    purchases: null,
    revenue: null,
  });
});

it("returns independent views and wires the filter into the module", () => {
  const f = fixture(),
    before = structuredClone(f.shared);
  const view = f.view("host");
  view.timer.endsAt = 0;
  view.companies[1]!.members.push("fake");
  view.companies[1]!.scripts!.problem![0] = "changed";
  view.companies[1]!.votes!.g2p1 = 99;
  expect(f.shared).toEqual(before);
  expect(sharkTank.sharedViewFor!(f.args("host"))).toEqual(f.view("host"));
});
