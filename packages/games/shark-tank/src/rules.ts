import type { GroupId, PlayerId } from "@cangsplayground/core";
import {
  PART_ORDER,
  type Company,
  type PartId,
  type SharkTankConfig,
  type SharkTankShared,
} from "./types.js";

export function assignParts(members: PlayerId[]): Record<PlayerId, PartId[]> {
  const parts = members.length === 5 ? PART_ORDER : PART_ORDER.filter((part) => part !== "story");
  return Object.fromEntries(
    members.map((id, index) => [
      id,
      parts.slice(
        Math.floor((index * parts.length) / members.length),
        Math.floor(((index + 1) * parts.length) / members.length),
      ),
    ]),
  );
}

export function reassignParts(
  parts: Record<PlayerId, PartId[]>,
  leaver: PlayerId,
  remaining: PlayerId[],
): Record<PlayerId, PartId[]> {
  const next: Record<PlayerId, PartId[]> = Object.fromEntries(
    remaining.map((id) => [id, [...(parts[id] ?? [])]]),
  );
  if (!remaining.length) return next;
  const recipient = remaining.reduce((fewest, id) =>
    next[id]!.length < next[fewest]!.length ? id : fewest,
  );
  next[recipient]!.push(...(parts[leaver] ?? []));
  next[recipient]!.sort((a, b) => PART_ORDER.indexOf(a) - PART_ORDER.indexOf(b));
  return next;
}

export function maxQuantity(members: number, wallet: number, price: number): number {
  return Math.max(0, Math.min(members, Math.floor(wallet / price)));
}

export function medianFloor(votes: number[]): number {
  if (!votes.length) return 0;
  const sorted = [...votes].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : Math.floor((sorted[middle - 1]! + sorted[middle]!) / 2);
}

function spendTarget(buyer: Company, sellers: Company[], config: SharkTankConfig): number {
  const available = sellers.reduce(
    // Before a price is entered, keep the live target at its maximum possible value.
    (sum, seller) => sum + buyer.members.length * (seller.price ?? config.maxPrice),
    0,
  );
  return Math.min(
    Math.floor((config.minSpendPercent * buyer.startWallet) / 100),
    buyer.startWallet,
    available,
  );
}

export function minSpendTarget(
  buyer: Company,
  shared: SharkTankShared,
  config: SharkTankConfig,
): number {
  return spendTarget(
    buyer,
    shared.companies.filter(
      (seller) => seller.groupId !== buyer.groupId && shared.presented.includes(seller.groupId),
    ),
    config,
  );
}

export function minSpendLeft(
  buyer: Company,
  shared: SharkTankShared,
  config: SharkTankConfig,
): number {
  const sellers = shared.companies.filter(
    (seller) =>
      seller.groupId !== buyer.groupId &&
      (shared.presented.includes(seller.groupId) || seller.members.length > 0),
  );
  return Math.max(0, spendTarget(buyer, sellers, config) - spent(shared, buyer.groupId));
}

export function spent(shared: SharkTankShared, groupId: GroupId): number {
  return shared.purchases.reduce(
    (sum, purchase) => sum + (purchase.buyer === groupId ? purchase.quantity * purchase.price : 0),
    0,
  );
}

export interface Score {
  groupId: GroupId;
  revenue: number;
  spent: number;
  shortfall: number;
  noQuestion: number;
  total: number;
}

export interface Results {
  scores: Score[];
  bestStartup: GroupId[];
  bestShark: GroupId[];
}

export function computeResults(shared: SharkTankShared, config: SharkTankConfig): Results {
  const asked = new Set(Object.values(shared.asked).flat());
  const scores: Score[] = shared.companies.map((company) => {
    const revenue = shared.purchases.reduce(
      (sum, purchase) =>
        sum + (purchase.seller === company.groupId ? purchase.quantity * purchase.price : 0),
      0,
    );
    const spending = spent(shared, company.groupId);
    const shortfall = company.members.length
      ? Math.max(0, minSpendTarget(company, shared, config) - spending)
      : 0;
    const noQuestion =
      config.noQuestionPenalty * company.members.filter((id) => !asked.has(id)).length;
    return {
      groupId: company.groupId,
      revenue,
      spent: spending,
      shortfall,
      noQuestion,
      total: revenue - shortfall - noQuestion,
    };
  });
  scores.sort((a, b) => a.total - b.total);
  const bestTotal = scores.at(-1)?.total;
  const bestStartup = scores.filter((score) => score.total === bestTotal).map((s) => s.groupId);
  let bestShark: GroupId[] = [];
  if (scores.length >= 3) {
    const revenues = scores.map((score) => score.revenue).sort((a, b) => b - a);
    const top = new Set(scores.filter((s) => s.revenue >= revenues[1]!).map((s) => s.groupId));
    const sharkSpending = shared.companies.map((company) => ({
      groupId: company.groupId,
      spent: shared.purchases.reduce(
        (sum, purchase) =>
          sum +
          (purchase.buyer === company.groupId &&
          purchase.seller !== company.groupId &&
          top.has(purchase.seller)
            ? purchase.quantity * purchase.price
            : 0),
        0,
      ),
    }));
    const bestSpend = Math.max(...sharkSpending.map((s) => s.spent));
    if (bestSpend > 0)
      bestShark = sharkSpending.filter((s) => s.spent === bestSpend).map((s) => s.groupId);
  }
  return { scores, bestStartup, bestShark };
}
