import { isAlias, isMap, isNode, isSeq, visit } from "yaml";
import { parseFrontmatterDocument, frontmatterDocumentToRaw } from "../utils/frontmatterDocument";
import { splitMarkdown } from "../utils/markdownFrontmatter";
import { VISUAL_DOCUMENT_KEY, hasVisualDocumentMarker } from "./marker";
import type { VisualDocument, VisualDocumentKind } from "./types";
import { fromOrdinal, validateCalendar, type CalendarDefinition, type CalendarPrecision } from "./calendar";

export type VisualDocumentReadResult =
  | { status: "none" }
  | { status: "supported"; document: VisualDocument; id?: string; name?: string }
  | { status: "unsupported"; message: string; kind?: string }
  | { status: "invalid"; message: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown) => typeof value === "number" && Number.isFinite(value);
const point = (value: unknown) => isRecord(value) && finite(value.x) && finite(value.y);
const strings = (value: unknown) => Array.isArray(value) && value.every(item => typeof item === "string");
const collection = (value: unknown, valid: (value: Record<string, unknown>) => boolean) => Array.isArray(value) && value.every(item => isRecord(item) && typeof item.id === "string" && item.id.trim().length > 0 && valid(item)) && new Set(value.map(item => (item as Record<string, unknown>).id)).size === value.length;
const endpoint = (value: unknown) => isRecord(value) && (value.kind === "node" ? typeof value.nodeId === "string" && ["top", "right", "bottom", "left"].includes(String(value.port)) : value.kind === "junction" && typeof value.edgeId === "string" && finite(value.t) && Number(value.t) >= 0 && Number(value.t) <= 1);
const precision = (value: unknown) => ["year", "month", "day", "hour", "minute", "second"].includes(String(value));
const optionalStrings = (value: Record<string, unknown>, fields: string[]) => fields.every(field => value[field] === undefined || typeof value[field] === "string");
const ordinal = (value: unknown): value is string => typeof value === "string" && /^-?\d+$/.test(value);
const edgeStyle = (value: unknown) => value === undefined || ["solid", "dashed", "dotted"].includes(String(value));

