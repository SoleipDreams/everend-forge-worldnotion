import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RelationshipTreeEditor } from "./RelationshipTreeEditor";
import { createRelationshipDocument } from "../visualDocuments/relationships";
import type { RelationshipTreeDocument } from "../visualDocuments/relationshipTypes";
function Harness({
  initial,
  onCommit,
  active = true,
}: {
  initial: RelationshipTreeDocument;
  onCommit: (document: RelationshipTreeDocument) => void;
  active?: boolean;
}) {
  const [document, setDocument] = useState(initial);
  return (
    <RelationshipTreeEditor
      document={document}
      documentPath="fixture.md"
      active={active}
      onChange={(next) => {
        setDocument(next);
        onCommit(next);
      }}
    />
  );
}
describe("relationship tree authoring", () => {
  it("edits a linked person locally and clones complete variants without changing the source canvas", () => {
    sessionStorage.clear();
    const initial = createRelationshipDocument("ui-test");
    initial.variants.main.nodes = [{ id: "a", name: "A", reference: "character:a", x: 0, y: 0 }];
    const commit = vi.fn();
    render(<Harness initial={initial} onCommit={commit} />);
    fireEvent.keyDown(screen.getByRole("button", { name: /^A \(/ }), { key: "Enter" });
    fireEvent.change(screen.getByRole("textbox", { name: "Nombre" }), {
      target: { value: "A local" },
    });
    expect(commit.mock.lastCall?.[0].variants.main.nodes[0]).toMatchObject({
      id: "a",
      name: "A local",
      reference: "character:a",
    });
    expect(initial.variants.main.nodes[0].name).toBe("A");
    fireEvent.change(screen.getByRole("textbox", { name: "Nueva variante" }), {
      target: { value: "Pasado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Duplicar canvas actual" }));
    const next = commit.mock.lastCall![0] as RelationshipTreeDocument;
    const cloned = Object.values(next.variants).find((variant) => variant.name === "Pasado")!;
    expect(cloned.nodes[0]).toMatchObject({ id: "a", name: "A local" });
    expect(cloned.nodes).not.toBe(next.variants.main.nodes);
  });
  it("does not handle delete when the Suite application is inactive", () => {
    sessionStorage.clear();
    const initial = createRelationshipDocument("inactive-test");
    initial.variants.main.nodes = [{ id: "a", name: "A", x: 0, y: 0 }];
    const commit = vi.fn();
    render(<Harness initial={initial} onCommit={commit} active={false} />);
    const node = screen.getByRole("button", { name: /^A$/ });
    fireEvent.keyDown(node, { key: "Enter" });
    fireEvent.keyDown(screen.getByRole("region", { name: "Árbol de relaciones" }), {
      key: "Delete",
    });
    expect(commit).not.toHaveBeenCalled();
  });
  it("recovers a variant composer after closing the document without applying it", () => {
    sessionStorage.clear();
    const initial = createRelationshipDocument("draft-test"),
      commit = vi.fn();
    const first = render(<Harness initial={initial} onCommit={commit} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Nueva variante" }), {
      target: { value: "Antes del faro" },
    });
    first.unmount();
    render(<Harness initial={initial} onCommit={commit} />);
    expect(screen.getByRole("textbox", { name: "Nueva variante" })).toHaveValue("Antes del faro");
    expect(commit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Crear canvas vacío" }));
    expect(
      Object.values(commit.mock.lastCall![0].variants).some(
        (variant: any) => variant.name === "Antes del faro",
      ),
    ).toBe(true);
  });
  it("selects annotations, groups and drawings from the keyboard and deletes a mixed selection atomically", () => {
    sessionStorage.clear();
    const initial = createRelationshipDocument("keyboard-test"),
      commit = vi.fn();
    initial.variants.main.annotations = [{ id: "note", kind: "note", text: "Apunte", x: 0, y: 0 }];
    initial.variants.main.groups = [
      { id: "group", name: "Familia", nodeIds: [], x: 0, y: 0, width: 300, height: 200 },
    ];
    initial.variants.main.drawings = [
      {
        id: "drawing",
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        color: "#445566",
        width: 2,
      },
    ];
    render(<Harness initial={initial} onCommit={commit} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Apunte" }), { key: "Enter" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Familia" }), {
      key: "Enter",
      shiftKey: true,
    });
    fireEvent.keyDown(screen.getByRole("button", { name: "Dibujo 1" }), {
      key: "Enter",
      shiftKey: true,
    });
    fireEvent.keyDown(screen.getByRole("region", { name: "Árbol de relaciones" }), {
      key: "Delete",
    });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.lastCall![0].variants.main).toMatchObject({
      annotations: [],
      groups: [],
      drawings: [],
    });
    expect(initial.variants.main.annotations).toHaveLength(1);
  });
  it("cancels the pending drag when Delete changes the document instead of resurrecting its snapshot", () => {
    sessionStorage.clear();
    const initial = createRelationshipDocument("gesture-test"),
      commit = vi.fn();
    initial.variants.main.nodes = [{ id: "a", name: "A", x: 0, y: 0 }];
    render(<Harness initial={initial} onCommit={commit} />);
    const canvas = screen.getByLabelText("Lienzo de relaciones");
    Object.defineProperty(canvas, "setPointerCapture", { value: () => {} });
    vi.stubGlobal("PointerEvent", MouseEvent);
    try {
      fireEvent.pointerDown(screen.getByRole("button", { name: /^A$/ }), {
        clientX: 50,
        clientY: 50,
        button: 0,
      });
      fireEvent.pointerMove(canvas, { clientX: 80, clientY: 80 });
      fireEvent.keyDown(canvas, { key: "Delete" });
      fireEvent.pointerUp(canvas, { clientX: 80, clientY: 80 });
      expect(commit).toHaveBeenCalledTimes(1);
      expect(commit.mock.lastCall![0].variants.main.nodes).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
