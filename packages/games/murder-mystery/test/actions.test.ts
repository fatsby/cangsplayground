import { describe, expect, it } from "vitest";
import { INTRO_MS } from "../src/clock.js";
import { createRng } from "@cangsplayground/core";
import { prepareCase } from "../src/round.js";
import { proofSets } from "../src/solver.js";
import type { Conclusion } from "../src/types.js";
import {
  allRoutes,
  cardsAfter,
  groupsOf,
  leadOf,
  start,
  toInvestigation,
  type Harness,
} from "./helpers.js";

const SECOND = 1000;

const team = (h: Harness, groupId = "g1") => h.shared.teams.find((t) => t.groupId === groupId)!;
const routeOf = (h: Harness) => allRoutes(h.shared.caseData.logic)[0]!;

/** Plays one valid route for the given teams, then moves the class into CONCLUSION. */
function playToConclusion(h: Harness, route: string[], groups = ["g1"]): void {
  toInvestigation(h);
  for (let round = 1; round <= 4; round++) {
    for (const groupId of groups) {
      expect(
        h.player(leadOf(h, groupId), "mm:investigate", { round, actionId: route[round - 1] }),
      ).toBe(true);
    }
    expect(h.host("mm:next")).toBe(true);
  }
  expect(h.shared.phase).toBe("CONCLUSION");
}

/** The best accusation a team can make after `route`. */
function bestConclusion(h: Harness, route: string[]): Conclusion {
  const { logic, reveal } = h.shared.caseData;
  const known = cardsAfter(logic, route);
  return {
    suspectId: reveal.answer.suspectId,
    weaponId: reveal.answer.weaponId,
    roomId: reveal.answer.roomId,
    evidence: {
      suspectId: proofSets(logic, known, "suspectId")[0]!,
      weaponId: proofSets(logic, known, "weaponId")[0]!,
      roomId: proofSets(logic, known, "roomId")[0]!,
    },
  };
}

describe("start and the intro", () => {
  it("lets only the host start, only from READY, and enters INTRO rather than BRIEFING", () => {
    const h = start([3]);
    const before = h.shared;
    expect(h.player("g1p1", "mm:start")).toBe(false);
    expect(h.host("mm:start", { caseNumber: 99 })).toBe(false);
    expect(h.host("mm:start", { phaseVersion: 7 })).toBe(false);
    expect(h.host("mm:start", { surprise: true })).toBe(false);
    expect(h.shared).toBe(before);
    expect(h.host("mm:start")).toBe(true);
    expect(h.shared.phase).toBe("INTRO");
    expect(h.shared.phaseVersion).toBe(before.phaseVersion + 1);
    expect(h.host("mm:start")).toBe(false);
  });

  it("rejects Extend in INTRO and leaves state deeply unchanged", () => {
    const h = start([3]);
    h.host("mm:start");
    const before = structuredClone(h.shared);
    const ref = h.shared;
    expect(h.host("mm:extend", { seconds: 30 })).toBe(false);
    expect(h.shared).toBe(ref);
    expect(h.shared).toEqual(before);
  });

  it("pauses INTRO keeping the remaining time, and Skip intro starts BRIEFING at once", () => {
    const h = start([3]);
    h.host("mm:start");
    h.tick(4000);
    expect(h.host("mm:pause")).toBe(true);
    expect(h.shared.clock).toEqual({
      endsAt: null,
      remainingMs: INTRO_MS - 4000,
      durationMs: INTRO_MS,
    });
    h.tick(60 * SECOND);
    expect(h.host("mm:resume")).toBe(true);
    expect(h.shared.clock.endsAt).toBe(h.now + INTRO_MS - 4000);
    const introVersion = h.shared.phaseVersion;
    h.tick(1000);
    expect(h.host("mm:next")).toBe(true);
    expect(h.shared.phase).toBe("BRIEFING");
    expect(h.shared.clock.endsAt).toBe(h.now + 120 * SECOND);
    expect(h.shared.phaseVersion).toBeGreaterThan(introVersion);
    expect(h.host("mm:pause", { phaseVersion: introVersion })).toBe(false);
  });
});

