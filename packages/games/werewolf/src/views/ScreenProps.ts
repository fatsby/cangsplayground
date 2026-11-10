import type { GameAction } from "@cangsplayground/core";
import type { MyState } from "../MyState.js";
import type { WerewolfView } from "../WerewolfView.js";
import type { WerewolfConfig } from "../types.js";
import type { Roster } from "./Roster.js";

/** What every player screen needs. `config` holds the stage lengths the timer rings need. */
export interface ScreenProps {
  /** The viewing player's own id. */
  meId: string;
  view: WerewolfView;
  mine: MyState;
  roster: Roster;
  act: (action: GameAction) => Promise<boolean>;
  serverNow: () => number;
  config: WerewolfConfig;
}
