import { performance } from "node:perf_hooks";
import { io, type Socket } from "socket.io-client";
import { applyPatch, createRng } from "@cangsplayground/core";
import { createServer } from "../src/index.js";
import type { WhosTheSpyGroupView } from "@cangsplayground/game-whos-the-spy";
import type {
  LobbyView,
  Ack,
  C2SEventName,
  C2SPayload,
  C2SResults,
  ClientToServerEvents,
  LobbyPatch,
  ServerToClientEvents,
} from "@cangsplayground/core";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
const args = process.argv.slice(2);
const argument = (name: string, fallback: string) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : (args[index + 1] ?? fallback);
};
const gameId = argument("--game", "free-talk");
let url = argument("--url", "http://localhost:3000");
let localServer: Awaited<ReturnType<typeof createServer>> | undefined;
const views = new Map<Client, LobbyView>();
const rng = createRng(17);
const count = Number(argument("--clients", "30"));
const sockets: Client[] = [];
let host: Client | undefined;
let code: string | undefined;
let sequence = 0;
const commandId = () => `sim-${++sequence}`;
async function connect() {
  const socket: Client = io(url, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
  });
  sockets.push(socket);
  socket.on("state:sync", (view) => views.set(socket, view));
  socket.on("state:patch", (patch) => {
    const view = views.get(socket);
    if (view) views.set(socket, applyPatch(view, patch));
  });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Connection timed out.")), 5000);
    socket.once("connect", () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
  return socket;
}
function send<E extends C2SEventName>(
  socket: Client,
  event: E,
  payload: C2SPayload<E>,
): Promise<C2SResults[E]> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${event} timed out.`)), 5000);
    const emit = socket.emit.bind(socket) as (
      event: E,
      payload: C2SPayload<E>,
      ack: (result: Ack<C2SResults[E]>) => void,
    ) => void;
    emit(event, payload, (result) => {
      clearTimeout(timeout);
      if (result.ok) resolve(result.data);
      else reject(new Error(`${result.error.code}: ${result.error.message}`));
    });
  });
}
try {
  if (!Number.isInteger(count) || count < 2 || count > 60) throw new Error("Use 2 to 60 clients.");
  if (gameId === "whos-the-spy" && !args.includes("--url")) {
    localServer = await createServer({ seed: 7 });
    url = await localServer.listen(0, "127.0.0.1");
  }
  if (gameId === "whos-the-spy" && count < 3)
    throw new Error("Who's the Spy needs at least 3 clients.");
  host = await connect();
  const lobby = await send(host, "lobby:create", {});
  code = lobby.code;
  await send(host, "host:attach", lobby);
  const players = await Promise.all(
    Array.from({ length: count }, async (_, index) => {
      const socket = await connect();
      await send(socket, "lobby:join", { code: code!, name: `Sim${index + 1}` });
      return socket;
    }),
  );
  const samples: number[] = [];
  async function measured(run: () => Promise<unknown>, matches: (patch: LobbyPatch) => boolean) {
    const started = performance.now();
    const received = players.map(
      (socket) =>
        new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            socket.off("state:patch", listener);
            reject(new Error("State patch timed out."));
          }, 5000);
          const listener = (patch: LobbyPatch) => {
            if (!matches(patch)) return;
            socket.off("state:patch", listener);
            clearTimeout(timeout);
            samples.push(performance.now() - started);
            resolve();
          };
          socket.on("state:patch", listener);
        }),
    );
    await Promise.all([run(), ...received]);
  }
  await measured(
    () =>
      send(host!, "groups:assign", {
        mode: "count",
        value: Math.min(4, Math.floor(count / (gameId === "whos-the-spy" ? 3 : 2))),
        commandId: commandId(),
      }),
    (patch) => patch.groupsVersion === 1,
  );
  await measured(
    () => send(host!, "game:select", { gameId, commandId: commandId() }),
    (patch) => patch.game?.stage === "CONFIGURING",
  );
  await measured(
    () => send(host!, "game:control", { cmd: "prepare", commandId: commandId() }),
    (patch) => patch.game?.groups[0]?.phase === "PREPARED",
  );
  await measured(
    () => send(host!, "game:control", { cmd: "start", commandId: commandId() }),
    (patch) => patch.game?.groups[0]?.phase === "RUNNING",
  );
  if (gameId === "whos-the-spy") {
    const waitFor = async (check: () => boolean) => {
      const deadline = Date.now() + 5000;
      while (!check()) {
        if (Date.now() > deadline) throw new Error("Game state timed out.");
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    };
    for (let cycle = 0; cycle < 200; cycle++) {
      const session = views.get(host!)!.game!;
      if (session.groups.every((g) => g.phase === "FINISHED")) break;
      for (const group of session.groups) {
        const phase = group.phase;
        if (phase === "FINISHED") continue;

        if (phase === "ROUND_END" && !(group.data as WhosTheSpyGroupView).result)
          await send(host!, "game:control", {
            cmd: "nextRound",
            groupId: group.groupId,
            commandId: commandId(),
          });
        else if (phase === "RUNNING") {
          const speaker = players.find(
            (socket) => views.get(socket)?.me?.playerId === group.currentSpeakerId,
          )!;
          await send(speaker, "game:action", { type: "turn:done" });
        } else if (phase === "VOTING") {
          const summary = views.get(host!)!.groups.find((g) => g.id === group.groupId)!;
          const active = summary.playerIds.filter((id) => !group.eliminated.includes(id));
          for (const actor of active) {
            const socket = players.find((p) => views.get(p)?.me?.playerId === actor)!;
            const candidates = active.filter((id) => id !== actor);
            await send(socket, "game:action", {
              type: "vote",
              payload: { targetId: candidates[rng.int(candidates.length)]! },
            });
          }
        } else throw new Error(`Unexpected phase ${phase}`);
        await waitFor(() => {
          const current = views.get(host!)!.game!.groups.find((g) => g.groupId === group.groupId)!;
          return (
            current.phase !== phase ||
            current.turnIndex !== group.turnIndex ||
            current.round !== group.round
          );
        });
      }
    }
    const view = views.get(host!)!;
    if (!view.game!.groups.every((g) => g.phase === "FINISHED"))
      throw new Error("Simulation did not finish.");
    for (const group of view.game!.groups) {
      const name = view.groups.find((g) => g.id === group.groupId)!.name;
      process.stdout.write(
        `${name}: ${JSON.stringify((group.data as WhosTheSpyGroupView).result)}\n`,
      );
    }
  } else
    for (let i = 0; i < 5; i++)
      await measured(
        () =>
          send(host!, "game:control", {
            cmd: i % 2 === 0 ? "pause" : "resume",
            commandId: commandId(),
          }),
        (patch) => patch.game?.groups[0]?.phase === (i % 2 === 0 ? "PAUSED" : "RUNNING"),
      );
  samples.sort((a, b) => a - b);
  const percentile = (p: number) =>
    samples[Math.min(samples.length - 1, Math.ceil(samples.length * p) - 1)]!.toFixed(2);
  process.stdout.write(
    `Lobby ${code}: ${count} clients, ${samples.length} state:patch samples\np50 latency: ${percentile(0.5)} ms\np95 latency: ${percentile(0.95)} ms\n`,
  );
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  if (host?.connected && code)
    try {
      await send(host, "lobby:close", { commandId: commandId() });
    } catch {
      process.exitCode = 1;
    }
  for (const socket of sockets) socket.disconnect();
  await localServer?.close();
}
