import { describe, expect, it, vi } from "vitest";
import { GAME_VOTE_DURATION_MS, schemas } from "@cangsplayground/core";
import { buildView } from "../src/broadcast.js";
import { Lobby } from "../src/lobby/Lobby.js";
import { TimerService } from "../src/timer/TimerService.js";

const BALLOT = ["free-talk", "secret-word", "whos-the-spy"];

function setup(playerCount = 4) {
  let clock = 1_000_000;
  const lobby = new Lobby({
    code: "ABC234",
    hostToken: "host-secret-token",
    seed: 42,
    now: () => clock,
  });
  const players = Array.from({ length: playerCount }, (_, i) => lobby.join(`Player${i}`));
  return {
    lobby,
    players,
    advance: (ms: number) => {
      clock += ms;
    },
    now: () => clock,
  };
}
const asPlayer = (lobby: Lobby, playerId: string) =>
  buildView(lobby, { kind: "player", playerId }).gameVote;
const asProjector = (lobby: Lobby) => buildView(lobby, { kind: "projector" }).gameVote;
const votesOf = (lobby: Lobby) =>
  Object.fromEntries(asProjector(lobby)!.options.map((o) => [o.gameId, o.votes]));

describe("opening a game vote", () => {
  it("shows no vote until the host opens one", () => {
    const { lobby } = setup();
    expect(asProjector(lobby)).toBeNull();
  });

  it("publishes an open 60s ballot with names and zero votes to every viewer", () => {
    const { lobby, players, now } = setup();
    lobby.startGameVote(BALLOT);
    for (const view of [
      buildView(lobby, { kind: "host" }).gameVote,
      asProjector(lobby),
      asPlayer(lobby, players[0]!.id),
    ]) {
      expect(view).toMatchObject({
        status: "OPEN",
        votedCount: 0,
        eligibleCount: 4,
        winnerId: null,
        myVote: null,
        timer: {
          endsAt: now() + GAME_VOTE_DURATION_MS,
          pausedRemainingMs: null,
          durationMs: GAME_VOTE_DURATION_MS,
        },
      });
      expect(view!.options.map((o) => o.gameId)).toEqual(BALLOT);
      expect(view!.options.every((o) => o.name.length > 0 && o.votes === 0)).toBe(true);
    }
  });

  it("ignores duplicate ids and needs two different games", () => {
    const { lobby } = setup();
    expect(() => lobby.startGameVote(["free-talk", "free-talk"])).toThrow(
      expect.objectContaining({ code: "INVALID_STATE" }),
    );
    lobby.startGameVote(["free-talk", "secret-word", "free-talk"]);
    expect(asProjector(lobby)!.options.map((o) => o.gameId)).toEqual(["free-talk", "secret-word"]);
  });

  it("rejects a game that is not registered", () => {
    const { lobby } = setup();
    expect(() => lobby.startGameVote(["free-talk", "nope"])).toThrow(
      expect.objectContaining({ code: "NOT_FOUND" }),
    );
    expect(asProjector(lobby)).toBeNull();
  });

  it("rejects a second vote while one is running", () => {
    const { lobby } = setup();
    lobby.startGameVote(BALLOT);
    expect(() => lobby.startGameVote(BALLOT)).toThrow(
      expect.objectContaining({ code: "INVALID_STATE" }),
    );
  });

  it("is blocked while a game is being played, and preparing a game clears the vote", () => {
    const { lobby } = setup();
    lobby.assign("count", 1);
    lobby.startGameVote(BALLOT);
    lobby.selectGame("free-talk");
    lobby.control("prepare");
    expect(asProjector(lobby)).toBeNull();
    expect(() => lobby.startGameVote(BALLOT)).toThrow(
      expect.objectContaining({ code: "INVALID_STATE" }),
    );
  });

  it("bumps the lobby version so viewers receive the new vote", () => {
    const { lobby } = setup();
    const before = lobby.version;
    lobby.startGameVote(BALLOT);
    expect(lobby.version).toBeGreaterThan(before);
  });
});

