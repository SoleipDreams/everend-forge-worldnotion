import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useState } from "react";
import { UniverseDraftContext, UniverseDraftRegistry, useUniverseDraft } from "./useUniverseDraft";

function FormDraft() {
  const [draft, setDraft] = useState("");
  useUniverseDraft(Boolean(draft));
  return (
    <input
      aria-label="Manual draft"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
    />
  );
}

describe("local universe form drafts", () => {
  it("blocks pending form input, clears after save and unregisters on dismissal", () => {
    const registry = new UniverseDraftRegistry();
    const view = render(
      <UniverseDraftContext.Provider value={registry}>
        <FormDraft />
      </UniverseDraftContext.Provider>,
    );
    expect(registry.hasDrafts()).toBe(false);
    fireEvent.change(screen.getByLabelText("Manual draft"), { target: { value: "Pending name" } });
    expect(registry.hasDrafts()).toBe(true);
    fireEvent.change(screen.getByLabelText("Manual draft"), { target: { value: "" } });
    expect(registry.hasDrafts()).toBe(false);
    fireEvent.change(screen.getByLabelText("Manual draft"), {
      target: { value: "Pending schema" },
    });
    view.unmount();
    expect(registry.hasDrafts()).toBe(false);
  });
});
