import { describe, expect, it } from "vitest";
import { DAWN_MS, REVEAL_MS, VERDICT_MS, type Role } from "../src/types.js";
import type { WerewolfShared } from "../src/WerewolfShared.js";
import { HOST, act, config, fire, player, setupShared } from "./helpers.js";

const SIX: Role[] = ["werewolf", "werewolf", "seer", "guard", "villager", "villager"];

/** Starts the game and fast-forwards through night 1 (no actions) and the discussion to the vote. */
function toVote(roles: Role[] = SIX, tweak?: (s: WerewolfShared) => void): WerewolfShared {
  let s = fire(act(setupShared(roles), HOST, "ww:start")!); // NIGHT 1
  s = fire(s); // DAWN 1
  s = fire(s); // DISCUSSION 1
  tweak?.(s);
  return fire(s); // VOTE 1
}
const ballot = (s: WerewolfShared, who: string, target: string) =>
  act(s, player(who), "ww:dayVote", { targetId: target });
const cast = (s: WerewolfShared, votes: Record<string, string>) => {
  for (const [who, target] of Object.entries(votes)) s = ballot(s, who, target)!;
  return s;
};

describe("discussion and vote stages", () => {
  it("DISCUSSION due -> VOTE with voteSeconds and an empty ballot box", () => {
    const s = toVote();
    const discussionEnd =
      REVEAL_MS + config.nightSeconds * 1000 + DAWN_MS + config.discussionSeconds * 1000;
    expect(s.stage).toBe("VOTE");
    expect(s.dayVotes).toEqual({});
    expect(s.deadline).toEqual({
      key: "VOTE:1",
      endsAt: discussionEnd + config.voteSeconds * 1000,
    });
  });
});

describe("ww:dayVote", () => {
  it("records a living player's vote for another living player and lets them change it", () => {
    let s = ballot(toVote(), "p5", "p1")!;
    expect(s.dayVotes).toEqual({ p5: "p1" });
    s = ballot(s, "p5", "p2")!;
    expect(s.dayVotes).toEqual({ p5: "p2" });
  });
  it("rejects self-votes, dead voters, dead or unknown targets, hosts, and votes outside VOTE", () => {
    const s = toVote(SIX, (x) => {
      x.players.p6!.alive = false;
    });
    expect(ballot(s, "p5", "p5")).toBeNull();
    expect(ballot(s, "p6", "p1")).toBeNull();
    expect(ballot(s, "p5", "p6")).toBeNull();
    expect(ballot(s, "p5", "nobody")).toBeNull();
    expect(act(s, HOST, "ww:dayVote", { targetId: "p1" })).toBeNull();
    const discussion = fire(fire(fire(act(setupShared(SIX), HOST, "ww:start")!)));
    expect(discussion.stage).toBe("DISCUSSION");
    expect(ballot(discussion, "p5", "p1")).toBeNull();
  });
  it("does not close the vote early when everyone has voted", () => {
    const s = cast(toVote(), { p1: "p5", p2: "p5", p3: "p5", p4: "p5", p5: "p1", p6: "p1" });
    expect(s.stage).toBe("VOTE");
    expect(s.deadline!.key).toBe("VOTE:1");
  });
});

