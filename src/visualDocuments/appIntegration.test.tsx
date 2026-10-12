import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import type { SuiteChrome } from "../suiteChrome";
import type { VaultFile, VaultReadResult } from "../domain";
import { loadSettings, SETTINGS_KEY } from "../settings";
import { createRelationshipDocument } from "./relationships";
import { createVisualDocumentMarkdown, readVisualDocument } from "./markdown";
import { readVisualRecovery, visualRecoveryKey, writeVisualRecovery } from "./recovery";

const backend = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: backend.invoke,
  convertFileSrc: (path: string) => path,
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ onCloseRequested: async () => () => undefined }),
}));
vi.mock("../utils/useFonts", () => ({
  useFonts: () => ({ fonts: [], loading: false, error: null }),
}));
// The ordinary note editor is outside this regression. Keep the real visual
// editors, dock, session hook, save coordinator and App event handlers mounted.
vi.mock("../components/CodeMirrorEditor", () => ({
  CodeMirrorEditor: ({ value }: { value: string }) => (
    <div data-testid="ordinary-note">
      Ordinary note<pre>{value}</pre>
    </div>
  ),
}));

const root = "D:/visual-integration-fixture";
let files: VaultFile[];
let guard: (() => Promise<boolean>) | undefined;
let failSave = false;
let throwSave = false;
let failOtherSave = false;

function tree(path: string, name: string): VaultFile {
  const document = createRelationshipDocument(path);
  document.variants.main.nodes = [
    { id: "mara", name: "Mara", reference: "character:mara", x: 0, y: 0 },
  ];
  return {
    relativePath: path,
    absolutePath: `${root}/${path}`,
    modifiedMs: 10,
    content: createVisualDocumentMarkdown(name, document),
  };
}

function chrome(active = true): SuiteChrome {
  return {
    active,
    sharedUniversePath: root,
    renderAppSwitcher: () => null,
    registerUniverseSwitchGuard: (next) => {
      guard = next;
      return () => {
        guard = undefined;
      };
    },
  };
}

function activeTree() {
  return screen.getByRole("region", { name: "Relationship tree" });
}

function visualControls() {
  return within(activeTree().closest(".visual-document-shell") as HTMLElement);
}

function selectTab(container: HTMLElement, path: string) {
  fireEvent.click(container.querySelector(`[data-dock-tab-id="document:${path}"]`)!);
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  Object.defineProperty(window, "__TAURI_INTERNALS__", { value: {}, configurable: true });
  Object.defineProperty(window, "matchMedia", {
    value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
    configurable: true,
  });
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  files = [
    tree("Tree.md", "Family"),
    tree("Other.md", "Other"),
    {
      relativePath: "Mara.md",
      absolutePath: `${root}/Mara.md`,
      modifiedMs: 10,
      content:
        "---\nid: character:mara\ntype: character\nname: Mara\nstatus: draft\n---\n\n# Mara\n",
    },
  ];
  guard = undefined;
  failSave = false;
  throwSave = false;
  failOtherSave = false;
  const settings = loadSettings();
  settings.localePreference = "en";
  settings.editor.defaultMode = "processed";
  settings.sessions[root] = {
    rootPath: root,
    activePath: "Tree.md",
    tabs: ["Other.md", "Tree.md"].map((path) => ({
      path,
      title: path,
      mode: "write",
      writingMode: "processed",
      isTemplate: false,
    })),
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  localStorage.setItem(`worldnotion.onboarding.v1:${root}`, "dismissed");
  backend.invoke
    .mockReset()
    .mockImplementation(async (command: string, args: Record<string, unknown>) => {
      if (command === "index_vault")
        return {
          rootPath: root,
          files: structuredClone(files),
          directories: [".everend"],
          errors: [],
        } satisfies VaultReadResult;
      if (command === "read_explorer_icons") return { ok: true, content: "{}" };
      if (command === "save_file") {
        if (throwSave && args.path === `${root}/Tree.md`)
          throw new Error("Access denied (os error 5)");
        if (failSave && args.path === `${root}/Tree.md`)
          return { ok: false, message: "Conflict on fixture" };
        if (failOtherSave && args.path === `${root}/Other.md`)
          return { ok: false, message: "Other document failed" };
        const path = String(args.path).slice(root.length + 1);
        const existing = files.find((file) => file.relativePath === path);
        const modifiedMs = (existing?.modifiedMs ?? 0) + 1;
        const file = {
          relativePath: path,
          absolutePath: String(args.path),
          modifiedMs,
          content: String(args.content),
        };
        files = [...files.filter((file) => file.relativePath !== path), file];
        return { ok: true, path: args.path, modifiedMs };
      }
      throw new Error(`Unexpected fixture command ${command}`);
    });
});

