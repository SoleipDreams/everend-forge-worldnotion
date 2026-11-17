import { describe, expect, it } from "vitest";
import { buildCommandResults } from "./commandResults";

describe("buildCommandResults", () => {
  it("hides the mode-switch command when editor mode controls are disabled", () => {
    const results = buildCommandResults([], false);

    expect(results.some((result) => result.type === "command" && result.commandId === "switchMode")).toBe(false);
  });

  it("keeps the mode-switch command available when mode controls are enabled", () => {
    const results = buildCommandResults([], true);

    expect(results.some((result) => result.type === "command" && result.commandId === "switchMode")).toBe(true);
  });
});
