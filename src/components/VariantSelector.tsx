import { WorldNotionDropdown } from "../SettingsDropdown.js";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import type { PropertiesConfig } from "../editorTypes";
import { useWorldnotionSurfaceText } from "../i18n";
import {
  BASE_VARIANT_ID,
  addVariant,
  deleteVariant,
  readNoteVariants,
  renameVariant,
  updateVariantsInRawYaml,
} from "../utils/noteVariants";
import { parseFrontmatterRaw } from "../utils/propertiesConfig";

type VariantSelectorProps = {
  rawYaml: string;
  config?: PropertiesConfig;
  type?: string;
  activeVariantId: string;
  onSelect: (id: string) => void;
  onUpdateRawYaml: (yaml: string) => void;
  onDeleteVariant?: (id: string) => void;
};

export function VariantSelector({
  rawYaml,
  config,
  type,
  activeVariantId,
  onSelect,
  onUpdateRawYaml,
  onDeleteVariant,
}: VariantSelectorProps) {
  const surfaceText = useWorldnotionSurfaceText();
  const [editMode, setEditMode] = useState<"create" | "rename" | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const frontmatter = parseFrontmatterRaw(rawYaml);
  const variants = readNoteVariants(frontmatter);
  const selected = variants[activeVariantId] ? activeVariantId : BASE_VARIANT_ID;
  let createVariantActionValue = "__worldnotion_create_variant__";
  while (Object.prototype.hasOwnProperty.call(variants, createVariantActionValue)) {
    createVariantActionValue += "_";
  }

  const write = (next: typeof variants) =>
    onUpdateRawYaml(updateVariantsInRawYaml(rawYaml, next, config, type));

  const beginCreate = () => {
    setLabelDraft("");
    setError(undefined);
    setEditMode("create");
  };

  const beginRename = () => {
    setLabelDraft(variants[selected]?.label ?? "");
    setError(undefined);
    setEditMode("rename");
  };

  const submitLabel = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editMode) return;
    try {
      if (editMode === "create") {
        const next = addVariant(frontmatter, labelDraft);
        write(next.variants);
        onSelect(next.id);
      } else {
        write(renameVariant(frontmatter, selected, labelDraft));
      }
      setEditMode(null);
      setLabelDraft("");
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  };

  const remove = () => {
    if (selected === BASE_VARIANT_ID) return;
    if (onDeleteVariant) onDeleteVariant(selected);
    else write(deleteVariant(frontmatter, selected));
    onSelect(BASE_VARIANT_ID);
    setConfirmDelete(false);
  };

  return (
    <div className="variant-selector">
      <div className="variant-selector-controls">
        <WorldNotionDropdown
          className="variant-selector-title"
          aria-label="Variant"
          value={selected}
          onChange={(event) => {
            if (event.target.value === createVariantActionValue) {
              beginCreate();
              return;
            }
            onSelect(event.target.value);
          }}
        >
          {Object.entries(variants).map(([id, variant]) => (
            <option key={id} value={id}>
              {variant.label}
            </option>
          ))}
          <option value={createVariantActionValue}>
            ＋ {surfaceText("Create new variant…")}
          </option>
        </WorldNotionDropdown>
        <button
          type="button"
          title="Rename variant"
          aria-label="Rename variant"
          onClick={beginRename}
        >
          <Pencil size={14} />
        </button>
        {selected !== BASE_VARIANT_ID ? (
          <button
            type="button"
            className="variant-selector-delete"
            title="Delete variant"
            aria-label="Delete variant"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={14} />
          </button>
        ) : null}
      </div>
      {editMode ? (
        <form className="variant-selector-form" onSubmit={submitLabel}>
          <label>
            <span>{editMode === "create" ? "New variant name" : "Variant name"}</span>
            <input
              autoFocus
              value={labelDraft}
              onChange={(event) => setLabelDraft(event.target.value)}
            />
          </label>
          {error ? <p role="alert">{error}</p> : null}
          <div>
            <button type="submit">{editMode === "create" ? "Create" : "Save"}</button>
            <button type="button" onClick={() => setEditMode(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      {confirmDelete ? (
        <div className="variant-selector-confirm" role="alertdialog" aria-label="Delete variant">
          <p>Delete {variants[selected]?.label} and its exclusive text blocks?</p>
          <button type="button" onClick={remove}>
            Delete
          </button>
          <button type="button" onClick={() => setConfirmDelete(false)}>
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}
