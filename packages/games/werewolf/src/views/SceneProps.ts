import type { WerewolfConfig } from "../types.js";
import type { WerewolfView } from "../WerewolfView.js";
import type { Roster } from "./Roster.js";

/** What every projector scene needs. Scenes only ever get the public view. */
export interface SceneProps {
  view: WerewolfView;
  roster: Roster;
  serverNow: () => number;
  config: WerewolfConfig;
}
