import { parseFrontmatterDocument } from "../utils/frontmatterDocument";

export const VISUAL_DOCUMENT_KEY = "forgeView";

/** Also recognizes damaged envelopes, so repair/indexing cannot overwrite them. */
export function hasVisualDocumentMarker(markdown: string): boolean {
  if (!/^---\r?\n/.test(markdown)) return false;
  const closing = /^---[ \t]*\r?$/gm;
  closing.lastIndex = markdown.indexOf("\n") + 1;
  const closingFence = closing.exec(markdown);
  const end = closingFence?.index ?? markdown.length;
  const source = markdown.slice(0, end);
  // Valid YAML can quote or escape a root key (or use a flow mapping).
  const ast = closingFence ? parseFrontmatterDocument(`${source}---`) : undefined;
  if (ast) return ast.has(VISUAL_DOCUMENT_KEY);
  // A damaged envelope still belongs to the visual editor's source recovery.
  return /^(?:forgeView|'forgeView'|"forgeView")[ \t]*:/m.test(source);
}

export function isReservedVisualDocumentPath(path: readonly string[] | string): boolean {
  return (typeof path === "string" ? path : path[0] ?? "").split(".")[0] === VISUAL_DOCUMENT_KEY;
}
