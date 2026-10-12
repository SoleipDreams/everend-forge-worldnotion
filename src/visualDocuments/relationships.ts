import type { Entity } from "../domain";
import { resolveVisualReference } from "./references";
import type {
  RelationshipCanvas,
  RelationshipEdge,
  RelationshipTreeDocument,
  RelationshipType,
  TreeEndpoint,
  TreePoint,
  TreePort,
} from "./relationshipTypes";

export const PERSON_WIDTH = 132;
export const PERSON_HEIGHT = 140;
export const TREE_PORTS: TreePort[] = ["top", "right", "bottom", "left"];
export const DEFAULT_RELATIONSHIP_TYPES: RelationshipType[] = [
  { id: "parent", name: "Parent", icon: "↑" },
  { id: "child", name: "Child", icon: "↓" },
  { id: "partner", name: "Partner", icon: "♡" },
  { id: "ex", name: "Ex", icon: "×", style: "dashed" },
  { id: "sibling", name: "Sibling", icon: "↔" },
  { id: "half-sibling", name: "Half-sibling", icon: "↔", style: "dotted" },
  { id: "adopted", name: "Adopted", icon: "◇", style: "dashed" },
  { id: "step-parent", name: "Step-parent", icon: "↑", style: "dotted" },
  { id: "unnamed", name: "Unnamed" },
];
export function treeId() {
  return crypto.randomUUID();
}
export function createRelationshipCanvas(id = "main", name = "Main"): RelationshipCanvas {
  return { id, name, nodes: [], edges: [], annotations: [], groups: [], drawings: [] };
}
export function createRelationshipDocument(id: string = treeId()): RelationshipTreeDocument {
  return {
    version: 1,
    kind: "relationships",
    id,
    variants: { main: createRelationshipCanvas() },
    relationshipTypes: structuredClone(DEFAULT_RELATIONSHIP_TYPES),
  };
}
export function nodePortPoint(node: { x: number; y: number }, port: TreePort): TreePoint {
  switch (port) {
    case "top":
      return { x: node.x + PERSON_WIDTH / 2, y: node.y };
    case "bottom":
      return { x: node.x + PERSON_WIDTH / 2, y: node.y + PERSON_HEIGHT };
    case "left":
      return { x: node.x, y: node.y + PERSON_HEIGHT / 2 };
    case "right":
      return { x: node.x + PERSON_WIDTH, y: node.y + PERSON_HEIGHT / 2 };
  }
}
export function endpointPoint(
  canvas: RelationshipCanvas,
  endpoint: TreeEndpoint,
  seen = new Set<string>(),
): TreePoint | undefined {
  if (endpoint.kind === "node") {
    const node = canvas.nodes.find((candidate) => candidate.id === endpoint.nodeId);
    return node ? nodePortPoint(node, endpoint.port) : undefined;
  }
  if (seen.has(endpoint.edgeId)) return undefined;
  const edge = canvas.edges.find((candidate) => candidate.id === endpoint.edgeId);
  if (!edge) return undefined;
  const nextSeen = new Set([...seen, endpoint.edgeId]);
  const from = endpointPoint(canvas, edge.from, nextSeen),
    to = endpointPoint(canvas, edge.to, nextSeen);
  if (!from || !to) return undefined;
  const t = Math.min(1, Math.max(0, endpoint.t));
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}
export function junctionAt(
  canvas: RelationshipCanvas,
  edge: RelationshipEdge,
  point: TreePoint,
): TreeEndpoint | undefined {
  const from = endpointPoint(canvas, edge.from),
    to = endpointPoint(canvas, edge.to);
  if (!from || !to) return undefined;
  const dx = to.x - from.x,
    dy = to.y - from.y;
  const t = Math.min(
    0.98,
    Math.max(0.02, ((point.x - from.x) * dx + (point.y - from.y) * dy) / (dx * dx + dy * dy || 1)),
  );
  return { kind: "junction", edgeId: edge.id, t };
}
export function connectTree(
  canvas: RelationshipCanvas,
  from: TreeEndpoint,
  to: TreeEndpoint,
  typeId: string,
  id: string = treeId(),
): RelationshipCanvas {
  const edge: RelationshipEdge = { id, from, to, typeId };
  const next = { ...canvas, edges: [...canvas.edges, edge] };
  if (!endpointPoint(next, from) || !endpointPoint(next, to))
    throw new Error("Invalid or cyclic relationship endpoint.");
  return next;
}
/** A grouped move is one operation; a member explicitly selected too moves once. */
export function moveTreeSelection(
  canvas: RelationshipCanvas,
  selected: readonly string[],
  dx: number,
  dy: number,
): RelationshipCanvas {
  const ids = new Set([
    ...selected,
    ...canvas.groups
      .filter((group) => selected.includes(group.id))
      .flatMap((group) => group.nodeIds),
  ]);
  return {
    ...canvas,
    nodes: canvas.nodes.map((node) =>
      ids.has(node.id) ? { ...node, x: node.x + dx, y: node.y + dy } : node,
    ),
    annotations: canvas.annotations.map((note) =>
      ids.has(note.id) ? { ...note, x: note.x + dx, y: note.y + dy } : note,
    ),
    groups: canvas.groups.map((group) =>
      ids.has(group.id) ? { ...group, x: group.x + dx, y: group.y + dy } : group,
    ),
    drawings: canvas.drawings.map((drawing) =>
      ids.has(drawing.id)
        ? {
            ...drawing,
            points: drawing.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
          }
        : drawing,
    ),
  };
}
/** Remove dependent junctions together, leaving no dangling endpoint after undoable deletion. */
export function removeTreeSelection(
  canvas: RelationshipCanvas,
  ids: readonly string[],
): RelationshipCanvas {
  const removed = new Set(ids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of canvas.edges) {
      if (removed.has(edge.id)) continue;
      if (
        [edge.from, edge.to].some((end) =>
          removed.has(end.kind === "node" ? end.nodeId : end.edgeId),
        )
      ) {
        removed.add(edge.id);
        changed = true;
      }
    }
  }
  return {
    ...canvas,
    nodes: canvas.nodes.filter((item) => !removed.has(item.id)),
    edges: canvas.edges.filter((item) => !removed.has(item.id)),
    annotations: canvas.annotations.filter((item) => !removed.has(item.id)),
    drawings: canvas.drawings.filter((item) => !removed.has(item.id)),
    groups: canvas.groups
      .filter((item) => !removed.has(item.id))
      .map((group) => ({ ...group, nodeIds: group.nodeIds.filter((id) => !removed.has(id)) })),
  };
}
export function cloneTreeVariant(
  document: RelationshipTreeDocument,
  sourceId: string,
  id: string,
  name: string,
): RelationshipTreeDocument {
  if (document.variants[id]) throw new Error("Variant already exists.");
  const source = document.variants[sourceId];
  if (!source) throw new Error("Variant does not exist.");
  return {
    ...document,
    variants: { ...document.variants, [id]: { ...structuredClone(source), id, name } },
  };
}
export function resolveTreeReference(
  entities: Entity[],
  reference?: string,
): {
  entity?: Entity;
  variantId?: string;
  diagnostic?: "missing" | "ambiguous" | "missing-variant";
} {
  if (!reference) return {};
  const result = resolveVisualReference({ entities }, reference);
  return result.status === "resolved"
    ? { entity: result.entity, variantId: result.variantId }
    : { diagnostic: result.status };
}
export function treeBounds(canvas: RelationshipCanvas) {
  const boxes = [
    ...canvas.nodes.map((node) => ({
      x: node.x,
      y: node.y,
      width: PERSON_WIDTH,
      height: PERSON_HEIGHT,
    })),
    ...canvas.annotations.map((note) => ({
      x: note.x,
      y: note.y,
      width: note.width || 180,
      height: 100,
    })),
    ...canvas.groups,
    ...canvas.drawings.flatMap((drawing) =>
      drawing.points.map((point) => ({ ...point, width: 1, height: 1 })),
    ),
  ];
  if (!boxes.length) return { x: 0, y: 0, width: 500, height: 350 };
  const x = Math.min(...boxes.map((box) => box.x)),
    y = Math.min(...boxes.map((box) => box.y));
  return {
    x,
    y,
    width: Math.max(...boxes.map((box) => box.x + box.width)) - x,
    height: Math.max(...boxes.map((box) => box.y + box.height)) - y,
  };
}
