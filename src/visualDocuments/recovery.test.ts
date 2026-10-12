import { beforeEach, describe, expect, it } from "vitest";
import { createRelationshipDocument } from "./relationships";
import { createVisualDocumentMarkdown } from "./markdown";
import { createOpenTabFromFile } from "../utils/tabUtils";
import { markTabSaved } from "../utils/editorPersistence";
import {
  moveVisualRecovery,
  readVisualRecovery,
  recordVisualTabs,
  recoveryConflicts,
  restoreVisualRecovery,
  visualRecoveryKey,
  writeVisualRecovery,
} from "./recovery";

const root = "fixture";
const saved = createVisualDocumentMarkdown("Tree", createRelationshipDocument());
const file = {
  relativePath: "Tree.md",
  absolutePath: "fixture/Tree.md",
  content: saved,
  modifiedMs: 10,
};
const clean = createOpenTabFromFile(file, "write");
const dirty = { ...clean, rawMarkdown: `${saved}\nPending notes`, dirty: true };
beforeEach(() => localStorage.clear());

describe("authored visual recovery", () => {
  it("keeps raw data separate, survives an ordinary clean reopen, and isolates universes", () => {
    const snapshots = recordVisualTabs({}, [dirty], [clean]);
    writeVisualRecovery(root, snapshots);
    const loaded = readVisualRecovery(root);
    expect(recordVisualTabs(loaded, [clean], [])).toEqual(loaded);
    expect(restoreVisualRecovery(clean, loaded[clean.path])).toMatchObject({
      rawMarkdown: dirty.rawMarkdown,
      savedMarkdown: saved,
      modifiedMs: 10,
      dirty: true,
    });
    expect(readVisualRecovery("other")).toEqual({});
  });

  it("retains newer edits after an exact snapshot write and only removes an exact saved draft", () => {
    const snapshots = recordVisualTabs({}, [dirty], [clean]);
    const newer = { ...dirty, rawMarkdown: `${dirty.rawMarkdown}\nLater` };
    const afterWrite = markTabSaved(newer, 11, dirty.rawMarkdown);
    const next = recordVisualTabs(snapshots, [afterWrite], [newer]);
    expect(next[clean.path]).toMatchObject({
      rawMarkdown: newer.rawMarkdown,
      savedMarkdown: dirty.rawMarkdown,
      modifiedMs: 11,
    });
    const savedTab = markTabSaved(afterWrite, 12);
    expect(recordVisualTabs(next, [savedTab], [afterWrite])).toEqual({});
    expect(recordVisualTabs(snapshots, [clean], [dirty])).toEqual({});
  });

  it("retains closed snapshots and relocates them with authored file moves", () => {
    const snapshots = recordVisualTabs({}, [dirty], [clean]);
    expect(recordVisualTabs(snapshots, [], [dirty])).toEqual(snapshots);
    expect(
      moveVisualRecovery(snapshots, {
        mode: "single",
        fromPath: "Tree.md",
        toPath: "Trees/Family.md",
      })["Trees/Family.md"],
    ).toMatchObject({ path: "Trees/Family.md", rawMarkdown: dirty.rawMarkdown });
  });

  it("detects changed contents, timestamps and missing files without changing the snapshot", () => {
    const snapshot = recordVisualTabs({}, [dirty], [clean])[clean.path];
    expect(recoveryConflicts(snapshot, file)).toBe(false);
    expect(recoveryConflicts(snapshot, { ...file, content: "External" })).toBe(true);
    expect(recoveryConflicts(snapshot, { ...file, modifiedMs: 20 })).toBe(true);
    expect(recoveryConflicts(snapshot, undefined)).toBe(true);
    expect(snapshot.savedMarkdown).toBe(saved);
  });

  it("preserves unsupported recovery versions and does not normalize unsupported visual source", () => {
    const raw = JSON.stringify({
      "Tree.md": { version: 99, path: "Tree.md", rawMarkdown: "foreign" },
    });
    localStorage.setItem(visualRecoveryKey(root), raw);
    expect(() => readVisualRecovery(root)).toThrow(/Unsupported/);
    expect(localStorage.getItem(visualRecoveryKey(root))).toBe(raw);
    const snapshot = recordVisualTabs(
      {},
      [{ ...dirty, rawMarkdown: saved.replace("version: 1", "version: 99") }],
      [clean],
    )[clean.path];
    expect(restoreVisualRecovery(clean, snapshot).rawMarkdown).toContain("version: 99");
  });
});
