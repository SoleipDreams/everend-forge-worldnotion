import type { PropertiesConfig } from "../editorTypes";
import { isReservedVisualDocumentPath } from "../visualDocuments/marker";
import { getPropertyStoragePath, getValueAtPath, hasValueAtPath } from "./propertyPaths";
import { updateFrontmatterProperties } from "./propertiesConfig";

export const BASE_VARIANT_ID = "base";
export const VARIANT_MARKER_OPEN =
  /<!--\s*everend:variant\s+id=(?:"([A-Za-z0-9][A-Za-z0-9._-]*)"|'([A-Za-z0-9][A-Za-z0-9._-]*)')\s*-->/g;
export const VARIANT_MARKER_CLOSE = /<!--\s*\/everend:variant\s*-->/g;

export type VariantRecord = { label: string; overrides?: Record<string, unknown> };
export type NoteVariants = Record<string, VariantRecord>;

export type VariantIssue = { message: string; from?: number; to?: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function merge(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const next = clone(base);
  Object.entries(patch).forEach(([key, value]) => {
    if (isRecord(value) && isRecord(next[key]))
      next[key] = merge(next[key] as Record<string, unknown>, value);
    else next[key] = clone(value);
  });
  return next;
}

function asVariantRecord(value: unknown): VariantRecord | undefined {
  if (!isRecord(value) || typeof value.label !== "string" || !value.label.trim()) return undefined;
  return {
    label: value.label.trim(),
    ...(isRecord(value.overrides) ? { overrides: clone(value.overrides) } : {}),
  };
}

/** Returns a normalized variant map. `base` is always present even for legacy notes. */
export function readNoteVariants(frontmatter: Record<string, unknown>): NoteVariants {
  const raw = frontmatter.variants;
  const result: NoteVariants = {};
  if (isRecord(raw)) {
    Object.entries(raw).forEach(([id, value]) => {
      const record = asVariantRecord(value);
      if (record) result[id] = record;
    });
  }
  result[BASE_VARIANT_ID] = { label: result[BASE_VARIANT_ID]?.label || "Base variant" };
  return result;
}

export function resolveVariantId(frontmatter: Record<string, unknown>, requested?: string): string {
  const variants = readNoteVariants(frontmatter);
  return requested && variants[requested] ? requested : BASE_VARIANT_ID;
}

/** Resolves metadata for the selected local variant without changing the raw source object. */
export function resolveVariantFrontmatter(
  frontmatter: Record<string, unknown>,
  variantId?: string,
): Record<string, unknown> {
  const selected = resolveVariantId(frontmatter, variantId);
  const base = clone(frontmatter);
  delete base.variants;
  if (selected === BASE_VARIANT_ID) return base;
  const overrides = readNoteVariants(frontmatter)[selected]?.overrides;
  if (!overrides) return base;
  const safeOverrides = { ...overrides };
  delete safeOverrides.forgeView;
  return merge(base, safeOverrides);
}

function slug(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "variant"
  );
}

export function addVariant(
  frontmatter: Record<string, unknown>,
  label: string,
): { variants: NoteVariants; id: string } {
  const normalizedLabel = label.trim();
  if (!normalizedLabel) throw new Error("Variant labels cannot be empty.");
  const variants = readNoteVariants(frontmatter);
  if (
    Object.values(variants).some(
      (item) => item.label.toLocaleLowerCase() === normalizedLabel.toLocaleLowerCase(),
    )
  ) {
    throw new Error("Variant labels must be unique within a note.");
  }
  const root = slug(normalizedLabel);
  let id = root;
  let suffix = 2;
  while (variants[id]) id = `${root}-${suffix++}`;
  variants[id] = { label: normalizedLabel };
  return { variants, id };
}

export function renameVariant(
  frontmatter: Record<string, unknown>,
  id: string,
  label: string,
): NoteVariants {
  const variants = readNoteVariants(frontmatter);
  const normalizedLabel = label.trim();
  if (!variants[id] || !normalizedLabel) throw new Error("Variant labels cannot be empty.");
  if (
    Object.entries(variants).some(
      ([otherId, item]) =>
        otherId !== id && item.label.toLocaleLowerCase() === normalizedLabel.toLocaleLowerCase(),
    )
  ) {
    throw new Error("Variant labels must be unique within a note.");
  }
  variants[id] = { ...variants[id], label: normalizedLabel };
  return variants;
}

