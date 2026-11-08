// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSfx, SFX_NAMES } from "@cangsplayground/game-werewolf/sfx";
import views from "@cangsplayground/game-werewolf/views";
import { myState, props, wwView } from "./werewolf-fixture";

/** Counts how many audio contexts and nodes the code asks for. */
const made = { contexts: 0, oscillators: 0, buffers: 0, resumed: 0 };
class FakeAudioContext {
  currentTime = 0;
  sampleRate = 8000;
  destination = {};
  constructor() {
    made.contexts++;
  }
  resume() {
    made.resumed++;
    return Promise.resolve();
  }
  createOscillator() {
    made.oscillators++;
    const param = {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      value: 0,
    };
    return {
      type: "sine",
      frequency: param,
      connect: (n: unknown) => n,
      start: vi.fn(),
      stop: vi.fn(),
    };
  }
  createGain() {
    const gain = {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      value: 0,
    };
    return { gain, connect: (n: unknown) => n };
  }
  createBuffer(_c: number, n: number) {
    made.buffers++;
    return { getChannelData: () => new Float32Array(n) };
  }
  createBufferSource() {
    return { buffer: null, connect: (n: unknown) => n, start: vi.fn() };
  }
  createBiquadFilter() {
    return { type: "lowpass", frequency: { value: 0 }, connect: (n: unknown) => n };
  }
}
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.assign(made, { contexts: 0, oscillators: 0, buffers: 0, resumed: 0 });
  vi.stubGlobal("AudioContext", FakeAudioContext);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});

it("is off by default and never touches the audio system while off", () => {
  const sfx = createSfx();
  expect(sfx.enabled).toBe(false);
  for (const name of SFX_NAMES) sfx.play(name);
  expect(made.contexts).toBe(0);
});

it("plays every named effect once enabled, with a single shared context", () => {
  const sfx = createSfx();
  sfx.setEnabled(true);
  expect(sfx.enabled).toBe(true);
  expect(made.resumed).toBe(1);
  for (const name of SFX_NAMES) sfx.play(name);
  expect(made.contexts).toBe(1);
  expect(made.oscillators + made.buffers).toBeGreaterThan(SFX_NAMES.length - 1);
});

it("stops making sound as soon as it is turned off again", () => {
  const sfx = createSfx();
  sfx.setEnabled(true);
  sfx.play("beat");
  const before = made.oscillators;
  sfx.setEnabled(false);
  sfx.play("beat");
  expect(made.oscillators).toBe(before);
});

it("keeps the choice in memory only", () => {
  const set = vi.spyOn(Storage.prototype, "setItem");
  const sfx = createSfx();
  sfx.setEnabled(true);
  expect(set).not.toHaveBeenCalled();
});

it("the projector and the player screen offer a toggle that starts off and turns sound on", async () => {
  for (const [Screen, p] of [
    [views.ProjectorScreen!, props(wwView(), "projector")],
    [views.PlayerSessionScreen!, props(wwView({ me: myState() }))],
  ] as const) {
    await act(async () => root.render(<Screen {...(p as never)} />));
    const toggle = container.querySelector<HTMLButtonElement>("[data-sound-toggle]")!;
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(toggle.textContent).toContain("Sound off");
    expect(made.contexts).toBe(0);
    await act(async () => toggle.click());
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(toggle.textContent).toContain("Sound on");
    expect(made.contexts).toBe(1);
    await act(async () => root.render(null));
    made.contexts = 0;
  }
});
