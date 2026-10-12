import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAppKeyboard } from "./useAppKeyboard";

const unchangedDocument = { path: "Aster.md", content: "The same draft" };
const unchangedBindings = { save: "s", undo: "z" };

function KeyboardTool({
  active,
  onSave,
  onUndoFile,
}: {
  active?: boolean;
  onSave: (document: typeof unchangedDocument) => void;
  onUndoFile: () => void;
}) {
  const suiteChrome = active === undefined ? undefined : { active };
  useAppKeyboard(suiteChrome, (event) => {
    if (event.ctrlKey && event.key === unchangedBindings.save) {
      event.preventDefault();
      onSave(unchangedDocument);
    }
  });
  useAppKeyboard(suiteChrome, (event) => {
    if (event.ctrlKey && event.key === unchangedBindings.undo) {
      event.preventDefault();
      onUndoFile();
    }
  });
  return null;
}

function shortcut(key: string) {
  const event = new KeyboardEvent("keydown", { key, ctrlKey: true, cancelable: true });
  fireEvent(window, event);
  return event;
}

describe("application keyboard ownership", () => {
  it("releases and recovers save and file-undo shortcuts on hide/show with unchanged document and bindings", () => {
    const onSave = vi.fn();
    const onUndoFile = vi.fn();
    const view = (active: boolean) => (
      <KeyboardTool active={active} onSave={onSave} onUndoFile={onUndoFile} />
    );
    const rendered = render(view(false));
    expect(shortcut("s").defaultPrevented).toBe(false);
    expect(shortcut("z").defaultPrevented).toBe(false);
    expect(onSave).not.toHaveBeenCalled();
    expect(onUndoFile).not.toHaveBeenCalled();

    rendered.rerender(view(true));
    expect(shortcut("s").defaultPrevented).toBe(true);
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledWith(unchangedDocument);
    rendered.rerender(view(false));
    expect(shortcut("s").defaultPrevented).toBe(false);
    expect(shortcut("z").defaultPrevented).toBe(false);
    expect(onSave).toHaveBeenCalledOnce();
    expect(onUndoFile).not.toHaveBeenCalled();

    rendered.rerender(view(true));
    shortcut("s");
    shortcut("z");
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onUndoFile).toHaveBeenCalledOnce();
    rendered.unmount();
    expect(shortcut("z").defaultPrevented).toBe(false);
    expect(onUndoFile).toHaveBeenCalledOnce();
  });

  it("runs only the active tool's handlers when two applications remain mounted", () => {
    const firstSave = vi.fn();
    const firstUndo = vi.fn();
    const secondSave = vi.fn();
    const secondUndo = vi.fn();
    const view = (firstActive: boolean) => (
      <>
        <KeyboardTool active={firstActive} onSave={firstSave} onUndoFile={firstUndo} />
        <KeyboardTool active={!firstActive} onSave={secondSave} onUndoFile={secondUndo} />
      </>
    );
    const rendered = render(view(true));
    shortcut("s");
    shortcut("z");
    expect(firstSave).toHaveBeenCalledOnce();
    expect(firstUndo).toHaveBeenCalledOnce();
    expect(secondSave).not.toHaveBeenCalled();
    expect(secondUndo).not.toHaveBeenCalled();
    rendered.rerender(view(false));
    shortcut("s");
    shortcut("z");
    expect(firstSave).toHaveBeenCalledOnce();
    expect(firstUndo).toHaveBeenCalledOnce();
    expect(secondSave).toHaveBeenCalledOnce();
    expect(secondUndo).toHaveBeenCalledOnce();
  });

  it("keeps standalone shortcuts active and uses the latest handler after edits", () => {
    const oldSave = vi.fn();
    const latestSave = vi.fn();
    const onUndoFile = vi.fn();
    const rendered = render(<KeyboardTool onSave={oldSave} onUndoFile={onUndoFile} />);
    shortcut("s");
    rendered.rerender(<KeyboardTool onSave={latestSave} onUndoFile={onUndoFile} />);
    shortcut("s");
    shortcut("z");
    expect(oldSave).toHaveBeenCalledOnce();
    expect(latestSave).toHaveBeenCalledOnce();
    expect(onUndoFile).toHaveBeenCalledOnce();
  });
});
