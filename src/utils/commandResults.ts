import {
  EDITOR_COMMANDS,
  type CommandResult,
  type EditorCommandId,
  type FileResult,
  type HeaderResult,
  type TagResult,
  shortcutFor,
} from "../editorTypes";
import type { VaultIndex } from "../domain";

export function buildFileResults(index: VaultIndex | null): FileResult[] {
  if (!index) return [];

  return index.entities.map((entity) => ({
    type: "file",
    id: entity.path,
    title: entity.name,
    subtitle: entity.path,
    path: entity.path,
    tags: entity.tags || [],
    lastModified: entity.file.modifiedMs || undefined,
    entityType: entity.type,
    status: entity.status,
    customProperties: entity.customProperties,
  }));
}

export function buildCommandResults(
  keybindings: Array<{ commandId: EditorCommandId; shortcut: string }>,
  showModeTabs = true,
): CommandResult[] {
  return EDITOR_COMMANDS.filter((command) => showModeTabs || command.id !== "switchMode").map((command) => ({
    type: "command",
    id: command.id,
    commandId: command.id,
    title: command.label,
    subtitle: command.group,
    group: command.group,
    shortcut: shortcutFor(command.id, keybindings),
  }));
}

export function buildHeaderResults(markdown: string): HeaderResult[] {
  const results: HeaderResult[] = [];
  const lines = markdown.split("\n");

  lines.forEach((line, index) => {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (!match) return;

    results.push({
      type: "header",
      id: `header-${index}`,
      title: match[2].trim(),
      level: match[1].length,
      line: index + 1,
    });
  });

  return results;
}

export function buildTagResults(index: VaultIndex | null): TagResult[] {
  if (!index) return [];

  const tagCounts = new Map<string, number>();
  index.entities.forEach((entity) => {
    entity.tags?.forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });

  const findTagNode = (fullPath: string) => {
    if (!index.propertiesConfig) return null;
    const findInNodes = (
      nodes: typeof index.propertiesConfig.tags.rootNodes,
    ): (typeof index.propertiesConfig.tags.rootNodes)[number] | null => {
      for (const node of nodes) {
        if (node.fullPath === fullPath) return node;
        if (node.children.length > 0) {
          const found = findInNodes(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    return findInNodes(index.propertiesConfig.tags.rootNodes);
  };

  return Array.from(tagCounts.entries()).map(([tag, count]) => {
    const tagNode = findTagNode(tag);
    const parts = tag.split("/");
    const label = parts[parts.length - 1];

    return {
      type: "tag",
      id: `tag-${tag}`,
      tag,
      title: `#${label}`,
      subtitle: `${count} file${count !== 1 ? "s" : ""}`,
      fileCount: count,
      fullPath: tag,
      depth: parts.length - 1,
      color: tagNode?.color,
    };
  });
}
