import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makeVaultIndex } from "../test/fixtures";
import { DocumentPresentation } from "./DocumentPresentation";

vi.mock("../utils/vaultImages", () => ({
  useVaultImage: (_index: unknown, path: string) => ({
    url: path ? `data:image/png;base64,${path}` : undefined,
  }),
}));

describe("DocumentPresentation", () => {
  it("renders a banner, type, and title", () => {
    const { container } = render(
      <DocumentPresentation
        vaultIndex={makeVaultIndex()}
        name="Mara Voss"
        typeLabel="Character"
        hasPortrait
        coverPath="veil"
      />,
    );

    expect(screen.getByRole("heading", { name: "Mara Voss" })).toBeInTheDocument();
    expect(screen.getByText("Character")).toBeInTheDocument();
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });

  it("does not reserve presentation space when no role has a value", () => {
    const { container } = render(
      <DocumentPresentation vaultIndex={makeVaultIndex()} name="Mara" typeLabel="Character" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps the title above the writing area when only a portrait is configured", () => {
    const { rerender, container } = render(
      <DocumentPresentation
        vaultIndex={makeVaultIndex()}
        name="Mara"
        typeLabel="Character"
        hasPortrait
      />,
    );
    expect(screen.getByRole("heading", { name: "Mara" })).toBeInTheDocument();
    expect(container.querySelector(".document-presentation-cover")).toBeNull();

    rerender(
      <DocumentPresentation
        vaultIndex={makeVaultIndex()}
        name="Mara"
        typeLabel="Character"
        coverPath="veil"
      />,
    );
    expect(container.querySelector(".document-presentation-cover")).toBeInTheDocument();
  });

  it("allows the portrait header to be renamed", async () => {
    const rename = vi.fn(async () => undefined);
    render(
      <DocumentPresentation
        vaultIndex={makeVaultIndex()}
        name="Mara"
        typeLabel="Character"
        hasPortrait
        onDocumentNameChange={rename}
      />,
    );

    const title = screen.getByRole("heading", { name: "Mara" });
    title.focus();
    title.textContent = "Mara Voss";
    fireEvent.keyDown(title, { key: "Enter" });

    await waitFor(() => expect(rename).toHaveBeenCalledWith("Mara Voss"));
    expect(title.textContent).toBe("Mara Voss");
  });
});