describe("casting votes", () => {
  it("shows a live tally and each player's own choice only to that player", () => {
    const { lobby, players } = setup();
    lobby.startGameVote(BALLOT);
    lobby.castGameVote(players[0]!.id, "free-talk");
    lobby.castGameVote(players[1]!.id, "free-talk");
    lobby.castGameVote(players[2]!.id, "secret-word");
    expect(votesOf(lobby)).toEqual({ "free-talk": 2, "secret-word": 1, "whos-the-spy": 0 });
    expect(asProjector(lobby)).toMatchObject({ votedCount: 3, eligibleCount: 4, myVote: null });
    expect(asPlayer(lobby, players[0]!.id)!.myVote).toBe("free-talk");
    expect(asPlayer(lobby, players[2]!.id)!.myVote).toBe("secret-word");
    expect(asPlayer(lobby, players[3]!.id)!.myVote).toBeNull();
    expect(buildView(lobby, { kind: "host" }).gameVote!.myVote).toBeNull();
  });

  it("moves a player's vote when they change their mind and counts them once", () => {
    const { lobby, players } = setup();
    lobby.startGameVote(BALLOT);
    lobby.castGameVote(players[0]!.id, "free-talk");
    lobby.castGameVote(players[0]!.id, "whos-the-spy");
    expect(votesOf(lobby)).toEqual({ "free-talk": 0, "secret-word": 0, "whos-the-spy": 1 });
    expect(asProjector(lobby)!.votedCount).toBe(1);
  });

  it("rejects a game that is not on the ballot, an unknown player, and a missing vote", () => {
    const { lobby, players } = setup();
    expect(() => lobby.castGameVote(players[0]!.id, "free-talk")).toThrow(
      expect.objectContaining({ code: "INVALID_STATE" }),
    );
    lobby.startGameVote(["free-talk", "secret-word"]);
    expect(() => lobby.castGameVote(players[0]!.id, "whos-the-spy")).toThrow(
      expect.objectContaining({ code: "NOT_FOUND" }),
    );
    expect(() => lobby.castGameVote("ghost", "free-talk")).toThrow(
      expect.objectContaining({ code: "NOT_FOUND" }),
    );
    expect(asProjector(lobby)!.votedCount).toBe(0);
  });

  it("drops the vote of a player who leaves while the vote is open", () => {
    const { lobby, players } = setup();
    lobby.startGameVote(BALLOT);
    lobby.castGameVote(players[0]!.id, "free-talk");
    lobby.castGameVote(players[1]!.id, "free-talk");
    lobby.removePlayer(players[0]!.id);
    expect(votesOf(lobby)["free-talk"]).toBe(1);
    expect(asProjector(lobby)).toMatchObject({ votedCount: 1, eligibleCount: 3 });
  });

  it("keeps the announced result unchanged when a player leaves afterwards", () => {
    const { lobby, players, advance } = setup();
    lobby.startGameVote(BALLOT);
    lobby.castGameVote(players[0]!.id, "free-talk");
    advance(GAME_VOTE_DURATION_MS);
    lobby.expireGameVote(lobby.gameVote!.endsAt);
    lobby.removePlayer(players[0]!.id);
    expect(asProjector(lobby)).toMatchObject({ status: "CLOSED", winnerId: "free-talk" });
    expect(votesOf(lobby)["free-talk"]).toBe(1);
  });
});

