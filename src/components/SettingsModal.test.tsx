import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_EDITOR_SETTINGS,
  DEFAULT_EXPLORER_SETTINGS,
  DEFAULT_GRAPH_SETTINGS,
  DEFAULT_KEYBINDINGS,
  DEFAULT_PLUGIN_SETTINGS,
  type AppSettingsV4,
} from "../editorTypes";
import { DEFAULT_AI_ADVISOR_SETTINGS } from "../utils/aiProviders";
import { createDefaultTaxonomyConfig } from "../domain";
import { SettingsModal } from "./SettingsModal";
import { DialogProvider } from "./DialogProvider";
import { UniverseDraftContext, UniverseDraftRegistry } from "../hooks/useUniverseDraft";

function appSettings(overrides: Partial<AppSettingsV4> = {}): AppSettingsV4 {
  return {
    theme: "worldnotion-light",
    recentUniverses: [],
    recentUniverseProfiles: {},
    editor: DEFAULT_EDITOR_SETTINGS,
    explorer: DEFAULT_EXPLORER_SETTINGS,
    graph: DEFAULT_GRAPH_SETTINGS,
    plugins: DEFAULT_PLUGIN_SETTINGS,
    aiAdvisor: DEFAULT_AI_ADVISOR_SETTINGS,
    keybindings: DEFAULT_KEYBINDINGS,
    sessions: {},
    ...overrides,
  };
}

