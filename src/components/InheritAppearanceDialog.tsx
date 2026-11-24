import { useEffect, useState } from "react";
import "../App.css";
import { UniverseIconFrame } from "./UniverseIconFrame";
import type { RecentUniverseProfile } from "../editorTypes";

const FRESH_START = "__fresh__";

export type InheritAppearanceChoice = { type: "inherit"; path: string } | { type: "fresh" };

export type InheritAppearanceOption = {
  path: string;
  profile?: RecentUniverseProfile;
};

export interface InheritAppearanceDialogProps {
  isOpen: boolean;
  options: InheritAppearanceOption[];
  onConfirm: (choice: InheritAppearanceChoice) => void;
  onCancel: () => void;
}

function optionLabel(option: InheritAppearanceOption): string {
  return (
    option.profile?.name ??
    option.path
      .replace(/^browser:/, "")
      .split(/[\\/]/)
      .pop() ??
    option.path
  );
}

export function InheritAppearanceDialog({
  isOpen,
  options,
  onConfirm,
  onCancel,
}: InheritAppearanceDialogProps) {
  const [selected, setSelected] = useState<string>(options[0]?.path ?? FRESH_START);

  useEffect(() => {
    if (isOpen) setSelected(options[0]?.path ?? FRESH_START);
  }, [isOpen, options]);

  if (!isOpen) return null;

  function handleConfirm() {
    onConfirm(selected === FRESH_START ? { type: "fresh" } : { type: "inherit", path: selected });
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onCancel();
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-dialog inherit-appearance-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Start with a familiar style"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="modal-header">
          <h2>Start with a familiar style?</h2>
        </div>
        <div className="modal-body">
          <p>
            Carry the theme, editor, explorer, graph, plugin and AI advisor settings from a recent
            universe, or start with the defaults.
          </p>
          <div className="inherit-appearance-options">
            <label
              className={`inherit-appearance-option ${selected === FRESH_START ? "selected" : ""}`}
            >
              <input
                type="radio"
                name="inherit-appearance"
                checked={selected === FRESH_START}
                onChange={() => setSelected(FRESH_START)}
              />
              <span>Start with default settings</span>
            </label>
            {options.map((option) => (
              <label
                key={option.path}
                className={`inherit-appearance-option ${selected === option.path ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="inherit-appearance"
                  checked={selected === option.path}
                  onChange={() => setSelected(option.path)}
                />
                <UniverseIconFrame profile={option.profile} size={26} />
                <span>{optionLabel(option)}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onCancel} className="modal-button modal-button-cancel" type="button">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="modal-button modal-button-confirm"
            type="button"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
