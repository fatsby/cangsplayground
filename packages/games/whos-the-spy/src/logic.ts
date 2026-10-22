import { activePlayers, shuffle, type ConfigField, type GameModule } from "@cangsplayground/core";
import { topicsFor, topicById } from "./topics.js";
import {
  GAME_ID,
  VOTE_MS,
  TURNS_BEFORE_VOTE,
  configSchema,
  type WhosTheSpyConfig,
  type WhosTheSpyData,
  type WhosTheSpyGroupView,
  type WhosTheSpyPublicInfo,
} from "./types.js";
export const whosTheSpy: GameModule<WhosTheSpyConfig, WhosTheSpyData> = {
  id: GAME_ID,
  name: "Who's the Spy",
  description: "Find the spy. Talk about the topic, but don't say its name.",
  minPlayersPerGroup: 3,
  recommended: "3–8 per group",
  configSchema,
  defaultConfig: configSchema.parse({}),
  configFields: [
    {
      key: "category",
      label: "Category",
      kind: "select",
      options: [
        { value: "location", label: "Location" },
        { value: "food", label: "Food" },
      ],
    },
    ...(["location", "food"] as const).map((c): ConfigField => ({
      key: `${c}Topic`,
      label: "Topic",
      kind: "select",
      showWhen: { key: "category", equals: c },
      options: [
        { value: "random", label: "🎲 Random" },
        ...topicsFor(c).map((t) => ({ value: t.id, label: t.name })),
      ],
    })),
    {
      key: "spies",
      label: "Spies per group",
      kind: "number",
      min: 1,
      max: 29,
      step: 1,
      help: "Always fewer spies than other players.",
    },
    {
      key: "gameMinutes",
      label: "Game time",
      kind: "number",
      min: 5,
      max: 30,
      step: 1,
      unit: "min",
    },
    {
      key: "turnSeconds",
      label: "Time for each turn",
      kind: "number",
      min: 15,
      max: 300,
      step: 15,
      unit: "sec",
    },
  ],
  turnDurationMs: (c) => c.turnSeconds * 1000,
  turnsPerPlayer: () => TURNS_BEFORE_VOTE,
  voteDurationMs: () => VOTE_MS,
  gameDurationMs: (c) => c.gameMinutes * 60_000,
  resolveConfig({ config, rng }) {
    const key = config.category === "location" ? "locationTopic" : "foodTopic";
    return config[key] === "random"
      ? {
          ...config,
          [key]: topicsFor(config.category)[rng.int(topicsFor(config.category).length)]!.id,
        }
      : config;
  },
  validateGroup({ config, group }) {
    const n = group.playerIds.length,
      s = config.spies;
    return s > Math.floor((n - 1) / 2)
      ? `${group.name} has ${n} players. ${s} ${s === 1 ? "spy needs" : "spies need"} at least ${2 * s + 1}.`
      : null;
  },
  prepare({ config, group, rng }) {
    return {
      topicId: config.category === "location" ? config.locationTopic : config.foodTopic,
      spies: shuffle([...new Set(group.playerIds)], rng).slice(0, config.spies),
      votes: {},
      voteNumber: 0,
      lastVote: null,
      result: null,
    };
  },
  publicInfo: (c): WhosTheSpyPublicInfo => ({ category: c.category, turnSeconds: c.turnSeconds }),
  viewFor({ state, viewer, isMember }): WhosTheSpyGroupView {
    const d = state.data,
      host = viewer.kind === "host",
      member = viewer.kind === "player" && isMember;
    const out = member && state.eliminated.includes(viewer.playerId);
    const role = member ? (d.spies.includes(viewer.playerId) ? "spy" : "civilian") : null;
    const reveal = host || (member && d.result !== null);
    const showTopic = reveal || (member && !out && role === "civilian");
    const topic = showTopic ? topicById(d.topicId) : null;
    return {
      category: topicById(d.topicId).category,
      role: member && (!out || d.result) ? role : null,
      topic: topic ? { name: topic.name, hints: [...topic.hints] } : null,
      spies: reveal ? [...d.spies] : null,
      voted: Object.keys(d.votes),
      myVote: member && (!out || d.result) ? (d.votes[viewer.playerId] ?? null) : null,
      votes: host ? { ...d.votes } : null,
      voteNumber: d.voteNumber,
      lastVote: d.lastVote
        ? host || member
          ? { ...d.lastVote, tally: { ...d.lastVote.tally } }
          : { out: d.lastVote.out, wasSpy: null, tally: null }
        : null,
      spiesLeft:
        host || member ? d.spies.filter((id) => activePlayers(state).includes(id)).length : null,
      result: d.result ? { ...d.result } : null,
    };
  },
};
