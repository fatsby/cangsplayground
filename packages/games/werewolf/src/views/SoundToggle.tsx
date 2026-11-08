import { useMemo, useState, type ReactNode } from "react";
import { createSfx } from "./sfx.js";
import { SfxContext, useSfx } from "./sfx-context.js";

/** Gives a view tree one sound system (off by default). */
export function SfxProvider({ children }: { children: ReactNode }) {
  const sfx = useMemo(createSfx, []);
  return <SfxContext.Provider value={sfx}>{children}</SfxContext.Provider>;
}

/** The "Sound off / Sound on" switch. Turning it on is a tap, which lets the browser start audio. */
export function SoundToggle() {
  const sfx = useSfx();
  const [on, setOn] = useState(sfx.enabled);
  return (
    <button
      type="button"
      className="sound-toggle"
      data-sound-toggle
      aria-pressed={on}
      onClick={() => {
        sfx.setEnabled(!on);
        setOn(!on);
      }}
    >
      {on ? "🔊 Sound on" : "🔇 Sound off"}
    </button>
  );
}
