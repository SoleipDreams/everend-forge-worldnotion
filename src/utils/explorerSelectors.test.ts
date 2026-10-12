import { describe, expect, it } from "vitest";
import type { Entity, VaultIndex, VaultTreeNode } from "../domain";
import type { TaxonomyConfig } from "../editorTypes";
import {
  expandedPathsToDepth,
  explorerAncestorsForPath,
  flattenVisibleExplorerTree,
  selectEcosystemGroups,
  selectEntityTypeColors,
  selectEntityTagColors,
  selectFavoriteItems,
  selectImageTree,
  selectVisibleTree,
} from "./explorerSelectors";

function node(
  path: string,
  kind: VaultTreeNode["kind"],
  children: VaultTreeNode[] = [],
): VaultTreeNode {
  return {
    name: path.split("/").pop() ?? path,
    path,
    kind,
    children,
  };
}

function entity(id: string, path: string, tags: string[] = []): Entity {
  return {
    id,
    type: "concept",
    name: id,
    status: "draft",
    tags,
    aliases: [],
    childrenIds: [],
    customProperties: {},
    body: "",
    path,
    file: { relativePath: path, content: "" },
    wikilinks: [],
    backlinks: [],
  };
}

const taxonomyConfig: TaxonomyConfig = {
  version: "1.0",
  tags: {
    allowCustomTags: true,
    autoDetectSlashNotation: true,
    rootNodes: [
      {
        id: "cast",
        label: "cast",
        fullPath: "cast",
        color: "#ff0000",
        children: [
          {
            id: "cast-main",
            label: "main",
            fullPath: "cast/main",
            color: "#00ff00",
            children: [],
            parentId: "cast",
          },
        ],
      },
    ],
  },
  entityTypes: { definitions: [], defaultType: "concept", allowCustomTypes: true },
  statuses: { definitions: [], defaultStatus: "draft", allowCustomStatuses: true },
  customFields: { definitions: [] },
};

function index(overrides: Partial<VaultIndex> = {}): VaultIndex {
  const tree = [
    node("World", "folder", [
      node("World/Ada.md", "file"),
      node("World/Notes.md", "file"),
      node("World/Scenes", "folder", [node("World/Scenes/Arrival.md", "file")]),
    ]),
  ];
  return {
    rootPath: "Demo",
    files: [
      { relativePath: "World/Ada.md", content: "" },
      { relativePath: "World/Notes.md", content: "" },
      { relativePath: "World/Scenes/Arrival.md", content: "" },
      { relativePath: ".everend/universe.json", content: "{}" },
    ],
    directories: ["World", "World/Scenes", ".everend"],
    markdownFiles: [],
    templates: [],
    universes: [],
    tree,
    entities: [entity("ada", "World/Ada.md", ["cast/main"]), entity("notes", "World/Notes.md")],
    findings: [],
    readErrors: [],
    typeCounts: {},
    propertiesConfig: taxonomyConfig,
    ...overrides,
  };
}

