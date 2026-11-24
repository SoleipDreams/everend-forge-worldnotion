import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CustomFieldDefinition } from "../../../editorTypes";
import { makeEntity, makeVaultIndex } from "../../../test/fixtures";
import {
  EntityRefField,
  entityPickerItems,
  parseEntityRef,
  buildEntityRef,
} from "./EntityRefField";
import { EntityRefListField } from "./EntityRefListField";

const refProperty: CustomFieldDefinition = {
  id: "home",
  label: "Home",
  type: "entity-ref",
  targetTypes: ["location"],
};

describe("entityPickerItems", () => {
  it("filters by targetTypes and excludes selected ids", () => {
    const index = makeVaultIndex();

    const items = entityPickerItems(index, ["location"]);
    expect(items.map((item) => item.id)).toEqual(["iron-keep"]);

    const excluded = entityPickerItems(index, undefined, new Set(["mara"]));
    expect(excluded.map((item) => item.id)).toEqual(["iron-keep"]);
  });
});

describe("EntityRefField", () => {
  it("resolves the stored id to the entity name", () => {
    render(
      <EntityRefField
        property={refProperty}
        value="iron-keep"
        onChange={vi.fn()}
        vaultIndex={makeVaultIndex()}
      />,
    );

    expect(screen.getByText("Iron Keep")).toBeInTheDocument();
  });

  it("marks unresolved ids", () => {
    render(
      <EntityRefField
        property={refProperty}
        value="ghost-id"
        onChange={vi.fn()}
        vaultIndex={makeVaultIndex()}
      />,
    );

    expect(screen.getByText("ghost-id").closest("button")).toHaveClass("entity-ref-unresolved");
  });

  it("stores the entity id when picking from the popover", () => {
    const onChange = vi.fn();
    render(
      <EntityRefField
        property={refProperty}
        value=""
        onChange={onChange}
        vaultIndex={makeVaultIndex()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /link location/i }));
    fireEvent.click(screen.getByRole("option", { name: /iron keep/i }));

    expect(onChange).toHaveBeenCalledWith("iron-keep");
  });

  it("opens the referenced entity", () => {
    const onOpenEntity = vi.fn();
    render(
      <EntityRefField
        property={refProperty}
        value="iron-keep"
        onChange={vi.fn()}
        vaultIndex={makeVaultIndex()}
        onOpenEntity={onOpenEntity}
      />,
    );

    fireEvent.click(screen.getByTitle("Open Iron Keep"));
    expect(onOpenEntity).toHaveBeenCalledWith("Places/Iron.md");
  });

  it("displays variant in label when variant is selected", () => {
    const index = makeVaultIndex({
      entities: [
        makeEntity({
          id: "iron-keep",
          type: "location",
          name: "Iron Keep",
          path: "Places/Iron.md",
          variants: [{ id: "ancient", label: "Ancient" }],
        }),
      ],
    });

    const { container } = render(
      <EntityRefField
        property={refProperty}
        value="iron-keep@ancient"
        onChange={vi.fn()}
        vaultIndex={index}
      />,
    );

    expect(container.querySelector(".entity-ref-chip-label")).toHaveTextContent("Ancient");
    expect(screen.queryByText("Iron Keep @ Ancient")).not.toBeInTheDocument();
  });
});

describe("Entity reference parsing", () => {
  it("parseEntityRef splits entity-id@variant-id format", () => {
    expect(parseEntityRef("mara@older")).toEqual({ entityId: "mara", variantId: "older" });
    expect(parseEntityRef("mara")).toEqual({ entityId: "mara", variantId: undefined });
  });

  it("buildEntityRef constructs the reference format", () => {
    expect(buildEntityRef("mara")).toBe("mara");
    expect(buildEntityRef("mara", "older")).toBe("mara@older");
  });
});

describe("EntityRefListField", () => {
  it("renders chips, removes ids, and appends new picks", () => {
    const onChange = vi.fn();
    const index = makeVaultIndex({
      entities: [
        makeEntity(),
        makeEntity({
          id: "iron-keep",
          type: "location",
          name: "Iron Keep",
          path: "Places/Iron.md",
        }),
        makeEntity({ id: "lys", type: "character", name: "Lys", path: "Characters/Lys.md" }),
      ],
    });

    render(
      <EntityRefListField
        property={{ id: "allies", label: "Allies", type: "entity-ref-list" }}
        value={["mara"]}
        onChange={onChange}
        vaultIndex={index}
      />,
    );

    expect(screen.getByText("Mara")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Remove"));
    expect(onChange).toHaveBeenCalledWith([]);

    fireEvent.click(screen.getByTitle("Add entity"));
    fireEvent.click(screen.getByRole("option", { name: /lys/i }));
    expect(onChange).toHaveBeenCalledWith(["mara", "lys"]);
  });

  it("uses the selected variant label for list chips", () => {
    const index = makeVaultIndex({
      entities: [
        makeEntity({
          id: "mara",
          name: "Mara",
          variants: [{ id: "older", label: "Mara adulta" }],
        }),
      ],
    });

    const { container } = render(
      <EntityRefListField
        property={{ id: "affiliation", label: "Affiliation", type: "entity-ref-list" }}
        value={["mara@older"]}
        onChange={vi.fn()}
        vaultIndex={index}
      />,
    );

    expect(container.querySelector(".entity-ref-chip-label")).toHaveTextContent("Mara adulta");
    expect(screen.queryByText("Mara @ Mara adulta")).not.toBeInTheDocument();
  });
});
