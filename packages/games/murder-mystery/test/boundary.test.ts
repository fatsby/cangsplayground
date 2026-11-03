import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = resolve(__dirname, "../src");

/** Modules that hold the answer, the generator or server logic; the browser must never load them. */
const SERVER_ONLY = [
  "model",
  "solver",
  "validate",
  "generate",
  "intro",
  "round",
  "clock",
  "actions",
  "scoring",
  "lifecycle",
  "view",
  "logic",
  "index",
  "config",
  "cases/",
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const FROM =
  /(?:^|\n)\s*(?:import|export)\b[^;'"]*?from\s*["']([^"']+)["']|(?:^|\n)\s*import\s*["']([^"']+)["']/g;

/** Runtime imports of a file: type-only statements (`import type` / `export type`) are erased. */
function runtimeImports(file: string): string[] {
  const text = readFileSync(file, "utf8");
  const found: string[] = [];
  for (const match of text.matchAll(FROM)) {
    const statement = match[0];
    if (/^\s*(?:import|export)\s+type\b/.test(statement)) continue;
    found.push((match[1] ?? match[2])!);
  }
  return found;
}

function resolveLocal(from: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  const base = resolve(dirname(from), spec.replace(/\.js$/, ""));
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.tsx")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Every local file reachable from the roots through runtime imports. */
function reachable(roots: string[]): { files: Set<string>; external: Set<string> } {
  const files = new Set<string>();
  const external = new Set<string>();
  const visit = (file: string) => {
    if (files.has(file)) return;
    files.add(file);
    for (const spec of runtimeImports(file)) {
      const local = resolveLocal(file, spec);
      if (local) visit(local);
      else if (!spec.startsWith(".")) external.add(spec);
    }
  };
  roots.forEach(visit);
  return { files, external };
}

describe("client import boundary", () => {
  const roots = [
    ...walk(join(SRC, "views")).filter((f) => /\.tsx?$/.test(f)),
    join(SRC, "phrases.ts"),
  ];

  it("has a views folder with the player screens", () => {
    const names = roots.map((f) => f.slice(SRC.length + 1));
    for (const expected of [
      "phrases.ts",
      "views/index.tsx",
      "views/player.tsx",
      "views/clue-card.tsx",
      "views/conclusion.tsx",
      "views/language-help.tsx",
      "views/reveal.tsx",
      "views/timeline.ts",
      "views/use-game-action.ts",
    ]) {
      expect(names, expected).toContain(expected);
    }
  });

  it("never reaches the generator, solver, answer data or any server module at runtime", () => {
    const { files } = reachable(roots);
    const loaded = [...files].map((f) => f.slice(SRC.length + 1).replace(/\.tsx?$/, ""));
    for (const name of loaded) {
      for (const banned of SERVER_ONLY) {
        const hit = banned.endsWith("/") ? name.startsWith(banned) : name === banned;
        expect(hit, `${name} is reachable from the browser`).toBe(false);
      }
    }
  });

  it("loads no runtime dependency besides React, the UI kit and icons", () => {
    const { external } = reachable(roots);
    const allowed = /^(react|react-dom|react\/jsx-runtime|lucide-react|@cangsplayground\/ui)$/;
    for (const spec of external) expect(spec, spec).toMatch(allowed);
  });
});
