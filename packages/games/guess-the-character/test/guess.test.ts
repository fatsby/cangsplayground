import { describe, expect, it } from "vitest";
import { guard, playing, setCharacters, type Harness } from "./helpers.js";

/** Red = team 0 holds Thor, Blue = team 1 holds Spider-Man. */
function fixture(sizes = [2, 2], options = {}) {
  const h = playing(sizes, options);
  setCharacters(h, 0, "thor", "spider-man");
  const m = h.match();
  return { h, red: m.teams[0], blue: m.teams[1] };
}
function guess(h: Harness, actor: string, name: unknown, side: 0 | 1, version?: number) {
  const m = h.match();
  return h.act(actor, "gc:guess", {
    ...guard(h, m),
    guessVersion: version ?? m.teams[side].guessVersion,
    name,
  });
}

describe("team guessing", () => {
  it("a wrong guess cools the whole team down without changing the turn", () => {
    const { h, red } = fixture();
    const before = h.match();
    expect(h.now).toBe(31_000); // fixture clock after the 30 s vote
    expect(guess(h, red.members[0]!, "Batman", 0)).not.toBeNull();
    const after = h.match();
    expect(after.teams[0].cooldown).toEqual({
      endsAt: h.now + 5000,
      pausedRemainingMs: null,
      durationMs: 5000,
    });
    expect(after.teams[0].guessVersion).toBe(before.teams[0].guessVersion + 1);
    expect(after.turnId).toBe(before.turnId);
    expect(after.timer).toEqual(before.timer);
    expect(after.teams[1].cooldown.endsAt).toBeNull();
  });

  it("blocks every teammate during cooldown and releases exactly on the boundary", () => {
    const { h, red } = fixture();
    guess(h, red.members[0]!, "Batman", 0);
    expect(guess(h, red.members[1]!, "Hulk", 0)).toBeNull();
    h.tick(4999);
    expect(guess(h, red.members[1]!, "Hulk", 0)).toBeNull();
    // A request during cooldown does not extend it.
    expect(h.match().teams[0].cooldown.endsAt).toBe(h.now + 1);
    h.tick(1);
    expect(guess(h, red.members[1]!, "Hulk", 0)).not.toBeNull();
  });

  it("uses a custom cooldown", () => {
    const { h, red } = fixture([1, 1], { cooldownSeconds: 9 });
    guess(h, red.members[0]!, "Batman", 0);
    expect(h.match().teams[0].cooldown.durationMs).toBe(9000);
    h.tick(8999);
    expect(guess(h, red.members[0]!, "Hulk", 0)).toBeNull();
    h.tick(1);
    expect(guess(h, red.members[0]!, "Hulk", 0)).not.toBeNull();
  });

  it("a replay with an old guess version rejects even after the cooldown", () => {
    const { h, red } = fixture();
    const version = h.match().teams[0].guessVersion;
    guess(h, red.members[0]!, "Batman", 0, version);
    h.tick(10_000);
    expect(guess(h, red.members[1]!, "Spider-Man", 0, version)).toBeNull();
    expect(guess(h, red.members[0]!, "Batman", 0, version)).toBeNull();
    expect(h.match().phase).toBe("PLAYING");
    expect(h.match().teams[0].cooldown.endsAt).toBe(h.now - 5000);
  });

  it("a correct normalized guess from a non-speaker wins immediately", () => {
    const { h, red } = fixture();
    const m = h.match();
    const nonSpeaker = red.members.find((id) => id !== m.speakerId)!;
    expect(guess(h, nonSpeaker, "  spider man!! ", 0)).not.toBeNull();
    const won = h.match();
    expect(won.winnerGroupId).toBe(red.groupId);
    expect(won.phase).toBe("FINISHED");
    expect(won.timer.endsAt).toBeNull();
    expect(won.speakerId).toBeNull();
    expect(h.deadlines()).toEqual([]);
    // Later guesses and done are rejected.
    expect(guess(h, red.members[0]!, "Spider-Man", 0)).toBeNull();
  });

  it("two competing correct guesses yield one winner", () => {
    const { h, red, blue } = fixture();
    const v0 = h.match().teams[0].guessVersion;
    const v1 = h.match().teams[1].guessVersion;
    expect(guess(h, blue.members[0]!, "Thor", 1, v1)).not.toBeNull();
    expect(guess(h, red.members[0]!, "Spider-Man", 0, v0)).toBeNull();
    expect(h.match().winnerGroupId).toBe(blue.groupId);
  });

  it.each([
    ["empty", ""],
    ["spaces", "   "],
    ["punctuation", "?!--"],
    ["number type", 42],
    ["object", { name: "Thor" }],
    ["81 code points", "a".repeat(81)],
    ["81 emoji code points", "😀".repeat(81)],
  ])("does not charge a cooldown for an invalid name (%s)", (_label, name) => {
    const { h, red } = fixture();
    const version = h.match().teams[0].guessVersion;
    expect(guess(h, red.members[0]!, name, 0)).toBeNull();
    expect(h.match().teams[0].guessVersion).toBe(version);
    expect(h.match().teams[0].cooldown.endsAt).toBeNull();
  });

  it("accepts an 80 code point name as a (wrong) guess", () => {
    const { h, red } = fixture();
    expect(guess(h, red.members[0]!, "😀a".repeat(40), 0)).not.toBeNull();
    expect(h.match().teams[0].cooldown.endsAt).not.toBeNull();
  });

  it("guessing your own character is wrong", () => {
    const { h, red } = fixture();
    guess(h, red.members[0]!, "Thor", 0);
    expect(h.match().phase).toBe("PLAYING");
    expect(h.match().teams[0].cooldown.endsAt).not.toBeNull();
  });

  it("accepts curated short and unaccented aliases through the reducer", () => {
    for (const [secret, alias] of [
      ["conan", "Conan"],
      ["luffy", "luffy"],
      ["thanh-giong", "Thanh Giong"],
      ["snow-white", "Bach Tuyet"],
      ["goku", "Songoku"],
    ] as const) {
      const { h, red } = fixture();
      setCharacters(h, 0, "thor", secret);
      guess(h, red.members[0]!, alias, 0);
      expect(h.match().winnerGroupId, alias).toBe(red.groupId);
    }
  });

  it("rejects guesses from outsiders, removed players and same-name replacements", () => {
    const { h, red } = fixture([1, 1, 1, 1]);
    const outsider = h.match(1).teams[0].members[0]!;
    expect(guess(h, outsider, "Spider-Man", 0)).toBeNull();
    expect(guess(h, "host", "Spider-Man", 0)).toBeNull();
    const removed = red.members[0]!;
    h.leave(removed);
    expect(h.match().phase).toBe("ENDED");
    expect(guess(h, removed, "Spider-Man", 0)).toBeNull();
    // A replacement joins the same group with a new ID.
    h.join("g9new", red.groupId);
    expect(guess(h, "g9new", "Spider-Man", 0)).toBeNull();
    expect(h.view({ kind: "player", playerId: "g9new" }, red.groupId).privateMatches).toEqual([]);
  });

  it("rejects guesses while paused", () => {
    const { h, red } = fixture();
    const m = h.match();
    h.act("host", "gc:pause", { ...guard(h, m), turnId: m.turnId });
    expect(guess(h, red.members[0]!, "Spider-Man", 0)).toBeNull();
  });

  it("keeps raw guess text out of the shared state", () => {
    const { h, red } = fixture();
    guess(h, red.members[0]!, "Wolverine-ish", 0);
    expect(JSON.stringify(h.shared)).not.toMatch(/wolverine/i);
  });
});