describe("SettingsModal", () => {
  it("selects Everend Forge from standalone appearance settings", () => {
    const onChange = vi.fn();
    const settings = appSettings();
    render(
      <SettingsModal
        settings={settings}
        onChange={onChange}
        onClose={vi.fn()}
        initialSection="appearance-behavior"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Language and appearance" }));
    expect(screen.getByRole("option", { name: "Everend Forge Light" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Everend Forge Dark" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Active style"), { target: { value: "forge-mono-dark" } });
    expect(onChange).toHaveBeenCalledWith({ ...settings, theme: "forge-mono-dark" });
  });

  it("keeps manual customization drafts guarded while settings are hidden", () => {
    const drafts = new UniverseDraftRegistry();
    const view = (hidden: boolean) => (
      <UniverseDraftContext.Provider value={drafts}>
        <SettingsModal
          hidden={hidden}
          settings={appSettings()}
          universe={{
            name: "Demo",
            rootPath: "D:/Demo",
            fileCount: 0,
            entityCount: 0,
            templateCount: 0,
            hasEverendWorkspace: true,
          }}
          onChange={vi.fn()}
          onClose={vi.fn()}
          initialSection="overview"
        />
      </UniverseDraftContext.Provider>
    );
    const rendered = render(view(false));
    fireEvent.change(screen.getByLabelText("Universe name"), { target: { value: "Pending name" } });
    rendered.rerender(view(true));
    expect(screen.queryByRole("dialog", { name: "Settings" })).toBeNull();
    expect(drafts.hasDrafts()).toBe(true);
    rendered.rerender(view(false));
    expect(screen.getByLabelText("Universe name")).toHaveValue("Pending name");
    expect(drafts.hasDrafts()).toBe(true);
  });

  it("retains a guarded customization draft when saving fails", async () => {
    const drafts = new UniverseDraftRegistry();
    render(
      <UniverseDraftContext.Provider value={drafts}>
        <SettingsModal
          settings={appSettings()}
          universe={{
            name: "Demo",
            rootPath: "D:/Demo",
            fileCount: 0,
            entityCount: 0,
            templateCount: 0,
            hasEverendWorkspace: true,
          }}
          onChange={vi.fn()}
          onClose={vi.fn()}
          onSaveUniverseProfile={vi.fn().mockRejectedValue(new Error("Write failed"))}
          initialSection="overview"
        />
      </UniverseDraftContext.Provider>,
    );

    fireEvent.change(screen.getByLabelText("Universe name"), { target: { value: "New name" } });
    expect(drafts.hasDrafts()).toBe(true);
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Save" })),
    );
    expect(screen.getByRole("alert").textContent).toContain("Write failed");
    expect(screen.getByLabelText("Universe name")).toHaveValue("New name");
    expect(drafts.hasDrafts()).toBe(true);
  });

  it("keeps later customization edits dirty when an earlier save finishes", async () => {
    const drafts = new UniverseDraftRegistry();
    let finishSave!: () => void;
    const save = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishSave = resolve;
        }),
    );
    const universe = {
      name: "Demo",
      rootPath: "D:/Demo",
      fileCount: 0,
      entityCount: 0,
      templateCount: 0,
      hasEverendWorkspace: true,
    };
    const view = (name: string) => (
      <UniverseDraftContext.Provider value={drafts}>
        <SettingsModal
          settings={appSettings()}
          universe={{ ...universe, profile: { name } }}
          onChange={vi.fn()}
          onClose={vi.fn()}
          onSaveUniverseProfile={save}
          initialSection="overview"
        />
      </UniverseDraftContext.Provider>
    );
    const rendered = render(view("Demo"));
    fireEvent.change(screen.getByLabelText("Universe name"), { target: { value: "Saved name" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.change(screen.getByLabelText("Universe name"), { target: { value: "Later edit" } });
    await act(async () => {
      rendered.rerender(view("Saved name"));
      finishSave();
    });
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: "Saved name" }));
    expect(screen.getByLabelText("Universe name")).toHaveValue("Later edit");
    expect(drafts.hasDrafts()).toBe(true);
  });

  it("offers all three default modes without a duplicate structure setting", () => {
    const onChange = vi.fn();
    const settings = appSettings();

    render(<SettingsModal settings={settings} onChange={onChange} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Editor" }));
    expect(screen.queryByLabelText("Writing structures")).toBeNull();
    fireEvent.change(screen.getByLabelText("Default mode"), { target: { value: "semi" } });

    expect(onChange).toHaveBeenCalledWith({
      ...settings,
      editor: { ...settings.editor, defaultMode: "semi" },
    });
  });

  it("updates Explorer folder-note and image visibility settings", () => {
    const onChange = vi.fn();
    const settings = appSettings();

    render(<SettingsModal settings={settings} onChange={onChange} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Workspace" }));
    fireEvent.click(screen.getByLabelText("Enable folder notes"));

    expect(onChange).toHaveBeenCalledWith({
      ...settings,
      explorer: { ...settings.explorer, folderNotesEnabled: false },
    });
    fireEvent.click(screen.getByLabelText("Show images in All Files"));
    expect(onChange).toHaveBeenCalledWith({
      ...settings,
      explorer: { ...settings.explorer, showImagesInAllFiles: true },
    });
  });

  it("updates the dock tab scale from the tabs settings", () => {
    const onChange = vi.fn();
    const settings = appSettings();

    render(<SettingsModal settings={settings} onChange={onChange} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Workspace" }));
    fireEvent.change(screen.getByLabelText("Dock tab size"), { target: { value: "1.5" } });

    expect(onChange).toHaveBeenCalledWith({
      ...settings,
      editor: {
        ...settings.editor,
        dockTabScale: 1.5,
      },
    });
  });

  it("keeps universe properties out of settings", () => {
    render(
      <DialogProvider>
        <SettingsModal
          settings={appSettings()}
          universe={{
            name: "Demo",
            rootPath: "D:/Demo",
            fileCount: 1,
            entityCount: 1,
            templateCount: 0,
            hasEverendWorkspace: true,
            propertiesConfig: createDefaultTaxonomyConfig(),
          }}
          onChange={vi.fn()}
          onClose={vi.fn()}
          initialSection="appearance-behavior"
        />
      </DialogProvider>,
    );

    expect(screen.queryByRole("button", { name: /add property/i })).toBeNull();
    expect(screen.queryByText("Advanced Property Editor")).toBeNull();
  });

  it("shows the plugin manager and toggles optional plugins", () => {
    const onChange = vi.fn();
    const settings = appSettings();

    render(<SettingsModal settings={settings} onChange={onChange} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Plugins" }));

    expect(screen.getByText("Unity Adapter")).toBeInTheDocument();
    expect(screen.getAllByText("Planned").length).toBeGreaterThan(0);

    const fontToggle = screen.getAllByLabelText("Active", { selector: "input" })[0];
    fireEvent.click(fontToggle);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.objectContaining({
          enabled: expect.objectContaining({ "font-family-rendering": false }),
        }),
      }),
    );
  });
});
