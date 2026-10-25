import { z } from "zod";
import {
  EXTEND_MS,
  shuffle,
  type GameModule,
  type SharedArgs,
  type TimerState,
  type Viewer,
} from "@cangsplayground/core";
import { ideas } from "./ideas.js";
import { PART_FRAMES, blankCount } from "./phrases.js";
import { assignParts } from "./rules.js";
import {
  GAME_ID,
  PART_ORDER,
  configSchema,
  type Company,
  type SharkTankConfig,
  type SharkTankShared,
} from "./types.js";

type Context = Omit<SharedArgs<SharkTankConfig, SharkTankShared>, "shared"> & { actor: Viewer };
type Reducer = (shared: SharkTankShared, ctx: Context, payload: unknown) => SharkTankShared | null;

function idleTimer(): TimerState {
  return { durationMs: 0, endsAt: null, pausedRemainingMs: null };
}
function startTimer(seconds: number, now: number): TimerState {
  return { ...idleTimer(), durationMs: seconds * 1000, endsAt: now + seconds * 1000 };
}
function playerCompany(shared: SharkTankShared, actor: Viewer): Company | undefined {
  return actor.kind === "player"
    ? shared.companies.find((c) => c.members.includes(actor.playerId))
    : undefined;
}
function canTime(shared: SharkTankShared, ctx: Context, payload: unknown): boolean {
  return (
    ctx.actor.kind === "host" &&
    payload === undefined &&
    ["PREP", "PITCH", "QA", "HUDDLE"].includes(shared.stage)
  );
}

const stepPayload = z.object({ step: z.number().int().min(1).max(4) });
const pricePayload = z.object({ price: z.number().int() });
const scriptPayload = z.object({
  part: z.enum(PART_ORDER),
  blanks: z.array(z.string().trim().max(80)),
});
const helpPayload = z.object({ on: z.boolean() });
const clearHelpPayload = z.object({ groupId: z.string().min(1) });
const nextPayload = z.object({
  from: z.enum(["PREP", "PITCH", "QA", "HUDDLE", "DECISION", "RESULTS", "CLOSING"]),
  presenterIndex: z.number().int().min(0),
});

function next(shared: SharkTankShared, ctx: Context): SharkTankShared | null {
  if (shared.stage !== "PREP") return null;
  const order = shuffle(
    shared.companies.filter((c) => c.members.length).map((c) => c.groupId),
    ctx.rng,
  );
  if (!order.length) return null;
  for (const company of shared.companies)
    company.price ??= Math.round((ctx.config.minPrice + ctx.config.maxPrice) / 2);
  shared.stage = "PITCH";
  shared.timer = startTimer(ctx.config.pitchSeconds, ctx.now);
  shared.order = order;
  shared.presenterIndex = 0;
  shared.asked[order[0]!] = [];
  shared.votes = {};
  shared.locked = [];
  shared.announcers = {};
  return shared;
}

export const ACTIONS: Record<string, Reducer> = {
  "st:reroll": (shared, ctx, payload) => {
    const company = playerCompany(shared, ctx.actor);
    if (
      shared.stage !== "PREP" ||
      payload !== undefined ||
      !company ||
      company.rerolled ||
      company.rerollLocked
    )
      return null;
    const used = new Set(shared.companies.map((c) => c.ideaId));
    const available = ideas().filter((idea) => !used.has(idea.id));
    if (!available.length) return null;
    company.ideaId = available[ctx.rng.int(available.length)]!.id;
    company.rerolled = true;
    return shared;
  },
  "st:step": (shared, ctx, payload) => {
    const company = playerCompany(shared, ctx.actor),
      parsed = stepPayload.safeParse(payload);
    if (shared.stage !== "PREP" || !company || !parsed.success) return null;
    company.prepStep = parsed.data.step as Company["prepStep"];
    if (company.prepStep > 1) company.rerollLocked = true;
    return shared;
  },
  "st:price": (shared, ctx, payload) => {
    const company = playerCompany(shared, ctx.actor),
      parsed = pricePayload.safeParse(payload);
    if (
      shared.stage !== "PREP" ||
      !company ||
      !parsed.success ||
      parsed.data.price < ctx.config.minPrice ||
      parsed.data.price > ctx.config.maxPrice
    )
      return null;
    company.price = parsed.data.price;
    return shared;
  },
  "st:script": (shared, ctx, payload) => {
    const company = playerCompany(shared, ctx.actor),
      parsed = scriptPayload.safeParse(payload);
    if (shared.stage !== "PREP" || ctx.actor.kind !== "player" || !company || !parsed.success)
      return null;
    const { part, blanks } = parsed.data;
    if (
      !company.parts[ctx.actor.playerId]?.includes(part) ||
      blanks.length !== blankCount(PART_FRAMES[part])
    )
      return null;
    company.scripts[part] = blanks;
    return shared;
  },
  "st:help": (shared, ctx, payload) => {
    const company = playerCompany(shared, ctx.actor),
      parsed = helpPayload.safeParse(payload);
    if (!company || !parsed.success) return null;
    company.help = parsed.data.on;
    return shared;
  },
  "st:clearHelp": (shared, ctx, payload) => {
    const parsed = clearHelpPayload.safeParse(payload);
    if (ctx.actor.kind !== "host" || !parsed.success) return null;
    const company = shared.companies.find((c) => c.groupId === parsed.data.groupId);
    if (!company) return null;
    company.help = false;
    return shared;
  },
  "st:pause": (shared, ctx, payload) => {
    if (!canTime(shared, ctx, payload) || shared.timer.endsAt === null) return null;
    shared.timer.pausedRemainingMs = Math.max(0, shared.timer.endsAt - ctx.now);
    shared.timer.endsAt = null;
    return shared;
  },
  "st:resume": (shared, ctx, payload) => {
    if (!canTime(shared, ctx, payload) || shared.timer.pausedRemainingMs === null) return null;
    shared.timer.endsAt = ctx.now + shared.timer.pausedRemainingMs;
    shared.timer.pausedRemainingMs = null;
    return shared;
  },
  "st:extend": (shared, ctx, payload) => {
    if (!canTime(shared, ctx, payload)) return null;
    const timer = shared.timer;
    if (timer.endsAt === null && timer.pausedRemainingMs === null) return null;
    timer.durationMs += EXTEND_MS;
    if (timer.endsAt !== null) timer.endsAt = Math.max(timer.endsAt, ctx.now) + EXTEND_MS;
    else timer.pausedRemainingMs! += EXTEND_MS;
    return shared;
  },
  "st:next": (shared, ctx, payload) => {
    const parsed = nextPayload.safeParse(payload);
    if (
      ctx.actor.kind !== "host" ||
      !parsed.success ||
      parsed.data.from !== shared.stage ||
      parsed.data.presenterIndex !== shared.presenterIndex
    )
      return null;
    return next(shared, ctx);
  },
};

