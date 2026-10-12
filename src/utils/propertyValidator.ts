/**
 * Validation functions for hierarchical property structures.
 * Checks for circular dependencies, missing references, type consistency, etc.
 */

import { PropertyDefinition, CustomFieldType } from "../editorTypes";
import {
  hasCircularDependency,
  findBrokenReferences,
  traversePropertyTree,
} from "./propertyTreeUtils";

const VALID_PROPERTY_TYPES = new Set<CustomFieldType>([
  "text",
  "number",
  "boolean",
  "date",
  "select",
  "multiselect",
  "entity-ref",
  "entity-ref-list",
  "url",
  "email",
  "phone",
  "file",
  "image",
  "group",
]);

export interface ValidationError {
  type:
    | "circular-dependency"
    | "broken-reference"
    | "duplicate-id"
    | "invalid-type"
    | "invalid-configuration"
    | "missing-required-field";
  propertyId: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

/**
 * Comprehensive validation of property structure.
 */
export function validatePropertyStructure(definitions: PropertyDefinition[]): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];
  const seenIds = new Set<string>();

  // Check for circular dependencies
  if (hasCircularDependency(definitions)) {
    errors.push({
      type: "circular-dependency",
      propertyId: "root",
      message: "Property tree contains circular dependencies",
    });
  }

  // Check for broken references
  const broken = findBrokenReferences(definitions);
  broken.forEach((item) => {
    errors.push({
      type: "broken-reference",
      propertyId: item.propertyId,
      message: `Property references missing parents: ${item.missingParentIds.join(", ")}`,
      details: { missingParentIds: item.missingParentIds },
    });
  });

  // Check for duplicate IDs
  traversePropertyTree(definitions, (def) => {
    if (seenIds.has(def.id)) {
      errors.push({
        type: "duplicate-id",
        propertyId: def.id,
        message: `Duplicate property ID: ${def.id}`,
      });
    }
    seenIds.add(def.id);
  });

  // Validate each property definition
  traversePropertyTree(definitions, (def) => {
    const propErrors = validatePropertyDefinition(def);
    errors.push(...propErrors);
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a single property definition.
 */
export function validatePropertyDefinition(definition: PropertyDefinition): ValidationError[] {
  const errors: ValidationError[] = [];
  if (definition.id === "forgeView" || definition.id.startsWith("forgeView.")) {
    errors.push({ type: "invalid-configuration", propertyId: definition.id, message: "forgeView is reserved for visual documents." });
  }

  // Required fields
  if (!definition.id || definition.id.trim().length === 0) {
    errors.push({
      type: "missing-required-field",
      propertyId: definition.id || "unknown",
      message: "Property ID is required and cannot be empty",
    });
  }

  if (!definition.label || definition.label.trim().length === 0) {
    errors.push({
      type: "missing-required-field",
      propertyId: definition.id || "unknown",
      message: "Property label is required and cannot be empty",
    });
  }

  if (!definition.type) {
    errors.push({
      type: "missing-required-field",
      propertyId: definition.id || "unknown",
      message: "Property type is required",
    });
  }
  if (definition.type && !VALID_PROPERTY_TYPES.has(definition.type)) {
    errors.push({
      type: "invalid-type",
      propertyId: definition.id,
      message: `Unknown property type: ${definition.type}`,
    });
  }

  // Type-specific validation
  if (definition.type) {
    const typeErrors = validatePropertyType(definition);
    errors.push(...typeErrors);
  }

  // visibleWhen validation
  if (definition.visibleWhen) {
    if (Object.keys(definition.visibleWhen).length === 0) {
      errors.push({
        type: "invalid-configuration",
        propertyId: definition.id,
        message: "visibleWhen is empty, should be removed or populated",
      });
    }

    Object.entries(definition.visibleWhen).forEach(([parentId, values]) => {
      if (!Array.isArray(values) || values.length === 0) {
        errors.push({
          type: "invalid-configuration",
          propertyId: definition.id,
          message: `visibleWhen condition for parent "${parentId}" has no allowed values`,
        });
      }
    });
  }

  // Validate children recursively
  if (definition.children && definition.children.length > 0) {
    if (definition.type !== "group") {
      errors.push({
        type: "invalid-configuration",
        propertyId: definition.id,
        message: "Only group properties may contain children",
      });
    }

    definition.children.forEach((child) => {
      const childErrors = validatePropertyDefinition(child);
      errors.push(...childErrors);
    });
  }

  return errors;
}

/**
 * Validate that property type and configuration match.
 */
function validatePropertyType(definition: PropertyDefinition): ValidationError[] {
  const errors: ValidationError[] = [];
  const { type, options, min, max, pattern, targetTypes } = definition;

  // Select/multiselect must have options
  if ((type === "select" || type === "multiselect") && (!options || options.length === 0)) {
    errors.push({
      type: "invalid-type",
      propertyId: definition.id,
      message: `Type "${type}" requires options array with at least one option`,
    });
  }

  // Options should not be on non-select types
  if (type !== "select" && type !== "multiselect" && options && options.length > 0) {
    errors.push({
      type: "invalid-type",
      propertyId: definition.id,
      message: `Type "${type}" should not have options (only select/multiselect)`,
    });
  }

  // Number constraints
  if (type === "number") {
    if (min !== undefined && max !== undefined && min > max) {
      errors.push({
        type: "invalid-configuration",
        propertyId: definition.id,
        message: `Number type has min (${min}) greater than max (${max})`,
      });
    }
  } else if (min !== undefined || max !== undefined) {
    errors.push({
      type: "invalid-type",
      propertyId: definition.id,
      message: `Min/max constraints only valid for "number" type, got "${type}"`,
    });
  }

  // Pattern should only be on text
  if (pattern && type !== "text") {
    errors.push({
      type: "invalid-type",
      propertyId: definition.id,
      message: `Pattern validation only valid for "text" type, got "${type}"`,
    });
  }

  // Entity-ref must have targetTypes
  if (
    (type === "entity-ref" || type === "entity-ref-list") &&
    (!targetTypes || targetTypes.length === 0)
  ) {
    errors.push({
      type: "invalid-type",
      propertyId: definition.id,
      message: `Type "${type}" requires targetTypes array with at least one entity type`,
    });
  }

  // Group type should not have options/constraints
  if (type === "group") {
    if (options && options.length > 0) {
      errors.push({
        type: "invalid-type",
        propertyId: definition.id,
        message: "Group type should not have options",
      });
    }
    if (pattern) {
      errors.push({
        type: "invalid-type",
        propertyId: definition.id,
        message: "Group type should not have pattern validation",
      });
    }
  }

  return errors;
}

/**
 * Check if a property can have children based on its type.
 */
export function canPropertyHaveChildren(type: CustomFieldType): boolean {
  return type === "group";
}

/**
 * Suggest fixes for common validation errors.
 */
export function getSuggestionForError(error: ValidationError): string {
  switch (error.type) {
    case "circular-dependency":
      return "Remove the visibleWhen dependency that creates the cycle";
    case "broken-reference":
      return `The parent property does not exist. Create it or remove the reference.`;
    case "duplicate-id":
      return `Change one of the duplicate IDs to be unique`;
    case "invalid-type":
      return `Check type compatibility (e.g., select requires options, entity-ref requires targetTypes)`;
    case "invalid-configuration":
      return `Remove empty or incomplete configuration sections`;
    case "missing-required-field":
      return `Fill in all required fields (id, label, type)`;
    default:
      return `Review property configuration`;
  }
}

/**
 * Validate a single option in select/multiselect.
 */
export function validateSelectOption(option: {
  value: string;
  label: string;
  color?: string;
}): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!option.value || option.value.trim().length === 0) {
    errors.push({
      type: "missing-required-field",
      propertyId: "option",
      message: "Option value is required",
    });
  }

  if (!option.label || option.label.trim().length === 0) {
    errors.push({
      type: "missing-required-field",
      propertyId: "option",
      message: "Option label is required",
    });
  }

  // Validate hex color if provided
  if (option.color && !/^#[0-9A-F]{6}$/i.test(option.color)) {
    errors.push({
      type: "invalid-configuration",
      propertyId: "option",
      message: `Invalid color format: "${option.color}" (must be hex like #FF0000)`,
    });
  }

  return errors;
}
