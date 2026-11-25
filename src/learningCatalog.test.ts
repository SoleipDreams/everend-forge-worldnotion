import { describe, expect, it } from "vitest";
import { worldnotionIntroduction, worldnotionLessons } from "./learningCatalog";

describe("WorldNotion learning catalog", () => {
  it("guides new users through an Explorer folder, a note and its properties", () => {
    const lesson = worldnotionLessons.find((item) => item.id === "express-start");

    expect(lesson).toBeDefined();
    expect(lesson?.steps.map((item) => item.id)).toEqual(["folder", "note", "properties"]);
    expect(lesson?.steps[0]?.event).toBe("folder-created");
    expect(lesson?.steps[1]?.event).toBe("note-created");

    const properties = lesson?.steps[2];
    expect(properties?.section).toBe("properties");
    expect(properties?.target).toBe("worldnotion.inspector");
    expect(properties?.event).toBeUndefined();
    expect(properties?.body.es).toContain("ID, nombre, tipo, estado, etiquetas y alias");
    expect(properties?.body.es).toContain("Puedes personalizarlos desde Ajustes");
  });

  it("keeps the WorldNotion introduction separate from the create steps", () => {
    expect(worldnotionIntroduction.length).toBeGreaterThan(0);
    expect(worldnotionIntroduction.every((item) => item.event === undefined)).toBe(true);
    expect(worldnotionIntroduction.some((item) => item.id === "workspace")).toBe(true);
    expect(worldnotionLessons.find((item) => item.id === "express-start")?.steps[0]?.event).toBe(
      "folder-created",
    );
  });
});