export function readVisualDocument(markdown: string): VisualDocumentReadResult {
  if (!hasVisualDocumentMarker(markdown)) return { status: "none" };
  const ast = parseFrontmatterDocument(splitMarkdown(markdown).frontmatterRaw);
  if (!ast || !isMap(ast.contents)) return { status: "invalid", message: "Invalid document YAML. Open Source to repair it." };
  let sharedYaml = false;
  const payloadNode = ast.get(VISUAL_DOCUMENT_KEY, true);
  if (isNode(payloadNode)) visit(payloadNode, (_key, node) => {
    if (isAlias(node) || node && typeof node === "object" && "anchor" in node && node.anchor) sharedYaml = true;
  });
  // A canvas owns independent authored data. Patching an anchored object could
  // mutate another variant or even an extension outside forgeView on reopen.
  if (sharedYaml) return { status: "invalid", message: "Inline YAML anchors and aliases inside forgeView before visual editing. Source is preserved." };
  let data: Record<string, unknown>;
  try { data = ast.toJS() as Record<string, unknown>; }
  catch { return { status: "invalid", message: "Invalid document YAML aliases. Source is preserved." }; }
  const value: unknown = data[VISUAL_DOCUMENT_KEY];
  if (!isRecord(value)) return { status: "invalid", message: "forgeView must be an object." };
  if (value.version !== 1 || !["timeline", "relationships"].includes(String(value.kind))) {
    return { status: "unsupported", kind: typeof value.kind === "string" ? value.kind : undefined, message: "This document format is not supported. Its source is preserved." };
  }
  if (value.kind === "timeline" && (!isRecord(value.calendar) || !Array.isArray(value.items) || !Array.isArray(value.views))) {
    return { status: "invalid", message: "Timeline calendar, items and views are required." };
  }
  if (value.kind === "relationships" && !isRecord(value.variants)) {
    return { status: "invalid", message: "Relationship canvas variants are required." };
  }
  try {
    if (value.kind === "timeline") {
      const calendar = value.calendar as CalendarDefinition;
      const errors = validateCalendar(calendar);
      if (errors.length) return { status: "invalid", message: errors.join("; ") };
      if (!collection(value.items, item => typeof item.title === "string" && strings(item.tags) && precision(item.precision) && (item.endPrecision === undefined || precision(item.endPrecision)) && optionalStrings(item, ["description", "color", "icon", "reference", "image"]) && (item.lane === undefined || Number.isSafeInteger(item.lane) && Number(item.lane) >= 0)) || !collection(value.views, view => typeof view.name === "string" && strings(view.tags) && strings(view.kinds) && (view.kinds as string[]).every(kind => ["event", "period"].includes(kind)) && optionalStrings(view, ["search"]))) return { status: "invalid", message: "Invalid timeline collection." };
      for (const item of value.items as Record<string, unknown>[]) {
        if (!["event", "period"].includes(String(item.kind)) || !ordinal(item.start)) return { status: "invalid", message: "Invalid timeline item." };
        if ((item.kind === "period" || item.end !== undefined) && (!ordinal(item.end) || BigInt(item.end) < BigInt(item.start))) return { status: "invalid", message: "Invalid period interval." };
        // Date fields use exact safe civil years; malformed/extreme source stays
        // editable as Markdown rather than throwing while mounting the editor.
        fromOrdinal(calendar, item.start, item.precision as CalendarPrecision);
        if (ordinal(item.end)) fromOrdinal(calendar, item.end, (item.endPrecision ?? item.precision) as CalendarPrecision);
      }
      for (const view of value.views as Record<string, unknown>[]) if (view.range !== undefined) {
        if (!isRecord(view.range) || !ordinal(view.range.start) || !ordinal(view.range.end) || BigInt(view.range.end) < BigInt(view.range.start)) return { status: "invalid", message: "Invalid timeline view range." };
        fromOrdinal(calendar, view.range.start); fromOrdinal(calendar, view.range.end);
      }
    } else {
      if (typeof value.id !== "string" || !collection(value.relationshipTypes, type => typeof type.name === "string" && optionalStrings(type, ["icon", "color"]) && edgeStyle(type.style)) || Object.keys(value.variants as object).length === 0) return { status: "invalid", message: "Invalid relationship document." };
      for (const [variantId, canvas] of Object.entries(value.variants as Record<string, unknown>)) {
        if (!isRecord(canvas) || canvas.id !== variantId || typeof canvas.name !== "string" ||
          !collection(canvas.nodes, node => typeof node.name === "string" && point(node) && optionalStrings(node, ["reference", "portrait"]) && (node.deceased === undefined || typeof node.deceased === "boolean")) ||
          !collection(canvas.edges, edge => endpoint(edge.from) && endpoint(edge.to) && typeof edge.typeId === "string" && edgeStyle(edge.style) && optionalStrings(edge, ["label", "icon", "color"])) ||
          !collection(canvas.annotations, annotation => ["note", "text"].includes(String(annotation.kind)) && typeof annotation.text === "string" && point(annotation) && optionalStrings(annotation, ["color"]) && (annotation.width === undefined || finite(annotation.width) && Number(annotation.width) > 0)) ||
          !collection(canvas.groups, group => typeof group.name === "string" && strings(group.nodeIds) && point(group) && finite(group.width) && Number(group.width) > 0 && finite(group.height) && Number(group.height) > 0 && optionalStrings(group, ["color"])) ||
          !collection(canvas.drawings, drawing => Array.isArray(drawing.points) && drawing.points.every(point) && typeof drawing.color === "string" && finite(drawing.width) && Number(drawing.width) > 0)) return { status: "invalid", message: "Invalid relationship canvas." };
        const ids = ["nodes", "edges", "annotations", "groups", "drawings"].flatMap(key => (canvas[key] as { id: string }[]).map(item => item.id));
        if (new Set(ids).size !== ids.length) return { status: "invalid", message: "Canvas IDs must be unique across cards, connections, annotations, groups and drawings." };
      }
    }
    // Unknown extension fields are retained, but must remain portable data.
    JSON.stringify(value);
  } catch { return { status: "invalid", message: "Invalid document data. Source is preserved." }; }
  return {
    status: "supported",
    document: value as unknown as VisualDocument,
    id: typeof ast.get("id") === "string" ? String(ast.get("id")) : undefined,
    name: typeof ast.get("name") === "string" ? String(ast.get("name")) : undefined,
  };
}

