import { useEffect, useRef, useState } from "react";
import type { ScreenProps } from "./ScreenProps.js";
import { Frame, Portrait } from "./shared.jsx";
import { bloodCurtain, bloodSplat, clawSlash, replay } from "./effects.js";
import { useSfx } from "./sfx-context.js";

/** The player who was killed overnight: claws, blood, then a flat heartbeat. Only their phone shows this. */
export function KilledScreen({ roster }: Pick<ScreenProps, "roster">) {
  const fx = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"" | "dead" | "show">("");
  const sfx = useSfx();
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));
    const layer = fx.current!;
    at(() => {
      clawSlash(layer);
      sfx.play("claw");
    }, 400);
    at(() => {
      replay(root.current!, "shake");
      bloodSplat(layer, 50, 17, 66);
      bloodSplat(layer, 12, 44, 40, { delay: 90 });
      bloodSplat(layer, 88, 50, 38, { delay: 150, droplets: 16 });
      bloodSplat(layer, 70, 90, 34, { delay: 210, droplets: 12 });
      bloodCurtain(layer, 8, 2.6);
      sfx.play("splat");
      setPhase("dead");
    }, 900);
    at(() => setPhase("show"), 1800);
    return () => {
      timers.forEach(clearTimeout);
      layer.innerHTML = "";
    };
  }, []);
  void roster;
  return (
    <Frame cls={`kill ${phase === "show" ? "show dead" : phase}`} innerRef={root}>
      <div className="fxp" ref={fx} />
      <div className="ctr">
        <h2>YOU WERE KILLED</h2>
        <p>The werewolves got you in the night.</p>
        <svg className="ecg" viewBox="0 0 300 40" preserveAspectRatio="none" aria-hidden="true">
          <path
            pathLength={1}
            d="M0 22H34L42 22L48 6L56 36L62 22H100L106 22L112 4L121 38L128 22H165L171 22L176 12L182 30L188 22H300"
          />
        </svg>
        <small>You can still see the game, but you can't act.</small>
      </div>
    </Frame>
  );
}

/**
 * What every surviving player sees when someone else was killed. The same for every role (wolves
 * included): a restrained blood accent and the victim's name, never their role.
 */
export function NewsScreen({ view, roster }: Pick<ScreenProps, "view" | "roster">) {
  const victim = view.dawn!.eliminatedId!;
  const fx = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const sfx = useSfx();
  useEffect(() => {
    const layer = fx.current!;
    const t = setTimeout(() => {
      setShow(true);
      sfx.play("splat");
      bloodSplat(layer, 50, 26, 34, { droplets: 14 });
      bloodCurtain(layer, 5, 1.6);
    }, 500);
    return () => {
      clearTimeout(t);
      layer.innerHTML = "";
    };
  }, [victim]);
  const alive = view.players.filter((p) => p.alive && !p.pending).length;
  return (
    <Frame cls={`kill news ${show ? "show" : ""}`}>
      <div className="fxp" ref={fx} />
      <div className="ctr">
        <Portrait
          roster={roster}
          id={victim}
          cls={`rel ${show ? "dead" : ""}`}
          style={{ "--sz": "84px" } as React.CSSProperties}
        />
        <h2 style={{ fontSize: 28 }}>{roster.name(victim).toUpperCase()} WAS KILLED</h2>
        <p>The werewolves struck in the night.</p>
        <span className="tag" style={{ margin: "6px 0 0" }}>
          {alive} players still alive
        </span>
      </div>
    </Frame>
  );
}

/** Nobody died. One animation, whether the Guard saved someone or the wolves attacked nobody. */
export function SafeScreen() {
  return (
    <Frame cls="dsafe play">
      <div className="sunp" />
      <div className="ctr">
        <h2>NO ONE DIED</h2>
        <p>Everyone survived the night.</p>
      </div>
    </Frame>
  );
}
