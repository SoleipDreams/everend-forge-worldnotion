import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_KEYBINDINGS } from "./editorTypes";
import { LEGACY_SETTINGS_KEY, SETTINGS_KEY, loadSettings, saveSettings } from "./settings";
import { createDefaultWorkspaceLayout, resizeDockSplit } from "./utils/workspaceLayout";

describe("settings persistence", () => {
  it("persists interface typography separately from document typography", () => {
    const before = loadSettings();
    saveSettings({ ...before, interfaceFont: "serif" });
    expect(loadSettings().interfaceFont).toBe("serif");
    expect(loadSettings().editor.writeFontFamily).toBe(before.editor.writeFontFamily);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ interfaceFont: "unknown" }));
    expect(loadSettings().interfaceFont).toBe("sans");
  });
  beforeEach(() => {
    localStorage.clear();
  });

  it("loads defaults when no settings exist", () => {
    const settings = loadSettings();

    expect(settings.theme).toBe("worldnotion-light");
    expect(settings.keybindings).toEqual(DEFAULT_KEYBINDINGS);
    expect(settings.recentUniverses).toEqual([]);
    expect(settings.explorer.ecosystemView).toBe("gallery");
    expect(settings.ambientBackground).toBe(true);
  });

  it("keeps a disabled atmosphere across saves and accepts older settings", () => {
    saveSettings({ ...loadSettings(), ambientBackground: false });
    expect(loadSettings().ambientBackground).toBe(false);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme: "github-dark" }));
    expect(loadSettings().ambientBackground).toBe(true);
  });

  it("persists each background scene independently of its enabled state", () => {
    for (const backgroundScene of ["original", "amber", "violet", "jade", "copper"]) {
      saveSettings({ ...loadSettings(), backgroundScene, ambientBackground: false });
      expect(loadSettings().backgroundScene).toBe(backgroundScene);
      expect(loadSettings().ambientBackground).toBe(false);
    }
    for (const backgroundScene of [undefined, "missing", 42, { scene: "amber" }]) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ backgroundScene }));
      expect(loadSettings().backgroundScene).toBe("original");
    }
  });

  it("persists the local ecosystem display preference and normalizes unknown views", () => {
    const settings = loadSettings();
    settings.explorer.ecosystemView = "list";
    saveSettings(settings);
    expect(loadSettings().explorer.ecosystemView).toBe("list");

    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ explorer: { ecosystemView: "unknown" } }));
    expect(loadSettings().explorer.ecosystemView).toBe("gallery");
  });

  it("migrates a legacy recent universe into the recent list", () => {
    localStorage.setItem(LEGACY_SETTINGS_KEY, JSON.stringify({ recentUniverse: "C:/Vault" }));

    expect(loadSettings().recentUniverses).toEqual(["C:/Vault"]);
  });

  it("defaults older settings to processed Writing without the retired syntax plugin", () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ theme: "worldnotion-light", recentUniverses: [] }),
    );

    const settings = loadSettings();

    expect(settings.editor.defaultMode).toBe("processed");
    expect(settings.plugins.enabled["ai-advisor"]).toBe(false);
    expect(settings.plugins.enabled["unity-adapter"]).toBe(false);
    expect(settings.aiAdvisor.activeProviderId).toBe("chatgpt");
    expect(settings.aiAdvisor.providers.length).toBeGreaterThanOrEqual(6);
  });

  it("migrates a disabled legacy syntax setting to visible structures", () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ editor: { hideMarkdownSyntaxInWrite: false } }),
    );

    expect(loadSettings().editor.defaultMode).toBe("semi");
  });

  it("uses the legacy plugin opt-out when settings disagree", () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        editor: { hideMarkdownSyntaxInWrite: true },
        plugins: { enabled: { "markdown-syntax-hiding": false } },
      }),
    );

    expect(loadSettings().editor.defaultMode).toBe("semi");
  });

  it("migrates legacy Write tabs to the matching per-tab Writing mode", () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        editor: { defaultMode: "write", writeStructureMode: "visible" },
        sessions: {
          "C:/Vault": {
            rootPath: "C:/Vault",
            tabs: [{ path: "Notes.md", title: "Notes", mode: "write", isTemplate: false }],
          },
        },
      }),
    );

    const settings = loadSettings();
    expect(settings.editor.defaultMode).toBe("semi");
    expect(settings.sessions["C:/Vault"].tabs[0].writingMode).toBe("semi");
  });

  it("migrates the legacy folder-note setting and defaults images out of All Files", () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ explorer: { ignoreFolderNoteMetadata: true } }),
    );

    const settings = loadSettings();
    expect(settings.explorer.folderNotesEnabled).toBe(false);
    expect(settings.explorer.showImagesInAllFiles).toBe(false);
  });

  it("persists simplified session state", () => {
    const settings = loadSettings();
    const layout = resizeDockSplit(
      createDefaultWorkspaceLayout([
        { path: "Notes/Mara.md", title: "Mara", mode: "write", modifiedMs: 1, isTemplate: false },
      ]),
      { splitId: "dock-root", ratio: 0.34 },
    );

    saveSettings({
      ...settings,
      sessions: {
        "C:/Vault": {
          rootPath: "C:/Vault",
          activePath: "Notes/Mara.md",
          tabs: [],
          layout,
          explorerExpandedPaths: ["Notes", "Notes/Cast"],
          editorState: {
            "Notes/Mara.md": {
              cursorPosition: { line: 4, column: 2 },
              scrollPosition: 12,
              foldedRanges: [],
              selection: undefined,
              lastModified: 100,
            },
          },
        },
      },
    });

    expect(
      JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}").sessions["C:/Vault"].editorState[
        "Notes/Mara.md"
      ],
    ).toMatchObject({
      cursorPosition: { line: 4, column: 2 },
      scrollPosition: 12,
    });
    expect(
      JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}").sessions["C:/Vault"].layout,
    ).toMatchObject({
      version: 2,
      activeGroupId: "dock-documents",
      root: {
        ratio: 0.34,
      },
    });
    expect(
      JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}").sessions["C:/Vault"]
        .explorerExpandedPaths,
    ).toEqual(["Notes", "Notes/Cast"]);
  });
});
