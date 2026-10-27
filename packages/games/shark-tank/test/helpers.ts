import { createRng, type RosterEntry, type Viewer } from "@cangsplayground/core";
import { sharkTank } from "../src/logic.js";
import { configSchema, type SharkTankConfig } from "../src/types.js";

export function start(sizes: number[], options: Partial<SharkTankConfig> = {}) {
  const config = configSchema.parse(options);
  const rng = createRng(1);
  let now = 1000;
  const groups = sizes.map((size, index) => ({
    groupId: `g${index + 1}`,
    playerIds: Array.from({ length: size }, (_, i) => `g${index + 1}p${i + 1}`),
    round: 1,
  }));
  let roster: RosterEntry[] = groups.flatMap((group) =>
    group.playerIds.map((playerId) => ({ playerId, groupId: group.groupId, connected: true })),
  );
  let shared = sharkTank.prepareShared!({ config, groups, rng, now });
  const args = () => ({ config, shared, roster, rng, now });
  return {
    get shared() {
      return shared;
    },
    act(actor: string, type: string, payload?: unknown) {
      const viewer: Viewer =
        actor === "host" ? { kind: "host" } : { kind: "player", playerId: actor };
      const next = sharkTank.onSharedAction!({
        ...args(),
        actor: viewer,
        action: { type, payload },
      });
      if (next !== null) shared = next;
      return next;
    },
    tick(ms: number) {
      now += ms;
    },
    setConnected(playerId: string, connected: boolean) {
      const entry = roster.find((r) => r.playerId === playerId)!;
      entry.connected = connected;
      shared = sharkTank.onSharedRosterChange?.(args()) ?? shared;
    },
    leave(playerId: string) {
      const entry = roster.find((r) => r.playerId === playerId)!;
      roster = roster.filter((r) => r.playerId !== playerId);
      shared =
        sharkTank.onSharedPlayerLeft?.({ ...args(), playerId, groupId: entry.groupId }) ?? shared;
    },
  };
}
