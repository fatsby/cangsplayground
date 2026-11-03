import { afterEach, expect, it, vi } from "vitest";
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
import {
  availableActions,
  proofSets,
  type MurderShared,
  type MurderView,
} from "@cangsplayground/game-murder-mystery";
import { createServer } from "../src/index.js";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
interface Conn {
  socket: Client;
  state: { view?: LobbyView };
  /** Every sync and patch this client received, for leak checks. */
  received: (LobbyView | LobbyPatch)[];
}
const forced = vi.hoisted(() => ({ sceneId: "manor-night" as "manor-night" | "hotel-night" }));
vi.mock("../../../packages/games/murder-mystery/src/generate.ts", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../packages/games/murder-mystery/src/generate.ts")>();
  return {
    ...actual,
    generateCase: (seed: number) => {
      const drawn = actual.generateCase(seed);
      return actual.generateCase(seed, {
        familyId: drawn.familyId,
        variantId: drawn.variantId,
        sceneId: forced.sceneId,
      });
    },
  };
});
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
const mv = (c: Conn) => c.state.view?.game?.shared as MurderView | undefined;
let commands = 0;
const cmd = () => `c${++commands}`;
const everything = (c: Conn) => JSON.stringify(c.received);
const gameTraffic = (c: Conn) =>
  c.received.flatMap((message) =>
    message.game?.shared ? [message.game.shared as MurderView] : [],
  );

