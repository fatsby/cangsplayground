import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, it } from "vitest";

it("simulates Who's the Spy to a result for every group without an external server", async () => {
  const { stdout } = await promisify(execFile)(
    process.execPath,
    ["--import", "tsx", "scripts/simulate.ts", "--game", "whos-the-spy", "--clients", "12"],
    { timeout: 15000 },
  );
  const results = stdout.split("\n").filter((line) => line.startsWith("Team "));
  expect(results).toHaveLength(4);
  for (const line of results) expect(line).toMatch(/"winner":"(team|spies)"/);
}, 20000);
