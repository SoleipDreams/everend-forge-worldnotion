import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VariantSelector } from "./VariantSelector";

describe("VariantSelector", () => {
  it("creates a named variant and selects it locally", () => {
    const onSelect = vi.fn();
    const onUpdateRawYaml = vi.fn();
    render(
      <VariantSelector
        rawYaml={"---\nid: mara\ntype: character\nname: Mara\n---"}
        activeVariantId="base"
        onSelect={onSelect}
        onUpdateRawYaml={onUpdateRawYaml}
      />,
    );

    const selector = screen.getByRole("combobox", { name: "Variant" });
    const createOption = screen.getByRole("option", { name: /Create new variant/ });
    fireEvent.change(selector, { target: { value: createOption.getAttribute("value") } });
    fireEvent.change(screen.getByLabelText("New variant name"), {
      target: { value: "Mara adulta" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(onSelect).toHaveBeenCalledWith("mara-adulta");
    expect(onUpdateRawYaml.mock.calls[0]?.[0]).toContain("mara-adulta:");
    expect(onUpdateRawYaml.mock.calls[0]?.[0]).toContain("label: Mara adulta");
  });

  it("selects an existing variant without rewriting the note", () => {
    const onSelect = vi.fn();
    const onUpdateRawYaml = vi.fn();
    render(
      <VariantSelector
        rawYaml={
          "---\nid: mara\ntype: character\nname: Mara\nvariants:\n  base:\n    label: Canon\n  adulta:\n    label: Mara adulta\n---"
        }
        activeVariantId="base"
        onSelect={onSelect}
        onUpdateRawYaml={onUpdateRawYaml}
      />,
    );

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "adulta" } });
    expect(onSelect).toHaveBeenCalledWith("adulta");
    expect(onUpdateRawYaml).not.toHaveBeenCalled();
  });

  it("uses the selected variant name as the dropdown heading", () => {
    render(
      <VariantSelector
        rawYaml={
          "---\nvariants:\n  base:\n    label: Canon\n  adulta:\n    label: Mara adulta\n---"
        }
        activeVariantId="adulta"
        onSelect={vi.fn()}
        onUpdateRawYaml={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Variant" })).toHaveValue("adulta");
  });
});