describe("closing a vote", () => {
  it("announces the game with the most votes when time is up", () => {
    const { lobby, players, advance } = setup();
    lobby.startGameVote(BALLOT);
    lobby.castGameVote(players[0]!.id, "secret-word");
    lobby.castGameVote(players[1]!.id, "secret-word");
    lobby.castGameVote(players[2]!.id, "free-talk");
    advance(GAME_VOTE_DURATION_MS);
    lobby.expireGameVote(lobby.gameVote!.endsAt);
    expect(asProjector(lobby)).toMatchObject({
      status: "CLOSED",
      winnerId: "secret-word",
      timer: { endsAt: null },
    });
    expect(votesOf(lobby)).toEqual({ "free-talk": 1, "secret-word": 2, "whos-the-spy": 0 });
  });

  it("does nothing before the deadline or for a stale deadline", () => {
    const { lobby, players, advance } = setup();
    lobby.startGameVote(BALLOT);
    lobby.castGameVote(players[0]!.id, "free-talk");
    const endsAt = lobby.gameVote!.endsAt;
    advance(GAME_VOTE_DURATION_MS - 1);
    lobby.expireGameVote(endsAt);
    expect(asProjector(lobby)!.status).toBe("OPEN");
    advance(1);
    lobby.expireGameVote(endsAt - 5);
    expect(asProjector(lobby)!.status).toBe("OPEN");
    lobby.expireGameVote(endsAt);
    expect(asProjector(lobby)!.status).toBe("CLOSED");
  });

  it("picks one of the tied games, deterministically for a given seed", () => {
    const winners = new Set<string | null>();
    for (let attempt = 0; attempt < 2; attempt++) {
      const { lobby, players, advance } = setup();
      lobby.startGameVote(BALLOT);
      lobby.castGameVote(players[0]!.id, "free-talk");
      lobby.castGameVote(players[1]!.id, "secret-word");
      lobby.castGameVote(players[2]!.id, "whos-the-spy");
      lobby.castGameVote(players[3]!.id, "whos-the-spy");
      lobby.castGameVote(players[2]!.id, "secret-word");
      advance(GAME_VOTE_DURATION_MS);
      lobby.expireGameVote(lobby.gameVote!.endsAt);
      winners.add(asProjector(lobby)!.winnerId);
    }
    expect(winners.size).toBe(1);
    expect(["secret-word", "whos-the-spy"]).toContain([...winners][0]);
  });

  it("never picks a game with fewer votes than the leader, whatever the seed", () => {
    for (let seed = 1; seed <= 25; seed++) {
      let clock = 5;
      const lobby = new Lobby({ code: "ABC234", hostToken: "t", seed, now: () => clock });
      const [a, b, c] = ["A", "B", "C"].map((n) => lobby.join(n));
      lobby.startGameVote(BALLOT);
      lobby.castGameVote(a!.id, "free-talk");
      lobby.castGameVote(b!.id, "secret-word");
      lobby.castGameVote(c!.id, "secret-word");
      clock += GAME_VOTE_DURATION_MS;
      lobby.expireGameVote(lobby.gameVote!.endsAt);
      expect(asProjector(lobby)!.winnerId).toBe("secret-word");
    }
  });

  it("announces no winner when nobody voted", () => {
    const { lobby, advance } = setup();
    lobby.startGameVote(BALLOT);
    advance(GAME_VOTE_DURATION_MS);
    lobby.expireGameVote(lobby.gameVote!.endsAt);
    expect(asProjector(lobby)).toMatchObject({ status: "CLOSED", winnerId: null, votedCount: 0 });
  });

  it("rejects a late vote and still publishes the result even though the timer has not fired", () => {
    const { lobby, players, advance } = setup();
    lobby.startGameVote(BALLOT);
    lobby.castGameVote(players[0]!.id, "free-talk");
    advance(GAME_VOTE_DURATION_MS);
    const before = lobby.version;
    expect(() => lobby.castGameVote(players[1]!.id, "secret-word")).toThrow(
      expect.objectContaining({ code: "INVALID_STATE" }),
    );
    expect(lobby.version).toBeGreaterThan(before);
    expect(asProjector(lobby)).toMatchObject({ status: "CLOSED", winnerId: "free-talk" });
    expect(votesOf(lobby)["secret-word"]).toBe(0);
  });

  it("rejects votes once the result is announced", () => {
    const { lobby, players, advance } = setup();
    lobby.startGameVote(BALLOT);
    advance(GAME_VOTE_DURATION_MS);
    lobby.expireGameVote(lobby.gameVote!.endsAt);
    expect(() => lobby.castGameVote(players[0]!.id, "free-talk")).toThrow(
      expect.objectContaining({ code: "INVALID_STATE" }),
    );
  });
});

