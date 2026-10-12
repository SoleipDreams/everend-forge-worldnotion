import { describe, expect, it } from "vitest";
import {
  cloneTreeVariant,
  connectTree,
  createRelationshipDocument,
  endpointPoint,
  removeTreeSelection,
  resolveTreeReference,
} from "./relationships";
import type { Entity } from "../domain";
describe("portable relationship canvases", () => {
  it("clones complete independent variants while preserving node identities and future fields", () => {
    const doc = createRelationshipDocument("tree");
    doc.variants.main.nodes.push({ id: "a", name: "A", x: 0, y: 0, future: { value: 3 } });
    const next = cloneTreeVariant(doc, "main", "past", "Past");
    next.variants.past.nodes[0].x = 90;
    expect(doc.variants.main.nodes[0].x).toBe(0);
    expect(next.variants.past.nodes[0].id).toBe("a");
    expect(next.variants.past.nodes[0].future).toEqual({ value: 3 });
  });
  it("resolves junctions and deletes dependent edges atomically without mutating the original", () => {
    let canvas = createRelationshipDocument().variants.main;
    canvas.nodes = ["a", "b", "c"].map((id, index) => ({ id, name: id, x: index * 200, y: 0 }));
    canvas = connectTree(
      canvas,
      { kind: "node", nodeId: "a", port: "right" },
      { kind: "node", nodeId: "b", port: "left" },
      "partner",
      "ab",
    );
    canvas = connectTree(
      canvas,
      { kind: "junction", edgeId: "ab", t: 0.5 },
      { kind: "node", nodeId: "c", port: "top" },
      "child",
      "abc",
    );
    expect(endpointPoint(canvas, canvas.edges[1].from)).toEqual({ x: 166, y: 70 });
    const next = removeTreeSelection(canvas, ["a"]);
    expect(next.edges).toEqual([]);
    expect(canvas.edges).toHaveLength(2);
    expect(next.nodes.map((node) => node.id)).toEqual(["b", "c"]);
  });
  it("keeps repeated canon references separate and diagnoses ambiguous and missing variant links", () => {
    const entity = {
      id: "a",
      path: "a.md",
      name: "A",
      aliases: [],
      variants: [{ id: "future", label: "Future" }],
    } as unknown as Entity;
    expect(resolveTreeReference([entity], "a@future").variantId).toBe("future");
    expect(resolveTreeReference([entity], "a@past").diagnostic).toBe("missing-variant");
    expect(resolveTreeReference([entity, { ...entity, path: "copy.md" }], "a").diagnostic).toBe(
      "ambiguous",
    );
    expect(resolveTreeReference([entity], "lost").diagnostic).toBe("missing");
  });
});
