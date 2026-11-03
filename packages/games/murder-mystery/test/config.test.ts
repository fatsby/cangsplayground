import { describe, expect, it } from "vitest";
import { LIMITS, configSchema } from "../src/config.js";

describe("configSchema", () => {
  it("defaults to the classroom phase lengths", () => {
    expect(configSchema.parse({})).toEqual({
      briefingSeconds: 120,
      sharingSeconds: 180,
      investigationSeconds: 180,
      conclusionSeconds: 240,
    });
  });

  it("accepts 30-600 seconds in steps of 30 and rejects the rest", () => {
    expect(configSchema.safeParse({ briefingSeconds: 30 }).success).toBe(true);
    expect(configSchema.safeParse({ conclusionSeconds: 600 }).success).toBe(true);
    expect(configSchema.safeParse({ briefingSeconds: 0 }).success).toBe(false);
    expect(configSchema.safeParse({ briefingSeconds: 45 }).success).toBe(false);
    expect(configSchema.safeParse({ sharingSeconds: 630 }).success).toBe(false);
    expect(configSchema.safeParse({ investigationSeconds: 90.5 }).success).toBe(false);
  });

  it("publishes the limits used by the host form", () => {
    expect(LIMITS).toEqual({ min: 30, max: 600, step: 30 });
  });
});
