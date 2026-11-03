import { afterEach, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import {
  applyPatch,
  GAME_VOTE_DURATION_MS,
  type Ack,
  type C2SEventName,
  type C2SPayload,
  type C2SResults,
  type ClientToServerEvents,
  type LobbyView,
  type ServerToClientEvents,
} from "@cangsplayground/core";
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

it("runs a minigame vote over sockets: live tally for all, private choice, auth, and a published result", async () => {
  let clock = 1_000_000;
  server = await createServer({ now: () => clock });
  const url = await server.listen(0, "127.0.0.1");
  const host = await connect(url),
    projector = await connect(url),
    ana = await connect(url),
    bo = await connect(url);
  const lobby = await ack(host.socket, "lobby:create", {});
  await ack(host.socket, "host:attach", lobby);
  await ack(projector.socket, "display:watch", { code: lobby.code });
  const anaId = await ack(ana.socket, "lobby:join", { code: lobby.code, name: "Ana" });
  await ack(bo.socket, "lobby:join", { code: lobby.code, name: "Bo" });
  const ballot = ["free-talk", "secret-word"];

  await expect(
    ack(projector.socket, "gameVote:start", { gameIds: ballot, commandId: "p1" }),
  ).rejects.toThrow("UNAUTHORIZED");
  await expect(
    ack(ana.socket, "gameVote:start", { gameIds: ballot, commandId: "p2" }),
  ).rejects.toThrow("UNAUTHORIZED");
  await expect(ack(host.socket, "gameVote:cast", { gameId: "free-talk" })).rejects.toThrow(
    "UNAUTHORIZED",
  );
  await ack(host.socket, "gameVote:start", { gameIds: ballot, commandId: "start-1" });
  await until(() =>
    [host, projector, ana, bo].every((c) => c.state.view?.gameVote?.status === "OPEN"),
  );
  expect(server.timers.keys()).toContain(`${lobby.code}:gameVote`);

  await ack(ana.socket, "gameVote:cast", { gameId: "free-talk" });
  await ack(bo.socket, "gameVote:cast", { gameId: "secret-word" });
  await ack(bo.socket, "gameVote:cast", { gameId: "free-talk" });
  await until(() =>
    [host, projector, ana, bo].every(
      (c) => c.state.view?.gameVote?.options.find((o) => o.gameId === "free-talk")?.votes === 2,
    ),
  );
  for (const client of [host, projector, ana, bo])
    expect(client.state.view!.gameVote!.options.map((o) => [o.gameId, o.votes])).toEqual([
      ["free-talk", 2],
      ["secret-word", 0],
    ]);
  expect(ana.state.view!.gameVote!.myVote).toBe("free-talk");
  expect(projector.state.view!.gameVote!.myVote).toBeNull();
  await expect(ack(ana.socket, "gameVote:cast", { gameId: "whos-the-spy" })).rejects.toThrow(
    "NOT_FOUND",
  );
  await expect(ack(projector.socket, "gameVote:cast", { gameId: "free-talk" })).rejects.toThrow(
    "UNAUTHORIZED",
  );

  clock += GAME_VOTE_DURATION_MS;
  server.manager.get(lobby.code).expireGameVote(server.manager.get(lobby.code).gameVote!.endsAt);
  await until(() =>
    [host, projector, ana, bo].every((c) => c.state.view?.gameVote?.status === "CLOSED"),
  );
  expect(projector.state.view!.gameVote).toMatchObject({
    winnerId: "free-talk",
    timer: { endsAt: null },
  });
  expect(server.timers.keys()).not.toContain(`${lobby.code}:gameVote`);
  await expect(ack(ana.socket, "gameVote:cast", { gameId: "secret-word" })).rejects.toThrow(
    "INVALID_STATE",
  );

  await expect(ack(ana.socket, "gameVote:clear", { commandId: "x" })).rejects.toThrow(
    "UNAUTHORIZED",
  );
  await ack(host.socket, "gameVote:clear", { commandId: "clear-1" });
  await until(() => [host, projector, ana, bo].every((c) => c.state.view?.gameVote === null));
  expect(anaId.playerId).toBeTruthy();
});