it.each(["manor-night", "hotel-night"] as const)(
  "plays %s over Socket.IO with private clues and one shared reveal",
  async (sceneId) => {
    forced.sceneId = sceneId;
    testNow = 1_000_000;
    server = await createServer({ now: () => testNow, seed: 3 });
    const url = await server.listen(0, "127.0.0.1");
    const host = await connect(url);
    const { code, hostToken } = await ok(host, "lobby:create", {});
    await ok(host, "host:attach", { code, hostToken });
    const projector = await connect(url);
    await ok(projector, "display:watch", { code });
    const students: (Conn & { id: string })[] = [];
    for (let i = 0; i < 7; i++) {
      const c = await connect(url);
      const joined = await ok(c, "lobby:join", { code, name: `Student ${i}` });
      students.push(Object.assign(c, { id: joined.playerId }));
    }
    const lobby = server.manager.get(code);
    const internal = () => lobby.game!.shared as MurderShared;
    const byId = (id: string) => students.find((s) => s.id === id)!;
    const guard = () => ({
      caseInstanceId: internal().caseInstanceId,
      caseNumber: internal().caseNumber,
      phaseVersion: internal().phaseVersion,
    });
    const hostCmd = (type: string, extra: Record<string, unknown> = {}) =>
      ok(host, "game:hostAction", { type, payload: { ...guard(), ...extra }, commandId: cmd() });
    const play = (id: string, type: string, extra: Record<string, unknown>) =>
      ok(byId(id), "game:action", { type, payload: { ...guard(), ...extra } });

    await ok(host, "groups:assign", { mode: "count", value: 2, commandId: cmd() });
    await ok(host, "game:select", { gameId: "murder-mystery", commandId: cmd() });
    await ok(host, "game:control", { cmd: "prepare", commandId: cmd() });
    await until(() => students.every((s) => mv(s)?.phase === "READY"));
    for (const s of students) {
      expect(mv(s)!.briefing).toBeNull();
      expect(mv(s)!.intro).toBeNull();
    }
    expect(mv(projector)!.briefing).toBeNull();

    // Only the host can start.
    for (const c of [students[0]!, projector]) {
      const denied = await send(c, "game:hostAction", {
        type: "mm:start",
        payload: guard(),
        commandId: cmd(),
      });
      expect(denied.ok).toBe(false);
      if (!denied.ok) expect(denied.error.code).toBe("UNAUTHORIZED");
    }
    expect(
      (await send(students[0]!, "game:action", { type: "mm:start", payload: guard() })).ok,
    ).toBe(false);

    await hostCmd("mm:start");
    await until(() => mv(projector)?.phase === "INTRO" && mv(host)?.phase === "INTRO");
    expect(mv(projector)!.intro).not.toBeNull();
    expect(mv(projector)!.briefing).not.toBeNull();
    expect(mv(host)!.intro).not.toBeNull();
    await until(() => students.every((s) => mv(s)?.phase === "INTRO"));
    for (const s of students) {
      expect(mv(s)!.briefing).toBeNull();
      expect(mv(s)!.intro).toBeNull();
    }
    const caseData = internal().caseData;
    expect(caseData.sceneId).toBe(sceneId);
    // a projector that reconnects mid-intro receives the same clock
    testNow += 6_000;
    const reconnected = await connect(url);
    await ok(reconnected, "display:watch", { code });
    await until(() => mv(reconnected)?.phase === "INTRO");
    expect(mv(reconnected)!.clock).toEqual(mv(projector)!.clock);

    // INTRO ends by itself after 13 seconds on the server clock
    testNow += 7_000;
    lobby.settleSharedDeadlines();
    await until(() => students.every((s) => mv(s)?.phase === "BRIEFING"));
    expect(mv(students[0]!)!.briefing).not.toBeNull();
    expect(mv(students[0]!)!.clock.endsAt).toBe(testNow + 120_000);

    await hostCmd("mm:next");
    await hostCmd("mm:next");
    await until(() => students.every((s) => mv(s)?.phase === "INVESTIGATION"));

    // two teams take different valid routes
    const { logic } = caseData;
    const routes: string[][] = [];
    const walk = (used: string[]) => {
      const known = [
        ...logic.initialCardIds,
        ...used.flatMap((id) => logic.actions.find((a) => a.id === id)!.resultCardIds),
      ];
      if (used.length === 4) return void routes.push(used);
      for (const a of availableActions(logic, used, known)) walk([...used, a.id]);
    };
    walk([]);
    const first = routes[0]!;
    const second = routes.find((r) => [...r].sort().join() !== [...first].sort().join()) ?? first;
    const chosen = [first, second];
    const staleInvestigation = { ...guard(), round: 1, actionId: first[0] };
    for (let round = 1; round <= 4; round++) {
      for (const [i, t] of internal().teams.entries()) {
        await play(t.leadOrder[round - 1]!, "mm:investigate", {
          round,
          actionId: chosen[i]![round - 1],
        });
      }
      await hostCmd("mm:next");
      const snapshot = JSON.stringify(internal());
      expect(
        (
          await send(byId(internal().teams[0]!.leadOrder[0]!), "game:action", {
            type: "mm:investigate",
            payload: staleInvestigation,
          })
        ).ok,
      ).toBe(false);
      expect(JSON.stringify(internal())).toBe(snapshot);
    }
    await until(() => students.every((s) => mv(s)?.phase === "CONCLUSION"));

    const cardsOf = (route: string[]) => [
      ...logic.initialCardIds,
      ...route.flatMap((id) => logic.actions.find((a) => a.id === id)!.resultCardIds),
    ];
    const staleSubmit = { ...guard(), draftVersion: 1 };
    for (const [i, t] of internal().teams.entries()) {
      const known = cardsOf(chosen[i]!);
      const conclusion = {
        ...caseData.reveal.answer,
        evidence: {
          suspectId: proofSets(logic, known, "suspectId")[0]!,
          weaponId: proofSets(logic, known, "weaponId")[0]!,
          roomId: proofSets(logic, known, "roomId")[0]!,
        },
      };
      const submitter = t.leadOrder[3]!;
      await play(submitter, "mm:saveDraft", { draftVersion: 0, conclusion });
      await play(submitter, "mm:submit", { draftVersion: 1 });
    }
    await hostCmd("mm:next");
    await until(() => students.every((s) => mv(s)?.phase === "AWAITING_REVEAL"));

    // nothing about results or the solution has reached any phone or the projector yet
    for (const c of [...students, projector]) {
      expect(mv(c)!.results).toBeNull();
      expect(mv(c)!.reveal).toBeNull();
      expect(mv(c)!.revealStartedAt).toBeNull();
      expect(everything(c)).not.toContain('"score"');
      expect(everything(c)).not.toContain(caseData.reveal.events[0]!);
      for (const message of gameTraffic(c)) {
        expect(message.revealStartedAt).toBeNull();
        expect(message.results).toBeNull();
        expect(message.reveal).toBeNull();
      }
    }

    const revealCommand = { type: "mm:reveal", payload: guard(), commandId: cmd() };
    await ok(host, "game:hostAction", revealCommand);
    await until(
      () =>
        students.every((s) => mv(s)?.phase === "REVEALED") && mv(projector)?.phase === "REVEALED",
    );
    const at = mv(projector)!.revealStartedAt;
    expect(at).toBe(testNow);
    for (const c of [...students, host]) expect(mv(c)!.revealStartedAt).toBe(at);
    expect(mv(students[0]!)!.results!.map((r) => r.score.total)).toEqual([10, 10]);
    expect(mv(projector)!.results).toEqual(mv(students[0]!)!.results);

    // leak checks over every snapshot and patch the clients ever saw
    const teamA = new Set(internal().teams[0]!.members);
    const onlyB = cardsOf(second).filter((id) => !cardsOf(first).includes(id));
    for (const s of students) {
      const text = everything(s);
      for (const word of ["actualWorldId", "publicConstraint", "proofSets", '"worlds"']) {
        expect(text, `${s.id} ${word}`).not.toContain(word);
      }
      for (const message of gameTraffic(s)) {
        expect(message.intro).toBeNull();
        expect(JSON.stringify(message)).not.toContain('"seed"');
      }
      expect(text).not.toContain(caseData.intro.captions.setting);
      expect(text).not.toContain('"suspectBadges"');
      if (teamA.has(s.id) && first !== second) {
        for (const id of onlyB) expect(text).not.toContain(caseData.cards[id]!.body);
      }
    }
    for (const c of [projector, reconnected]) {
      const text = everything(c);
      for (const face of Object.values(caseData.cards)) expect(text).not.toContain(face.body);
    }
    await hostCmd("mm:newCase");
    const snapshot = JSON.stringify(internal());
    // A cached host command returns its old ack and must not reveal the replacement case.
    await ok(host, "game:hostAction", revealCommand);
    expect(
      (await send(students[0]!, "game:action", { type: "mm:submit", payload: staleSubmit })).ok,
    ).toBe(false);
    expect(JSON.stringify(internal())).toBe(snapshot);
  },
  30_000,
);

