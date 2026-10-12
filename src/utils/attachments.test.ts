import { describe, expect, it } from "vitest";
import {
  encodeImagePath,
  imageMarkdown,
  parseImagePresentation,
  sanitizeAttachmentName,
  uniqueAttachmentPath,
} from "./attachments";

describe("sanitizeAttachmentName", () => {
  it("lowercases and replaces unsafe characters", () => {
    expect(sanitizeAttachmentName("My Photo (1).PNG")).toBe("my-photo-1.png");
  });

  it("falls back when the base is empty", () => {
    expect(sanitizeAttachmentName("  .png")).toBe("image.png");
  });
});

describe("uniqueAttachmentPath", () => {
  it("places files under the attachments folder", () => {
    expect(uniqueAttachmentPath([], "hero.png")).toBe(".everend/assets/image/hero.png");
  });

  it("dedupes colliding names", () => {
    const existing = [".everend/assets/image/hero.png", ".everend/assets/image/hero-1.png"];
    expect(uniqueAttachmentPath(existing, "hero.png")).toBe(".everend/assets/image/hero-2.png");
  });

  it("honors a custom folder", () => {
    expect(uniqueAttachmentPath([], "x.jpg", "assets")).toBe("assets/x.jpg");
  });
});

describe("encodeImagePath / imageMarkdown", () => {
  it("encodes spaces per segment but keeps slashes", () => {
    expect(encodeImagePath("attachments/my art.png")).toBe("attachments/my%20art.png");
  });

  it("builds standard markdown with a derived alt", () => {
    expect(imageMarkdown("attachments/hero.png")).toBe("![hero](attachments/hero.png)");
    expect(imageMarkdown("attachments/hero.png", "Hero")).toBe("![Hero](attachments/hero.png)");
  });

  it("stores optional image layout in a portable Markdown title", () => {
    expect(imageMarkdown("attachments/hero.png", "Hero", { width: 60, align: "right" })).toBe(
      '![Hero](attachments/hero.png "wn:width=60;align=right")',
    );
    expect(parseImagePresentation("wn:width=60;align=right")).toEqual({
      width: 60,
      align: "right",
    });
    expect(parseImagePresentation("A normal title")).toBeUndefined();
  });
});