describe("investigations", () => {
  it("accepts only the current lead, once per round, and hands the result cards to the lead", () => {
    const h = start([3, 4]);
    toInvestigation(h);
    const route = routeOf(h);
    const lead = leadOf(h);
    const other = team(h).members.find((m) => m !== lead)!;
    const before = h.shared;
    expect(h.player(other, "mm:investigate", { round: 1, actionId: route[0] })).toBe(false);
    expect(h.host("mm:investigate", { round: 1, actionId: route[0] })).toBe(false);
    expect(h.shared).toBe(before);

    const logic = h.shared.caseData.logic;
    const action = logic.actions.find((a) => a.id === route[0])!;
    const cardsBefore = Object.keys(team(h).owners).length;
    expect(h.player(lead, "mm:investigate", { round: 1, actionId: route[0] })).toBe(true);
    expect(team(h).history).toEqual([{ round: 1, actionId: route[0], recipientId: lead }]);
    expect(Object.keys(team(h).owners).length - cardsBefore).toBe(action.resultCardIds.length);
    for (const id of action.resultCardIds) expect(team(h).owners[id]).toBe(lead);
    // other teams are untouched
    expect(team(h, "g2").history).toEqual([]);

    const spent = h.shared;
    expect(h.player(lead, "mm:investigate", { round: 1, actionId: route[1] })).toBe(false);
    expect(h.shared).toBe(spent);
  });

  it("rejects unknown, repeated and prerequisite-locked actions without mutating state", () => {
    let seed = 1;
    let h = start([3], {}, seed);
    const locked = () =>
      h.shared.caseData.logic.actions.find((a) => a.requiredActionIds.length > 0);
    while (!locked() && seed < 200) h = start([3], {}, ++seed);
    expect(locked()).toBeDefined();
    toInvestigation(h);
    const lead = leadOf(h);
    const before = h.shared;
    expect(h.player(lead, "mm:investigate", { round: 1, actionId: "nope" })).toBe(false);
    expect(h.player(lead, "mm:investigate", { round: 1, actionId: locked()!.id })).toBe(false);
    expect(h.player(lead, "mm:investigate", { round: 1 })).toBe(false);
    expect(h.shared).toBe(before);
  });

  it("rotates the lead each round and never lets a spent action be chosen again", () => {
    const h = start([3]);
    toInvestigation(h);
    const route = routeOf(h);
    const first = leadOf(h);
    expect(h.player(first, "mm:investigate", { round: 1, actionId: route[0] })).toBe(true);
    h.host("mm:next");
    const second = leadOf(h);
    expect(second).toBe(team(h).leadOrder[1]);
    if (second !== first) {
      expect(h.player(first, "mm:investigate", { round: 2, actionId: route[1] })).toBe(false);
    }
    expect(h.player(second, "mm:investigate", { round: 2, actionId: route[0] })).toBe(false);
    expect(h.player(second, "mm:investigate", { round: 2, actionId: route[1] })).toBe(true);
    expect(team(h).history.map((x) => x.round)).toEqual([1, 2]);
  });

  it("rejects an old round, an old phase version and a different case", () => {
    const h = start([3]);
    toInvestigation(h);
    const route = routeOf(h);
    const oldVersion = h.shared.phaseVersion;
    h.host("mm:next");
    const lead = leadOf(h);
    expect(h.player(lead, "mm:investigate", { round: 1, actionId: route[0] })).toBe(false);
    expect(
      h.player(lead, "mm:investigate", { round: 2, actionId: route[0], phaseVersion: oldVersion }),
    ).toBe(false);
    expect(h.player(lead, "mm:investigate", { round: 2, actionId: route[0], caseNumber: 2 })).toBe(
      false,
    );
    expect(team(h).history).toEqual([]);
  });

  it("settles the deadline first so a command at exactly endsAt cannot spend the next round", () => {
    const h = start([3]);
    toInvestigation(h);
    const route = routeOf(h);
    const staleLead = leadOf(h);
    const round1Version = h.shared.phaseVersion;
    h.tick(180 * SECOND);
    // the harness settles the due deadline, so round 2 is live and the old command is stale
    expect(
      h.player(staleLead, "mm:investigate", {
        round: 1,
        actionId: route[0],
        phaseVersion: round1Version,
      }),
    ).toBe(false);
    expect(h.shared.investigationRound).toBe(2);
    expect(team(h).history).toEqual([]);
  });

  it("locks player actions while paused and accepts them again after Resume", () => {
    const h = start([3]);
    toInvestigation(h);
    const route = routeOf(h);
    const lead = leadOf(h);
    h.host("mm:pause");
    expect(h.player(lead, "mm:investigate", { round: 1, actionId: route[0] })).toBe(false);
    h.host("mm:resume");
    expect(h.player(lead, "mm:investigate", { round: 1, actionId: route[0] })).toBe(true);
  });

  it("ignores players who are not frozen members of any team", () => {
    const h = start([3]);
    toInvestigation(h);
    const route = routeOf(h);
    expect(h.player("late-joiner", "mm:investigate", { round: 1, actionId: route[0] })).toBe(false);
    expect(h.player("g1p1​", "mm:investigate", { round: 1, actionId: route[0] })).toBe(false);
  });
});

