import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DockTabRef, DocumentTabGroup } from "../editorTypes";
import {
  createDefaultWorkspaceLayout,
  documentDockTabId,
  panelDockTabId,
} from "../utils/workspaceLayout";
import { DockWorkspace } from "./DockWorkspace";

function renderDockWorkspace(options: {
  emptyDocuments?: boolean;
  paths?: string[];
  documentTabGroups?: DocumentTabGroup[];
} = {}) {
  const documentTabs = (options.emptyDocuments ? [] : (options.paths ?? ["A.md", "B.md"])).map(
    (path) => ({
      path,
      title: path.replace(/\.md$/, ""),
      mode: "write" as const,
      modifiedMs: 1,
      isTemplate: false,
    }),
  );
  const layout = createDefaultWorkspaceLayout(documentTabs);
  const handlers = {
    onSelectTab: vi.fn(),
    onCloseTab: vi.fn(),
    onTabContextMenu: vi.fn(),
    onGroupContextMenu: vi.fn(),
    onMoveTab: vi.fn(),
    onResizeSplit: vi.fn(),
    onOpenDocument: vi.fn(),
  };

  render(
    <DockWorkspace
      layout={layout}
      documentTabGroups={options.documentTabGroups}
      renderTab={(tab: DockTabRef) => <div data-testid="dock-panel">{tab.title}</div>}
      {...handlers}
    />,
  );

  return { layout, handlers };
}

function mockDockGroupRects() {
  const groups = [...document.querySelectorAll<HTMLElement>("[data-dock-group-id]")];
  for (const group of groups) {
    const rect =
      group.dataset.dockGroupId === "dock-explorer"
        ? { left: 0, top: 0, right: 220, bottom: 600, width: 220, height: 600 }
        : group.dataset.dockGroupId === "dock-tools"
          ? { left: 704, top: 0, right: 900, bottom: 600, width: 196, height: 600 }
          : { left: 224, top: 0, right: 700, bottom: 600, width: 476, height: 600 };
    group.getBoundingClientRect = vi.fn(() => ({
      ...rect,
      x: rect.left,
      y: rect.top,
      toJSON: () => rect,
    }));
    const bar = group.querySelector<HTMLElement>(".dock-tab-bar");
    const barRect = { left: rect.left, top: 0, right: rect.right, bottom: 40, width: rect.width, height: 40 };
    if (bar) bar.getBoundingClientRect = vi.fn(() => ({ ...barRect, x: barRect.left, y: barRect.top, toJSON: () => barRect }));
    const content = group.querySelector<HTMLElement>(".dock-group-content");
    const contentRect = { left: rect.left, top: 40, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height - 40 };
    if (content) content.getBoundingClientRect = vi.fn(() => ({ ...contentRect, x: contentRect.left, y: contentRect.top, toJSON: () => contentRect }));

    [...group.querySelectorAll<HTMLElement>(".dock-tab-document")].forEach((tab, index) => {
      const isGrouped = Boolean(tab.closest(".dock-document-tab-group"));
      const left = isGrouped ? 310 + index * 90 : 240 + index * 100;
      const tabRect = { left, top: 2, right: left + 92, bottom: 38, width: 92, height: 36 };
      tab.getBoundingClientRect = vi.fn(() => ({ ...tabRect, x: tabRect.left, y: tabRect.top, toJSON: () => tabRect }));
    });
    [...group.querySelectorAll<HTMLElement>(".dock-document-tab-group")].forEach((tabGroup) => {
      const groupRect = { left: 230, top: 1, right: 390, bottom: 39, width: 160, height: 38 };
      tabGroup.getBoundingClientRect = vi.fn(() => ({ ...groupRect, x: groupRect.left, y: groupRect.top, toJSON: () => groupRect }));
    });
  }
}

function pointerDrag(
  element: Element,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  fireEvent.pointerDown(element, { button: 0, pointerId: 1, clientX: from.x, clientY: from.y });
  fireEvent.pointerMove(window, { pointerId: 1, clientX: to.x, clientY: to.y });
  fireEvent.pointerUp(window, { pointerId: 1, clientX: to.x, clientY: to.y });
}

