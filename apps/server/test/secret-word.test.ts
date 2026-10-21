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
import type { SecretWordGroupView } from "@clubplay/game-secret-word";
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
  const state: { view?: LobbyView; raw: string } = { raw: "" };
  socket.on("state:sync", (view) => {
    state.raw += JSON.stringify(view);
    state.view = view;
  });
  socket.on("state:patch", (patch) => {
    state.raw += JSON.stringify(patch);
    if (state.view) state.view = applyPatch(state.view, patch);
  });
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  return { socket, state };
}

const until = (check: () => boolean) =>
  expect.poll(check, { timeout: 3000, interval: 10 }).toBe(true);

it("secret words reach only their owner and the host until reveal", async () => {
  server = await createServer({ seed: 3 });
  const url = await server.listen(0, "127.0.0.1");
  const host = await connect(url);
  const { code, hostToken } = await ack(host.socket, "lobby:create", {});
  await ack(host.socket, "host:attach", { code, hostToken });
  const projector = await connect(url);
  await ack(projector.socket, "display:watch", { code });
  const players = await Promise.all(
    Array.from({ length: 8 }, async (_, i) => {
      const client = await connect(url);
      return {
        ...client,
        ...(await ack(client.socket, "lobby:join", { code, name: `Học viên ${i}` })),
      };
    }),
  );

  let seq = 0;
  const commandId = () => `c${++seq}`;
  await ack(host.socket, "game:select", { gameId: "secret-word", commandId: commandId() });
  await ack(host.socket, "groups:assign", { mode: "count", value: 2, commandId: commandId() });
  await ack(host.socket, "game:control", { cmd: "prepare", commandId: commandId() });
  await ack(host.socket, "game:control", { cmd: "start", commandId: commandId() });

  // Host sees every word of every group.
  await until(() => host.state.view?.game?.groups.length === 2);
  const words = new Map<string, string>();
  for (const g of host.state.view!.game!.groups) {
    for (const [id, w] of Object.entries((g.data as SecretWordGroupView).words ?? {}))
      words.set(id, w);
  }
  expect(words.size).toBe(8);

  for (const p of players) {
    await until(() => p.state.view?.game?.groups[0]?.data != null);
    const view = p.state.view!;
    expect(view.game!.groups).toHaveLength(1);
    expect((view.game!.groups[0]!.data as SecretWordGroupView).myWord).toBe(words.get(p.playerId));
    // Words are unique per group only, so another group may share this player's word.
    const own = words.get(p.playerId);
    for (const w of words.values()) if (w !== own) expect(p.state.raw).not.toContain(`"${w}"`);
    expect(p.state.raw).not.toContain(hostToken);
    for (const other of players)
      if (other !== p) expect(p.state.raw).not.toContain(other.playerToken);
  }
  for (const w of words.values()) expect(projector.state.raw).not.toContain(`"${w}"`);
  expect(projector.state.raw).not.toContain(hostToken);

  // After reveal the words become public for that round.
  await ack(host.socket, "game:control", { cmd: "endRound", commandId: commandId() });
  await ack(host.socket, "game:control", { cmd: "reveal", commandId: commandId() });
  await until(() => projector.state.view?.game?.groups.every((g) => g.revealed) === true);
  const shown = projector.state.view!.game!.groups.flatMap((g) =>
    Object.values((g.data as SecretWordGroupView).words ?? {}),
  );
  expect(shown.sort()).toEqual([...words.values()].sort());
}, 15000);
