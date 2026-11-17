import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { DefaultEditorMode, OpenTab, SourceViewMode, WritingMode } from "../editorTypes";
import { bodyToRawMarkdown } from "../utils/contentTemplates";
import { applyEditorModeToOpenTabs, withTabEditorMode } from "../utils/tabUtils";

export type EditorDocumentControllerOptions = {
  getTabs: () => OpenTab[];
  setTabs: Dispatch<SetStateAction<OpenTab[]>>;
  onReferenceAdded?: (path: string, previousMarkdown: string, nextMarkdown: string) => void;
  persistDocument: (path: string) => Promise<boolean>;
};

/** Coordinates editor-only transitions while the workspace remains the source of document state. */
export function useEditorDocumentController({
  getTabs,
  setTabs,
  onReferenceAdded,
  persistDocument,
}: EditorDocumentControllerOptions) {
  const setMode = useCallback(
    (path: string, mode: OpenTab["mode"]) => {
      setTabs((current) =>
        current.map((tab) => (tab.path === path ? withTabEditorMode(tab, mode) : tab)),
      );
    },
    [setTabs],
  );

  const setWritingMode = useCallback(
    (path: string, mode: WritingMode) => {
      setTabs((current) =>
        current.map((tab) => (tab.path === path ? withTabEditorMode(tab, mode) : tab)),
      );
    },
    [setTabs],
  );

  const setSourceView = useCallback(
    (path: string, sourceView: SourceViewMode) => {
      setTabs((current) =>
        current.map((tab) => (tab.path === path ? { ...tab, mode: "source", sourceView } : tab)),
      );
    },
    [setTabs],
  );

  const applyModeToOpenTabs = useCallback(
    (mode: DefaultEditorMode) => {
      setTabs((current) => applyEditorModeToOpenTabs(current, mode));
    },
    [setTabs],
  );

  const toggleMode = useCallback(
    (path: string) => {
      setTabs((current) =>
        current.map((tab) =>
          tab.path === path
            ? withTabEditorMode(tab, tab.mode === "write" ? "source" : "write")
            : tab,
        ),
      );
    },
    [setTabs],
  );

  const updateMarkdown = useCallback(
    (path: string, markdown: string) => {
      const previous = getTabs().find((tab) => tab.path === path);
      if (previous && previous.rawMarkdown !== markdown) {
        onReferenceAdded?.(path, previous.rawMarkdown, markdown);
      }

      setTabs((current) =>
        current.map((tab) => {
          if (tab.path !== path) return tab;
          const rawMarkdown = tab.mode === "write" ? bodyToRawMarkdown(tab, markdown) : markdown;
          return {
            ...tab,
            rawMarkdown,
            dirty: rawMarkdown !== tab.savedMarkdown,
          };
        }),
      );
    },
    [getTabs, onReferenceAdded, setTabs],
  );

  const save = useCallback((path: string) => persistDocument(path), [persistDocument]);

  return {
    setMode,
    setWritingMode,
    setSourceView,
    applyModeToOpenTabs,
    toggleMode,
    updateMarkdown,
    save,
  };
}