describe("visual documents in the real workspace", () => {
  it("clears only explicitly discarded failed documents without a reload or save retry", async () => {
    const originals = files.map((file) => ({ path: file.relativePath, content: file.content }));
    const rendered = render(<App suiteChrome={chrome()} />);
    await screen.findByRole("region", { name: "Relationship tree" }, { timeout: 10000 });
    fireEvent.keyDown(within(activeTree()).getByRole("button", { name: "Mara" }), { key: "Enter" });
    fireEvent.click(within(activeTree()).getByRole("button", { name: "Open card alongside" }));
    await screen.findByTestId("ordinary-note");
    fireEvent.change(within(activeTree()).getByRole("textbox", { name: "Name" }), {
      target: { value: "Discard Tree" },
    });
    failSave = true;
    fireEvent.click(visualControls().getByRole("button", { name: /^Save/ }));
    await visualControls().findByRole("alert");
    selectTab(rendered.container, "Other.md");
    fireEvent.keyDown(within(activeTree()).getByRole("button", { name: "Mara" }), { key: "Enter" });
    fireEvent.change(within(activeTree()).getByRole("textbox", { name: "Name" }), {
      target: { value: "Discard Other" },
    });
    failOtherSave = true;
    fireEvent.click(visualControls().getByRole("button", { name: /^Save/ }));
    await visualControls().findByRole("alert");

    for (const path of ["Tree.md", "Other.md"]) {
      selectTab(rendered.container, path);
      const tab = rendered.container.querySelector(
        `[data-dock-tab-id="document:${path}"]`,
      ) as HTMLElement;
      fireEvent.click(within(tab).getByTitle("Close tab"));
      const discard = await screen.findByRole("alertdialog", { name: "Unsaved changes" });
      fireEvent.click(within(discard).getByRole("button", { name: "Discard" }));
      await waitFor(() =>
        expect(
          rendered.container.querySelector(`[data-dock-tab-id="document:${path}"]`),
        ).toBeNull(),
      );
      await act(async () => expect(await guard!()).toBe(path === "Other.md"));
    }
    expect(localStorage.getItem(visualRecoveryKey(root))).toBeNull();
    expect(
      files
        .filter((file) => file.relativePath === "Tree.md" || file.relativePath === "Other.md")
        .map((file) => ({ path: file.relativePath, content: file.content })),
    ).toEqual(originals.filter((file) => file.path === "Tree.md" || file.path === "Other.md"));
    expect(screen.getByTestId("ordinary-note").closest(".editor-shell")).not.toHaveTextContent(
      /Conflict on fixture|Other document failed/,
    );
  });

  it("offers authored recovery after remount, blocks hidden navigation and saves only after explicit restoration", async () => {
    const first = render(<App suiteChrome={chrome()} />);
    await screen.findByRole("region", { name: "Relationship tree" }, { timeout: 10000 });
    fireEvent.keyDown(within(activeTree()).getByRole("button", { name: "Mara" }), { key: "Enter" });
    fireEvent.change(within(activeTree()).getByRole("textbox", { name: "Name" }), {
      target: { value: "Recovered guardian" },
    });
    expect(readVisualRecovery(root)["Tree.md"].rawMarkdown).toContain("Recovered guardian");
    selectTab(first.container, "Other.md");
    first.unmount();
    const second = render(<App suiteChrome={chrome()} />);
    await screen.findByRole("region", { name: "Relationship tree" }, { timeout: 10000 });
    selectTab(second.container, "Tree.md");
    const offer = second.container.querySelector('[data-visual-recovery="Tree.md"]') as HTMLElement;
    expect(offer).toHaveTextContent("Unsaved changes from an earlier session");
    expect(screen.queryByRole("button", { name: "Recovered guardian" })).toBeNull();
    expect(files[0].content).not.toContain("Recovered guardian");
    second.rerender(<App suiteChrome={chrome(false)} />);
    await act(async () => expect(await guard!()).toBe(false));
    second.rerender(<App suiteChrome={chrome()} />);
    fireEvent.click(within(offer).getByRole("button", { name: "Recover" }));
    await screen.findByRole("button", { name: "Recovered guardian" });
    await act(async () => expect(await guard!()).toBe(false));
    fireEvent.click(visualControls().getByRole("button", { name: /^Save/ }));
    await waitFor(() => expect(localStorage.getItem(visualRecoveryKey(root))).toBeNull());
    await act(async () => expect(await guard!()).toBe(true));
    expect(files.find((file) => file.relativePath === "Tree.md")!.content).toContain(
      "Recovered guardian",
    );
  });

  it("preserves both versions and requires explicit base confirmation before replacing an externally changed file", async () => {
    const base = files[0];
    const pending = base.content.replace("name: Mara", "name: Local guardian");
    writeVisualRecovery(root, {
      "Tree.md": {
        version: 1,
        path: "Tree.md",
        rawMarkdown: pending,
        savedMarkdown: base.content,
        modifiedMs: 10,
        updatedAt: 1,
      },
    });
    files[0] = {
      ...base,
      content: base.content.replace("name: Mara", "name: External guardian"),
      modifiedMs: 20,
    };
    const rendered = render(<App suiteChrome={chrome()} />);
    await screen.findByRole("button", { name: "Recover" }, { timeout: 10000 });
    expect(rendered.container.querySelector('[data-visual-recovery="Tree.md"]')).toHaveTextContent(
      "Conflict with the saved file",
    );
    fireEvent.click(screen.getByRole("button", { name: "Recover" }));
    await screen.findByRole("button", { name: "Local guardian" });
    fireEvent.click(visualControls().getByRole("button", { name: /^Save/ }));
    await visualControls().findByRole("alert");
    expect(
      backend.invoke.mock.calls.filter(
        ([command, args]) => command === "save_file" && args.path === `${root}/Tree.md`,
      ),
    ).toHaveLength(0);
    expect(files[0].content).toContain("External guardian");
    expect(readVisualRecovery(root)["Tree.md"].rawMarkdown).toContain("Local guardian");
    fireEvent.click(screen.getByRole("button", { name: "Use saved file as base" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Confirm new base" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Use new base" }));
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog", { name: "Confirm new base" })).toBeNull(),
    );
    expect(files[0].content).toContain("External guardian");
    fireEvent.click(visualControls().getByRole("button", { name: /^Save/ }));
    await waitFor(() => expect(localStorage.getItem(visualRecoveryKey(root))).toBeNull());
    expect(files.find((file) => file.relativePath === "Tree.md")!.content).toContain(
      "Local guardian",
    );
  });

  it("retains a recovery without an open tab, explicitly discards it, and restores unsupported data in Source", async () => {
    const base = files[0];
    const unsupported = base.content.replace("version: 1", "version: 99");
    writeVisualRecovery(root, {
      "Tree.md": {
        version: 1,
        path: "Tree.md",
        rawMarkdown: unsupported,
        savedMarkdown: base.content,
        modifiedMs: 10,
        updatedAt: 1,
      },
    });
    const settings = loadSettings();
    settings.sessions[root].tabs = settings.sessions[root].tabs.filter(
      (tab) => tab.path !== "Tree.md",
    );
    settings.sessions[root].activePath = "Other.md";
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    const rendered = render(<App suiteChrome={chrome()} />);
    await screen.findByRole("button", { name: "Open recovery: Tree.md" }, { timeout: 10000 });
    await act(async () => expect(await guard!()).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Open recovery: Tree.md" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard local copy" }));
    const discard = await screen.findByRole("alertdialog", { name: "Discard recovery" });
    fireEvent.click(within(discard).getByRole("button", { name: "Cancel" }));
    expect(readVisualRecovery(root)["Tree.md"].rawMarkdown).toContain("version: 99");
    fireEvent.click(screen.getByRole("button", { name: "Recover" }));
    await screen.findByTestId("ordinary-note");
    expect(screen.getByTestId("ordinary-note")).toHaveTextContent("version: 99");
    expect(readVisualRecovery(root)["Tree.md"].rawMarkdown).toBe(unsupported);
    rendered.unmount();
    render(<App suiteChrome={chrome()} />);
    await screen.findByRole("button", { name: "Discard local copy" }, { timeout: 10000 });
    fireEvent.click(screen.getByRole("button", { name: "Discard local copy" }));
    const finalDiscard = await screen.findByRole("alertdialog", { name: "Discard recovery" });
    fireEvent.click(within(finalDiscard).getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(localStorage.getItem(visualRecoveryKey(root))).toBeNull());
    expect(files[0].content).toBe(base.content);
  });

  it.each(["rejected write", "conflict result"])(
    "keeps a %s in its own pane and retries without losing the draft",
    async (failure) => {
      const rendered = render(<App suiteChrome={chrome()} />);
      await screen.findByRole("region", { name: "Relationship tree" }, { timeout: 10000 });
      fireEvent.keyDown(within(activeTree()).getByRole("button", { name: "Mara" }), {
        key: "Enter",
      });
      fireEvent.click(within(activeTree()).getByRole("button", { name: "Open card alongside" }));
      const ordinary = await screen.findByTestId("ordinary-note");
      const neighbor = ordinary.closest(".editor-shell") as HTMLElement;
      fireEvent.change(within(activeTree()).getByRole("textbox", { name: "Name" }), {
        target: { value: "Pending tree edit" },
      });
      throwSave = failure === "rejected write";
      failSave = failure === "conflict result";
      fireEvent.click(visualControls().getByRole("button", { name: /^Save/ }));
      const error = await visualControls().findByRole("alert");
      expect(error).toHaveTextContent("Save failed: Tree.md");
      expect(error).toHaveTextContent(
        failure === "rejected write" ? "Access denied (os error 5)" : "Conflict on fixture",
      );
      expect(within(neighbor).queryByRole("alert")).toBeNull();
      expect(neighbor).not.toHaveTextContent(/Access denied|Conflict on fixture/);
      expect(within(activeTree()).getByRole("textbox", { name: "Name" })).toHaveValue(
        "Pending tree edit",
      );
      expect(
        rendered.container.querySelector(
          '[data-dock-tab-id="document:Tree.md"] [aria-label="Unsaved changes"]',
        ),
      ).toBeInTheDocument();
      await act(async () => expect(await guard!()).toBe(false));
      throwSave = false;
      failSave = false;
      fireEvent.click(within(error).getByRole("button", { name: "Retry" }));
      await waitFor(() => expect(visualControls().queryByRole("alert")).toBeNull());
      await act(async () => expect(await guard!()).toBe(true));
      const saved = readVisualDocument(
        files.find((file) => file.relativePath === "Tree.md")!.content,
      );
      expect(
        saved.status === "supported" &&
          saved.document.kind === "relationships" &&
          saved.document.variants.main.nodes[0].name,
      ).toBe("Pending tree edit");
      expect(within(activeTree()).getByRole("textbox", { name: "Name" })).toHaveValue(
        "Pending tree edit",
      );
      expect(within(neighbor).queryByRole("alert")).toBeNull();
    },
  );

  it("localizes visual controls and source recovery in Spanish", async () => {
    files[0].content = files[0].content.replace("version: 1", "version: 99");
    const settings = loadSettings();
    settings.localePreference = "es";
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    render(<App suiteChrome={chrome()} />);
    await screen.findByRole(
      "heading",
      { name: "Fuente del documento conservada" },
      { timeout: 10000 },
    );
    for (const name of ["Escritura", "Fuente", "Deshacer", "Rehacer", "Guardar", "Abrir fuente"])
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
  });

  it("saves edit/undo/redo and opens a reference beside its originating canvas", async () => {
    const rendered = render(<App suiteChrome={chrome()} />);
    await screen.findByRole("region", { name: "Relationship tree" }, { timeout: 10000 });
    fireEvent.keyDown(within(activeTree()).getByRole("button", { name: "Mara" }), { key: "Enter" });
    fireEvent.change(within(activeTree()).getByRole("textbox", { name: "Name" }), {
      target: { value: "Mara local" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(within(activeTree()).getByRole("textbox", { name: "Name" })).toHaveValue("Mara");
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(within(activeTree()).getByRole("textbox", { name: "Name" })).toHaveValue("Mara local");
    fireEvent.click(visualControls().getByRole("button", { name: /^Save/ }));
    await waitFor(
      () => expect(visualControls().getByRole("button", { name: "Save" })).toBeInTheDocument(),
      { timeout: 10000 },
    );
    const saved = readVisualDocument(
      files.find((file) => file.relativePath === "Tree.md")!.content,
    );
    expect(
      saved.status === "supported" &&
        saved.document.kind === "relationships" &&
        saved.document.variants.main.nodes[0].name,
    ).toBe("Mara local");
    fireEvent.click(within(activeTree()).getByRole("button", { name: "Open card alongside" }));
    await screen.findByTestId("ordinary-note");
    expect(activeTree()).toBeInTheDocument();
    const writingPanes = Array.from(rendered.container.querySelectorAll(".dock-group")).filter(
      (group) => group.querySelector('[data-dock-tab-kind="document"]'),
    );
    expect(writingPanes).toHaveLength(2);
    expect(rendered.container.querySelector('[data-dock-tab-id="document:Tree.md"]')).toHaveClass(
      "active",
    );
    expect(rendered.container.querySelector('[data-dock-tab-id="document:Mara.md"]')).toHaveClass(
      "active",
    );
    selectTab(rendered.container, "Other.md");
    selectTab(rendered.container, "Tree.md");
    expect(within(activeTree()).getByRole("button", { name: "Mara local" })).toBeInTheDocument();
  });

  it("blocks failed saves and unmounted composer drafts without transferring drafts to another document", async () => {
    const rendered = render(<App suiteChrome={chrome()} />);
    await screen.findByRole("region", { name: "Relationship tree" }, { timeout: 10000 });
    fireEvent.change(within(activeTree()).getByRole("textbox", { name: "New variant" }), {
      target: { value: "Future draft" },
    });
    selectTab(rendered.container, "Other.md");
    expect(within(activeTree()).getByRole("textbox", { name: "New variant" })).toHaveValue("");
    await act(async () => expect(await guard!()).toBe(false));
    rendered.rerender(<App suiteChrome={chrome(false)} />);
    await act(async () => expect(await guard!()).toBe(false));
    rendered.rerender(<App suiteChrome={chrome()} />);
    selectTab(rendered.container, "Tree.md");
    expect(within(activeTree()).getByRole("textbox", { name: "New variant" })).toHaveValue(
      "Future draft",
    );
    const treeTab = rendered.container.querySelector('[data-dock-tab-id="document:Tree.md"]')!;
    fireEvent.click(within(treeTab as HTMLElement).getByTitle("Close tab"));
    expect(activeTree()).toBeInTheDocument();
    fireEvent.change(within(activeTree()).getByRole("textbox", { name: "New variant" }), {
      target: { value: "" },
    });
    fireEvent.keyDown(within(activeTree()).getByRole("button", { name: "Mara" }), { key: "Enter" });
    fireEvent.change(within(activeTree()).getByRole("textbox", { name: "Name" }), {
      target: { value: "Unsaved" },
    });
    failSave = true;
    fireEvent.click(visualControls().getByRole("button", { name: /^Save/ }));
    await act(async () => expect(await guard!()).toBe(false));
    expect(within(activeTree()).getByRole("textbox", { name: "Name" })).toHaveValue("Unsaved");
    failSave = false;
    fireEvent.click(visualControls().getByRole("button", { name: /^Save/ }));
    await act(async () => expect(await guard!()).toBe(true));
  });
});
