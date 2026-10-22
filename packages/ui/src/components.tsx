import {
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import {
  Circle,
  Square,
  Star,
  Triangle,
  Diamond,
  Hexagon,
  Heart,
  Moon,
  Mic,
  Eye,
  EyeOff,
  Pause,
  Users,
  MoreHorizontal,
  WifiOff,
  Clock3,
} from "lucide-react";
import { Switch as RadixSwitch, Tabs as RadixTabs } from "radix-ui";
import { Drawer as Vaul } from "vaul";
import {
  teamStyle,
  teamName,
  type GroupSummary,
  type PlayerSummary,
  type GroupGameView,
  type TimerState,
  type GameClockView,
} from "@cangsplayground/core";
import { timerDisplay } from "./timer";

export function teamVars(index: number): CSSProperties {
  const team = teamStyle(index);
  return { "--team": team.fill, "--team-fg": team.fg, "--team-neon": team.neon } as CSSProperties;
}
const shapes = { Circle, Square, Star, Triangle, Diamond, Hexagon, Heart, Moon };
export function TeamShape({ teamIndex, size = 24 }: { teamIndex: number; size?: number }) {
  const team = teamStyle(teamIndex),
    Shape = shapes[team.shape];
  return (
    <Shape
      size={size}
      strokeWidth={2.25}
      fill={team.outlined ? "none" : "currentColor"}
      aria-hidden="true"
    />
  );
}
export function Panel({ className = "", ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`cp-panel ${className}`} {...props} />;
}
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "accent" | "secondary" | "danger" | "ghost";
  size?: "md" | "lg";
}
export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`cp-button cp-button-${variant} cp-button-${size} ${className}`}
      {...props}
    />
  );
}
export function TeamBadge({
  teamIndex,
  className = "",
}: {
  teamIndex: number;
  className?: string;
}) {
  return (
    <span style={teamVars(teamIndex)} className={`cp-team-badge ${className}`}>
      <TeamShape teamIndex={teamIndex} size={18} />
      {teamName(teamIndex)}
    </span>
  );
}
export function Chip({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return <span className={`cp-chip ${active ? "cp-chip-active" : ""}`}>{children}</span>;
}
export function Input({
  label,
  error,
  className = "",
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  const autoId = useId(),
    inputId = id ?? autoId;
  return (
    <div className="cp-field">
      {label && <label htmlFor={inputId}>{label}</label>}
      <input
        {...props}
        id={inputId}
        className={`cp-input ${className}`}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
      />
      {error && (
        <p id={`${inputId}-error`} className="cp-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="cp-switch-row">
      <label htmlFor={id}>{label}</label>
      <RadixSwitch.Root
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        className="cp-switch"
      >
        <RadixSwitch.Thumb className="cp-switch-thumb" />
      </RadixSwitch.Root>
    </div>
  );
}
export function Tabs({
  value,
  onValueChange,
  items,
  children,
  className = "",
}: {
  value: string;
  onValueChange: (value: string) => void;
  items: { value: string; label: string; icon?: ReactNode }[];
  children?: ReactNode;
  className?: string;
}) {
  return (
    <RadixTabs.Root value={value} onValueChange={onValueChange} className={className}>
      <RadixTabs.List className="cp-tabs" aria-label="Console sections">
        {items.map((item) => (
          <RadixTabs.Trigger
            key={item.value}
            value={item.value}
            className={`cp-tab ${item.value === "secrets" ? "cp-tab-secret" : ""}`}
          >
            {item.icon}
            {item.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {children}
    </RadixTabs.Root>
  );
}
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Vaul.Root open={open} onOpenChange={onOpenChange}>
      <Vaul.Portal>
        <Vaul.Overlay className="cp-drawer-overlay" />
        <Vaul.Content className="cp-drawer">
          <div className="cp-drawer-handle" />
          <Vaul.Title>{title}</Vaul.Title>
          <Vaul.Description className={description ? "cp-muted" : "cp-sr-only"}>
            {description ?? "Choose an action below."}
          </Vaul.Description>
          <div className="cp-stack">{children}</div>
        </Vaul.Content>
      </Vaul.Portal>
    </Vaul.Root>
  );
}
export function EmptyState({
  message,
  icon,
  waiting = false,
  children,
}: {
  message: string;
  icon?: ReactNode;
  waiting?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="cp-empty">
      <span className="cp-empty-icon">{icon ?? <Users size={64} strokeWidth={2.25} />}</span>
      <p>{message}</p>
      {waiting && (
        <span className="cp-dots" aria-label="Waiting">
          <i />
          <i />
          <i />
        </span>
      )}
      {children}
    </div>
  );
}
export function Waiting({
  message = "Wait for your teacher",
  children,
}: {
  message?: string;
  children?: ReactNode;
}) {
  return (
    <EmptyState message={message} waiting>
      {children}
    </EmptyState>
  );
}
export function ReconnectingBanner() {
  return (
    <div className="cp-reconnecting" role="status">
      <WifiOff strokeWidth={2.25} />
      Reconnecting…
    </div>
  );
}
export function LobbyCodeDisplay({
  code,
  qr,
  url,
}: {
  code: string;
  qr?: ReactNode;
  url?: string;
}) {
  return (
    <div className="cp-lobby-code-wrap">
      <div className="cp-lobby-code" aria-label={`Lobby code ${code}`}>
        {[...code].map((char, i) => (
          <span key={i}>{char}</span>
        ))}
      </div>
      {qr}
      {url && (
        <p className="cp-join-hint">
          Scan or go to <strong>{url}</strong>
        </p>
      )}
    </div>
  );
}
export function GameClock({
  clock,
  serverNow,
  size = "sm",
}: {
  clock: GameClockView;
  serverNow: () => number;
  size?: "sm" | "lg";
}) {
  return (
    <div className={`cp-game-clock cp-game-clock-${size}`}>
      <span>{clock.done ? "Time's up" : "Game time"}</span>
      {!clock.done && <Timer timer={clock.timer} serverNow={serverNow} />}
    </div>
  );
}
export function Timer({
  timer,
  serverNow,
  ring = false,
  className = "",
}: {
  timer: TimerState;
  serverNow: () => number;
  ring?: boolean;
  className?: string;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 200);
    return () => clearInterval(id);
  }, []);
  const display = timerDisplay(timer, serverNow());
  const milestone =
    [30, 10, 0].includes(display.seconds) && !display.idle ? `${display.seconds} seconds left` : "";
  return (
    <div
      className={`cp-timer cp-timer-${display.tone} ${ring ? "cp-timer-ring" : ""} ${display.seconds <= 5 && !display.paused && !display.idle ? "cp-timer-urgent" : ""} ${className}`}
      role="timer"
      aria-label={`${display.paused ? "Paused, " : ""}${display.label}`}
    >
      {ring && (
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <circle className="cp-ring-track" cx="100" cy="100" r="88" strokeWidth="12" fill="none" />
          <circle
            cx="100"
            cy="100"
            r="88"
            strokeWidth="12"
            stroke="currentColor"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={553}
            strokeDashoffset={553 * (1 - display.progress)}
            transform="rotate(-90 100 100)"
          />
        </svg>
      )}
      <span className="cp-timer-digits">
        {display.paused && <Pause size={20} strokeWidth={2.25} />}
        {display.label}
      </span>
      {!ring && (
        <span className="cp-timer-bar">
          <span style={{ width: `${display.progress * 100}%` }} />
        </span>
      )}
      <span className="cp-sr-only" aria-live="polite">
        {milestone}
      </span>
    </div>
  );
}
export function TurnIndicator({ current, next }: { current?: string; next?: string }) {
  return (
    <div className="cp-turn-indicator">
      <p>
        Now: <strong className="cp-accent cp-person">{current ?? "—"}</strong>
      </p>
      <p className="cp-muted">
        Next: <span className="cp-person">{next ?? "—"}</span>
      </p>
    </div>
  );
}
export function YourTurn({
  timer,
  serverNow,
  onDone,
  disabled,
  children,
}: {
  timer: TimerState;
  serverNow: () => number;
  onDone: () => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  useEffect(() => {
    navigator.vibrate?.(200);
  }, []);
  return (
    <section className="cp-your-turn">
      <h1>
        YOUR
        <br />
        TURN!
      </h1>
      <Timer timer={timer} serverNow={serverNow} ring />
      {children}
      <div className="cp-sticky-action">
        <Button variant="accent" size="lg" onClick={onDone} disabled={disabled}>
          <Mic strokeWidth={2.25} />
          I'm done
        </Button>
      </div>
    </section>
  );
}
export function GroupCard({
  group,
  players,
  game,
  serverNow,
  children,
  renderMember,
}: {
  group: GroupSummary;
  players: PlayerSummary[];
  game?: GroupGameView;
  serverNow: () => number;
  children?: ReactNode;
  renderMember?: (player: PlayerSummary | undefined, id: string) => ReactNode;
}) {
  const speaking = game?.phase === "RUNNING";
  return (
    <section
      className={`cp-group-card ${speaking ? "cp-group-speaking" : ""}`}
      style={teamVars(group.index)}
    >
      <header>
        <TeamShape teamIndex={group.index} />
        <h2>{teamName(group.index)}</h2>
        <span>{group.playerIds.length}</span>
        {game && <Timer timer={game.timer} serverNow={serverNow} />}
      </header>
      <div className="cp-group-body">
        <ul className="cp-members">
          {group.playerIds.map((id) => (
            <li
              className={`cp-person ${game?.eliminated.includes(id) ? "cp-member-out" : ""} ${speaking && game.currentSpeakerId === id ? "cp-speaker" : ""}`}
              key={id}
            >
              {speaking && game.currentSpeakerId === id && <Mic strokeWidth={2.25} size={24} />}
              {renderMember
                ? renderMember(
                    players.find((player) => player.id === id),
                    id,
                  )
                : (players.find((player) => player.id === id)?.name ?? "Player")}
            </li>
          ))}
        </ul>
        {children}
      </div>
      {game && (
        <footer>
          <span>Round {game.round}</span>
          <span>
            Next:{" "}
            <strong className="cp-person">
              {players.find((p) => p.id === game.nextSpeakerId)?.name ?? "—"}
            </strong>
          </span>
        </footer>
      )}
    </section>
  );
}
function useHold() {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const hide = () => setHeld(false);
    window.addEventListener("blur", hide);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("blur", hide);
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);
  return {
    held,
    props: {
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setHeld(true);
      },
      onPointerUp: () => setHeld(false),
      onPointerCancel: () => setHeld(false),
      onLostPointerCapture: () => setHeld(false),
      onBlur: () => setHeld(false),
      onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          setHeld(true);
        }
      },
      onKeyUp: () => setHeld(false),
      onContextMenu: (e: React.MouseEvent<HTMLElement>) => e.preventDefault(),
    },
  };
}
export function SecretCard({ children }: { children: ReactNode }) {
  const { held, props } = useHold();
  return (
    <button
      type="button"
      {...props}
      className={`cp-secret-card ${held ? "cp-secret-open" : ""}`}
      aria-label="Hold to see your card"
      aria-pressed={held}
    >
      <span className="cp-secret-inner">
        {held ? (
          <span className="cp-secret-content">{children}</span>
        ) : (
          <>
            <Eye size={44} strokeWidth={2.25} />
            <strong>Hold to see your card</strong>
            <span>Let go to hide it</span>
          </>
        )}
      </span>
    </button>
  );
}
export const FlipCard = SecretCard;
export function HostSecretRow({
  teamIndex,
  children,
  revealed = false,
}: {
  teamIndex: number;
  children: ReactNode;
  revealed?: boolean;
}) {
  const { held, props } = useHold();
  return (
    <div className="cp-host-secret">
      <TeamBadge teamIndex={teamIndex} />
      <button
        type="button"
        {...props}
        className="cp-hold"
        aria-label="Hold to show group details"
        aria-pressed={held || revealed}
      >
        <EyeOff strokeWidth={2.25} />
        <span className={held || revealed ? "" : "cp-secret-blur"}>
          {held || revealed ? children : <span>Hold to see group details</span>}
        </span>
      </button>
    </div>
  );
}
export function PlayerList({
  players,
  groups,
  onMore,
}: {
  players: PlayerSummary[];
  groups: GroupSummary[];
  onMore: (player: PlayerSummary) => void;
}) {
  return (
    <ul className="cp-player-list">
      {players.map((player) => {
        const group = groups.find((g) => g.id === player.groupId);
        const status = player.connected ? "online" : player.away ? "away" : "offline";
        return (
          <li key={player.id}>
            <span className={`cp-presence cp-presence-${status}`} aria-label={status} />
            <div className="cp-player-name">
              <strong className="cp-person">{player.name}</strong>
              <small>{status}</small>
            </div>
            {group && <TeamBadge teamIndex={group.index} />}
            <Button
              variant="ghost"
              aria-label={`Actions for ${player.name}`}
              onClick={() => onMore(player)}
            >
              <MoreHorizontal strokeWidth={2.25} />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
export function TimerWaiting() {
  return (
    <Waiting message="Get ready to speak">
      <Clock3 size={32} strokeWidth={2.25} />
    </Waiting>
  );
}
