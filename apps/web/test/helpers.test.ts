import { describe, expect, it } from "vitest";
import type { LobbyView, ConfigField } from "@clubplay/core";
import { createLobbyStore } from "../src/store";
import { bestClockSample } from "../src/socket/clock";
import { timerDisplay } from "@clubplay/ui";
import { configDefaults, configValue, fieldControl } from "../src/components/config-fields";

const view: LobbyView = {
  viewer: { kind: "player", playerId: "p1" },
  code: "ABC234",
  status: "open",
  locked: false,
  hostConnected: false,
  createdAt: 0,
  maxPlayers: 60,
  players: [],
  groups: [],
  groupsVersion: 0,
  game: null,
  me: { playerId: "p1", name: "Thảo", groupId: null },
  catalog: [],
  warnings: [],
  version: 1,
};

describe("view store", () => {
  it("merges a top-level patch without dropping identity or unchanged players", () => {
    const store = createLobbyStore();
    store.getState().sync(view);
    store.getState().patch({ version: 2, locked: true });
    expect(store.getState().view).toEqual({ ...view, version: 2, locked: true });
  });
  it("ignores an older patch and a patch before the first snapshot", () => {
    const store = createLobbyStore();
    store.getState().patch({ version: 1, locked: true });
    expect(store.getState().view).toBeNull();
    store.getState().sync({ ...view, version: 3 });
    store.getState().patch({ version: 2, locked: true });
    expect(store.getState().view?.locked).toBe(false);
  });
  it("uses the latest clock offset for serverNow", () => {
    const store = createLobbyStore();
    store.getState().setOffset(1200);
    expect(Math.abs(store.getState().serverNow() - Date.now() - 1200)).toBeLessThan(20);
  });
});

describe("clock and timer", () => {
  it("retains the minimum RTT clock sample", () => {
    const first = bestClockSample(null, 1000, 1600, 1200);
    expect(first).toEqual({ rtt: 200, offset: 500 });
    expect(bestClockSample(first, 2000, 2700, 2400)).toEqual(first);
    expect(bestClockSample(first, 3000, 3620, 3040)).toEqual({ rtt: 40, offset: 600 });
  });
  it("rounds up, clamps expired timers, and holds paused timers", () => {
    expect(
      timerDisplay({ endsAt: 61001, pausedRemainingMs: null, durationMs: 60000 }, 1000),
    ).toMatchObject({ label: "1:01", seconds: 61, tone: "accent" });
    expect(
      timerDisplay({ endsAt: 999, pausedRemainingMs: null, durationMs: 60000 }, 1000),
    ).toMatchObject({ label: "0:00", tone: "danger" });
    expect(
      timerDisplay({ endsAt: null, pausedRemainingMs: 9000, durationMs: 60000 }, 999999),
    ).toMatchObject({ label: "0:09", paused: true, tone: "muted" });
    expect(
      timerDisplay({ endsAt: 11000, pausedRemainingMs: null, durationMs: 60000 }, 1000).tone,
    ).toBe("warning");
  });
});

describe("catalog-driven config fields", () => {
  const fields: ConfigField[] = [
    { key: "seconds", kind: "number", label: "Time", min: 15, max: 300 },
    { key: "prompt", kind: "textarea", label: "Prompt" },
    { key: "title", kind: "text", label: "Title" },
    { key: "ready", kind: "boolean", label: "Ready" },
    { key: "level", kind: "select", label: "Level", options: [{ value: "a2", label: "A2" }] },
  ];
  it("maps every kind to a supported form control", () => {
    expect(fields.map(fieldControl)).toEqual(["number", "textarea", "text", "switch", "select"]);
  });
  it("keeps typed booleans and numbers, including false and zero", () => {
    expect(configValue(fields[0]!, "45")).toBe(45);
    expect(configValue(fields[3]!, false)).toBe(false);
    expect(configValue(fields[0]!, "0")).toBe(0);
    expect(configValue(fields[1]!, "What do you like?")).toBe("What do you like?");
  });
  it("takes existing config before catalog defaults", () => {
    expect(
      configDefaults(fields, { seconds: 60, ready: true }, { seconds: 30, ready: false }),
    ).toMatchObject({ seconds: 30, ready: false, level: "a2", prompt: "", title: "" });
  });
});
