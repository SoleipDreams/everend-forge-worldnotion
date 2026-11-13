import type { EntityTypeDefinition, PropertiesConfig, PropertyDefinition } from "../editorTypes";
import { getPropertyPathEntry, getPropertyValue, listPropertyPathEntries } from "./propertyPaths";

export type PresentationRole = "portrait" | "cover";

export type PresentationIssue = {
  typeId: string;
  role: PresentationRole;
  propertyId: string;
  message: string;
};

export function getEntityTypeDefinition(
  config: PropertiesConfig | undefined,
  typeId: string | undefined,
): EntityTypeDefinition | undefined {
  return config?.entityTypes.definitions.find((definition) => definition.id === typeId);
}

export function propertyAppliesToEntityType(
  config: PropertiesConfig,
  propertyId: string,
  typeId: string,
): boolean {
  const entry = getPropertyPathEntry(config, propertyId);
  if (!entry) return false;

  let current: PropertyDefinition | undefined = entry.definition;
  let parent = entry.parent;
  while (current) {
    if (current.appliesTo && !current.appliesTo.includes(typeId)) return false;
    current = parent;
    parent = current ? getPropertyPathEntry(config, current.id)?.parent : undefined;
  }
  return true;
}

export function listPresentationImageProperties(
  config: PropertiesConfig,
  typeId: string,
): PropertyDefinition[] {
  return listPropertyPathEntries(config)
    .filter(
      (entry) =>
        entry.definition.type === "image" &&
        propertyAppliesToEntityType(config, entry.definition.id, typeId),
    )
    .map((entry) => entry.definition);
}

export function getPresentationRolePropertyId(
  config: PropertiesConfig | undefined,
  typeId: string | undefined,
  role: PresentationRole,
): string | undefined {
  const presentation = getEntityTypeDefinition(config, typeId)?.presentation;
  return role === "portrait" ? presentation?.portraitPropertyId : presentation?.coverPropertyId;
}

export function getPresentationRoleValue(
  config: PropertiesConfig | undefined,
  typeId: string | undefined,
  frontmatter: Record<string, unknown>,
  role: PresentationRole,
): string | undefined {
  const propertyId = getPresentationRolePropertyId(config, typeId, role);
  if (!propertyId) return undefined;
  const value = getPropertyValue(frontmatter, config, propertyId);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function validateEntityPresentations(config: PropertiesConfig): PresentationIssue[] {
  const issues: PresentationIssue[] = [];
  config.entityTypes.definitions.forEach((type) => {
    const roles: Array<[PresentationRole, string | undefined]> = [
      ["portrait", type.presentation?.portraitPropertyId],
      ["cover", type.presentation?.coverPropertyId],
    ];
    roles.forEach(([role, propertyId]) => {
      if (!propertyId) return;
      const property = getPropertyPathEntry(config, propertyId)?.definition;
      if (!property) {
        issues.push({
          typeId: type.id,
          role,
          propertyId,
          message: `${type.label} ${role} references missing property ${propertyId}.`,
        });
      } else if (property.type !== "image") {
        issues.push({
          typeId: type.id,
          role,
          propertyId,
          message: `${type.label} ${role} must reference an image property.`,
        });
      } else if (!propertyAppliesToEntityType(config, propertyId, type.id)) {
        issues.push({
          typeId: type.id,
          role,
          propertyId,
          message: `${type.label} ${role} must reference a property available to ${type.label}.`,
        });
      }
    });
  });
  return issues;
}

export function updateEntityTypePresentation(
  config: PropertiesConfig,
  typeId: string,
  role: PresentationRole,
  propertyId: string | undefined,
): PropertiesConfig {
  return {
    ...config,
    entityTypes: {
      ...config.entityTypes,
      definitions: config.entityTypes.definitions.map((type) => {
        if (type.id !== typeId) return type;
        const presentation = {
          ...type.presentation,
          ...(role === "portrait"
            ? {
                portraitPropertyId: propertyId,
                ...(propertyId && type.presentation?.coverPropertyId === propertyId
                  ? { coverPropertyId: undefined }
                  : {}),
              }
            : {
                coverPropertyId: propertyId,
                ...(propertyId && type.presentation?.portraitPropertyId === propertyId
                  ? { portraitPropertyId: undefined }
                  : {}),
              }),
        };
        if (!presentation.portraitPropertyId && !presentation.coverPropertyId) {
          return { ...type, presentation: undefined };
        }
        return { ...type, presentation };
      }),
    },
  };
}

/** Detach a role when its field disappears or ceases to be an eligible image. */
export function reconcileEntityPresentations(config: PropertiesConfig): PropertiesConfig {
  const invalid = new Set(
    validateEntityPresentations(config).map((issue) => `${issue.typeId}:${issue.role}`),
  );
  if (!invalid.size) return config;
  return {
    ...config,
    entityTypes: {
      ...config.entityTypes,
      definitions: config.entityTypes.definitions.map((type) => {
        const presentation = type.presentation;
        if (!presentation) return type;
        const next = {
          portraitPropertyId: invalid.has(`${type.id}:portrait`)
            ? undefined
            : presentation.portraitPropertyId,
          coverPropertyId: invalid.has(`${type.id}:cover`)
            ? undefined
            : presentation.coverPropertyId,
        };
        return next.portraitPropertyId || next.coverPropertyId
          ? { ...type, presentation: next }
          : { ...type, presentation: undefined };
      }),
    },
  };
}
