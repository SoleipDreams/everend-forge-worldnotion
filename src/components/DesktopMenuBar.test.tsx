import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DesktopMenuBar } from "./DesktopMenuBar";

const { customChrome } = vi.hoisted(() => ({ customChrome: vi.fn(() => true) }));
vi.mock("../utils/windowTitlebar", () => ({ hasCustomWindowChrome: customChrome }));

describe("DesktopMenuBar", () => {
  beforeEach(() => customChrome.mockReturnValue(true));

  it("routes the localized menu to the existing app commands", () => {
    const onCommand = vi.fn();
    render(<DesktopMenuBar locale="es" onHome={vi.fn()} onCommand={onCommand} onEditCommand={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Inicio y menú de la aplicación" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Archivo" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Guardar" }));
    expect(onCommand).toHaveBeenCalledWith("wn:file:save");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("restores editor focus before executing an edit command", () => {
    let focused: Element | null = null;
    const onEditCommand = vi.fn(() => { focused = document.activeElement; });
    render(<><textarea aria-label="Editor" /><DesktopMenuBar locale="en" onHome={vi.fn()} onCommand={vi.fn()} onEditCommand={onEditCommand} /></>);
    const editor = screen.getByRole("textbox", { name: "Editor" });
    editor.focus();
    const trigger = screen.getByRole("button", { name: "Home and application menu" });
    fireEvent.mouseDown(trigger);
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    const paste = screen.getByRole("menuitem", { name: "Paste" });
    paste.focus();
    fireEvent.click(paste);
    expect(onEditCommand).toHaveBeenCalledWith("paste");
    expect(focused).toBe(editor);
  });

  it("returns Escape focus to the menu trigger", () => {
    render(<DesktopMenuBar locale="en" onHome={vi.fn()} onCommand={vi.fn()} onEditCommand={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "Home and application menu" });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("keeps the browser and macOS Home action direct", () => {
    customChrome.mockReturnValue(false);
    const onHome = vi.fn();
    render(<DesktopMenuBar locale="en" onHome={onHome} onCommand={vi.fn()} onEditCommand={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Home and application menu" }));
    expect(onHome).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
