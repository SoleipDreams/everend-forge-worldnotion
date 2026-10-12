import { describe, expect, it } from "vitest";
import type { ValidationFinding, VaultFile } from "../domain";
import { DEFAULT_EDITOR_SETTINGS, type AppSettingsV4 } from "../editorTypes";
import { loadSettings } from "../settings";
import {
  VAULT_APPEARANCE_SETTINGS_PATH,
  applyVaultAppearanceSettings,
  extractVaultAppearanceSettings,
  parseVaultAppearanceSettings,
  serializeVaultAppearance,
} from "./vaultAppearanceSettings";

function baseSettings(): AppSettingsV4 {
  return loadSettings();
}

describe("vault appearance settings", () => {
  it("keeps the local atmosphere preference out of portable universe settings", () => {
    const local = { ...baseSettings(), ambientBackground: false, backgroundScene: "jade" };
    const appearance = extractVaultAppearanceSettings(local);
    expect(serializeVaultAppearance(appearance)).not.toContain("ambientBackground");
    expect(serializeVaultAppearance(appearance)).not.toContain("backgroundScene");
    expect(applyVaultAppearanceSettings(local, appearance).ambientBackground).toBe(false);
    expect(applyVaultAppearanceSettings(local, appearance).backgroundScene).toBe("jade");
  });
  it("returns undefined when the universe has no settings file yet", () => {
    const findings: ValidationFinding[] = [];
    expect(
      parseVaultAppearanceSettings([{ relativePath: "Notes.md", content: "" }], findings),
    ).toBeUndefined();
    expect(findings).toEqual([]);
  });

  it("keeps the ecosystem display preference out of portable universe settings", () => {
    const local = baseSettings();
    local.explorer.ecosystemView = "list";
    const appearance = extractVaultAppearanceSettings(local);

    expect(appearance.explorer).not.toHaveProperty("ecosystemView");
    expect(serializeVaultAppearance(appearance)).not.toContain("ecosystemView");
    expect(applyVaultAppearanceSettings(local, appearance).explorer.ecosystemView).toBe("list");
  });

  it("round-trips a universe's appearance through serialize/parse", () => {
    const settings: AppSettingsV4 = {
      ...baseSettings(),
      theme: "github-dark",
      editor: { ...DEFAULT_EDITOR_SETTINGS, fontSize: 22 },
      explorer: {
        ...baseSettings().explorer,
        favorites: [{ path: "Characters/Ada.md", kind: "file", label: "Ada" }],
      },
    };
    const appearance = extractVaultAppearanceSettings(settings);
    const files: VaultFile[] = [
      {
        relativePath: VAULT_APPEARANCE_SETTINGS_PATH,
        content: serializeVaultAppearance(appearance),
      },
    ];

    const findings: ValidationFinding[] = [];
    const parsed = parseVaultAppearanceSettings(files, findings);

    expect(findings).toEqual([]);
    expect(parsed?.theme).toBe("github-dark");
    expect(parsed?.editor.fontSize).toBe(22);
    expect(parsed?.explorer.favorites).toEqual([
      { path: "Characters/Ada.md", kind: "file", label: "Ada" },
    ]);
  });

  it("normalizes portable favorites and ignores machine-specific paths", () => {
    const findings: ValidationFinding[] = [];
    const parsed = parseVaultAppearanceSettings(
      [
        {
          relativePath: VAULT_APPEARANCE_SETTINGS_PATH,
          content: JSON.stringify({
            explorer: {
              favorites: [
                { path: "Characters\\\\Ada.md", kind: "file" },
                { path: "Characters/Ada.md", kind: "file", label: "Duplicate" },
                { path: "C:/OtherMachine/Note.md", kind: "file", label: "Local" },
                { path: "../outside.md", kind: "file", label: "Outside" },
              ],
            },
          }),
        },
      ],
      findings,
    );

    expect(findings).toEqual([]);
    expect(parsed?.explorer.favorites).toEqual([
      { path: "Characters/Ada.md", kind: "file", label: "Ada" },
    ]);
  });

  it("defaults favorites to empty when reading an older universe settings file", () => {
    const findings: ValidationFinding[] = [];
    const parsed = parseVaultAppearanceSettings(
      [
        {
          relativePath: VAULT_APPEARANCE_SETTINGS_PATH,
          content: JSON.stringify({ explorer: { activeSection: "allFiles" } }),
        },
      ],
      findings,
    );

    expect(findings).toEqual([]);
    expect(parsed?.explorer.favorites).toEqual([]);
  });

  it("flags invalid JSON instead of throwing", () => {
    const findings: ValidationFinding[] = [];
    const parsed = parseVaultAppearanceSettings(
      [{ relativePath: VAULT_APPEARANCE_SETTINGS_PATH, content: "{ not json" }],
      findings,
    );

    expect(parsed).toBeUndefined();
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      file: VAULT_APPEARANCE_SETTINGS_PATH,
      severity: "warning",
    });
  });

  it("lets a universe's stored appearance override the local/machine settings", () => {
    const local: AppSettingsV4 = {
      ...baseSettings(),
      theme: "worldnotion-light" as const,
      explorer: {
        ...baseSettings().explorer,
        favorites: [{ path: "Local.md", kind: "file", label: "Local" }],
      },
    };
    const findings: ValidationFinding[] = [];
    const stored = parseVaultAppearanceSettings(
      [
        {
          relativePath: VAULT_APPEARANCE_SETTINGS_PATH,
          content: serializeVaultAppearance(
            extractVaultAppearanceSettings({ ...local, theme: "one-dark-pro" }),
          ),
        },
      ],
      findings,
    );

    const merged = applyVaultAppearanceSettings(local, stored);

    expect(merged.theme).toBe("one-dark-pro");
    expect(merged.explorer.favorites).toEqual([{ path: "Local.md", kind: "file", label: "Local" }]);
    // Machine-scoped fields are untouched by the merge.
    expect(merged.recentUniverses).toBe(local.recentUniverses);
    expect(merged.sessions).toBe(local.sessions);
  });

  it("leaves settings untouched when there is nothing stored yet", () => {
    const local = baseSettings();
    expect(applyVaultAppearanceSettings(local, undefined)).toBe(local);
  });
});
