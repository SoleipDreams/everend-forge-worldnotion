import type {
  DocumentTabGroup,
  OpenTab,
  PersistedOpenTab,
  WorkspaceLayoutV1,
} from "../editorTypes";
import { pathAfterChanges, pathIsAffectedByChanges, type PathChangeSet } from "./pathUtils";
import { documentGroupIdForPath, documentPathsInLayout } from "./workspaceLayout";

export const DOCUMENT_TAB_GROUP_COLORS = [
  "#4f8cff",
  "#37a779",
  "#d18b2f",
  "#b46ad8",
  "#d85f7a",
  "#6f7d95",
] as const;

export type DocumentTabMoveInput = {
  path: string;
  targetPath?: string;
  targetGroupId?: string | null;
  targetSide?: "before" | "after";
};

export function normalizeDocumentTabGroups(
  groups: DocumentTabGroup[] | undefined,
  tabs: Array<OpenTab | PersistedOpenTab>,
  layout?: WorkspaceLayoutV1,
): DocumentTabGroup[] {
  const openPaths = new Set(tabs.map((tab) => tab.path));
  const seenPaths = new Set<string>();
  const seenIds = new Set<string>();
  const normalized: DocumentTabGroup[] = [];

  for (const group of groups ?? []) {
    const tabPaths = group.tabPaths.filter((path) => {
      if (!openPaths.has(path) || seenPaths.has(path)) return false;
      seenPaths.add(path);
      return true;
    });
    if (!tabPaths.length) continue;

    const partitions = new Map<string, string[]>();
    for (const path of tabPaths) {
      const paneId = layout ? (documentGroupIdForPath(layout, path) ?? "dock-documents") : "";
      const paneTabs = partitions.get(paneId) ?? [];
      paneTabs.push(path);
      partitions.set(paneId, paneTabs);
    }

    let partitionIndex = 0;
    const paneOrder = new Map<string, number>();
    if (layout) {
      documentPathsInLayout(layout).forEach((path, index) => {
        const paneId = documentGroupIdForPath(layout, path);
        if (paneId && !paneOrder.has(paneId)) paneOrder.set(paneId, index);
      });
    }
    const orderedPartitions = [...partitions].sort(
      ([left], [right]) =>
        (paneOrder.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (paneOrder.get(right) ?? Number.MAX_SAFE_INTEGER),
    );

    for (const [paneId, panePaths] of orderedPartitions) {
      const baseId = partitionIndex === 0 ? group.id : `${group.id}-${safeId(paneId)}`;
      const id = uniqueGroupId(baseId, seenIds);
      normalized.push({ ...group, id, tabPaths: panePaths });
      partitionIndex += 1;
    }
  }

  return normalized;
}

export function createGroupFromTab(
  path: string,
  existingGroups: DocumentTabGroup[],
): DocumentTabGroup {
  return createGroupFromTabs([path], existingGroups);
}

export function createGroupFromTabs(
  paths: string[],
  existingGroups: DocumentTabGroup[],
): DocumentTabGroup {
  const tabPaths = [...new Set(paths)];
  const seed = tabPaths.join("|");
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return {
    id: uniqueGroupId(`doc-group-${(hash >>> 0).toString(36)}`, new Set(existingGroups.map((group) => group.id))),
    name: "Group",
    color: DOCUMENT_TAB_GROUP_COLORS[existingGroups.length % DOCUMENT_TAB_GROUP_COLORS.length],
    collapsed: false,
    tabPaths,
  };
}

export function groupDocumentTabs(
  groups: DocumentTabGroup[],
  paths: string[],
): DocumentTabGroup[] {
  const nextGroup = createGroupFromTabs(paths, groups);
  return [...removeTabsFromGroups(groups, paths), nextGroup];
}

export function removeTabFromGroups(groups: DocumentTabGroup[], path: string): DocumentTabGroup[] {
  return groups
    .map((group) => ({
      ...group,
      tabPaths: group.tabPaths.filter((candidate) => candidate !== path),
    }))
    .filter((group) => group.tabPaths.length > 0);
}

export function moveDocumentTabInGroups(
  groups: DocumentTabGroup[],
  input: DocumentTabMoveInput,
): DocumentTabGroup[] {
  const sourceGroup = groups.find((group) => group.tabPaths.includes(input.path));
  if (sourceGroup && sourceGroup.id === input.targetGroupId) {
    const remaining = sourceGroup.tabPaths.filter((path) => path !== input.path);
    const targetIndex = input.targetPath
      ? remaining.indexOf(input.targetPath)
      : remaining.length;
    const insertIndex = targetIndex === -1
      ? remaining.length
      : Math.min(remaining.length, targetIndex + (input.targetSide === "after" ? 1 : 0));
    const tabPaths = [
      ...remaining.slice(0, insertIndex),
      input.path,
      ...remaining.slice(insertIndex),
    ];
    return groups.map((group) =>
      group.id === sourceGroup.id ? { ...group, collapsed: false, tabPaths } : group,
    );
  }

  const withoutMovingPath = groups
    .map((group) => ({ ...group, tabPaths: group.tabPaths.filter((path) => path !== input.path) }))
    .filter((group) => group.tabPaths.length > 0);

  if (input.targetGroupId === null) {
    return withoutMovingPath;
  }

  if (!input.targetGroupId) {
    return withoutMovingPath;
  }

  return withoutMovingPath.map((group) => {
    if (group.id !== input.targetGroupId) return group;
    const targetIndex = input.targetPath
      ? group.tabPaths.indexOf(input.targetPath)
      : group.tabPaths.length;
    const insertIndex = targetIndex === -1
      ? group.tabPaths.length
      : Math.min(group.tabPaths.length, targetIndex + (input.targetSide === "after" ? 1 : 0));
    return {
      ...group,
      collapsed: false,
      tabPaths: [
        ...group.tabPaths.slice(0, insertIndex),
        input.path,
        ...group.tabPaths.slice(insertIndex),
      ],
    };
  });
}

function removeTabsFromGroups(groups: DocumentTabGroup[], paths: string[]): DocumentTabGroup[] {
  const removed = new Set(paths);
  return groups
    .map((group) => ({ ...group, tabPaths: group.tabPaths.filter((path) => !removed.has(path)) }))
    .filter((group) => group.tabPaths.length > 0);
}

function uniqueGroupId(baseId: string, existingIds: Set<string>): string {
  let candidate = baseId;
  let suffix = 2;
  while (existingIds.has(candidate)) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }
  existingIds.add(candidate);
  return candidate;
}

