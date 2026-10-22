import { randomInt } from "node:crypto";
import { createRng, generateLobbyCode, LOBBY_TTL_MINUTES_DEFAULT } from "@cangsplayground/core";
import { Lobby } from "./Lobby.js";
import { newToken } from "../auth/tokens.js";
import { fail } from "../auth/errors.js";
import { PairingService } from "../auth/PairingService.js";
export interface TokenSession {
  code: string;
  role: "host" | "player";
  playerId?: string;
}
export class LobbyManager {
  lobbies = new Map<string, Lobby>();
  tokens = new Map<string, TokenSession>();
  pairing: PairingService;
  readonly now: () => number;
  private rng;
  private ttl: number;
  onCreate: (lobby: Lobby) => void = () => {};
  onClose: (lobby: Lobby, reason: "host" | "expired") => void = () => {};
  constructor(options: { now?: () => number; seed?: number; ttlMinutes?: number } = {}) {
    this.now = options.now ?? Date.now;
    this.rng = createRng(options.seed ?? randomInt(0x100000000));
    this.ttl = (options.ttlMinutes ?? LOBBY_TTL_MINUTES_DEFAULT) * 60000;
    this.pairing = new PairingService(this.now);
  }
  create() {
    let code = generateLobbyCode(this.rng);
    while (this.lobbies.has(code)) code = generateLobbyCode(this.rng);
    const lobby = new Lobby({
      code,
      hostToken: newToken(),
      seed: this.rng.int(0x100000000),
      now: this.now,
    });
    this.lobbies.set(code, lobby);
    this.tokens.set(lobby.hostToken, { code, role: "host" });
    this.onCreate(lobby);
    return lobby;
  }
  get(code: string) {
    const lobby = this.lobbies.get(code);
    if (!lobby) fail("NOT_FOUND", "Lobby not found. Check the code.");
    return lobby;
  }
  authenticate(code: string, token: string) {
    const lobby = this.get(code);
    const session = this.tokens.get(token);
    if (session?.code !== code || session.role !== "host")
      fail("UNAUTHORIZED", "Scan the host QR on the projector.");
    return lobby;
  }
  join(code: string, name: string) {
    const lobby = this.get(code);
    const player = lobby.join(name);
    this.tokens.set(player.token, { code, role: "player", playerId: player.id });
    return { lobby, player };
  }
  resume(token: string) {
    const session = this.tokens.get(token);
    if (!session || session.role !== "player") fail("NOT_FOUND", "Player not found. Join again.");
    const lobby = this.get(session.code);
    const player = lobby.players.get(session.playerId!);
    if (!player) fail("NOT_FOUND", "Player not found. Join again.");
    lobby.touch();
    return { lobby, player };
  }
  remove(lobby: Lobby, playerId: string) {
    const player = lobby.removePlayer(playerId);
    this.tokens.delete(player.token);
    return player;
  }
  close(lobby: Lobby, reason: "host" | "expired") {
    if (lobby.status === "closed") return;
    lobby.status = "closed";
    this.lobbies.delete(lobby.code);
    for (const [token, session] of this.tokens)
      if (session.code === lobby.code) this.tokens.delete(token);
    this.pairing.clearLobby(lobby.code);
    this.onClose(lobby, reason);
    lobby.players.clear();
    lobby.groups = [];
    lobby.game = null;
    lobby.hostSockets.clear();
    lobby.warnings = [];
  }
  sweep() {
    for (const lobby of this.lobbies.values()) {
      if (this.now() - lobby.lastActiveAt > this.ttl) this.close(lobby, "expired");
      else {
        lobby.version++;
        lobby.onChange();
      }
    }
    this.pairing.sweep();
  }
}
