import type { EditorMode, WritingMode } from "../editorTypes";

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
  const selected: ModeOption = mode === "source" ? "source" : writingMode;

  return (
    <select
      className="editor-mode-dropdown"
      aria-label={labels.mode}
      value={selected}
      onChange={(event) => {
        const value = event.currentTarget.value as ModeOption;
        if (value === "source") onOpenSource();
        else onWritingModeChange(value);
      }}
    >
      <option value="processed" disabled={disabled}>{labels.processed}</option>
      <option value="semi" disabled={disabled}>{labels.semi}</option>
      <option value="source">{labels.source}</option>
    </select>
  );
}