function safeId(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "pane";
}

export function updateGroupsForPathChange(
  groups: DocumentTabGroup[],
  change: PathChangeSet,
): DocumentTabGroup[] {
  return groups.map((group) => ({
    ...group,
    tabPaths: group.tabPaths.map((path) =>
      pathIsAffectedByChanges(path, change) ? pathAfterChanges(path, change) : path,
    ),
  }));
}

export function renameDocumentTabGroup(
  groups: DocumentTabGroup[],
  groupId: string,
  name: string,
): DocumentTabGroup[] {
  const trimmed = name.trim();
  if (!trimmed) return groups;
  return groups.map((group) => (group.id === groupId ? { ...group, name: trimmed } : group));
}

export function setDocumentTabGroupColor(
  groups: DocumentTabGroup[],
  groupId: string,
  color: string,
): DocumentTabGroup[] {
  return groups.map((group) => (group.id === groupId ? { ...group, color } : group));
}

export function toggleDocumentTabGroupCollapsed(
  groups: DocumentTabGroup[],
  groupId: string,
): DocumentTabGroup[] {
  return groups.map((group) =>
    group.id === groupId ? { ...group, collapsed: !group.collapsed } : group,
  );
}

export function ungroupDocumentTabGroup(
  groups: DocumentTabGroup[],
  groupId: string,
): DocumentTabGroup[] {
  return groups.filter((group) => group.id !== groupId);
}
