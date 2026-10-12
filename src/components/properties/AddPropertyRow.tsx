import { useModalFocus } from "../../hooks/useModalFocus";
import { useWorldnotionSurfaceText } from "../../i18n";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import type { CustomFieldType } from "../../editorTypes";
import type { VisiblePropertyDefinition } from "../../utils/propertiesConfig";
import { PickerPopover, type PickerItem } from "./PickerPopover";
import { propertyTypeIcon, PROPERTY_TYPE_LABELS } from "./propertyTypeIcons";
import { useUniverseDraft } from "../../hooks/useUniverseDraft";
import { focusAppElement, useAppIsActive } from "../../hooks/useAppInteraction";

export type NewInspectorProperty = {
  name: string;
  type: CustomFieldType;
  parentId?: string;
};

export type AddPropertyRowProps = {
  /** Schema properties that are not present in the note yet. */
  availableProperties: VisiblePropertyDefinition[];
  /** Group properties eligible to contain a new child property. */
  parentProperties: VisiblePropertyDefinition[];
  onAddExisting: (propertyId: string) => void;
  onCreate: (property: NewInspectorProperty) => void | Promise<void>;
};

const PROPERTY_TYPES = Object.entries(PROPERTY_TYPE_LABELS) as Array<[CustomFieldType, string]>;

/**
 * Adds a schema property through a small explicit form. Existing properties
 * remain available through a separate picker so the type and destination are
 * explicit and persistence failures can be reported without closing the form.
 */
export function AddPropertyRow({
  availableProperties,
  parentProperties,
  onAddExisting,
  onCreate,
}: AddPropertyRowProps) {
  const t = useWorldnotionSurfaceText();
  const appActive = useAppIsActive();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<CustomFieldType>("text");
  const [parentId, setParentId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");
  const pickerAnchorRef = useRef<HTMLButtonElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLFormElement>(null);
  useModalFocus(dialogRef, createOpen);
  useUniverseDraft(createOpen && (Boolean(name.trim()) || submitting || Boolean(createError)));

  useEffect(() => {
    if (!createOpen || !appActive) return;
    const frame = window.requestAnimationFrame(() => focusAppElement(nameInputRef.current));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) {
        setCreateOpen(false);
        setName("");
        setType("text");
        setParentId("");
        setCreateError("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [createOpen, submitting, appActive]);

  const items: PickerItem[] = availableProperties.map((property) => {
    const TypeIcon = propertyTypeIcon(property.type);
    return {
      id: property.id,
      label: property.label || property.id,
      sublabel: PROPERTY_TYPE_LABELS[property.type as CustomFieldType] ?? property.type,
      icon: <TypeIcon size={13} />,
      keywords: [property.id, property.description ?? ""],
    };
  });

  const closeCreate = () => {
    setCreateOpen(false);
    setName("");
    setType("text");
    setParentId("");
    setCreateError("");
  };

  const submitCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setCreateError("");
    try {
      await onCreate({ name: name.trim(), type, parentId: parentId || undefined });
      closeCreate();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Could not add the property.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="add-property-row">
      <button
        type="button"
        className="add-property-button add-property-button-primary"
        onClick={() => setCreateOpen(true)}
      >
        <Plus size={13} />
        {t("Add property")}
      </button>
      <button
        ref={pickerAnchorRef}
        type="button"
        className="add-property-button"
        onClick={() => setPickerOpen((current) => !current)}
        aria-expanded={pickerOpen}
      >
        {t("Add existing")}
      </button>
      <PickerPopover
        open={pickerOpen}
        anchorRef={pickerAnchorRef}
        items={items}
        placeholder={t("Find a property…")}
        emptyLabel={t("No properties in schema")}
        onSelect={(item) => onAddExisting(item.id)}
        onClose={() => setPickerOpen(false)}
      />

      {createOpen
        ? createPortal(
            <div
              className="property-create-backdrop"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !submitting) closeCreate();
              }}
            >
              <form
                ref={dialogRef}
                tabIndex={-1}
                className="property-create-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="property-create-title"
                onSubmit={submitCreate}
              >
                <div>
                  <h3 id="property-create-title">{t("Add property")}</h3>
                  <p>{t("Define the field and add it to this note.")}</p>
                </div>
                <label>
                  {t("Name")}
                  <input
                    ref={nameInputRef}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Portrait"
                  />
                </label>
                <label>
                  {t("Type")}
                  <select
                    aria-label={t("Property type")}
                    value={type}
                    onChange={(event) => setType(event.target.value as CustomFieldType)}
                  >
                    {PROPERTY_TYPES.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("Parent section")}
                  <select
                    aria-label={t("Parent section")}
                    value={parentId}
                    onChange={(event) => setParentId(event.target.value)}
                  >
                    <option value="">{t("Top level")}</option>
                    {parentProperties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.label || property.id}
                      </option>
                    ))}
                  </select>
                  <small>{t("Choose a section only when this property belongs inside it.")}</small>
                </label>
                {createError ? (
                  <p className="property-create-error" role="alert">
                    {createError}
                  </p>
                ) : null}
                <div className="property-create-actions">
                  <button type="button" onClick={closeCreate} disabled={submitting}>
                    {t("Cancel")}
                  </button>
                  <button type="submit" disabled={!name.trim() || submitting}>
                    {t(submitting ? "Adding…" : "Add property")}
                  </button>
                </div>
              </form>
            </div>,
            pickerAnchorRef.current?.closest(".forge-worldnotion") ?? document.body,
          )
        : null}
    </div>
  );
}
