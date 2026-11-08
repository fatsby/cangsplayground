import { Waiting, type SessionViewProps } from "@cangsplayground/ui";
import type { LobbyView } from "@cangsplayground/core";
import { configSchema } from "../types.js";
import type { WerewolfView } from "../WerewolfView.js";
import { DiscussionScreen, VoteScreen } from "./DayScreens.js";
import { KilledScreen, NewsScreen, SafeScreen } from "./DawnScreens.js";
import { NightScreen } from "./NightScreen.js";
import { RoleScreen } from "./RoleScreen.js";
import type { ScreenProps } from "./ScreenProps.js";
import { FinalScreen, PendingScreen, SetupScreen, SpectatorScreen } from "./SideScreens.js";
import { VerdictScreen } from "./VerdictScreen.js";
import { useRoster } from "./shared.jsx";

type PlayerProps = SessionViewProps & { me: NonNullable<LobbyView["me"]> };

/**
 * Picks the screen for this player and stage. Priorities: the end of the game, then a waiting late
 * joiner, then stage-specific screens (the dawn kill and the verdict are for everyone, including the
 * player who just died); after that, eliminated players only spectate.
 */
export function PlayerSessionScreen({ lobby, session, me, act, serverNow }: PlayerProps) {
  const roster = useRoster(lobby);
  const view = session.shared as WerewolfView | null;
  const mine = view?.me;
  if (!view || !mine)
    return (
      <div className="ww-root ww-player">
        <Waiting message="Joining the village" />
      </div>
    );
  const config = configSchema.parse(session.config ?? {});
  const props: ScreenProps = {
    meId: me.playerId,
    view,
    mine,
    roster,
    act: act ?? (async () => false),
    serverNow,
    config,
  };
  const dawnVictim = view.dawn?.eliminatedId ?? null;
  let screen;
  if (view.stage === "ENDED") screen = <FinalScreen {...props} />;
  else if (mine.pending) screen = <PendingScreen />;
  else if (view.stage === "SETUP") screen = <SetupScreen />;
  else if (view.stage === "REVEAL") screen = <RoleScreen {...props} />;
  else if (view.stage === "DAWN")
    screen =
      dawnVictim === me.playerId ? (
        <KilledScreen roster={roster} />
      ) : dawnVictim ? (
        <NewsScreen view={view} roster={roster} />
      ) : (
        <SafeScreen />
      );
  else if (view.stage === "VERDICT" && view.lastVote)
    screen = <VerdictScreen view={view} roster={roster} />;
  else if (!mine.alive)
    screen = <SpectatorScreen view={view} roster={roster} serverNow={serverNow} />;
  else if (view.stage === "NIGHT") screen = <NightScreen {...props} />;
  else if (view.stage === "DISCUSSION") screen = <DiscussionScreen {...props} />;
  else if (view.stage === "VOTE") screen = <VoteScreen {...props} />;
  else screen = <SetupScreen />;
  return <div className="ww-root ww-player">{screen}</div>;
}
