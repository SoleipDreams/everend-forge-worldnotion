import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makeVaultFile, makeVaultIndex } from "../../../test/fixtures";
import { FileField } from "./FileField";

describe("FileField", () => {
  it("picks a vault-relative file path and offers a clear action", () => {
    const onChange = vi.fn();
    const vaultIndex = makeVaultIndex({
      entities: [],
      files: [makeVaultFile("References/Attachment.md")],
    });

    render(
      <FileField
        value="References/Attachment.md"
        onChange={onChange}
        vaultIndex={vaultIndex}
      />,
    );

    const trigger = screen.getByRole("button", { name: /References\/Attachment\.md/ });
    expect(trigger).toHaveClass("entity-ref-chip");
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: /Attachment\.md/ }));
    expect(onChange).toHaveBeenCalledWith("References/Attachment.md");

    fireEvent.click(screen.getByTitle("Clear file"));
    expect(onChange).toHaveBeenLastCalledWith("");
  });
});
