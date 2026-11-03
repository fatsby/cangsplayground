import type { ReactNode } from "react";
import type {
  CaseBriefing,
  FoundPlaceKind,
  IntroDescriptor,
  RoomShape,
  SceneId,
  SuspectBadge,
  VictimLook,
} from "../types.js";
import { Stage } from "./stage.js";

/** Seconds on the intro timeline. The whole intro is 13 s; these are named, never scattered. */
export const BEATS = {
  windowsStart: 0.6,
  windowStep: 1,
  victimEnters: 3.4,
  attackerAppears: 6,
  attackerGone: 7.2,
  victimFalls: 6.9,
  found: 8,
  suspectsStart: 10,
  suspectStep: 0.3,
  title: 11.4,
  question: 12,
} as const;

/** What every scene draws from: the public briefing, the public descriptor and the time. */
export type SceneProps = {
  briefing: CaseBriefing;
  intro: IntroDescriptor;
  elapsedMs: number | null;
  reduced: boolean;
  decorSeed: number;
};

type Palette = {
  skyTop: string;
  skyBottom: string;
  wall: string;
  roof: string;
  light: string;
  ground: string;
  ink: string;
};

/** Colour and building silhouette per scene: presentation only, no names. */
const PALETTES: Record<SceneId, Palette> = {
  "manor-night": {
    skyTop: "#0b1030",
    skyBottom: "#27306a",
    wall: "#2d2640",
    roof: "#17122a",
    light: "#ffd36e",
    ground: "#1b2a24",
    ink: "#f4efe6",
  },
  "hotel-night": {
    skyTop: "#04222b",
    skyBottom: "#14505e",
    wall: "#203845",
    roof: "#102632",
    light: "#9ef0ff",
    ground: "#1a2b33",
    ink: "#eaf7fa",
  },
};

const COAT: Record<VictimLook["coat"], string> = {
  indigo: "#4153b5",
  green: "#2f8f5b",
  burgundy: "#8e2a45",
  charcoal: "#3b3f48",
};
const HAIR: Record<VictimLook["hair"], string> = {
  white: "#f2f2f2",
  grey: "#a7a7ad",
  dark: "#2a2020",
  bald: "transparent",
};