export function deleteVariant(frontmatter: Record<string, unknown>, id: string): NoteVariants {
  if (id === BASE_VARIANT_ID) throw new Error("The base variant cannot be deleted.");
  const variants = readNoteVariants(frontmatter);
  delete variants[id];
  return variants;
}

function setAtPath(
  value: Record<string, unknown>,
  path: readonly string[],
  nextValue: unknown | undefined,
) {
  const [head, ...tail] = path;
  if (!head) return;
  if (!tail.length) {
    if (nextValue === undefined) delete value[head];
    else value[head] = clone(nextValue);
    return;
  }
  const child = isRecord(value[head]) ? clone(value[head]) : {};
  setAtPath(child, tail, nextValue);
  if (Object.keys(child).length) value[head] = child;
  else delete value[head];
}

export function hasVariantOverride(
  frontmatter: Record<string, unknown>,
  config: PropertiesConfig | undefined,
  variantId: string,
  propertyId: string,
) {
  if (variantId === BASE_VARIANT_ID) return false;
  const overrides = readNoteVariants(frontmatter)[variantId]?.overrides;
  return Boolean(
    overrides && hasValueAtPath(overrides, getPropertyStoragePath(config, propertyId)),
  );
}

export function setVariantOverride(
  frontmatter: Record<string, unknown>,
  config: PropertiesConfig | undefined,
  variantId: string,
  propertyId: string,
  value: unknown | undefined,
): NoteVariants {
  if (variantId === BASE_VARIANT_ID || ["id", "type", "variants"].includes(propertyId) || isReservedVisualDocumentPath(getPropertyStoragePath(config, propertyId))) {
    throw new Error("This property cannot be overridden by a variant.");
  }
  const variants = readNoteVariants(frontmatter);
  const variant = variants[variantId];
  if (!variant) throw new Error("Unknown variant.");
  const overrides = clone(variant.overrides ?? {});
  setAtPath(overrides, getPropertyStoragePath(config, propertyId), value);
  variants[variantId] = { ...variant, ...(Object.keys(overrides).length ? { overrides } : {}) };
  if (!Object.keys(overrides).length) delete variants[variantId].overrides;
  return variants;
}

export function variantPropertyValue(
  frontmatter: Record<string, unknown>,
  config: PropertiesConfig | undefined,
  variantId: string,
  propertyId: string,
) {
  return getValueAtPath(
    resolveVariantFrontmatter(frontmatter, variantId),
    getPropertyStoragePath(config, propertyId),
  );
}

export function updateVariantsInRawYaml(
  rawYaml: string,
  variants: NoteVariants,
  config?: PropertiesConfig,
  type?: string,
) {
  return updateFrontmatterProperties(rawYaml, { variants }, config, type);
}

export function removeVariantBlocks(markdown: string, variantId: string): string {
  const pattern = new RegExp(
    `\\n?<!--\\s*everend:variant\\s+id=(?:"${variantId}"|'${variantId}')\\s*-->[\\s\\S]*?<!--\\s*\\/everend:variant\\s*-->`,
    "g",
  );
  return markdown.replace(pattern, "");
}

export function validateVariantBlocks(markdown: string, variants: NoteVariants): VariantIssue[] {
  const issues: VariantIssue[] = [];
  const open = new RegExp(VARIANT_MARKER_OPEN.source, "g");
  let match: RegExpExecArray | null;
  while ((match = open.exec(markdown))) {
    const id = match[1] || match[2];
    const close = new RegExp(VARIANT_MARKER_CLOSE.source).exec(markdown.slice(open.lastIndex));
    if (!close) {
      issues.push({
        message: `Variant block ${id} is not closed.`,
        from: match.index,
        to: open.lastIndex,
      });
      break;
    }
    if (!variants[id])
      issues.push({
        message: `Variant block references unknown variant ${id}.`,
        from: match.index,
        to: open.lastIndex,
      });
    open.lastIndex += close.index + close[0].length;
  }
  return issues;
}

export function insertVariantBlock(markdown: string, variantId: string): string {
  return `${markdown.replace(/\s*$/, "")}\n\n<!-- everend:variant id="${variantId}" -->\n\n<!-- /everend:variant -->\n`;
}
