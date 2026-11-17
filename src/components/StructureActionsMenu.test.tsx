import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StructureActionsMenu } from "./StructureActionsMenu";
import type { StructuredElement } from "../utils/structuredMarkdown";

function renderPanel(element: StructuredElement, overrides: Record<string, unknown> = {}) {
  const onReplace = vi.fn();
  const onDismiss = vi.fn();
  const onOpenSource = vi.fn();
  const onOpenWikilink = vi.fn();
  const onOpenUrl = vi.fn();
  render(
    <StructureActionsMenu
      element={element}
      x={10}
      y={10}
      onReplace={onReplace}
      onDismiss={onDismiss}
      onOpenSource={onOpenSource}
      onOpenWikilink={onOpenWikilink}
      onOpenUrl={onOpenUrl}
      {...overrides}
    />,
  );
  return { onReplace, onDismiss, onOpenSource, onOpenWikilink, onOpenUrl };
}

const wikilink: StructuredElement = {
  kind: "wikilink",
  from: 0,
  to: 18,
  text: "[[Aldebrand|Aldo]]",
  target: "Aldebrand",
  alias: "Aldo",
  label: "Aldo",
};

describe("StructureActionsMenu (unified format panel)", () => {
  it("shows destination and visible-text fields in a single panel, no edit step", () => {
    renderPanel(wikilink);

    // Both editable fields are present immediately — no "Edit" button first.
    expect(screen.getByDisplayValue("Aldebrand")).toBeTruthy();
    expect(screen.getByDisplayValue("Aldo")).toBeTruthy();
    expect(screen.queryByText("Edit destination and text")).toBeNull();
  });

  it("commits edited fields when the panel is dismissed by an outside click", () => {
    const { onReplace, onDismiss } = renderPanel(wikilink);

    fireEvent.change(screen.getByDisplayValue("Aldebrand"), {
      target: { value: "Aldebrand II" },
    });
    fireEvent.mouseDown(document.body);

    expect(onReplace).toHaveBeenCalledWith(wikilink, "[[Aldebrand II|Aldo]]");
    expect(onDismiss).toHaveBeenCalled();
  });

  it("cancels without committing when Escape is pressed", () => {
    const { onReplace, onDismiss } = renderPanel(wikilink);

    fireEvent.change(screen.getByDisplayValue("Aldo"), { target: { value: "Renamed" } });
    fireEvent.keyDown(document, { key: "Escape" });

    expect(onReplace).not.toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalled();
  });

  it("unlinks a wikilink to plain text", () => {
    const { onReplace } = renderPanel(wikilink);

    fireEvent.click(screen.getByRole("menuitem", { name: /Unlink/ }));

    expect(onReplace).toHaveBeenCalledWith(wikilink, "Aldo");
  });

  it("reflects wikilink resolution status and offers Open note only when resolved", () => {
    const { onOpenWikilink } = renderPanel(wikilink, {
      resolveWikilink: () => ({
        label: "Aldo",
        targetPath: "World/Aldebrand.md",
        status: "resolved",
      }),
    });

    expect(screen.getByText("Note")).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: /Open note/ }));
    expect(onOpenWikilink).toHaveBeenCalledWith("Aldebrand");
  });

  it("marks a new page when the wikilink does not resolve", () => {
    renderPanel(wikilink, {
      resolveWikilink: () => ({ label: "Aldo", status: "missing" }),
    });

    expect(screen.getByText("New page")).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: /Open note/ })).toBeNull();
  });

  it("offers heading level switches and turn-into-text in one panel", () => {
    const heading: StructuredElement = {
      kind: "heading",
      from: 0,
      to: 9,
      text: "## Title",
      label: "Title",
      level: 2,
    };
    const { onReplace } = renderPanel(heading);

    fireEvent.click(screen.getByRole("button", { name: "H1" }));
    expect(onReplace).toHaveBeenCalledWith(heading, "# Title");
  });

  it("hides the direct Source action when the mode controls are disabled", () => {
    renderPanel(wikilink, { onOpenSource: undefined });

    expect(screen.queryByRole("menuitem", { name: "Open in Source" })).toBeNull();
  });
});
