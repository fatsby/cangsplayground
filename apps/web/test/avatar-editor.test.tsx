// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AvatarEditor } from "../src/components/AvatarEditor";
import { useLobbyStore } from "../src/store";
import { spyLobby } from "./spy-ux-fixture";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../src/socket", () => ({ request }));
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const lobby = spyLobby();
  lobby.game = null;
  lobby.me = { playerId: "p0", name: lobby.players[0]!.name, groupId: "g1" };
  lobby.players[0]!.avatar = { seed: "original", backgroundColor: "ffe3ea" };
  useLobbyStore.getState().sync(lobby);
  useLobbyStore.getState().setConnection("online");
  request.mockReset().mockResolvedValue({ ok: true });
  await act(async () => root.render(<AvatarEditor player={lobby.players[0]!} />));
  await act(async () => {
    await vi.dynamicImportSettled();
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});
function button(name: string) {
  const result = [...container.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === name,
  );
  expect(result, `button ${name}`).toBeDefined();
  return result!;
}
async function click(name: string) {
  await act(async () => button(name).click());
}
it("randomizes on plain HTTP classroom phones without crypto.randomUUID", async () => {
  vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });
  await click("Customize avatar");
  await click("Randomize");
  await click("Save avatar");
  expect(request).toHaveBeenCalledWith("player:avatar", {
    avatar: { seed: expect.stringMatching(/^[0-9a-f]{32}$/) },
  });
});
it("previews a draft locally, cancels it, and sends the chosen appearance only on Save", async () => {
  await click("Customize avatar");
  const select = container.querySelector<HTMLSelectElement>('select[name="hairVariant"]')!;
  const originalPreview = container.querySelector<HTMLImageElement>(
    '[aria-label="Avatar preview"]',
  )!.src;
  await act(async () => {
    select.value = "braids";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(container.querySelector<HTMLImageElement>('[aria-label="Avatar preview"]')!.src).not.toBe(
    originalPreview,
  );
  expect(request).not.toHaveBeenCalled();
  await click("Cancel");
  await click("Customize avatar");
  expect(container.querySelector<HTMLImageElement>('[aria-label="Avatar preview"]')!.src).toBe(
    originalPreview,
  );
  await click("Randomize");
  await click("Save avatar");
  expect(request).toHaveBeenCalledWith("player:avatar", {
    avatar: expect.objectContaining({ seed: expect.not.stringMatching(/^original$/) }),
  });
  expect(container.querySelector("form")).toBeNull();
});
it("keeps the draft and shows server errors, with Save disabled offline and while pending", async () => {
  await click("Customize avatar");
  await act(async () => useLobbyStore.getState().setConnection("reconnecting"));
  expect(button("Save avatar").disabled).toBe(true);
  await act(async () => useLobbyStore.getState().setConnection("online"));
  let resolve: (value: unknown) => void;
  request.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  await click("Save avatar");
  expect(button("Saving…").disabled).toBe(true);
  await act(async () => resolve!({ ok: false, error: { message: "Please try again" } }));
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("Please try again");
  expect(button("Save avatar").disabled).toBe(false);
});
it("closes on game selection, discards its draft, and reopens between games", async () => {
  await click("Customize avatar");
  await click("Randomize");
  await act(async () => useLobbyStore.getState().patch({ version: 2, game: spyLobby().game }));
  expect(container.querySelector("form")).toBeNull();
  expect(container.querySelector("button")).toBeNull();
  await act(async () => useLobbyStore.getState().patch({ version: 3, game: null }));
  await click("Customize avatar");
  expect(request).not.toHaveBeenCalled();
  expect(
    container.querySelector('select[name="backgroundColor"]')?.getAttribute("value") ??
      (container.querySelector('select[name="backgroundColor"]') as HTMLSelectElement)?.value,
  ).toBe("ffe3ea");
});
