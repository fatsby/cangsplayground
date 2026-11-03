import type { GroupId, Viewer } from "@cangsplayground/core";
import { INTRO_MS } from "./clock.js";
import type { MurderConfig } from "./config.js";
import type { Investigation } from "./model.js";
import { discoveredCardIds, isDraftComplete, submitterOf, teamOfPlayer } from "./round.js";
import { rankTotals, scoreConclusion } from "./scoring.js";
import { availableActions } from "./solver.js";
import type {
  ActionOption,
  ClueFace,
  MurderShared,
  MurderView,
  Phase,
  TeamState,
} from "./types.js";

const PHASES_BEFORE_SHARING: readonly Phase[] = ["READY", "INTRO", "BRIEFING"];

/**
 * A clock is running. Views receive no server time, so they cannot tell a deadline that has just
 * passed; the server rejects such commands and the deadline callback moves the phase on at once.
 */
const live = (shared: MurderShared): boolean => !shared.paused && shared.clock.endsAt !== null;

function briefingVisible(viewer: Viewer, phase: Phase): boolean {
  if (viewer.kind === "host") return true;
  if (viewer.kind === "projector") return phase !== "READY";
  return phase !== "READY" && phase !== "INTRO";
}

function optionOf(shared: MurderShared, team: TeamState, action: Investigation): ActionOption {
  const { cards, targets } = shared.caseData;
  const known = new Set(discoveredCardIds(team));
  return {
    id: action.id,
    kind: action.kind,
    targetId: action.targetId,
    targetLabel: targets[action.targetId] ?? "",
    prompt: action.prompt,
    evidence: action.requiredCardIds
      .filter((id) => known.has(id))
      .map((id) => ({ id, label: cards[id]!.sourceLabel })),
  };
}

function ownTeamView(
  shared: MurderShared,
  team: TeamState,
  playerId: string,
): NonNullable<MurderView["ownTeam"]> {
  const { cards } = shared.caseData;
  const inInvestigation = shared.phase === "INVESTIGATION";
  const spent = team.history.some((entry) => entry.round === shared.investigationRound);
  const leadId = inInvestigation ? (team.leadOrder[shared.investigationRound - 1] ?? null) : null;
  const afterSharing = !PHASES_BEFORE_SHARING.includes(shared.phase);
  const conclusionOpen = ["CONCLUSION", "AWAITING_REVEAL", "REVEALED"].includes(shared.phase);
  const used = team.history.map((entry) => entry.actionId);
  const options =
    inInvestigation && team.active && !spent
      ? availableActions(shared.caseData.logic, used, discoveredCardIds(team)).map((a) =>
          optionOf(shared, team, a),
        )
      : [];
  const isSubmitter = shared.phase === "CONCLUSION" && submitterOf(team) === playerId;
  const editable = isSubmitter && team.active && team.submission === null && live(shared);
  return {
    groupId: team.groupId,
    members: team.members,
    connected: team.connected,
    leadId,
    submitterId: conclusionOpen ? submitterOf(team) : null,
    options,
    history: team.history.map((entry) => ({
      round: entry.round,
      label: shared.caseData.logic.actions.find((a) => a.id === entry.actionId)?.prompt ?? "",
    })),
    myCards: afterSharing
      ? discoveredCardIds(team)
          .filter((id) => team.owners[id] === playerId)
          .map((id) => cards[id]!)
      : [],
    sharedCards: conclusionOpen ? discoveredCardIds(team).map((id) => cards[id]!) : null,
    draft: conclusionOpen ? team.draft : null,
    draftVersion: team.draftVersion,
    submission: conclusionOpen ? team.submission : null,
    canInvestigate: inInvestigation && team.active && !spent && leadId === playerId && live(shared),
    canEdit: editable,
    canSubmit: editable && isDraftComplete(team.draft),
  };
}

/**
 * Projects the shared state for one device, building each field explicitly so nothing private
 * can leak by spreading state.
 *
 * Visibility: the public briefing opens for the host at READY, the projector at INTRO and
 * players at BRIEFING; the intro descriptor goes to host and projector only, never to players.
 * Players see only their own cards until the conclusion, then their team's discoveries. Reveal,
 * results and the Reveal time stay null until the host reveals. Membership is the frozen team
 * list, so a late joiner, a rejoiner under a new id or a removed player gets a public-only view.
 *
 * @param args.shared the full state.
 * @param args.viewer who is asking.
 * @param args.viewerGroupId advisory only; team membership is by frozen player id.
 * @returns the view DTO.
 */
export function viewFor(args: {
  config: MurderConfig;
  shared: MurderShared;
  viewer: Viewer;
  viewerGroupId: GroupId | null;
}): MurderView {
  const { shared, viewer } = args;
  const { caseData } = shared;
  const isHost = viewer.kind === "host";
  const revealed = shared.phase === "REVEALED";
  const hasIntro = isHost || viewer.kind === "projector";
  const team = viewer.kind === "player" ? teamOfPlayer(shared, viewer.playerId) : undefined;

  const scores = shared.teams.map((t) =>
    scoreConclusion(caseData, discoveredCardIds(t), t.submission),
  );
  const ranks = rankTotals(scores.map((s) => s.total));
  const faces: ClueFace[] = Object.values(caseData.cards);

  return {
    caseInstanceId: shared.caseInstanceId,
    caseNumber: shared.caseNumber,
    phaseVersion: shared.phaseVersion,
    phase: shared.phase,
    paused: shared.paused,
    clock: shared.clock,
    investigationRound: shared.investigationRound,
    briefing: briefingVisible(viewer, shared.phase) ? caseData.briefing : null,
    intro: hasIntro && shared.phase !== "READY" ? caseData.intro : null,
    introMs: INTRO_MS,
    revealStartedAt: revealed ? shared.revealedAt : null,
    progress: shared.teams.map((t) => ({
      groupId: t.groupId,
      active: t.active,
      acted:
        shared.phase === "INVESTIGATION" &&
        t.history.some((entry) => entry.round === shared.investigationRound),
      submitted: t.submission !== null,
    })),
    ownTeam: viewer.kind === "player" && team ? ownTeamView(shared, team, viewer.playerId) : null,
    hostDetails: isHost
      ? {
          solution: caseData.reveal,
          cards: faces,
          teams: shared.teams.map((t) => ({
            groupId: t.groupId,
            members: t.members,
            connected: t.connected,
            leadOrder: t.leadOrder,
            owners: t.owners,
            draft: t.draft,
            submission: t.submission,
          })),
        }
      : null,
    reveal: revealed ? caseData.reveal : null,
    results: revealed
      ? shared.teams.map((t, i) => ({ groupId: t.groupId, rank: ranks[i]!, score: scores[i]! }))
      : null,
  };
}
