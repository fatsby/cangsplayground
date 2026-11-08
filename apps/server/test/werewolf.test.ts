import { afterEach, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import {
  applyPatch,
  type Ack,
  type C2SEventName,
  type C2SPayload,
  type C2SResults,
  type ClientToServerEvents,
  type LobbyPatch,
  type LobbyView,
  type ServerToClientEvents,
} from "@cangsplayground/core";
import type { WerewolfShared, WerewolfView } from "@cangsplayground/game-werewolf";
import { createServer } from "../src/index.js";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
interface Conn {
  socket: Client;
  state: { view?: LobbyView };
  /** Every sync and patch this client received, for leak checks. */
  received: (LobbyView | LobbyPatch)[];
}
type Student = Conn & { id: string };
const clients: Client[] = [];
let server: Awaited<ReturnType<typeof createServer>> | undefined;
afterEach(async () => {
  for (const c of clients.splice(0)) c.disconnect();
  await server?.close();
  server = undefined;
});

function send<E extends C2SEventName>(c: Conn, event: E, payload: C2SPayload<E>) {
  return new Promise<Ack<C2SResults[E]>>((resolve) => {
    const emit = c.socket.emit.bind(c.socket) as (
      event: E,
      payload: C2SPayload<E>,
      cb: (ack: Ack<C2SResults[E]>) => void,
    ) => void;
    emit(event, payload, resolve);
  });
}
async function ok<E extends C2SEventName>(c: Conn, event: E, payload: C2SPayload<E>) {
  const result = await send(c, event, payload);
  if (!result.ok) throw new Error(`${event}: ${result.error.code} ${result.error.message}`);
  return result.data;
}
async function connect(url: string): Promise<Conn> {
  const socket: Client = io(url, { transports: ["websocket"], forceNew: true });
  clients.push(socket);
  const conn: Conn = { socket, state: {}, received: [] };
  socket.on("state:sync", (view) => {
    conn.state.view = view;
    conn.received.push(view);
  });
  socket.on("state:patch", (patch) => {
    if (conn.state.view) conn.state.view = applyPatch(conn.state.view, patch);
    conn.received.push(patch);
  });
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  return conn;
}
const until = (check: () => boolean) => expect.poll(check, { timeout: 3000, interval: 10 }).toBe(true);
const wv = (c: Conn) => c.state.view?.game?.shared as WerewolfView | undefined;
let commands = 0;
const cmd = () => `c${++commands}`;

/** The decoded game view of every sync/patch a client has received so far. */
function views(c: Conn): WerewolfView[] {
  return c.received.flatMap((v) => (v.game?.shared ? [v.game.shared as WerewolfView] : []));
}

it("plays a round over Socket.IO: whole-lobby start, secrets filtered, late join, verdict", async () => {
  let now = 1_000_000;
  server = await createServer({ now: () => now, seed: 5 });
  const url = await server.listen(0, "127.0.0.1");
  const host = await connect(url);
  const { code, hostToken } = await ok(host, "lobby:create", {});
  await ok(host, "host:attach", { code, hostToken });
  const projector = await connect(url);
  await ok(projector, "display:watch", { code });
  const students: Student[] = [];
  for (let i = 0; i < 6; i++) {
    const c = await connect(url);
    const joined = await ok(c, "lobby:join", { code, name: `Student ${i}` });
    students.push(Object.assign(c, { id: joined.playerId }));
  }
  const lobby = server.manager.get(code);
  const internal = () => lobby.game!.shared as WerewolfShared;
  const advance = (ms: number) => {
    now += ms;
    lobby.settleSharedDeadlines();
  };
  const byId = (id: string) => students.find((s) => s.id === id)!;

  // The whole lobby plays one game: no group assignment step.
  await ok(host, "game:select", { gameId: "werewolf", commandId: cmd() });
  await ok(host, "game:control", { cmd: "prepare", commandId: cmd() });
  expect(lobby.groups).toHaveLength(1);
  await until(() => wv(host)?.stage === "SETUP");

  // Only the host can start; a player and the projector are refused.
  for (const c of [students[0]!, projector]) {
    const denied = await send(c, "game:hostAction", { type: "ww:start", commandId: cmd() });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe("UNAUTHORIZED");
  }
  expect((await send(students[0]!, "game:action", { type: "ww:start" })).ok).toBe(false);
  await ok(host, "game:hostAction", { type: "ww:start", commandId: cmd() });

  // Every player is told only their own role.
  await until(() => students.every((s) => wv(s)?.me?.role));
  const roleOf = (id: string) => internal().players[id]!.role;
  for (const s of students) expect(wv(s)!.me!.role).toBe(roleOf(s.id));
  const withRole = (r: string) => students.filter((s) => roleOf(s.id) === r);
  const wolves = withRole("werewolf");
  const [seer] = withRole("seer");
  const [guard] = withRole("guard");
  const villagers = withRole("villager");
  expect(wolves).toHaveLength(2);
  expect(villagers).toHaveLength(2);

  advance(10_000); // REVEAL -> NIGHT 1
  await until(() => wv(host)?.stage === "NIGHT");
  const victim = villagers[0]!;
  for (const w of wolves) await ok(w, "game:action", { type: "ww:wolfVote", payload: { targetId: victim.id } });
  await ok(seer!, "game:action", { type: "ww:seerPick", payload: { targetId: wolves[0]!.id } });
  await ok(guard!, "game:action", { type: "ww:guardPick", payload: { targetId: villagers[1]!.id } });
  await until(() => wv(host)?.hostNight?.guardPick === villagers[1]!.id);
  expect(wv(seer!)!.me!.seerLog).toEqual([{ night: 1, targetId: wolves[0]!.id, isWerewolf: true }]);

  advance(30_000); // night ends -> DAWN: the victim dies
  await until(() => wv(projector)?.stage === "DAWN");
  expect(wv(projector)!.dawn).toEqual({ eliminatedId: victim.id });
  advance(8_000);
  advance(180_000); // DISCUSSION -> VOTE
  await until(() => wv(host)?.stage === "VOTE");

  // A late joiner waits as pending; the host picks a harmless role; they cannot vote yet.
  const late = await connect(url);
  const joined = await ok(late, "lobby:join", { code, name: "Latecomer" });
  await until(() => wv(late)?.me?.pending === true);
  expect(wv(late)!.me!.role).toBeNull();
  await ok(host, "game:hostAction", {
    type: "ww:setRole",
    payload: { playerId: joined.playerId, role: "villager" },
    commandId: cmd(),
  });
  expect((await send(late, "game:action", { type: "ww:dayVote", payload: { targetId: wolves[0]!.id } })).ok).toBe(
    false,
  );

  // 5 living players need 3 votes; the pending joiner does not change that.
  expect(wv(projector)!.needed).toBe(3);
  const target = wolves[0]!;
  for (const s of [seer!, guard!, villagers[1]!])
    await ok(s, "game:action", { type: "ww:dayVote", payload: { targetId: target.id } });
  await until(() => wv(projector)?.voteCounts[target.id] === 3);
  expect(wv(projector)!.stage).toBe("VOTE");
  advance(60_000); // vote closes -> VERDICT
  await until(() => wv(projector)?.stage === "VERDICT");
  expect(wv(projector)!.lastVote).toEqual({ eliminatedId: target.id, counts: { [target.id]: 3 } });
  advance(9_000); // VERDICT -> NIGHT 2
  await until(() => wv(host)?.stage === "NIGHT" && wv(host)!.night === 2);

  // Secrets: nobody but the host ever received roles or night/vote details before the game ended.
  for (const c of [projector, ...students, late]) {
    for (const v of views(c)) {
      expect(v.roles).toBeNull();
      expect(v.hostNight).toBeNull();
      expect(v.hostVotes).toBeNull();
      expect(v.winner).toBeNull();
    }
  }
  for (const v of views(projector)) expect(v.me).toBeNull();
  for (const s of students) for (const v of views(s)) if (v.me) expect(v.me.role).toBe(roleOf(s.id));
  expect(views(host).some((v) => v.roles !== null)).toBe(true);
  expect(byId(victim.id).id).toBe(victim.id);
});