describe("resolving the vote", () => {
  it("5-of-6 alive threshold is 3: three votes banish the target and the verdict stage follows", () => {
    let s = cast(toVote(), { p1: "p5", p2: "p5", p6: "p5" });
    const voteEnd = s.deadline!.endsAt;
    s = fire(s);
    expect(s.stage).toBe("VERDICT");
    expect(s.players.p5!.alive).toBe(false);
    expect(s.lastVote).toEqual({ eliminatedId: "p5", counts: { p5: 3 } });
    expect(s.winner).toBeNull();
    expect(s.deadline).toEqual({ key: "VERDICT:1", endsAt: voteEnd + VERDICT_MS });
    const next = fire(s);
    expect(next.stage).toBe("NIGHT");
    expect(next.night).toBe(2);
    expect(next.dayVotes).toEqual({});
    expect(next.deadline!.key).toBe("NIGHT:2");
  });
  it("2 votes out of 6 alive banish nobody", () => {
    const s = fire(cast(toVote(), { p1: "p5", p2: "p5" }));
    expect(s.lastVote).toEqual({ eliminatedId: null, counts: { p5: 2 } });
    expect(Object.values(s.players).every((p) => p.alive)).toBe(true);
    expect(fire(s).stage).toBe("NIGHT");
  });
  it("no votes at all banishes nobody and the game continues", () => {
    const s = fire(toVote());
    expect(s.stage).toBe("VERDICT");
    expect(s.lastVote).toEqual({ eliminatedId: null, counts: {} });
    expect(fire(s).stage).toBe("NIGHT");
  });
  it("4 alive split 2-2 banishes nobody", () => {
    const roles: Role[] = [
      "werewolf",
      "seer",
      "guard",
      "villager",
      "villager",
      "villager",
      "villager",
    ];
    const s = toVote(roles, (x) => {
      for (const id of ["p5", "p6", "p7"]) x.players[id]!.alive = false;
    });
    const result = fire(cast(s, { p2: "p3", p4: "p3", p1: "p2", p3: "p2" }));
    expect(result.lastVote!.eliminatedId).toBeNull();
    expect(result.lastVote!.counts).toEqual({ p3: 2, p2: 2 });
  });
  it("ignores votes cast by or for dead players", () => {
    const s = toVote(SIX, (x) => {
      x.players.p6!.alive = false;
    });
    const alive = structuredClone(s);
    alive.dayVotes = { p6: "p5", p1: "p5", p2: "p5" }; // p6 is dead: only 2 valid votes, 5 alive need 3
    const result = fire(alive);
    expect(result.lastVote).toEqual({ eliminatedId: null, counts: { p5: 2 } });
  });
});

describe("a banishment that decides the game", () => {
  it("banishing the last werewolf: verdict first with the winner hidden, then ENDED for the village", () => {
    const roles: Role[] = ["werewolf", "seer", "guard", "villager", "villager"];
    let s = fire(cast(toVote(roles), { p2: "p1", p3: "p1", p4: "p1" }));
    expect(s.stage).toBe("VERDICT");
    expect(s.winner).toBeNull();
    expect(s.pendingWinner).toBe("village");
    s = fire(s);
    expect(s.stage).toBe("ENDED");
    expect(s.winner).toBe("village");
    expect(s.deadline).toBeNull();
  });
  it("banishing a villager so the wolves are no longer outnumbered ends the game for the wolves", () => {
    const roles: Role[] = ["werewolf", "werewolf", "seer", "villager", "villager"];
    let s = fire(cast(toVote(roles), { p1: "p5", p2: "p5", p3: "p5" }));
    expect(s.pendingWinner).toBe("wolves");
    s = fire(s);
    expect(s.stage).toBe("ENDED");
    expect(s.winner).toBe("wolves");
  });
});

describe("a whole round through actions and deadlines only", () => {
  it("SETUP -> REVEAL -> NIGHT 1 -> DAWN -> DISCUSSION -> VOTE -> VERDICT -> NIGHT 2", () => {
    let s = act(setupShared(SIX), HOST, "ww:start")!;
    expect(s.stage).toBe("REVEAL");
    s = fire(s);
    s = act(s, player("p1"), "ww:wolfVote", { targetId: "p5" })!;
    s = act(s, player("p2"), "ww:wolfVote", { targetId: "p5" })!;
    s = act(s, player("p3"), "ww:seerPick", { targetId: "p1" })!;
    s = act(s, player("p4"), "ww:guardPick", { targetId: "p6" })!;
    s = fire(s);
    expect([s.stage, s.dawn!.eliminatedId, s.players.p5!.alive]).toEqual(["DAWN", "p5", false]);
    s = fire(fire(s)); // DISCUSSION -> VOTE
    expect(s.stage).toBe("VOTE");
    s = cast(s, { p3: "p1", p4: "p1", p6: "p1" }); // 5 alive, need 3
    s = fire(s);
    expect([s.stage, s.lastVote!.eliminatedId]).toEqual(["VERDICT", "p1"]);
    s = fire(s);
    expect([s.stage, s.night, s.wolfVotes, s.seerPick, s.guardPick]).toEqual([
      "NIGHT",
      2,
      {},
      null,
      null,
    ]);
    expect(s.seerLog).toHaveLength(1);
  });
});
