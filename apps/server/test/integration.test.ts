import { afterEach, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import {
  applyPatch,
  type Ack,
  type C2SEventName,
  type C2SPayload,
  type C2SResults,
  type ClientToServerEvents,
  type LobbyView,
  type ServerToClientEvents,
} from "@clubplay/core";
import { createServer } from "../src/index.js";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
const clients: Client[] = [];
let server: Awaited<ReturnType<typeof createServer>> | undefined;
afterEach(async () => {
  for (const c of clients.splice(0)) c.disconnect();
  await server?.close();
  server = undefined;
});
function ack<E extends C2SEventName>(
  client: Client,
  event: E,
  payload: C2SPayload<E>,
): Promise<C2SResults[E]> {
  return new Promise((resolve, reject) => {
    const emit = client.emit.bind(client) as (
      event: E,
      payload: C2SPayload<E>,
      cb: (ack: Ack<C2SResults[E]>) => void,
    ) => void;
    emit(event, payload, (r) =>
      r.ok ? resolve(r.data) : reject(new Error(`${r.error.code}: ${r.error.message}`)),
    );
  });
}
async function connect(url: string) {
  const socket: Client = io(url, { transports: ["websocket"], forceNew: true });
  clients.push(socket);
  const state: { view?: LobbyView } = {};
  socket.on("state:sync", (view) => {
    state.view = view;
  });
  socket.on("state:patch", (patch) => {
    if (state.view) state.view = applyPatch(state.view, patch);
  });
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  return { socket, state };
}
async function until(check: () => boolean) {
  await expect.poll(check, { timeout: 3000, interval: 10 }).toBe(true);
}
it("30 clients keep matching groups and the exact authoritative timer after reconnect and repeated games", async () => {
  server = await createServer({ seed: 1 });
  const url = await server.listen(0, "127.0.0.1");
  const host = await connect(url);
  const { code, hostToken } = await ack(host.socket, "lobby:create", {});
  await ack(host.socket, "host:attach", { code, hostToken });
  const projector = await connect(url);
  await ack(projector.socket, "display:watch", { code });
  const players = await Promise.all(
    Array.from({ length: 30 }, async (_, i) => {
      const client = await connect(url);
      const identity = await ack(client.socket, "lobby:join", { code, name: `Student${i}` });
      return { ...client, ...identity };
    }),
  );
  let seq = 0;
  const commandId = () => String(++seq);
  await ack(host.socket, "groups:assign", { mode: "count", value: 4, commandId: commandId() });
  await until(() => players.every((p) => p.state.view?.me?.groupId != null));
  for (const p of players) {
    const group = projector.state.view!.groups.find((g) => g.playerIds.includes(p.playerId));
    expect(p.state.view!.me!.groupId).toBe(group!.id);
  }
  await ack(host.socket, "game:select", { gameId: "free-talk", commandId: commandId() });
  await ack(host.socket, "game:control", { cmd: "prepare", commandId: commandId() });
  await ack(host.socket, "game:control", { cmd: "start", commandId: commandId() });
  const original = players[0]!;
  await until(() => original.state.view?.game?.groups[0]?.timer.endsAt != null);
  const endsAt = original.state.view!.game!.groups[0]!.timer.endsAt;
  const groupId = original.state.view!.me!.groupId;
  original.socket.disconnect();
  const resumed = await connect(url);
  const identity = await ack(resumed.socket, "session:resume", { token: original.playerToken });
  expect(identity.playerId).toBe(original.playerId);
  expect(resumed.state.view!.me!.groupId).toBe(groupId);
  expect(resumed.state.view!.game!.groups[0]!.timer.endsAt).toBe(endsAt);
  for (let i = 0; i < 3; i++) {
    await ack(host.socket, "groups:assign", {
      mode: "count",
      value: 4,
      confirm: true,
      commandId: commandId(),
    });
    await ack(host.socket, "game:select", { gameId: "free-talk", commandId: commandId() });
    await ack(host.socket, "game:control", { cmd: "prepare", commandId: commandId() });
  }
  expect(server.manager.lobbies.size).toBe(1);
}, 15000);

it("validates payloads, enforces host auth, pairs once, deduplicates commands and rate limits failed lookups", async () => {
  server = await createServer();
  const url = await server.listen(0, "127.0.0.1");
  const host = await connect(url),
    other = await connect(url);
  const { code, hostToken } = await ack(host.socket, "lobby:create", {});
  const pair = await ack(host.socket, "host:pair", { code, hostToken });
  expect(
    (await ack(other.socket, "host:claim", { code, pairToken: pair.pairToken })).hostToken,
  ).toBe(hostToken);
  await expect(
    ack(other.socket, "host:claim", { code, pairToken: pair.pairToken }),
  ).rejects.toThrow("PAIR_EXPIRED");
  await expect(ack(other.socket, "lobby:lock", { locked: true, commandId: "1" })).rejects.toThrow(
    "UNAUTHORIZED",
  );
  await ack(host.socket, "host:attach", { code, hostToken });
  await ack(host.socket, "lobby:lock", { locked: true, commandId: "lock" });
  await ack(host.socket, "lobby:lock", { locked: false, commandId: "lock" });
  expect(server.manager.get(code).locked).toBe(true);
  await expect(ack(other.socket, "lobby:join", { code, name: "  " })).rejects.toThrow(
    "INVALID_PAYLOAD",
  );
  for (let i = 0; i < 9; i++)
    await expect(ack(other.socket, "display:watch", { code: "ZZZZZZ" })).rejects.toThrow(
      "NOT_FOUND",
    );
  await expect(ack(other.socket, "display:watch", { code })).rejects.toThrow("RATE_LIMITED");
});

it("tracks multiple tabs, resumes locked lobbies, invalidates kicked tokens, and repeats close safely", async () => {
  server = await createServer();
  const url = await server.listen(0, "127.0.0.1");
  const host = await connect(url),
    player = await connect(url),
    secondTab = await connect(url);
  const lobby = await ack(host.socket, "lobby:create", {});
  await ack(host.socket, "host:attach", lobby);
  const identity = await ack(player.socket, "lobby:join", { code: lobby.code, name: "Ana" });
  await ack(secondTab.socket, "session:resume", { token: identity.playerToken });
  player.socket.disconnect();
  await ack(host.socket, "lobby:lock", { locked: true, commandId: "lock" });
  expect(server.manager.get(lobby.code).players.get(identity.playerId)!.sockets.size).toBe(1);
  const thirdTab = await connect(url);
  await ack(thirdTab.socket, "session:resume", { token: identity.playerToken });
  const kicked = new Promise<void>((resolve) => secondTab.socket.once("session:kicked", resolve));
  await ack(host.socket, "lobby:kick", { playerId: identity.playerId, commandId: "kick" });
  await kicked;
  await expect(
    ack(thirdTab.socket, "session:resume", { token: identity.playerToken }),
  ).rejects.toThrow("NOT_FOUND");
  const closed = new Promise<void>((resolve) => host.socket.once("lobby:closed", () => resolve()));
  await ack(host.socket, "lobby:close", { commandId: "close" });
  await closed;
  await ack(host.socket, "lobby:close", { commandId: "close" });
  await expect(ack(host.socket, "lobby:lock", { locked: false, commandId: "new" })).rejects.toThrow(
    "LOBBY_CLOSED",
  );
  expect(server.manager.tokens.size).toBe(0);
});
