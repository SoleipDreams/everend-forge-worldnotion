import { remark } from "remark";
import type { VaultIndex } from "../domain";
import { splitMarkdown } from "../domain";
import {
  getFrontmatterPropertyValue,
  listAllProperties,
  parseFrontmatterRaw,
  updateFrontmatterProperties,
} from "./propertiesConfig";
import { encodeImagePath } from "./attachments";
import { replaceMarkdownBodyPreservingEnvelope } from "./markdownFrontmatter";
import { BASE_VARIANT_ID, readNoteVariants, resolveVariantFrontmatter } from "./noteVariants";
import { isImagePath, normalizeVaultImagePath, resolveNoteImagePath } from "./vaultImages";

type MarkdownNode = {
  type: string;
  url?: string;
  value?: string;
  identifier?: string;
  children?: MarkdownNode[];
  position?: {
    start: { offset?: number };
    end: { offset?: number };
  };
};

type TextChange = { start: number; end: number; value: string };

export type ImageRelinkFileChange = {
  path: string;
  previousContent: string;
  nextContent: string;
  referenceCount: number;
};

export type ImageRelinkPlan = {
  files: ImageRelinkFileChange[];
  referenceCount: number;
  documentCount: number;
};

function sameImagePath(first: string | null, second: string): boolean {
  const normalizedFirst = first && normalizeVaultImagePath(first);
  const normalizedSecond = normalizeVaultImagePath(second);
  return Boolean(
    normalizedFirst &&
    normalizedSecond &&
    normalizedFirst.toLocaleLowerCase() === normalizedSecond.toLocaleLowerCase(),
  );
}

function destinationRange(markdownImage: string): { start: number; end: number } | undefined {
  const open = markdownImage.indexOf("](");
  if (open < 0) return undefined;
  let cursor = open + 2;
  while (/\s/.test(markdownImage[cursor] ?? "")) cursor += 1;

  if (markdownImage[cursor] === "<") {
    const start = cursor + 1;
    cursor = start;
    while (cursor < markdownImage.length) {
      if (markdownImage[cursor] === "\\") {
        cursor += 2;
        continue;
      }
      if (markdownImage[cursor] === ">") return { start, end: cursor };
      cursor += 1;
    }
    return undefined;
  }

  const start = cursor;
  let parentheses = 0;
  while (cursor < markdownImage.length) {
    const character = markdownImage[cursor];
    if (character === "\\") {
      cursor += 2;
      continue;
    }
    if (character === "(") parentheses += 1;
    if (character === ")") {
      if (parentheses === 0) break;
      parentheses -= 1;
    }
    if (/\s/.test(character ?? "") && parentheses === 0) break;
    cursor += 1;
  }
  return cursor > start ? { start, end: cursor } : undefined;
}

function definitionDestinationRange(
  definition: string,
): { start: number; end: number } | undefined {
  const prefix = /^\s*\[[^\]]+\]:\s*/.exec(definition)?.[0];
  if (!prefix) return undefined;
  let cursor = prefix.length;
  if (definition[cursor] === "<") {
    const start = cursor + 1;
    cursor = start;
    while (cursor < definition.length) {
      if (definition[cursor] === "\\") {
        cursor += 2;
        continue;
      }
      if (definition[cursor] === ">") return { start, end: cursor };
      cursor += 1;
    }
    return undefined;
  }
  const start = cursor;
  while (cursor < definition.length && !/\s/.test(definition[cursor] ?? "")) cursor += 1;
  return cursor > start ? { start, end: cursor } : undefined;
}

function resolvedPath(index: VaultIndex, notePath: string, rawPath: string): string | null {
  const unescaped = rawPath.trim().replace(/\\([()<> ])/g, "$1");
  return resolveNoteImagePath(index, notePath, unescaped);
}

