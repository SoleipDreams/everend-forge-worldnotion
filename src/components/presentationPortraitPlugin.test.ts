import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it, vi } from "vitest";
import { presentationPortraitPlugin } from "./presentationPortraitPlugin";

const views: EditorView[] = [];

afterEach(() => {
  views.splice(0).forEach((view) => view.destroy());
  document.body.replaceChildren();
});

describe("presentation portrait plugin", () => {
  it("renders the type portrait at the start of the writing content", async () => {
    const resolve = vi.fn(async () => "data:image/png;base64,AA==");
    const view = new EditorView({
      state: EditorState.create({
        doc: "The opening paragraph wraps beside the portrait.\n\nMore text follows.",
        extensions: [
          markdown({ base: markdownLanguage }),
          presentationPortraitPlugin({
            path: "attachments/mara.png",
            alt: "Mara portrait",
            resolve,
          }),
        ],
      }),
      parent: document.body,
    });
    views.push(view);

    await vi.waitFor(() => {
      expect(view.dom.querySelector(".cm-presentation-portrait img")).not.toBeNull();
    });

    const portrait = view.dom.querySelector<HTMLElement>(".cm-presentation-portrait");
    expect(portrait?.parentElement?.classList.contains("cm-line")).toBe(true);
    expect(portrait?.dataset.imagePath).toBe("attachments/mara.png");
    expect(view.dom.querySelector(".cm-presentation-portrait img")?.getAttribute("alt")).toBe(
      "Mara portrait",
    );
    expect(resolve).toHaveBeenCalledWith("attachments/mara.png");
  });
});