describe("DockWorkspace", () => {
  it("keeps the writing sheet visible when no document tab is open", () => {
    renderDockWorkspace({ emptyDocuments: true });

    expect(screen.getByText("Writing sheet")).toBeTruthy();
  });

  it("renders dock tabs and activates tabs on click", () => {
    const { handlers } = renderDockWorkspace();

    fireEvent.click(screen.getByText("B"));

    expect(screen.getAllByTestId("dock-panel").map((panel) => panel.textContent)).toContain("A");
    expect(handlers.onSelectTab).toHaveBeenCalledWith(
      expect.objectContaining({ id: documentDockTabId("B.md") }),
      "dock-documents",
    );
  });

  it("opens the document command from the tab add button", () => {
    const { handlers } = renderDockWorkspace();

    fireEvent.click(screen.getAllByTitle("Open note")[0]);

    expect(handlers.onOpenDocument).toHaveBeenCalledTimes(1);
  });

  it("routes document tab context menus to the app", () => {
    const { handlers } = renderDockWorkspace();

    fireEvent.contextMenu(screen.getAllByText("A")[0], { clientX: 120, clientY: 80 });

    expect(handlers.onTabContextMenu).toHaveBeenCalledWith(
      expect.objectContaining({ id: documentDockTabId("A.md") }),
      120,
      80,
    );
  });

  it("routes panel tab context menus to the dock group menu", () => {
    const { handlers } = renderDockWorkspace();

    fireEvent.contextMenu(screen.getByTitle("Inspector"), { clientX: 320, clientY: 44 });

    expect(handlers.onTabContextMenu).not.toHaveBeenCalled();
    expect(handlers.onGroupContextMenu).toHaveBeenCalledWith("dock-tools", 320, 44);
  });

  it("resizes splits from the keyboard", () => {
    const { handlers } = renderDockWorkspace();

    fireEvent.keyDown(screen.getAllByRole("separator")[0], { key: "ArrowRight" });

    expect(handlers.onResizeSplit).toHaveBeenCalledWith("dock-root", 0.25);
  });

  it("keeps document tabs anchored to the writing group during pointer drag", () => {
    const { handlers } = renderDockWorkspace();
    mockDockGroupRects();

    pointerDrag(screen.getByText("B").closest(".dock-tab")!, { x: 520, y: 18 }, { x: 110, y: 300 });

    expect(handlers.onMoveTab).not.toHaveBeenCalled();
  });

  it("previews document tab insertion without showing dock zones over the tab rail", () => {
    const { handlers } = renderDockWorkspace({ paths: ["A.md", "B.md", "C.md"] });
    mockDockGroupRects();
    const sourceTab = document.querySelector('[data-dock-tab-id="document:A.md"]')!;

    fireEvent.pointerDown(sourceTab, { button: 0, pointerId: 1, clientX: 260, clientY: 18 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 350, clientY: 18 });

    const targetTab = document.querySelector<HTMLElement>('[data-dock-tab-id="document:B.md"]');
    expect(targetTab?.classList.contains("is-drop-target")).toBe(true);
    expect(targetTab?.dataset.dropSide).toBe("before");
    expect(document.querySelector(".dock-drop-overlay")).toBeNull();

    fireEvent.pointerUp(window, { pointerId: 1, clientX: 350, clientY: 18 });

    expect(handlers.onMoveTab).toHaveBeenCalledWith(
      expect.objectContaining({
        tabId: documentDockTabId("A.md"),
        sourceGroupId: "dock-documents",
        targetGroupId: "dock-documents",
        position: "center",
        targetSide: "before",
        documentDrop: expect.objectContaining({ kind: "tab", targetPath: "B.md", side: "before" }),
      }),
    );
  });

  it("joins an existing named group when a document is dropped on its label", () => {
    const { handlers } = renderDockWorkspace({
      paths: ["A.md", "B.md", "C.md"],
      documentTabGroups: [
        { id: "lore", name: "Lore", color: "#4f8cff", collapsed: false, tabPaths: ["A.md", "B.md"] },
      ],
    });
    mockDockGroupRects();

    pointerDrag(screen.getByText("C").closest(".dock-tab")!, { x: 460, y: 18 }, { x: 250, y: 18 });

    expect(handlers.onMoveTab).toHaveBeenCalledWith(
      expect.objectContaining({
        tabId: documentDockTabId("C.md"),
        documentDrop: { kind: "group", targetDocumentGroupId: "lore" },
      }),
    );
  });

  it("previews insertion next to the nearest tab when dropping on tab-bar whitespace", () => {
    const { handlers } = renderDockWorkspace({ paths: ["A.md", "B.md", "C.md"] });
    mockDockGroupRects();
    const sourceTab = document.querySelector('[data-dock-tab-id="document:A.md"]')!;

    fireEvent.pointerDown(sourceTab, { button: 0, pointerId: 1, clientX: 260, clientY: 18 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 660, clientY: 18 });

    const lastTab = document.querySelector<HTMLElement>('[data-dock-tab-id="document:C.md"]');
    expect(lastTab?.classList.contains("is-drop-target")).toBe(true);
    expect(lastTab?.dataset.dropSide).toBe("after");
    expect(document.querySelector(".dock-drop-overlay")).toBeNull();

    fireEvent.pointerUp(window, { pointerId: 1, clientX: 660, clientY: 18 });

    expect(handlers.onMoveTab).toHaveBeenCalledWith(
      expect.objectContaining({
        targetTabId: documentDockTabId("C.md"),
        targetSide: "after",
        targetGroupId: "dock-documents",
        position: "center",
        documentDrop: expect.objectContaining({ kind: "tab", targetPath: "C.md", side: "after" }),
      }),
    );
  });

  it("shows dock zones when the pointer is over pane content", () => {
    renderDockWorkspace();
    mockDockGroupRects();
    const sourceTab = document.querySelector('[data-dock-tab-id="document:B.md"]')!;

    fireEvent.pointerDown(sourceTab, { button: 0, pointerId: 1, clientX: 340, clientY: 18 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 230, clientY: 300 });

    expect(document.querySelector(".dock-drop-overlay .dock-drop-left.is-target")).toBeTruthy();

    fireEvent.pointerUp(window, { pointerId: 1, clientX: 230, clientY: 300 });
  });

  it("splits a document pane only when the drop lands on its content edge", () => {
    const { handlers } = renderDockWorkspace();
    mockDockGroupRects();

    pointerDrag(screen.getByText("B").closest(".dock-tab")!, { x: 340, y: 18 }, { x: 230, y: 300 });

    expect(handlers.onMoveTab).toHaveBeenCalledWith(
      expect.objectContaining({
        tabId: documentDockTabId("B.md"),
        targetGroupId: "dock-documents",
        position: "left",
      }),
    );
  });

  it("moves a panel tab to the center of another group with pointer drag", () => {
    const { handlers } = renderDockWorkspace();
    mockDockGroupRects();

    pointerDrag(screen.getByTitle("Inspector"), { x: 760, y: 18 }, { x: 110, y: 300 });

    expect(handlers.onMoveTab).toHaveBeenCalledWith({
      tabId: panelDockTabId("inspector"),
      sourceGroupId: "dock-tools",
      targetGroupId: "dock-explorer",
      position: "center",
      targetTabId: undefined,
    });
  });

  it("splits a group when a dock tab is dragged to an edge zone", () => {
    const { handlers } = renderDockWorkspace();
    mockDockGroupRects();

    pointerDrag(screen.getByTitle("Inspector"), { x: 760, y: 18 }, { x: 8, y: 300 });

    expect(handlers.onMoveTab).toHaveBeenCalledWith({
      tabId: panelDockTabId("inspector"),
      sourceGroupId: "dock-tools",
      targetGroupId: "dock-explorer",
      position: "left",
      targetTabId: undefined,
    });
  });

  it("drags the active tab from the group header", () => {
    const { handlers } = renderDockWorkspace();
    mockDockGroupRects();

    pointerDrag(screen.getByTitle("Drag Inspector"), { x: 760, y: 18 }, { x: 110, y: 300 });

    expect(handlers.onMoveTab).toHaveBeenCalledWith({
      tabId: panelDockTabId("inspector"),
      sourceGroupId: "dock-tools",
      targetGroupId: "dock-explorer",
      position: "center",
      targetTabId: undefined,
    });
  });

  it("does not start docking from close or add buttons", () => {
    const { handlers } = renderDockWorkspace();
    mockDockGroupRects();

    pointerDrag(screen.getAllByTitle("Close tab")[0], { x: 560, y: 18 }, { x: 8, y: 300 });
    pointerDrag(screen.getAllByTitle("Open note")[0], { x: 880, y: 18 }, { x: 8, y: 300 });

    expect(handlers.onMoveTab).not.toHaveBeenCalled();
  });

  it("cancels an active dock drag with Escape", () => {
    const { handlers } = renderDockWorkspace();
    mockDockGroupRects();
    const tab = screen.getByText("B").closest(".dock-tab")!;

    fireEvent.pointerDown(tab, { button: 0, pointerId: 1, clientX: 520, clientY: 18 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 8, clientY: 300 });
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 8, clientY: 300 });

    expect(handlers.onMoveTab).not.toHaveBeenCalled();
  });
});