/** Patch changed leaves only, retaining unknown keys and untouched YAML comments. */
function patchValue(ast: NonNullable<ReturnType<typeof parseFrontmatterDocument>>, path: (string | number)[], previous: unknown, next: unknown) {
  if (JSON.stringify(previous) === JSON.stringify(next)) return;
  if (next === undefined) { ast.deleteIn(path); return; }
  if (Array.isArray(previous) && Array.isArray(next)) {
    const seq = ast.getIn(path, true);
    if (isSeq(seq) && previous.every(item => isRecord(item) && typeof item.id === "string") && next.every(item => isRecord(item) && typeof item.id === "string")) {
      const oldValues = new Map(previous.map(item => [item.id, item]));
      const oldNodes = new Map(previous.map((item, index) => [item.id, seq.items[index]]));
      seq.items = next.map(item => oldNodes.get(item.id) ?? ast.createNode(item));
      next.forEach((item, index) => { const before = oldValues.get(item.id); if (before) patchValue(ast, [...path, index], before, item); });
      return;
    }
  }
  if (isRecord(previous) && isRecord(next)) {
    for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) {
      if (!(key in next)) { if (KNOWN_FIELDS.has(key) || path.at(-1) === "variants") ast.deleteIn([...path, key]); }
      else patchValue(ast, [...path, key], previous[key], next[key]);
    }
  } else ast.setIn(path, next);
}

const KNOWN_FIELDS = new Set(["version", "kind", "id", "name", "calendar", "items", "views", "variants", "relationshipTypes", "nodes", "edges", "annotations", "groups", "drawings", "reference", "portrait", "deceased", "x", "y", "from", "to", "typeId", "label", "icon", "color", "style", "nodeId", "port", "edgeId", "t", "text", "width", "height", "nodeIds", "points", "title", "description", "start", "end", "precision", "endPrecision", "tags", "image", "lane", "search", "range", "leap", "negativeYearSuffix"]);

export function writeVisualDocument(markdown: string, document: VisualDocument): string {
  const current = readVisualDocument(markdown);
  if (current.status !== "supported") throw new Error(current.status === "none" ? "This file is not a visual document." : current.message);
  const parts = splitMarkdown(markdown);
  const ast = parseFrontmatterDocument(parts.frontmatterRaw)!;
  patchValue(ast, [VISUAL_DOCUMENT_KEY], current.document, document);
  const source = frontmatterDocumentToRaw(ast);
  // Keep the body and original separator unchanged, including CRLF.
  const match = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?=\r?\n|$)/.exec(markdown);
  if (!match) throw new Error("Document envelope is invalid.");
  const eol = markdown.includes("\r\n") ? "\r\n" : "\n";
  return source.replace(/\n/g, eol) + markdown.slice(match[0].length);
}

export function createVisualDocumentMarkdown(name: string, document: VisualDocument): string {
  const ast = parseFrontmatterDocument("---\nid: pending\nname: Untitled\n---")!;
  ast.set("id", crypto.randomUUID());
  ast.set("name", name);
  ast.set(VISUAL_DOCUMENT_KEY, document);
  return `${frontmatterDocumentToRaw(ast)}\n\n`;
}

export type IndexedVisualDocument = {
  path: string;
  kind?: VisualDocumentKind;
  name: string;
  result: Exclude<VisualDocumentReadResult, { status: "none" }>;
};
