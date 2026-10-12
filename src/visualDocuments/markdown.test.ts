import { describe, expect, it } from "vitest";
import { indexVault, type VaultFile } from "../domain";
import { createVisualDocumentMarkdown, readVisualDocument, writeVisualDocument } from "./markdown";
import { createRelationshipDocument } from "./relationships";
import { createTimelineDocument } from "./timelineTypes";
import { splitMarkdown } from "../utils/markdownFrontmatter";
import { listUnconfiguredProperties, parseFrontmatterRaw, reorderFrontmatter, updateFrontmatterProperties } from "../utils/propertiesConfig";
import { planFrontmatterNormalization } from "../utils/frontmatterNormalizer";
import { planPropertyNormalization } from "../utils/propertyNormalizer";
import { createDefaultTaxonomyConfig } from "../utils/taxonomyConfig";
import { planPropertyStructureMigration } from "../utils/propertyStructureMigration";
import { validatePropertyDefinition } from "../utils/propertyValidator";
import { resolveVariantFrontmatter, setVariantOverride } from "../utils/noteVariants";
import { selectLiveEntity } from "../utils/liveEntity";
import { createOpenTabFromFile, serializeWorkspaceSession } from "../utils/tabUtils";
import { markTabSaved, saveFilePayloadForTab } from "../utils/editorPersistence";

const file = (relativePath: string, content: string): VaultFile => ({ relativePath, content, absolutePath: `D:/fixture/${relativePath}`, modifiedMs: 10 });

