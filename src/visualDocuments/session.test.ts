import { describe, expect, it } from "vitest";
import { moveVisualSessions, pendingVisualDraft } from "./session";

describe("manual visual draft recovery", () => {
  it("finds an unmounted draft even with no dirty Markdown or selected editor", () => {
    const sessions = {
      "Timeline.md": { viewport: { x: 20, y: 0, zoom: 2 } },
      "Trees/Past.md": { drafts: { "tree-variant": { value: "Future", label: "New variant" } } },
    };
    expect(pendingVisualDraft(sessions)).toEqual({ path: "Trees/Past.md", key: "tree-variant", label: "New variant" });
    expect(pendingVisualDraft(sessions, ["Timeline.md"])).toBeUndefined();
    expect(pendingVisualDraft(sessions, ["Trees/Past.md"])).toBeDefined();
  });

  it("retains tree and timeline drafts across folder moves and clears only explicit removals", () => {
    const sessions = {
      "Tools/Tree.md": { drafts: { variant: { value: "Future", label: "Variant" } } },
      "Tools/Timeline.md": { drafts: { "timeline.date:event:start": { value: { year: 20, precision: "year" }, label: "Date" } } },
    };
    const moved = moveVisualSessions(sessions, { fromPath: "Tools", toPath: "History", mode: "tree" });
    expect(Object.keys(moved)).toEqual(["History/Tree.md", "History/Timeline.md"]);
    expect(pendingVisualDraft(moved)?.path).toBe("History/Tree.md");
    moved["History/Tree.md"] = { drafts: {} };
    expect(pendingVisualDraft(moved)?.path).toBe("History/Timeline.md");
    moved["History/Timeline.md"] = { drafts: {} };
    expect(pendingVisualDraft(moved)).toBeUndefined();
    expect(sessions["Tools/Tree.md"].drafts.variant.value).toBe("Future");
  });
});
