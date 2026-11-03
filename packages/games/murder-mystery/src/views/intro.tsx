import type { CSSProperties } from "react";
import type { CaseBriefing, IntroCaptions, IntroDescriptor } from "../types.js";
import { BEATS, SceneArt } from "./scene-art.js";
import { Stage } from "./stage.js";
import { elapsedStyle, isStaged } from "./timeline.js";

/** When each subtitle appears and how long it stays, in seconds (mockup D1b). */
const CAPTION_TIMES: Record<keyof IntroCaptions, { d: number; len: number; top?: boolean }> = {
  setting: { d: BEATS.settingCaption, len: 2.7 },
  walk: { d: BEATS.victimCard, len: 2.2 },
  blackout: { d: BEATS.blackout, len: 1.8 },
  found: { d: BEATS.found, len: 2.6, top: true },
};
const CAPTION_ORDER: (keyof IntroCaptions)[] = ["setting", "walk", "blackout", "found"];

const timed = (d: number, len?: number, extra: Record<string, number> = {}): CSSProperties =>
  ({
    ["--d" as string]: d,
    ...(len ? { ["--len" as string]: `${len}s` } : {}),
    ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [`--${k}`, v])),
  }) as CSSProperties;

/** Characters that fit on one subtitle line at full size; longer subtitles shrink to fit. */
const CAPTION_FIT_CHARS = 42;
const captionScale = (text: string): number =>
  Math.round(Math.min(1, CAPTION_FIT_CHARS / Math.max(text.length, 1)) * 100) / 100;

/** Which subtitle a screen reader should hear at an elapsed time. */
function captionFor(elapsedMs: number | null, reduced: boolean): keyof IntroCaptions {
  if (reduced) return "found";
  const s = (elapsedMs ?? 0) / 1000;
  if (s >= BEATS.found) return "found";
  if (s >= BEATS.blackout) return "blackout";
  if (s >= BEATS.victimCard) return "walk";
  return "setting";
}

/** The victim's role for the name card: the first sentence of the public description. */
function victimRole(description: string): string {
  const first = description.split(/(?<=\.)\s/)[0] ?? description;
  return first.replace(/\.$/, "");
}

/**
 * The projector's 13-second case introduction (mockup D1b), as a pure function of elapsed time.
 *
 * Every label comes from the public briefing and every look, shape and badge from the descriptor,
 * so two cases can look entirely different with the same component. The frame is set by one CSS
 * custom property, `--mm-elapsed`; every movement is a paused CSS animation sampled at that time,
 * so reload, pause (a frozen `elapsedMs`), reduced motion and a time past the end all resolve to
 * the right frame and the scene itself never re-renders on the clock.
 *
 * @param briefing the public case file.
 * @param intro the public descriptor built from the briefing.
 * @param elapsedMs ms since the intro began, or null before it starts.
 * @param reduced show only the final frame.
 * @param decorSeed the public case number; seeds the stars, rain and hotel lights.
 */
export function IntroStage({
  briefing,
  intro,
  elapsedMs,
  reduced,
  decorSeed,
}: {
  briefing: CaseBriefing;
  intro: IntroDescriptor;
  elapsedMs: number | null;
  reduced: boolean;
  decorSeed: number;
}) {
  const props = { elapsed: elapsedMs, reduced } as const;
  const suspectsShown = [0, 1, 2, 3].filter((i) =>
    isStaged(BEATS.suspectsStart + i * BEATS.suspectStep, elapsedMs, reduced),
  ).length;
  const current = captionFor(elapsedMs, reduced);
  return (
    <div
      className="mm-intro"
      data-scene={intro.sceneId}
      data-reduced={reduced ? "true" : undefined}
      style={elapsedStyle(elapsedMs, reduced)}
    >
      <SceneArt
        briefing={briefing}
        intro={intro}
        decorSeed={decorSeed}
        suspectsShown={suspectsShown}
      />
      <div className="cn-topshade t" />
      <div
        className="cap cn-namecard t"
        data-part="victim-card"
        style={timed(BEATS.victimCard, 2.4)}
      >
        <small>Victim</small>
        <b>{briefing.victim.name}</b>
        <span>{victimRole(briefing.victim.description)}</span>
      </div>
      <div className="cap cn-time t" data-part="time" style={timed(BEATS.found, 2.6)}>
        {intro.discoveredAt}
      </div>
      {CAPTION_ORDER.map((beat) => {
        const { d, len, top } = CAPTION_TIMES[beat];
        return (
          <p
            key={beat}
            className={`cap cn-cap mm-caption t${top ? " cn-cap-top" : ""}`}
            data-beat={beat}
            aria-hidden="true"
            style={timed(d, len, { fit: captionScale(intro.captions[beat]) })}
          >
            {intro.captions[beat]}
          </p>
        );
      })}
      <p className="mm-sr-only" aria-live="polite">
        {intro.captions[current]}
      </p>
      <Stage as="div" part="title" d={BEATS.title} className="cn-title mm-intro-title t" {...props}>
        <small>A new case</small>
        <h1>{briefing.title}</h1>
        <p className="mm-intro-question">Who did it? With what? In which room?</p>
      </Stage>
      <div className="cn-bar cn-bar-t t" />
      <div className="cn-bar cn-bar-b t" />
      <div className="cn-black t" />
    </div>
  );
}
