import { afterEach, expect, it, vi } from "vitest";
import { createRng, type GameModule } from "@clubplay/core";
import freeTalk from "@clubplay/game-free-talk";
import { LobbyManager } from "../src/lobby/LobbyManager.js";
import { buildView, Broadcaster, type AppSocket } from "../src/broadcast.js";
import { registry } from "../src/games/registry.js";
import { RateLimiter } from "../src/auth/RateLimiter.js";

afterEach(() => vi.useRealTimers());
it("expires pairing tokens once and deletes all lobby tokens and state on idle expiry", () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const manager = new LobbyManager({ now: () => Date.now(), seed: 1, ttlMinutes: 6 });
  const lobby = manager.create();
  const { player } = manager.join(lobby.code, "Ana");
  const pair = manager.pairing.create(lobby.code);
  vi.advanceTimersByTime(120000);
  expect(() => manager.pairing.claim(lobby.code, pair.pairToken)).toThrow("expired");
  player.lastSeenAt = 0;
  vi.advanceTimersByTime(180001);
  manager.sweep();
  expect(buildView(lobby, { kind: "host" }).players[0]!.away).toBe(true);
  manager.resume(player.token);
  vi.advanceTimersByTime(360001);
  manager.sweep();
  expect(lobby.status).toBe("closed");
  expect(manager.tokens.size).toBe(0);
  expect(manager.lobbies.size).toBe(0);
  expect(lobby.players.size).toBe(0);
  expect(() => manager.resume(player.token)).toThrow("not found");
});
it("only failed lookup attempts use the rate budget and the budget resets after one minute", () => {
  let now = 0;
  const limiter = new RateLimiter(() => now);
  for (let i = 0; i < 10; i++) {
    expect(limiter.limited("ip")).toBe(false);
    limiter.fail("ip");
  }
  expect(limiter.limited("ip")).toBe(true);
  expect(limiter.limited("other")).toBe(false);
  now = 60000;
  limiter.sweep();
  expect(limiter.limited("ip")).toBe(false);
});
it("calls a secret module filter for each viewer and never sends another group or host secrets", () => {
  const secret: GameModule = {
    ...freeTalk,
    id: "test-secrets",
    prepare: ({ group }) => ({
      host: "HOST-SECRET",
      private: Object.fromEntries(group.playerIds.map((id) => [id, `PRIVATE-${id}`])),
    }),
    viewFor: ({ state, viewer }) =>
      viewer.kind === "host"
        ? state.data
        : viewer.kind === "player"
          ? { own: state.data.private[viewer.playerId] }
          : {},
  };
  registry.set(secret.id, secret);
  try {
    const manager = new LobbyManager({ seed: 1 });
    const lobby = manager.create();
    const players = Array.from({ length: 8 }, (_, i) => manager.join(lobby.code, `P${i}`).player);
    lobby.assign("count", 2);
    lobby.selectGame(secret.id);
    lobby.control("prepare");
    const viewer = players[0]!;
    for (const kind of ["projector", "player"] as const) {
      const view = buildView(lobby, kind === "player" ? { kind, playerId: viewer.id } : { kind });
      const json = JSON.stringify(view);
      expect(json).not.toContain("HOST-SECRET");
      expect(json).not.toContain(lobby.hostToken);
      for (const player of players) {
        expect(json).not.toContain(player.token);
        if (player.id !== viewer.id) expect(json).not.toContain(`PRIVATE-${player.id}`);
      }
      expect(view.game!.config).toBeNull();
      expect(view.catalog).toEqual([]);
      expect(view.warnings).toEqual([]);
    }
    expect(JSON.stringify(buildView(lobby, { kind: "host" }))).toContain("HOST-SECRET");
  } finally {
    registry.delete(secret.id);
  }
});
it("sends one filtered patch per microtask and skips unchanged views", async () => {
  const manager = new LobbyManager({ seed: createRng(1).int(999) });
  const lobby = manager.create();
  const events: { event: string; payload: unknown }[] = [];
  const socket = {
    id: "test",
    emit: (event: string, payload: unknown) => events.push({ event, payload }),
  } as unknown as AppSocket;
  const broadcaster = new Broadcaster();
  broadcaster.attach(socket, lobby, { kind: "projector" });
  expect(events).toHaveLength(1);
  expect(events[0]!.event).toBe("state:sync");
  broadcaster.queue(lobby);
  broadcaster.queue(lobby);
  await Promise.resolve();
  expect(events).toHaveLength(1);
  lobby.locked = true;
  lobby.version++;
  broadcaster.queue(lobby);
  broadcaster.queue(lobby);
  await Promise.resolve();
  expect(events).toHaveLength(2);
  expect(events[1]).toMatchObject({ event: "state:patch", payload: { locked: true } });
});
