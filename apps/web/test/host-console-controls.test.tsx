// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createRng } from "@cangsplayground/core";
import sharkTank, { configSchema } from "@cangsplayground/game-shark-tank";
import Host from "../src/routes/Host";
import { useLobbyStore } from "../src/store";
import { spyLobby } from "./spy-ux-fixture";
const { hostCommand } = vi.hoisted(() => ({ hostCommand: vi.fn(async () => ({ ok: true })) }));
vi.mock("../src/socket", () => ({ readToken: () => "host-token", hostCommand }));
vi.mock("../src/components/MobileToaster", () => ({ MobileToaster: () => null }));
vi.mock("../src/components/session", () => ({
  useRole: () => "",
  SessionBoundary: ({ children }: { children: React.ReactNode }) => children,
}));
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  hostCommand.mockClear();
  sessionStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  useLobbyStore.getState().setConnection("online");
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});
async function renderHost(lobby = spyLobby("ROUND_END")) {
  if (lobby.game) lobby.game.clock!.timer.endsAt = 120000;
  useLobbyStore.getState().sync(lobby);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/host/ABC234"]}>
        <Routes>
          <Route path="/host/:code" element={<Host />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
}
it("opens the Game tab when an active game has no saved tab", async () => {
  await renderHost();
  expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toContain(
    "Game",
  );
});
it("restores a valid saved tab for the current lobby", async () => {
  sessionStorage.setItem("host-tab:ABC234", "groups");
  const lobby = spyLobby();
  lobby.game = null;
  await renderHost(lobby);
  expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toContain(
    "Groups",
  );
});
it("opens Game instead of a saved Groups tab when a game is active", async () => {
  sessionStorage.setItem("host-tab:ABC234", "groups");
  await renderHost();
  expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toContain(
    "Game",
  );
});
it("saves the selected tab under the current lobby code", async () => {
  await renderHost();
  const playersTab = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
    (tab) => tab.textContent?.includes("Players"),
  )!;
  await act(async () =>
    playersTab.dispatchEvent(new MouseEvent("mousedown", { button: 0, bubbles: true })),
  );
  expect(sessionStorage.getItem("host-tab:ABC234")).toBe("players");
});
it("opens Players when the saved tab is invalid and no game is active", async () => {
  sessionStorage.setItem("host-tab:ABC234", "unknown");
  const lobby = spyLobby();
  lobby.game = null;
  await renderHost(lobby);
  expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toContain(
    "Players",
  );
});
it("opens Players before a game is active", async () => {
  const lobby = spyLobby();
  lobby.game = null;
  await renderHost(lobby);
  expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toContain(
    "Players",
  );
});
it("uses Continue in the fixed bar while a team waits, and sends its command", async () => {
  await renderHost();
  const main = container.querySelector<HTMLButtonElement>(".host-fixed-controls button")!;
  expect(main.textContent).toContain("Continue");
  expect(main.disabled).toBe(false);
  await act(async () => main.click());
  expect(hostCommand).toHaveBeenCalledWith("game:control", { cmd: "nextRound" });
});
it("removes fixed game controls once every team is finished", async () => {
  await renderHost(spyLobby("FINISHED"));
  expect(container.querySelector(".host-fixed-controls")).toBeNull();
});

it.each(["PREP", "PITCH"] as const)(
  "reveals each Shark Tank group's own idea in Secrets during %s and hides it on release",
  async (stage) => {
    const lobby = spyLobby();
    lobby.groups = [
      { id: "g1", index: 0, name: "Team Red", playerIds: ["p0", "p1"] },
      { id: "g2", index: 1, name: "Team Blue", playerIds: ["p2", "p3"] },
    ];
    lobby.players.forEach((player, index) => {
      player.groupId = index < 2 ? "g1" : "g2";
    });
    const config = configSchema.parse({});
    const shared = sharkTank.prepareShared!({
      config,
      groups: lobby.groups.map((group) => ({
        groupId: group.id,
        playerIds: group.playerIds,
        round: 1,
      })),
      rng: createRng(1),
      now: 0,
    });
    shared.stage = stage;
    shared.companies[0]!.ideaId = "cat-umbrella";
    shared.companies[1]!.ideaId = "singing-shoes";
    const game = lobby.game!;
    game.gameId = sharkTank.id;
    game.name = sharkTank.name;
    game.config = config;
    game.groups = lobby.groups.map((group) => ({ ...game.groups[0]!, groupId: group.id }));
    game.shared = sharkTank.sharedViewFor!({
      config,
      shared,
      viewer: lobby.viewer,
      viewerGroupId: null,
    });
    await renderHost(lobby);
    const secretsTab = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
      (tab) => tab.textContent?.includes("Secrets"),
    )!;
    await act(async () =>
      secretsTab.dispatchEvent(new MouseEvent("mousedown", { button: 0, bubbles: true })),
    );
    expect(container.textContent).not.toContain("Cat Umbrella");
    expect(container.textContent).not.toContain("Singing Shoes");
    const rows = container.querySelectorAll<HTMLButtonElement>(
      '[aria-label="Hold to show group details"]',
    );
    expect(rows).toHaveLength(2);
    for (const [index, name, pitch] of [
      [0, "Cat Umbrella", "This tiny umbrella keeps your cat dry in the rain."],
      [1, "Singing Shoes", "These shoes tie themselves and sing when you walk."],
    ] as const) {
      const row = rows[index]!;
      await act(async () =>
        row.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })),
      );
      expect(row.textContent).toContain(name);
      expect(row.textContent).toContain(pitch);
      expect(rows[1 - index]!.textContent).not.toContain(name);
      await act(async () =>
        row.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true })),
      );
      expect(container.textContent).not.toContain(name);
    }
  },
);
