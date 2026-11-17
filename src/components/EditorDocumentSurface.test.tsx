import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DEFAULT_EDITOR_SETTINGS } from "../editorTypes";
import { EditorDocumentSurface } from "./EditorDocumentSurface";

describe("EditorDocumentSurface", () => {
  it("hides mode and source view controls by default", () => {
    render(
      <EditorDocumentSurface
        document={{ path: "Notes.md", mode: "source" }}
        settings={DEFAULT_EDITOR_SETTINGS}
        modeSelector={<button type="button">Mode options</button>}
        sourceViewSelector={<select aria-label="Source view" />}
      >
        <p>Document body</p>
      </EditorDocumentSurface>,
    );

    expect(screen.getByText("Document body")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mode options" })).toBeNull();
    expect(screen.queryByLabelText("Source view")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(document.querySelector(".floating-control-panel")).toBeNull();
  });

  it("shows mode and advanced source view controls when enabled", () => {
    render(
      <EditorDocumentSurface
        document={{ path: "Notes.md", mode: "source" }}
        settings={{ ...DEFAULT_EDITOR_SETTINGS, showModeTabs: true }}
        modeSelector={<button type="button">Mode options</button>}
        sourceViewSelector={<select aria-label="Source view" />}
      >
        <p>Document body</p>
      </EditorDocumentSurface>,
    );

    expect(screen.getByRole("button", { name: "Mode options" })).toBeInTheDocument();
    expect(screen.getByLabelText("Source view")).toBeInTheDocument();
  });
});
