import type { Entity, VaultIndex } from "../domain";
import { parseEntityRef } from "../components/properties/fields/EntityRefUtils";

export function resolveVisualReference(index: Pick<VaultIndex, "entities"> | undefined, reference: string):
  | { status: "resolved"; entity: Entity; variantId?: string }
  | { status: "missing" | "ambiguous" | "missing-variant"; candidates: Entity[] } {
  const entities = index?.entities ?? [];
  const literal = reference.trim();
  const { entityId, variantId } = entities.some(entity => entity.id === literal || entity.path === literal)
    ? { entityId: literal, variantId: undefined }
    : parseEntityRef(reference);
  const key = entityId.trim();
  const byId = entities.filter(entity => entity.id === key);
  const byPath = entities.filter(entity => entity.path === key);
  const normalized = key.toLocaleLowerCase();
  const candidates = byId.length ? byId : byPath.length ? byPath : entities.filter(entity => [entity.name, ...entity.aliases].some(value => value.toLocaleLowerCase() === normalized));
  if (candidates.length !== 1) return { status: candidates.length ? "ambiguous" : "missing", candidates };
  if (variantId && variantId !== "base" && !candidates[0].variants?.some((variant) => variant.id === variantId)) return { status: "missing-variant", candidates };
  return { status: "resolved", entity: candidates[0], variantId };
}

/** Timeline links may also point at an ordinary note or another visual document. */
export function resolveVisualDocumentReference(index: Pick<VaultIndex, "entities" | "markdownFiles"> | undefined, reference: string):
  | { status: "resolved"; path: string; entity?: Entity; variantId?: string }
  | { status: "missing" | "ambiguous" | "missing-variant" } {
  const literalFiles = index?.markdownFiles.filter(file => file.relativePath === reference.trim()) ?? [];
  if (literalFiles.length > 1) return { status: "ambiguous" };
  if (literalFiles.length === 1 && !index?.entities.some(entity => entity.path === reference.trim())) return { status: "resolved", path: literalFiles[0].relativePath };
  const canon = resolveVisualReference(index, reference);
  if (canon.status === "resolved") return { ...canon, path: canon.entity.path };
  const { entityId, variantId } = parseEntityRef(reference);
  const files = index?.markdownFiles.filter(file => file.relativePath === entityId.trim()) ?? [];
  if (!files.length) return { status: canon.status };
  if (files.length !== 1) return { status: "ambiguous" };
  if (variantId && variantId !== "base") return { status: "missing-variant" };
  return { status: "resolved", path: files[0].relativePath };
}
