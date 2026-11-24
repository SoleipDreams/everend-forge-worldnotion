import { describe, expect, it } from "vitest";
import { createDefaultTaxonomyConfig } from "../domain";
import { createEntityFrontmatter } from "./contentTemplates";
import { applyPropertyTemplate, WORLDBUILDING_TEMPLATE } from "./propertyTemplates";
import {
  adaptFrontmatterProperty,
  addPropertyToConfig,
  buildInspectorPropertySections,
  changePropertyType,
  conditionIsActive,
  createInspectorProperty,
  getConfiguredFrontmatterOrder,
  inferPropertyDefinition,
  listAllProperties,
  listUnconfiguredProperties,
  listVisibleProperties,
  moveInspectorProperty,
  moveInspectorPropertyToPosition,
  parseFrontmatterRaw,
  removeFrontmatterProperty,
  renameInspectorProperty,
  reorderInspectorPropertySiblings,
  removeInspectorProperty,
  setInspectorPropertyVisibility,
  uniquePropertyId,
  upsertInspectorProperty,
  updateFrontmatterProperties,
} from "./propertiesConfig";
import { deserializePropertiesConfig, serializePropertiesConfig } from "./propertiesSerializer";
import { isPropertyVisible } from "./propertyTreeUtils";

describe("propertiesConfig", () => {
  it("generates unique property ids from labels", () => {
    expect(uniquePropertyId("Lore Level", ["lore-level"])).toBe("lore-level-2");
    expect(uniquePropertyId("Lore Level", ["lore-level", "lore-level-2"])).toBe("lore-level-3");
  });

  it("lists visible base and custom properties", () => {
    const config = addPropertyToConfig(
      applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE),
      {
        id: "rarity",
        label: "Rarity",
        type: "select",
        options: [{ value: "rare", label: "Rare" }],
      },
    );

    expect(listVisibleProperties(config).map((property) => property.id)).toContain("status");
    expect(listVisibleProperties(config).map((property) => property.id)).toContain("rarity");
  });

  it("worldbuilding starts with the Everend base inspector contract visible", () => {
    const config = applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE);
    const visibleIds = listVisibleProperties(config).map((property) => property.id);

    expect(visibleIds).toContain("type");
    expect(visibleIds).toContain("status");
    expect(visibleIds).toContain("aliases");
    expect(visibleIds).not.toContain("id");
    expect(visibleIds).not.toContain("name");
  });

  it("worldbuilding shows modular property roots instead of every field globally", () => {
    const config = applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE);
    const characterIds = listVisibleProperties(config, "character").map((property) => property.id);
    const itemIds = listVisibleProperties(config, "item").map((property) => property.id);

    expect(characterIds).toEqual([
      "type",
      "status",
      "aliases",
      "lore-level",
      "identity",
      "narrative",
    ]);
    expect(itemIds).toEqual([
      "type",
      "status",
      "aliases",
      "lore-level",
      "identity",
      "place",
      "item-details",
    ]);
    expect(characterIds).not.toContain("rarity");
    expect(itemIds).not.toContain("role");
    expect(listAllProperties(config).map((property) => property.id)).toEqual(
      expect.arrayContaining(["role", "rarity", "arc"]),
    );
    expect(listAllProperties(config).map((property) => property.id)).not.toContain(
      "worldbuilding-details",
    );
    expect(
      listVisibleProperties(config, "character").every((property) =>
        isPropertyVisible(property, { type: "character" }),
      ),
    ).toBe(true);
  });

  it("inherits group scopes and lets children restrict them", () => {
    const config = applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE);
    const characterIdentity = buildInspectorPropertySections(config, "character", {
      type: "character",
    })
      .flatMap((section) => section.nodes)
      .find((node) => node.property.id === "identity");
    const itemIdentity = buildInspectorPropertySections(config, "item", { type: "item" })
      .flatMap((section) => section.nodes)
      .find((node) => node.property.id === "identity");

    expect(characterIdentity?.children.map((child) => child.property.id)).toContain("role");
    expect(itemIdentity?.children.map((child) => child.property.id)).not.toContain("role");
    expect(listVisibleProperties(config, "location").map((property) => property.id)).not.toContain(
      "identity",
    );
  });

  it("combines condition properties with AND and accepted values with OR", () => {
    const property = {
      id: "reveal",
      label: "Reveal",
      type: "text" as const,
      visibleWhen: { mood: ["calm", "hopeful"], status: ["canon"] },
    };

    expect(conditionIsActive(property, { mood: "hopeful", status: "canon" })).toBe(true);
    expect(conditionIsActive(property, { mood: "tense", status: "canon" })).toBe(false);
    expect(conditionIsActive(property, { mood: "calm", status: "draft" })).toBe(false);
  });

  it("does not treat hidden configured properties as unconfigured", () => {
    const config = addPropertyToConfig(createDefaultTaxonomyConfig(), {
      id: "rarity",
      label: "Rarity",
      type: "text",
    });
    const hiddenConfig = {
      ...config,
      customFields: { ...config.customFields, globalFields: [] },
    };

    expect(listUnconfiguredProperties({ id: "iron", rarity: "rare" }, hiddenConfig)).toEqual([]);
  });

  it("detects unconfigured properties and infers definitions", () => {
    const extras = listUnconfiguredProperties(
      { id: "iron", rating: 5, released: true },
      createDefaultTaxonomyConfig(),
    );

    expect(extras).toEqual([
      { key: "rating", value: 5, inferredType: "number" },
      { key: "released", value: true, inferredType: "boolean" },
    ]);
    expect(inferPropertyDefinition("rating", 5)).toMatchObject({ id: "rating", type: "number" });
  });

  it("removes and adapts frontmatter properties", () => {
    const raw = "---\nid: iron\nrarity: rare\noldKey: value\n---";

    expect(parseFrontmatterRaw(removeFrontmatterProperty(raw, "rarity"))).not.toHaveProperty(
      "rarity",
    );
    expect(parseFrontmatterRaw(adaptFrontmatterProperty(raw, "oldKey", "newKey"))).toMatchObject({
      id: "iron",
      rarity: "rare",
      newKey: "value",
    });
  });

  it("updates frontmatter fields using configured YAML order", () => {
    const config = applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE);
    const raw = [
      "---",
      "id: mara",
      "name: Mara",
      "lore-level: canon",
      "type: character",
      "arc: awakening",
      "status: draft",
      "role: lead",
      "aliases:",
      "  - Mara",
      "affiliation: archive",
      "home: north",
      "---",
    ].join("\n");

    const next = updateFrontmatterProperties(raw, { status: "canon" }, config, "character");
    const keys = Object.keys(parseFrontmatterRaw(next));

    expect(parseFrontmatterRaw(next)).toMatchObject({ status: "canon", role: "lead" });
    expect(keys.slice(0, 8)).toEqual([
      "type",
      "status",
      "aliases",
      "lore-level",
      "role",
      "affiliation",
      "home",
      "arc",
    ]);
    expect(keys.slice(-2)).toEqual(["id", "name"]);
  });

  it("creates frontmatter through the same configured serializer", () => {
    const config = applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE);
    const raw = createEntityFrontmatter({
      id: "mara",
      name: "Mara",
      type: "character",
      propertiesConfig: config,
    });

    expect(Object.keys(parseFrontmatterRaw(raw))).toEqual([
      "type",
      "status",
      "aliases",
      "id",
      "name",
      "tags",
    ]);
  });

  it("creates empty sections in the schema without serializing empty YAML objects", () => {
    const config = createInspectorProperty(
      createDefaultTaxonomyConfig(),
      "character",
      "Identity notes",
      "group",
    );
    const section = listAllProperties(config).find((property) => property.id === "identity-notes");
    const raw = createEntityFrontmatter({
      id: "mara",
      name: "Mara",
      type: "character",
      propertiesConfig: config,
    });

    expect(section?.children).toEqual([]);
    expect(parseFrontmatterRaw(raw)).not.toHaveProperty("identity-notes");
  });

  it("stores child properties in their group object", () => {
    const config = applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE);
    const withParent = upsertInspectorProperty(
      config,
      {
        id: "magic",
        label: "Magic",
        type: "group",
      },
      "character",
    );
    const withChild = upsertInspectorProperty(
      withParent,
      {
        id: "power-level",
        label: "Power level",
        type: "number",
      },
      "character",
      "magic",
    );

    const magic = listVisibleProperties(withChild, "character").find(
      (property) => property.id === "magic",
    );

    expect(magic?.children?.map((child) => child.id)).toEqual(["power-level"]);
    expect(listUnconfiguredProperties({ magic: { "power-level": 3 } }, withChild)).toEqual([]);
    expect(
      parseFrontmatterRaw(
        updateFrontmatterProperties(
          "---\ntype: character\n---",
          { "power-level": 3 },
          withChild,
          "character",
        ),
      ),
    ).toMatchObject({ magic: { "power-level": 3 } });
    expect(getConfiguredFrontmatterOrder(withChild, "character", ["power-level", "magic"])).toEqual(
      ["magic", "power-level"],
    );
  });

  it("reorders child properties inside their parent", () => {
    const config = applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE);
    const withParent = upsertInspectorProperty(
      config,
      { id: "magic", label: "Magic", type: "group" },
      "character",
    );
    const withFirstChild = upsertInspectorProperty(
      withParent,
      { id: "alpha", label: "Alpha", type: "text" },
      "character",
      "magic",
    );
    const withSecondChild = upsertInspectorProperty(
      withFirstChild,
      { id: "beta", label: "Beta", type: "text" },
      "character",
      "magic",
    );
    const reordered = reorderInspectorPropertySiblings(
      withSecondChild,
      "character",
      "beta",
      "alpha",
    );
    const magic = listVisibleProperties(reordered, "character").find(
      (property) => property.id === "magic",
    );

    expect(magic?.children?.map((child) => child.id)).toEqual(["beta", "alpha"]);
  });

  it("removes nested properties from schema visibility and known fields", () => {
    const config = applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE);
    const withParent = upsertInspectorProperty(
      config,
      { id: "magic", label: "Magic", type: "group" },
      "character",
    );
    const withChild = upsertInspectorProperty(
      withParent,
      { id: "power-level", label: "Power level", type: "number" },
      "character",
      "magic",
    );
    const next = removeInspectorProperty(withChild, "power-level");

    expect(listAllProperties(next).map((property) => property.id)).not.toContain("power-level");
    expect(listUnconfiguredProperties({ "power-level": 3 }, next)).toEqual([
      { key: "power-level", value: 3, inferredType: "number" },
    ]);
  });

  it("keeps custom groups inside the main section without a duplicate header", () => {
    const config = applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE);
    const withMagic = upsertInspectorProperty(
      config,
      {
        id: "magic",
        label: "Magic",
        type: "group",
      },
      "character",
    );
    const withMagicKind = upsertInspectorProperty(
      withMagic,
      {
        id: "magic-kind",
        label: "Magic kind",
        type: "select",
        options: [
          { value: "elemental", label: "Elemental" },
          { value: "divine", label: "Divine" },
        ],
      },
      "character",
    );
    const withSchool = upsertInspectorProperty(
      withMagicKind,
      {
        id: "school",
        label: "School",
        type: "group",
        visibleWhen: { "magic-kind": ["elemental"] },
      },
      "character",
      "magic",
    );
    const withTechnique = upsertInspectorProperty(
      withSchool,
      { id: "technique", label: "Technique", type: "text" },
      "character",
      "school",
    );

    const sections = buildInspectorPropertySections(withTechnique, "character", {
      type: "character",
      "magic-kind": "elemental",
    });
    const mainSection = sections.find((section) => section.id === "main");
    const magic = mainSection?.nodes.find((node) => node.property.id === "magic");

    expect(mainSection?.title).toBe("Properties");
    expect(mainSection?.nodes.map((node) => node.property.id)).toContain("lore-level");
    expect(mainSection?.nodes.map((node) => node.property.id)).toContain("magic");
    expect(magic?.children[0]).toMatchObject({
      property: expect.objectContaining({ id: "school" }),
      parentId: "magic",
      depth: 1,
      conditionActive: true,
      conditionLabel: "Depends on Magic kind = elemental",
    });
    expect(magic?.children[0].children[0]).toMatchObject({
      property: expect.objectContaining({ id: "technique" }),
      parentId: "school",
      depth: 2,
    });
    expect(
      getConfiguredFrontmatterOrder(withTechnique, "character", ["technique", "school", "magic"]),
    ).toEqual(["magic", "school", "technique"]);
  });

  it("keeps Everend structural connectors out of inspector sections", () => {
    const config = applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE);
    const inspectorSections = buildInspectorPropertySections(config, "item", { type: "item" });

    const mainIds =
      inspectorSections
        .find((section) => section.id === "main")
        ?.nodes.map((node) => node.property.id) ?? [];
    // Creative properties (including custom groups) live in main. Structural
    // connectors remain core index data and are never editable inspector rows.
    expect(mainIds).toContain("type");
    expect(mainIds).toContain("status");
    expect(mainIds).toContain("aliases");
    expect(mainIds).toContain("lore-level");
    expect(mainIds).not.toContain("parentId");
    expect(mainIds).not.toContain("childrenIds");
    expect(
      inspectorSections
        .find((section) => section.id === "structure")
        ?.nodes.map((node) => node.property.id),
    ).toEqual([]);
  });

  it("hides inactive conditional trays unless hidden conditional display is requested", () => {
    const config = applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE);
    const withMagic = upsertInspectorProperty(
      config,
      { id: "magic", label: "Magic", type: "group" },
      "character",
    );
    const withElements = upsertInspectorProperty(
      withMagic,
      {
        id: "elements",
        label: "Elements",
        type: "multiselect",
        options: [
          { value: "fire", label: "Fire" },
          { value: "water", label: "Water" },
        ],
      },
      "character",
    );
    const withChild = upsertInspectorProperty(
      withElements,
      {
        id: "pyromancy",
        label: "Pyromancy",
        type: "text",
        visibleWhen: { elements: ["fire"] },
      },
      "character",
      "magic",
    );

    const inactive = buildInspectorPropertySections(withChild, "character", {
      elements: ["water"],
    });
    const active = buildInspectorPropertySections(withChild, "character", {
      elements: ["water", "fire"],
    });
    const expanded = buildInspectorPropertySections(
      withChild,
      "character",
      { elements: ["water"] },
      { includeInactiveConditions: true },
    );
    const findChild = (sections: ReturnType<typeof buildInspectorPropertySections>) =>
      sections
        .flatMap((section) => section.nodes)
        .find((node) => node.property.id === "magic")
        ?.children.map((child) => child.property.id) ?? [];

    expect(findChild(inactive)).not.toContain("pyromancy");
    expect(findChild(active)).toContain("pyromancy");
    expect(findChild(expanded)).toContain("pyromancy");
  });

  it("blocks invalid tree moves that would create cycles", () => {
    const config = applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE);
    const withMagic = upsertInspectorProperty(
      config,
      { id: "magic", label: "Magic", type: "group" },
      "character",
    );
    const withSchool = upsertInspectorProperty(
      withMagic,
      { id: "school", label: "School", type: "group" },
      "character",
      "magic",
    );
    const withTechnique = upsertInspectorProperty(
      withSchool,
      { id: "technique", label: "Technique", type: "text" },
      "character",
      "school",
    );

    expect(moveInspectorProperty(withTechnique, "character", "magic", "technique")).toBe(
      withTechnique,
    );
  });

  it("syncs hidden child properties without duplicating them in hidden tree output", () => {
    const config = applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE);
    const withMagic = upsertInspectorProperty(
      config,
      { id: "magic", label: "Magic", type: "group" },
      "character",
    );
    const withTechnique = upsertInspectorProperty(
      withMagic,
      { id: "technique", label: "Technique", type: "text" },
      "character",
      "magic",
    );
    const hidden = setInspectorPropertyVisibility(withTechnique, "character", "technique", false);

    const defaultSections = buildInspectorPropertySections(hidden, "character");
    const expandedSections = buildInspectorPropertySections(
      hidden,
      "character",
      {},
      { includeHidden: true },
    );
    const defaultMagic = defaultSections
      .flatMap((section) => section.nodes)
      .find((node) => node.property.id === "magic");
    const expandedIds = expandedSections
      .flatMap((section) => section.nodes)
      .flatMap((node) => [node.property.id, ...node.children.map((child) => child.property.id)]);

    expect(defaultMagic?.children.map((child) => child.property.id)).not.toContain("technique");
    expect(expandedIds.filter((id) => id === "technique")).toHaveLength(1);
    expect(
      hidden.entityTypes.definitions.find((definition) => definition.id === "character")
        ?.hiddenProperties,
    ).toContain("technique");
  });

  it("moves properties between root and group with a new canonical path", () => {
    const config = applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE);
    const withGroup = upsertInspectorProperty(
      config,
      { id: "magic", label: "Magic", type: "group" },
      "character",
    );
    const withPower = upsertInspectorProperty(
      withGroup,
      { id: "power-level", label: "Power level", type: "number" },
      "character",
    );
    const movedIntoGroup = moveInspectorProperty(withPower, "character", "power-level", "magic");
    const magic = listAllProperties(movedIntoGroup).find((property) => property.id === "magic");

    expect(magic?.children?.map((child) => child.id)).toEqual(["power-level"]);
    expect(listUnconfiguredProperties({ magic: { "power-level": 8 } }, movedIntoGroup)).toEqual([]);
    expect(listUnconfiguredProperties({ "power-level": 8 }, movedIntoGroup)).toEqual([
      { key: "power-level", value: 8, inferredType: "number" },
    ]);

    const movedToRoot = moveInspectorProperty(movedIntoGroup, "character", "power-level", null);
    const rootPower = movedToRoot.customFields.definitions.find(
      (property) => property.id === "power-level",
    );

    expect(rootPower?.id).toBe("power-level");
    expect(
      listAllProperties(movedToRoot).find((property) => property.id === "magic")?.children ?? [],
    ).toEqual([]);
  });

  it("moves a property between groups and inserts it at the dropped position", () => {
    const config = applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE);
    const withGroups = upsertInspectorProperty(
      upsertInspectorProperty(
        config,
        { id: "identity", label: "Identity", type: "group" },
        "character",
      ),
      { id: "attributes", label: "Attributes", type: "group" },
      "character",
    );
    const withSource = upsertInspectorProperty(
      withGroups,
      { id: "origin", label: "Origin", type: "text" },
      "character",
      "identity",
    );
    const withTarget = upsertInspectorProperty(
      upsertInspectorProperty(
        withSource,
        { id: "strength", label: "Strength", type: "number" },
        "character",
        "attributes",
      ),
      { id: "agility", label: "Agility", type: "number" },
      "character",
      "attributes",
    );

    const moved = moveInspectorPropertyToPosition(
      withTarget,
      "character",
      "origin",
      "attributes",
      "agility",
      "before",
    );

    expect(
      listAllProperties(moved)
        .find((property) => property.id === "attributes")
        ?.children?.map((property) => property.id),
    ).toEqual(["strength", "origin", "agility"]);
    expect(
      listAllProperties(moved).find((property) => property.id === "identity")?.children,
    ).toEqual([]);
  });

  it("hides and shows properties for the active entity type", () => {
    const config = applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE);
    const hidden = setInspectorPropertyVisibility(config, "character", "role", false);

    const hiddenIdentity = buildInspectorPropertySections(hidden, "character", {
      type: "character",
    })
      .flatMap((section) => section.nodes)
      .find((node) => node.property.id === "identity");

    expect(hiddenIdentity?.children.map((child) => child.property.id)).not.toContain("role");

    const shown = setInspectorPropertyVisibility(hidden, "character", "role", true);
    const shownIdentity = buildInspectorPropertySections(shown, "character", {
      type: "character",
    })
      .flatMap((section) => section.nodes)
      .find((node) => node.property.id === "identity");

    expect(shownIdentity?.children.map((child) => child.property.id)).toContain("role");
  });

  it("can hide global properties only for the active entity type", () => {
    const config = applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE);
    const hidden = setInspectorPropertyVisibility(config, "character", "status", false);

    expect(listVisibleProperties(hidden, "character").map((property) => property.id)).not.toContain(
      "status",
    );
    expect(listVisibleProperties(hidden, "item").map((property) => property.id)).toContain(
      "status",
    );
  });

  it("returns an empty object for malformed frontmatter instead of throwing", () => {
    expect(parseFrontmatterRaw("---\nid: iron\nlore-level: semi-canon\nc\n---")).toEqual({});
  });

  describe("renameInspectorProperty", () => {
    it("renames a custom property across definitions, memberships, and conditions", () => {
      let config = applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE);
      config = addPropertyToConfig(config, {
        id: "mood",
        label: "Mood",
        type: "select",
        options: [{ value: "calm", label: "Calm" }],
      });
      config = addPropertyToConfig(config, {
        id: "mood-notes",
        label: "Mood notes",
        type: "text",
        visibleWhen: { mood: ["calm"] },
      });

      const renamed = renameInspectorProperty(config, "mood", "temperament");
      const allIds = listAllProperties(renamed).map((property) => property.id);

      expect(allIds).toContain("temperament");
      expect(allIds).not.toContain("mood");
      const dependent = listAllProperties(renamed).find((property) => property.id === "mood-notes");
      expect(dependent?.visibleWhen).toEqual({ temperament: ["calm"] });
    });

    it("refuses to rename onto an existing property id", () => {
      let config = applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE);
      config = addPropertyToConfig(config, { id: "mood", label: "Mood", type: "text" });

      expect(renameInspectorProperty(config, "mood", "status")).toBe(config);
      expect(renameInspectorProperty(config, "mood", "mood")).toBe(config);
    });

    it("round-trips through serialization after a rename", () => {
      let config = applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE);
      config = addPropertyToConfig(config, { id: "mood", label: "Mood", type: "text" });
      const renamed = renameInspectorProperty(config, "mood", "temperament");

      const { config: reloaded } = deserializePropertiesConfig(serializePropertiesConfig(renamed));
      expect(listAllProperties(reloaded).map((property) => property.id)).toContain("temperament");
    });
  });

  describe("changePropertyType", () => {
    it("changes the type and initializes options for select types", () => {
      let config = applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE);
      config = addPropertyToConfig(config, { id: "mood", label: "Mood", type: "text" });

      const changed = changePropertyType(config, "mood", "select");
      const property = listAllProperties(changed).find((candidate) => candidate.id === "mood");

      expect(property?.type).toBe("select");
      expect(property?.options).toEqual([]);
    });

    it("drops options and constraints that no longer apply", () => {
      let config = applyPropertyTemplate(createDefaultTaxonomyConfig(), WORLDBUILDING_TEMPLATE);
      config = addPropertyToConfig(config, {
        id: "mood",
        label: "Mood",
        type: "select",
        options: [{ value: "calm", label: "Calm" }],
      });

      const changed = changePropertyType(config, "mood", "text");
      const property = listAllProperties(changed).find((candidate) => candidate.id === "mood");

      expect(property?.type).toBe("text");
      expect(property?.options).toBeUndefined();
    });
  });
});
