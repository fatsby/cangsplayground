import { describe, expect, it } from "vitest";
import werewolf from "../src/index.js";
import { REVEAL_MS, MIN_PLAYERS, type Role } from "../src/types.js";
import { roleCounts } from "../src/rules.js";
import { HOST, act, config, idsFor, player, setupShared } from "./helpers.js";

const SIX: Role[] = ["werewolf", "werewolf", "seer", "guard", "villager", "villager"];

describe("module shell", () => {
  it("is a whole-lobby game that needs at least 5 players and uses its own controls", () => {
    expect(werewolf.id).toBe("werewolf");
    expect(werewolf.wholeLobby).toBe(true);
    expect(werewolf.minPlayersPerGroup).toBe(MIN_PLAYERS);
    expect(werewolf.configFields.map((f) => f.key)).toEqual([
      "nightSeconds",
      "discussionSeconds",
      "voteSeconds",
    ]);
    expect(werewolf.defaultConfig).toEqual({
      nightSeconds: 30,
      discussionSeconds: 180,
      voteSeconds: 60,
    });
  });
});

describe("prepareShared", () => {
  it("starts in SETUP with everyone alive, dealt roleCounts(6) and no deadline", () => {
    const s = setupShared(SIX);
    expect(s.stage).toBe("SETUP");
    expect(s.night).toBe(0);
    expect(s.deadline).toBeNull();
    expect(s.order).toEqual(idsFor(6));
    expect(Object.values(s.players).every((p) => p.alive && !p.pending)).toBe(true);
    const fresh = werewolf.prepareShared!({
      config,
      groups: [{ groupId: "g1", playerIds: idsFor(6), round: 1 }],
      rng: { next: () => 0.5, int: () => 0 },
      now: 0,
    });
    const counts: Record<Role, number> = { werewolf: 0, villager: 0, seer: 0, guard: 0 };
    for (const p of Object.values(fresh.players)) counts[(p as { role: Role }).role]++;
    expect(counts).toEqual(roleCounts(6));
    expect(fresh.winner).toBeNull();
    expect(fresh.pendingWinner).toBeNull();
  });
});

describe("ww:setRole", () => {
  it("lets the host change one role during SETUP and leaves the input untouched", () => {
    const s = setupShared(SIX);
    const before = structuredClone(s);
    const next = act(s, HOST, "ww:setRole", { playerId: "p5", role: "seer" })!;
    expect(next.players.p5!.role).toBe("seer");
    expect(s).toEqual(before);
  });
  it("rejects a player actor, an unknown player and an invalid role", () => {
    const s = setupShared(SIX);
    expect(act(s, player("p1"), "ww:setRole", { playerId: "p5", role: "seer" })).toBeNull();
    expect(act(s, HOST, "ww:setRole", { playerId: "nobody", role: "seer" })).toBeNull();
    expect(act(s, HOST, "ww:setRole", { playerId: "p5", role: "dragon" })).toBeNull();
  });
  it("is rejected once the game has started", () => {
    const started = act(setupShared(SIX), HOST, "ww:start")!;
    expect(act(started, HOST, "ww:setRole", { playerId: "p5", role: "seer" })).toBeNull();
  });
});

describe("ww:start", () => {
  it("rejects a set of roles with no werewolf", () => {
    const s = setupShared(["villager", "villager", "villager", "seer", "guard"]);
    expect(act(s, HOST, "ww:start")).toBeNull();
  });
  it("rejects werewolves that are not fewer than everyone else", () => {
    const s = setupShared(["werewolf", "werewolf", "werewolf", "villager", "villager", "villager"]);
    expect(act(s, HOST, "ww:start")).toBeNull();
  });
  it("rejects fewer than 5 players", () => {
    expect(
      act(setupShared(["werewolf", "seer", "guard", "villager"]), HOST, "ww:start"),
    ).toBeNull();
  });
  it("rejects a non-host actor", () => {
    expect(act(setupShared(SIX), player("p1"), "ww:start")).toBeNull();
  });
  it("moves to REVEAL with a deadline REVEAL_MS from now", () => {
    const next = act(setupShared(SIX), HOST, "ww:start", undefined, 1_000)!;
    expect(next.stage).toBe("REVEAL");
    expect(next.deadline).toEqual({ key: "REVEAL:0", endsAt: 1_000 + REVEAL_MS });
  });
  it("cannot be started twice", () => {
    const started = act(setupShared(SIX), HOST, "ww:start")!;
    expect(act(started, HOST, "ww:start")).toBeNull();
  });
});

describe("unknown actions", () => {
  it("are rejected", () => {
    expect(act(setupShared(SIX), HOST, "ww:nope")).toBeNull();
  });
});