/** Small seeded generator (mulberry32) so decoration is the same for every device and render. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n: number): number => Math.round(n * 10) / 10;

function Sky({ palette, seed, scene }: { palette: Palette; seed: number; scene: SceneId }) {
  const next = seeded(seed);
  const stars = Array.from({ length: 28 }, () => ({
    x: r1(next() * 1280),
    y: r1(next() * 220),
    r: r1(1 + next() * 1.6),
  }));
  const rain = Array.from({ length: 46 }, () => ({
    x: r1(next() * 1280),
    y: r1(next() * 560),
    len: r1(18 + next() * 22),
  }));
  return (
    <g data-part="sky">
      <defs>
        <linearGradient id={`mm-sky-${scene}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={palette.skyTop} />
          <stop offset="1" stopColor={palette.skyBottom} />
        </linearGradient>
      </defs>
      <rect width="1280" height="720" fill={`url(#mm-sky-${scene})`} />
      {stars.map((s, i) => (
        <circle key={`s${i}`} cx={s.x} cy={s.y} r={s.r} fill={palette.ink} opacity="0.7" />
      ))}
      {rain.map((d, i) => (
        <line
          key={`r${i}`}
          x1={d.x}
          y1={d.y}
          x2={d.x - 6}
          y2={d.y + d.len}
          stroke={palette.ink}
          strokeOpacity="0.22"
        />
      ))}
    </g>
  );
}

function Building({ palette, scene }: { palette: Palette; scene: SceneId }) {
  return scene === "manor-night" ? (
    <g data-part="building">
      <polygon points="120,140 640,40 1160,140" fill={palette.roof} />
      <rect x="120" y="140" width="1040" height="330" fill={palette.wall} />
      <rect x="560" y="10" width="160" height="130" fill={palette.roof} />
    </g>
  ) : (
    <g data-part="building">
      <rect x="100" y="60" width="1080" height="410" fill={palette.wall} />
      <rect x="100" y="40" width="1080" height="28" fill={palette.roof} />
      <rect x="520" y="12" width="240" height="28" rx="6" fill={palette.light} opacity="0.35" />
    </g>
  );
}

function RoomWindow({
  shape,
  x,
  label,
  palette,
  lit,
}: {
  shape: RoomShape;
  x: number;
  label: string;
  palette: Palette;
  lit: boolean;
}) {
  const fill = lit ? palette.light : "#0c0c14";
  const y = 170;
  const body = {
    arched: (
      <path d={`M${x} ${y + 110} V${y + 40} A55 55 0 0 1 ${x + 110} ${y + 40} V${y + 110} Z`} />
    ),
    square: <rect x={x} y={y} width="110" height="110" />,
    low: <rect x={x - 10} y={y + 40} width="130" height="70" />,
    glasshouse: (
      <polygon points={`${x},${y + 110} ${x + 20},${y} ${x + 90},${y} ${x + 110},${y + 110}`} />
    ),
    round: <circle cx={x + 55} cy={y + 55} r="55" />,
  }[shape];
  return (
    <g data-part="window" data-shape={shape} fill={fill} stroke={palette.roof} strokeWidth="6">
      {body}
      <text
        x={x + 55}
        y={y + 150}
        textAnchor="middle"
        fill={palette.ink}
        fontSize="22"
        stroke="none"
      >
        {label}
      </text>
    </g>
  );
}

function FoundPlace({ kind, palette }: { kind: FoundPlaceKind; palette: Palette }) {
  return (
    <g data-part="ground" data-place={kind}>
      <rect y="470" width="1280" height="250" fill={palette.ground} />
      {kind === "garden-path" && (
        <path
          d="M0 640 C300 560 600 700 1280 600"
          stroke="#6c6a60"
          strokeWidth="46"
          fill="none"
          strokeDasharray="38 10"
        />
      )}
      {kind === "service-corridor" && (
        <g stroke="#566b75" strokeWidth="4">
          <line x1="200" y1="470" x2="60" y2="720" />
          <line x1="1080" y1="470" x2="1220" y2="720" />
          <line x1="640" y1="470" x2="640" y2="720" strokeDasharray="14 12" />
        </g>
      )}
      {kind === "courtyard" && (
        <g stroke="#59605c" strokeWidth="3">
          {[520, 580, 640, 700].map((y) => (
            <line key={y} x1="120" y1={y} x2="1160" y2={y} />
          ))}
        </g>
      )}
    </g>
  );
}

function Face({ look, x, y, fallen }: { look: VictimLook; x: number; y: number; fallen: boolean }) {
  return (
    <g
      transform={fallen ? `translate(${x} ${y}) rotate(-90)` : `translate(${x} ${y})`}
      data-part="victim"
      data-fallen={fallen}
    >
      <rect x="-26" y="30" width="52" height="86" rx="12" fill={COAT[look.coat]} />
      <circle cx="0" cy="12" r="26" fill="#f2c9a0" />
      <path d="M-26 8 A26 24 0 0 1 26 8 Z" fill={HAIR[look.hair]} />
      {look.accessory === "bowtie" && (
        <path d="M-14 34 L0 40 L-14 46 Z M14 34 L0 40 L14 46 Z" fill="#fff" />
      )}
      {look.accessory === "scarf" && <rect x="-26" y="30" width="52" height="10" fill="#f0b429" />}
      {look.accessory === "glasses" && (
        <g fill="none" stroke="#111" strokeWidth="3">
          <circle cx="-10" cy="12" r="8" />
          <circle cx="10" cy="12" r="8" />
        </g>
      )}
      {look.accessory === "hat" && (
        <path d="M-30 -8 H30 M-18 -8 V-30 H18 V-8" stroke="#222" strokeWidth="8" fill="#222" />
      )}
      {fallen ? (
        <g stroke="#111" strokeWidth="3">
          <path d="M-14 6 l8 8 M-6 6 l-8 8 M6 6 l8 8 M14 6 l-8 8" />
        </g>
      ) : (
        <g fill="#111">
          <circle cx="-9" cy="12" r="3" />
          <circle cx="9" cy="12" r="3" />
        </g>
      )}
    </g>
  );
}

function Badge({ badge }: { badge: SuspectBadge }) {
  switch (badge) {
    case "stethoscope":
      return (
        <path d="M-12 38 q0 24 12 24 q12 0 12 -24" fill="none" stroke="#e8f4f8" strokeWidth="4" />
      );
    case "bowtie":
      return <path d="M-14 36 L0 42 L-14 48 Z M14 36 L0 42 L14 48 Z" fill="#fff" />;
    case "long-hair":
      return (
        <path d="M-30 6 V60 M30 6 V60" stroke="#e0b27a" strokeWidth="10" strokeLinecap="round" />
      );
    case "hat":
      return (
        <path
          d="M-34 -6 H34 M-20 -6 V-26 H20 V-6"
          stroke="#d9a441"
          strokeWidth="8"
          fill="#d9a441"
        />
      );
    case "apron":
      return <rect x="-18" y="46" width="36" height="52" rx="6" fill="#fff" opacity="0.9" />;
    case "glasses":
      return (
        <g fill="none" stroke="#fff" strokeWidth="3">
          <circle cx="-10" cy="10" r="8" />
          <circle cx="10" cy="10" r="8" />
        </g>
      );
  }
}

/**
 * The whole intro picture for a scene. Everything that varies comes from the props: the labels
 * from the public briefing, the looks, shapes and badges from the descriptor, the stars and rain
 * from the case number. It never draws a weapon, the culprit or the crime room: the attacker is
 * an anonymous silhouette and the only place shown for the body is where it was found.
 */