describe("host clock controls", () => {
  it("pauses for 90 seconds without losing time, then resumes with the same remainder", () => {
    const h = start([3]);
    toInvestigation(h);
    h.tick(30 * SECOND);
    const remaining = h.shared.clock.endsAt! - h.now;
    expect(h.host("mm:pause")).toBe(true);
    expect(h.shared.paused).toBe(true);
    expect(h.shared.clock.remainingMs).toBe(remaining);
    expect(h.host("mm:pause")).toBe(false);
    h.tick(90 * SECOND);
    expect(h.shared.phase).toBe("INVESTIGATION");
    expect(h.host("mm:resume")).toBe(true);
    expect(h.shared.clock).toMatchObject({ endsAt: h.now + remaining, remainingMs: null });
    expect(h.host("mm:resume")).toBe(false);
  });

  it("extends a running or paused clock by exactly 30 seconds and rejects other amounts", () => {
    const h = start([3]);
    toInvestigation(h);
    const ends = h.shared.clock.endsAt!;
    const duration = h.shared.clock.durationMs;
    expect(h.host("mm:extend", { seconds: 30 })).toBe(true);
    expect(h.shared.clock.endsAt).toBe(ends + 30000);
    expect(h.shared.clock.durationMs).toBe(duration + 30000);
    expect(h.host("mm:extend", { seconds: 45 })).toBe(false);
    h.host("mm:pause");
    const remaining = h.shared.clock.remainingMs!;
    expect(h.host("mm:extend", { seconds: 30 })).toBe(true);
    expect(h.shared.clock.remainingMs).toBe(remaining + 30000);
  });

  it("invalidates stale requests whenever pause, resume or extend change the clock", () => {
    const h = start([3]);
    toInvestigation(h);
    const version = h.shared.phaseVersion;
    h.host("mm:extend", { seconds: 30 });
    expect(h.shared.phaseVersion).toBeGreaterThan(version);
    expect(h.host("mm:pause", { phaseVersion: version })).toBe(false);
  });

  it("does not offer Extend, Pause or Next where there is no running clock", () => {
    const h = start([3]);
    expect(h.host("mm:pause")).toBe(false);
    expect(h.host("mm:extend", { seconds: 30 })).toBe(false);
    expect(h.host("mm:next")).toBe(false);
    expect(h.host("mm:reveal")).toBe(false);
    expect(h.host("mm:newCase")).toBe(false);
  });

  it("keeps a paused class paused on Next and clears pause on the way to AWAITING_REVEAL", () => {
    const h = start([3]);
    toInvestigation(h);
    h.host("mm:pause");
    expect(h.host("mm:next")).toBe(true);
    expect(h.shared).toMatchObject({ phase: "INVESTIGATION", investigationRound: 2, paused: true });
    expect(h.shared.clock).toMatchObject({ endsAt: null, remainingMs: 180 * SECOND });
    h.host("mm:next");
    h.host("mm:next");
    h.host("mm:next");
    expect(h.shared.phase).toBe("CONCLUSION");
    expect(h.shared.paused).toBe(true);
    h.host("mm:next");
    expect(h.shared).toMatchObject({ phase: "AWAITING_REVEAL", paused: false });
    expect(h.shared.clock).toEqual({ endsAt: null, remainingMs: null, durationMs: 0 });
  });
});

