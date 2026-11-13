import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PropertyEditorPopover, type EditableOption } from "./PropertyEditorPopover";
import type { VisiblePropertyDefinition } from "../../utils/propertiesConfig";

function selectProperty(
  overrides: Partial<VisiblePropertyDefinition> = {},
): VisiblePropertyDefinition {
  return {
    id: "magic",
    label: "Magic",
    type: "select",
    source: "custom",
    options: [
      { value: "fire", label: "Fire" },
      { value: "water", label: "Water" },
    ],
    ...overrides,
  } as VisiblePropertyDefinition;
}

function renderPopover(props: Partial<React.ComponentProps<typeof PropertyEditorPopover>> = {}) {
  const anchorEl = document.createElement("button");
  document.body.appendChild(anchorEl);
  const handlers = {
    onClose: vi.fn(),
    onRename: vi.fn(),
    onChangeType: vi.fn(),
    onUpdate: vi.fn(),
    onUpdateOptions: vi.fn(),
    onSetPresentationRole: vi.fn(),
    onSetConditions: vi.fn(),
    onSetAppliesTo: vi.fn(),
    onMoveParent: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
  };
  const property = props.property ?? selectProperty();
  const result = render(
    <PropertyEditorPopover
      open
      anchorEl={anchorEl}
      property={property}
      allProperties={[property]}
      editableOptions={property.options ?? []}
      canEditOptions
      isProtected={false}
      parentId=""
      {...handlers}
      {...props}
    />,
  );
  return { ...handlers, container: result.container };
}

describe("PropertyEditorPopover", () => {
  it("renders the name and type of the property", () => {
    const { container } = renderPopover();
    expect((screen.getByLabelText("Property name") as HTMLInputElement).value).toBe("Magic");
    expect((screen.getByLabelText("Type") as HTMLSelectElement).value).toBe("select");
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.querySelector('[role="dialog"]')).toBeTruthy();
  });

  it("commits a rename on Enter", () => {
    const handlers = renderPopover();
    const input = screen.getByLabelText("Property name");
    fireEvent.change(input, { target: { value: "Sorcery" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(handlers.onRename).toHaveBeenCalledWith("Sorcery");
  });

  it("changes the property type", () => {
    const handlers = renderPopover();
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "number" } });
    expect(handlers.onChangeType).toHaveBeenCalledWith("number");
  });

  it("keeps description edits local until blur and commits the complete value once", () => {
    const handlers = renderPopover({ property: selectProperty({ description: "Old text" }) });
    const textarea = screen.getByPlaceholderText("Optional helper text");

    fireEvent.change(textarea, { target: { value: "A complete new description" } });
    expect(handlers.onUpdate).not.toHaveBeenCalled();

    fireEvent.blur(textarea);
    expect(handlers.onUpdate).toHaveBeenCalledTimes(1);
    expect(handlers.onUpdate).toHaveBeenCalledWith({
      description: "A complete new description",
    });
  });

  it("does not remount or save an option input while the user is typing", () => {
    const handlers = renderPopover();
    fireEvent.click(screen.getByRole("button", { name: /options/i }));
    const input = screen.getByDisplayValue("Fire");
    input.focus();

    fireEvent.change(input, { target: { value: "Fire magic" } });
    expect(document.activeElement).toBe(input);
    expect(handlers.onUpdateOptions).not.toHaveBeenCalled();

    fireEvent.blur(input);
    expect(handlers.onUpdateOptions).toHaveBeenCalledTimes(1);
    expect(handlers.onUpdateOptions.mock.calls[0][0][0]).toMatchObject({
      value: "fire",
      label: "Fire magic",
    });
  });

  it("shows resolved options for the type property and edits them", () => {
    // The old modal showed an empty option list for `type` because it read
    // property.options; here the resolved entity-type options are passed in.
    const typeProperty = selectProperty({ id: "type", label: "Type", options: undefined });
    const typeOptions: EditableOption[] = [
      { value: "character", label: "Character" },
      { value: "location", label: "Location" },
    ];
    const handlers = renderPopover({
      property: typeProperty,
      editableOptions: typeOptions,
    });

    fireEvent.click(screen.getByRole("button", { name: /options/i }));
    expect((screen.getByDisplayValue("Character") as HTMLInputElement).value).toBe("Character");
    expect(screen.getByDisplayValue("Location")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /add option/i }));
    expect(handlers.onUpdateOptions).toHaveBeenCalled();
    const nextOptions = handlers.onUpdateOptions.mock.calls[0][0] as EditableOption[];
    expect(nextOptions.length).toBe(typeOptions.length + 1);
  });

  it("assigns banner and portrait image fields from the Type options panel", () => {
    const typeProperty = selectProperty({ id: "type", label: "Type", options: undefined });
    const handlers = renderPopover({
      property: typeProperty,
      editableOptions: [{ value: "character", label: "Character" }],
      presentationTypes: [
        {
          id: "character",
          label: "Character",
          imageProperties: [
            { id: "portrait", label: "Portrait image" },
            { id: "banner", label: "Banner image" },
          ],
        },
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: /options/i }));
    fireEvent.change(screen.getByRole("combobox", { name: "Character portrait image" }), {
      target: { value: "portrait" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Character banner image" }), {
      target: { value: "banner" },
    });

    expect(handlers.onSetPresentationRole).toHaveBeenNthCalledWith(
      1,
      "character",
      "portrait",
      "portrait",
    );
    expect(handlers.onSetPresentationRole).toHaveBeenNthCalledWith(
      2,
      "character",
      "cover",
      "banner",
    );
  });

  it("adds a condition immediately and commits its default selectable value", () => {
    const dependent = selectProperty({ id: "detail", label: "Detail", type: "text" });
    const controller = selectProperty({ id: "magic", label: "Magic" });
    const handlers = renderPopover({
      property: dependent,
      allProperties: [dependent, controller],
      editableOptions: [],
      canEditOptions: false,
      optionSets: {
        magic: [
          { value: "fire", label: "Fire" },
          { value: "water", label: "Water" },
        ],
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Show when" }));
    fireEvent.click(screen.getByRole("button", { name: "Add condition" }));

    expect(handlers.onSetConditions).toHaveBeenCalledWith({ magic: ["fire"] });
    expect(screen.getByRole("combobox", { name: "Condition property" })).toBeTruthy();
    expect(screen.getByLabelText("Fire")).toBeTruthy();
  });

  it("duplicates and deletes via the footer actions", () => {
    const handlers = renderPopover();
    fireEvent.click(screen.getByRole("button", { name: /duplicate/i }));
    expect(handlers.onDuplicate).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(handlers.onDelete).toHaveBeenCalled();
  });

  it("disables rename and delete for protected properties", () => {
    renderPopover({
      isProtected: true,
      entityTypes: [
        { id: "character", label: "Character" },
        { id: "location", label: "Location" },
      ],
    });
    expect((screen.getByLabelText("Property name") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /^delete$/i }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.queryByText("Available on types")).toBeNull();
    expect(screen.queryByText("Show when")).toBeNull();
  });

  it("opens dense settings in a secondary panel and Escape returns to the compact menu", () => {
    const handlers = renderPopover({
      entityTypes: [
        { id: "character", label: "Character" },
        { id: "location", label: "Location" },
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: /available on types/i }));
    expect(screen.getByRole("region", { name: "Available on types" })).toBeTruthy();
    expect(screen.getByText("Character")).toBeTruthy();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Available on types" })).toBeNull();
    expect(handlers.onClose).not.toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    const handlers = renderPopover();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(handlers.onClose).toHaveBeenCalled();
  });
});
