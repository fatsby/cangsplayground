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
} from "@cangsplayground/core";
import type { WhosTheSpyGroupView } from "@cangsplayground/game-whos-the-spy";
import { createServer } from "../src/index.js";

// PRD §17 "DevTools" criterion with a real private-tier game, end to end over sockets:
// every raw payload a projector/player socket receives is recorded and searched.

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
const clients: Client[] = [];
let server: Awaited<ReturnType<typeof createServer>> | undefined;
afterEach(async () => {
  for (const c of clients.splice(0)) c.disconnect();
  await server?.close();
  server = undefined;
});

function ack<E extends C2SEventName>(client: Client, event: E, payload: C2SPayload<E>) {
  return new Promise<C2SResults[E]>((resolve, reject) => {
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
  const state: { view?: LobbyView; raw: string; beforeFinished: string; views: LobbyView[] } = {
    raw: "",
    beforeFinished: "",
    views: [],
  };
  socket.on("state:sync", (view) => {
    state.raw += JSON.stringify(view);
    state.view = view;
    state.views.push(view);
    if (view.game?.groups[0]?.phase !== "FINISHED") state.beforeFinished += JSON.stringify(view);
  });
  socket.on("state:patch", (patch) => {
    state.raw += JSON.stringify(patch);
    if (state.view) {
      state.view = applyPatch(state.view, patch);
      state.views.push(state.view);
      if (state.view.game?.groups[0]?.phase !== "FINISHED")
        state.beforeFinished += JSON.stringify(patch);
    }
  });
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  return { socket, state };
}

const until = (check: () => boolean) =>
  expect.poll(check, { timeout: 3000, interval: 10 }).toBe(true);

async function setup() {
  server = await createServer({ seed: 3 });
  const url = await server.listen(0, "127.0.0.1");
  const host = await connect(url);
  const { code, hostToken } = await ack(host.socket, "lobby:create", {});
  await ack(host.socket, "host:attach", { code, hostToken });
  const projector = await connect(url);
  await ack(projector.socket, "display:watch", { code });
  const players = await Promise.all(
    Array.from({ length: 4 }, async (_, i) => {
      const client = await connect(url);
      return {
        ...client,
        ...(await ack(client.socket, "lobby:join", { code, name: `Player ${i}` })),
      };
    }),
  );
  let seq = 0;
  const commandId = () => `c${++seq}`;
  await ack(host.socket, "game:select", { gameId: "whos-the-spy", commandId: commandId() });
  await ack(host.socket, "groups:assign", { mode: "count", value: 1, commandId: commandId() });
  return { host, projector, players, commandId };
}
it("never sends the topic to the projector or the spy, and never sends spy ids to the projector", async () => {
  const { host, projector, players, commandId } = await setup();
  await ack(host.socket, "game:configure", {
    config: { locationTopic: "airport" },
    commandId: commandId(),
  });
  await ack(host.socket, "game:control", { cmd: "prepare", commandId: commandId() });
  await ack(host.socket, "game:control", { cmd: "start", commandId: commandId() });
  await until(() => host.state.view?.game?.groups[0]?.phase === "RUNNING");
  const hostData = host.state.view!.game!.groups[0]!.data as WhosTheSpyGroupView;
  const spyId = hostData.spies![0]!,
    spy = players.find((p) => p.playerId === spyId)!;
  for (let i = 0; i < 8; i++)
    await ack(host.socket, "game:control", { cmd: "skip", commandId: commandId() });
  await until(() => projector.state.view?.game?.groups[0]?.phase === "VOTING");
  for (const p of players) {
    // A spy cannot vote for themselves; the other three votes catch them.
    await ack(p.socket, "game:action", {
      type: "vote",
      payload: { targetId: p === spy ? players.find((other) => other !== spy)!.playerId : spyId },
    });
  }
  await until(() => projector.state.view?.game?.groups[0]?.phase === "FINISHED");
  await until(() => players.every((p) => p.state.view?.game?.groups[0]?.phase === "FINISHED"));
  expect(projector.state.raw).not.toMatch(/Airport|passport|boarding pass/);
  expect(spy.state.beforeFinished).not.toMatch(/Airport|passport|boarding pass/);
  for (const view of projector.state.views)
    for (const g of view.game?.groups ?? []) {
      expect(g.data).toMatchObject({
        topic: null,
        role: null,
        spies: null,
        votes: null,
        myVote: null,
        spiesLeft: null,
      });
    }
  const civilian = players.find((p) => p !== spy)!;
  expect(civilian.state.view!.game!.groups[0]!.data).toMatchObject({
    result: { winner: "team", reason: "caught" },
    spies: [spyId],
    topic: { name: "Airport" },
  });
}, 15000);
it("blocks prepare when a group is too small for the spy count", async () => {
  const { host, commandId } = await setup();
  await ack(host.socket, "game:configure", { config: { spies: 2 }, commandId: commandId() });
  await expect(
    ack(host.socket, "game:control", { cmd: "prepare", commandId: commandId() }),
  ).rejects.toThrow("GROUPS_TOO_SMALL: Team Red has 4 players. 2 spies need at least 5.");
});
