import { memo, type CSSProperties, type ReactNode } from "react";
import type {
  CaseBriefing,
  FoundPlaceKind,
  IntroDescriptor,
  RoomShape,
  SceneId,
  SuspectBadge,
  VictimLook,
} from "../types.js";

/**
 * Seconds on the 13-second intro timeline (mockup D1b). The CSS in `murder-mystery.css` uses the
 * same numbers as `--d` delays; the ones that vary per element are passed from here.
 */
export const BEATS = {
  windowsStart: 0.8,
  windowStep: 0.4,
  labelsStart: 0.9,
  labelLongest: 2.4,
  settingCaption: 0.4,
  victimCard: 3,
  blackout: 5,
  victimFalls: 5.95,
  found: 7.2,
  suspectsStart: 9.6,
  suspectStep: 0.25,
  title: 11,
} as const;

/** What every scene draws from: the public briefing, the public descriptor and the case number. */
export type SceneProps = {
  briefing: CaseBriefing;
  intro: IntroDescriptor;
  decorSeed: number;
  /** How many suspects are already on stage; changes four times, so the art re-renders rarely. */
  suspectsShown: number;
};

/** A delay (and optionally other custom properties) for one timed element. */
const at = (d: number, extra: Record<string, string | number> = {}): CSSProperties =>
  ({
    ["--d" as string]: d,
    ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [`--${k}`, v])),
  }) as CSSProperties;

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

/**
 * Display form of an entity name on the stage: no leading article, first letter capitalised
 * ("the wine cellar" becomes "Wine cellar").
 */
export function stageLabel(name: string): string {
  const bare = name.replace(/^the\s+/i, "");
  return bare.charAt(0).toUpperCase() + bare.slice(1);
}

const FONT_MONO = "JetBrains Mono, ui-monospace, monospace";
const FONT_DISPLAY = "Unbounded Variable, Unbounded, system-ui, sans-serif";
const FRAME = "#3a3f87";
const WARM = "#ffb547";
const WARM_SOFT = "#ffd08a";

/* ------------------------------------------------------------------------------------------ */
/* Sky                                                                                         */
/* ------------------------------------------------------------------------------------------ */

function Defs() {
  return (
    <defs>
      <linearGradient id="mmcnSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#04051a" />
        <stop offset=".55" stopColor="#14123f" />
        <stop offset="1" stopColor="#2d2060" />
      </linearGradient>
      <radialGradient id="mmcnMoon">
        <stop offset="0" stopColor="#f4f3ff" stopOpacity=".45" />
        <stop offset="1" stopColor="#f4f3ff" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="mmcnGround" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#0f2236" />
        <stop offset="1" stopColor="#08111f" />
      </linearGradient>
      <linearGradient id="mmcnPath" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#4a4670" />
        <stop offset="1" stopColor="#2a2850" />
      </linearGradient>
      <linearGradient id="mmcnStone" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2c2a55" />
        <stop offset="1" stopColor="#15142f" />
      </linearGradient>
      <linearGradient id="mmcnAsphalt" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#1a1d3a" />
        <stop offset="1" stopColor="#0a0b1c" />
      </linearGradient>
      <radialGradient id="mmcnVig" cx=".5" cy=".58" r=".3">
        <stop offset="0" stopColor="#02030c" stopOpacity="0" />
        <stop offset=".55" stopColor="#02030c" stopOpacity=".55" />
        <stop offset="1" stopColor="#02030c" stopOpacity=".96" />
      </radialGradient>
      <linearGradient id="mmcnFloor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#05061a" stopOpacity="0" />
        <stop offset="1" stopColor="#05061a" stopOpacity=".94" />
      </linearGradient>
      <filter id="mmcnBlur" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="9" />
      </filter>
    </defs>
  );
}

function Sky({ seed, moonX }: { seed: number; moonX: number }) {
  const next = seeded(seed);
  const stars = Array.from({ length: 44 }, () => ({
    x: r1(next() * 1440),
    y: r1(next() * 330),
    r: r1(0.8 + next() * 1.5),
    d: r1(-next() * 3),
  }));
  return (
    <g data-part="sky">
      <rect width="1440" height="810" fill="url(#mmcnSky)" />
      <g className="cn-stars">
        {stars.map((s, i) => (
          <circle key={i} className="t" cx={s.x} cy={s.y} r={s.r} fill="#fff" style={at(s.d)} />
        ))}
      </g>
      <circle cx={moonX} cy="130" r="130" fill="url(#mmcnMoon)" />
      <circle cx={moonX} cy="130" r="46" fill="#f4f3ff" />
      <circle cx={moonX - 14} cy="120" r="9" fill="#cfcdf0" />
      <circle cx={moonX + 16} cy="142" r="6" fill="#cfcdf0" />
      <circle cx={moonX + 6} cy="108" r="4" fill="#cfcdf0" />
      <ellipse cx={moonX - 100} cy="170" rx="160" ry="22" fill="#14123f" opacity=".8" />
      <ellipse
        cx={moonX > 720 ? 300 : 1140}
        cy="110"
        rx="190"
        ry="20"
        fill="#14123f"
        opacity=".7"
      />
    </g>
  );
}

