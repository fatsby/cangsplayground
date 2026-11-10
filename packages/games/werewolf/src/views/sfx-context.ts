import { createContext, useContext } from "react";

export type SfxName =
  | "beat"
  | "claw"
  | "splat"
  | "drop"
  | "lock"
  | "shatter"
  | "flip"
  | "win"
  | "lose"
  | "dawn"
  | "tick"
  | "slam";

/** Sound effects. Always off until the player or host turns them on. */
export interface Sfx {
  enabled: boolean;
  setEnabled(value: boolean): void;
  play(name: SfxName): void;
}

/** The default: silent. Views call `useSfx().play(...)` without caring whether sound is on. */
export const silentSfx: Sfx = { enabled: false, setEnabled: () => {}, play: () => {} };

export const SfxContext = createContext<Sfx>(silentSfx);
export const useSfx = (): Sfx => useContext(SfxContext);
