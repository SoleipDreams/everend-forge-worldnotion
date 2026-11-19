import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PropertyValuePopover } from "./PropertyValuePopover";

describe("PropertyValuePopover", () => {
  it("stays open while a nested picker is used, then closes on an outside press", () => {
    const anchorEl = document.createElement("button");
    document.body.appendChild(anchorEl);
    const onClose = vi.fn();

    render(
      <PropertyValuePopover
        id="property-value-editor-affiliation"
        anchorEl={anchorEl}
        label="Affiliation"
        onClose={onClose}
      >
        <div className="picker-popover" role="dialog" aria-label="Organization picker">
          <button type="button">Test organization</button>
        </div>
      </PropertyValuePopover>,
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: "Test organization" }));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
