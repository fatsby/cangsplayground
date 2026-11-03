import { describe, expect, it, vi } from "vitest";
import { buildView } from "../src/broadcast.js";
import { Lobby } from "../src/lobby/Lobby.js";

vi.mock("../../../packages/games/murder-mystery/src/generate.ts", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../packages/games/murder-mystery/src/generate.ts")>();
  return {
    ...actual,
    generateCase: vi.fn(() => {
      throw new Error("generation exploded");
    }),
  };
});

describe("a case that cannot be generated", () => {
  it("fails Prepare without leaving a half-prepared session or any private view", () => {
    const lobby = new Lobby({ code: "MYS999", hostToken: "host-secret-token", seed: 5 });
    const players = Array.from({ length: 3 }, (_, i) => lobby.join(`Student ${i}`));
    for (const [i, p] of players.entries()) p.sockets.add(`s${i}`);
    lobby.selectGame("murder-mystery");
    lobby.assign("count", 1);
    expect(() => lobby.control("prepare")).toThrow();
    expect(lobby.game!.stage).toBe("CONFIGURING");
    expect(lobby.game!.shared).toBeFalsy();
    expect(lobby.sharedDeadlines()).toEqual([]);
    for (const viewer of [{ kind: "host" as const }, { kind: "projector" as const }]) {
      expect(buildView(lobby, viewer).game!.shared).toBeFalsy();
    }
    expect(buildView(lobby, { kind: "player", playerId: players[0]!.id }).game!.shared).toBeFalsy();
  });
});
