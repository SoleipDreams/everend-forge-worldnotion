import type { ReactNode } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FeedbackModal } from "../components/FeedbackModal";
import { EditorModeSelector } from "../components/EditorModeSelector";
import { InputDialog } from "../components/InputDialog";
import { StructureActionsMenu } from "../components/StructureActionsMenu";
import { AddPropertyRow } from "../components/properties/AddPropertyRow";
import { PropertyEditorPopover } from "../components/properties/PropertyEditorPopover";
import type { StructuredElement } from "../utils/structuredMarkdown";
import type { VisiblePropertyDefinition } from "../utils/propertiesConfig";
import { AppInteractionContext, focusAppElement } from "./useAppInteraction";
import { UniverseDraftContext, UniverseDraftRegistry } from "./useUniverseDraft";

function tool(active: boolean, children: ReactNode, drafts = new UniverseDraftRegistry()) {
  return (
    <>
      <button type="button">Other tool</button>
      <AppInteractionContext.Provider value={active}>
        <UniverseDraftContext.Provider value={drafts}>
          <div className="forge-worldnotion" data-app-active={active}>
            {children}
          </div>
        </UniverseDraftContext.Provider>
      </AppInteractionContext.Provider>
    </>
  );
}

function key(key: string) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  fireEvent(screen.getByRole("button", { name: "Other tool" }), event);
  return event;
}

async function animationFrame() {
  await act(async () => {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  });
}

