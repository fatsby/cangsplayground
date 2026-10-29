import {
  assignGroups,
  activePlayers,
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
  type GameClockView,
  type GameAction,
  type RosterEntry,
  type AvatarConfig,
  type SharedDeadline,
} from "@cangsplayground/core";
import { registry } from "../games/registry.js";
import { CommandError, fail, failure } from "../auth/errors.js";
import { newPlayerId, newToken } from "../auth/tokens.js";

export interface Player {
  id: string;
  avatar: AvatarConfig;
  token: string;
  name: string;
  groupId: string | null;
  sockets: Set<string>;
  lastSeenAt: number;
}
export interface Session {
  clock: GameClockView | null;
  module: GameModule;
  config: Record<string, any>;
  stage: "CONFIGURING" | "ACTIVE";
  groups: GroupRuntime[];
  shared: unknown;
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
  private roster(): RosterEntry[] {
    return [...this.players.values()].map((p) => ({
      playerId: p.id,
      groupId: p.groupId,
      connected: p.sockets.size > 0,
    }));
  }
  /** Validated deadlines the active shared game wants the server to wake it for. */
  sharedDeadlines(): SharedDeadline[] {
    const game = this.game;
    if (
      this.status !== "open" ||
      game?.stage !== "ACTIVE" ||
      game.shared === null ||
      !game.module.sharedDeadlines ||
      !game.module.onSharedDeadline
    )
      return [];
    const seen = new Set<string>();
    const out: SharedDeadline[] = [];
    for (const d of game.module.sharedDeadlines(this.sharedArgs(game))) {
      if (typeof d?.key !== "string" || !d.key || !Number.isFinite(d.endsAt) || seen.has(d.key))
        continue;
      seen.add(d.key);
      out.push({ key: d.key, endsAt: d.endsAt });
    }
    return out;
  }
  /**
   * The only path into onSharedDeadline. A callback captured for an older session, a
   * deadline no longer exported unchanged, or an early call has no effect.
   */
  expireSharedDeadline(expectedSession: Session, deadline: SharedDeadline): boolean {
    const game = this.game;
    if (game !== expectedSession || this.now() < deadline.endsAt) return false;
    const current = this.sharedDeadlines().find((d) => d.key === deadline.key);
    if (!current || current.endsAt !== deadline.endsAt || !game.module.onSharedDeadline)
      return false;
    const shared = game.module.onSharedDeadline({ ...this.sharedArgs(game), deadline: current });
    if (shared === null || shared === game.shared) return false;
    game.shared = shared;
    this.changed();
    return true;
  }
  /** Expire every due deadline (oldest first) before a command reads the shared state. */
  settleSharedDeadlines(): void {
    const game = this.game;
    if (!game) return;
    const now = this.now();
    const due = this.sharedDeadlines()
      .filter((d) => d.endsAt <= now)
      .sort((a, b) => a.endsAt - b.endsAt || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    for (const deadline of due) this.expireSharedDeadline(game, deadline);
  }
  private sharedArgs(game: Session) {
    return {
      config: game.config,
      shared: game.shared,
      roster: this.roster(),
      now: this.now(),
      rng: this.rng,
    };
  }
  connectionChanged(): void {
    const game = this.game;
    if (game?.stage !== "ACTIVE" || !game.module.onSharedRosterChange) return;
    this.settleSharedDeadlines();
    game.shared = game.module.onSharedRosterChange({
      config: game.config,
      shared: game.shared,
      roster: this.roster(),
      now: this.now(),
      rng: this.rng,
    });
    this.changed();
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
    const name = input.trim();
    if (!name || name.length > PLAYER_NAME_MAX)
      fail("NAME_INVALID", `Use a name with 1 to ${PLAYER_NAME_MAX} letters.`);
    // A phone that lost its saved token reclaims its offline player by name, even when locked.
    const existing = [...this.players.values()].find(
      (p) => p.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing && existing.sockets.size === 0) {
      existing.lastSeenAt = this.now();
      return existing;
    }
    if (this.locked) fail("LOBBY_LOCKED", "This lobby is locked.");
    if (this.players.size >= MAX_PLAYERS_PER_LOBBY) fail("LOBBY_FULL", "This lobby is full.");
    const names = new Set([...this.players.values()].map((p) => p.name.toLowerCase()));
    if (existing) {
      let i = 2;
      let suggestion: string;
      do {
        const suffix = String(i++);
        suggestion = name.slice(0, PLAYER_NAME_MAX - suffix.length) + suffix;
      } while (names.has(suggestion.toLowerCase()));
      throw new CommandError(
        "NAME_TAKEN",
        "This name is in use. If it's you, wait a minute and try again.",
        suggestion,
      );
    }
    const id = newPlayerId();
    const player: Player = {
      id,
      avatar: { seed: id },
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
  updateAvatar(playerId: string, avatar: AvatarConfig) {
    if (this.status !== "open") fail("LOBBY_CLOSED", "This lobby has ended.");
    const player = this.players.get(playerId);
    if (!player) fail("NOT_FOUND", "Player not found.");
    if (this.game)
      fail(
        "INVALID_STATE",
        "Your teacher has selected a game. Customize your avatar between games.",
      );
    player.avatar = { ...avatar };
    this.changed();
  }
  removePlayer(playerId: string) {
    const player = this.players.get(playerId);
    if (!player) fail("NOT_FOUND", "Player not found.");
    if (this.game?.module.onSharedAction) {
      if (this.game.stage === "ACTIVE") this.settleSharedDeadlines();
      if (this.game.stage === "ACTIVE" && this.game.module.onSharedPlayerLeft)
        this.game.shared = this.game.module.onSharedPlayerLeft({
          config: this.game.config,
          shared: this.game.shared,
          roster: this.roster().filter((p) => p.playerId !== playerId),
          now: this.now(),
          rng: this.rng,
          playerId,
          groupId: player.groupId,
        });
    } else if (
      this.game?.stage === "ACTIVE" &&
      this.game.groups.some((g) => g.turnOrder.includes(playerId))
    ) {
      this.warnings.push({
        code: "PLAYER_LEFT_MID_ROUND",
        message: `${player.name} left this round.`,
        playerId,
        ...(player.groupId ? { groupId: player.groupId } : {}),
      });
      for (const group of this.game.groups) {
        if (group.groupId !== player.groupId) continue;
        this.removeTurns(group, playerId);
        if (group.phase === "FINISHED") {
          this.clearRoundWarnings(group.groupId);
          continue;
        }
        const outcome = this.game.module.onPlayerLeft?.({
          config: this.game.config,
          state: group,
          playerId,
        });
        if (outcome) {
          group.data = outcome.data;
          if (outcome.finished) this.finishGroup(group);
          else if (outcome.closeVote && group.phase === "VOTING") this.closeVote(group);
        }
      }
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
    if (
      this.game?.stage === "ACTIVE" &&
      (this.game.module.voteDurationMs || this.game.module.onSharedAction)
    )
      fail("INVALID_STATE", "Exit the game to move players.");
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
      clock: null,
      config: structuredClone(module.defaultConfig),
      stage: "CONFIGURING",
      groups: [],
      shared: null,
    };
    this.changed();
  }
  configure(config: Record<string, unknown>) {
    if (!this.game) fail("INVALID_STATE", "Choose a game first.");
    if (this.game.stage === "ACTIVE" && this.game.module.onSharedAction)
      fail("INVALID_STATE", "Exit the game to change settings.");
    const parsed = this.game.module.configSchema.safeParse({ ...this.game.config, ...config });
    if (!parsed.success) fail("INVALID_PAYLOAD", "Check the game settings.");
    this.game.config = parsed.data;
    this.changed();
  }
  private duration() {
    return this.game!.module.turnDurationMs(this.game!.config) ?? 0;
  }
  private clearRoundWarnings(groupId: string) {
    this.warnings = this.warnings.filter(
      (warning) => warning.code !== "PLAYER_LEFT_MID_ROUND" || warning.groupId !== groupId,
    );
  }
  private finishGroup(group: GroupRuntime) {
    group.phase = "FINISHED";
    this.idle(group);
    this.clearRoundWarnings(group.groupId);
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
      eliminated: [],
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
  private validateGroups(summaries: GroupSummary[], config = this.game!.config) {
    const check = validatePlan(
      summaries.map((g) => g.playerIds.length),
      this.game!.module.minPlayersPerGroup,
    );
    if (!check.ok) fail("GROUPS_TOO_SMALL", check.reason!);
    for (const group of summaries) {
      const message = this.game!.module.validateGroup?.({ config, group });
      if (message !== null && message !== undefined) fail("GROUPS_TOO_SMALL", message);
    }
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
      const config =
        game.module.resolveConfig?.({ config: structuredClone(game.config), rng: this.rng }) ??
        game.config;
      this.validateGroups(this.groups, config);
      const message = game.module.validateGroups?.({ config, groups: this.groups });
      if (message !== null && message !== undefined) fail("GROUPS_TOO_SMALL", message);
      game.config = config;
      game.groups = this.groups.map((g) => this.prepareGroup(g, 1));
      game.shared =
        game.module.prepareShared?.({
          config,
          groups: game.groups.map((g) => ({
            groupId: g.groupId,
            playerIds: activePlayers(g),
            round: 1,
          })),
          rng: this.rng,
          now: this.now(),
        }) ?? null;
      game.stage = "ACTIVE";
      const durationMs = game.module.gameDurationMs?.(game.config);
      game.clock =
        typeof durationMs === "number"
          ? { timer: { endsAt: null, pausedRemainingMs: null, durationMs }, done: false }
          : null;
      this.changed();
      return;
    }
    if (game.module.onSharedAction) fail("INVALID_STATE", "This game uses its own controls.");
    if (game.stage !== "ACTIVE") fail("INVALID_STATE", "Prepare the game first.");
    const groups = game.groups.filter((g) => !groupId || g.groupId === groupId);
    if (cmd === "nextRound" && !game.module.onContinue) {
      const ended = this.groups.filter((g) =>
        groups.some((r) => r.groupId === g.id && r.phase === "ROUND_END"),
      );
      if (!ended.length) fail("INVALID_STATE", "This action is not ready.");
      this.validateGroups(ended);
    }
    let accepted = false;
    for (const group of groups) {
      if (group.phase === "FINISHED") continue;
      switch (cmd) {
        case "start":
          if (group.phase !== "PREPARED") continue;
          group.phase = "RUNNING";
          this.freshTurn(group);
          break;
        case "pause":
          if (
            group.phase !== "RUNNING" &&
            !(group.phase === "VOTING" && group.timer.endsAt !== null)
          )
            continue;
          if (group.phase === "RUNNING") group.phase = "PAUSED";
          group.timer.pausedRemainingMs =
            group.timer.endsAt === null ? 0 : Math.max(0, group.timer.endsAt - this.now());
          group.timer.endsAt = null;
          break;
        case "resume":
          if (
            group.phase !== "PAUSED" &&
            !(group.phase === "VOTING" && group.timer.pausedRemainingMs !== null)
          )
            continue;
          if (group.phase === "PAUSED") group.phase = "RUNNING";
          group.timer.endsAt =
            group.timer.durationMs > 0 ? this.now() + (group.timer.pausedRemainingMs ?? 0) : null;
          group.timer.pausedRemainingMs = null;
          break;
        case "skip":
          if (group.phase !== "RUNNING" && group.phase !== "PAUSED" && group.phase !== "VOTING")
            continue;
          if (group.phase === "VOTING") this.closeVote(group);
          else this.advance(group, "skip");
          break;
        case "extend":
          if (group.phase !== "RUNNING" && group.phase !== "PAUSED" && group.phase !== "VOTING")
            continue;
          group.timer.durationMs += EXTEND_MS;
          if (group.timer.endsAt !== null) group.timer.endsAt += EXTEND_MS;
          if (group.timer.pausedRemainingMs !== null) group.timer.pausedRemainingMs += EXTEND_MS;
          break;
        case "endRound":
          if (group.phase === "ROUND_END" || group.phase === "VOTING") continue;
          if (game.module.voteDurationMs && group.phase !== "RUNNING" && group.phase !== "PAUSED")
            continue;
          this.endTurns(group);
          break;
        case "reveal":
          if (group.phase !== "ROUND_END" || group.revealed) continue;
          group.revealed = true;
          break;
        case "nextRound":
          if (group.phase !== "ROUND_END") continue;
          if (game.module.onContinue) {
            const order = activePlayers(group);
            group.data = game.module.onContinue({
              config: game.config,
              state: group,
              rng: this.rng,
            });
            group.round++;
            group.turnOrder = Array.from(
              { length: game.module.turnsPerPlayer?.(game.config) ?? 1 },
              () => order,
            ).flat();
            group.turnIndex = 0;
            group.phase = "RUNNING";
            this.freshTurn(group);
          } else
            Object.assign(
              group,
              this.prepareGroup(
                this.groups.find((g) => g.id === group.groupId)!,
                group.round + 1,
              ),
            );
          this.clearRoundWarnings(group.groupId);
          break;
      }
      accepted = true;
    }
    const clock = game.clock;
    if (clock && !clock.done) {
      const timer = clock.timer;
      if (accepted && cmd === "start" && timer.endsAt === null && timer.pausedRemainingMs === null)
        timer.endsAt = this.now() + timer.durationMs;
      if (cmd === "pause" && !groupId && timer.endsAt !== null) {
        timer.pausedRemainingMs = Math.max(0, timer.endsAt - this.now());
        timer.endsAt = null;
        accepted = true;
      }
      if (cmd === "resume" && !groupId && timer.pausedRemainingMs !== null) {
        timer.endsAt = this.now() + timer.pausedRemainingMs;
        timer.pausedRemainingMs = null;
        accepted = true;
      }
    }
    if (!accepted) fail("INVALID_STATE", "This action is not ready.");
    this.changed();
  }
  expireClock(endsAt: number) {
    const game = this.game;
    if (
      !game?.clock ||
      game.clock.done ||
      game.clock.timer.endsAt !== endsAt ||
      this.now() < endsAt
    )
      return;
    for (const group of game.groups) {
      if (group.phase === "FINISHED") continue;
      group.data = game.module.onGameTimeUp?.({ config: game.config, state: group }) ?? group.data;
      this.finishGroup(group);
    }
    game.clock = {
      timer: { ...game.clock.timer, endsAt: null, pausedRemainingMs: null },
      done: true,
    };
    this.changed();
  }
  private endTurns(group: GroupRuntime) {
    const duration = this.game!.module.voteDurationMs?.(this.game!.config);
    if (typeof duration === "number") this.startVote(group, duration);
    else {
      group.phase = "ROUND_END";
      this.idle(group);
    }
  }
  private startVote(
    group: GroupRuntime,
    duration = this.game!.module.voteDurationMs!(this.game!.config)!,
  ) {
    const paused = group.phase === "PAUSED";
    group.phase = "VOTING";
    group.turnIndex = group.turnOrder.length;
    group.timer = {
      endsAt: paused ? null : this.now() + duration,
      pausedRemainingMs: paused ? duration : null,
      durationMs: duration,
    };
  }
  private closeVote(group: GroupRuntime) {
    const game = this.game!;
    const outcome = game.module.onVoteEnd?.({ config: game.config, state: group });
    if (outcome) {
      group.data = outcome.data;
      for (const id of outcome.eliminate ?? []) {
        if (!group.eliminated.includes(id)) group.eliminated.push(id);
        group.turnOrder = group.turnOrder.filter((p) => p !== id);
      }
    }
    group.turnIndex = group.turnOrder.length;
    if (outcome?.finished) this.finishGroup(group);
    else {
      group.phase = "ROUND_END";
      this.idle(group);
    }
  }
  advance(group: GroupRuntime, reason: "timer" | "done" | "skip") {
    const game = this.game!;
    if (reason === "timer" && game.module.onTimerEnd)
      group.data = game.module.onTimerEnd({ config: game.config, state: group });
    if (game.module.onTurnEnd)
      group.data = game.module.onTurnEnd({ config: game.config, state: group, reason });
    group.turnIndex++;
    if (group.turnIndex >= group.turnOrder.length) {
      this.endTurns(group);
    } else this.freshTurn(group);
  }
  expire(groupId: string, endsAt: number) {
    const group = this.game?.groups.find((g) => g.groupId === groupId);
    if (
      !group ||
      (group.phase !== "RUNNING" && group.phase !== "VOTING") ||
      group.timer.endsAt !== endsAt ||
      this.now() < endsAt
    )
      return;
    if (group.phase === "VOTING") this.closeVote(group);
    else this.advance(group, "timer");
    this.changed();
  }
  private removeTurns(group: GroupRuntime, playerId: string) {
    const current = group.turnOrder[group.turnIndex] === playerId;
    const before = group.turnOrder.slice(0, group.turnIndex).filter((id) => id === playerId).length;
    group.turnOrder = group.turnOrder.filter((id) => id !== playerId);
    group.turnIndex -= before;
    if (group.phase === "ROUND_END" || group.phase === "FINISHED") return;
    if (this.game!.module.voteDurationMs && group.phase !== "RUNNING" && group.phase !== "PAUSED")
      return;
    if (group.turnIndex >= group.turnOrder.length) this.endTurns(group);
    else if (current) this.freshTurn(group);
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
      this.advance(group, "done");
    } else if (game.module.onSharedAction) {
      // Due deadlines publish even when the action below is then rejected.
      this.settleSharedDeadlines();
      const shared = game.module.onSharedAction({
        config: game.config,
        shared: game.shared,
        roster: this.roster(),
        now: this.now(),
        rng: this.rng,
        action,
        actor: { kind: "player", playerId },
      });
      if (shared === null) fail("INVALID_STATE", "This action is not ready.");
      game.shared = shared;
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
      if (result.endTurn) this.advance(group, "done");
      if (result.closeVote && group.phase === "VOTING") this.closeVote(group);
    }
    this.changed();
  }
  hostAction(action: GameAction): void {
    const game = this.game;
    if (game?.stage !== "ACTIVE" || !game.module.onSharedAction)
      fail("INVALID_STATE", "This action is not ready.");
    this.settleSharedDeadlines();
    const shared = game.module.onSharedAction({
      config: game.config,
      shared: game.shared,
      roster: this.roster(),
      now: this.now(),
      rng: this.rng,
      action,
      actor: { kind: "host" },
    });
    if (shared === null) fail("INVALID_STATE", "This action is not ready.");
    game.shared = shared;
    this.changed();
  }
}