describe("explorer selectors", () => {
  it("selects visible tree nodes and flattens search results as files before folders", () => {
    expect(selectVisibleTree(index(), "", false).map((item) => item.path)).toEqual(["World"]);

    const matches = selectVisibleTree(index(), "world", false);

    expect(matches.map((item) => item.path)).toEqual([
      "World/Ada.md",
      "World/Notes.md",
      "World/Scenes/Arrival.md",
      "World",
      "World/Scenes",
    ]);
    expect(matches.every((item) => item.children.length === 0)).toBe(true);
  });

  it("uses a focused folder as the visible root", () => {
    const focused = selectVisibleTree(index(), "", false, "World/Scenes");

    expect(focused.map((item) => item.path)).toEqual(["World/Scenes"]);
    expect(focused[0]?.children.map((item) => item.path)).toEqual(["World/Scenes/Arrival.md"]);
  });

  it("limits search results to the focused folder", () => {
    const matches = selectVisibleTree(index(), "ada", false, "World/Scenes");

    expect(matches).toEqual([]);
    expect(
      selectVisibleTree(index(), "arrival", false, "World/Scenes").map((item) => item.path),
    ).toEqual(["World/Scenes/Arrival.md"]);
  });

  it("falls back to the full tree if the focused folder does not exist", () => {
    expect(selectVisibleTree(index(), "", false, "Missing").map((item) => item.path)).toEqual([
      "World",
    ]);
  });

  it("includes hidden metadata only when requested", () => {
    expect(selectVisibleTree(index(), "", true).map((item) => item.path)).toEqual([
      ".everend",
      "World",
    ]);
  });

  it("can render folder notes as regular files when rebuilding the visible tree", () => {
    const withFolderNote = index({
      files: [
        {
          relativePath: "World.md",
          content:
            "---\nfolder: World\nid: world-folder\ntype: folder-description\nname: World\n---\n",
        },
        { relativePath: "World/Ada.md", content: "" },
      ],
      directories: ["World"],
    });

    const visible = selectVisibleTree(withFolderNote, "", true, undefined, false);

    expect(visible.map((item) => item.path)).toEqual(["World"]);
    expect(visible.find((item) => item.path === "World")?.hasDescription).toBeUndefined();
    expect(visible.find((item) => item.path === "World")?.children).toContainEqual(
      expect.objectContaining({ path: "World.md", isFolderDescription: true }),
    );
  });

  it("hides image-only folders from All Files and groups images in a dedicated tree", () => {
    const withImages = index({
      files: [
        { relativePath: "World/Ada.md", content: "" },
        { relativePath: ".everend/assets/image/hero.png", content: "", binary: true },
        { relativePath: "Art/maps/world.webp", content: "", binary: true },
      ],
      directories: ["World", ".everend", ".everend/assets", ".everend/assets/image", "Art", "Art/maps"],
    });

    expect(
      selectVisibleTree(withImages, "", false, undefined, true, true).map((item) => item.path),
    ).toEqual(["World"]);
    const imageTree = selectImageTree(withImages, "");
    expect(imageTree.map((item) => item.path)).toEqual([".everend", "Art"]);
    expect(imageTree[0].children?.[0]).toMatchObject({ path: ".everend/assets", children: [expect.objectContaining({ path: ".everend/assets/image" })] });
    expect(imageTree[1].children?.[0]).toMatchObject({ path: "Art/maps" });
    expect(selectImageTree(withImages, "hero").map((item) => item.path)).toEqual([
      ".everend/assets/image/hero.png",
    ]);
  });

  it("filters favorites to files and folders still present in the vault", () => {
    expect(
      selectFavoriteItems(index(), [
        { path: "World", kind: "folder", label: "World" },
        { path: "World/Ada.md", kind: "file", label: "Ada" },
        { path: "Missing", kind: "folder", label: "Missing" },
        { path: "Missing.md", kind: "file", label: "Missing" },
      ]),
    ).toEqual([
      { path: "World", kind: "folder", label: "World" },
      { path: "World/Ada.md", kind: "file", label: "Ada" },
    ]);
  });

  it("groups ecosystem entities by type regardless of their tags", () => {
    const groups = selectEcosystemGroups(
      index({
        entities: [
          { ...entity("ada", "World/Ada.md", ["cast/main"]), type: "character" },
          { ...entity("notes", "World/Notes.md", ["lore"]), type: "concept" },
          { ...entity("arrival", "World/Scenes/Arrival.md"), type: "character" },
        ],
      }),
    );

    expect(Array.from(groups.keys())).toEqual(["character", "concept"]);
    expect(groups.get("character")?.map((item) => item.id)).toEqual(["ada", "arrival"]);
    expect(groups.get("concept")?.map((item) => item.id)).toEqual(["notes"]);
  });

  it("selects registered type colors for ecosystem entities", () => {
    const withTypes = index({
      entities: [
        { ...entity("ada", "World/Ada.md"), type: "character" },
        { ...entity("notes", "World/Notes.md"), type: "custom-type" },
      ],
      propertiesConfig: {
        ...taxonomyConfig,
        entityTypes: {
          ...taxonomyConfig.entityTypes,
          definitions: [{ id: "character", label: "Character", color: "#3b82f6" }],
        },
      },
    });

    expect(Array.from(selectEntityTypeColors(withTypes).entries())).toEqual([
      ["World/Ada.md", "#3b82f6"],
    ]);
  });

  it("selects primary tag colors for entities", () => {
    expect(Array.from(selectEntityTagColors(index()).entries())).toEqual([
      ["World/Ada.md", "#00ff00"],
    ]);
  });

  it("flattens only expanded tree rows", () => {
    const rows = flattenVisibleExplorerTree(index().tree, new Set(["World"]));

    expect(rows.map((item) => [item.path, item.depth, item.isExpanded])).toEqual([
      ["World", 0, true],
      ["World/Ada.md", 1, false],
      ["World/Notes.md", 1, false],
      ["World/Scenes", 1, false],
    ]);
  });

  it("does not include children of collapsed folders", () => {
    expect(flattenVisibleExplorerTree(index().tree, new Set()).map((item) => item.path)).toEqual([
      "World",
    ]);
  });

  it("expands ancestors for an active path", () => {
    expect(explorerAncestorsForPath("World/Scenes/Arrival.md")).toEqual(["World", "World/Scenes"]);
  });

  it("expands folders to a fixed depth", () => {
    expect(Array.from(expandedPathsToDepth(index().tree, 1))).toEqual(["World"]);
    expect(Array.from(expandedPathsToDepth(index().tree, 2))).toEqual(["World", "World/Scenes"]);
  });
});