describe("returning to vote setup", () => {
  it("clears a finished vote so the host can open a new one", () => {
    const { lobby, advance } = setup();
    lobby.startGameVote(BALLOT);
    advance(GAME_VOTE_DURATION_MS);
    lobby.expireGameVote(lobby.gameVote!.endsAt);
    lobby.clearGameVote();
    expect(asProjector(lobby)).toBeNull();
    lobby.startGameVote(["free-talk", "secret-word"]);
    expect(asProjector(lobby)).toMatchObject({ status: "OPEN", votedCount: 0 });
  });

  it("lets the host cancel a running vote, and a replacement starts from zero", () => {
    const { lobby, players } = setup();
    lobby.startGameVote(BALLOT);
    lobby.castGameVote(players[0]!.id, "free-talk");
    lobby.clearGameVote();
    expect(asProjector(lobby)).toBeNull();
    lobby.startGameVote(BALLOT);
    expect(votesOf(lobby)).toEqual({ "free-talk": 0, "secret-word": 0, "whos-the-spy": 0 });
    expect(asPlayer(lobby, players[0]!.id)!.myVote).toBeNull();
  });

  it("is a harmless no-op when there is nothing to clear", () => {
    const { lobby } = setup();
    const before = lobby.version;
    lobby.clearGameVote();
    expect(lobby.version).toBe(before);
  });

  it("opens a new vote after the previous one timed out without the host clearing it", () => {
    const { lobby, advance } = setup();
    lobby.startGameVote(BALLOT);
    advance(GAME_VOTE_DURATION_MS);
    lobby.startGameVote(["free-talk", "secret-word"]);
    expect(asProjector(lobby)!.options.map((o) => o.gameId)).toEqual(["free-talk", "secret-word"]);
    expect(asProjector(lobby)!.status).toBe("OPEN");
  });
});

describe("scheduling and protocol", () => {
  it("arms one timer while the vote is open and removes it afterwards", () => {
    const { lobby, advance } = setup();
    const timers = new TimerService(() => 1_000_000);
    lobby.startGameVote(BALLOT);
    timers.reconcile(lobby);
    expect(timers.keys()).toContain("ABC234:gameVote");
    advance(GAME_VOTE_DURATION_MS);
    lobby.expireGameVote(lobby.gameVote!.endsAt);
    timers.reconcile(lobby);
    expect(timers.keys()).not.toContain("ABC234:gameVote");
    timers.dispose();
  });

  it("re-arms and still announces the winner when the timer wakes just before the deadline", () => {
    vi.useFakeTimers();
    try {
      const { lobby, players, advance, now } = setup();
      const timers = new TimerService(now);
      lobby.onChange = () => timers.reconcile(lobby);
      lobby.startGameVote(BALLOT);
      lobby.castGameVote(players[0]!.id, "secret-word");
      // The timer fires while the lobby clock is still 1ms short of the deadline.
      advance(GAME_VOTE_DURATION_MS - 1);
      vi.advanceTimersByTime(GAME_VOTE_DURATION_MS);
      expect(asProjector(lobby)!.status).toBe("OPEN");
      expect(timers.keys()).toContain("ABC234:gameVote");
      advance(1);
      vi.advanceTimersByTime(1);
      expect(asProjector(lobby)).toMatchObject({ status: "CLOSED", winnerId: "secret-word" });
      expect(timers.keys()).not.toContain("ABC234:gameVote");
      timers.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it("removes the timer when the host clears an open vote", () => {
    const { lobby } = setup();
    const timers = new TimerService(() => 1_000_000);
    lobby.startGameVote(BALLOT);
    timers.reconcile(lobby);
    lobby.clearGameVote();
    timers.reconcile(lobby);
    expect(timers.keys()).toEqual([]);
    timers.dispose();
  });

  it("validates the three vote events", () => {
    const start = schemas["gameVote:start"];
    expect(start.safeParse({ gameIds: ["a", "b"], commandId: "c1" }).success).toBe(true);
    expect(start.safeParse({ gameIds: ["a"], commandId: "c1" }).success).toBe(false);
    expect(start.safeParse({ gameIds: ["a", "b"] }).success).toBe(false);
    expect(schemas["gameVote:clear"].safeParse({ commandId: "c2" }).success).toBe(true);
    expect(schemas["gameVote:cast"].safeParse({ gameId: "a" }).success).toBe(true);
    expect(schemas["gameVote:cast"].safeParse({ gameId: "" }).success).toBe(false);
  });
});
