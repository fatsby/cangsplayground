// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HostGame } from "../src/components/HostGame";
import { spyLobby } from "./spy-ux-fixture";
const { successToast } = vi.hoisted(() => ({ successToast: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: successToast } }));
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  successToast.mockReset();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});
async function renderHost(configure = vi.fn(async (_config: Record<string, unknown>) => true)) {
  const lobby = spyLobby();
  lobby.game!.stage = "CONFIGURING";
  await act(async () =>
    root.render(
      <HostGame
        view={lobby}
        busy={false}
        serverNow={() => 0}
        select={() => {}}
        configure={configure}
        control={() => {}}
      />,
    ),
  );
  return configure;
}
const button = (label: string) =>
  container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
it("updates the smallest team warning as spies change, with bounded keyboard steppers", async () => {
  await renderHost();
  expect(container.querySelector('[role="alert"]')).toBeNull();
  await act(async () => button("Increase Spies per group").click());
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("up to 1 spy");
  const value = container.querySelector('[role="spinbutton"]')!;
  await act(async () =>
    value.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true })),
  );
  expect(value.getAttribute("aria-valuenow")).toBe("1");
  expect(button("Decrease Spies per group").disabled).toBe(true);
  expect(container.querySelector('[role="alert"]')).toBeNull();
  await act(async () =>
    value.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true })),
  );
  expect(value.getAttribute("aria-valuenow")).toBe("29");
  expect(button("Increase Spies per group").disabled).toBe(true);
});
it("changes category with native radio controls and saves the selected topic and feedback", async () => {
  const configure = await renderHost();
  await act(async () => container.querySelector<HTMLInputElement>('input[value="food"]')!.click());
  expect(container.querySelector('input[value="airport"]')).toBeNull();
  expect(container.querySelector('input[value="pizza"]')).not.toBeNull();
  await act(async () => container.querySelector<HTMLInputElement>('input[value="pizza"]')!.click());
  await act(async () =>
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(configure).toHaveBeenCalledWith(
    expect.objectContaining({ category: "food", foodTopic: "pizza" }),
  );
  expect(successToast).toHaveBeenCalledWith("Settings saved");
});
it("does not claim settings saved after server rejection", async () => {
  await renderHost(vi.fn(async () => false));
  await act(async () =>
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(successToast).not.toHaveBeenCalled();
});
