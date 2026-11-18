import { fireEvent, render, screen } from "@testing-library/react";
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
  it("selects Processed, Semi-processed, and Source from one accessible dropdown", () => {
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

    const dropdown = screen.getByRole("combobox", { name: "Editor mode" });
    fireEvent.change(dropdown, { target: { value: "semi" } });
    expect(onWritingModeChange).toHaveBeenCalledWith("semi");

    fireEvent.change(dropdown, { target: { value: "source" } });
    expect(onOpenSource).toHaveBeenCalledOnce();
  });

  it("updates the writing mode from the dropdown", () => {
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

    const dropdown = screen.getByRole("combobox", { name: "Editor mode" });
    fireEvent.change(dropdown, { target: { value: "semi" } });
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

    expect(screen.getByRole("option", { name: "Processed" })).toBeDisabled();
    expect(screen.getByRole("option", { name: "Semi-processed" })).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox", { name: "Editor mode" }), {
      target: { value: "source" },
    });
    expect(onOpenSource).toHaveBeenCalledOnce();
  });
});
