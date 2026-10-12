import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PropertiesConfig } from "../editorTypes";
import { makeEntity, makeVaultFile, makeVaultIndex } from "../test/fixtures";
import { EcosystemGalleryCard } from "./EcosystemGalleryCard";

vi.mock("../utils/vaultImages", async (importOriginal) => {
  const original = await importOriginal<typeof import("../utils/vaultImages")>();
  return {
    ...original,
    useVaultImage: (_index: unknown, path: string) => ({
      url: path ? `data:image/png;base64,${path}` : undefined,
    }),
  };
});

const config: PropertiesConfig = {
  version: "3.0",
  tags: { rootNodes: [], allowCustomTags: true, autoDetectSlashNotation: true },
  entityTypes: {
    definitions: [
      {
        id: "character",
        label: "Character",
        presentation: { portraitPropertyId: "portrait", coverPropertyId: "cover" },
      },
    ],
    defaultType: "character",
    allowCustomTypes: true,
  },
  statuses: { definitions: [], defaultStatus: "draft", allowCustomStatuses: true },
  customFields: {
    definitions: [
      {
        id: "identity",
        label: "Identity",
        type: "group",
        children: [{ id: "portrait", label: "Portrait", type: "image" }],
      },
      { id: "cover", label: "Cover", type: "image" },
    ],
  },
};

function renderCard(portraitPath: string) {
  const entity = makeEntity({
    customProperties: {
      identity: { portrait: portraitPath },
      cover: "../Images/cover.png",
    },
  });
  return render(
    <EcosystemGalleryCard
      entity={entity}
      index={makeVaultIndex({
        entities: [entity],
        propertiesConfig: config,
        files: [
          entity.file,
          makeVaultFile("Images/portrait.png"),
          makeVaultFile("Images/cover.png"),
        ],
      })}
      typeLabel="Character"
      selected={false}
      onSelectPath={vi.fn()}
      onContextMenu={vi.fn()}
    />,
  );
}

describe("ecosystem gallery presentation", () => {
  it("resolves nested portrait fields against indexed vault images", () => {
    const { container } = renderCard("../Images/portrait.png");

    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "data:image/png;base64,Images/portrait.png",
    );
    expect(screen.getByRole("button", { name: "Mara" })).toBeInTheDocument();
  });

  it("uses the cover when the configured portrait is missing from the vault", () => {
    const { container } = renderCard("missing.png");

    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "data:image/png;base64,Images/cover.png",
    );
  });

  it("falls back from unreadable media to the cover and then the named placeholder", () => {
    const { container } = renderCard("Images/portrait.png");
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "data:image/png;base64,Images/cover.png",
    );
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".ecosystem-gallery-placeholder")).toHaveTextContent("M");
    expect(screen.getByRole("button", { name: "Mara" })).toBeEnabled();
  });

  it("does not fetch a remote URL stored in an image property", () => {
    const { container } = renderCard("https://example.com/portrait.png");

    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "data:image/png;base64,Images/cover.png",
    );
  });
});
