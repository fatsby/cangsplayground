import { networkInterfaces } from "node:os";
export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const port = Number(env.PORT ?? 3000);
  const address =
    Object.values(networkInterfaces())
      .flat()
      .find((a) => a && a.family === "IPv4" && !a.internal)?.address ?? "localhost";
  return {
    port,
    publicUrl: (env.PUBLIC_URL ?? `http://${address}:${port}`).replace(/\/$/, ""),
    ttlMinutes: Number(env.LOBBY_TTL_MINUTES ?? 180),
    production: env.NODE_ENV === "production",
  };
}
