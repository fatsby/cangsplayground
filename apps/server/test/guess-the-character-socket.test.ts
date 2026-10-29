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
import type { GuessShared, GuessView } from "@cangsplayground/game-guess-the-character";
import { createServer } from "../src/index.js";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
interface Conn {
  socket: Client;
  state: { view?: LobbyView };
  /** Every sync and patch this client received, for leak checks. */
  received: (LobbyView | LobbyPatch)[];
}
const clients: Client[] = [];
let server: Awaited<ReturnType<typeof createServer>> | undefined;
let testNow = 1_000_000;
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
const until = (check: () => boolean) =>
  expect.poll(check, { timeout: 3000, interval: 10 }).toBe(true);
const gv = (c: Conn) => c.state.view?.game?.shared as GuessView | undefined;
let commands = 0;
const cmd = () => `c${++commands}`;

/** Text of everything a client received about the game, without static category examples. */
function receivedText(c: Conn): string {
  return c.received
    .map((v) => {
      const shared = v.game?.shared as GuessView | undefined;
      if (!shared) return "";
      return JSON.stringify({ ...shared, categories: [] });
    })
    .join("\n");
}

it("plays two concurrent matches over Socket.IO with filtered secrets", async () => {
  testNow = 1_000_000;
  server = await createServer({ now: () => testNow, seed: 3 });
  const url = await server.listen(0, "127.0.0.1");
  const host = await connect(url);
  const { code, hostToken } = await ok(host, "lobby:create", {});
  await ok(host, "host:attach", { code, hostToken });
  const projector = await connect(url);
  await ok(projector, "display:watch", { code });
  const students: (Conn & { id: string; token: string })[] = [];
  for (let i = 0; i < 8; i++) {
    const c = await connect(url);
    const joined = await ok(c, "lobby:join", { code, name: `Student ${i}` });
    students.push(Object.assign(c, { id: joined.playerId, token: joined.playerToken }));
  }
  const lobby = server.manager.get(code);
  const internal = () => lobby.game!.shared as GuessShared;
  await ok(host, "groups:assign", { mode: "count", value: 4, commandId: cmd() });
  await ok(host, "game:select", { gameId: "guess-the-character", commandId: cmd() });
  await ok(host, "game:configure", {
    config: { voteSeconds: 10, turnSeconds: 15, cooldownSeconds: 1 },
    commandId: cmd(),
  });
  await ok(host, "game:control", { cmd: "prepare", commandId: cmd() });

  // Only the host can drive the round.
  for (const c of [students[0]!, projector]) {
    const denied = await send(c, "game:hostAction", {
      type: "gc:start",
      payload: { round: 1 },
      commandId: cmd(),
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe("UNAUTHORIZED");
  }
  const playerStart = await send(students[0]!, "game:action", {
    type: "gc:start",
    payload: { round: 1 },
  });
  expect(playerStart.ok).toBe(false);

  await ok(host, "game:hostAction", { type: "gc:start", payload: { round: 1 }, commandId: cmd() });
  await until(() => gv(students[7]!)?.matches.every((m) => m.phase === "CATEGORY_VOTE") === true);

  // The two pairs vote for different categories.
  const [m1, m2] = internal().matches;
  const guardOf = (i: number) => {
    const m = internal().matches[i]!;
    return { round: internal().round, matchId: m.id, phaseVersion: m.phaseVersion };
  };
  const byId = (id: string) => students.find((s) => s.id === id)!;
  for (const id of [...m1!.teams[0].members, ...m1!.teams[1].members])
    await ok(byId(id), "game:action", {
      type: "gc:vote",
      payload: { ...guardOf(0), categoryId: "famous-villains" },
    });
  for (const id of [...m2!.teams[0].members, ...m2!.teams[1].members])
    await ok(byId(id), "game:action", {
      type: "gc:vote",
      payload: { ...guardOf(1), categoryId: "anime-manga" },
    });
  await until(() => gv(projector)?.matches.every((m) => m.votedCount === 4) === true);

  testNow += 10_000;
  lobby.settleSharedDeadlines();
  await until(() => gv(students[0]!)?.matches.every((m) => m.phase === "PLAYING") === true);
  expect(internal().matches.map((m) => m.categoryId)).toEqual(["famous-villains", "anime-manga"]);
  const secret = (i: number, side: 0 | 1) => internal().matches[i]!.teams[side].characterId!;
  const hostView = gv(host)!;
  const nameOf = (i: number, side: 0 | 1) =>
    hostView.privateMatches[i]!.characters[side]!.character!.name;

  // While playing, nobody but the host receives an opponent's (or another pair's) secret.
  const assertNoLeaks = (finished: number[]) => {
    for (const s of students) {
      const text = receivedText(s);
      internal().matches.forEach((m, i) => {
        const side = m.teams[0].members.includes(s.id)
          ? 0
          : m.teams[1].members.includes(s.id)
            ? 1
            : null;
        for (const t of [0, 1] as const) {
          const allowed = side === t || (side !== null && finished.includes(i));
          if (!allowed) {
            expect(text).not.toContain(`"id":"${secret(i, t)}"`);
            expect(text).not.toContain(`"name":"${nameOf(i, t)}"`);
          }
        }
      });
    }
    const p = receivedText(projector);
    for (const i of [0, 1])
      for (const t of [0, 1] as const) {
        expect(p).not.toContain(`"id":"${secret(i, t)}"`);
        expect(p).not.toContain(`"name":"${nameOf(i, t)}"`);
      }
  };
  assertNoLeaks([]);

  // A correct guess from a non-speaker of match 1, team 0, ends only that match.
  const match1 = internal().matches[0]!;
  const guesser = match1.teams[0].members.find((id) => id !== match1.speakerId)!;
  const oldTurn = { ...guardOf(0), turnId: match1.turnId };
  const oldSpeaker = match1.speakerId!;
  const guess = {
    ...guardOf(0),
    guessVersion: match1.teams[0].guessVersion,
    name: nameOf(0, 1).toUpperCase(),
  };
  await ok(byId(guesser), "game:action", { type: "gc:guess", payload: guess });
  await until(() => gv(projector)?.matches[0]!.phase === "FINISHED");
  expect(gv(projector)!.matches[0]!.winnerGroupId).toBe(match1.teams[0].groupId);
  expect(gv(projector)!.matches[1]!.phase).toBe("PLAYING");
  // Stale done and a replayed guess change nothing.
  const turnsBefore = internal().matches.map((m) => m.turnId);
  expect(
    (await send(byId(oldSpeaker), "game:action", { type: "gc:done", payload: oldTurn })).ok,
  ).toBe(false);
  expect((await send(byId(guesser), "game:action", { type: "gc:guess", payload: guess })).ok).toBe(
    false,
  );
  const otherTeam = match1.teams[1].members[0]!;
  expect(
    (
      await send(byId(otherTeam), "game:action", {
        type: "gc:guess",
        payload: { ...guardOf(0), guessVersion: 0, name: nameOf(0, 0) },
      })
    ).ok,
  ).toBe(false);
  expect(internal().matches.map((m) => m.turnId)).toEqual(turnsBefore);
  expect(internal().matches[0]!.winnerGroupId).toBe(match1.teams[0].groupId);
  // Finished participants now see both answers; the other pair and projector still don't.
  await until(
    () =>
      gv(byId(otherTeam))?.privateMatches[0]?.characters.every((c) => c.character !== null) ===
      true,
  );
  assertNoLeaks([0]);

  // Match 2: a wrong guess (1 s cooldown), then a disconnect and resume restore state.
  const match2 = internal().matches[1]!;
  const wrong = match2.teams[1].members[0]!;
  await ok(byId(wrong), "game:action", {
    type: "gc:guess",
    payload: { ...guardOf(1), guessVersion: 0, name: "Nobody Special" },
  });
  const cooldown = internal().matches[1]!.teams[1].cooldown;
  expect(cooldown.endsAt).toBe(testNow + 1000);
  const reloading = byId(wrong);
  reloading.socket.disconnect();
  const back = await connect(url);
  await ok(back, "session:resume", { token: reloading.token });
  await until(() => gv(back)?.ownMatchId === match2.id);
  const restored = gv(back)!;
  expect(restored.privateMatches[0]!.teams[0]!.cooldown).toEqual(cooldown);
  expect(restored.matches[1]!.timer).toEqual(internal().matches[1]!.timer);
  expect(restored.privateMatches[0]!.characters[1]!.character!.id).toBe(secret(1, 1));
  expect(restored.privateMatches[0]!.characters[0]!.character).toBeNull();

  // The second match finishes independently.
  testNow += 1000;
  const winner = match2.teams[1].members[1]!;
  await ok(byId(winner), "game:action", {
    type: "gc:guess",
    payload: { ...guardOf(1), guessVersion: 1, name: nameOf(1, 0) },
  });
  await until(() => gv(host)?.canNewRound === true);

  // New round: new IDs, a new vote deadline, and previous-round actions rejected.
  const previous = guardOf(1);
  await ok(host, "game:hostAction", {
    type: "gc:newRound",
    payload: { round: 1 },
    commandId: cmd(),
  });
  await until(() => gv(students[0]!)?.round === 2);
  expect(internal().matches.map((m) => m.id)).toEqual(["r2m1", "r2m2"]);
  expect(internal().matches.every((m) => m.phase === "CATEGORY_VOTE")).toBe(true);
  expect(lobby.sharedDeadlines().map((d) => d.endsAt)).toEqual([
    testNow + 10_000,
    testNow + 10_000,
  ]);
  expect(
    (
      await send(byId(winner), "game:action", {
        type: "gc:vote",
        payload: { ...previous, categoryId: "superheroes" },
      })
    ).ok,
  ).toBe(false);
  expect(gv(projector)!.privateMatches).toEqual([]);
});