describe("mounted WorldNotion overlay ownership", () => {
  it("leaves Escape, Tab and focus to the active app while feedback is hidden, then recovers Escape", () => {
    const onClose = vi.fn();
    const modal = <FeedbackModal screen="workspace" onClose={onClose} onOpenExternal={vi.fn()} />;
    const rendered = render(tool(true, modal));
    rendered.rerender(tool(false, modal));
    const external = screen.getByRole("button", { name: "Other tool" });
    external.focus();

    expect(key("Escape").defaultPrevented).toBe(false);
    expect(key("Tab").defaultPrevented).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
    expect(external).toHaveFocus();

    rendered.rerender(tool(true, modal));
    key("Escape");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("preserves the mode menu while hidden and prevents its pending animation from taking focus", async () => {
    const menu = (
      <EditorModeSelector
        mode="write"
        writingMode="processed"
        labels={{ writing: "Writing", processed: "Processed", semi: "Semi", source: "Source" }}
        onWritingModeChange={vi.fn()}
        onOpenWriting={vi.fn()}
        onOpenSource={vi.fn()}
      />
    );
    const rendered = render(tool(true, menu));
    fireEvent.click(screen.getByRole("button", { name: "Writing: Processed" }));
    rendered.rerender(tool(false, menu));
    const external = screen.getByRole("button", { name: "Other tool" });
    external.focus();
    await animationFrame();

    expect(external).toHaveFocus();
    expect(key("Escape").defaultPrevented).toBe(false);
    expect(key("Tab").defaultPrevented).toBe(false);
    expect(screen.getByRole("menu", { name: "Writing" })).toBeInTheDocument();
    fireEvent.mouseDown(external);
    expect(screen.getByRole("menu", { name: "Writing" })).toBeInTheDocument();

    rendered.rerender(tool(true, menu));
    expect(key("Escape").defaultPrevented).toBe(true);
    expect(screen.queryByRole("menu")).toBeNull();
    await animationFrame();
    expect(screen.getByRole("button", { name: "Processed" })).toHaveFocus();
  });

  it("keeps a property creation draft and its universe guard registered through hidden Escape", async () => {
    const drafts = new UniverseDraftRegistry();
    const onCreate = vi.fn();
    const row = (
      <AddPropertyRow
        availableProperties={[]}
        parentProperties={[]}
        onAddExisting={vi.fn()}
        onCreate={onCreate}
      />
    );
    const rendered = render(tool(true, row, drafts));
    fireEvent.click(screen.getByRole("button", { name: "Add property" }));
    const dialog = screen.getByRole("dialog", { name: "Add property" });
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Portrait" } });
    expect(drafts.hasDrafts()).toBe(true);

    rendered.rerender(tool(false, row, drafts));
    const external = screen.getByRole("button", { name: "Other tool" });
    external.focus();
    expect(key("Escape").defaultPrevented).toBe(false);
    expect(key("Tab").defaultPrevented).toBe(false);
    await animationFrame();
    expect(external).toHaveFocus();
    expect(within(dialog).getByLabelText("Name")).toHaveValue("Portrait");
    expect(drafts.hasDrafts()).toBe(true);
    expect(onCreate).not.toHaveBeenCalled();

    rendered.rerender(tool(true, row, drafts));
    key("Escape");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(drafts.hasDrafts()).toBe(false);
  });

  it("does not commit or cancel a hidden structure draft from another app's outside click or Escape", () => {
    const drafts = new UniverseDraftRegistry();
    const onReplace = vi.fn();
    const onDismiss = vi.fn();
    const element: StructuredElement = {
      kind: "wikilink",
      from: 0,
      to: 14,
      text: "[[Aster|Star]]",
      target: "Aster",
      alias: "Star",
      label: "Star",
    };
    const panel = (
      <StructureActionsMenu
        element={element}
        x={10}
        y={10}
        onReplace={onReplace}
        onDismiss={onDismiss}
        onOpenSource={vi.fn()}
        onOpenWikilink={vi.fn()}
        onOpenUrl={vi.fn()}
      />
    );
    const rendered = render(tool(true, panel, drafts));
    fireEvent.change(screen.getByLabelText("Destination"), { target: { value: "Aster II" } });
    rendered.rerender(tool(false, panel, drafts));
    fireEvent.mouseDown(screen.getByRole("button", { name: "Other tool" }));
    expect(key("Escape").defaultPrevented).toBe(false);
    expect(key("Tab").defaultPrevented).toBe(false);
    expect(onReplace).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Destination")).toHaveValue("Aster II");
    expect(drafts.hasDrafts()).toBe(true);

    rendered.rerender(tool(true, panel, drafts));
    fireEvent.mouseDown(screen.getByRole("button", { name: "Other tool" }));
    expect(onReplace).toHaveBeenCalledExactlyOnceWith(element, "[[Aster II|Star]]");
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("does not autofocus a newly opened dialog in an inactive app and focuses it on return", () => {
    const dialog = (isOpen: boolean) => (
      <InputDialog isOpen={isOpen} title="New note" defaultValue="Aster" onConfirm={vi.fn()} />
    );
    const rendered = render(tool(false, dialog(false)));
    const external = screen.getByRole("button", { name: "Other tool" });
    external.focus();
    rendered.rerender(tool(false, dialog(true)));
    expect(external).toHaveFocus();
    expect(key("Escape").defaultPrevented).toBe(false);
    rendered.rerender(tool(true, dialog(true)));
    expect(screen.getByRole("textbox")).toHaveFocus();
    expect(screen.getByRole("textbox")).toHaveValue("Aster");
  });

  it("retains a property editor draft if focus leaves after the app becomes inactive", () => {
    const drafts = new UniverseDraftRegistry();
    const onRename = vi.fn();
    const onClose = vi.fn();
    const property: VisiblePropertyDefinition = {
      id: "portrait",
      label: "Portrait",
      type: "text",
      source: "custom",
    };
    const popover = (
      <PropertyEditorPopover
        open
        anchorEl={null}
        property={property}
        allProperties={[property]}
        editableOptions={[]}
        canEditOptions={false}
        isProtected={false}
        parentId=""
        onClose={onClose}
        onRename={onRename}
        onChangeType={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateOptions={vi.fn()}
        onMoveParent={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    const rendered = render(tool(true, popover, drafts));
    const input = screen.getByLabelText("Property name");
    fireEvent.change(input, { target: { value: "Character portrait" } });
    rendered.rerender(tool(false, popover, drafts));
    screen.getByRole("button", { name: "Other tool" }).focus();
    fireEvent.blur(input);
    fireEvent.pointerDown(document.body);
    key("Escape");
    expect(onRename).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(input).toHaveValue("Character portrait");
    expect(drafts.hasDrafts()).toBe(true);
    rendered.rerender(tool(true, popover, drafts));
    fireEvent.blur(input);
    expect(onRename).toHaveBeenCalledExactlyOnceWith("Character portrait");
  });

  it("refuses deferred focus into hidden, inert, inactive or detached content", () => {
    const rendered = render(
      <>
        <button>Other tool</button>
        <div data-testid="root">
          <input />
        </div>
      </>,
    );
    const external = screen.getByRole("button", { name: "Other tool" });
    const root = screen.getByTestId("root");
    const input = screen.getByRole("textbox");
    external.focus();
    for (const [name, value] of [
      ["hidden", ""],
      ["inert", ""],
      ["data-app-active", "false"],
    ]) {
      root.setAttribute(name, value);
      focusAppElement(input);
      expect(external).toHaveFocus();
      root.removeAttribute(name);
    }
    focusAppElement(input);
    expect(input).toHaveFocus();
    rendered.unmount();
    focusAppElement(input);
    expect(document.activeElement).toBe(document.body);
  });
});
