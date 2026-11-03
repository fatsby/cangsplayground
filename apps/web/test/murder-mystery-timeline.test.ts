// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  countUpValue,
  elapsedStyle,
  isStaged,
  useElapsedMs,
  type ElapsedSource,
} from "@cangsplayground/game-murder-mystery/views";

describe("countUpValue", () => {
  it("is zero before its window, exact at the end and never decreasing", () => {
    expect(countUpValue(9, 0, 1000, 1000)).toBe(0);
    expect(countUpValue(9, 1000, 1000, 1000)).toBe(0);
    expect(countUpValue(9, 2000, 1000, 1000)).toBe(9);
    expect(countUpValue(9, 99_999, 1000, 1000)).toBe(9);
    let previous = 0;
    for (let ms = 0; ms <= 3000; ms += 17) {
      const value = countUpValue(10, ms, 500, 2000);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(Number.isInteger(value)).toBe(true);
      previous = value;
    }
    expect(previous).toBe(10);
  });

  it("handles a zero-length window", () => {
    expect(countUpValue(7, 10, 0, 0)).toBe(7);
  });
});

describe("elapsedStyle and isStaged", () => {
  it("sets --mm-elapsed in seconds, and a value past any timeline for reduced motion", () => {
    expect((elapsedStyle(2500, false) as Record<string, number>)["--mm-elapsed"]).toBe(2.5);
    expect((elapsedStyle(null, false) as Record<string, number>)["--mm-elapsed"]).toBe(0);
    expect((elapsedStyle(10, true) as Record<string, number>)["--mm-elapsed"]).toBeGreaterThan(
      1000,
    );
  });

  it("stages by delay, with reduced motion showing everything", () => {
    expect(isStaged(0, null, false)).toBe(false);
    expect(isStaged(0, 0, false)).toBe(true);
    expect(isStaged(2, 1999, false)).toBe(false);
    expect(isStaged(2, 2000, false)).toBe(true);
    expect(isStaged(50, 0, true)).toBe(true);
  });
});

describe("useElapsedMs", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let frames: (() => void)[];
  let seen: (number | null)[];
  const Probe = (props: { source: ElapsedSource }) => {
    seen.push(useElapsedMs(props.source));
    return null;
  };
  const last = () => seen[seen.length - 1];
  const runFrame = async () => {
    const queued = frames;
    frames = [];
    await act(async () => queued.forEach((frame) => frame()));
  };

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    frames = [];
    seen = [];
    vi.stubGlobal("requestAnimationFrame", (cb: () => void) => frames.push(cb));
    vi.stubGlobal("cancelAnimationFrame", () => {});
    container = document.createElement("div");
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  });
  const mount = (source: ElapsedSource) =>
    act(async () => root.render(createElement(Probe, { source })));

  it("is null before the sequence starts and requests no frames", async () => {
    await mount({ totalMs: 1000, startedAt: null, serverNow: () => 5000 });
    expect(last()).toBeNull();
    expect(frames).toHaveLength(0);
  });

  it("resumes at the right frame on a late mount and follows the server clock", async () => {
    let now = 10_400;
    await mount({ totalMs: 5000, startedAt: 10_000, serverNow: () => now });
    expect(last()).toBe(400);
    now = 11_000;
    await runFrame();
    expect(last()).toBe(1000);
  });

  it("stops at the total and runs no more frames", async () => {
    let now = 10_000;
    await mount({ totalMs: 2000, startedAt: 10_000, serverNow: () => now });
    now = 99_999;
    await runFrame();
    expect(last()).toBe(2000);
    expect(frames).toHaveLength(0);
  });

  it("shows the final frame without any loop for a device that joins after the end", async () => {
    await mount({ totalMs: 2000, startedAt: 10_000, serverNow: () => 50_000 });
    expect(last()).toBe(2000);
    await runFrame();
    expect(frames).toHaveLength(0);
  });

  it("holds a frozen time while paused", async () => {
    let now = 10_000;
    await mount({ totalMs: 5000, startedAt: 10_000, serverNow: () => now, frozenAtMs: 1500 });
    expect(last()).toBe(1500);
    now = 14_000;
    await runFrame();
    expect(last()).toBe(1500);
    expect(frames).toHaveLength(0);
  });
});
