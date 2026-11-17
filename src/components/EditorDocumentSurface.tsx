import type { CSSProperties, ReactNode } from "react";
import type { EditorSettings, OpenTab } from "../editorTypes";

export type EditorDocumentSurfaceProps = {
  document: Pick<OpenTab, "path" | "mode">;
  settings: EditorSettings;
  shellRef?: (element: HTMLElement | null) => void;
  onActivate?: () => void;
  visualAction?: ReactNode;
  modeSelector?: ReactNode;
  sourceViewSelector?: ReactNode;
  floatingToolbar?: ReactNode;
  selectionToolbar?: ReactNode;
  saveError?: ReactNode;
  recovery?: ReactNode;
  loading?: ReactNode;
  children: ReactNode;
  outline?: ReactNode;
};

/** Composes the shared editor chrome around a document while leaving editing and persistence to its controller. */
export function EditorDocumentSurface({
  document,
  settings,
  shellRef,
  onActivate,
  visualAction,
  modeSelector,
  sourceViewSelector,
  floatingToolbar,
  selectionToolbar,
  saveError,
  recovery,
  loading,
  children,
  outline,
}: EditorDocumentSurfaceProps) {
  const showModeSelector = settings.showModeTabs && Boolean(modeSelector);
  const showSourceViewSelector =
    settings.showModeTabs && document.mode === "source" && Boolean(sourceViewSelector);

  return (
    <section
      className="editor-shell dock-panel-body"
      data-onboarding-target="worldnotion.document"
      data-document-path={document.path}
      ref={shellRef}
      onMouseDownCapture={onActivate}
      onFocusCapture={onActivate}
    >
      {visualAction || showModeSelector || showSourceViewSelector ? (
        <div className="floating-control-panel">
          {visualAction}
          {showModeSelector ? modeSelector : null}
          {showSourceViewSelector ? sourceViewSelector : null}
        </div>
      ) : null}

      {floatingToolbar}
      {selectionToolbar}
      {saveError}
      {recovery}
      {loading}

      <div
        className={`editor-surface page-style-${settings.pageStyle} mode-${document.mode}${
          settings.showPaperShadow && document.mode === "write" ? " paper-shadow" : ""
        }${settings.outlineGuideEnabled && outline ? " outline-visible" : ""}`}
        style={
          settings.pageStyle === "custom"
            ? ({ "--wn-custom-page": settings.customPageColor } as CSSProperties)
            : undefined
        }
      >
        <div className="editor-document-column">{children}</div>
        {settings.outlineGuideEnabled ? outline : null}
      </div>
    </section>
  );
}
