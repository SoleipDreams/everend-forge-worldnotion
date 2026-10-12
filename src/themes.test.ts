import { beforeEach, describe, expect, it } from "vitest";
import { loadSettings, saveSettings } from "./settings";
import {
  normalizeThemeId,
  selectionColorForTheme,
  themeById,
  themeForStyleCommand,
  toggledThemeMode,
} from "./themes";

describe("Everend Forge themes", () => {
  beforeEach(() => localStorage.clear());

  it("persists both modes and keeps mode switching within the family", () => {
    for (const theme of ["forge-mono-light", "forge-mono-dark"] as const) {
      expect(normalizeThemeId(theme)).toBe(theme);
      saveSettings({ ...loadSettings(), theme });
      expect(loadSettings().theme).toBe(theme);
      expect(themeById(theme).family).toBe("forge-mono");
      expect(toggledThemeMode(toggledThemeMode(theme))).toBe(theme);
    }
    expect(toggledThemeMode("forge-mono-light")).toBe("forge-mono-dark");
    expect(toggledThemeMode("forge-mono-dark")).toBe("forge-mono-light");
  });

  it("selects the native style command without changing the current mode", () => {
    expect(themeForStyleCommand("forge-mono", "github")).toBe("forge-mono-light");
    expect(themeForStyleCommand("forge-mono", "night-owl")).toBe("forge-mono-dark");
    expect(themeForStyleCommand("github", "forge-mono-dark")).toBe("github-dark");
  });

  it("uses gold editor selections and preserves the legacy fallback", () => {
    expect(selectionColorForTheme("forge-mono-light").backgroundColor).toBe("#87531e");
    expect(selectionColorForTheme("forge-mono-dark").backgroundColor).toBe("#f2c46d");
    expect(themeById("forge-mono-light").label).toBe("Everend Forge Light");
    expect(themeById("forge-mono-dark").label).toBe("Everend Forge Dark");
    expect(normalizeThemeId("unknown")).toBe("worldnotion-light");
    expect(normalizeThemeId("dark")).toBe("worldnotion-dark");
    expect(loadSettings().theme).toBe("worldnotion-light");
  });
});