function SceneArt({ briefing, intro, elapsedMs, reduced, decorSeed }: SceneProps) {
  const palette = PALETTES[intro.sceneId];
  const at = reduced ? Number.POSITIVE_INFINITY : (elapsedMs ?? 0) / 1000;
  const props = { elapsed: elapsedMs, reduced } as const;
  const fallen = at >= BEATS.victimFalls;
  const attackerVisible = !reduced && at < BEATS.attackerGone;
  const lightsOut = !reduced && at >= BEATS.attackerAppears - 0.4 && at < BEATS.attackerGone + 1.2;
  return (
    <svg
      className="mm-intro-svg"
      viewBox="0 0 1280 720"
      role="img"
      aria-label={briefing.title}
      preserveAspectRatio="xMidYMid slice"
    >
      <Sky palette={palette} seed={decorSeed} scene={intro.sceneId} />
      <Building palette={palette} scene={intro.sceneId} />
      <FoundPlace kind={intro.foundPlace} palette={palette} />
      {briefing.rooms.map((room, i) => (
        <Stage
          key={room.id}
          as="g"
          part="window-stage"
          d={BEATS.windowsStart + i * BEATS.windowStep}
          {...props}
        >
          <RoomWindow
            shape={intro.roomShapes[room.id] ?? "square"}
            x={190 + i * 250}
            label={room.name}
            palette={palette}
            lit
          />
        </Stage>
      ))}
      <Stage as="g" part="victim-stage" d={BEATS.victimEnters} className="mm-walk" {...props}>
        <Face
          look={intro.victimLook}
          x={fallen ? 700 : 640}
          y={fallen ? 610 : 520}
          fallen={fallen}
        />
        <text x={fallen ? 700 : 640} y="680" textAnchor="middle" fill={palette.ink} fontSize="24">
          {briefing.victim.name}
        </text>
      </Stage>
      <Stage
        as="g"
        part="attacker"
        d={BEATS.attackerAppears}
        className={attackerVisible ? "mm-lunge" : "mm-gone"}
        {...props}
      >
        <path d="M560 520 q40 -90 80 0 v110 h-80 Z" fill="#05050a" />
        <text
          x="600"
          y="500"
          textAnchor="middle"
          fill={palette.light}
          fontSize="52"
          fontWeight="800"
        >
          ?
        </text>
      </Stage>
      {lightsOut && (
        <rect width="1280" height="720" fill="#000" opacity="0.55" data-part="blackout" />
      )}
      <Stage as="g" part="chalk" d={BEATS.found} {...props}>
        <ellipse
          cx="700"
          cy="620"
          rx="110"
          ry="40"
          fill="none"
          stroke={palette.ink}
          strokeWidth="4"
          strokeDasharray="10 8"
        />
        <path
          d="M520 560 L880 690 M520 690 L880 560"
          stroke="#f2c230"
          strokeWidth="8"
          strokeDasharray="22 14"
        />
      </Stage>
      <Stage as="g" part="time" d={BEATS.found + 0.2} {...props}>
        <text x="1120" y="690" textAnchor="end" fill={palette.light} fontSize="30" fontWeight="700">
          {intro.discoveredAt}
        </text>
      </Stage>
      {briefing.suspects.map((suspect, i) => (
        <Stage
          key={suspect.id}
          as="g"
          part="suspect"
          d={BEATS.suspectsStart + i * BEATS.suspectStep}
          {...props}
        >
          <g transform={`translate(${210 + i * 285} 560)`}>
            <rect x="-30" y="30" width="60" height="90" rx="14" fill="#0a0a12" />
            <circle cx="0" cy="8" r="28" fill="#0a0a12" />
            <Badge badge={intro.suspectBadges[suspect.id] ?? "glasses"} />
            <text
              x="0"
              y="-18"
              textAnchor="middle"
              fill={palette.light}
              fontSize="40"
              fontWeight="800"
            >
              ?
            </text>
            <text x="0" y="150" textAnchor="middle" fill={palette.ink} fontSize="22">
              {suspect.name}
            </text>
          </g>
        </Stage>
      ))}
    </svg>
  );
}

/** One scene component per scene id. Adding a scene never touches the case logic. */
export const SCENES: Record<SceneId, (props: SceneProps) => ReactNode> = {
  "manor-night": (props) => <SceneArt {...props} />,
  "hotel-night": (props) => <SceneArt {...props} />,
};
