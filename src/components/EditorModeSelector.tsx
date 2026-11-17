import { useRef } from "react";
import type { KeyboardEvent } from "react";
import type { EditorMode, WritingMode } from "../editorTypes";
import { focusAppElement } from "../hooks/useAppInteraction";

type ModeOption = "processed" | "semi" | "source";

type EditorModeSelectorProps = {
  mode: EditorMode;
  writingMode: WritingMode;
  disabled?: boolean;
  labels: { mode: string; processed: string; semi: string; source: string };
  onWritingModeChange: (mode: WritingMode) => void;
  onOpenSource: () => void;
};

export function EditorModeSelector({
  mode,
  writingMode,
  disabled = false,
  labels,
  onWritingModeChange,
  onOpenSource,
}: EditorModeSelectorProps) {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selected: ModeOption = mode === "source" ? "source" : writingMode;
  const options: Array<{ id: ModeOption; label: string; disabled?: boolean }> = [
    { id: "processed", label: labels.processed, disabled },
    { id: "semi", label: labels.semi, disabled },
    { id: "source", label: labels.source },
  ];

  function selectOption(id: ModeOption) {
    if (id === "source") onOpenSource();
    else onWritingModeChange(id);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const enabledIndexes = options.flatMap((option, index) => (option.disabled ? [] : [index]));
    const position = enabledIndexes.indexOf(currentIndex);
    const nextPosition =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? enabledIndexes.length - 1
          : (position + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) +
              enabledIndexes.length) %
            enabledIndexes.length;
    const nextIndex = enabledIndexes[nextPosition];
    const next = options[nextIndex];
    if (!next) return;
    focusAppElement(optionRefs.current[nextIndex]);
    selectOption(next.id);
  }

  return (
    <div className="mode-toggle" role="radiogroup" aria-label={labels.mode}>
      {options.map((option, index) => {
        const checked = selected === option.id;
        return (
          <button
            ref={(element) => {
              optionRefs.current[index] = element;
            }}
            key={option.id}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.label}
            tabIndex={checked ? 0 : -1}
            className={checked ? "active" : ""}
            disabled={option.disabled}
            onClick={() => selectOption(option.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
