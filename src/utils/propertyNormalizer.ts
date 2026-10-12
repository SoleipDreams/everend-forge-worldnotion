import type { VaultFile } from "../domain";
import { hasVisualDocumentMarker } from "../visualDocuments/marker";
import type { PropertiesConfig, PropertyDefinition } from "../editorTypes";
import { joinMarkdown, slugify, splitMarkdown } from "./markdownFrontmatter";
import { isHiddenMetadata } from "./treeBuilder";
import {
  conditionIsActive,
  emptyPropertyValue,
  getConfiguredFrontmatterOrder,
  getFrontmatterPropertyValue,
  getFrontmatterPropertyValues,
  listVisibleProperties,
  parseFrontmatterRaw,
  updateFrontmatterProperties,
} from "./propertiesConfig";

/**
 * Universe-wide property normalization: for every note that already has valid
 * frontmatter, fill in missing core/required fields and reorder keys to the
 * schema order. Notes without frontmatter are the job of
 * planFrontmatterNormalization; invalid YAML is skipped (we never guess).
 */
export type PropertyNormalizationItem = {
  path: string;
  name: string;
  type: string;
  /** Field ids that will be added with default/empty values. */
  addedFields: string[];
  /** Whether existing keys will be reordered to match the schema. */
  reordered: boolean;
  nextContent: string;
  modifiedMs?: number | null;
};

export type PropertyNormalizationPlanInput = {
  files: VaultFile[];
  propertiesConfig: PropertiesConfig;
};

const CORE_FIELD_IDS = ["id", "type", "name", "status", "tags", "aliases"] as const;

function basenameWithoutExtension(path: string) {
  return path.split("/").pop()?.replace(/\.md$/i, "") ?? path;
}

/**
 * Flattens the visible property tree for a type into leaf definitions whose
 * visibleWhen conditions hold for the note's current values. Groups only
 * contribute their children.
 */
function collectActiveLeaves(
  definitions: PropertyDefinition[],
  values: Record<string, unknown>,
): PropertyDefinition[] {
  const leaves: PropertyDefinition[] = [];
  const visit = (property: PropertyDefinition) => {
    if (!conditionIsActive(property, values)) return;
    if (property.type !== "group") {
      leaves.push(property);
    }
    property.children?.forEach(visit);
  };
  definitions.forEach(visit);
  return leaves;
}

export function planPropertyNormalization({
  files,
  propertiesConfig,
}: PropertyNormalizationPlanInput): PropertyNormalizationItem[] {
  return files
    .filter((file) => file.relativePath.endsWith(".md"))
    .filter((file) => !hasVisualDocumentMarker(file.content))
    .filter((file) => !isHiddenMetadata(file.relativePath))
    .flatMap((file): PropertyNormalizationItem[] => {
      const { frontmatterRaw, bodyMarkdown } = splitMarkdown(file.content);
      if (!frontmatterRaw.trim()) return [];
      const data = parseFrontmatterRaw(frontmatterRaw);
      if (Object.keys(data).length === 0) return [];

      const name =
        typeof data.name === "string" && data.name.trim()
          ? data.name
          : basenameWithoutExtension(file.relativePath);
      const entityType =
        typeof data.type === "string" && data.type.trim()
          ? data.type
          : propertiesConfig.entityTypes.defaultType;

      const coreDefaults: Record<string, unknown> = {
        id: slugify(name) || "untitled",
        type: entityType,
        name,
        status: propertiesConfig.statuses.defaultStatus,
        tags: [],
        aliases: [],
      };

      const addedFields: string[] = [];
      const nextData: Record<string, unknown> = { ...data };
      CORE_FIELD_IDS.forEach((key) => {
        if (key in nextData) return;
        nextData[key] = coreDefaults[key];
        addedFields.push(key);
      });

      const values = {
        ...coreDefaults,
        ...getFrontmatterPropertyValues(data, propertiesConfig),
      };
      const activeLeaves = collectActiveLeaves(
        listVisibleProperties(propertiesConfig, entityType),
        values,
      );
      activeLeaves.forEach((leaf) => {
        if (CORE_FIELD_IDS.includes(leaf.id as (typeof CORE_FIELD_IDS)[number])) return;
        if (getFrontmatterPropertyValue(data, leaf.id, propertiesConfig) !== undefined) return;
        // Only auto-add fields the schema insists on; optional empty fields
        // would bloat every note in the universe.
        if (!leaf.required && leaf.defaultValue === undefined) return;
        nextData[leaf.id] = leaf.defaultValue ?? emptyPropertyValue(leaf.type);
        addedFields.push(leaf.id);
      });

      const expectedOrder = getConfiguredFrontmatterOrder(
        propertiesConfig,
        entityType,
        Object.keys(nextData),
      );
      const originalKeys = Object.keys(data);
      const expectedOriginalOrder = expectedOrder.filter((key) => originalKeys.includes(key));
      const reordered = originalKeys.some((key, index) => key !== expectedOriginalOrder[index]);

      if (addedFields.length === 0 && !reordered) return [];

      const propertyUpdates = Object.fromEntries(
        addedFields.map((fieldId) => [fieldId, nextData[fieldId]]),
      );
      const nextFrontmatter = updateFrontmatterProperties(
        frontmatterRaw,
        propertyUpdates,
        propertiesConfig,
        entityType,
      );
      return [
        {
          path: file.relativePath,
          name,
          type: entityType,
          addedFields,
          reordered,
          nextContent: joinMarkdown(nextFrontmatter, bodyMarkdown),
          modifiedMs: file.modifiedMs,
        },
      ];
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}
