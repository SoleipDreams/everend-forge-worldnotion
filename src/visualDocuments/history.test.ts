import { describe, expect, it } from "vitest";
import { VisualDocumentHistory } from "./history";

describe("visual document undo", () => {
  it("coalesces an edit gesture, restores raw snapshots and clears redo after a new edit", () => {
    const history = new VisualDocumentHistory();
    history.record("saved", "drag-1", "Move", 0);
    history.record("drag-1", "drag-2", "Move", 10);
    expect(history.undo("drag-2")).toBe("saved");
    expect(history.redo("saved")).toBe("drag-2");
    expect(history.undo("drag-2")).toBe("saved");
    history.record("saved", "new", "Add", 1000);
    expect(history.redo("new")).toBeUndefined();
    expect(history.undo("new")).toBe("saved");
  });
  it("never overwrites intervening source edits or another document", () => {
    const history = new VisualDocumentHistory();
    history.record("base", "visual");
    expect(history.undo("source changed")).toBeUndefined();
    const other = new VisualDocumentHistory();
    expect(other.undo("visual")).toBeUndefined();
    history.record("source changed", "next");
    expect(history.undo("next")).toBe("source changed");
    expect(history.undo("source changed")).toBeUndefined();
  });
});