describe("portable visual document storage", () => {
  it("recognizes quoted YAML keys and does not interpret body text as a document marker", () => {
    const raw = createVisualDocumentMarkdown("Tree", createRelationshipDocument());
    const quoted = [raw.replace("forgeView:", "'forgeView':"), raw.replace("forgeView:", '"forgeView":')];
    for (const content of quoted) {
      expect(readVisualDocument(content).status).toBe("supported");
      const files = [file("Tree.md", content)];
      expect(indexVault({ rootPath: "D:/fixture", files, directories: [], errors: [] }).entities).toHaveLength(0);
      expect(planFrontmatterNormalization({ rootPath: "D:/fixture", files, directories: [] })).toEqual([]);
    }
    expect(readVisualDocument("---\r\nname: Ordinary\r\n---\r\nforgeView: body text\r\n").status).toBe("none");
  });

  it("preserves alias-backed canvases as source instead of editing multiple variants through one anchor", () => {
    const tree = createRelationshipDocument("tree");
    tree.variants.main.nodes = [{ id: "a", name: "A", x: 0, y: 0 }];
    tree.variants.future = { ...structuredClone(tree.variants.main), id: "future", name: "Future", nodes: tree.variants.main.nodes };
    const source = createVisualDocumentMarkdown("Aliases", tree);
    expect(source).toMatch(/&a\d/);
    expect(readVisualDocument(source)).toMatchObject({ status: "invalid", message: expect.stringContaining("anchors and aliases") });
    expect(() => writeVisualDocument(source, tree)).toThrow(/anchors and aliases/);
    expect(indexVault({ rootPath: "D:/fixture", files: [file("Aliases.md", source)], directories: [], errors: [] }).entities).toHaveLength(0);
    expect(source).toContain("name: A");
  });

  it("preserves malformed optional fields and unsafe dates as source instead of mounting an editor", () => {
    const initial = createTimelineDocument();
    const item = { id: "a", kind: "event" as const, title: "A", start: "0", precision: "day" as const, tags: [] };
    const invalid = (document: unknown) => expect(readVisualDocument(createVisualDocumentMarkdown("Invalid", document as typeof initial)).status).toBe("invalid");
    invalid({ ...initial, items: [{ ...item, endPrecision: "century" }] });
    invalid({ ...initial, items: [{ ...item, lane: -1 }] });
    invalid({ ...initial, items: [{ ...item, reference: {} }] });
    invalid({ ...initial, items: [{ ...item, start: "9999999999999999999999999999999999" }] });
    invalid({ ...initial, views: [{ id: "v", name: "V", tags: [], kinds: ["unknown"] }] });
    invalid({ ...initial, views: [{ id: "v", name: "V", tags: [], kinds: [], range: { start: "2", end: "1" } }] });
    const tree = createRelationshipDocument();
    invalid({ ...tree, variants: { mismatched: tree.variants.main } });
    invalid({ ...tree, variants: { main: { ...tree.variants.main, nodes: [{ id: "a", name: "A", x: 0, y: 0, portrait: {} }] } } });
    invalid({ ...tree, variants: { main: { ...tree.variants.main, nodes: [{ id: "shared", name: "A", x: 0, y: 0 }], annotations: [{ id: "shared", kind: "note", text: "B", x: 0, y: 0 }] } } });
    expect(readVisualDocument("---\nforgeView: *missing\n---\n").status).toBe("invalid");
  });

  it("keeps standalone visual documents discoverable without canon entity errors", () => {
    const tree = file("Trees/Family.md", createVisualDocumentMarkdown("Family", createRelationshipDocument()));
    const timeline = file("Timeline.md", createVisualDocumentMarkdown("History", createTimelineDocument()));
    const hero = file("Hero.md", "---\nid: hero\ntype: character\nname: Hero\nstatus: draft\n---\n");
    const index = indexVault({ rootPath: "D:/fixture", files: [tree, timeline, hero], directories: ["Trees"], errors: [] });
    expect(index.visualDocuments?.map(document => document.kind)).toEqual(["relationships", "timeline"]);
    expect(index.entities.map(entity => entity.id)).toEqual(["hero"]);
    expect(index.findings).toEqual([]);
    expect(index.markdownFiles).toHaveLength(3);
    expect(selectLiveEntity(index, tree.relativePath, [createOpenTabFromFile(tree, "write")])).toBeUndefined();
  });

  it("moves and reorders ID arrays without losing YAML comments, foreign fields or the body", () => {
    const document = createRelationshipDocument("tree");
    document.variants.main.nodes = [
      { id: "a", name: "A", x: 10, y: 20, futureNodeField: { secret: "keep" } },
      { id: "b", name: "B", x: 30, y: 40 },
    ];
    document.futureExtension = { enabled: true };
    const raw = (createVisualDocumentMarkdown("Family", document).replace("x: 10", "x: 10 # position comment").replace("name: A", "name: A # card comment") + "# Notes\n\nKeep this body.\n").replace(/\n/g, "\r\n");
    const parsed = readVisualDocument(raw);
    expect(parsed.status).toBe("supported");
    if (parsed.status !== "supported" || parsed.document.kind !== "relationships") throw new Error("fixture");
    const next = structuredClone(parsed.document);
    next.variants.main.nodes = [next.variants.main.nodes[1], { ...next.variants.main.nodes[0], x: 77 }];
    delete next.futureExtension;
    delete next.variants.main.nodes[1].futureNodeField;
    const updated = writeVisualDocument(raw, next);
    expect(updated).toContain("x: 77 # position comment");
    expect(updated).toContain("name: A # card comment");
    expect(updated).toContain("futureNodeField:");
    expect(updated).toContain("futureExtension:");
    expect(updated.slice(updated.indexOf("# Notes"))).toBe(raw.slice(raw.indexOf("# Notes")));
    const result = readVisualDocument(updated);
    if (result.status !== "supported" || result.document.kind !== "relationships") throw new Error("fixture");
    expect(result.document.variants.main.nodes.map(node => node.id)).toEqual(["b", "a"]);
  });

  it("removes complete canvas variants while preserving unrelated metadata", () => {
    const document = createRelationshipDocument("tree");
    document.variants.future = { ...structuredClone(document.variants.main), id: "future", name: "Future" };
    const raw = createVisualDocumentMarkdown("Tree", document);
    delete document.variants.future;
    const result = readVisualDocument(writeVisualDocument(raw, document));
    expect(result.status === "supported" && result.document.kind === "relationships" && Object.keys(result.document.variants)).toEqual(["main"]);
  });

  it("preserves the block when editing and reordering ordinary metadata", () => {
    const raw = createVisualDocumentMarkdown("History", createTimelineDocument()).replace("kind: timeline", "kind: timeline # format comment");
    const parts = splitMarkdown(raw);
    const changed = updateFrontmatterProperties(parts.frontmatterRaw, { name: "Renamed" });
    const reordered = reorderFrontmatter(changed, ["name", "id", "forgeView"]);
    expect(reordered).toContain("kind: timeline # format comment");
    expect(parseFrontmatterRaw(reordered).forgeView).toEqual(parseFrontmatterRaw(parts.frontmatterRaw).forgeView);
    expect(listUnconfiguredProperties(parseFrontmatterRaw(reordered))).not.toEqual(expect.arrayContaining([expect.objectContaining({ key: "forgeView" })]));
  });

  it("protects the reserved namespace from properties and entity variants", () => {
    const raw = createVisualDocumentMarkdown("Tree", createRelationshipDocument());
    const parts = splitMarkdown(raw);
    expect(() => updateFrontmatterProperties(parts.frontmatterRaw, { "forgeView.nodes": [] })).toThrow(/reserved/);
    expect(validatePropertyDefinition({ id: "forgeView", label: "Oops", type: "group" })).toEqual(expect.arrayContaining([expect.objectContaining({ type: "invalid-configuration" })]));
    expect(() => setVariantOverride({ variants: { future: { label: "Future" } } }, undefined, "future", "forgeView.nodes", [])).toThrow();
    const base = parseFrontmatterRaw(parts.frontmatterRaw);
    expect(resolveVariantFrontmatter({ ...base, variants: { evil: { label: "Evil", overrides: { forgeView: { nodes: [] } } } } }, "evil").forgeView).toEqual(base.forgeView);
  });

  it("keeps unknown versions and damaged envelopes out of automatic repair/migration", () => {
    const raw = createVisualDocumentMarkdown("Tree", createRelationshipDocument());
    const future = raw.replace("version: 1", "version: 99");
    const damaged = "---\nname: Broken\nforgeView: [unclosed\n---\n# Body\n";
    expect(readVisualDocument(future).status).toBe("unsupported");
    expect(readVisualDocument(damaged).status).toBe("invalid");
    expect(() => writeVisualDocument(future, createRelationshipDocument())).toThrow(/preserved/);
    const files = [file("Future.md", future), file("Broken.md", damaged)];
    const config = createDefaultTaxonomyConfig();
    expect(planFrontmatterNormalization({ rootPath: "D:/fixture", files, directories: [] })).toEqual([]);
    expect(planPropertyNormalization({ files, propertiesConfig: config })).toEqual([]);
    expect(planPropertyStructureMigration(files, config).items).toEqual([]);
    expect(indexVault({ rootPath: "D:/fixture", files, directories: [], errors: [] }).entities).toEqual([]);
  });

  it("rejects malformed visual collections before an editor can mount", () => {
    const document = createRelationshipDocument();
    document.variants.main.nodes = [{ id: "bad", name: "Bad", x: NaN, y: 0 }];
    expect(readVisualDocument(createVisualDocumentMarkdown("Bad", document)).status).toBe("invalid");
    const timeline = createTimelineDocument();
    timeline.items.push({ id: "p", kind: "period", title: "Bad", start: "10", end: "9", tags: [], precision: "year" });
    expect(readVisualDocument(createVisualDocumentMarkdown("Bad", timeline)).status).toBe("invalid");
  });

  it("shares tab dirty, exact snapshot persistence and local session semantics", () => {
    const tree = createRelationshipDocument();
    const saved = createVisualDocumentMarkdown("Tree", tree);
    const tab = createOpenTabFromFile(file("Tree.md", saved), "write", undefined, "processed", "visual");
    tree.variants.main.nodes.push({ id: "a", name: "A", x: 10, y: 20 });
    const firstEdit = writeVisualDocument(saved, tree);
    tree.variants.main.nodes[0].x = 50;
    const secondEdit = writeVisualDocument(firstEdit, tree);
    const current = { ...tab, rawMarkdown: secondEdit, dirty: true };
    const afterFirstWrite = markTabSaved(current, 11, firstEdit);
    expect(afterFirstWrite.dirty).toBe(true);
    expect(afterFirstWrite.rawMarkdown).toBe(secondEdit);
    expect(saveFilePayloadForTab(afterFirstWrite)).toEqual({ path: "D:/fixture/Tree.md", content: secondEdit, expectedModifiedMs: 11 });
    const session = serializeWorkspaceSession("fixture", "Tree.md", [current]);
    expect(session.tabs[0].visualMode).toBe("visual");
    expect(session.tabs[0]).not.toHaveProperty("rawMarkdown");
    expect(saved).not.toContain("viewport");
  });
});
