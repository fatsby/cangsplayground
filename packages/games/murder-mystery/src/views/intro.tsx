import type { CaseBriefing, IntroDescriptor } from "../types.js";
import { BEATS, SCENES } from "./scene-art.js";
import { Stage } from "./stage.js";
import { elapsedStyle } from "./timeline.js";

/** Which of the four subtitles is on screen at an elapsed time (seconds). */
function captionFor(intro: IntroDescriptor, elapsedMs: number | null, reduced: boolean): string {
  if (reduced) return intro.captions.found;
  const at = (elapsedMs ?? 0) / 1000;
  if (at >= BEATS.found) return intro.captions.found;
  if (at >= BEATS.attackerAppears - 0.4) return intro.captions.blackout;
  if (at >= BEATS.victimEnters) return intro.captions.walk;
  return intro.captions.setting;
}

/**
 * The projector's 13-second case introduction, as a pure function of elapsed time.
 *
 * Every label comes from the public briefing and every look, shape and badge from the descriptor,
 * so two cases can look entirely different with the same component. Reload, pause (a frozen
 * `elapsedMs`), reduced motion and a time past the end all resolve to the right frame.
 *
 * @param briefing the public case file.
 * @param intro the public descriptor built from the briefing.
 * @param elapsedMs ms since the intro began, or null before it starts.
 * @param reduced show only the final frame.
 * @param decorSeed the public case number; seeds the stars and rain.
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
  return (
    <div className="mm-intro" data-scene={intro.sceneId} style={elapsedStyle(elapsedMs, reduced)}>
      {SCENES[intro.sceneId]({ briefing, intro, elapsedMs, reduced, decorSeed })}
      <p className="mm-caption" aria-live="polite">
        {captionFor(intro, elapsedMs, reduced)}
      </p>
      <Stage as="div" part="title" d={BEATS.title} className="mm-intro-title" {...props}>
        <h1>{briefing.title}</h1>
      </Stage>
      <Stage as="p" part="question" d={BEATS.question} className="mm-intro-question" {...props}>
        Who did it? With what? In which room?
      </Stage>
    </div>
  );
}
