import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EditorModeSelector } from "./EditorModeSelector";

const labels = {
  mode: "Editor mode",
  writing: "Writing",
  processed: "Processed",
  semi: "Semi-processed",
  source: "Source",
};

describe("EditorModeSelector", () => {
  it("selects Processed, Semi-processed, and Source from one accessible group", () => {
    const onWritingModeChange = vi.fn();
    const onOpenSource = vi.fn();
    render(
      <EditorModeSelector
        mode="write"
        writingMode="processed"
        labels={labels}
        onWritingModeChange={onWritingModeChange}
        onOpenSource={onOpenSource}
      />,
    );

    const group = screen.getByRole("radiogroup", { name: "Editor mode" });
    expect(group).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Semi-processed" }));
    expect(onWritingModeChange).toHaveBeenCalledWith("semi");

    fireEvent.click(screen.getByRole("radio", { name: "Source" }));
    expect(onOpenSource).toHaveBeenCalledOnce();
  });

  it("supports arrow navigation between modes", async () => {
    const onWritingModeChange = vi.fn();
    render(
      <EditorModeSelector
        mode="write"
        writingMode="processed"
        labels={labels}
        onWritingModeChange={onWritingModeChange}
        onOpenSource={vi.fn()}
      />,
    );

    const processed = screen.getByRole("radio", { name: "Processed" });
    const semi = screen.getByRole("radio", { name: "Semi-processed" });
    processed.focus();
    fireEvent.keyDown(processed, { key: "ArrowRight" });
    await waitFor(() => expect(semi).toHaveFocus());
    expect(onWritingModeChange).toHaveBeenCalledWith("semi");
  });

  it("keeps source available when structured files disable writing modes", () => {
    const onOpenSource = vi.fn();
    render(
      <EditorModeSelector
        mode="source"
        writingMode="processed"
        disabled
        labels={labels}
        onWritingModeChange={vi.fn()}
        onOpenSource={onOpenSource}
      />,
    );

    expect(screen.getByRole("radio", { name: "Processed" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Semi-processed" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "Source" }));
    expect(onOpenSource).toHaveBeenCalledOnce();
  });
});
