import type { Sfx, SfxName } from "./sfx-context.js";

export const SFX_NAMES: readonly SfxName[] = [
  "beat",
  "claw",
  "splat",
  "drop",
  "lock",
  "shatter",
  "flip",
  "win",
  "lose",
  "dawn",
  "tick",
  "slam",
];

type Wave = "sine" | "square" | "sawtooth" | "triangle";

/**
 * Synthesized sound effects (no audio files). Everything is off until `setEnabled(true)`, which also
 * unlocks the browser's audio context (call it from a tap). The choice lives in memory only.
 */
export function createSfx(): Sfx {
  let context: AudioContext | null = null;
  let enabled = false;
  const ctx = (): AudioContext => (context ??= new AudioContext());

  const tone = (
    freq: number,
    dur: number,
    type: Wave = "sine",
    vol = 0.15,
    when = 0,
    slide = 0,
  ) => {
    const c = ctx();
    const t = c.currentTime + when;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  };
  const noise = (dur: number, vol = 0.25, when = 0, lowpass = 900) => {
    const c = ctx();
    const length = Math.max(1, Math.floor(c.sampleRate * dur));
    const buffer = c.createBuffer(1, length, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = c.createBufferSource();
    const filter = c.createBiquadFilter();
    const gain = c.createGain();
    src.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = lowpass;
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(c.destination);
    src.start(c.currentTime + when);
  };

  const effects: Record<SfxName, () => void> = {
    tick: () => tone(880, 0.07, "square", 0.04),
    beat: () => {
      tone(62, 0.16, "sine", 0.5);
      tone(55, 0.2, "sine", 0.4, 0.2);
    },
    slam: () => {
      tone(90, 0.5, "sawtooth", 0.2, 0, -50);
      noise(0.35, 0.3, 0, 500);
    },
    splat: () => {
      noise(0.5, 0.5, 0, 1400);
      tone(70, 0.35, "sine", 0.5, 0, -30);
    },
    claw: () => [0, 0.1, 0.2].forEach((w) => noise(0.18, 0.25, w, 6000)),
    drop: () => tone(520, 0.12, "sine", 0.12, 0, -300),
    lock: () => {
      tone(60, 0.7, "sine", 0.7, 0, -20);
      noise(0.25, 0.35, 0, 300);
    },
    shatter: () => noise(0.6, 0.4, 0, 5000),
    flip: () => tone(660, 0.08, "triangle", 0.08, 0, 200),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.5, "triangle", 0.12, i * 0.12)),
    lose: () => [220, 196, 165, 110].forEach((f, i) => tone(f, 0.7, "sawtooth", 0.1, i * 0.18)),
    dawn: () => [392, 494, 587].forEach((f, i) => tone(f, 0.9, "sine", 0.1, i * 0.25)),
  };

  return {
    get enabled() {
      return enabled;
    },
    setEnabled(value) {
      enabled = value;
      if (value) void ctx().resume();
    },
    play(name) {
      if (enabled) effects[name]();
    },
  };
}
