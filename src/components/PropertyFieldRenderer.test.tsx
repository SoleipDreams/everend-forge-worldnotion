import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CustomFieldDefinition } from "../editorTypes";
import { makeVaultIndex } from "../test/fixtures";
import { PropertyFieldRenderer } from "./PropertyFieldRenderer";

describe("PropertyFieldRenderer", () => {
  it("edits text, number, and date values with the expected input types", () => {
    const onTextChange = vi.fn();
    const textProperty: CustomFieldDefinition = {
      id: "summary",
      label: "Summary",
      type: "text",
    };
    const { rerender } = render(
      <PropertyFieldRenderer property={textProperty} value="Before" onChange={onTextChange} />,
    );
    const textInput = document.querySelector('input[type="text"]');
    expect(textInput).toHaveClass("property-field-control");
    fireEvent.change(textInput!, { target: { value: "After" } });
    expect(onTextChange).toHaveBeenCalledWith("After");

    const onNumberChange = vi.fn();
    rerender(
      <PropertyFieldRenderer
        property={{ id: "rating", label: "Rating", type: "number" }}
        value={4}
        onChange={onNumberChange}
      />,
    );
    const numberInput = document.querySelector('input[type="number"]');
    expect(numberInput).toHaveClass("property-field-control");
    fireEvent.change(numberInput!, { target: { value: "8" } });
    expect(onNumberChange).toHaveBeenCalledWith(8);

    const onDateChange = vi.fn();
    rerender(
      <PropertyFieldRenderer
        property={{ id: "when", label: "When", type: "date" }}
        value="2026-11-18"
        onChange={onDateChange}
      />,
    );
    const dateInput = document.querySelector('input[type="date"]');
    expect(dateInput).toHaveClass("property-field-control");
    fireEvent.change(dateInput!, { target: { value: "2026-12-01" } });
    expect(onDateChange).toHaveBeenCalledWith("2026-12-01");
  });

  it("toggles boolean and multiselect values", () => {
    const onBooleanChange = vi.fn();
    const { rerender, container } = render(
      <PropertyFieldRenderer
        property={{ id: "active", label: "Active", type: "boolean", description: "Enabled" }}
        value={false}
        onChange={onBooleanChange}
      />,
    );
    const booleanInput = container.querySelector('input[type="checkbox"]')!;
    fireEvent.click(booleanInput);
    expect(onBooleanChange).toHaveBeenCalledWith(true);

    const onMultiselectChange = vi.fn();
    rerender(
      <PropertyFieldRenderer
        property={{
          id: "traits",
          label: "Traits",
          type: "multiselect",
          options: [
            { value: "brave", label: "Brave" },
            { value: "wise", label: "Wise" },
          ],
        }}
        value={["brave"]}
        onChange={onMultiselectChange}
      />,
    );
    expect(container.querySelector(".property-field-multiselect")).toBeTruthy();
    const [braveInput, wiseInput] = container.querySelectorAll('input[type="checkbox"]');
    expect(braveInput).toBeChecked();
    expect(wiseInput).not.toBeChecked();
    fireEvent.click(wiseInput);
    expect(onMultiselectChange).toHaveBeenCalledWith(["brave", "wise"]);
  });

  it("renders contact fields as typed inputs with their matching actions", () => {
    const cases = [
      {
        type: "url" as const,
        value: "https://example.org/",
        inputType: "url",
        action: "Open link",
        href: "https://example.org/",
      },
      {
        type: "email" as const,
        value: "tester@example.org",
        inputType: "email",
        action: "Send email",
        href: "mailto:tester@example.org",
      },
      {
        type: "phone" as const,
        value: "+51 555 0100",
        inputType: "tel",
        action: "Call number",
        href: "tel:+51 555 0100",
      },
    ];

    for (const field of cases) {
      const { container, unmount } = render(
        <PropertyFieldRenderer
          property={{ id: field.type, label: field.type, type: field.type }}
          value={field.value}
          onChange={vi.fn()}
        />,
      );
      const input = container.querySelector(`input[type="${field.inputType}"]`);
      expect(input).toHaveClass("property-field-control");
      expect(input).toHaveValue(field.value);
      expect(screen.getByTitle(field.action)).toHaveAttribute("href", field.href);
      unmount();
    }
  });

  it("renders select fields with the WorldNotion control class", () => {
    const property: CustomFieldDefinition = {
      id: "role",
      label: "Role",
      type: "select",
      options: [
        { value: "hero", label: "Hero" },
        { value: "mentor", label: "Mentor" },
      ],
    };

    const onChange = vi.fn();
    render(<PropertyFieldRenderer property={property} value="hero" onChange={onChange} />);

    const trigger = screen.getByRole("button", { name: "Hero" });
    expect(trigger.className).toContain("property-field-control");

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: "Mentor" }));
    expect(onChange).toHaveBeenCalledWith("mentor");
  });

  it("degrades entity-ref to a text input without a vault index", () => {
    const property: CustomFieldDefinition = {
      id: "home",
      label: "Home",
      type: "entity-ref",
      targetTypes: ["location"],
    };

    render(<PropertyFieldRenderer property={property} value="iron-keep" onChange={vi.fn()} />);

    expect(screen.getByRole("textbox")).toHaveValue("iron-keep");
  });

  it("uses the entity picker when a vault index is provided", () => {
    const property: CustomFieldDefinition = {
      id: "home",
      label: "Home",
      type: "entity-ref",
      targetTypes: ["location"],
    };

    render(
      <PropertyFieldRenderer
        property={property}
        value="iron-keep"
        onChange={vi.fn()}
        vaultIndex={makeVaultIndex()}
      />,
    );

    expect(screen.getByText("Iron Keep")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("renders multiple entity references as a wrapping chip list", () => {
    const property: CustomFieldDefinition = {
      id: "affiliation",
      label: "Affiliation",
      type: "entity-ref-list",
      targetTypes: ["organization"],
    };

    const baseEntity = makeVaultIndex().entities[0];
    const index = makeVaultIndex({
      entities: [
        { ...baseEntity, id: "empire", type: "organization", name: "Imperio del Norte" },
        {
          ...baseEntity,
          id: "squadron",
          type: "organization",
          name: "Escuadrón de la Frontera",
        },
      ],
    });

    render(
      <PropertyFieldRenderer
        property={property}
        value={["empire", "squadron"]}
        onChange={vi.fn()}
        vaultIndex={index}
      />,
    );

    expect(screen.getByText("Imperio del Norte")).toBeInTheDocument();
    expect(screen.getByText("Escuadrón de la Frontera")).toBeInTheDocument();
    expect(screen.getByText("Imperio del Norte").closest(".entity-ref-list-field")).toBeTruthy();
  });
});