describe("conclusion", () => {
  it("lets only the designated submitter save a draft, versioned, and confirms once", () => {
    const h = start([4]);
    const route = routeOf(h);
    playToConclusion(h, route);
    const t = () => team(h);
    const submitter = t().leadOrder[3]!;
    const other = t().members.find((m) => m !== submitter)!;
    const conclusion = bestConclusion(h, route);

    expect(h.player(other, "mm:saveDraft", { draftVersion: 0, conclusion })).toBe(false);
    expect(h.player(submitter, "mm:saveDraft", { draftVersion: 5, conclusion })).toBe(false);
    expect(h.player(submitter, "mm:saveDraft", { draftVersion: 0, conclusion })).toBe(true);
    expect(t().draftVersion).toBe(1);
    expect(t().draft).toEqual(conclusion);
    expect(h.player(submitter, "mm:submit", { draftVersion: 0 })).toBe(false);
    expect(h.player(other, "mm:submit", { draftVersion: 1 })).toBe(false);
    expect(t().submission).toBeNull();
    expect(h.player(submitter, "mm:submit", { draftVersion: 1 })).toBe(true);
    expect(t().submission).toEqual(conclusion);
    expect(Object.keys(t().submission!).sort()).toEqual([
      "evidence",
      "roomId",
      "suspectId",
      "weaponId",
    ]);

    const frozen = h.shared;
    expect(h.player(submitter, "mm:saveDraft", { draftVersion: 1, conclusion })).toBe(false);
    expect(h.player(submitter, "mm:submit", { draftVersion: 1 })).toBe(false);
    expect(h.shared).toBe(frozen);
  });

  it("rejects drafts that reference unknown ids, undiscovered cards, duplicates or too many cards", () => {
    const h = start([3]);
    const route = routeOf(h);
    playToConclusion(h, route);
    const submitter = team(h).leadOrder[3]!;
    const good = bestConclusion(h, route);
    const known = Object.keys(team(h).owners);
    const withEvidence = (evidence: Conclusion["evidence"]) => ({ ...good, evidence });
    const tries: Record<string, Conclusion> = {
      unknownSuspect: { ...good, suspectId: "nobody" },
      unknownWeapon: { ...good, weaponId: "nothing" },
      unknownRoom: { ...good, roomId: "nowhere" },
      undiscoveredCard: withEvidence({ ...good.evidence, suspectId: ["zzzzzz"] }),
      duplicate: withEvidence({ ...good.evidence, suspectId: [known[0]!, known[0]!] }),
      tooMany: withEvidence({ ...good.evidence, suspectId: known.slice(0, 3) }),
    };
    for (const [name, conclusion] of Object.entries(tries)) {
      expect(h.player(submitter, "mm:saveDraft", { draftVersion: 0, conclusion }), name).toBe(
        false,
      );
    }
    expect(
      h.player(submitter, "mm:saveDraft", { draftVersion: 0, conclusion: { nonsense: 1 } }),
    ).toBe(false);
    expect(team(h).draftVersion).toBe(0);
  });

  it("refuses to submit an incomplete draft", () => {
    const h = start([3]);
    const route = routeOf(h);
    playToConclusion(h, route);
    const submitter = team(h).leadOrder[3]!;
    const good = bestConclusion(h, route);
    h.player(submitter, "mm:saveDraft", { draftVersion: 0, conclusion: { ...good, roomId: null } });
    expect(h.player(submitter, "mm:submit", { draftVersion: 1 })).toBe(false);
    h.player(submitter, "mm:saveDraft", {
      draftVersion: 1,
      conclusion: { ...good, evidence: { ...good.evidence, weaponId: [] } },
    });
    expect(h.player(submitter, "mm:submit", { draftVersion: 2 })).toBe(false);
    expect(team(h).submission).toBeNull();
  });

  it("never auto-submits at the deadline, and locks edits once the phase has ended", () => {
    const h = start([3]);
    const route = routeOf(h);
    playToConclusion(h, route);
    const submitter = team(h).leadOrder[3]!;
    h.player(submitter, "mm:saveDraft", { draftVersion: 0, conclusion: bestConclusion(h, route) });
    h.tick(240 * SECOND);
    h.expireDue();
    expect(h.shared.phase).toBe("AWAITING_REVEAL");
    expect(team(h).submission).toBeNull();
    expect(h.player(submitter, "mm:submit", { draftVersion: 1 })).toBe(false);
  });
});

