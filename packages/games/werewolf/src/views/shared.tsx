import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from "react";
import type { LobbyView } from "@cangsplayground/core";
import { PlayerAvatar } from "@cangsplayground/ui";
import type { Role } from "../types.js";
import type { Roster } from "./Roster.js";
import { stars } from "./effects.js";

export const ROLE_LABEL: Record<Role, string> = {
  werewolf: "Werewolf",
  villager: "Villager",
  seer: "Seer",
  guard: "Guard",
};
export const ROLE_BLURB: Record<Role, string> = {
  werewolf: "Hunt the village. Vote with your pack each night.",
  villager: "Find the werewolves before they find you.",
  seer: "Each night, learn if one player is a werewolf.",
  guard: "Each night, protect one player from the wolves.",
};
export const ROLE_COLOR: Record<Role, string> = {
  werewolf: "var(--role-werewolf)",
  villager: "var(--role-villager)",
  seer: "var(--role-seer)",
  guard: "var(--role-guard)",
};

const ICONS: Record<Role | "moon" | "skull", ReactNode> = {
  werewolf: (
    <>
      <path d="M4 3l4.5 3.5L12 6l3.5.5L20 3l-1 8 1.5 3-3 5-4 2h-1l-4-2-3-5L5 11z" />
      <path d="M9 12l1.5 1M15 12l-1.5 1M10.5 17h3" />
    </>
  ),
  villager: (
    <>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  seer: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  guard: (
    <>
      <path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" />,
  skull: (
    <>
      <path d="M12 3a8 8 0 0 0-8 8c0 3 1.5 4.7 3 5.7V20h3v-2h4v2h3v-3.3c1.5-1 3-2.7 3-5.7a8 8 0 0 0-8-8z" />
      <circle cx="9" cy="11" r="1.3" />
      <circle cx="15" cy="11" r="1.3" />
    </>
  ),
};

/** Stroke icon for a role (same family as the rest of the app's icons). */
export function RoleIcon({
  role,
  className = "",
}: {
  role: Role | "moon" | "skull";
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" className={`ic ${className}`} aria-hidden="true">
      {ICONS[role]}
    </svg>
  );
}

/** Stable vivid colour per player, used only for glows. */
export function colorFor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 85% 66%)`;
}

export function useRoster(lobby: LobbyView): Roster {
  return useMemo(() => {
    const map = new Map(lobby.players.map((p) => [p.id, p]));
    return { get: (id) => map.get(id), name: (id) => map.get(id)?.name ?? "Someone" };
  }, [lobby.players]);
}

/** Server-synced "now", refreshed a few times per second. */
export function useNow(serverNow: () => number, everyMs = 250): number {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    const t = setInterval(() => setNow(serverNow()), everyMs);
    return () => clearInterval(t);
  }, [serverNow, everyMs]);
  return now;
}

export const secondsLeft = (deadlineAt: number | null, now: number): number =>
  deadlineAt === null ? 0 : Math.max(0, Math.ceil((deadlineAt - now) / 1000));

/** Length in seconds of the current stage: what the server says, else the configured default. */
export const stageSeconds = (view: { stageMs: number | null }, fallbackSeconds: number): number =>
  view.stageMs ? view.stageMs / 1000 : fallbackSeconds;

export const fmt = (sec: number): string =>
  `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

/** The player's customised avatar, filling its parent (`.av` / `.mini` size it). */
export function Face({ roster, id }: { roster: Roster; id: string }) {
  const p = roster.get(id);
  return (
    <PlayerAvatar
      playerId={id}
      {...(p?.avatar ? { avatar: p.avatar } : {})}
      size={64}
      label={roster.name(id)}
    />
  );
}

export function Mini({ roster, id }: { roster: Roster; id: string }) {
  return (
    <span className="mini" style={{ "--c": colorFor(id) } as CSSProperties}>
      <Face roster={roster} id={id} />
    </span>
  );
}

export interface PortraitProps {
  roster: Roster;
  id: string;
  cls?: string;
  style?: CSSProperties;
  bubble?: boolean;
}

/** A player as a candle-lit portrait: flame above, avatar, name. */
export function Portrait({ roster, id, cls = "", style, bubble = false }: PortraitProps) {
  return (
    <div
      className={`pt ${cls}`}
      data-n={id}
      style={{ "--c": colorFor(id), ...style } as CSSProperties}
    >
      <i className="flame" />
      <span className="av">
        <Face roster={roster} id={id} />
        <span className="xe">✕ ✕</span>
      </span>
      <b className="nm">{roster.name(id)}</b>
      <span className="z">z</span>
      {bubble && (
        <span className="bubble">
          <i />
          <i />
          <i />
        </span>
      )}
    </div>
  );
}

/** Full-height player screen with the themed background. Pass `starry` for the night sky. */
export function Frame({
  cls,
  starry = false,
  innerRef,
  children,
}: {
  cls: string;
  starry?: boolean;
  innerRef?: Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  const sky = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (starry && sky.current && !sky.current.childElementCount) stars(sky.current, 34, 4);
  }, [starry]);
  return (
    <div className={`screen ${cls}`} ref={innerRef}>
      <div className="bg-fill" />
      {starry && <div className="stars" ref={sky} />}
      {children}
    </div>
  );
}

/** Circular countdown (the mockup's `.ring-clock`): the stroke drains as `left` falls toward 0. */
export function RingClock({
  left,
  total,
  cls = "",
}: {
  left: number;
  total: number;
  cls?: string;
}) {
  const tone = left <= 5 ? "hot" : left <= 10 ? "warn" : "";
  return (
    <div className={`ring-clock ${cls} ${tone}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="trk" cx="50" cy="50" r="46" />
        <circle
          className="prg"
          cx="50"
          cy="50"
          r="46"
          pathLength={100}
          style={{ strokeDasharray: `${Math.min(1, left / Math.max(1, total)) * 100} 100` }}
        />
      </svg>
      <i className="core" />
      <b>{fmt(left)}</b>
    </div>
  );
}
