// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Player from "../src/routes/Player";
import { useLobbyStore } from "../src/store";
import { spyLobby } from "./spy-ux-fixture";
const { request, errorToast } = vi.hoisted(() => ({ request: vi.fn(), errorToast: vi.fn() }));
vi.mock("../src/socket", () => ({ readToken: () => "player-token", request }));
vi.mock("sonner", () => ({ toast: { error: errorToast } }));
vi.mock("../src/components/MobileToaster", () => ({ MobileToaster: () => null }));
vi.mock("../src/components/session", () => ({
  useRole: () => "",
  useWakeLock: () => {},
  SessionBoundary: ({ children }: { children: React.ReactNode }) => children,
}));
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  request.mockReset();
  errorToast.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const lobby = spyLobby();
  lobby.viewer = { kind: "player", playerId: "p0" };
  lobby.me = { playerId: "p0", groupId: "g1", name: "Nguyễn Thị Ngọc Hạnh" };
  useLobbyStore.getState().sync(lobby);
  useLobbyStore.getState().setConnection("online");
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});
async function renderPlayer() {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/play/ABC234"]}>
        <Routes>
          <Route path="/play/:code" element={<Player />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
}
const doneButton = () =>
  [...container.querySelectorAll("button")].find((b) =>
    /I'm done|Offline…/.test(b.textContent ?? ""),
  )!;
it("disables and labels the done action while offline", async () => {
  useLobbyStore.getState().setConnection("reconnecting");
  await renderPlayer();
  expect(doneButton().disabled).toBe(true);
  expect(doneButton().textContent).toContain("Offline…");
  await act(async () => doneButton().click());
  expect(request).not.toHaveBeenCalled();
});
it("recovers a done action after five seconds without an answer", async () => {
  request.mockReturnValue(new Promise(() => {}));
  await renderPlayer();
  await act(async () => doneButton().click());
  expect(doneButton().disabled).toBe(true);
  await act(async () => vi.advanceTimersByTimeAsync(5000));
  expect(doneButton().disabled).toBe(false);
  expect(errorToast).toHaveBeenCalledWith("Couldn't reach the server. Tap again.");
});
it.each(["reject", "negative"] as const)("recovers when done request fails: %s", async (kind) => {
  if (kind === "reject") request.mockRejectedValue(new Error("network down"));
  else request.mockResolvedValue({ ok: false, error: { message: "No reply" } });
  await renderPlayer();
  await act(async () => doneButton().click());
  expect(doneButton().disabled).toBe(false);
  expect(errorToast).toHaveBeenCalledWith("Couldn't reach the server. Tap again.");
});
it("shows the compact clock and speaking round during your turn", async () => {
  await renderPlayer();
  expect(container.querySelector(".player-header .cp-game-clock-compact")).not.toBeNull();
  expect(container.textContent).toContain("Round 2 of 2");
});

it.each(["PREPARED", "ROUND_END", "FINISHED"] as const)(
  "hides the generic dead turn timer during %s",
  async (phase) => {
    const lobby = useLobbyStore.getState().view!;
    lobby.game!.groups[0]!.phase = phase;
    await renderPlayer();
    expect(container.querySelector(".player-game [role=timer]")).toBeNull();
    if (phase === "PREPARED") expect(container.textContent).toContain("Get ready");
  },
);
