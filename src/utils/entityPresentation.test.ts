import { describe, expect, it } from "vitest";
import type { PropertiesConfig } from "../editorTypes";
import {
  getPresentationRoleValue,
  listPresentationImageProperties,
  reconcileEntityPresentations,
  updateEntityTypePresentation,
  validateEntityPresentations,
} from "./entityPresentation";
import { validatePropertiesConfig } from "./propertiesSerializer";
import { removeInspectorProperty } from "./propertiesConfig";

function config(): PropertiesConfig {
  return {
    version: "3.0",
    baseProperties: { definitions: [] },
    tags: { rootNodes: [], allowCustomTags: true, autoDetectSlashNotation: true },
    entityTypes: {
      definitions: [
        {
          id: "character",
          label: "Character",
          presentation: { portraitPropertyId: "portrait", coverPropertyId: "cover" },
        },
        { id: "location", label: "Location" },
      ],
      defaultType: "character",
      allowCustomTypes: false,
    },
    statuses: { definitions: [], defaultStatus: "draft", allowCustomStatuses: true },
    customFields: {
      definitions: [
        {
          id: "identity",
          label: "Identity",
          type: "group",
          appliesTo: ["character"],
          children: [{ id: "portrait", label: "Portrait", type: "image" }],
        },
        { id: "cover", label: "Cover", type: "image", appliesTo: ["character"] },
      ],
    },
  };
}

describe("entity presentation", () => {
  it("uses image fields in the type scope, including nested YAML paths", () => {
    const properties = config();
    expect(
      listPresentationImageProperties(properties, "character").map((property) => property.id),
    ).toEqual(["portrait", "cover"]);
    expect(listPresentationImageProperties(properties, "location")).toEqual([]);
    expect(
      getPresentationRoleValue(
        properties,
        "character",
        { identity: { portrait: "attachments/mara.png" }, cover: "attachments/veil.png" },
        "portrait",
      ),
    ).toBe("attachments/mara.png");
  });

  it("rejects a missing, non-image, or out-of-scope presentation property", () => {
    const properties = config();
    properties.entityTypes.definitions[0].presentation = { portraitPropertyId: "missing" };
    expect(validateEntityPresentations(properties)[0]?.message).toContain("missing property");

    properties.entityTypes.definitions[0].presentation = { portraitPropertyId: "identity" };
    expect(validatePropertiesConfig(properties).valid).toBe(false);

    properties.entityTypes.definitions[1].presentation = { coverPropertyId: "cover" };
    expect(
      validateEntityPresentations(properties).some((issue) => issue.typeId === "location"),
    ).toBe(true);
  });

  it("detaches invalid roles without touching note values", () => {
    const properties = config();
    properties.customFields.definitions = properties.customFields.definitions.filter(
      (property) => property.id !== "cover",
    );
    expect(
      reconcileEntityPresentations(properties).entityTypes.definitions[0].presentation,
    ).toEqual({
      portraitPropertyId: "portrait",
      coverPropertyId: undefined,
    });
  });

  it("keeps one image property assigned to only one presentation role per type", () => {
    const properties = config();
    const next = updateEntityTypePresentation(properties, "character", "portrait", "cover");
    expect(next.entityTypes.definitions[0].presentation).toEqual({
      portraitPropertyId: "cover",
      coverPropertyId: undefined,
    });
  });

  it("detaches a presentation role when its property is deleted from the schema", () => {
    const properties = config();
    const next = removeInspectorProperty(properties, "cover");
    expect(next.entityTypes.definitions[0].presentation).toEqual({
      portraitPropertyId: "portrait",
    });
  });
});
