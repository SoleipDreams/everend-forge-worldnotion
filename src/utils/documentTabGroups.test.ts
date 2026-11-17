import { describe, expect, it } from "vitest";
import type { DocumentTabGroup, OpenTab } from "../editorTypes";
import {
  createGroupFromTabs,
  groupDocumentTabs,
  moveDocumentTabInGroups,
  normalizeDocumentTabGroups,
} from "./documentTabGroups";
import {
  createDefaultWorkspaceLayout,
  documentGroupIdForPath,
  documentDockTabId,
  moveDockTab,
} from "./workspaceLayout";

function tab(path: string): OpenTab {
  return {
    path,
    title: path.replace(/\.md$/i, ""),
    absolutePath: `C:/vault/${path}`,
    rawMarkdown: "",
    savedMarkdown: "",
    dirty: false,
    mode: "write",
    writingMode: "processed",
    isTemplate: false,
  };
}

function group(id: string, tabPaths: string[]): DocumentTabGroup {
  return { id, name: "Lore", color: "#4f8cff", collapsed: false, tabPaths };
}

describe("document tab groups", () => {
  it("creates a group from multiple tabs and removes their previous memberships", () => {
    const groups = [group("old", ["A.md", "B.md"]), group("other", ["C.md", "D.md"])] as DocumentTabGroup[];
    const next = groupDocumentTabs(groups, ["B.md", "C.md"]);

    expect(next.map((item) => item.tabPaths)).toEqual([["A.md"], ["D.md"], ["B.md", "C.md"]]);
    expect(next[2]).toMatchObject({ name: "Group", collapsed: false, color: expect.any(String) });
  });

  it("uses a deterministic unique id for an equivalent new group", () => {
    expect(createGroupFromTabs(["B.md", "A.md"], [])).toMatchObject({
      id: createGroupFromTabs(["B.md", "A.md"], []).id,
      tabPaths: ["B.md", "A.md"],
    });
  });

  it("reorders a tab within its group before or after a target", () => {
    const current = [group("lore", ["A.md", "B.md", "C.md"])];

    expect(
      moveDocumentTabInGroups(current, {
        path: "C.md",
        targetPath: "A.md",
        targetGroupId: "lore",
        targetSide: "after",
      })[0].tabPaths,
    ).toEqual(["A.md", "C.md", "B.md"]);
    expect(
      moveDocumentTabInGroups(current, {
        path: "A.md",
        targetPath: "C.md",
        targetGroupId: "lore",
        targetSide: "after",
      })[0].tabPaths,
    ).toEqual(["B.md", "C.md", "A.md"]);
  });

  it("moves a tab into another group and removes empty groups", () => {
    const next = moveDocumentTabInGroups(
      [group("first", ["A.md"]), group("second", ["B.md", "C.md"])],
      { path: "A.md", targetPath: "C.md", targetGroupId: "second", targetSide: "after" },
    );

    expect(next).toEqual([group("second", ["B.md", "C.md", "A.md"])]);
  });

  it("ungroups a tab when it is moved to a pane without a named group", () => {
    expect(
      moveDocumentTabInGroups([group("lore", ["A.md", "B.md"])], {
        path: "B.md",
        targetGroupId: null,
      }),
    ).toEqual([group("lore", ["A.md"])]);
  });

  it("splits legacy groups by pane while preserving their label and color", () => {
    const tabs = [tab("A.md"), tab("B.md"), tab("C.md")];
    const layout = createDefaultWorkspaceLayout(tabs);
    const splitLayout = moveDockTab(layout, {
      tabId: documentDockTabId("C.md"),
      sourceGroupId: "dock-documents",
      targetGroupId: "dock-documents",
      position: "right",
    });
    const legacyGroup = group("legacy-lore", ["A.md", "B.md", "C.md"]);
    const normalized = normalizeDocumentTabGroups([legacyGroup], tabs, splitLayout);
    const leftPane = documentGroupIdForPath(splitLayout, "A.md");
    const rightPane = documentGroupIdForPath(splitLayout, "C.md");

    expect(normalized).toHaveLength(2);
    expect(normalized.map((item) => item.tabPaths)).toEqual([["A.md", "B.md"], ["C.md"]]);
    expect(normalized.every((item) => item.name === "Lore" && item.color === "#4f8cff")).toBe(true);
    expect(normalized[0].id).toBe("legacy-lore");
    expect(normalized[1].id).not.toBe(normalized[0].id);
    expect(documentGroupIdForPath(splitLayout, normalized[0].tabPaths[0])).toBe(leftPane);
    expect(documentGroupIdForPath(splitLayout, normalized[1].tabPaths[0])).toBe(rightPane);
  });
});
