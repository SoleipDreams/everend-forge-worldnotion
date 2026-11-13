import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createDefaultTaxonomyConfig } from "../domain";
import { makeEntity, makeVaultIndex } from "../test/fixtures";
import { InspectorPanel } from "./InspectorPanel";

describe("InspectorPanel bulk move", () => {
  it("moves the selected Explorer items to the entered folder", () => {
    const onMoveExplorerSelection = vi.fn();
    render(
      <InspectorPanel
        index={makeVaultIndex()}
        explorerSelection={[
          { path: "Notes/Ada.md", kind: "file" },
          { path: "Notes/Mara.md", kind: "file" },
        ]}
        onMoveExplorerSelection={onMoveExplorerSelection}
      />,
    );

    fireEvent.change(screen.getByLabelText("Move to folder path"), {
      target: { value: "Archive" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Move 2 items" }));

    expect(onMoveExplorerSelection).toHaveBeenCalledWith("Archive");
  });
});

describe("InspectorPanel note properties", () => {
  it("keeps presentation controls out of the inspector tabs", async () => {
    const entity = makeEntity();
    const activeTab = {
      path: entity.path,
      title: entity.name,
      dirty: false,
      mode: "write" as const,
      writingMode: "processed" as const,
      isTemplate: false,
      rawMarkdown: "---\ntype: character\nname: Mara\n---\n\nThe opening paragraph.",
      savedMarkdown: "",
    };
    render(
      <InspectorPanel
        entity={entity}
        activeTab={activeTab}
        index={makeVaultIndex({ propertiesConfig: createDefaultTaxonomyConfig() })}
        onChangeFrontmatter={vi.fn()}
        onUpdateEntity={vi.fn()}
      />,
    );

    await screen.findByText("Properties");
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("tab", { name: /presentation/i })).toBeNull();
  });
});
