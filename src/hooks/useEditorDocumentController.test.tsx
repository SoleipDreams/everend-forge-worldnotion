import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { OpenTab } from "../editorTypes";
import { useEditorDocumentController } from "./useEditorDocumentController";

function makeTab(path: string, overrides: Partial<OpenTab> = {}): OpenTab {
  return {
    path,
    title: path,
    dirty: false,
    mode: "write",
    writingMode: "processed",
    isTemplate: false,
    rawMarkdown: "# Saved",
    savedMarkdown: "# Saved",
    ...overrides,
  };
}

describe("useEditorDocumentController", () => {
  it("updates only the targeted tab and preserves dirty content when changing modes", () => {
    let tabs = [
      makeTab("A.md", { rawMarkdown: "# Draft", dirty: true }),
      makeTab("B.md"),
    ];
    const setTabs = (update: (current: OpenTab[]) => OpenTab[]) => {
      tabs = update(tabs);
    };
    const { result } = renderHook(() =>
      useEditorDocumentController({
        getTabs: () => tabs,
        setTabs: setTabs as never,
        persistDocument: vi.fn(async () => true),
      }),
    );

    act(() => result.current.setMode("A.md", "source"));

    expect(tabs[0]).toMatchObject({ mode: "source", rawMarkdown: "# Draft", dirty: true });
    expect(tabs[1]).toMatchObject({ mode: "write", writingMode: "processed" });
  });

  it("updates markdown dirty state, reports new references, and delegates save", async () => {
    let tabs = [makeTab("A.md")];
    const setTabs = (update: (current: OpenTab[]) => OpenTab[]) => {
      tabs = update(tabs);
    };
    const onReferenceAdded = vi.fn();
    const persistDocument = vi.fn(async () => true);
    const { result } = renderHook(() =>
      useEditorDocumentController({
        getTabs: () => tabs,
        setTabs: setTabs as never,
        onReferenceAdded,
        persistDocument,
      }),
    );

    act(() => result.current.updateMarkdown("A.md", "# Draft\n\n[[New note]]"));
    expect(tabs[0]).toMatchObject({
      rawMarkdown: "# Draft\n\n[[New note]]",
      dirty: true,
    });
    expect(onReferenceAdded).toHaveBeenCalledWith("A.md", "# Saved", "# Draft\n\n[[New note]]");
    await expect(result.current.save("A.md")).resolves.toBe(true);
    expect(persistDocument).toHaveBeenCalledWith("A.md");
  });
});
