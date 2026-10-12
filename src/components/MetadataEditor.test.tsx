import { fireEvent, render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import { type ReactElement, type ReactNode, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Entity } from "../domain";
import { createDefaultTaxonomyConfig } from "../domain";
import { applyPropertyTemplate, WORLDBUILDING_TEMPLATE } from "../utils/propertyTemplates";
import {
  listVisibleProperties,
  parseFrontmatterRaw,
  upsertInspectorProperty,
} from "../utils/propertiesConfig";
import { validatePropertiesConfig } from "../utils/propertiesSerializer";
import { normalizeCoreBaseProperties } from "../utils/taxonomyConfig";
import { makeVaultIndex } from "../test/fixtures";
import { MetadataEditor } from "./MetadataEditor";
import { ToastProvider } from "./ToastProvider";
import { DialogProvider } from "./DialogProvider";

// MetadataEditor uses useToast() and useAppDialogs(), so every render needs both.
function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <DialogProvider>{children}</DialogProvider>
    </ToastProvider>
  );
}

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: Providers });
}

function entity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: "mara",
    type: "character",
    name: "Mara",
    status: "draft",
    tags: [],
    aliases: [],
    childrenIds: [],
    customProperties: {},
    body: "",
    path: "Mara.md",
    file: {
      relativePath: "Mara.md",
      absolutePath: "Mara.md",
      content: "",
      modifiedMs: 0,
    },
    wikilinks: [],
    backlinks: [],
    ...overrides,
  };
}

