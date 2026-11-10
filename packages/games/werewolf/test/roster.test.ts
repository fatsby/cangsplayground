import { describe, expect, it } from "vitest";
import { createRng } from "@cangsplayground/core";
import werewolf from "../src/index.js";
import type { Role } from "../src/types.js";
import type { WerewolfShared } from "../src/WerewolfShared.js";
import { HOST, act, config, fire, idsFor, player, setupShared } from "./helpers.js";

const SIX: Role[] = ["werewolf", "werewolf", "seer", "guard", "villager", "villager"];

const args = (shared: WerewolfShared) => ({
  config,
  shared,
  roster: [],
  now: 0,
  rng: createRng(1),
});
const joined = (s: WerewolfShared, id: string) =>
  werewolf.onSharedPlayerJoined!({ ...args(s), playerId: id });
const left = (s: WerewolfShared, id: string) =>
  werewolf.onSharedPlayerLeft!({ ...args(s), playerId: id, groupId: "g1" });
const started = (roles: Role[] = SIX) => act(setupShared(roles), HOST, "ww:start")!;
const stages = (): Record<string, WerewolfShared> => {
  const reveal = started();
  const night = fire(reveal);
  const dawn = fire(night);
  const discussion = fire(dawn);
  const vote = fire(discussion);
  return { REVEAL: reveal, NIGHT: night, DISCUSSION: discussion, VOTE: vote };
};

describe("joining", () => {
  it("during SETUP the newcomer is an active villager the host can edit", () => {
    const s = joined(setupShared(SIX), "p7");
    expect(s.players.p7).toEqual({ role: "villager", alive: true, pending: false });
    expect(s.order).toContain("p7");
    expect(act(s, HOST, "ww:setRole", { playerId: "p7", role: "seer" })!.players.p7!.role).toBe(
      "seer",
    );
  });

  it.each(["REVEAL", "NIGHT", "DISCUSSION", "VOTE"])(
    "during %s the newcomer is a pending villager",
    (stage) => {
      const s = joined(stages()[stage]!, "p7");
      expect(s.players.p7).toEqual({ role: "villager", alive: true, pending: true });
      expect(s.order).toContain("p7");
      expect(s.stage).toBe(stage);
    },
  );

  it("two joiners at once are both pending", () => {
    const s = joined(joined(stages().NIGHT!, "p7"), "p8");
    expect([s.players.p7!.pending, s.players.p8!.pending]).toEqual([true, true]);
  });

  it("a pending player cannot act or vote and does not count for the threshold", () => {
    let s = joined(stages().NIGHT!, "p7");
    s = act(s, HOST, "ww:setRole", { playerId: "p7", role: "werewolf" })!;
    expect(act(s, player("p7"), "ww:wolfVote", { targetId: "p5" })).toBeNull();
    expect(act(s, player("p1"), "ww:wolfVote", { targetId: "p7" })).toBeNull();
    const vote = joined(stages().VOTE!, "p7");
    expect(act(vote, player("p7"), "ww:dayVote", { targetId: "p5" })).toBeNull();
    expect(act(vote, player("p5"), "ww:dayVote", { targetId: "p7" })).toBeNull();
    // 6 living players need 3 votes (a pending 7th must not raise it to 4)
    let v = vote;
    for (const who of ["p1", "p2", "p3"])
      v = act(v, player(who), "ww:dayVote", { targetId: "p5" })!;
    expect(fire(v).lastVote!.eliminatedId).toBe("p5");
  });

  it("a joiner after the game ended is ignored", () => {
    const ended = structuredClone(stages().NIGHT!);
    ended.stage = "ENDED";
    expect(joined(ended, "p7")).toEqual(ended);
  });
});

