import { WorldnotionLocaleProvider } from "../i18n";
import { AppInteractionContext } from "../hooks/useAppInteraction";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NotificationProvider } from "../notifications";
import { DialogProvider, useAppDialogs } from "./DialogProvider";

function Harness({ onResult }: { onResult: (result: unknown) => void }) {
  const { confirmDialog, alertDialog, promptDialog } = useAppDialogs();
  return (
    <div>
      <button onClick={() => void confirmDialog("Delete this?").then(onResult)}>ask-confirm</button>
      <button
        onClick={() => void alertDialog("Saved!", { title: "Done" }).then(() => onResult("closed"))}
      >
        ask-alert
      </button>
      <button onClick={() => void promptDialog("New name", "name", "old").then(onResult)}>
        ask-prompt
      </button>
    </div>
  );
}

function renderHarness() {
  const onResult = vi.fn();
  render(
    <DialogProvider>
      <Harness onResult={onResult} />
    </DialogProvider>,
  );
  return onResult;
}

describe("DialogProvider", () => {
  it("resolves confirmDialog with true on confirm", async () => {
    const onResult = renderHarness();
    fireEvent.click(screen.getByText("ask-confirm"));
    expect(screen.getByText("Delete this?")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await vi.waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
    expect(screen.queryByText("Delete this?")).toBeNull();
  });

  it("resolves confirmDialog with false on cancel", async () => {
    const onResult = renderHarness();
    fireEvent.click(screen.getByText("ask-confirm"));
    fireEvent.click(screen.getByText("Cancel"));
    await vi.waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  it("shows and closes alertDialog", async () => {
    const onResult = renderHarness();
    fireEvent.click(screen.getByText("ask-alert"));
    expect(screen.getByText("Saved!")).toBeTruthy();
    expect(screen.getByText("Done")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await vi.waitFor(() => expect(onResult).toHaveBeenCalledWith("closed"));
  });

  it("resolves promptDialog with the typed value", async () => {
    const onResult = renderHarness();
    fireEvent.click(screen.getByText("ask-prompt"));

    const input = screen.getByPlaceholderText("name") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "fresh" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await vi.waitFor(() => expect(onResult).toHaveBeenCalledWith("fresh"));
  });

  it("resolves promptDialog with null when cancelled", async () => {
    const onResult = renderHarness();
    fireEvent.click(screen.getByText("ask-prompt"));
    fireEvent.click(screen.getByText("Cancel"));
    await vi.waitFor(() => expect(onResult).toHaveBeenCalledWith(null));
  });

  it("closes the confirm dialog with Escape resolving false", async () => {
    const onResult = renderHarness();
    fireEvent.click(screen.getByText("ask-confirm"));
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    await vi.waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });
});

describe("dialog ownership", () => {
  it("uses the owner locale and restores the trigger after Escape", () => {
    render(
      <WorldnotionLocaleProvider value="es">
        <DialogProvider>
          <Harness onResult={vi.fn()} />
        </DialogProvider>
      </WorldnotionLocaleProvider>,
    );
    const trigger = screen.getByText("ask-confirm");
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    expect(document.activeElement).toBe(trigger);
  });
  it("wraps Tab within the dialog and does not focus an inactive Suite tool", () => {
    const rects = vi
      .spyOn(HTMLElement.prototype, "getClientRects")
      .mockReturnValue([{ width: 1, height: 1 }] as unknown as DOMRectList);
    const view = render(
      <AppInteractionContext.Provider value={true}>
        <DialogProvider>
          <Harness onResult={vi.fn()} />
        </DialogProvider>
      </AppInteractionContext.Provider>,
    );
    fireEvent.click(screen.getByText("ask-confirm"));
    const confirm = screen.getByRole("button", { name: "Confirm" });
    const cancel = screen.getByRole("button", { name: "Cancel" });
    confirm.focus();
    fireEvent.keyDown(confirm, { key: "Tab" });
    expect(document.activeElement).toBe(cancel);
    fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(confirm);
    const dialog = screen.getByRole("alertdialog");
    dialog.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(confirm);
    dialog.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(cancel);
    view.unmount();
    render(
      <AppInteractionContext.Provider value={false}>
        <DialogProvider>
          <Harness onResult={vi.fn()} />
        </DialogProvider>
      </AppInteractionContext.Provider>,
    );
    const trigger = screen.getByText("ask-confirm");
    trigger.focus();
    fireEvent.click(trigger);
    expect(document.activeElement).toBe(trigger);
    rects.mockRestore();
  });
});

describe("nonblocking informational dialogs", () => {
  it("notifies without a modal while confirmations still require a decision", async () => {
    const onResult = vi.fn();
    render(
      <NotificationProvider>
        <DialogProvider notifyAlerts>
          <Harness onResult={onResult} />
        </DialogProvider>
      </NotificationProvider>,
    );
    fireEvent.click(screen.getByText("ask-alert"));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Saved!");
    await vi.waitFor(() => expect(onResult).toHaveBeenCalledWith("closed"));
    fireEvent.click(screen.getByText("ask-confirm"));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await vi.waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });
});
