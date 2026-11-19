import { EditorState } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";
import {
  isTopLevelParagraphAt,
  paragraphLinePositions,
  paragraphSpacingExtension,
} from "./paragraphSpacing";

describe("paragraphLinePositions", () => {
  it("finds the first and last line of a paragraph", () => {
    const state = EditorState.create({ doc: "First line\ncontinued\n\nNext paragraph" });

    expect(paragraphLinePositions(state.doc, state.doc.line(2).from)).toEqual({
      before: state.doc.line(1).from,
      after: state.doc.line(2).from,
    });
  });

  it("ignores blank lines", () => {
    const state = EditorState.create({ doc: "First paragraph\n\nSecond paragraph" });

    expect(paragraphLinePositions(state.doc, state.doc.line(2).from)).toBeUndefined();
  });
});

describe("automatic paragraph spacing", () => {
  it("recognizes the first prose line after a heading and spaces the next paragraph", () => {
    const view = new EditorView({
      state: EditorState.create({
        doc: "## Biography\nFirst paragraph\nSecond paragraph\n- List item\n> Quote",
        extensions: [markdown({ base: markdownLanguage }), paragraphSpacingExtension()],
      }),
      parent: document.body,
    });

    try {
      const lines = view.dom.querySelectorAll<HTMLElement>(".cm-line");
      expect(isTopLevelParagraphAt(view.state, view.state.doc.line(2).from)).toBe(true);
      expect(lines[2].classList.contains("cm-paragraph-space-before")).toBe(true);
      expect(lines[3].classList.contains("cm-paragraph-space-before")).toBe(false);
      expect(lines[4].classList.contains("cm-paragraph-space-before")).toBe(false);
    } finally {
      view.destroy();
      view.dom.remove();
    }
  });
});
