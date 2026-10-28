// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { Button, PlayerAvatar } from "@cangsplayground/ui";

vi.mock("../../../packages/ui/src/avatar-image", () => ({
  default: () => {
    throw new Error("Avatar renderer unavailable");
  },
}));

it("keeps game controls working when the optional avatar renderer fails", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let done = false;
  try {
    await act(async () => {
      root.render(
        <main>
          <PlayerAvatar playerId="p1" label="Player avatar" />
          <Button
            onClick={() => {
              done = true;
            }}
          >
            I'm done
          </Button>
        </main>,
      );
      await vi.dynamicImportSettled();
    });
    expect(container.querySelector('[data-player-id="p1"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Player avatar"]')).not.toBeNull();
    await act(async () => container.querySelector("button")!.click());
    expect(done).toBe(true);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    logged.mockRestore();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});