describe("reveal and new case", () => {
  function toAwaitingReveal(h: Harness): void {
    const route = routeOf(h);
    playToConclusion(h, route);
    const submitter = team(h).leadOrder[3]!;
    h.player(submitter, "mm:saveDraft", { draftVersion: 0, conclusion: bestConclusion(h, route) });
    h.player(submitter, "mm:submit", { draftVersion: 1 });
    h.host("mm:next");
    expect(h.shared.phase).toBe("AWAITING_REVEAL");
  }

  it("stores the server time of Reveal once and only for the host", () => {
    const h = start([3]);
    toAwaitingReveal(h);
    h.tick(7 * SECOND);
    expect(h.shared.revealedAt).toBeNull();
    expect(h.player("g1p1", "mm:reveal")).toBe(false);
    expect(h.host("mm:reveal")).toBe(true);
    expect(h.shared.phase).toBe("REVEALED");
    expect(h.shared.revealedAt).toBe(h.now);
    const at = h.shared.revealedAt;
    h.tick(SECOND);
    expect(h.host("mm:reveal")).toBe(false);
    expect(h.shared.revealedAt).toBe(at);
  });

  it("prepares the next case for the same teams in READY and keeps the case number moving", () => {
    const h = start([3, 4]);
    toAwaitingReveal(h);
    expect(h.host("mm:newCase")).toBe(false);
    h.host("mm:reveal");
    const before = h.shared;
    expect(h.player("g1p1", "mm:newCase")).toBe(false);
    expect(h.host("mm:newCase")).toBe(true);
    expect(h.shared.caseNumber).toBe(before.caseNumber + 1);
    expect(h.shared.phase).toBe("READY");
    expect(h.shared.revealedAt).toBeNull();
    expect(h.shared.teams.map((t) => t.groupId)).toEqual(["g1", "g2"]);
    expect(h.shared.teams.map((t) => t.history.length)).toEqual([0, 0]);
    expect(h.shared.caseData.seed).not.toBe(before.caseData.seed);
  });

  it("refuses a new case when a retained team no longer has 3-4 players", () => {
    const h = start([3, 4]);
    toAwaitingReveal(h);
    h.host("mm:reveal");
    h.roster.splice(
      h.roster.findIndex((r) => r.playerId === "g1p1"),
      1,
    );
    h.roster.splice(
      h.roster.findIndex((r) => r.playerId === "g1p2"),
      1,
    );
    const before = h.shared;
    expect(h.host("mm:newCase")).toBe(false);
    expect(h.shared).toBe(before);
  });

  it("uses a newly added same-group player and keeps disconnected members for the next case", () => {
    const h = start([3, 3]);
    toAwaitingReveal(h);
    h.host("mm:reveal");
    h.roster.push({ playerId: "late", groupId: "g1", connected: true });
    h.roster.find((r) => r.playerId === "g1p3")!.connected = false;
    expect(h.host("mm:newCase")).toBe(true);
    const next = h.shared.teams.find((t) => t.groupId === "g1")!;
    expect(next.members).toContain("late");
    expect(next.members).toContain("g1p3");
  });
});

describe("unknown commands", () => {
  it("rejects unknown types and malformed payloads", () => {
    const h = start([3]);
    const before = h.shared;
    expect(h.host("mm:nope")).toBe(false);
    expect(h.host("other:start")).toBe(false);
    expect(h.shared).toBe(before);
    const rng = createRng(1);
    expect(prepareCase(groupsOf([3]), 1, rng).phase).toBe("READY");
  });
});
