import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { createServer } from "../src/index.js";
import { readConfig } from "../src/config.js";

it("returns health/config, serves production assets and falls back to the SPA for page routes", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "cangsplayground-http-"));
  await writeFile(path.join(root, "index.html"), "<html>CangsPlayground test</html>");
  await writeFile(path.join(root, "app.js"), "globalThis.cangsplayground = true;");
  const server = await createServer({
    production: true,
    webRoot: root,
    publicUrl: "https://cangsplayground.example",
  });
  try {
    expect((await server.app.inject("/healthz")).statusCode).toBe(200);
    expect((await server.app.inject("/api/config")).json()).toEqual({
      publicUrl: "https://cangsplayground.example",
    });
    expect((await server.app.inject("/play/ABC234")).body).toBe("<html>CangsPlayground test</html>");
    expect((await server.app.inject("/app.js")).body).toContain("globalThis.cangsplayground");
    expect((await server.app.inject("/missing.js")).statusCode).toBe(404);
    expect((await server.app.inject("/api/missing")).statusCode).toBe(404);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
it("uses the configured port, URL and TTL", () => {
  expect(
    readConfig({
      PORT: "3210",
      PUBLIC_URL: "https://cangsplayground.example/",
      LOBBY_TTL_MINUTES: "60",
      NODE_ENV: "production",
    }),
  ).toMatchObject({
    port: 3210,
    publicUrl: "https://cangsplayground.example",
    ttlMinutes: 60,
    production: true,
  });
});