it("restores private cards on resume, transfers an offline lead and excludes same-name rejoiners", async () => {
  server = await createServer({ seed: 3 });
  const url = await server.listen(0, "127.0.0.1");
  const host = await connect(url);
  const { code, hostToken } = await ok(host, "lobby:create", {});
  await ok(host, "host:attach", { code, hostToken });
  const students = [];
  for (let i = 0; i < 7; i++) {
    const conn = await connect(url);
    const joined = await ok(conn, "lobby:join", { code, name: `Student ${i}` });
    students.push({ conn, ...joined, name: `Student ${i}` });
  }
  await ok(host, "groups:assign", { mode: "count", value: 2, commandId: cmd() });
  await ok(host, "game:select", { gameId: "murder-mystery", commandId: cmd() });
  await ok(host, "game:control", { cmd: "prepare", commandId: cmd() });
  const lobby = server.manager.get(code);
  const state = () => lobby.game!.shared as MurderShared;
  const hostCmd = (type: string, extra: Record<string, unknown> = {}) =>
    ok(host, "game:hostAction", {
      type,
      payload: {
        caseInstanceId: state().caseInstanceId,
        caseNumber: state().caseNumber,
        phaseVersion: state().phaseVersion,
        ...extra,
      },
      commandId: cmd(),
    });
  await hostCmd("mm:start");
  await hostCmd("mm:next");
  await hostCmd("mm:next");
  const team = () => state().teams[0]!;
  const ownerId = Object.values(team().owners)[0]!;
  const owner = students.find((s) => s.playerId === ownerId)!;
  await until(() => mv(owner.conn)?.phase === "SHARING");
  const cards = mv(owner.conn)!.ownTeam!.myCards;
  expect(cards.length).toBeGreaterThan(0);
  owner.conn.socket.disconnect();
  await until(() => !team().connected.includes(ownerId));
  const resumed = await connect(url);
  await ok(resumed, "session:resume", { token: owner.playerToken });
  await until(() => mv(resumed)?.ownTeam?.myCards.length === cards.length);
  expect(mv(resumed)!.ownTeam!.myCards).toEqual(cards);
  owner.conn = resumed;
  await hostCmd("mm:next");
  const lead = students.find((s) => s.playerId === team().leadOrder[0])!;
  lead.conn.socket.disconnect();
  await until(() => !team().connected.includes(lead.playerId));
  const targetId = team().connected[0]!;
  const target = students.find((s) => s.playerId === targetId)!;
  const count = team().history.length;
  await hostCmd("mm:transfer", {
    groupId: team().groupId,
    fromPlayerId: lead.playerId,
    toPlayerId: targetId,
  });
  await until(() => mv(target.conn)?.ownTeam?.canInvestigate === true);
  expect(team().history).toHaveLength(count);
  for (const card of Object.keys(team().owners).filter((id) => team().owners[id] === targetId)) {
    expect(mv(target.conn)!.ownTeam!.myCards.map((c) => c.id)).toContain(card);
  }
  const kicked = students.find(
    (s) => team().members.includes(s.playerId) && s.playerId !== targetId,
  )!;
  const beforeKick = kicked.conn.received.length;
  await ok(host, "lobby:kick", { playerId: kicked.playerId, commandId: cmd() });
  const replacement = await connect(url);
  const joined = await ok(replacement, "lobby:join", { code, name: kicked.name });
  expect(joined.playerId).not.toBe(kicked.playerId);
  await until(() => mv(replacement)?.phase === "INVESTIGATION");
  expect(mv(replacement)!.ownTeam).toBeNull();
  expect((await send(replacement, "session:resume", { token: kicked.playerToken })).ok).toBe(false);
  expect(
    (
      await send(replacement, "game:action", {
        type: "mm:investigate",
        payload: {
          caseInstanceId: state().caseInstanceId,
          caseNumber: state().caseNumber,
          phaseVersion: state().phaseVersion,
          round: 1,
          actionId: "anything",
        },
      })
    ).ok,
  ).toBe(false);
  const option = mv(target.conn)!.ownTeam!.options[0]!;
  await ok(target.conn, "game:action", {
    type: "mm:investigate",
    payload: {
      caseInstanceId: state().caseInstanceId,
      caseNumber: state().caseNumber,
      phaseVersion: state().phaseVersion,
      round: 1,
      actionId: option.id,
    },
  });
  await until(() => mv(target.conn)?.ownTeam?.history.length === 1);
  expect(kicked.conn.received).toHaveLength(beforeKick);
  for (const card of Object.values(state().caseData.cards))
    expect(everything(replacement)).not.toContain(card.body);
}, 30_000);