function markdownReferenceChanges(
  index: VaultIndex,
  notePath: string,
  markdown: string,
  sourcePath: string,
  targetPath?: string,
): { markdown: string; referenceCount: number } {
  const tree = remark().parse(markdown) as unknown as MarkdownNode;
  const changes: TextChange[] = [];

  function visit(node: MarkdownNode) {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (typeof start === "number" && typeof end === "number" && end >= start) {
      const source = markdown.slice(start, end);

      if (node.type === "image") {
        const destination = destinationRange(source);
        if (destination) {
          const rawPath = source.slice(destination.start, destination.end);
          if (sameImagePath(resolvedPath(index, notePath, rawPath), sourcePath)) {
            changes.push({
              start: start + destination.start,
              end: start + destination.end,
              value: targetPath ? encodeImagePath(targetPath) : rawPath,
            });
          }
        }
      } else if (
        (node.type === "text" || node.type === "imageReference") &&
        source.includes("![[")
      ) {
        // The marker check keeps the common plain-text walk cheap.
        const embeds = /!\[\[([^\]]+)\]\]/g;
        let match: RegExpExecArray | null;
        while ((match = embeds.exec(source)) !== null) {
          const targetText = match[1] ?? "";
          const separator = targetText.indexOf("|");
          const heading = targetText.indexOf("#");
          const targetEnd = [separator, heading]
            .filter((offset) => offset >= 0)
            .reduce((smallest, offset) => Math.min(smallest, offset), targetText.length);
          const targetPart = targetText.slice(0, targetEnd);
          const leadingWhitespace = targetPart.length - targetPart.trimStart().length;
          const rawPath = targetPart.trim();
          if (sameImagePath(resolvedPath(index, notePath, rawPath), sourcePath)) {
            const localStart = match.index + 3 + leadingWhitespace;
            const localEnd = localStart + rawPath.length;
            changes.push({
              start: start + localStart,
              end: start + localEnd,
              value: targetPath ?? rawPath,
            });
          }
        }
      } else if (node.type === "html" && /<img\b/i.test(source)) {
        const imageTags = /<img\b[^>]*>/gi;
        let tag: RegExpExecArray | null;
        while ((tag = imageTags.exec(source)) !== null) {
          const src = /\bsrc\s*=\s*(["'])(.*?)\1/i.exec(tag[0]);
          if (!src || typeof src.index !== "number") continue;
          const valueOffset = tag[0].indexOf(src[2] ?? "", src.index + src[0].indexOf("=") + 1);
          if (valueOffset < 0) continue;
          const rawPath = src[2] ?? "";
          if (sameImagePath(resolvedPath(index, notePath, rawPath), sourcePath)) {
            changes.push({
              start: start + tag.index + valueOffset,
              end: start + tag.index + valueOffset + rawPath.length,
              value: targetPath ? encodeImagePath(targetPath) : rawPath,
            });
          }
        }
      }
    }

    node.children?.forEach(visit);
  }

  visit(tree);
  const referenceCounts = new Map<string, number>();
  const definitions: MarkdownNode[] = [];
  function collectDefinitions(node: MarkdownNode) {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    const source =
      typeof start === "number" && typeof end === "number" ? markdown.slice(start, end) : "";
    if (
      (node.type === "imageReference" || node.type === "linkReference") &&
      node.identifier &&
      !source.includes("![[")
    ) {
      const identifier = node.identifier.toLocaleLowerCase();
      referenceCounts.set(identifier, (referenceCounts.get(identifier) ?? 0) + 1);
    }
    if (node.type === "definition" && node.identifier) definitions.push(node);
    node.children?.forEach(collectDefinitions);
  }
  collectDefinitions(tree);

  let referenceCount = changes.length;
  for (const definition of definitions) {
    const count = referenceCounts.get(definition.identifier?.toLocaleLowerCase() ?? "") ?? 0;
    const start = definition.position?.start.offset;
    const end = definition.position?.end.offset;
    if (!count || typeof start !== "number" || typeof end !== "number") continue;
    const source = markdown.slice(start, end);
    const destination = definitionDestinationRange(source);
    if (!destination) continue;
    const rawPath = source.slice(destination.start, destination.end);
    if (!sameImagePath(resolvedPath(index, notePath, rawPath), sourcePath)) continue;
    changes.push({
      start: start + destination.start,
      end: start + destination.end,
      value: targetPath ? encodeImagePath(targetPath) : rawPath,
    });
    referenceCount += count;
  }

  if (!targetPath || !changes.length) return { markdown, referenceCount };

  let next = markdown;
  for (const change of changes.sort((first, second) => second.start - first.start)) {
    next = `${next.slice(0, change.start)}${change.value}${next.slice(change.end)}`;
  }
  return { markdown: next, referenceCount };
}

function rewriteImagePropertyValue(
  index: VaultIndex,
  notePath: string,
  value: unknown,
  sourcePath: string,
  targetPath?: string,
): { value: unknown; referenceCount: number } {
  if (typeof value === "string") {
    if (!sameImagePath(resolvedPath(index, notePath, value), sourcePath)) {
      return { value, referenceCount: 0 };
    }
    return { value: targetPath ?? value, referenceCount: 1 };
  }
  if (Array.isArray(value)) {
    let referenceCount = 0;
    const next = value.map((entry) => {
      const rewritten = rewriteImagePropertyValue(index, notePath, entry, sourcePath, targetPath);
      referenceCount += rewritten.referenceCount;
      return rewritten.value;
    });
    return { value: next, referenceCount };
  }
  return { value, referenceCount: 0 };
}

function replaceFrontmatterPreservingEnvelope(content: string, frontmatterRaw: string): string {
  const originalFrontmatter = /^---(?:\r?\n)[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(content);
  if (!originalFrontmatter) return content;
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const nextFrontmatter = frontmatterRaw.replace(/\r?\n/g, eol);
  const separator = originalFrontmatter[0].endsWith(eol) ? eol : "";
  return `${nextFrontmatter}${separator}${content.slice(originalFrontmatter[0].length)}`;
}

function rewriteNoteImageReferences(
  index: VaultIndex,
  notePath: string,
  content: string,
  sourcePath: string,
  targetPath?: string,
): { content: string; referenceCount: number } {
  const { frontmatterRaw, bodyMarkdown } = splitMarkdown(content);
  const bodyResult = markdownReferenceChanges(
    index,
    notePath,
    bodyMarkdown,
    sourcePath,
    targetPath,
  );
  let referenceCount = bodyResult.referenceCount;
  let nextFrontmatter = frontmatterRaw;

  if (frontmatterRaw && index.propertiesConfig) {
    const data = parseFrontmatterRaw(frontmatterRaw);
    const imageProperties = listAllProperties(index.propertiesConfig).filter(
      (property) => property.type === "image",
    );
    const updates: Record<string, unknown> = {};
    for (const property of imageProperties) {
      const currentValue = getFrontmatterPropertyValue(data, property.id, index.propertiesConfig);
      const rewritten = rewriteImagePropertyValue(
        index,
        notePath,
        currentValue,
        sourcePath,
        targetPath,
      );
      if (rewritten.referenceCount) {
        updates[property.id] = rewritten.value;
        referenceCount += rewritten.referenceCount;
      }
    }
    if (targetPath && Object.keys(updates).length) {
      const entityType = typeof data.type === "string" ? data.type : undefined;
      nextFrontmatter = updateFrontmatterProperties(
        frontmatterRaw,
        updates,
        index.propertiesConfig,
        entityType,
      );
    }
  }

  if (!targetPath || !referenceCount) return { content, referenceCount };
  let nextContent = content;
  if (bodyResult.markdown !== bodyMarkdown) {
    nextContent = replaceMarkdownBodyPreservingEnvelope(nextContent, bodyResult.markdown);
  }
  if (nextFrontmatter !== frontmatterRaw) {
    nextContent = replaceFrontmatterPreservingEnvelope(nextContent, nextFrontmatter);
  }
  return {
    content: nextContent,
    referenceCount,
  };
}

function noteContents(index: VaultIndex, overrides: Array<{ path: string; content: string }>) {
  const contents = new Map(index.markdownFiles.map((file) => [file.relativePath, file.content]));
  overrides.forEach(({ path, content }) => {
    if (path.toLowerCase().endsWith(".md")) contents.set(path, content);
  });
  return contents;
}

export type ImageUsage = {
  referenceCount: number;
  documentPaths: string[];
  variantReferenceCount: number;
  pathBranchingReferenceCount: number;
  pathBranchingVariantReferenceCount: number;
  pathBranchingLocations: string[];
};

/** Index every image's note and property references with a single Markdown parse per note. */
export function getImageUsageByPath(
  index: VaultIndex,
  overrides: Array<{ path: string; content: string }> = [],
): Map<string, ImageUsage> {
  const imagePathByKey = new Map<string, string>();
  index.files.forEach((file) => {
    if (!isImagePath(file.relativePath)) return;
    const normalized = normalizeVaultImagePath(file.relativePath);
    if (normalized) imagePathByKey.set(normalized.toLocaleLowerCase(), file.relativePath);
  });

  const usage = new Map<
    string,
    {
      referenceCount: number;
      documentPaths: Set<string>;
      variantReferenceCount: number;
      pathBranchingReferenceCount: number;
      pathBranchingVariantReferenceCount: number;
      pathBranchingLocations: Set<string>;
    }
  >();
  const imageProperties = listAllProperties(index.propertiesConfig).filter(
    (property) => property.type === "image",
  );
  const recordReference = (notePath: string, rawPath: string, count = 1, isVariant = false) => {
    const resolved = resolvedPath(index, notePath, rawPath);
    const normalized = resolved && normalizeVaultImagePath(resolved);
    const imagePath = normalized && imagePathByKey.get(normalized.toLocaleLowerCase());
    if (!imagePath) return;
    const current = usage.get(imagePath) ?? {
      referenceCount: 0,
      documentPaths: new Set<string>(),
      variantReferenceCount: 0,
      pathBranchingReferenceCount: 0,
      pathBranchingVariantReferenceCount: 0,
      pathBranchingLocations: new Set<string>(),
    };
    current.referenceCount += count;
    if (isVariant) current.variantReferenceCount += count;
    current.documentPaths.add(notePath);
    usage.set(imagePath, current);
  };

  for (const [notePath, content] of noteContents(index, overrides)) {
    const { frontmatterRaw, bodyMarkdown } = splitMarkdown(content);
    if (bodyMarkdown) {
      const tree = remark().parse(bodyMarkdown) as unknown as MarkdownNode;
      const referenceCounts = new Map<string, number>();
      const definitions: MarkdownNode[] = [];
      const visit = (node: MarkdownNode) => {
        const start = node.position?.start.offset;
        const end = node.position?.end.offset;
        const source =
          typeof start === "number" && typeof end === "number"
            ? bodyMarkdown.slice(start, end)
            : "";

        if (node.type === "image") {
          const destination = destinationRange(source);
          if (destination) {
            recordReference(notePath, source.slice(destination.start, destination.end));
          }
        } else if (
          (node.type === "text" || node.type === "imageReference") &&
          source.includes("![[")
        ) {
          const embeds = /!\[\[([^\]]+)\]\]/g;
          let match: RegExpExecArray | null;
          while ((match = embeds.exec(source)) !== null) {
            const targetText = match[1] ?? "";
            const separator = targetText.indexOf("|");
            const heading = targetText.indexOf("#");
            const targetEnd = [separator, heading]
              .filter((offset) => offset >= 0)
              .reduce((smallest, offset) => Math.min(smallest, offset), targetText.length);
            recordReference(notePath, targetText.slice(0, targetEnd).trim());
          }
        } else if (node.type === "html" && /<img\b/i.test(source)) {
          const imageTags = /<img\b[^>]*>/gi;
          let tag: RegExpExecArray | null;
          while ((tag = imageTags.exec(source)) !== null) {
            const src = /\bsrc\s*=\s*(["'])(.*?)\1/i.exec(tag[0]);
            if (src?.[2]) recordReference(notePath, src[2]);
          }
        }

        if (
          (node.type === "imageReference" || node.type === "linkReference") &&
          node.identifier &&
          !source.includes("![[")
        ) {
          const identifier = node.identifier.toLocaleLowerCase();
          referenceCounts.set(identifier, (referenceCounts.get(identifier) ?? 0) + 1);
        }
        if (node.type === "definition" && node.identifier) definitions.push(node);
        node.children?.forEach(visit);
      };
      visit(tree);

      for (const definition of definitions) {
        const count = referenceCounts.get(definition.identifier?.toLocaleLowerCase() ?? "") ?? 0;
        const start = definition.position?.start.offset;
        const end = definition.position?.end.offset;
        if (!count || typeof start !== "number" || typeof end !== "number") continue;
        const source = bodyMarkdown.slice(start, end);
        const destination = definitionDestinationRange(source);
        if (destination) {
          recordReference(notePath, source.slice(destination.start, destination.end), count);
        }
      }
    }

    if (frontmatterRaw && imageProperties.length) {
      const data = parseFrontmatterRaw(frontmatterRaw);
      const recordPropertyValue = (value: unknown, isVariant = false) => {
        if (typeof value === "string") {
          recordReference(notePath, value, 1, isVariant);
        } else if (Array.isArray(value)) {
          value.forEach((entry) => recordPropertyValue(entry, isVariant));
        }
      };
      imageProperties.forEach((property) => {
        recordPropertyValue(getFrontmatterPropertyValue(data, property.id, index.propertiesConfig));
      });
      Object.entries(readNoteVariants(data)).forEach(([variantId, variant]) => {
        if (variantId === BASE_VARIANT_ID || !variant.overrides) return;
        imageProperties.forEach((property) => {
          recordPropertyValue(
            getFrontmatterPropertyValue(variant.overrides!, property.id, index.propertiesConfig),
            true,
          );
        });
      });
    }
  }

  const pathBranchingPrefix = ".everend/.pathbranching/";
  const pathBranchingDocuments = index.files.flatMap((file) => {
    if (
      !file.relativePath.startsWith(pathBranchingPrefix) ||
      !file.relativePath.toLocaleLowerCase().endsWith(".json")
    ) {
      return [];
    }
    try {
      const parsed = JSON.parse(file.content) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
      const document = parsed as Record<string, unknown>;
      const project =
        document.project && typeof document.project === "object" && !Array.isArray(document.project)
          ? (document.project as Record<string, unknown>)
          : document;
      return [{ path: file.relativePath, project }];
    } catch {
      return [];
    }
  });
  const pathBranchingImagePathsById = new Map<string, string>();
  const pathBranchingCanonImagePathsById = new Map<string, Map<string, Set<string>>>();
  pathBranchingDocuments.forEach(({ project }) => {
    if (!Array.isArray(project.assets)) return;
    project.assets.forEach((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;
      const asset = entry as Record<string, unknown>;
      if (typeof asset.id !== "string" || typeof asset.path !== "string") return;
      if (asset.kind !== "image" && !isImagePath(asset.path)) return;
      const normalized = normalizeVaultImagePath(asset.path);
      const imagePath = normalized && imagePathByKey.get(normalized.toLocaleLowerCase());
      if (imagePath) pathBranchingImagePathsById.set(asset.id, imagePath);
    });
  });

  const imagePropertyIds = new Set(imageProperties.map((property) => property.id));
  const entitiesById = new Map(index.entities.map((entity) => [entity.id, entity]));
  const pathBranchingCanonVariantLabelsById = new Map<string, Map<string, string>>();
  pathBranchingDocuments.forEach(({ project }) => {
    if (!Array.isArray(project.canonRefs) || !index.propertiesConfig) return;
    const entityTypes = index.propertiesConfig.entityTypes.definitions;
    project.canonRefs.forEach((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;
      const canonRef = entry as Record<string, unknown>;
      if (typeof canonRef.id !== "string") return;
      const entity = entitiesById.get(canonRef.id);
      const typeId = entity?.type ?? (typeof canonRef.kind === "string" ? canonRef.kind : undefined);
      if (!typeId) return;
      const entityType = entityTypes.find((candidate) => candidate.id === typeId);
      const presentation = entityType?.presentation;
      const propertyIds = [presentation?.portraitPropertyId, presentation?.coverPropertyId].filter(
        (propertyId): propertyId is string =>
          typeof propertyId === "string" && imagePropertyIds.has(propertyId),
      );
      if (!propertyIds.length) return;
      const indexedFrontmatter = entity
        ? parseFrontmatterRaw(splitMarkdown(entity.file.content).frontmatterRaw)
        : undefined;
      const frontmatterValue =
        indexedFrontmatter && Object.keys(indexedFrontmatter).length
          ? indexedFrontmatter
          : canonRef.frontmatter ?? canonRef.properties;
      const frontmatter =
        frontmatterValue && typeof frontmatterValue === "object" && !Array.isArray(frontmatterValue)
          ? (frontmatterValue as Record<string, unknown>)
          : undefined;
      if (!frontmatter) return;
      const canonPath = entity?.path ?? (typeof canonRef.canonSourcePath === "string" ? canonRef.canonSourcePath : "");
      const imagePathsByVariant = new Map<string, Set<string>>();
      const variants = readNoteVariants(frontmatter);
      pathBranchingCanonVariantLabelsById.set(
        canonRef.id,
        new Map(Object.entries(variants).map(([variantId, variant]) => [variantId, variant.label])),
      );
      Object.keys(variants).forEach((variantId) => {
        const variantFrontmatter = resolveVariantFrontmatter(frontmatter, variantId);
        const imagePaths = new Set<string>();
        const collectImagePaths = (value: unknown) => {
          if (typeof value === "string") {
            const resolved = canonPath
              ? resolvedPath(index, canonPath, value)
              : normalizeVaultImagePath(value);
            const normalized = resolved && normalizeVaultImagePath(resolved);
            const imagePath = normalized && imagePathByKey.get(normalized.toLocaleLowerCase());
            if (imagePath) imagePaths.add(imagePath);
          } else if (Array.isArray(value)) {
            value.forEach(collectImagePaths);
          }
        };
        propertyIds.forEach((propertyId) => {
          collectImagePaths(
            getFrontmatterPropertyValue(variantFrontmatter, propertyId, index.propertiesConfig),
          );
        });
        if (imagePaths.size) imagePathsByVariant.set(variantId, imagePaths);
      });
      if (imagePathsByVariant.size) {
        pathBranchingCanonImagePathsById.set(canonRef.id, imagePathsByVariant);
      }
    });
  });

  pathBranchingDocuments.forEach(({ path, project }) => {
    const referencedAssetIds: string[] = [];
    const canonRefIds = new Set<string>();
    if (Array.isArray(project.canonRefs)) {
      project.canonRefs.forEach((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;
        const id = (entry as Record<string, unknown>).id;
        if (typeof id === "string") canonRefIds.add(id);
      });
    }
    const referencedCanonVariants: Array<{ id: string; variantId: string }> = [];
    const collectProjectReferences = (value: unknown, root = false) => {
      if (typeof value === "string") {
        if (pathBranchingImagePathsById.has(value)) referencedAssetIds.push(value);
        if (canonRefIds.has(value)) {
          referencedCanonVariants.push({ id: value, variantId: BASE_VARIANT_ID });
        }
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((entry) => collectProjectReferences(entry));
        return;
      }
      if (!value || typeof value !== "object") return;
      const object = value as Record<string, unknown>;
      const characterRef =
        typeof object.characterRef === "string"
          ? object.characterRef
          : typeof object.speakerRef === "string"
            ? object.speakerRef
            : typeof object.playableCharacterRef === "string"
              ? object.playableCharacterRef
              : undefined;
      if (characterRef && canonRefIds.has(characterRef)) {
        const variantId =
          (typeof object.characterVariantId === "string" && object.characterVariantId) ||
          (typeof object.playableVariantId === "string" && object.playableVariantId) ||
          BASE_VARIANT_ID;
        referencedCanonVariants.push({ id: characterRef, variantId });
      }
      Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
        if (
          key === "assets" ||
          (root && key === "canonRefs") ||
          key === "characterRef" ||
          key === "speakerRef" ||
          key === "playableCharacterRef" ||
          key === "characterVariantId" ||
          key === "playableVariantId"
        ) {
          return;
        }
        collectProjectReferences(child);
      });
    };
    collectProjectReferences(project, true);
    const location = path.slice(pathBranchingPrefix.length);
    referencedAssetIds.forEach((assetId) => {
      const imagePath = pathBranchingImagePathsById.get(assetId);
      if (!imagePath) return;
      const current = usage.get(imagePath) ?? {
        referenceCount: 0,
        documentPaths: new Set<string>(),
        variantReferenceCount: 0,
        pathBranchingReferenceCount: 0,
        pathBranchingVariantReferenceCount: 0,
        pathBranchingLocations: new Set<string>(),
      };
      current.pathBranchingReferenceCount += 1;
      current.pathBranchingLocations.add(location);
      usage.set(imagePath, current);
    });
    referencedCanonVariants.forEach(({ id, variantId }) => {
      const imagePathsByVariant = pathBranchingCanonImagePathsById.get(id);
      const resolvedVariantId = imagePathsByVariant?.has(variantId) ? variantId : BASE_VARIANT_ID;
      const imagePaths = imagePathsByVariant?.get(resolvedVariantId);
      const variantLabel = pathBranchingCanonVariantLabelsById.get(id)?.get(resolvedVariantId);
      const usageLocation =
        resolvedVariantId === BASE_VARIANT_ID
          ? location
          : `${location} · ${variantLabel ?? resolvedVariantId}`;
      imagePaths?.forEach((imagePath) => {
        const current = usage.get(imagePath) ?? {
          referenceCount: 0,
          documentPaths: new Set<string>(),
          variantReferenceCount: 0,
          pathBranchingReferenceCount: 0,
          pathBranchingVariantReferenceCount: 0,
          pathBranchingLocations: new Set<string>(),
        };
        current.pathBranchingReferenceCount += 1;
        if (resolvedVariantId !== BASE_VARIANT_ID) {
          current.pathBranchingVariantReferenceCount += 1;
        }
        current.pathBranchingLocations.add(usageLocation);
        usage.set(imagePath, current);
      });
    });
  });

  const result = new Map<string, ImageUsage>();
  usage.forEach((summary, path) => {
    result.set(path, {
      referenceCount: summary.referenceCount,
      documentPaths: Array.from(summary.documentPaths).sort((first, second) =>
        first.localeCompare(second),
      ),
      variantReferenceCount: summary.variantReferenceCount,
      pathBranchingReferenceCount: summary.pathBranchingReferenceCount,
      pathBranchingVariantReferenceCount: summary.pathBranchingVariantReferenceCount,
      pathBranchingLocations: Array.from(summary.pathBranchingLocations).sort((first, second) =>
        first.localeCompare(second),
      ),
    });
  });
  return result;
}

export function countImageReferences(
  index: VaultIndex,
  sourcePath: string,
  overrides: Array<{ path: string; content: string }> = [],
): Pick<ImageRelinkPlan, "referenceCount" | "documentCount"> {
  let referenceCount = 0;
  let documentCount = 0;
  for (const [path, content] of noteContents(index, overrides)) {
    const result = rewriteNoteImageReferences(index, path, content, sourcePath);
    if (result.referenceCount) {
      referenceCount += result.referenceCount;
      documentCount += 1;
    }
  }
  return { referenceCount, documentCount };
}

export function planImageRelink(
  index: VaultIndex,
  sourcePath: string,
  targetPath: string,
  overrides: Array<{ path: string; content: string }> = [],
): ImageRelinkPlan {
  if (sameImagePath(sourcePath, targetPath)) {
    return { files: [], referenceCount: 0, documentCount: 0 };
  }

  const files: ImageRelinkFileChange[] = [];
  let referenceCount = 0;
  for (const [path, content] of noteContents(index, overrides)) {
    const result = rewriteNoteImageReferences(index, path, content, sourcePath, targetPath);
    if (!result.referenceCount || result.content === content) continue;
    files.push({
      path,
      previousContent: content,
      nextContent: result.content,
      referenceCount: result.referenceCount,
    });
    referenceCount += result.referenceCount;
  }

  return { files, referenceCount, documentCount: files.length };
}
