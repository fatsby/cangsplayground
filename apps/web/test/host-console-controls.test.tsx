// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
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
  lobby.game!.clock!.timer.endsAt = 120000;
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
