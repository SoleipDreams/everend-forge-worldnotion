import type { VaultFile } from "../domain";
import type { OpenTab } from "../editorTypes";
import { pathAfterChanges, pathIsAffectedByChanges, type PathChangeSet } from "../utils/pathUtils";
import { hasVisualDocumentMarker } from "./marker";

/** Machine-local recovery only. Never serialized into a universe or export. */
export type VisualRecoverySnapshot = {
  version: 1;
  path: string;
  rawMarkdown: string;
  savedMarkdown: string;
  modifiedMs?: number | null;
  updatedAt: number;
};
export type VisualRecoverySnapshots = Record<string, VisualRecoverySnapshot>;
export const visualRecoveryKey = (root: string) => `worldnotion.visual-recovery.v1:${root}`;

export function readVisualRecovery(
  root: string,
  storage: Pick<Storage, "getItem"> = localStorage,
): VisualRecoverySnapshots {
  const value = storage.getItem(visualRecoveryKey(root));
  if (!value) return {};
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("Invalid local visual recovery data. The stored copy is preserved.");
  for (const [path, item] of Object.entries(parsed)) {
    if (
      !item ||
      typeof item !== "object" ||
      item.version !== 1 ||
      item.path !== path ||
      typeof item.rawMarkdown !== "string" ||
      typeof item.savedMarkdown !== "string" ||
      typeof item.updatedAt !== "number" ||
      !Number.isFinite(item.updatedAt) ||
      (item.modifiedMs != null &&
        (typeof item.modifiedMs !== "number" || !Number.isFinite(item.modifiedMs)))
    )
      throw new Error("Unsupported local visual recovery data. The stored copy is preserved.");
  }
  return parsed as VisualRecoverySnapshots;
}

export function writeVisualRecovery(
  root: string,
  snapshots: VisualRecoverySnapshots,
  storage: Pick<Storage, "setItem" | "removeItem"> = localStorage,
) {
  if (Object.keys(snapshots).length)
    storage.setItem(visualRecoveryKey(root), JSON.stringify(snapshots));
  else storage.removeItem(visualRecoveryKey(root));
}

export function recordVisualTabs(
  snapshots: VisualRecoverySnapshots,
  tabs: OpenTab[],
  previous: OpenTab[],
): VisualRecoverySnapshots {
  const next = { ...snapshots };
  for (const tab of tabs) {
    if (
      tab.dirty &&
      (hasVisualDocumentMarker(tab.rawMarkdown) || hasVisualDocumentMarker(tab.savedMarkdown))
    ) {
      const existing = next[tab.path];
      if (
        existing?.rawMarkdown === tab.rawMarkdown &&
        existing.savedMarkdown === tab.savedMarkdown &&
        existing.modifiedMs === tab.modifiedMs
      )
        continue;
      next[tab.path] = {
        version: 1,
        path: tab.path,
        rawMarkdown: tab.rawMarkdown,
        savedMarkdown: tab.savedMarkdown,
        modifiedMs: tab.modifiedMs,
        updatedAt: Date.now(),
      };
    } else if (
      !tab.dirty &&
      (next[tab.path]?.rawMarkdown === tab.rawMarkdown ||
        previous.find((candidate) => candidate.path === tab.path)?.dirty)
    ) {
      // Exact save, explicit Undo back to the base, or explicit discard. Merely
      // opening the clean disk version must not erase an offered recovery.
      delete next[tab.path];
    }
  }
  return next;
}

export function recoveryConflicts(snapshot: VisualRecoverySnapshot, file: VaultFile | undefined) {
  return (
    !file ||
    snapshot.savedMarkdown !== file.content ||
    (snapshot.modifiedMs != null && snapshot.modifiedMs !== file.modifiedMs)
  );
}

export function restoreVisualRecovery(tab: OpenTab, snapshot: VisualRecoverySnapshot): OpenTab {
  return {
    ...tab,
    rawMarkdown: snapshot.rawMarkdown,
    savedMarkdown: snapshot.savedMarkdown,
    modifiedMs: snapshot.modifiedMs ?? undefined,
    dirty: snapshot.rawMarkdown !== snapshot.savedMarkdown,
  };
}

export function moveVisualRecovery(
  snapshots: VisualRecoverySnapshots,
  change: PathChangeSet,
): VisualRecoverySnapshots {
  return Object.fromEntries(
    Object.entries(snapshots).map(([path, snapshot]) => {
      const nextPath = pathIsAffectedByChanges(path, change)
        ? pathAfterChanges(path, change)
        : path;
      return [nextPath, { ...snapshot, path: nextPath }];
    }),
  );
}
