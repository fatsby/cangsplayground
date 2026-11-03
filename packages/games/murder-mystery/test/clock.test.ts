import { createRng } from "@cangsplayground/core";
import { describe, expect, it } from "vitest";
import { INTRO_MS, advancePhase, deadlines, expireDeadline, toTimerState } from "../src/clock.js";
import { configSchema } from "../src/config.js";
import { prepareCase, validateTeams } from "../src/round.js";
import { groupsOf, start } from "./helpers.js";

const SECOND = 1000;

describe("phase clock", () => {
  it("has no deadline in READY and no timers once the case awaits reveal", () => {
    const h = start([3]);
    expect(h.shared.phase).toBe("READY");
    expect(deadlines(h.shared)).toEqual([]);
    expect(h.shared.clock).toEqual({ endsAt: null, remainingMs: null, durationMs: 0 });
  });

  it("plays INTRO for exactly 13 seconds, then a fresh briefing clock", () => {
    const h = start([3]);
    h.begin();
    expect(INTRO_MS).toBe(13000);
    expect(h.shared.phase).toBe("INTRO");
    expect(h.shared.clock).toEqual({
      endsAt: 1000 + INTRO_MS,
      remainingMs: null,
      durationMs: INTRO_MS,
    });
    h.tick(INTRO_MS);
    h.expireDue();
    expect(h.shared.phase).toBe("BRIEFING");
    expect(h.shared.clock.endsAt).toBe(14000 + 120 * SECOND);
    expect(h.shared.clock.endsAt).toBe(134000);
  });

  it("runs the default flow: 21 timed minutes after the fixed intro, then waits for the host", () => {
    const h = start([3]);
    h.begin();
    const seen: string[] = [];
    const record = () => seen.push(`${h.shared.phase}${h.shared.investigationRound}`);
    record();
    const lengths = [INTRO_MS, 120, 180, 180, 180, 180, 180, 240].map((v, i) =>
      i === 0 ? v : v * SECOND,
    );
    for (const length of lengths) {
      h.tick(length);
      h.expireDue();
      record();
    }
    expect(seen).toEqual([
      "INTRO0",
      "BRIEFING0",
      "SHARING0",
      "INVESTIGATION1",
      "INVESTIGATION2",
      "INVESTIGATION3",
      "INVESTIGATION4",
      "CONCLUSION4",
      "AWAITING_REVEAL4",
    ]);
    expect(lengths.slice(1).reduce((a, b) => a + b, 0)).toBe(21 * 60 * SECOND);
    expect(deadlines(h.shared)).toEqual([]);
    expect(h.shared.clock).toEqual({ endsAt: null, remainingMs: null, durationMs: 0 });
    expect(h.shared.paused).toBe(false);
  });

  it("starts every transition with a fresh full duration and a new phaseVersion", () => {
    const h = start([3], {
      briefingSeconds: 30,
      sharingSeconds: 60,
      investigationSeconds: 90,
      conclusionSeconds: 120,
    });
    const versions = new Set([h.shared.phaseVersion]);
    h.begin();
    versions.add(h.shared.phaseVersion);
    const expected = [INTRO_MS, 30000, 60000, 90000, 90000, 90000, 90000, 120000];
    for (let i = 0; i < expected.length; i++) {
      expect(h.shared.clock.durationMs).toBe(expected[i]);
      expect(h.shared.clock.endsAt).toBe(h.now + expected[i]!);
      h.tick(expected[i]!);
      h.expireDue();
      versions.add(h.shared.phaseVersion);
    }
    expect(versions.size).toBe(10);
  });

  it("does not replay several phases after a long delay", () => {
    const h = start([3]);
    h.begin();
    h.tick(INTRO_MS + 10 * 60 * SECOND);
    h.expireDue();
    expect(h.shared.phase).toBe("BRIEFING");
    expect(h.shared.clock.endsAt).toBe(h.now + 120 * SECOND);
  });

  it("skipping the intro at 6s starts the briefing then, with a full duration", () => {
    const h = start([3]);
    h.begin();
    h.tick(5000);
    h.next();
    expect(h.shared.phase).toBe("BRIEFING");
    expect(h.shared.clock.endsAt).toBe(6000 + 120 * SECOND);
    expect(h.shared.clock.endsAt).toBe(126000);
  });

  it("returns null for a stale deadline after a skip, a phase change or a new case", () => {
    const h = start([3]);
    h.begin();
    const introDeadline = deadlines(h.shared)[0]!;
    h.tick(5000);
    h.next();
    h.tick(INTRO_MS);
    expect(expireDeadline(h.shared, introDeadline, h.config, h.now)).toBeNull();

    const second = prepareCase(groupsOf([3]), 2, createRng(1));
    const started = advancePhase(second, h.config, h.now);
    const sameWallTime = { ...deadlines(started)[0]!, endsAt: introDeadline.endsAt };
    expect(expireDeadline(started, introDeadline, h.config, h.now + 60 * SECOND)).toBeNull();
    expect(expireDeadline(started, sameWallTime, h.config, h.now + 60 * SECOND)).toBeNull();
    expect(started.phase).toBe("INTRO");
  });

  it("returns null before the deadline is actually due", () => {
    const h = start([3]);
    h.begin();
    const deadline = deadlines(h.shared)[0]!;
    expect(expireDeadline(h.shared, deadline, h.config, h.now + INTRO_MS - 1)).toBeNull();
  });

  it("keys a deadline by case, phase version, phase and round", () => {
    const h = start([3]);
    h.begin();
    const [intro] = deadlines(h.shared);
    h.tick(INTRO_MS);
    h.expireDue();
    const [briefing] = deadlines(h.shared);
    expect(intro!.key).not.toBe(briefing!.key);
    expect(briefing!.key).toContain(String(h.shared.caseNumber));
    expect(briefing!.key).toContain(String(h.shared.phaseVersion));
  });

  it("does not advance beyond AWAITING_REVEAL; the host reveals", () => {
    const h = start([3]);
    h.begin();
    for (let i = 0; i < 8; i++) h.next();
    expect(h.shared.phase).toBe("AWAITING_REVEAL");
    const before = h.shared;
    h.next();
    expect(h.shared).toBe(before);
  });

  it("converts the clock to the shared timer shape", () => {
    expect(toTimerState({ endsAt: 5000, remainingMs: null, durationMs: 3000 })).toEqual({
      endsAt: 5000,
      pausedRemainingMs: null,
      durationMs: 3000,
    });
    expect(toTimerState({ endsAt: null, remainingMs: 1200, durationMs: 3000 })).toEqual({
      endsAt: null,
      pausedRemainingMs: 1200,
      durationMs: 3000,
    });
  });

  it("keeps defaults aligned with the schema", () => {
    expect(configSchema.parse({})).toEqual({
      briefingSeconds: 120,
      sharingSeconds: 180,
      investigationSeconds: 180,
      conclusionSeconds: 240,
    });
  });
});

