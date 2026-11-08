// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { catalogEntry, type LobbyView } from "@cangsplayground/core";
import werewolf from "@cangsplayground/game-werewolf";
import Host from "../src/routes/Host";
import { useLobbyStore } from "../src/store";
import { props, wwView } from "./werewolf-fixture";

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

/** A lobby where Werewolf is chosen but not prepared yet, and nobody is in a group. */
function configuring(playerCount: number): LobbyView {
  const lobby = props(wwView(), "host").lobby;
  lobby.players = lobby.players.slice(0, playerCount).map((p) => ({ ...p, groupId: null }));
  lobby.groups = [];
  lobby.catalog = [catalogEntry(werewolf)];
  lobby.game = { ...lobby.game!, stage: "CONFIGURING", groups: [], shared: null, config: null };
  return lobby;
}
async function renderHost(lobby: LobbyView) {
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
const openTab = async (label: string) => {
  const tab = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((t) =>
    t.textContent?.includes(label),
  )!;
  await act(async () => tab.dispatchEvent(new MouseEvent("mousedown", { button: 0, bubbles: true })));
};

it("can prepare a whole-lobby game without any groups once enough players are here", async () => {
  await renderHost(configuring(5));
  const prepare = container.querySelector<HTMLButtonElement>(".host-fixed-controls button")!;
  expect(prepare.textContent).toContain("Prepare");
  expect(prepare.disabled).toBe(false);
});

it("will not prepare with fewer players than the game's minimum", async () => {
  await renderHost(configuring(4));
  expect(container.querySelector<HTMLButtonElement>(".host-fixed-controls button")!.disabled).toBe(true);
  await openTab("Game");
  expect(container.textContent).toContain("needs at least 5 players");
  expect(container.textContent).not.toContain("Make groups first");
});

it("does not ask for groups on the Game tab when there are enough players", async () => {
  await renderHost(configuring(6));
  await openTab("Game");
  expect(container.textContent).not.toContain("Make groups first");
  expect(container.textContent).not.toContain("needs at least");
});

it("explains on the Groups tab that everyone plays together, with no assign button", async () => {
  await renderHost(configuring(6));
  await openTab("Groups");
  expect(container.textContent).toContain("Everyone plays together");
  const labels = [...container.querySelectorAll("button")].map((b) => b.textContent);
  expect(labels.some((t) => /assign groups/i.test(t ?? ""))).toBe(false);
});
