import { KillScene, SafeScene } from "./DawnScenes.js";
import type { SceneProps } from "./SceneProps.js";

/** Dawn: the kill scene if someone died, otherwise the single "no one died" scene. */
export function DawnKillOrSafe(props: SceneProps) {
  return props.view.dawn?.eliminatedId ? <KillScene {...props} /> : <SafeScene {...props} />;
}
