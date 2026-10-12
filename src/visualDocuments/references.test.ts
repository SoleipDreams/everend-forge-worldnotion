import { describe, expect, it } from "vitest";
import { makeEntity, makeVaultFile } from "../test/fixtures";
import { resolveVisualDocumentReference, resolveVisualReference } from "./references";

describe("visual canon references", () => {
  const mara = makeEntity({ id: "character:mara", name: "Mara", path: "Characters/Mara.md", aliases: ["Guardian"], variants: [{ id: "past", label: "Past" }] });
  it("opens stable IDs and exact paths with optional canon variants", () => {
    const index = { entities: [mara] };
    for (const reference of ["character:mara", "Characters/Mara.md", "Mara", "guardian"]) expect(resolveVisualReference(index, reference)).toMatchObject({ status: "resolved", entity: mara });
    expect(resolveVisualReference(index, "Characters/Mara.md@past")).toMatchObject({ status: "resolved", variantId: "past" });
    expect(resolveVisualReference(index, "character:mara@missing").status).toBe("missing-variant");
    expect(resolveVisualReference(index, "missing").status).toBe("missing");
  });
  it("does not pick arbitrarily between duplicate IDs or names; exact paths disambiguate", () => {
    const duplicate = makeEntity({ ...mara, path: "Copies/Mara.md" });
    const index = { entities: [mara, duplicate] };
    expect(resolveVisualReference(index, mara.id).status).toBe("ambiguous");
    expect(resolveVisualReference(index, mara.name).status).toBe("ambiguous");
    expect(resolveVisualReference(index, mara.path)).toMatchObject({ status: "resolved", entity: mara });
    expect(resolveVisualReference({ entities: [mara, makeEntity({ id: "other", name: mara.id })] }, mara.id)).toMatchObject({ status: "resolved", entity: mara });
  });
  it("opens explicit Markdown paths without requiring an entity or rewriting canon", () => {
    const index = { entities: [mara], markdownFiles: [makeVaultFile("Notes/Idea.md"), makeVaultFile("Tools/History.md"), makeVaultFile("Notes/Contact@home.md")] };
    expect(resolveVisualDocumentReference(index, "Notes/Idea.md")).toEqual({ status: "resolved", path: "Notes/Idea.md" });
    expect(resolveVisualDocumentReference(index, "Tools/History.md")).toEqual({ status: "resolved", path: "Tools/History.md" });
    expect(resolveVisualDocumentReference(index, "Notes/Contact@home.md")).toEqual({ status: "resolved", path: "Notes/Contact@home.md" });
    expect(resolveVisualDocumentReference(index, "Notes/Idea.md@past").status).toBe("missing-variant");
    expect(resolveVisualDocumentReference(index, "Missing.md").status).toBe("missing");
  });
});
