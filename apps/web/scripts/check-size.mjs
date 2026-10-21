import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { URL, fileURLToPath } from "node:url";
import console from "node:console";
const dist = new URL("../dist/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL(".vite/manifest.json", dist), "utf8"));
const dependencies = (key, seen = new Set()) => {
  if (seen.has(key)) return seen;
  seen.add(key);
  for (const name of manifest[key].imports ?? []) dependencies(name, seen);
  return seen;
};
const chunks = Object.entries(manifest)
  .filter(([, entry]) => entry.file.endsWith(".js"))
  .map(([key, entry]) => ({
    key,
    file: entry.file,
    bytes: gzipSync(readFileSync(new URL(entry.file, dist))).length,
  }));
console.table(chunks.map((row) => ({ chunk: row.file, "gzip KB": (row.bytes / 1000).toFixed(2) })));
const player = [...dependencies("src/routes/Player.tsx")];
const total = player.reduce((sum, key) => sum + chunks.find((row) => row.key === key).bytes, 0);
console.log(
  `Player + all static dependencies: ${total} bytes gzip (${(total / 1000).toFixed(2)} KB)`,
);
if (total >= 200000) throw new Error("Player JavaScript must stay below 200 KB gzip.");
if (player.some((key) => /routes\/(Host|Display)/.test(key)))
  throw new Error("Host/projector code is in the player dependency graph.");
console.log(`Verified ${fileURLToPath(dist)}: player budget and route isolation pass.`);
