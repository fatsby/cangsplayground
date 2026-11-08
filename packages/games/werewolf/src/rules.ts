import { shuffle, type PlayerId, type Rng } from "@cangsplayground/core";
import { MIN_PLAYERS, type Role, type Team } from "./types.js";

/** Role split used when the host does not edit anything (spec: roughly one werewolf per four players). */
const PLAYERS_PER_WEREWOLF = 4;
const ROLE_ORDER: Role[] = ["werewolf", "seer", "guard", "villager"];

/**
 * Default role split for `playerCount` players: `max(1, round(n / 4))` werewolves, one seer,
 * one guard, villagers for everyone else (never negative).
 */
export function roleCounts(playerCount: number): Record<Role, number> {
  const werewolf = Math.max(1, Math.round(playerCount / PLAYERS_PER_WEREWOLF));
  return { werewolf, seer: 1, guard: 1, villager: Math.max(0, playerCount - werewolf - 2) };
}

/** Shuffles `playerIds` with `rng` and deals them exactly `roleCounts(n)` of each role. */
export function dealRoles(playerIds: readonly PlayerId[], rng: Rng): Record<PlayerId, Role> {
  const counts = roleCounts(playerIds.length);
  const pool = ROLE_ORDER.flatMap((role) => Array<Role>(counts[role]).fill(role));
  const out: Record<PlayerId, Role> = {};
  shuffle(playerIds, rng).forEach((id, i) => {
    out[id] = pool[i] ?? "villager";
  });
  return out;
}

/**
 * Checks a role assignment before the game starts.
 *
 * @returns a human-readable reason it cannot start (fewer than {@link MIN_PLAYERS} players, no
 *   werewolf, or werewolves not strictly fewer than everyone else), or `null` when it is fine.
 */
export function validateRoles(roles: Record<PlayerId, Role>): string | null {
  const all = Object.values(roles);
  const wolves = all.filter((r) => r === "werewolf").length;
  if (all.length < MIN_PLAYERS) return `Need at least ${MIN_PLAYERS} players (have ${all.length}).`;
  if (wolves < 1) return "Add at least one Werewolf.";
  if (wolves >= all.length - wolves) return "Werewolves must be fewer than everyone else.";
  return null;
}

function leaders(votes: Record<PlayerId, PlayerId>): PlayerId[] {
  const counts = new Map<PlayerId, number>();
  for (const target of Object.values(votes)) counts.set(target, (counts.get(target) ?? 0) + 1);
  const top = Math.max(0, ...counts.values());
  return [...counts].filter(([, n]) => n === top).map(([id]) => id).sort();
}

/**
 * The werewolves' victim: the most-voted target; a tie is broken at random among the tied
 * targets (sorted first so the pick depends only on `rng`); no votes means no attack (`null`).
 */
export function pickWolfTarget(votes: Record<PlayerId, PlayerId>, rng: Rng): PlayerId | null {
  const top = leaders(votes);
  return top.length === 0 ? null : top[rng.int(top.length)]!;
}

/** The player who dies at dawn: the attacked player unless the Guard protected them. */
export function resolveNight(target: PlayerId | null, guarded: PlayerId | null): PlayerId | null {
  return target !== null && target !== guarded ? target : null;
}

/** Votes needed to banish someone: half of the living players, rounded up. */
export function voteThreshold(aliveCount: number): number {
  return Math.ceil(aliveCount / 2);
}

/**
 * Vote count per target, counting only votes cast by a living player for a different living player.
 */
export function tallyVotes(votes: Record<PlayerId, PlayerId>, alive: readonly PlayerId[]): Record<PlayerId, number> {
  const living = new Set(alive);
  const counts: Record<PlayerId, number> = {};
  for (const [voter, target] of Object.entries(votes))
    if (living.has(voter) && living.has(target) && voter !== target) counts[target] = (counts[target] ?? 0) + 1;
  return counts;
}

/**
 * The player banished by the day vote, or `null`. A player needs {@link voteThreshold} valid votes
 * (see {@link tallyVotes}); if nobody reaches it, or two players both do (a tie), nobody is banished.
 */
export function resolveDayVote(votes: Record<PlayerId, PlayerId>, alive: readonly PlayerId[]): PlayerId | null {
  const need = voteThreshold(alive.length);
  const reached = Object.entries(tallyVotes(votes, alive)).filter(([, n]) => n >= need);
  return reached.length === 1 ? reached[0]![0] : null;
}

/**
 * Village wins when no werewolf is alive; the wolves win when living werewolves are at least as
 * many as everyone else alive; otherwise the game goes on (`null`).
 */
export function checkWinner(roles: Record<PlayerId, Role>, alive: readonly PlayerId[]): Team | null {
  const wolves = alive.filter((id) => roles[id] === "werewolf").length;
  if (wolves === 0) return "village";
  return wolves >= alive.length - wolves ? "wolves" : null;
}