export const sharkTank: GameModule<SharkTankConfig, null, SharkTankShared> = {
  id: GAME_ID,
  name: "Shark Tank",
  description: "Pitch a wild product, ask questions and make a deal.",
  minPlayersPerGroup: 2,
  maxPlayersPerGroup: 5,
  recommended: "3–4 per group",
  unsupportedControls: ["pause", "resume", "skip", "extend", "endRound", "reveal", "nextRound"],
  configSchema,
  defaultConfig: configSchema.parse({}),
  configFields: [
    {
      key: "prepMinutes",
      label: "Preparation time",
      kind: "number",
      display: "stepper",
      min: 5,
      max: 40,
      step: 1,
      unit: "min",
    },
    {
      key: "pitchSeconds",
      label: "Pitch time",
      kind: "number",
      display: "stepper",
      min: 30,
      max: 600,
      step: 15,
      unit: "sec",
    },
    {
      key: "qaSeconds",
      label: "Question time",
      kind: "number",
      display: "stepper",
      min: 30,
      max: 900,
      step: 15,
      unit: "sec",
    },
    {
      key: "huddleSeconds",
      label: "Huddle and vote time",
      kind: "number",
      display: "stepper",
      min: 30,
      max: 300,
      step: 15,
      unit: "sec",
    },
    {
      key: "moneyPerMember",
      label: "Money per member",
      kind: "number",
      display: "stepper",
      min: 10,
      max: 1000,
      step: 10,
      unit: "$",
    },
    {
      key: "minPrice",
      label: "Minimum price",
      kind: "number",
      display: "stepper",
      min: 1,
      max: 1000,
      step: 5,
      unit: "$",
    },
    {
      key: "maxPrice",
      label: "Maximum price",
      kind: "number",
      display: "stepper",
      min: 1,
      max: 1000,
      step: 5,
      unit: "$",
    },
    {
      key: "minSpendPercent",
      label: "Minimum spending",
      kind: "number",
      display: "stepper",
      min: 0,
      max: 100,
      step: 10,
      unit: "%",
    },
    {
      key: "noQuestionPenalty",
      label: "Penalty per member who did not ask",
      kind: "number",
      display: "stepper",
      min: 0,
      max: 500,
      step: 5,
      unit: "$",
    },
  ],
  turnDurationMs: () => null,
  prepare: () => null,
  publicInfo: () => ({}),
  viewFor: () => null,
  validateGroup: ({ group }) =>
    group.playerIds.length > 5 ? "Shark Tank needs 2–5 players in each group." : null,
  validateGroups: ({ groups }) =>
    groups.length < 2 || groups.length > 12 ? "Shark Tank needs 2–12 groups." : null,
  prepareShared({ config, groups, rng, now }) {
    const dealt = shuffle(ideas(), rng);
    return {
      stage: "PREP",
      timer: startTimer(config.prepMinutes * 60, now),
      order: [],
      presenterIndex: 0,
      presented: [],
      companies: groups.map((group, index) => ({
        groupId: group.groupId,
        ideaId: dealt[index]!.id,
        prepStep: 1,
        rerolled: false,
        rerollLocked: false,
        price: null,
        discounted: false,
        members: [...group.playerIds],
        formerMembers: [],
        startMembers: group.playerIds.length,
        startWallet: config.moneyPerMember * group.playerIds.length,
        parts: assignParts(group.playerIds),
        scripts: {},
        wallet: config.moneyPerMember * group.playerIds.length,
        help: false,
      })),
      asked: {},
      votes: {},
      locked: [],
      purchases: [],
      announcers: {},
      closing: null,
      left: [],
    };
  },
  onSharedAction({ shared, action, ...ctx }) {
    if (!Object.hasOwn(ACTIONS, action.type)) return null;
    return ACTIONS[action.type]!(structuredClone(shared), ctx, action.payload);
  },
};
