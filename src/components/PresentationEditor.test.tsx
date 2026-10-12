import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PropertiesConfig } from "../editorTypes";
import { makeEntity, makeVaultFile, makeVaultIndex } from "../test/fixtures";
import { PresentationEditor } from "./PresentationEditor";

function properties(): PropertiesConfig {
  return {
    version: "3.0",
    baseProperties: { definitions: [] },
    tags: { rootNodes: [], allowCustomTags: true, autoDetectSlashNotation: true },
    entityTypes: {
      definitions: [
        {
          id: "character",
          label: "Character",
          presentation: { portraitPropertyId: "portrait" },
        },
      ],
      defaultType: "character",
      allowCustomTypes: false,
    },
    statuses: { definitions: [], defaultStatus: "draft", allowCustomStatuses: true },
    customFields: {
      definitions: [
        { id: "portrait", label: "Portrait image", type: "image", appliesTo: ["character"] },
        { id: "cover", label: "Cover image", type: "image", appliesTo: ["character"] },
      ],
    },
  };
}

describe("PresentationEditor", () => {
  it("maps a type role and assigns an existing vault image into YAML", () => {
    const onUpdateRawYaml = vi.fn();
    const onUpdatePropertiesConfig = vi.fn();
    const vaultIndex = makeVaultIndex({
      files: [makeVaultFile("attachments/mara.png")],
    });
    render(
      <PresentationEditor
        entity={makeEntity()}
        config={properties()}
        rawYaml={"---\ntype: character\n---"}
        vaultIndex={vaultIndex}
        onUpdateRawYaml={onUpdateRawYaml}
        onUpdatePropertiesConfig={onUpdatePropertiesConfig}
      />,
    );

    fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: "cover" } });
    expect(
      onUpdatePropertiesConfig.mock.calls[0]?.[0].entityTypes.definitions[0].presentation,
    ).toEqual({
      portraitPropertyId: "portrait",
      coverPropertyId: "cover",
    });

    fireEvent.click(screen.getByRole("button", { name: "Pick image" }));
    fireEvent.click(screen.getByRole("option", { name: /mara\.png/i }));
    expect(onUpdateRawYaml.mock.calls[0]?.[0]).toContain("portrait: attachments/mara.png");
  });
});