/** Screen-space rain. Each streak loops on its own offset, so the storm never looks in step. */
function Rain({ seed }: { seed: number }) {
  const next = seeded(seed ^ 0x5f3759df);
  const drops = Array.from({ length: 80 }, () => ({
    x: r1(next() * 1500),
    y: r1(next() * 810 - 60),
    d: r1(-next() * 0.6),
  }));
  return (
    <g className="cn-rain" data-part="rain">
      {drops.map((p, i) => (
        <line
          key={i}
          className="t"
          x1={p.x}
          y1={p.y}
          x2={p.x - 10}
          y2={p.y + 34}
          stroke="rgba(200,210,255,.45)"
          strokeWidth="1.5"
          style={at(p.d)}
        />
      ))}
    </g>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Windows: each room shape has one place on each building                                     */
/* ------------------------------------------------------------------------------------------ */

type Anchor = { label: [number, number]; dark: ReactNode; lit: ReactNode };

/** Glow + lit pane of a window; drawn above its dark pane when the room lights up. */
const glow = (shape: ReactNode, colour: string, opacity = 0.7) => (
  <g fill={colour} filter="url(#mmcnBlur)" opacity={opacity}>
    {shape}
  </g>
);

function archedAt(x: number, y: number, w: number, h: number): Anchor {
  const r = w / 2;
  const d = `M${x} ${y + h} V${y + r} a${r} ${r} 0 0 1 ${w} 0 V${y + h}Z`;
  return {
    label: [x + r, y - 14],
    dark: <path d={d} fill="#0f1130" stroke={FRAME} strokeWidth="4" />,
    lit: (
      <>
        {glow(<path d={d} />, WARM)}
        <path d={d} fill={WARM} stroke={FRAME} strokeWidth="4" />
        <path
          d={`M${x + 4} ${y + h * 0.38} H${x + w - 4} M${x + 4} ${y + h * 0.65} H${x + w - 4} M${x + 4} ${y + h * 0.85} H${x + w - 4}`}
          stroke="#7a3c00"
          strokeWidth="3"
          opacity=".6"
        />
      </>
    ),
  };
}

function squareAt(x: number, y: number, w: number, h: number, steam: boolean): Anchor {
  const pane = <rect x={x} y={y} width={w} height={h} rx="6" />;
  return {
    label: [x + w / 2, y - (steam ? 20 : 14)],
    dark: (
      <rect x={x} y={y} width={w} height={h} rx="6" fill="#0f1130" stroke={FRAME} strokeWidth="4" />
    ),
    lit: (
      <>
        {glow(pane, WARM_SOFT)}
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx="6"
          fill={WARM_SOFT}
          stroke={FRAME}
          strokeWidth="4"
        />
        <path
          d={`M${x + w / 2} ${y} V${y + h} M${x} ${y + h / 2} H${x + w}`}
          stroke={FRAME}
          strokeWidth="4"
        />
        {steam && (
          <path
            d={`M${x + 24} ${y - 10} q-8 -14 0 -26 M${x + 52} ${y - 10} q-8 -14 0 -26`}
            fill="none"
            stroke="#cfcdf0"
            strokeWidth="3"
            opacity=".5"
          />
        )}
      </>
    ),
  };
}

function lowAt(x: number, y: number): Anchor {
  const pane = <rect x={x} y={y} width="64" height="26" rx="4" />;
  return {
    label: [x + 32, y - 10],
    dark: (
      <rect
        x={x}
        y={y}
        width="64"
        height="26"
        rx="4"
        fill="#0f1130"
        stroke={FRAME}
        strokeWidth="4"
      />
    ),
    lit: (
      <>
        {glow(pane, "#b79bff", 0.8)}
        <rect
          x={x}
          y={y}
          width="64"
          height="26"
          rx="4"
          fill="#b79bff"
          stroke={FRAME}
          strokeWidth="4"
        />
        <path d={`M${x + 32} ${y} V${y + 26}`} stroke={FRAME} strokeWidth="3" />
      </>
    ),
  };
}

function glasshouseAt(x: number, y: number, w: number, h: number): Anchor {
  const roofH = Math.round(h / 2);
  const roof = `${x - 10},${y} ${x + w / 2},${y - roofH} ${x + w + 10},${y}`;
  const mullions = [1, 2, 3].map((k) => x + (w * k) / 4);
  const frame = (fill: string) => (
    <>
      <polygon points={roof} fill={fill} stroke={FRAME} strokeWidth="4" />
      <rect x={x} y={y} width={w} height={h} fill={fill} stroke={FRAME} strokeWidth="4" />
    </>
  );
  return {
    label: [x + w / 2, y - roofH - 12],
    dark: frame("#0b1c2a"),
    lit: (
      <>
        <g fill="#00e5c7" opacity=".5" filter="url(#mmcnBlur)">
          <polygon points={roof} />
          <rect x={x} y={y} width={w} height={h} />
        </g>
        {frame("#0d3a44")}
        <rect x={x + 6} y={y + 6} width={w - 12} height={h - 12} fill="#00e5c7" opacity=".55" />
        <path
          d={`${mullions.map((m) => `M${m} ${y} V${y + h}`).join(" ")} M${x} ${y + h / 2} H${x + w}`}
          stroke="#0d0f24"
          strokeWidth="4"
        />
      </>
    ),
  };
}

function roundAt(cx: number, cy: number, r: number, clock: boolean): Anchor {
  return {
    label: [cx, cy - r - 14],
    dark: clock ? (
      <g data-part="clock">
        <circle cx={cx} cy={cy} r={r} fill="#f4f3ff" stroke="#0a0c25" strokeWidth="4" />
        <path
          d={`M${cx} ${cy} L${cx + r - 2} ${cy} M${cx} ${cy} L${cx - r + 5} ${cy - 3}`}
          stroke="#0a0c25"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </g>
    ) : (
      <circle cx={cx} cy={cy} r={r} fill="#0f1130" stroke={FRAME} strokeWidth="4" />
    ),
    lit: (
      <>
        {glow(<circle cx={cx} cy={cy} r={r} />, "#ff9ec0", 0.75)}
        <circle cx={cx} cy={cy} r={r} fill="#ffc2d6" stroke={FRAME} strokeWidth="4" />
        <path
          d={`M${cx - r} ${cy} H${cx + r} M${cx} ${cy - r} V${cy + r}`}
          stroke={FRAME}
          strokeWidth="4"
        />
        <circle cx={cx} cy={cy} r={r * 0.45} fill="none" stroke={FRAME} strokeWidth="3" />
      </>
    ),
  };
}

/** Where each room shape sits on each building. Shapes in one case are always distinct. */
function anchorsFor(scene: SceneId, used: Set<RoomShape>): Record<RoomShape, Anchor> {
  if (scene === "manor-night") {
    return {
      arched: archedAt(432, 406, 68, 114),
      square: squareAt(560, 440, 84, 64, true),
      low: lowAt(820, 566),
      glasshouse: glasshouseAt(950, 470, 230, 122),
      round: roundAt(318, 262, 30, !used.has("round")),
    };
  }
  return {
    arched: archedAt(278, 452, 64, 100),
    square: squareAt(862, 306, 96, 64, false),
    low: lowAt(1100, 566),
    glasshouse: glasshouseAt(810, 152, 180, 46),
    round: roundAt(612, 330, 42, false),
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Buildings                                                                                   */
/* ------------------------------------------------------------------------------------------ */

function Manor() {
  return (
    <g data-part="building" data-building="manor">
      <rect x="260" y="330" width="920" height="262" fill="#151837" />
      <polygon points="226,340 720,186 1214,340" fill="#0a0c25" />
      <rect x="560" y="200" width="34" height="76" fill="#0f1130" />
      <rect x="980" y="236" width="34" height="62" fill="#0f1130" />
      <rect x="262" y="196" width="112" height="396" fill="#1b1f48" />
      <polygon points="248,200 318,104 388,200" fill="#0a0c25" />
      <path d="M690 592 V522 a30 30 0 0 1 60 0 V592Z" fill="#07081d" />
      <circle cx="720" cy="476" r="7" fill={WARM_SOFT} />
      <line x1="260" y1="440" x2="1180" y2="440" stroke="#0f1130" strokeWidth="4" />
    </g>
  );
}

/** Small decorative hotel windows; the rooms' anchors are kept clear. */
function hotelGrid(seed: number) {
  const next = seeded(seed ^ 0x2545f491);
  const keepClear = [
    [560, 250, 664, 382],
    [850, 262, 970, 380],
  ];
  const cells: { x: number; y: number; lit: boolean }[] = [];
  for (let y = 240; y <= 420; y += 60) {
    for (let x = 418; x <= 1000; x += 64) {
      const clash = keepClear.some(
        ([a, b, c, d]) => x + 30 > a! && x < c! && y + 36 > b! && y < d!,
      );
      if (!clash) cells.push({ x, y, lit: next() < 0.22 });
    }
  }
  return cells;
}

function Hotel({ seed }: { seed: number }) {
  return (
    <g data-part="building" data-building="hotel">
      {/* wings */}
      <rect x="236" y="330" width="150" height="262" fill="#1b1f48" />
      <rect x="236" y="318" width="150" height="16" fill="#0a0c25" />
      <rect x="1052" y="360" width="150" height="232" fill="#1b1f48" />
      <rect x="1052" y="348" width="150" height="16" fill="#0a0c25" />
      {/* tower */}
      <rect x="386" y="210" width="666" height="382" fill="#151837" />
      <rect x="374" y="198" width="690" height="16" fill="#0a0c25" />
      {/* roof: water tank and antenna */}
      <rect x="456" y="146" width="64" height="52" rx="6" fill="#0f1130" />
      <path d="M462 198 L470 172 M514 198 L506 172" stroke="#0a0c25" strokeWidth="5" />
      <path d="M1010 198 V124 M996 144 H1024" stroke="#0f1130" strokeWidth="5" />
      <circle cx="1010" cy="122" r="4" fill="#ff4d7a" />
      {/* floor lines */}
      {[288, 348, 408, 468].map((y) => (
        <line key={y} x1="386" y1={y} x2="1052" y2={y} stroke="#0f1130" strokeWidth="3" />
      ))}
      {hotelGrid(seed).map((c, i) => (
        <rect
          key={i}
          x={c.x}
          y={c.y}
          width="30"
          height="36"
          rx="3"
          fill={c.lit ? WARM_SOFT : "#0f1130"}
          opacity={c.lit ? 0.35 : 1}
        />
      ))}
      {/* neon sign: a generic word, never a case name */}
      <g data-part="sign">
        <rect
          x="330"
          y="228"
          width="44"
          height="168"
          rx="8"
          fill="#0a0c25"
          stroke="#ff4d7a"
          strokeWidth="3"
        />
        <g
          fontFamily={FONT_DISPLAY}
          fontWeight="800"
          fontSize="26"
          fill="#ff9ec0"
          textAnchor="middle"
          filter="url(#mmcnBlur)"
          opacity=".9"
        >
          {"HOTEL".split("").map((ch, i) => (
            <text key={i} x="352" y={258 + i * 31}>
              {ch}
            </text>
          ))}
        </g>
        <g
          fontFamily={FONT_DISPLAY}
          fontWeight="800"
          fontSize="26"
          fill="#ffe1ec"
          textAnchor="middle"
        >
          {"HOTEL".split("").map((ch, i) => (
            <text key={i} x="352" y={258 + i * 31}>
              {ch}
            </text>
          ))}
        </g>
      </g>
      {/* entrance with canopy */}
      <path d="M680 592 V500 H760 V592Z" fill="#07081d" />
      <path d="M720 500 V592" stroke="#151837" strokeWidth="3" />
      <polygon points="652,500 788,500 772,476 668,476" fill="#2a2850" />
      <rect x="652" y="498" width="136" height="6" fill={WARM} />
      <circle cx="720" cy="462" r="7" fill={WARM_SOFT} />
    </g>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Foreground: where the body is found                                                         */
/* ------------------------------------------------------------------------------------------ */

function Lamp({ x, d }: { x: number; d: number }) {
  return (
    <g className="cn-lamp t" style={at(d)}>
      <circle cx={x} cy="612" r="70" fill={WARM} opacity=".28" filter="url(#mmcnBlur)" />
      <rect x={x - 3} y="618" width="6" height="64" fill="#0a0c25" />
      <circle cx={x} cy="612" r="9" fill={WARM_SOFT} />
    </g>
  );
}

function GardenPath() {
  return (
    <>
      <path d="M0 586 Q300 560 720 570 T1440 580 V810 H0Z" fill="url(#mmcnGround)" />
      <ellipse cx="170" cy="500" rx="110" ry="96" fill="#07131d" />
      <ellipse cx="1320" cy="486" rx="120" ry="104" fill="#07131d" />
      <rect x="130" y="566" width="430" height="62" rx="31" fill="#0b2a22" />
      <rect x="900" y="566" width="420" height="62" rx="31" fill="#0b2a22" />
      <polygon points="690,586 750,586 1010,810 420,810" fill="url(#mmcnPath)" />
      <path
        d="M690 586 L420 810 M750 586 L1010 810"
        stroke="#fff"
        strokeOpacity=".08"
        strokeWidth="3"
      />
      <path
        d="M700 640 h40 M690 700 h70 M660 770 h110"
        stroke="#fff"
        strokeOpacity=".07"
        strokeWidth="3"
      />
      {/* garden gate posts on either side of the path */}
      <g fill="#0a0c25">
        <rect x="662" y="548" width="12" height="46" rx="3" />
        <rect x="766" y="548" width="12" height="46" rx="3" />
      </g>
      <path d="M668 552 Q720 520 772 552" fill="none" stroke="#0a0c25" strokeWidth="5" />
    </>
  );
}

function Courtyard({ scene }: { scene: SceneId }) {
  const rows = [604, 632, 668, 716, 778];
  const fx = scene === "manor-night" ? 1190 : 250;
  return (
    <>
      <path d="M0 586 Q300 574 720 578 T1440 584 V810 H0Z" fill="url(#mmcnStone)" />
      <g stroke="#fff" strokeOpacity=".07" strokeWidth="3">
        {rows.map((y) => (
          <line key={y} x1="0" y1={y} x2="1440" y2={y} />
        ))}
        {Array.from({ length: 13 }, (_, i) => -720 + i * 240).map((x) => (
          <line key={x} x1={720 + (x - 720) * 0.18} y1="586" x2={x} y2="810" />
        ))}
      </g>
      <ellipse cx={scene === "manor-night" ? 170 : 1300} cy="510" rx="100" ry="84" fill="#07131d" />
      {/* fountain */}
      <g data-part="fountain">
        <ellipse
          cx={fx}
          cy="660"
          rx="120"
          ry="30"
          fill="#0f1130"
          stroke="#4a519a"
          strokeWidth="4"
        />
        <ellipse cx={fx} cy="654" rx="100" ry="20" fill="#14335a" />
        <rect x={fx - 10} y="600" width="20" height="54" fill="#1b1f48" />
        <ellipse cx={fx} cy="602" rx="40" ry="10" fill="#1b1f48" stroke="#4a519a" strokeWidth="3" />
        <path
          d={`M${fx} 596 q-24 -40 -40 4 M${fx} 596 q24 -40 40 4`}
          fill="none"
          stroke="#9fd8ff"
          strokeOpacity=".55"
          strokeWidth="3"
        />
      </g>
    </>
  );
}

function StaffEntrance() {
  return (
    <>
      <rect y="586" width="1440" height="224" fill="url(#mmcnAsphalt)" />
      <path d="M0 586 H1440" stroke="#0a0c25" strokeWidth="6" />
      {/* kerb, drain cover and puddles */}
      <path
        d="M0 604 H1440"
        stroke={WARM}
        strokeOpacity=".3"
        strokeWidth="4"
        strokeDasharray="30 22"
      />
      <ellipse cx="900" cy="760" rx="46" ry="12" fill="#0a0b1c" stroke="#2a2f63" strokeWidth="3" />
      <ellipse cx="520" cy="732" rx="90" ry="12" fill="#9fb4ff" opacity=".12" />
      <ellipse cx="1010" cy="770" rx="120" ry="14" fill="#9fb4ff" opacity=".1" />
      {/* staff door with its sign */}
      <g data-part="staff-door">
        <rect
          x="960"
          y="500"
          width="70"
          height="92"
          fill="#07081d"
          stroke="#2a2f63"
          strokeWidth="4"
        />
        <rect x="966" y="482" width="58" height="14" rx="3" fill="#f4f3ff" />
        <text
          x="995"
          y="493"
          textAnchor="middle"
          fontFamily={FONT_MONO}
          fontWeight="800"
          fontSize="9"
          fill="#0d0f24"
          letterSpacing="1"
        >
          STAFF ONLY
        </text>
      </g>
      {/* bins and crates */}
      <g>
        <rect
          x="150"
          y="600"
          width="88"
          height="96"
          rx="8"
          fill="#1d3a33"
          stroke="#0a0c25"
          strokeWidth="4"
        />
        <rect x="142" y="590" width="104" height="16" rx="6" fill="#24473f" />
        <rect
          x="262"
          y="626"
          width="72"
          height="70"
          fill="#3a2a24"
          stroke="#0a0c25"
          strokeWidth="4"
        />
        <path d="M262 626 L334 696 M334 626 L262 696" stroke="#0a0c25" strokeWidth="3" />
        <rect
          x="1210"
          y="606"
          width="96"
          height="92"
          rx="8"
          fill="#1d3a33"
          stroke="#0a0c25"
          strokeWidth="4"
        />
        <rect x="1202" y="596" width="112" height="16" rx="6" fill="#24473f" />
      </g>
    </>
  );
}

function Foreground({ kind, scene }: { kind: FoundPlaceKind; scene: SceneId }) {
  return (
    <g data-part="ground" data-place={kind}>
      {kind === "garden-path" && <GardenPath />}
      {kind === "courtyard" && <Courtyard scene={scene} />}
      {kind === "service-corridor" && <StaffEntrance />}
      <Lamp x={588} d={0} />
      <Lamp x={932} d={-0.7} />
    </g>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Characters                                                                                  */
/* ------------------------------------------------------------------------------------------ */

const COAT: Record<VictimLook["coat"], [string, string]> = {
  indigo: ["#3b3f8c", "#2a2f63"],
  green: ["#2f6f5b", "#1f4a3d"],
  burgundy: ["#7a2e4a", "#4f1d31"],
  charcoal: ["#454857", "#2a2c36"],
};
const HAIR: Record<VictimLook["hair"], { hair: string | null; trim: string }> = {
  white: { hair: "#f4f3ff", trim: "#cfcdf0" },
  grey: { hair: "#a9a7c8", trim: "#8e8cad" },
  dark: { hair: "#3b2a25", trim: "#2b1f1b" },
  bald: { hair: null, trim: "#8e8cad" },
};

/** The victim: a cartoon figure whose coat, hair and accessory come from the descriptor. */
function Victim({ look }: { look: VictimLook }) {
  const [coat, legs] = COAT[look.coat];
  const { hair, trim } = HAIR[look.hair];
  return (
    <g className="cn-hale t" data-part="victim">
      <g className="cn-bob t">
        <g className="cn-body t">
          <ellipse cx="0" cy="2" rx="30" ry="6" fill="#000" opacity=".4" />
          <g className="cn-leg-l t">
            <rect x="-15" y="-46" width="12" height="42" rx="5" fill={legs} />
            <ellipse cx="-11" cy="-3" rx="12" ry="5" fill="#0d0f24" />
          </g>
          <g className="cn-leg-r t">
            <rect x="3" y="-46" width="12" height="42" rx="5" fill={legs} />
            <ellipse cx="11" cy="-3" rx="12" ry="5" fill="#0d0f24" />
          </g>
          <g className="cn-arm-l t">
            <path d="M-22 -88 L-34 -52 Q-35 -46 -29 -46 Q-24 -46 -22 -52 L-14 -84Z" fill={coat} />
            <circle cx="-30" cy="-44" r="6" fill="#ffd9b8" />
          </g>
          <g className="cn-arm-r t">
            <path d="M22 -88 L34 -52 Q35 -46 29 -46 Q24 -46 22 -52 L14 -84Z" fill={coat} />
            <circle cx="30" cy="-44" r="6" fill="#ffd9b8" />
          </g>
          <path d="M-24 -44 L-21 -90 Q0 -100 21 -90 L24 -44Z" fill={coat} />
          <path d="M-6 -94 L0 -70 L6 -94Z" fill="#f4f3ff" />
          <path d="M0 -70 V-48" stroke={legs} strokeWidth="2" />
          {look.accessory === "bowtie" && (
            <g data-accessory="bowtie">
              <path d="M-10 -97 L0 -92 L-10 -87Z M10 -97 L0 -92 L10 -87Z" fill="#ff4d7a" />
              <circle cx="0" cy="-92" r="3" fill="#ff4d7a" />
            </g>
          )}
          {look.accessory === "scarf" && (
            <g data-accessory="scarf" fill={WARM}>
              <path d="M-15 -98 Q0 -88 15 -98 L16 -90 Q0 -80 -16 -90Z" />
              <path d="M6 -90 L14 -64 L6 -62 L0 -88Z" />
            </g>
          )}
          <circle cx="-17" cy="-110" r="3.5" fill="#f5b896" />
          <circle cx="17" cy="-110" r="3.5" fill="#f5b896" />
          <circle cx="0" cy="-110" r="17" fill="#ffd9b8" />
          {hair ? (
            <path
              d="M-18 -112 Q-20 -133 0 -132 Q20 -133 18 -112 Q12 -121 0 -122 Q-12 -121 -18 -112Z"
              fill={hair}
            />
          ) : (
            <path
              d="M-18 -110 Q-19 -118 -14 -121 M18 -110 Q19 -118 14 -121"
              stroke={trim}
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
          )}
          {look.accessory === "hat" && (
            <g data-accessory="hat" fill="#0d0f24">
              <ellipse cx="0" cy="-123" rx="24" ry="4.5" />
              <path d="M-14 -123 Q-15 -142 0 -142 Q15 -142 14 -123Z" />
              <rect x="-14" y="-128" width="28" height="4" fill="#ff4d7a" />
            </g>
          )}
          <circle cx="0" cy="-106" r="2.6" fill="#f5b896" />
          <path
            d="M-10 -102 Q-5 -107 0 -102 Q5 -107 10 -102 Q5 -98 0 -101 Q-5 -98 -10 -102Z"
            fill={trim}
          />
          <path
            d="M-10 -119 L-3 -117 M10 -119 L3 -117"
            stroke={trim}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <g className="cn-eyes-o t">
            <circle cx="-6" cy="-112" r="2.2" fill="#0d0f24" />
            <circle cx="6" cy="-112" r="2.2" fill="#0d0f24" />
          </g>
          <g className="cn-eyes-x t" stroke="#0d0f24" strokeWidth="2" strokeLinecap="round">
            <path d="M-9 -115 L-3 -109 M-3 -115 L-9 -109 M3 -115 L9 -109 M9 -115 L3 -109" />
          </g>
          {look.accessory === "glasses" && (
            <g data-accessory="glasses" fill="none" stroke="#0d0f24" strokeWidth="1.8">
              <circle cx="-6.5" cy="-112" r="5" />
              <circle cx="6.5" cy="-112" r="5" />
              <path d="M-1.5 -112 H1.5" />
            </g>
          )}
        </g>
      </g>
    </g>
  );
}

const star = (outer: number, inner: number): string =>
  Array.from({ length: 16 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i * Math.PI) / 8 - Math.PI / 2;
    return `${r1(Math.cos(a) * r)},${r1(Math.sin(a) * r)}`;
  }).join(" ");

/** A generic "bang": it shows that something happened, never what or with what. */
function Impact() {
  return (
    <g className="cn-impact t" data-part="impact">
      <polygon points={star(46, 20)} fill={WARM} />
      <polygon points={star(28, 12)} fill="#fff" />
    </g>
  );
}

/** The unknown attacker: a hooded silhouette with a "?" and nothing in its hands. */
function Attacker() {
  return (
    <g className="cn-atk t" data-part="attacker">
      <path d="M-40 0 Q-46 -80 -22 -120 Q0 -135 22 -120 Q46 -80 40 0Z" fill="#02030c" />
      <path d="M-22 -118 Q-26 -164 0 -170 Q26 -164 22 -118 Q0 -128 -22 -118Z" fill="#02030c" />
      <path d="M-30 -100 L-118 -84 L-114 -68 L-26 -80Z" fill="#02030c" />
      <text
        x="0"
        y="-132"
        textAnchor="middle"
        fontFamily={FONT_DISPLAY}
        fontWeight="800"
        fontSize="40"
        fill="#ff4d7a"
      >
        ?
      </text>
    </g>
  );
}

function Chalk() {
  const parts = [
    <circle key="h" cx="-112" cy="-11" r="26" pathLength={1} />,
    <rect key="b" x="-104" y="-42" width="68" height="64" rx="16" pathLength={1} />,
    <rect key="l1" x="-50" y="-26" width="62" height="22" rx="10" pathLength={1} />,
    <rect key="l2" x="-50" y="3" width="62" height="22" rx="10" pathLength={1} />,
    <rect key="a1" x="-104" y="-62" width="58" height="16" rx="8" pathLength={1} />,
    <rect key="a2" x="-104" y="26" width="58" height="16" rx="8" pathLength={1} />,
  ];
  return (
    <g
      className="cn-chalk"
      data-part="chalk"
      transform="translate(760 640)"
      fill="none"
      stroke="#f4f3ff"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity=".9"
    >
      {parts.map((p) => (
        <g key={p.key} className="t">
          {p}
        </g>
      ))}
    </g>
  );
}

function Tape() {
  const words = "POLICE LINE · DO NOT CROSS · POLICE LINE";
  return (
    <g className="cn-tape t" data-part="tape">
      <rect x="552" y="648" width="8" height="118" rx="3" fill="#2a2f63" />
      <rect x="984" y="648" width="8" height="118" rx="3" fill="#2a2f63" />
      {[
        [-4, 698, 688],
        [3, 736, 726],
      ].map(([angle, cy, y]) => (
        <g key={y} transform={`rotate(${angle} 770 ${cy})`}>
          <rect x="540" y={y} width="460" height="22" fill={WARM} />
          <text
            x="552"
            y={y! + 16}
            fontFamily={FONT_MONO}
            fontWeight="800"
            fontSize="14"
            fill="#0d0f24"
            letterSpacing="3"
          >
            {words}
          </text>
        </g>
      ))}
    </g>
  );
}

/** The identifying accessory of a suspect; drawn on top of the silhouette (hair behind it). */
function Badge({ badge }: { badge: SuspectBadge }) {
  switch (badge) {
    case "stethoscope":
      return (
        <>
          <path d="M-20 -80 Q0 -34 20 -80" fill="none" stroke="#00e5c7" strokeWidth="4" />
          <circle cx="0" cy="-38" r="7" fill="#00e5c7" />
        </>
      );
    case "bowtie":
      return (
        <>
          <path d="M-14 -80 L0 -73 L-14 -66Z M14 -80 L0 -73 L14 -66Z" fill="#f4f3ff" />
          <circle cx="0" cy="-73" r="3.5" fill="#ff4d7a" />
        </>
      );
    case "hat":
      return (
        <>
          <ellipse
            cx="0"
            cy="-138"
            rx="46"
            ry="9"
            fill="#0d0f24"
            stroke="#4a519a"
            strokeWidth="2"
          />
          <rect
            x="-22"
            y="-166"
            width="44"
            height="30"
            rx="8"
            fill="#0d0f24"
            stroke="#4a519a"
            strokeWidth="2"
          />
          <rect x="-22" y="-144" width="44" height="6" fill={WARM} />
        </>
      );
    case "apron":
      return (
        <>
          <path
            d="M-12 -80 Q-16 -70 -22 -62 M12 -80 Q16 -70 22 -62"
            fill="none"
            stroke="#f4f3ff"
            strokeWidth="3"
          />
          <path d="M-24 -62 H24 V-6 Q0 2 -24 -6Z" fill="#f4f3ff" opacity=".85" />
          <path d="M-12 -40 H12" stroke="#161a3d" strokeWidth="3" opacity=".5" />
        </>
      );
    case "glasses":
      return (
        <g fill="none" stroke={WARM_SOFT} strokeWidth="3">
          <circle cx="-13" cy="-88" r="8" />
          <circle cx="13" cy="-88" r="8" />
          <path d="M-5 -88 H5" />
        </g>
      );
    case "long-hair":
      return null;
  }
}

function Suspect({
  name,
  badge,
  index,
  pending,
}: {
  name: string;
  badge: SuspectBadge;
  index: number;
  pending: boolean;
}) {
  const x = [345, 585, 855, 1095][index] ?? 345 + index * 250;
  return (
    <g
      className="cn-sus t"
      data-part="suspect"
      data-pending={pending ? "true" : undefined}
      aria-hidden={pending ? true : undefined}
      style={at(BEATS.suspectsStart + index * BEATS.suspectStep, { x: `${x}px` })}
    >
      <polygon className="cn-cone t" points="-14,520 14,520 80,770 -80,770" fill="#fff" />
      <g transform="translate(0 760)">
        {badge === "long-hair" && (
          <path
            d="M-34 -118 Q-46 -60 -34 -40 L-24 -40 L-26 -100Z M34 -118 Q46 -60 34 -40 L24 -40 L26 -100Z"
            fill="#2a2f63"
            stroke="#4a519a"
            strokeWidth="2"
          />
        )}
        <path
          d="M-58 0 Q-58 -66 -26 -80 L26 -80 Q58 -66 58 0Z"
          fill="#161a3d"
          stroke="#4a519a"
          strokeWidth="3"
        />
        <rect x="-10" y="-92" width="20" height="16" fill="#161a3d" />
        <circle cx="0" cy="-112" r="30" fill="#161a3d" stroke="#4a519a" strokeWidth="3" />
        <Badge badge={badge} />
        <text
          x="0"
          y="-98"
          textAnchor="middle"
          fontFamily={FONT_DISPLAY}
          fontWeight="800"
          fontSize="44"
          fill="#ff4d7a"
        >
          ?
        </text>
        <text
          x="0"
          y="30"
          textAnchor="middle"
          fontFamily={FONT_MONO}
          fontWeight="700"
          fontSize="22"
          fill="#cfcdf0"
          letterSpacing="2"
          className="cn-sus-name"
        >
          {name}
        </text>
      </g>
    </g>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* The whole picture                                                                           */
/* ------------------------------------------------------------------------------------------ */

/**
 * The intro picture for a case (mockup D1b). Everything that varies comes from the props: the
 * labels from the public briefing; the building, the windows, the place the body is found, the
 * victim's look and the suspects' badges from the descriptor; the stars, rain and hotel lights
 * from the public case number. It never draws a weapon, the culprit or the crime room: the
 * attacker is an anonymous silhouette and the only place shown for the body is where it was found.
 *
 * Nothing here depends on time. Every movement is a CSS animation sampled at `--mm-elapsed`,
 * so this subtree renders once per case and the frame changes without re-rendering it.
 */
function SceneArtImpl({ briefing, intro, decorSeed, suspectsShown }: SceneProps) {
  const scene = intro.sceneId;
  const shapes = briefing.rooms.map((r) => intro.roomShapes[r.id] ?? "square");
  const used = new Set(shapes);
  const anchors = anchorsFor(scene, used);
  return (
    <svg
      className="mm-intro-svg cn-svg"
      viewBox="0 0 1440 810"
      role="img"
      aria-label={briefing.title}
      preserveAspectRatio="xMidYMid slice"
    >
      <Defs />
      <g className="cn-shake t">
        <g className="cn-cam t">
          <Sky seed={decorSeed} moonX={scene === "manor-night" ? 1190 : 250} />
          {scene === "manor-night" ? <Manor /> : <Hotel seed={decorSeed} />}
          {(Object.keys(anchors) as RoomShape[]).map((shape) => (
            <g key={shape} data-part="window-frame" data-shape={shape}>
              {anchors[shape].dark}
            </g>
          ))}
          {briefing.rooms.map((room, i) => (
            <g
              key={room.id}
              className="cn-win t"
              data-part="window"
              data-shape={shapes[i]}
              style={at(BEATS.windowsStart + i * BEATS.windowStep)}
            >
              {anchors[shapes[i]!].lit}
            </g>
          ))}
          <g
            fontFamily={FONT_MONO}
            fontWeight="700"
            fontSize="22"
            fill="#fff"
            stroke="#05061a"
            strokeWidth="5"
            paintOrder="stroke"
            textAnchor="middle"
          >
            {briefing.rooms.map((room, i) => {
              const [x, y] = anchors[shapes[i]!].label;
              return (
                <text
                  key={room.id}
                  className="cn-lbl t"
                  data-part="room-label"
                  x={x}
                  y={y}
                  style={at(BEATS.labelsStart + i * BEATS.windowStep, {
                    len: `${r1(BEATS.labelLongest - i * BEATS.windowStep)}s`,
                  })}
                >
                  {stageLabel(room.name)}
                </text>
              );
            })}
          </g>
          <Foreground kind={intro.foundPlace} scene={scene} />
          <Chalk />
          <Victim look={intro.victimLook} />
          <Impact />
          <Attacker />
          <Tape />
        </g>
      </g>
      <Rain seed={decorSeed} />
      <rect
        className="cn-dark t"
        width="1440"
        height="810"
        fill="url(#mmcnVig)"
        data-part="blackout"
      />
      <rect className="cn-flash t" width="1440" height="810" fill="#fff" />
      <rect className="cn-floorbg t" y="470" width="1440" height="340" fill="url(#mmcnFloor)" />
      <g>
        {briefing.suspects.map((suspect, i) => (
          <Suspect
            key={suspect.id}
            name={suspect.name}
            badge={intro.suspectBadges[suspect.id] ?? "glasses"}
            index={i}
            pending={i >= suspectsShown}
          />
        ))}
      </g>
    </svg>
  );
}

/** The scene subtree only changes with the case, never with the clock. */
export const SceneArt = memo(SceneArtImpl);
