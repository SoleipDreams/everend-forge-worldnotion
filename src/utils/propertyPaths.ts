import type { PropertiesConfig, PropertyDefinition } from "../editorTypes";
import { isReservedVisualDocumentPath } from "../visualDocuments/marker";

export type PropertyPathEntry = {
  definition: PropertyDefinition;
  path: string[];
  parent?: PropertyDefinition;
};

export function isNestedPropertiesConfig(config?: PropertiesConfig): boolean {
  return config?.version === "3.0";
}

export function propertyDefinitionRoots(config?: PropertiesConfig): PropertyDefinition[] {
  if (!config) return [];
  return [
    ...(config.baseProperties?.definitions ?? []),
    ...(config.customFields.definitions ?? []),
  ];
}

export function listPropertyPathEntries(config?: PropertiesConfig): PropertyPathEntry[] {
  const entries: PropertyPathEntry[] = [];

  function visit(
    definitions: PropertyDefinition[],
    parentPath: string[],
    parent?: PropertyDefinition,
  ) {
    definitions.forEach((definition) => {
      const path = [...parentPath, definition.id];
      if (isReservedVisualDocumentPath(path)) return;
      entries.push({ definition, path, parent });
      if (definition.children?.length) visit(definition.children, path, definition);
    });
  }

  visit(propertyDefinitionRoots(config), []);
  return entries;
}

export function getPropertyPathEntry(
  config: PropertiesConfig | undefined,
  propertyId: string,
): PropertyPathEntry | undefined {
  return listPropertyPathEntries(config).find((entry) => entry.definition.id === propertyId);
}

/**
 * Returns the canonical YAML path for a property ID. Configurations before 3.0
 * intentionally remain flat until the user confirms their migration.
 */
export function getPropertyStoragePath(
  config: PropertiesConfig | undefined,
  propertyId: string,
): string[] {
  if (!isNestedPropertiesConfig(config)) return [propertyId];
  return (
    getPropertyPathEntry(config, propertyId)?.path ??
    (propertyId.includes(".") ? propertyId.split(".").filter(Boolean) : [propertyId])
  );
}

export function getValueAtPath(value: unknown, path: readonly string[]): unknown {
  let current = value;
  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function hasValueAtPath(value: unknown, path: readonly string[]): boolean {
  if (path.length === 0) return false;
  let current = value;
  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return false;
    if (!Object.prototype.hasOwnProperty.call(current, segment)) return false;
    current = (current as Record<string, unknown>)[segment];
  }
  return true;
}

export function getPropertyValue(
  frontmatter: Record<string, unknown>,
  config: PropertiesConfig | undefined,
  propertyId: string,
): unknown {
  return getValueAtPath(frontmatter, getPropertyStoragePath(config, propertyId));
}

export function getPropertyValuesById(
  frontmatter: Record<string, unknown>,
  config?: PropertiesConfig,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  listPropertyPathEntries(config).forEach(({ definition }) => {
    values[definition.id] = getPropertyValue(frontmatter, config, definition.id);
  });
  return values;
}
