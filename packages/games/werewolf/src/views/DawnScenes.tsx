import { useEffect, useRef, useState } from "react";
import type { SceneProps } from "./SceneProps.js";
import { Portrait } from "./shared.jsx";
import { bloodCurtain, bloodSplat, clawSlash, replay } from "./effects.js";
import { useSfx } from "./sfx-context.js";

type KillStep = { victim: boolean; row: boolean; dead: boolean; head: boolean };

/**
 * Dawn when someone was killed (~7.4 s, inside DAWN_MS): the victim's portrait comes forward, claws
 * slash across the stage, blood splashes, then the headline. Only the victim's name is shown.
 */
export function KillScene({ view, roster }: Pick<SceneProps, "view" | "roster">) {
  const victim = view.dawn!.eliminatedId!;
  const fx = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const sfx = useSfx();
  const [step, setStep] = useState<KillStep>({
    victim: false,
    row: false,
    dead: false,
    head: false,
  });
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));
    const layer = fx.current!;
    at(() => {
      setStep((s) => ({ ...s, victim: true }));
      sfx.play("beat");
    }, 500);
    at(() => setStep((s) => ({ ...s, row: true })), 1400);
    at(() => {
      clawSlash(layer);
      sfx.play("claw");
    }, 2400);
    at(() => {
      replay(root.current!, "shake");
      setFlash(true);
      setStep((s) => ({ ...s, dead: true }));
      sfx.play("splat");
      bloodSplat(layer, 50, 40, 34);
      bloodSplat(layer, 16, 26, 22, { delay: 80 });
      bloodSplat(layer, 86, 34, 19, { delay: 140 });
      bloodSplat(layer, 74, 80, 17, { delay: 200, droplets: 16 });
      bloodSplat(layer, 26, 78, 15, { delay: 260, droplets: 14 });
      bloodCurtain(layer, 10);
    }, 2920);
    at(() => setStep((s) => ({ ...s, head: true })), 3820);
    return () => {
      timers.forEach(clearTimeout);
      layer.innerHTML = "";
    };
  }, [victim, sfx]);
  const others = view.players.filter((p) => p.alive && !p.pending);
  return (
    <div className="scene sc-dawn" ref={root}>
      <div className="sky" />
      <div className="glowlow" />
      <div className="tag k">Morning · Day {view.night}</div>
      <Portrait
        roster={roster}
        id={victim}
        cls={`victim ${step.victim ? "in" : ""} ${step.dead ? "dead" : ""}`}
      />
      <div className={`row ${step.row ? "in" : ""}`}>
        {others.map((p) => (
          <Portrait key={p.id} roster={roster} id={p.id} />
        ))}
      </div>
      <div className="fx" ref={fx} />
      <div className={`redflash ${flash ? "go" : ""}`} />
      <div className={`head ${step.head ? "in" : ""}`}>
        <h2 className="hl">{roster.name(victim).toUpperCase()} WAS KILLED</h2>
        <p>The werewolves struck in the night.</p>
      </div>
    </div>
  );
}

/** Dawn when nobody died. One animation for "protected" and for "no attack": it never says which. */
export function SafeScene({ view, roster }: Pick<SceneProps, "view" | "roster">) {
  const sfx = useSfx();
  useEffect(() => sfx.play("dawn"), [sfx]);
  return (
    <div className="scene sc-safe">
      <div className="sky" />
      <div className="rays" />
      <div className="sun" />
      {[0, 2.4, 4.8].map((d) => (
        <svg
          key={d}
          className="bird"
          style={{ "--bd": `${d}s`, left: 0, top: `${18 + d * 2.4}%` } as React.CSSProperties}
          viewBox="0 0 30 14"
          aria-hidden="true"
        >
          <path d="M1 12 Q8 0 15 8 Q22 0 29 12" />
        </svg>
      ))}
      <div className="head">
        <h2 className="hl">NO ONE DIED</h2>
        <p>Everyone survived the night.</p>
      </div>
      <div className="row">
        {view.players
          .filter((p) => p.alive && !p.pending)
          .map((p) => (
            <Portrait key={p.id} roster={roster} id={p.id} />
          ))}
      </div>
    </div>
  );
}
