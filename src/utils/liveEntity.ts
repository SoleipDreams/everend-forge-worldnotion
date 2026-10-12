import type { OpenTab } from "../editorTypes";
import { hasVisualDocumentMarker } from "../visualDocuments/marker";
import type { Entity, VaultFile, VaultIndex } from "../domain";
import { extractWikilinks, parseMarkdownFrontmatter, slugify } from "./markdownFrontmatter";

const LIVE_ENTITY_BASE_FIELDS = new Set([
  "id",
  "name",
  "type",
  "status",
  "tags",
  "aliases",
  "parentId",
  "childrenIds",
  "folder",
]);

function basenameWithoutExtension(path: string): string {
  return path.split("/").pop()?.replace(/\.md$/i, "") || "Untitled";
}

function listFromFrontmatter(value: unknown, fallback: string[] = []): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return fallback;
}

function extractVariants(data: Record<string, unknown>): import("../domain.js").Variant[] | undefined {
  const raw = data.variants;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const variants: import("../domain.js").Variant[] = [];
  Object.entries(raw).forEach(([id, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const item = value as Record<string, unknown>;
      const label = typeof item.label === "string" ? item.label.trim() : "";
      if (label && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) {
        variants.push({ id, label });
      }
    }
  });
  if (variants.length === 0) return undefined;
  return variants;
}

function customPropertiesFromFrontmatter(data: Record<string, unknown>) {
  const customProperties: Record<string, unknown> = {};
  Object.entries(data).forEach(([key, value]) => {
    if (!LIVE_ENTITY_BASE_FIELDS.has(key) && key !== "variants") {
      customProperties[key] = value;
    }
  });
  return customProperties;
}

function liveEntityFromTab(index: VaultIndex | undefined, tab: OpenTab): Entity | undefined {
  try {
    const parsed = parseMarkdownFrontmatter(tab.rawMarkdown);
    const fallbackName = basenameWithoutExtension(tab.path);
    const indexedFile = index?.markdownFiles.find((file) => file.relativePath === tab.path);
    const file: VaultFile = indexedFile ?? {
      relativePath: tab.path,
      absolutePath: tab.absolutePath,
      content: tab.rawMarkdown,
      modifiedMs: tab.modifiedMs,
    };

    return {
      id: String(parsed.data.id || slugify(fallbackName) || fallbackName),
      name: String(parsed.data.name || fallbackName),
      type: String(
        parsed.data.type || index?.propertiesConfig?.entityTypes.defaultType || "concept",
      ),
      status: String(
        parsed.data.status || index?.propertiesConfig?.statuses.defaultStatus || "draft",
      ),
      tags: listFromFrontmatter(parsed.data.tags),
      aliases: listFromFrontmatter(parsed.data.aliases),
      parentId: typeof parsed.data.parentId === "string" ? parsed.data.parentId : undefined,
      childrenIds: listFromFrontmatter(parsed.data.childrenIds),
      folder: typeof parsed.data.folder === "string" ? parsed.data.folder : undefined,
      variants: extractVariants(parsed.data),
      customProperties: customPropertiesFromFrontmatter(parsed.data),
      body: parsed.content,
      path: tab.path,
      file,
      wikilinks: extractWikilinks(parsed.content),
      backlinks: index?.entities.find((entity) => entity.path === tab.path)?.backlinks ?? [],
    };
  } catch {
    return undefined;
  }
}

export function selectLiveEntity(
  index: VaultIndex | undefined,
  selectedPath: string | undefined,
  tabs: OpenTab[],
): Entity | undefined {
  const indexEntity = index?.entities.find((entity) => entity.path === selectedPath);
  const activeTabForSelected = tabs.find((tab) => tab.path === selectedPath);
  if (hasVisualDocumentMarker(activeTabForSelected?.rawMarkdown ?? index?.markdownFiles.find(file => file.relativePath === selectedPath)?.content ?? "")) return undefined;

  if (!activeTabForSelected) {
    return indexEntity;
  }

  if (!indexEntity) {
    return liveEntityFromTab(index, activeTabForSelected);
  }

  try {
    const parsed = parseMarkdownFrontmatter(activeTabForSelected.rawMarkdown);

    return {
      ...indexEntity,
      id: String(parsed.data.id || indexEntity.id),
      name: String(parsed.data.name || indexEntity.name),
      type: String(parsed.data.type || indexEntity.type),
      status: String(parsed.data.status || indexEntity.status),
      tags: listFromFrontmatter(parsed.data.tags, indexEntity.tags),
      aliases: listFromFrontmatter(parsed.data.aliases, indexEntity.aliases),
      parentId:
        typeof parsed.data.parentId === "string" ? parsed.data.parentId : indexEntity.parentId,
      childrenIds: listFromFrontmatter(parsed.data.childrenIds, indexEntity.childrenIds),
      folder: typeof parsed.data.folder === "string" ? parsed.data.folder : indexEntity.folder,
      variants: extractVariants(parsed.data),
      customProperties: customPropertiesFromFrontmatter(parsed.data),
      body: parsed.content,
      wikilinks: extractWikilinks(parsed.content),
    };
  } catch {
    return indexEntity;
  }
}
