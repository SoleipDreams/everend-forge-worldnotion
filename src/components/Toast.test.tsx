import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { Toast } from "./Toast";
import { ToastProvider, TOAST_DURATION_MS, useToast } from "./ToastProvider";
import { NotificationBell } from "../notifications";

describe("Toast", () => {
  it("renders nothing when not visible", () => {
    const { container } = render(<Toast message="Hidden" isVisible={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("applies the kind class and shows the message", () => {
    render(<Toast message="Save failed." kind="error" isVisible={true} />);
    const status = screen.getByRole("status");
    expect(status).toHaveClass("toast-error");
    expect(status).toHaveTextContent("Save failed.");
  });

  it("defaults to the info kind", () => {
    render(<Toast message="Hello" isVisible={true} />);
    expect(screen.getByRole("status")).toHaveClass("toast-info");
  });
});

function ShowOnMount({ messages }: { messages: Array<[string, "success" | "error"]> }) {
  const { showToast } = useToast();
  return (
    <button onClick={() => messages.forEach(([message, kind]) => showToast(message, kind))}>
      fire
    </button>
  );
}

describe("ToastProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the latest toast without a backlog and keeps earlier notices in the bell", () => {
    render(
      <ToastProvider>
        <NotificationBell />
        <ShowOnMount
          messages={[
            ["First", "success"],
            ["Second", "error"],
          ]}
        />
      </ToastProvider>,
    );

    act(() => {
      screen.getByText("fire").click();
    });

    expect(screen.getByRole("status")).toHaveTextContent("Second");
    expect(screen.queryByText("First")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS.error + 10);
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    act(() => screen.getByRole("button", { name: "Notifications (2)" }).click());
    expect(screen.getByRole("dialog")).toHaveTextContent("First");
    expect(screen.getByRole("dialog")).toHaveTextContent("Second");
  });

  it("keeps error toasts on screen longer than success toasts", () => {
    expect(TOAST_DURATION_MS.error).toBeGreaterThan(TOAST_DURATION_MS.success);
  });

  it("coalesces repeated identical save notifications", () => {
    render(
      <ToastProvider>
        <ShowOnMount
          messages={Array.from({ length: 20 }, () => [
            "Properties configuration saved.",
            "success",
          ])}
        />
      </ToastProvider>,
    );

    act(() => {
      screen.getByText("fire").click();
    });
    expect(screen.getByRole("status")).toHaveTextContent("Properties configuration saved.");

    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS.success + 10);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
