import type { PathChangeSet } from "../utils/pathUtils";
import { pathAfterChanges, pathIsAffectedByChanges } from "../utils/pathUtils";
import type { VisualDocumentSession } from "./types";

export type VisualDocumentSessions = Record<string, VisualDocumentSession>;

/** Includes unmounted documents: manual forms remain recoverable in session. */
export function pendingVisualDraft(sessions: VisualDocumentSessions | undefined, paths?: readonly string[]) {
  for (const [path, session] of Object.entries(sessions ?? {})) {
    if (paths && !paths.includes(path)) continue;
    for (const [key, draft] of Object.entries(session.drafts ?? {})) {
      return { path, key, label: draft.label || key };
    }
  }
  return undefined;
}

export function moveVisualSessions(sessions: VisualDocumentSessions | undefined, change: PathChangeSet): VisualDocumentSessions {
  return Object.fromEntries(Object.entries(sessions ?? {}).map(([path, session]) => [
    pathIsAffectedByChanges(path, change) ? pathAfterChanges(path, change) : path,
    session,
  ]));
}
