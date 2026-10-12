import type { PropertiesConfig } from "../editorTypes";
import { hasVisualDocumentMarker } from "../visualDocuments/marker";
import type { VaultFile } from "../domain";
import { joinMarkdown, splitMarkdown } from "./markdownFrontmatter";
import {
  frontmatterDocumentToRaw,
  copyDocumentValue,
  parseFrontmatterDocument,
  setDocumentValue,
} from "./frontmatterDocument";
import { getValueAtPath, listPropertyPathEntries } from "./propertyPaths";
import { upgradePropertiesConfigToV3 } from "./propertiesSerializer";

export type PropertyStructureMove = {
  propertyId: string;
  fromPath: string[];
  toPath: string[];
  action: "copy" | "cleanup-duplicate";
};

export type PropertyStructureMigrationItem = {
  path: string;
  status: "ready" | "conflict" | "invalid-yaml" | "dirty";
  moves: PropertyStructureMove[];
  conflicts: string[];
  copyContent?: string;
  nextContent?: string;
  modifiedMs?: number | null;
};

export type PropertyStructureMigrationPlan = {
  sourceVersion: string;
  upgradedConfig: PropertiesConfig;
  items: PropertyStructureMigrationItem[];
};

function valuesEqual(first: unknown, second: unknown): boolean {
  if (Object.is(first, second)) return true;
  if (typeof first !== typeof second) return false;
  if (Array.isArray(first) && Array.isArray(second)) {
    return (
      first.length === second.length &&
      first.every((value, index) => valuesEqual(value, second[index]))
    );
  }
  if (first && second && typeof first === "object" && typeof second === "object") {
    const firstRecord = first as Record<string, unknown>;
    const secondRecord = second as Record<string, unknown>;
    const firstKeys = Object.keys(firstRecord);
    const secondKeys = Object.keys(secondRecord);
    return (
      firstKeys.length === secondKeys.length &&
      firstKeys.every(
        (key) => key in secondRecord && valuesEqual(firstRecord[key], secondRecord[key]),
      )
    );
  }
  return false;
}

function destinationHasScalarAncestor(data: Record<string, unknown>, path: string[]) {
  for (let depth = 1; depth < path.length; depth += 1) {
    const ancestor = getValueAtPath(data, path.slice(0, depth));
    if (
      ancestor !== undefined &&
      (!ancestor || typeof ancestor !== "object" || Array.isArray(ancestor))
    ) {
      return path.slice(0, depth).join(".");
    }
  }
  return undefined;
}

export function planPropertyStructureMigration(
  files: VaultFile[],
  config: PropertiesConfig,
  dirtyPaths: ReadonlySet<string> = new Set(),
): PropertyStructureMigrationPlan {
  const upgradedConfig = upgradePropertiesConfigToV3(config);
  const nestedLeaves = listPropertyPathEntries(upgradedConfig).filter(
    ({ definition, path }) => definition.type !== "group" && path.length > 1,
  );
  const nestedGroups = listPropertyPathEntries(upgradedConfig).filter(
    ({ definition }) => definition.type === "group",
  );

  const items = files
    .filter((file) => file.relativePath.endsWith(".md"))
    .filter((file) => !hasVisualDocumentMarker(file.content))
    .map((file): PropertyStructureMigrationItem | undefined => {
      const parts = splitMarkdown(file.content);
      if (!parts.frontmatterRaw) return undefined;
      const document = parseFrontmatterDocument(parts.frontmatterRaw);
      if (!document) {
        return {
          path: file.relativePath,
          status: "invalid-yaml",
          moves: [],
          conflicts: ["The YAML frontmatter is invalid and will not be changed."],
          modifiedMs: file.modifiedMs,
        };
      }
      const data = document.toJS() as Record<string, unknown>;
      const moves: PropertyStructureMove[] = [];
      const conflicts: string[] = [];

      nestedGroups.forEach(({ definition, path }) => {
        if (!document.hasIn(path)) return;
        const value = document.getIn(path);
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          conflicts.push(`${definition.id}: ${path.join(".")} must be a YAML object.`);
        }
      });

      nestedLeaves.forEach(({ definition, path: toPath }) => {
        const fromPath = [definition.id];
        if (!document.hasIn(fromPath)) return;
        const sourceValue = document.getIn(fromPath);
        const scalarAncestor = destinationHasScalarAncestor(data, toPath);
        if (scalarAncestor) {
          conflicts.push(
            `${definition.id}: ${scalarAncestor} already contains a scalar value instead of an object.`,
          );
          return;
        }
        if (document.hasIn(toPath)) {
          const destinationValue = document.getIn(toPath);
          if (!valuesEqual(sourceValue, destinationValue)) {
            conflicts.push(
              `${definition.id}: ${fromPath.join(".")} and ${toPath.join(".")} contain different values.`,
            );
            return;
          }
          moves.push({ propertyId: definition.id, fromPath, toPath, action: "cleanup-duplicate" });
          return;
        }
        moves.push({ propertyId: definition.id, fromPath, toPath, action: "copy" });
      });

      if (!moves.length && !conflicts.length) return undefined;
      if (dirtyPaths.has(file.relativePath)) {
        return {
          path: file.relativePath,
          status: "dirty",
          moves,
          conflicts: ["This note has unsaved changes."],
          modifiedMs: file.modifiedMs,
        };
      }
      if (conflicts.length) {
        return {
          path: file.relativePath,
          status: "conflict",
          moves,
          conflicts,
          modifiedMs: file.modifiedMs,
        };
      }

      const copyDocument = parseFrontmatterDocument(parts.frontmatterRaw)!;
      moves.forEach((move) => {
        if (move.action === "copy") {
          copyDocumentValue(copyDocument, move.fromPath, move.toPath);
        }
      });
      const copyRaw = frontmatterDocumentToRaw(copyDocument);
      const cleanupDocument = parseFrontmatterDocument(copyRaw)!;
      moves.forEach((move) => setDocumentValue(cleanupDocument, move.fromPath, undefined));

      return {
        path: file.relativePath,
        status: "ready",
        moves,
        conflicts: [],
        copyContent: joinMarkdown(copyRaw, parts.bodyMarkdown),
        nextContent: joinMarkdown(frontmatterDocumentToRaw(cleanupDocument), parts.bodyMarkdown),
        modifiedMs: file.modifiedMs,
      };
    })
    .filter((item): item is PropertyStructureMigrationItem => Boolean(item))
    .sort((first, second) => first.path.localeCompare(second.path));

  return { sourceVersion: config.version, upgradedConfig, items };
}

