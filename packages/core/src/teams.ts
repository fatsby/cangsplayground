/** DESIGN.md §3.8 — the single source of team colours. Order is fixed. */
export type TeamShape =
  "Circle" | "Square" | "Star" | "Triangle" | "Diamond" | "Hexagon" | "Heart" | "Moon";

export interface TeamStyle {
  /** Display name, e.g. "Red" or "Red 2" past the 8th team. */
  name: string;
  fill: string;
  fg: string;
  neon: string;
  /** lucide-react icon name. */
  shape: TeamShape;
  /** True from the 9th team on: icon is drawn stroke-only (DESIGN.md §3.8). */
  outlined: boolean;
}

export const TEAMS: readonly Omit<TeamStyle, "outlined">[] = [
  { name: "Red", fill: "#D62F33", fg: "#FFFFFF", neon: "#FF6B6E", shape: "Circle" },
  { name: "Blue", fill: "#2563EB", fg: "#FFFFFF", neon: "#6EA8FF", shape: "Square" },
  { name: "Yellow", fill: "#FACC15", fg: "#0D0F24", neon: "#FFE14D", shape: "Star" },
  { name: "Green", fill: "#16A34A", fg: "#0D0F24", neon: "#3DDC84", shape: "Triangle" },
  { name: "Purple", fill: "#9333EA", fg: "#FFFFFF", neon: "#C58BFF", shape: "Diamond" },
  { name: "Orange", fill: "#F97316", fg: "#0D0F24", neon: "#FFA463", shape: "Hexagon" },
  { name: "Lime", fill: "#84CC16", fg: "#0D0F24", neon: "#B5F23D", shape: "Heart" },
  { name: "Pink", fill: "#EC4899", fg: "#0D0F24", neon: "#FF7AC6", shape: "Moon" },
];

/** Style for the team at a 0-based index; wraps after 8 and numbers the name. */
export function teamStyle(index: number): TeamStyle {
  const base = TEAMS[index % TEAMS.length]!;
  const cycle = Math.floor(index / TEAMS.length);
  return {
    ...base,
    name: cycle === 0 ? base.name : `${base.name} ${cycle + 1}`,
    outlined: cycle > 0,
  };
}

/** "Team Red", "Team Red 2"… */
export function teamName(index: number): string {
  return `Team ${teamStyle(index).name}`;
}
