import { afterEach, describe, expect, it, vi } from "vitest";
import { newCommandId } from "../src/socket/command-id";

describe("newCommandId", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("works without crypto.randomUUID (plain-http LAN pages are not a secure context)", () => {
    vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });
    const a = newCommandId(),
      b = newCommandId();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });
});
