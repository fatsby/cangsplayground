import {
  assignGroups,
  createRng,
  EXTEND_MS,
  MAX_PLAYERS_PER_LOBBY,
  PLAYER_NAME_MAX,
  shuffle,
  teamName,
  validatePlan,
  type Ack,
  type C2SPayload,
  type GroupMode,
  type GroupRuntime,
  type GroupSummary,
  type HostWarning,
  type Rng,
  type GameModule,
} from "@clubplay/core";
import { registry } from "../games/registry.js";
import { CommandError, fail, failure } from "../auth/errors.js";
import { newPlayerId, newToken } from "../auth/tokens.js";

export interface Player {
  id: string;
  token: string;
  name: string;
  groupId: string | null;
  sockets: Set<string>;
  lastSeenAt: number;
}
export interface Session {
  module: GameModule;
  config: Record<string, any>;
  stage: "CONFIGURING" | "ACTIVE";
  groups: GroupRuntime[];
}
type Control = C2SPayload<"game:control">["cmd"];
export class Lobby {
  readonly code: string;
  readonly hostToken: string;
  readonly createdAt: number;
  readonly now: () => number;
  readonly rng: Rng;
  lastActiveAt: number;
  version = 0;
  status: "open" | "closed" = "open";
  locked = false;
  players = new Map<string, Player>();
  hostSockets = new Set<string>();
  groups: GroupSummary[] = [];
  groupsVersion = 0;
  game: Session | null = null;
  warnings: HostWarning[] = [];
  commands = new Map<string, Ack<any>>();
  onChange: () => void = () => {};
  constructor(options: { code: string; hostToken: string; seed: number; now?: () => number }) {
    this.code = options.code;
    this.hostToken = options.hostToken;
    this.rng = createRng(options.seed);
    this.now = options.now ?? Date.now;
    this.createdAt = this.now();
    this.lastActiveAt = this.createdAt;
  }
  touch() {
    this.lastActiveAt = this.now();
  }
  changed() {
    this.touch();
    this.version++;
    this.onChange();
  }
  command<T>(id: string, run: () => T): Ack<T> {
    const previous = this.commands.get(id);
    if (previous) return previous;
    let ack: Ack<T>;
    try {
      const data = run();
      this.touch();
      ack = { ok: true, data };
    } catch (error) {
      ack = failure(error);
    }
    this.commands.set(id, ack);
    if (this.commands.size > 200) this.commands.delete(this.commands.keys().next().value!);
    return ack;
  }
  join(input: string): Player {
    if (this.status !== "open") fail("LOBBY_CLOSED", "This lobby has ended.");
    if (this.locked) fail("LOBBY_LOCKED", "This lobby is locked.");
    if (this.players.size >= MAX_PLAYERS_PER_LOBBY) fail("LOBBY_FULL", "This lobby is full.");
    const name = input.trim();
    if (!name || name.length > PLAYER_NAME_MAX)
      fail("NAME_INVALID", "Use a name with 1 to 20 letters.");
    const names = new Set([...this.players.values()].map((p) => p.name.toLowerCase()));
    if (names.has(name.toLowerCase())) {
      let i = 2;
      let suggestion: string;
      do {
        const suffix = String(i++);
        suggestion = name.slice(0, PLAYER_NAME_MAX - suffix.length) + suffix;
      } while (names.has(suggestion.toLowerCase()));
      throw new CommandError("NAME_TAKEN", "This name is in use. Try this name.", suggestion);
    }
    const player: Player = {
      id: newPlayerId(),
      token: newToken(),
      name,
      groupId: null,
      sockets: new Set(),
      lastSeenAt: this.now(),
    };
    this.players.set(player.id, player);
    this.changed();
    return player;
  }
  removePlayer(playerId: string) {
    const player = this.players.get(playerId);
    if (!player) fail("NOT_FOUND", "Player not found.");
    if (
      this.game?.stage === "ACTIVE" &&
      this.game.groups.some((g) => g.turnOrder.includes(playerId))
    ) {
      this.warnings.push({
        code: "PLAYER_LEFT_MID_ROUND",
        message: `${player.name} left this round.`,
        playerId,
        ...(player.groupId ? { groupId: player.groupId } : {}),
      });
      for (const group of this.game.groups) this.removeTurns(group, playerId);
    }
    for (const group of this.groups)
      group.playerIds = group.playerIds.filter((id) => id !== playerId);
    this.players.delete(playerId);
    this.changed();
    return player;
  }
  assign(mode: GroupMode, value: number, confirm = false) {
    if (this.game?.stage === "ACTIVE" && !confirm)
      fail("CONFIRM_REQUIRED", "Confirm to stop this game and make new groups.");
    if (!this.players.size) fail("GROUPS_TOO_SMALL", "No players yet.");
    const dealt = assignGroups([...this.players.keys()], mode, value, this.rng);
    const sizes = dealt.map((g) => g.length);
    const check = validatePlan(sizes, this.game?.module.minPlayersPerGroup ?? 1);
    if (!check.ok) fail("GROUPS_TOO_SMALL", check.reason!);
    if (this.game?.stage === "ACTIVE") this.game = null;
    this.groupsVersion++;
    this.groups = dealt.map((playerIds, index) => ({
      id: `g${index + 1}v${this.groupsVersion}`,
      index,
      name: teamName(index),
      playerIds,
    }));
    for (const group of this.groups)
      for (const id of group.playerIds) this.players.get(id)!.groupId = group.id;
    this.warnings = [];
    this.changed();
    return { sizes };
  }
  move(playerId: string, toGroupId: string | null) {
    const player = this.players.get(playerId);
    if (!player) fail("NOT_FOUND", "Player not found.");
    const target = this.groups.find((g) => g.id === toGroupId);
    if (toGroupId && !target) fail("NOT_FOUND", "Group not found.");
    if (player.groupId === toGroupId) return;
    for (const group of this.groups)
      group.playerIds = group.playerIds.filter((id) => id !== playerId);
    if (this.game?.stage === "ACTIVE") {
      for (const group of this.game.groups) this.removeTurns(group, playerId);
      const runtime = this.game.groups.find((g) => g.groupId === toGroupId);
      if (runtime) runtime.turnOrder.push(playerId);
    }
    if (target) target.playerIds.push(playerId);
    player.groupId = toGroupId;
    this.changed();
  }
  selectGame(id: string) {
    if (this.game?.stage === "ACTIVE") fail("INVALID_STATE", "Exit this game first.");
    const module = registry.get(id);
    if (!module) fail("NOT_FOUND", "Game not found.");
    this.game = {
      module,
      config: structuredClone(module.defaultConfig),
      stage: "CONFIGURING",
      groups: [],
    };
    this.changed();
  }
  configure(config: Record<string, unknown>) {
    if (!this.game) fail("INVALID_STATE", "Choose a game first.");
    const parsed = this.game.module.configSchema.safeParse({ ...this.game.config, ...config });
    if (!parsed.success) fail("INVALID_PAYLOAD", "Check the game settings.");
    this.game.config = parsed.data;
    this.changed();
  }
  private duration() {
    return this.game!.module.turnDurationMs(this.game!.config) ?? 0;
  }
  private idle(group: GroupRuntime) {
    group.timer = { endsAt: null, pausedRemainingMs: null, durationMs: this.duration() };
  }
  private freshTurn(group: GroupRuntime) {
    const duration = this.duration();
    group.timer = {
      durationMs: duration,
      endsAt: group.phase === "RUNNING" && duration > 0 ? this.now() + duration : null,
      pausedRemainingMs: group.phase === "PAUSED" ? duration : null,
    };
  }
  private prepareGroup(summary: GroupSummary, round: number): GroupRuntime {
    const game = this.game!;
    const order = shuffle(summary.playerIds, this.rng);
    const turnOrder = Array.from(
      { length: game.module.turnsPerPlayer?.(game.config) ?? 1 },
      () => order,
    ).flat();
    return {
      groupId: summary.id,
      phase: "PREPARED",
      round,
      turnOrder,
      turnIndex: 0,
      timer: { endsAt: null, pausedRemainingMs: null, durationMs: this.duration() },
      revealed: false,
      data: game.module.prepare({
        config: game.config,
        group: { groupId: summary.id, playerIds: order, round },
        rng: this.rng,
      }),
    };
  }
  private validateGroups(summaries: GroupSummary[]) {
    const check = validatePlan(
      summaries.map((g) => g.playerIds.length),
      this.game!.module.minPlayersPerGroup,
    );
    if (!check.ok) fail("GROUPS_TOO_SMALL", check.reason!);
  }
  control(cmd: Control, groupId?: string) {
    const game = this.game;
    if (!game) fail("INVALID_STATE", "Choose a game first.");
    if (cmd === "exit") {
      this.game = null;
      this.warnings = [];
      this.changed();
      return;
    }
    if (cmd === "prepare") {
      if (game.stage !== "CONFIGURING") fail("INVALID_STATE", "This game is already ready.");
      this.validateGroups(this.groups);
      game.groups = this.groups.map((g) => this.prepareGroup(g, 1));
      game.stage = "ACTIVE";
      this.changed();
      return;
    }
    if (game.stage !== "ACTIVE") fail("INVALID_STATE", "Prepare the game first.");
    const groups = game.groups.filter((g) => !groupId || g.groupId === groupId);
    if (cmd === "nextRound") {
      const ended = this.groups.filter((g) =>
        groups.some((r) => r.groupId === g.id && r.phase === "ROUND_END"),
      );
      if (!ended.length) fail("INVALID_STATE", "This action is not ready.");
      this.validateGroups(ended);
    }
    let accepted = false;
    for (const group of groups) {
      switch (cmd) {
        case "start":
          if (group.phase !== "PREPARED") continue;
          group.phase = "RUNNING";
          this.freshTurn(group);
          break;
        case "pause":
          if (group.phase !== "RUNNING") continue;
          group.phase = "PAUSED";
          group.timer.pausedRemainingMs =
            group.timer.endsAt === null ? 0 : Math.max(0, group.timer.endsAt - this.now());
          group.timer.endsAt = null;
          break;
        case "resume":
          if (group.phase !== "PAUSED") continue;
          group.phase = "RUNNING";
          group.timer.endsAt =
            group.timer.durationMs > 0 ? this.now() + (group.timer.pausedRemainingMs ?? 0) : null;
          group.timer.pausedRemainingMs = null;
          break;
        case "skip":
          if (group.phase !== "RUNNING" && group.phase !== "PAUSED") continue;
          this.advance(group, false);
          break;
        case "extend":
          if (group.phase !== "RUNNING" && group.phase !== "PAUSED") continue;
          group.timer.durationMs += EXTEND_MS;
          if (group.timer.endsAt !== null) group.timer.endsAt += EXTEND_MS;
          if (group.timer.pausedRemainingMs !== null) group.timer.pausedRemainingMs += EXTEND_MS;
          break;
        case "endRound":
          if (group.phase === "ROUND_END") continue;
          group.phase = "ROUND_END";
          this.idle(group);
          break;
        case "reveal":
          if (group.phase !== "ROUND_END" || group.revealed) continue;
          group.revealed = true;
          break;
        case "nextRound":
          if (group.phase !== "ROUND_END") continue;
          Object.assign(
            group,
            this.prepareGroup(
              this.groups.find((g) => g.id === group.groupId)!,
              group.round + 1,
            ),
          );
          this.warnings = [];
          break;
      }
      accepted = true;
    }
    if (!accepted) fail("INVALID_STATE", "This action is not ready.");
    this.changed();
  }
  advance(group: GroupRuntime, expired: boolean) {
    if (expired && this.game?.module.onTimerEnd)
      group.data = this.game.module.onTimerEnd({ config: this.game.config, state: group });
    group.turnIndex++;
    if (group.turnIndex >= group.turnOrder.length) {
      group.phase = "ROUND_END";
      this.idle(group);
    } else this.freshTurn(group);
  }
  expire(groupId: string, endsAt: number) {
    const group = this.game?.groups.find((g) => g.groupId === groupId);
    if (!group || group.phase !== "RUNNING" || group.timer.endsAt !== endsAt || this.now() < endsAt)
      return;
    this.advance(group, true);
    this.changed();
  }
  private removeTurns(group: GroupRuntime, playerId: string) {
    const current = group.turnOrder[group.turnIndex] === playerId;
    const before = group.turnOrder.slice(0, group.turnIndex).filter((id) => id === playerId).length;
    group.turnOrder = group.turnOrder.filter((id) => id !== playerId);
    group.turnIndex -= before;
    if (group.turnIndex >= group.turnOrder.length) {
      group.phase = "ROUND_END";
      this.idle(group);
    } else if (current) this.freshTurn(group);
  }
  action(playerId: string, action: C2SPayload<"game:action">) {
    const game = this.game;
    const player = this.players.get(playerId);
    const group = game?.groups.find((g) => g.groupId === player?.groupId);
    if (!game || !player || !group || game.stage !== "ACTIVE")
      fail("INVALID_STATE", "Wait for your group to start.");
    if (action.type === "turn:done") {
      if (group.phase !== "RUNNING" || group.turnOrder[group.turnIndex] !== playerId)
        fail("UNAUTHORIZED", "Wait for your turn.");
      this.advance(group, false);
    } else {
      const result = game.module.onAction?.({
        config: game.config,
        state: group,
        action,
        actor: { kind: "player", playerId },
        rng: this.rng,
      });
      if (!result) fail("INVALID_STATE", "This action is not ready.");
      if (result.data !== undefined) group.data = result.data;
      if (result.endTurn) this.advance(group, false);
    }
    this.changed();
  }
}