describe("pending joiners enter at the next dawn", () => {
  it("with the host's role choice", () => {
    let s = joined(stages().NIGHT!, "p7");
    s = act(s, HOST, "ww:setRole", { playerId: "p7", role: "seer" })!;
    s = fire(s);
    expect(s.players.p7).toEqual({ role: "seer", alive: true, pending: false });
  });
  it("as a villager when the host did nothing", () => {
    const s = fire(joined(stages().NIGHT!, "p7"));
    expect(s.players.p7).toEqual({ role: "villager", alive: true, pending: false });
  });
  it("a joiner during the day enters at the dawn after the next night", () => {
    let s = joined(stages().VOTE!, "p7");
    s = fire(fire(s)); // VERDICT -> NIGHT 2
    expect(s.players.p7!.pending).toBe(true);
    s = fire(s); // dawn of night 2
    expect(s.players.p7!.pending).toBe(false);
  });
  it("rejects a role that would end the game the moment they enter, accepts a harmless one", () => {
    const roles: Role[] = ["werewolf", "seer", "guard", "villager", "villager"];
    const night = fire(started(roles));
    night.players.p4!.alive = false;
    night.players.p5!.alive = false; // alive: p1 wolf, p2, p3  -> 1 vs 2
    const withJoiner = joined(night, "p6");
    expect(act(withJoiner, HOST, "ww:setRole", { playerId: "p6", role: "werewolf" })).toBeNull();
    expect(act(withJoiner, HOST, "ww:setRole", { playerId: "p6", role: "seer" })).not.toBeNull();
  });
  it("only pending players can be re-roled after the start", () => {
    expect(act(stages().NIGHT!, HOST, "ww:setRole", { playerId: "p5", role: "seer" })).toBeNull();
  });
});

describe("leaving", () => {
  it("in SETUP the player simply disappears", () => {
    const s = left(setupShared(SIX), "p6");
    expect(s.players.p6).toBeUndefined();
    expect(s.order).not.toContain("p6");
  });
  it("a living player is treated as eliminated and their votes are removed", () => {
    let s = act(stages().VOTE!, player("p5"), "ww:dayVote", { targetId: "p1" })!;
    s = act(s, player("p6"), "ww:dayVote", { targetId: "p5" })!;
    s = left(s, "p5");
    expect(s.players.p5!.alive).toBe(false);
    expect(s.dayVotes).toEqual({});
    expect(s.stage).toBe("VOTE");
  });
  it("the last werewolf leaving ends the game for the village", () => {
    const night = fire(started(["werewolf", "seer", "guard", "villager", "villager"]));
    const s = left(night, "p1");
    expect([s.stage, s.winner]).toEqual(["ENDED", "village"]);
  });
  it("a leave that leaves the wolves no longer outnumbered ends the game for the wolves", () => {
    const night = fire(started(["werewolf", "werewolf", "seer", "villager", "villager"]));
    const s = left(left(night, "p5"), "p4");
    expect([s.stage, s.winner]).toEqual(["ENDED", "wolves"]);
  });
  it("the Seer or Guard leaving mid-night does not shorten the night", () => {
    const night = stages().NIGHT!;
    for (const id of ["p3", "p4"]) {
      const s = left(night, id);
      expect(s.stage).toBe("NIGHT");
      expect(s.deadline).toEqual(night.deadline);
    }
  });
  it("a pending player leaving is removed entirely", () => {
    const s = left(joined(stages().NIGHT!, "p7"), "p7");
    expect(s.players.p7).toBeUndefined();
    expect(s.order).not.toContain("p7");
  });
  it("leaving an ended game changes nothing", () => {
    const ended = structuredClone(stages().NIGHT!);
    ended.stage = "ENDED";
    expect(left(ended, "p1").players.p1!.alive).toBe(true);
  });
});

describe("connection changes", () => {
  it("never change the game state", () => {
    const s = stages().NIGHT!;
    expect(werewolf.onSharedRosterChange!(args(s))).toBe(s);
    expect(idsFor(1)).toEqual(["p1"]);
  });
});