/** Preview a path-changing schema edit, such as moving a property or section. */
export function planPropertyPathMigration(
  files: VaultFile[],
  fromConfig: PropertiesConfig,
  toConfig: PropertiesConfig,
  dirtyPaths: ReadonlySet<string> = new Set(),
): PropertyStructureMigrationPlan {
  const fromPaths = new Map(
    listPropertyPathEntries(fromConfig)
      .filter(({ definition }) => definition.type !== "group")
      .map(({ definition, path }) => [definition.id, path]),
  );
  const changedLeaves = listPropertyPathEntries(toConfig)
    .filter(({ definition }) => definition.type !== "group")
    .map(({ definition, path }) => ({
      definition,
      fromPath: fromPaths.get(definition.id),
      toPath: path,
    }))
    .filter(
      (entry): entry is typeof entry & { fromPath: string[] } =>
        Boolean(entry.fromPath) && entry.fromPath!.join("\0") !== entry.toPath.join("\0"),
    );

  const items = files
    .filter((file) => file.relativePath.endsWith(".md"))
    .filter((file) => !hasVisualDocumentMarker(file.content))
    .map((file): PropertyStructureMigrationItem | undefined => {
      const parts = splitMarkdown(file.content);
      if (!parts.frontmatterRaw) return undefined;
      const document = parseFrontmatterDocument(parts.frontmatterRaw);
      if (!document) {
        return {
          path: file.relativePath,
          status: "invalid-yaml",
          moves: [],
          conflicts: ["The YAML frontmatter is invalid and will not be changed."],
          modifiedMs: file.modifiedMs,
        };
      }
      const data = document.toJS() as Record<string, unknown>;
      const moves: PropertyStructureMove[] = [];
      const conflicts: string[] = [];
      changedLeaves.forEach(({ definition, fromPath, toPath }) => {
        if (!document.hasIn(fromPath)) return;
        const scalarAncestor = destinationHasScalarAncestor(data, toPath);
        if (scalarAncestor) {
          conflicts.push(`${definition.id}: ${scalarAncestor} is not an object.`);
          return;
        }
        if (document.hasIn(toPath)) {
          if (!valuesEqual(document.getIn(fromPath), document.getIn(toPath))) {
            conflicts.push(
              `${definition.id}: ${fromPath.join(".")} and ${toPath.join(".")} contain different values.`,
            );
            return;
          }
          moves.push({ propertyId: definition.id, fromPath, toPath, action: "cleanup-duplicate" });
        } else {
          moves.push({ propertyId: definition.id, fromPath, toPath, action: "copy" });
        }
      });
      if (!moves.length && !conflicts.length) return undefined;
      const blockedStatus = dirtyPaths.has(file.relativePath)
        ? "dirty"
        : conflicts.length
          ? "conflict"
          : undefined;
      if (blockedStatus) {
        return {
          path: file.relativePath,
          status: blockedStatus,
          moves,
          conflicts: dirtyPaths.has(file.relativePath)
            ? ["This note has unsaved changes.", ...conflicts]
            : conflicts,
          modifiedMs: file.modifiedMs,
        };
      }
      const copyDocument = parseFrontmatterDocument(parts.frontmatterRaw)!;
      moves.forEach((move) => {
        if (move.action === "copy") {
          copyDocumentValue(copyDocument, move.fromPath, move.toPath);
        }
      });
      const copyRaw = frontmatterDocumentToRaw(copyDocument);
      const cleanupDocument = parseFrontmatterDocument(copyRaw)!;
      moves.forEach((move) => setDocumentValue(cleanupDocument, move.fromPath, undefined));
      return {
        path: file.relativePath,
        status: "ready",
        moves,
        conflicts: [],
        copyContent: joinMarkdown(copyRaw, parts.bodyMarkdown),
        nextContent: joinMarkdown(frontmatterDocumentToRaw(cleanupDocument), parts.bodyMarkdown),
        modifiedMs: file.modifiedMs,
      };
    })
    .filter((item): item is PropertyStructureMigrationItem => Boolean(item))
    .sort((first, second) => first.path.localeCompare(second.path));

  return { sourceVersion: fromConfig.version, upgradedConfig: toConfig, items };
}
