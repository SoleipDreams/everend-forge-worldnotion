import { syntaxTree } from "@codemirror/language";
import { StateEffect, StateField, type EditorState, type Text } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";

export type ParagraphSpacingPosition = "before" | "after";

type ParagraphSpacingEffect = {
  position: number;
  spacing: ParagraphSpacingPosition;
};

type ParagraphSpacingEntry = {
  position: number;
  before: boolean;
  /** An explicit override; undefined follows the saved Markdown paragraph boundary. */
  after?: boolean;
};

type ParagraphSpacingState = {
  entries: ParagraphSpacingEntry[];
  /** Maps the end line of a paragraph to the following visual line. */
  defaultBoundaries: Map<number, number>;
};

export const paragraphSpacingEffect = StateEffect.define<ParagraphSpacingEffect>();

function defaultParagraphBoundaries(state: EditorState) {
  const boundaries = new Map<number, number>();
  for (let number = 1; number < state.doc.lines; number += 1) {
    const line = state.doc.line(number);
    const nextLine = state.doc.line(number + 1);
    if (!line.text.trim() || !isTopLevelParagraphAt(state, line.from)) continue;

    // A saved line break inside prose is the paragraph boundary in the writing
    // view. Derive its spacing from the document so it survives reloads without
    // inserting an extra blank Markdown line.
    if (nextLine.text.trim() && isTopLevelParagraphAt(state, nextLine.from)) {
      boundaries.set(line.from, nextLine.from);
    } else if (!nextLine.text.trim() && number + 1 === state.doc.lines) {
      boundaries.set(line.from, nextLine.from);
    }
  }
  return boundaries;
}

const paragraphSpacingField = StateField.define<ParagraphSpacingState>({
  create: (state) => ({ entries: [], defaultBoundaries: defaultParagraphBoundaries(state) }),
  update(value, transaction) {
    const hasSpacingEffect = transaction.effects.some((effect) =>
      effect.is(paragraphSpacingEffect),
    );
    if (!transaction.docChanged && !hasSpacingEffect) return value;

    const next = transaction.docChanged
      ? value.entries.map((entry) => ({
          ...entry,
          position: transaction.changes.mapPos(entry.position, 1),
        }))
      : value.entries.map((entry) => ({ ...entry }));
    const defaultBoundaries = transaction.docChanged
      ? defaultParagraphBoundaries(transaction.state)
      : value.defaultBoundaries;

    for (const effect of transaction.effects) {
      if (!effect.is(paragraphSpacingEffect)) continue;

      const { position, spacing } = effect.value;
      let entry = next.find((candidate) => candidate.position === position);
      if (!entry) {
        entry = { position, before: false };
        next.push(entry);
      }
      if (spacing === "before") {
        entry.before = !entry.before;
      } else {
        const defaultValue = defaultBoundaries.has(position);
        const nextValue = !(entry.after ?? defaultValue);
        entry.after = nextValue === defaultValue ? undefined : nextValue;
      }
    }

    return {
      entries: next.filter((entry) => entry.before || entry.after !== undefined),
      defaultBoundaries,
    };
  },
  provide: (field) =>
    EditorView.decorations.from(field, ({ entries, defaultBoundaries }) => {
      const overrides = new Map(entries.map((entry) => [entry.position, entry.after]));
      const decorations = [
        ...Array.from(defaultBoundaries.entries())
          .filter(([position]) => overrides.get(position) !== false)
          .map(([, nextLinePosition]) =>
            Decoration.line({ class: "cm-paragraph-space-before" }).range(nextLinePosition),
          ),
        ...entries.flatMap((entry) => [
          ...(entry.before
            ? [Decoration.line({ class: "cm-paragraph-space-before" }).range(entry.position)]
            : []),
          ...(entry.after === true && !defaultBoundaries.has(entry.position)
            ? [Decoration.line({ class: "cm-paragraph-space-after" }).range(entry.position)]
            : []),
        ]),
      ];
      return Decoration.set(decorations, true);
    }),
});

export function paragraphSpacingExtension() {
  return paragraphSpacingField;
}

export function paragraphLinePositions(doc: Text, position: number) {
  const selectedLine = doc.lineAt(position);
  if (!selectedLine.text.trim()) return undefined;

  let firstLine = selectedLine.number;
  while (firstLine > 1 && doc.line(firstLine - 1).text.trim()) firstLine -= 1;

  let lastLine = selectedLine.number;
  while (lastLine < doc.lines && doc.line(lastLine + 1).text.trim()) lastLine += 1;

  return {
    before: doc.line(firstLine).from,
    after: doc.line(lastLine).from,
  };
}

/** Returns true only for a top-level prose paragraph, excluding list and quote contents. */
export function isTopLevelParagraphAt(state: EditorState, position: number) {
  // Inspect the token at the start of the line. Resolving backward can land
  // outside the first paragraph immediately after a heading or block widget.
  const resolved = syntaxTree(state).resolveInner(position, 1);
  if (resolved.name === "Paragraph") return resolved.parent?.name === "Document";

  for (let node = resolved.parent; node; node = node.parent) {
    if (node.name === "Paragraph") return node.parent?.name === "Document";
  }

  return false;
}
