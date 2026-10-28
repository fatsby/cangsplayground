import type { GroupId, Viewer } from "@cangsplayground/core";
import { ideaById } from "./ideas.js";
import { computeResults, minSpendLeft } from "./rules.js";
import type { SharkTankConfig, SharkTankShared, SharkTankView } from "./types.js";

export function viewFor({
  config,
  shared,
  viewer,
  viewerGroupId,
}: {
  config: SharkTankConfig;
  shared: SharkTankShared;
  viewer: Viewer;
  viewerGroupId: GroupId | null;
}): SharkTankView {
  const host = viewer.kind === "host";
  const preparing = shared.stage === "PREP";
  const revealed = shared.stage === "RESULTS" || shared.stage === "CLOSING";
  const presenter = preparing ? null : (shared.order[shared.presenterIndex] ?? null);
  const asked = presenter ? (shared.asked[presenter] ?? []) : [];
  const own =
    viewer.kind === "player"
      ? shared.companies.find((c) => c.groupId === viewerGroupId)
      : undefined;
  const announcer =
    shared.stage === "DECISION" &&
    viewer.kind === "player" &&
    own &&
    shared.announcers[own.groupId] === viewer.playerId;

  return structuredClone({
    stage: shared.stage,
    presenterIndex: host ? shared.presenterIndex : null,
    minPrice: config.minPrice,
    maxPrice: config.maxPrice,
    timer: shared.timer,
    order: preparing ? null : shared.order,
    presenter,
    companies: shared.companies.map((company) => {
      const privateInfo = host || own?.groupId === company.groupId;
      const idea = ideaById(company.ideaId);
      const publicIdea = { id: idea.id, name: idea.name, emoji: idea.emoji, pitch: idea.pitch };
      return {
        groupId: company.groupId,
        prepStep:
          viewer.kind === "player" && own?.groupId === company.groupId
            ? (company.prepSteps[viewer.playerId] ?? 1)
            : company.prepStep,
        members: company.members,
        discounted: company.discounted,
        voted: shared.locked.includes(company.groupId),
        rerollAllowed: privateInfo ? preparing && !company.rerolled && !company.rerollLocked : null,
        ideaLocked: privateInfo ? company.rerollLocked : null,
        ideaLockVotes: privateInfo ? company.ideaLockVotes : null,
        startMembers: privateInfo ? company.startMembers : null,
        idea: privateInfo ? idea : preparing ? null : publicIdea,
        price: privateInfo || !preparing ? company.price : null,
        priceAuto: privateInfo || !preparing ? (company.priceAuto ?? false) : null,
        originalPrice: privateInfo || !preparing ? (company.originalPrice ?? null) : null,
        parts: privateInfo || !preparing ? company.parts : null,
        help: privateInfo ? company.help : null,
        scripts: privateInfo ? company.scripts : null,
        wallet: privateInfo ? company.wallet : null,
        minSpendLeft: privateInfo ? minSpendLeft(company, shared, config) : null,
        votes: privateInfo ? (shared.votes[company.groupId] ?? {}) : null,
        eligible: privateInfo
          ? [...company.members, ...company.formerMembers].some((id) => asked.includes(id))
          : null,
        purchases:
          privateInfo || revealed
            ? shared.purchases.filter((p) => p.buyer === company.groupId)
            : null,
        revenue:
          host || revealed
            ? shared.purchases.reduce(
                (sum, p) => sum + (p.seller === company.groupId ? p.quantity * p.price : 0),
                0,
              )
            : null,
      };
    }),
    asked: host
      ? asked
      : viewer.kind === "projector"
        ? null
        : asked.filter((id) => own?.members.includes(id)),
    announcers: shared.stage === "DECISION" ? shared.announcers : null,
    myDecision: announcer
      ? shared.purchases.some(
          (p) => p.buyer === own.groupId && p.seller === presenter && p.quantity > 0,
        )
      : null,
    results: revealed ? computeResults(shared, config) : null,
    closing: shared.stage === "CLOSING" ? shared.closing : null,
  });
}
