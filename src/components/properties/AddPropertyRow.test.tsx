import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddPropertyRow } from "./AddPropertyRow";

describe("AddPropertyRow portal scope", () => {
  it("mounts the property dialog in its owning theme root when other applications are mounted", () => {
    const onCreate = vi.fn();
    const result = render(
      <>
        <div className="forge-worldnotion" data-theme="worldnotion-light" data-testid="other-app" />
        <div className="forge-worldnotion" data-theme="worldnotion-dark" data-testid="owning-app">
          <aside>
            <AddPropertyRow
              availableProperties={[]}
              parentProperties={[]}
              onAddExisting={vi.fn()}
              onCreate={onCreate}
            />
          </aside>
        </div>
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add property" }));
    const dialog = screen.getByRole("dialog", { name: "Add property" });
    expect(dialog.closest(".forge-worldnotion")).toBe(screen.getByTestId("owning-app"));
    expect(dialog.closest(".forge-worldnotion")).toHaveAttribute("data-theme", "worldnotion-dark");
    expect(screen.getByTestId("other-app").querySelector("[role=dialog]")).toBeNull();
    expect(result.container.contains(dialog)).toBe(true);

    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Portrait" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onCreate).not.toHaveBeenCalled();
  });
});
