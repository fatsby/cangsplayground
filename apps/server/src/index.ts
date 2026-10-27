import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { Server } from "socket.io";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { existsSync } from "node:fs";
import type { ClientToServerEvents, ServerToClientEvents, Viewer } from "@cangsplayground/core";
import { Broadcaster, type AppSocket } from "./broadcast.js";
import { readConfig } from "./config.js";
import { LobbyManager } from "./lobby/LobbyManager.js";
import type { Lobby } from "./lobby/Lobby.js";
import { RateLimiter } from "./auth/RateLimiter.js";
import { TimerService } from "./timer/TimerService.js";
import { makeRegister, type Attachment, type HandlerContext } from "./handlers/context.js";
import { registerLobby } from "./handlers/lobby.js";
import { registerSession } from "./handlers/session.js";
import { registerGroups } from "./handlers/groups.js";
import { registerGame } from "./handlers/game.js";

export async function createServer(
  options: {
    now?: () => number;
    seed?: number;
    ttlMinutes?: number;
    publicUrl?: string;
    production?: boolean;
    webRoot?: string;
  } = {},
) {
  const config = readConfig();
  const app = Fastify();
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(app.server, {
    cors: { origin: true },
    maxHttpBufferSize: 64000,
  });
  const manager = new LobbyManager({
    ...options,
    ttlMinutes: options.ttlMinutes ?? config.ttlMinutes,
  });
  const broadcaster = new Broadcaster(),
    limiter = new RateLimiter(manager.now),
    timers = new TimerService(manager.now);
  const attached = new Map<string, Attachment>();
  const roomNames = (a: Attachment) => {
    const rooms = [`lobby:${a.lobby.code}:public`];
    if (a.viewer.kind === "host") rooms.push(`lobby:${a.lobby.code}:host`);
    if (a.viewer.kind === "player") {
      rooms.push(`player:${a.viewer.playerId}`);
      const group = a.lobby.players.get(a.viewer.playerId)?.groupId;
      if (group) rooms.push(`lobby:${a.lobby.code}:group:${group}`);
    }
    return rooms;
  };
  const updateRooms = (socket: AppSocket, a: Attachment) => {
    const wanted = new Set(roomNames(a));
    for (const room of socket.rooms)
      if (room !== socket.id && !wanted.has(room)) void socket.leave(room);
    for (const room of wanted) void socket.join(room);
  };
  const detach = (socket: AppSocket) => {
    const a = attached.get(socket.id);
    if (!a) return;
    attached.delete(socket.id);
    broadcaster.detach(socket.id);
    for (const room of socket.rooms) if (room !== socket.id) void socket.leave(room);
    if (a.viewer.kind === "host") a.lobby.hostSockets.delete(socket.id);
    if (a.viewer.kind === "player") {
      const p = a.lobby.players.get(a.viewer.playerId);
      if (p) {
        p.sockets.delete(socket.id);
        p.lastSeenAt = manager.now();
        a.lobby.connectionChanged();
      }
    }
    if (a.lobby.status === "open") {
      a.lobby.version++;
      a.lobby.onChange();
    }
  };
  manager.onCreate = (lobby) => {
    lobby.onChange = () => {
      timers.reconcile(lobby);
      for (const [id, a] of attached)
        if (a.lobby === lobby) {
          const socket = io.sockets.sockets.get(id);
          if (socket) updateRooms(socket, a);
        }
      broadcaster.queue(lobby);
    };
  };
  manager.onClose = (lobby, reason) => {
    timers.reconcile(lobby);
    for (const [id, a] of attached)
      if (a.lobby === lobby) {
        const socket = io.sockets.sockets.get(id);
        if (socket) socket.emit("lobby:closed", { reason });
        broadcaster.detach(id);
        if (socket)
          for (const room of socket.rooms) if (room !== socket.id) void socket.leave(room);
        // Keep only the closing host attachment for a retry of its cached close command.
        if (a.viewer.kind !== "host") attached.delete(id);
      }
  };
  io.on("connection", (socket) => {
    const ctx: HandlerContext = {
      socket,
      manager,
      broadcaster,
      limiter,
      current: () => attached.get(socket.id),
      detach: () => detach(socket),
      attach: (lobby: Lobby, viewer: Viewer) => {
        detach(socket);
        attached.set(socket.id, { lobby, viewer });
        if (viewer.kind === "host") lobby.hostSockets.add(socket.id);
        if (viewer.kind === "player") {
          const p = lobby.players.get(viewer.playerId)!;
          p.sockets.add(socket.id);
          p.lastSeenAt = manager.now();
          lobby.connectionChanged();
        }
        updateRooms(socket, { lobby, viewer });
        lobby.changed();
        broadcaster.attach(socket, lobby, viewer);
      },
      removePlayer: (lobby, playerId, kick) => {
        const player = manager.remove(lobby, playerId);
        for (const id of player.sockets) {
          const target = io.sockets.sockets.get(id);
          if (target) {
            if (kick) target.emit("session:kicked");
            detach(target);
          }
        }
      },
    };
    const on = makeRegister(ctx);
    registerLobby(ctx, on);
    registerSession(ctx, on);
    registerGroups(ctx, on);
    registerGame(ctx, on);
    socket.on("disconnect", () => detach(socket));
    socket.emit("time:sync", { serverNow: manager.now() });
  });
  const sweep = setInterval(() => {
    manager.sweep();
    limiter.sweep();
  }, 60000);
  sweep.unref();
  const beacon = setInterval(() => io.emit("time:sync", { serverNow: manager.now() }), 30000);
  beacon.unref();
  app.get("/healthz", async () => ({ ok: true }));
  app.get("/api/config", async () => ({ publicUrl: options.publicUrl ?? config.publicUrl }));
  if (options.production ?? config.production) {
    const root = options.webRoot ?? fileURLToPath(new URL("../../web/dist", import.meta.url));
    if (existsSync(path.join(root, "index.html"))) {
      await app.register(fastifyStatic, { root });
      app.setNotFoundHandler((request, reply) => {
        if (
          request.method === "GET" &&
          !request.url.startsWith("/api/") &&
          !request.url.startsWith("/socket.io/") &&
          !path.extname(request.url.split("?")[0]!)
        )
          return reply.sendFile("index.html");
        return reply.code(404).send({ message: "Page not found." });
      });
    }
  }
  app.addHook("onClose", async () => {
    clearInterval(sweep);
    clearInterval(beacon);
    timers.dispose();
    await new Promise<void>((resolve) => io.close(() => resolve()));
  });
  return {
    app,
    io,
    manager,
    broadcaster,
    timers,
    listen: (port = config.port, host = "0.0.0.0") => app.listen({ port, host }),
    close: () => app.close(),
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = await createServer();
  const address = await server.listen();
  process.stdout.write(`CangsPlayground server: ${address}\n`);
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => {
      void server.close().then(() => process.exit(0));
    });
}
