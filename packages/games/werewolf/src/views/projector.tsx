import type { SessionViewProps } from "@cangsplayground/ui";
import { configSchema } from "../types.js";
import type { WerewolfView } from "../WerewolfView.js";
import { DawnKillOrSafe } from "./DawnKillOrSafe.js";
import { TalkScene, VoteScene } from "./DayScenes.js";
import { FinalScene } from "./FinalScene.js";
import { NightScene } from "./NightScene.js";
import type { SceneProps } from "./SceneProps.js";
import { VerdictStage } from "./VerdictStage.js";
import { WaitScene } from "./WaitScene.js";
import { SfxProvider, SoundToggle } from "./SoundToggle.js";
import { useRoster } from "./shared.jsx";

/**
 * The classroom screen. It only ever receives the public view: living and eliminated players, vote
 * totals, the dawn result, and (after the game ends) every role. The scene follows the stage.
 */
export function ProjectorScreen({ lobby, session, serverNow }: SessionViewProps) {
  const roster = useRoster(lobby);
  const view = session.shared as WerewolfView | null;
  const config = configSchema.parse(session.config ?? {});
  let scene;
  if (!view) scene = null;
  else {
    const props: SceneProps = { view, roster, serverNow, config };
    switch (view.stage) {
      case "NIGHT":
        scene = <NightScene {...props} />;
        break;
      case "DAWN":
        scene = <DawnKillOrSafe {...props} />;
        break;
      case "DISCUSSION":
        scene = <TalkScene {...props} />;
        break;
      case "VOTE":
        scene = <VoteScene {...props} />;
        break;
      case "VERDICT":
        scene = view.lastVote ? (
          <VerdictStage view={view} roster={roster} />
        ) : (
          <WaitScene {...props} />
        );
        break;
      case "ENDED":
        scene = <FinalScene view={view} roster={roster} />;
        break;
      default:
        scene = <WaitScene {...props} />;
    }
  }
  return (
    <SfxProvider>
      <div className="ww-root ww-projector">
        <div className="pstage" aria-live="polite">
          {scene}
          <SoundToggle />
        </div>
      </div>
    </SfxProvider>
  );
}
