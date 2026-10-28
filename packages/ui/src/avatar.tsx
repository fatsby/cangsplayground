import { Component, lazy, Suspense, type ReactNode } from "react";
import type { AvatarConfig, PlayerSummary } from "@cangsplayground/core";

const AvatarImage = lazy(() => import("./avatar-image"));

function AvatarPlaceholder({ label }: { label: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width="100%"
      height="100%"
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      fill="none"
      stroke="#71472d"
      strokeWidth="2"
      aria-busy={false}
    >
      <circle cx="17" cy="19" r="1.5" fill="#71472d" />
      <circle cx="31" cy="19" r="1.5" fill="#71472d" />
      <path d="M14 28q10 12 20 0" strokeLinecap="round" />
    </svg>
  );
}

/** Avatar downloads are optional; a failed chunk must never unmount the game. */
class AvatarBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function PlayerAvatar({
  playerId,
  avatar,
  size = 32,
  className = "",
  label = "",
}: {
  playerId: string;
  avatar?: AvatarConfig;
  size?: number;
  className?: string;
  label?: string;
}) {
  const config = JSON.stringify(avatar ?? { seed: playerId });
  return (
    <span
      className={`cp-avatar ${className}`}
      data-player-id={playerId}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        backgroundColor: `#${avatar?.backgroundColor ?? "ffe3ea"}`,
      }}
    >
      <AvatarBoundary fallback={<AvatarPlaceholder label={label} />}>
        <Suspense fallback={<AvatarPlaceholder label={label} />}>
          <AvatarImage config={config} label={label} />
        </Suspense>
      </AvatarBoundary>
    </span>
  );
}

export function PlayerIdentity({
  player,
  playerId,
  size = 32,
  className = "",
  children,
}: {
  player?: PlayerSummary;
  playerId?: string;
  size?: number;
  className?: string;
  children?: ReactNode;
}) {
  const id = player?.id ?? playerId;
  return (
    <span className={`cp-player-identity ${className}`}>
      {id && <PlayerAvatar playerId={id} avatar={player?.avatar} size={size} />}
      <span className="cp-person cp-identity-name">{children ?? player?.name ?? "Player"}</span>
    </span>
  );
}