describe("distribution", () => {
  const ownerCounts = (team: { members: string[]; owners: Record<string, string> }) =>
    team.members.map((m) => Object.values(team.owners).filter((o) => o === m).length).sort();

  it("splits the four starting cards 1-1-1-1 for four players and 2-1-1 for three", () => {
    const h = start([3, 4]);
    const [three, four] = h.shared.teams;
    expect(ownerCounts(three!)).toEqual([1, 1, 2]);
    expect(ownerCounts(four!)).toEqual([1, 1, 1, 1]);
  });

  it("gives every team the same four cards of the same case", () => {
    const h = start([3, 4, 3]);
    const cardSets = h.shared.teams.map((t) => Object.keys(t.owners).sort());
    expect(cardSets[0]).toEqual([...h.shared.caseData.logic.initialCardIds].sort());
    expect(cardSets[1]).toEqual(cardSets[0]);
    expect(cardSets[2]).toEqual(cardSets[0]);
  });

  it("orders leads A,B,C,D for four and A,B,C,A for three, covering everyone first", () => {
    const h = start([3, 4]);
    const [three, four] = h.shared.teams;
    expect(three!.leadOrder).toHaveLength(4);
    expect(three!.leadOrder[3]).toBe(three!.leadOrder[0]);
    expect(new Set(three!.leadOrder.slice(0, 3))).toEqual(new Set(three!.members));
    expect(four!.leadOrder).toHaveLength(4);
    expect(new Set(four!.leadOrder)).toEqual(new Set(four!.members));
  });

  it("shuffles lead order and card owners independently of each other and between cases", () => {
    const leads = new Set<string>();
    const holdsTwo = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const shared = prepareCase(groupsOf([3]), 1, createRng(seed));
      const team = shared.teams[0]!;
      leads.add(team.leadOrder[0]!);
      const counts = new Map<string, number>();
      for (const owner of Object.values(team.owners))
        counts.set(owner, (counts.get(owner) ?? 0) + 1);
      holdsTwo.add([...counts].find(([, n]) => n === 2)![0]);
    }
    expect(leads.size).toBe(3);
    expect(holdsTwo.size).toBe(3);
  });

  it("starts READY with empty progress, connected members and an inactive-free team", () => {
    const team = start([4]).shared.teams[0]!;
    expect(team).toMatchObject({
      groupId: "g1",
      members: ["g1p1", "g1p2", "g1p3", "g1p4"].sort(),
      history: [],
      draftVersion: 0,
      submission: null,
      active: true,
    });
    expect(team.connected.sort()).toEqual(team.members.slice().sort());
    expect(team.draft).toEqual({
      suspectId: null,
      weaponId: null,
      roomId: null,
      evidence: { suspectId: [], weaponId: [], roomId: [] },
    });
  });

  it("rejects team sizes 2 and 5 and an empty class, and accepts one team of three", () => {
    expect(() => prepareCase(groupsOf([2]), 1, createRng(1))).toThrow(/3-4/);
    expect(() => prepareCase(groupsOf([3, 5]), 1, createRng(1))).toThrow(/g2/);
    expect(() => prepareCase([], 1, createRng(1))).toThrow(/at least one team/i);
    expect(() => prepareCase(groupsOf([3]), 1, createRng(1))).not.toThrow();
    expect(validateTeams(groupsOf([3, 4]))).toBeNull();
    expect(validateTeams(groupsOf([4, 2]))).toMatch(/g2/);
  });
});