describe("MetadataEditor inspector", () => {
  it("silently normalizes property order and does not show an order warning", async () => {
    const config = applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE);
    const onUpdateRawYaml = vi.fn();

    render(
      <MetadataEditor
        entity={entity()}
        propertiesConfig={config}
        rawYaml={"---\nstatus: draft\ntype: character\n---"}
        onUpdate={vi.fn()}
        onUpdateRawYaml={onUpdateRawYaml}
      />,
    );

    await waitFor(() => expect(onUpdateRawYaml).toHaveBeenCalledTimes(1));
    expect(Object.keys(parseFrontmatterRaw(onUpdateRawYaml.mock.calls[0]?.[0]))).toEqual([
      "type",
      "status",
    ]);
    expect(screen.queryByText(/Wrong order/i)).toBeNull();
    expect(screen.queryByText(/Auto-reorder/i)).toBeNull();
  });

  it("keeps missing-field actions working after order normalization is hidden", async () => {
    const config = applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE);
    const onUpdateRawYaml = vi.fn();

    render(
      <MetadataEditor
        entity={entity()}
        propertiesConfig={config}
        rawYaml={"---\ntype: character\nstatus: draft\n---"}
        onUpdate={vi.fn()}
        onUpdateRawYaml={onUpdateRawYaml}
      />,
    );

    expect(screen.queryByText(/Wrong order/i)).toBeNull();
    const addAll = screen.getByRole("button", { name: "Add all" });
    fireEvent.click(addAll);

    await waitFor(() => expect(onUpdateRawYaml).toHaveBeenCalledTimes(1));
    expect(Object.keys(parseFrontmatterRaw(onUpdateRawYaml.mock.calls[0]?.[0]))).toEqual(
      expect.arrayContaining(["id", "type", "name", "status", "tags", "aliases"]),
    );
    expect(screen.getByText(/Missing fields/)).toBeTruthy();
  });

  it("shows visible and hidden properties in the inspector context menu", () => {
    const config = applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE);

    render(
      <MetadataEditor
        entity={entity()}
        propertiesConfig={config}
        rawYaml={"---\ntype: character\nstatus: draft\n---"}
        onUpdate={vi.fn()}
        onUpdatePropertiesConfig={vi.fn()}
      />,
    );

    fireEvent.contextMenu(screen.getByText("Properties"));
    const menu = screen.getByRole("menu");

    expect(within(menu).getByText("Role")).toBeTruthy();
    expect(within(menu).getByText("Rarity")).toBeTruthy();
  });

  it("uses entity core values to keep typed hierarchy visible when yaml omits type", () => {
    const config = applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE);

    render(
      <MetadataEditor
        entity={entity({ type: "character" })}
        propertiesConfig={config}
        rawYaml={"---\nstatus: draft\n---"}
        onUpdate={vi.fn()}
        onUpdatePropertiesConfig={vi.fn()}
      />,
    );

    expect(screen.getByText("Role")).toBeTruthy();
  });

  it("keeps property filtering out of the inspector", () => {
    const config = applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE);

    render(
      <MetadataEditor
        entity={entity()}
        propertiesConfig={config}
        rawYaml={"---\ntype: character\nstatus: draft\n---"}
        onUpdate={vi.fn()}
      />,
    );

    expect(screen.queryByRole("textbox", { name: "Filter properties" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Property filter match" })).toBeNull();
    expect(screen.getByRole("button", { name: "Show hidden" })).toBeTruthy();
    expect(screen.getByText("Role")).toBeTruthy();
    expect(screen.getByText("Lore Level")).toBeTruthy();
  });

  it("adds an existing schema property to the note via the add-property picker", () => {
    const config = applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE);
    const onUpdateRawYaml = vi.fn();

    render(
      <MetadataEditor
        entity={entity()}
        propertiesConfig={config}
        rawYaml={"---\ntype: character\nstatus: draft\n---"}
        onUpdate={vi.fn()}
        onUpdateRawYaml={onUpdateRawYaml}
        onUpdatePropertiesConfig={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add existing" }));
    const listbox = screen.getByRole("listbox");
    const roleOption = within(listbox)
      .getAllByRole("option")
      .find((option) => within(option).queryByText("Role"));
    expect(roleOption).toBeTruthy();
    fireEvent.click(roleOption!);

    const nextYaml = onUpdateRawYaml.mock.calls[0]?.[0] as string;
    expect(nextYaml).toContain("role:");
  });

  it("persists a typed schema property and initializes it in the note", async () => {
    const config = applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE);
    const onUpdateRawYaml = vi.fn();
    const onUpdatePropertiesConfig = vi.fn();

    render(
      <MetadataEditor
        entity={entity()}
        propertiesConfig={config}
        rawYaml={"---\ntype: character\nstatus: draft\n---"}
        onUpdate={vi.fn()}
        onUpdateRawYaml={onUpdateRawYaml}
        onUpdatePropertiesConfig={onUpdatePropertiesConfig}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add property" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "Secret Motive" },
    });
    fireEvent.change(within(dialog).getByLabelText("Type"), {
      target: { value: "image" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add property" }));

    const savedConfig = onUpdatePropertiesConfig.mock.calls[0]?.[0];
    const property = savedConfig.customFields.definitions.find(
      (candidate: { id: string }) => candidate.id === "secret-motive",
    );
    expect(property).toMatchObject({ id: "secret-motive", type: "image" });
    expect(
      listVisibleProperties(savedConfig, "character").map((candidate) => candidate.id),
    ).toContain("secret-motive");
    await waitFor(() => expect(onUpdateRawYaml).toHaveBeenCalledTimes(1));
    expect(onUpdateRawYaml.mock.calls[0]?.[0]).toContain("secret-motive:");
  });

  it("uploads a computer image into an image property and writes its vault path to YAML", async () => {
    const config = upsertInspectorProperty(
      applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE),
      { id: "portrait", label: "Portrait", type: "image", appliesTo: ["character"] },
      "character",
    );
    const onUpdateRawYaml = vi.fn();
    const onRequestImage = vi.fn().mockResolvedValue({
      path: "attachments/mara-portrait.png",
      alt: "mara-portrait",
    });

    render(
      <MetadataEditor
        entity={entity()}
        propertiesConfig={config}
        rawYaml={"---\ntype: character\nstatus: draft\nportrait: ''\n---"}
        vaultIndex={makeVaultIndex()}
        onUpdate={vi.fn()}
        onUpdateRawYaml={onUpdateRawYaml}
        onRequestImage={onRequestImage}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Pick image" }));
    fireEvent.click(screen.getByRole("button", { name: "Upload from computer" }));

    await waitFor(() => expect(onRequestImage).toHaveBeenCalledTimes(1));
    expect(parseFrontmatterRaw(onUpdateRawYaml.mock.calls[0]?.[0])).toMatchObject({
      portrait: "attachments/mara-portrait.png",
    });
  });

  it("registers an existing custom note type and scopes its new property to it", () => {
    const config = {
      ...createDefaultTaxonomyConfig(),
      entityTypes: {
        ...createDefaultTaxonomyConfig().entityTypes,
        definitions: createDefaultTaxonomyConfig().entityTypes.definitions.filter(
          (definition) => definition.id !== "world",
        ),
      },
    };
    const onUpdatePropertiesConfig = vi.fn();

    render(
      <MetadataEditor
        entity={entity({ type: "world" })}
        propertiesConfig={config}
        rawYaml={"---\ntype: world\nstatus: draft\n---"}
        onUpdate={vi.fn()}
        onUpdatePropertiesConfig={onUpdatePropertiesConfig}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add property" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Era" } });
    fireEvent.change(within(dialog).getByLabelText("Type"), { target: { value: "select" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add property" }));

    const savedConfig = onUpdatePropertiesConfig.mock.calls[0]?.[0];
    const property = savedConfig.customFields.definitions.find(
      (candidate: { id: string }) => candidate.id === "era",
    );
    expect(property).toMatchObject({
      id: "era",
      type: "select",
      options: [{ value: "option-1", label: "Option 1" }],
      appliesTo: ["world"],
    });
    const normalized = normalizeCoreBaseProperties(savedConfig);
    expect(normalized.entityTypes.definitions).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "world", label: "World" })]),
    );
    expect(listVisibleProperties(normalized, "world").map((candidate) => candidate.id)).toContain(
      "era",
    );
    expect(validatePropertiesConfig(normalized).valid).toBe(true);
  });

  it("keeps a newly created property in the Inspector while its save is pending", () => {
    const onUpdatePropertiesConfig = vi.fn(() => new Promise<void>(() => undefined));

    render(
      <MetadataEditor
        entity={entity()}
        propertiesConfig={applyPropertyTemplate(
          createDefaultTaxonomyConfig(),
          WORLDBUILDING_TEMPLATE,
        )}
        rawYaml={"---\ntype: character\nstatus: draft\n---"}
        onUpdate={vi.fn()}
        onUpdatePropertiesConfig={onUpdatePropertiesConfig}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add property" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Portrait" } });
    fireEvent.change(within(dialog).getByLabelText("Type"), { target: { value: "image" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add property" }));

    expect(onUpdatePropertiesConfig).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Portrait")).toBeTruthy();
  });

  it("keeps the creation dialog open and does not change YAML when schema persistence fails", async () => {
    const onUpdateRawYaml = vi.fn();
    const onUpdatePropertiesConfig = vi.fn(() =>
      Promise.reject(new Error("Could not save properties configuration.")),
    );

    render(
      <MetadataEditor
        entity={entity()}
        propertiesConfig={applyPropertyTemplate(
          createDefaultTaxonomyConfig(),
          WORLDBUILDING_TEMPLATE,
        )}
        rawYaml={"---\ntype: character\nstatus: draft\n---"}
        onUpdate={vi.fn()}
        onUpdateRawYaml={onUpdateRawYaml}
        onUpdatePropertiesConfig={onUpdatePropertiesConfig}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add property" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Portrait" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add property" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not save properties configuration.",
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(onUpdateRawYaml).not.toHaveBeenCalled();
  });

  it("shows a newly created property immediately after the schema update", () => {
    function StatefulInspector() {
      const [config, setConfig] = useState(
        applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE),
      );
      return (
        <MetadataEditor
          entity={entity()}
          propertiesConfig={config}
          rawYaml={"---\ntype: character\nstatus: draft\n---"}
          onUpdate={vi.fn()}
          onUpdatePropertiesConfig={setConfig}
        />
      );
    }

    render(<StatefulInspector />);
    fireEvent.click(screen.getByRole("button", { name: "Add property" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Portrait" } });
    fireEvent.change(within(dialog).getByLabelText("Type"), { target: { value: "image" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add property" }));

    expect(screen.getByText("Portrait")).toBeTruthy();
  });

  it("persists option edits made to a property inside a section", () => {
    const config = applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE);
    const onUpdatePropertiesConfig = vi.fn();

    render(
      <MetadataEditor
        entity={entity()}
        propertiesConfig={config}
        rawYaml={"---\ntype: character\nstatus: draft\n---"}
        onUpdate={vi.fn()}
        onUpdatePropertiesConfig={onUpdatePropertiesConfig}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Role" }));
    fireEvent.click(screen.getByRole("button", { name: "Options" }));
    const optionLabel = screen.getByDisplayValue("Protagonist");
    fireEvent.change(optionLabel, { target: { value: "Lead" } });
    fireEvent.blur(optionLabel);

    const savedConfig = onUpdatePropertiesConfig.mock.calls.at(-1)?.[0];
    const identity = savedConfig.customFields.definitions.find(
      (candidate: { id: string }) => candidate.id === "identity",
    );
    const role = identity.children.find((candidate: { id: string }) => candidate.id === "role");
    expect(role.options[0]).toMatchObject({ value: "protagonist", label: "Lead" });
  });

  it("creates a child property under the selected parent section", () => {
    const config = applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE);
    const onUpdatePropertiesConfig = vi.fn();

    render(
      <MetadataEditor
        entity={entity()}
        propertiesConfig={config}
        rawYaml={"---\ntype: character\nstatus: draft\n---"}
        onUpdate={vi.fn()}
        onUpdatePropertiesConfig={onUpdatePropertiesConfig}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add property" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Portrait" } });
    fireEvent.change(within(dialog).getByLabelText("Type"), { target: { value: "image" } });
    fireEvent.change(within(dialog).getByRole("combobox", { name: "Parent section" }), {
      target: { value: "identity" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add property" }));

    const savedConfig = onUpdatePropertiesConfig.mock.calls[0]?.[0];
    const identity = savedConfig.customFields.definitions.find(
      (candidate: { id: string }) => candidate.id === "identity",
    );
    expect(identity.children).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "portrait", type: "image" })]),
    );
  });
});
