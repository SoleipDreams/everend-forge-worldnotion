import { useEffect, useState } from "react";
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  size,
  useFloating,
} from "@floating-ui/react";
import { ArrowLeft, ChevronRight, Copy, Plus, Trash2, X } from "lucide-react";
import type { CustomFieldType } from "../../editorTypes";
import type { VisiblePropertyDefinition } from "../../utils/propertiesConfig";
import { PROPERTY_TYPE_LABELS } from "./propertyTypeIcons";
import { useUniverseDraft } from "../../hooks/useUniverseDraft";
import { useAppIsActive } from "../../hooks/useAppInteraction";

export type EditableOption = { value: string; label: string; color?: string };
type EditorPanel = "types" | "options" | "conditions" | "parent" | "yaml";

const SELECTABLE_TYPES = (Object.keys(PROPERTY_TYPE_LABELS) as CustomFieldType[]).filter(
  (type) => type !== "group",
);

export type PropertyEditorPopoverProps = {
  open: boolean;
  anchorEl: HTMLElement | null;
  property: VisiblePropertyDefinition;
  allProperties: VisiblePropertyDefinition[];
  /** Fully resolved options (handles the special type/status cases). */
  editableOptions: EditableOption[];
  canEditOptions: boolean;
  isProtected: boolean;
  parentId: string;
  propertyPaths?: Record<string, string[]>;
  entityTypes?: Array<{ id: string; label: string }>;
  optionSets?: Record<string, EditableOption[]>;
  onClose: () => void;
  onRename: (label: string) => void;
  onChangeType: (type: CustomFieldType) => void;
  onUpdate: (patch: { description?: string; required?: boolean }) => void;
  onUpdateOptions: (options: EditableOption[]) => void;
  onSetConditions?: (conditions: Record<string, string[]>) => void;
  onSetAppliesTo?: (typeIds: string[] | undefined) => void;
  onMoveParent: (parentId: string | null) => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

/**
 * Notion-style contextual property editor. Anchored to the property row and
 * consolidating everything the old two-column PropertyManagerModal did:
 * name, type, description, required, options, dependency, location, and the
 * duplicate/make-root/delete actions. Presentational — every mutation is a
 * curried callback owned by MetadataEditor, which keeps the YAML the source of
 * truth. Reuses the floating anchor pattern from PickerPopover.
 */
export function PropertyEditorPopover({
  open,
  anchorEl,
  property,
  allProperties,
  editableOptions,
  canEditOptions,
  isProtected,
  parentId,
  propertyPaths = {},
  entityTypes = [],
  optionSets = {},
  onClose,
  onRename,
  onChangeType,
  onUpdate,
  onUpdateOptions,
  onSetConditions = () => undefined,
  onSetAppliesTo = () => undefined,
  onMoveParent,
  onDuplicate,
  onDelete,
}: PropertyEditorPopoverProps) {
  const appActive = useAppIsActive();
  const [nameDraft, setNameDraft] = useState(property.label ?? property.id);
  const [descriptionDraft, setDescriptionDraft] = useState(property.description ?? "");
  const [optionsDraft, setOptionsDraft] = useState<EditableOption[]>(editableOptions);
  const [conditionsDraft, setConditionsDraft] = useState<Record<string, string[]>>(
    property.visibleWhen ?? {},
  );
  const [activePanel, setActivePanel] = useState<EditorPanel | null>(null);
  useUniverseDraft(
    open &&
      (nameDraft !== (property.label ?? property.id) ||
        descriptionDraft !== (property.description ?? "") ||
        JSON.stringify(optionsDraft) !== JSON.stringify(editableOptions)),
  );

  const { refs, floatingStyles } = useFloating({
    open,
    placement: "left-start",
    strategy: "fixed",
    middleware: [
      offset(6),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply({ availableHeight, elements }) {
          elements.floating.style.maxHeight = `${Math.max(240, Math.min(availableHeight, 520))}px`;
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  useEffect(() => {
    refs.setReference(anchorEl);
  }, [anchorEl, refs, open]);

  useEffect(() => {
    if (!open || !appActive) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (refs.floating.current?.contains(target)) return;
      if (anchorEl?.contains(target)) return;
      onClose();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [anchorEl, onClose, open, refs.floating, appActive]);

  if (!open) return null;

  const commitName = () => {
    if (!appActive) return;
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== (property.label ?? property.id)) {
      onRename(trimmed);
    }
  };

  const commitDescription = () => {
    if (!appActive) return;
    if (descriptionDraft !== (property.description ?? "")) {
      onUpdate({ description: descriptionDraft });
    }
  };

  const commitOptions = (nextOptions: EditableOption[] = optionsDraft) => {
    if (!appActive) return;
    if (JSON.stringify(nextOptions) !== JSON.stringify(editableOptions)) {
      onUpdateOptions(nextOptions);
    }
  };

  const commitConditions = (nextConditions: Record<string, string[]>) => {
    setConditionsDraft(nextConditions);
    onSetConditions(nextConditions);
  };

  const dependencyParents = allProperties.filter(
    (candidate) =>
      candidate.id !== property.id &&
      candidate.id !== "type" &&
      (candidate.type === "select" || candidate.type === "multiselect"),
  );
  const conditions = conditionsDraft;

  const parentCandidates = allProperties.filter(
    (candidate) => candidate.id !== property.id && candidate.type === "group",
  );
  const parentProperty = allProperties.find((candidate) => candidate.id === parentId);
  const storagePath = propertyPaths[property.id] ?? [property.id];
  const yamlPreview =
    property.type === "group"
      ? `${storagePath.join(":\n  ")}:\n  …`
      : `${storagePath.join(":\n  ")}: <value>`;

  const selectedTypeIds =
    property.appliesTo ?? parentProperty?.appliesTo ?? entityTypes.map((type) => type.id);
  const typeSummary =
    property.appliesTo === undefined && parentProperty
      ? `Inherited from ${parentProperty.label ?? parentProperty.id}`
      : selectedTypeIds.length === entityTypes.length
        ? "All entity types"
        : selectedTypeIds.length === 0
          ? "No entity types"
          : entityTypes
              .filter((type) => selectedTypeIds.includes(type.id))
              .map((type) => type.label)
              .join(", ");
  const conditionCount = Object.keys(conditions).length;
  const parentSummary = parentId
    ? (propertyPaths[parentId] ?? [parentId]).join(" / ")
    : "Top level";
  const panelTitle: Record<EditorPanel, string> = {
    types: "Available on types",
    options: "Options",
    conditions: "Show when",
    parent: "Parent section",
    yaml: "YAML storage",
  };

  const updateOption = (index: number, patch: Partial<EditableOption>) => {
    setOptionsDraft((current) =>
      current.map((option, optionIndex) =>
        optionIndex === index ? { ...option, ...patch } : option,
      ),
    );
  };

  return (
    <FloatingPortal root={anchorEl?.closest<HTMLElement>(".forge-worldnotion") ?? undefined}>
      <div
        ref={refs.setFloating}
        style={floatingStyles}
        className="property-editor-popover"
        role="dialog"
        aria-label={`Edit ${property.label ?? property.id}`}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            if (activePanel) {
              setActivePanel(null);
            } else {
              onClose();
            }
          }
        }}
      >
        <div className="property-editor-header">
          <input
            className="property-editor-name"
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitName();
              }
            }}
            disabled={isProtected}
            autoFocus={appActive && !isProtected}
            title={isProtected ? "Core fields cannot be renamed" : undefined}
            aria-label="Property name"
          />
          <button type="button" onClick={onClose} title="Close" aria-label="Close">
            <X size={14} />
          </button>
        </div>

        <label className="property-editor-field">
          <span>Type</span>
          <select
            value={property.type}
            disabled={isProtected || property.type === "group"}
            onChange={(event) => onChangeType(event.target.value as CustomFieldType)}
          >
            {SELECTABLE_TYPES.map((type) => (
              <option key={type} value={type}>
                {PROPERTY_TYPE_LABELS[type]}
              </option>
            ))}
            {property.type === "group" ? <option value="group">Group</option> : null}
          </select>
        </label>

        <label className="property-editor-field">
          <span>Description</span>
          <textarea
            value={descriptionDraft}
            rows={2}
            onChange={(event) => setDescriptionDraft(event.target.value)}
            onBlur={commitDescription}
            placeholder="Optional helper text"
          />
        </label>

        <label className="property-editor-checkbox">
          <input
            type="checkbox"
            checked={property.required ?? false}
            onChange={(event) => onUpdate({ required: event.target.checked })}
          />
          <span>Required</span>
        </label>

        <div className="property-editor-navigation">
          {!isProtected ? (
            <button
              type="button"
              aria-label="Available on types"
              onClick={() => setActivePanel("types")}
            >
              <span>
                <strong>Available on types</strong>
                <small>{typeSummary}</small>
              </span>
              <ChevronRight size={14} />
            </button>
          ) : null}
          {canEditOptions ? (
            <button type="button" aria-label="Options" onClick={() => setActivePanel("options")}>
              <span>
                <strong>Options</strong>
                <small>{optionsDraft.length} configured</small>
              </span>
              <ChevronRight size={14} />
            </button>
          ) : null}
          {!isProtected && dependencyParents.length ? (
            <button
              type="button"
              aria-label="Show when"
              onClick={() => setActivePanel("conditions")}
            >
              <span>
                <strong>Show when</strong>
                <small>
                  {conditionCount === 0
                    ? "Always visible"
                    : `${conditionCount} ${conditionCount === 1 ? "condition" : "conditions"}`}
                </small>
              </span>
              <ChevronRight size={14} />
            </button>
          ) : null}
          {!isProtected ? (
            <button
              type="button"
              aria-label="Parent section"
              onClick={() => setActivePanel("parent")}
            >
              <span>
                <strong>Parent section</strong>
                <small>{parentSummary}</small>
              </span>
              <ChevronRight size={14} />
            </button>
          ) : null}
          <button type="button" aria-label="YAML storage" onClick={() => setActivePanel("yaml")}>
            <span>
              <strong>YAML storage</strong>
              <small>{storagePath.join(".")}</small>
            </span>
            <ChevronRight size={14} />
          </button>
        </div>

        {activePanel ? (
          <section
            className="property-editor-subpanel"
            role="region"
            aria-label={panelTitle[activePanel]}
          >
            <div className="property-editor-subpanel-header">
              <button
                type="button"
                onClick={() => setActivePanel(null)}
                aria-label="Back to property"
              >
                <ArrowLeft size={14} />
              </button>
              <strong>{panelTitle[activePanel]}</strong>
            </div>

            <div className="property-editor-subpanel-body">
              {activePanel === "types" ? (
                <>
                  <p>Choose where this property is available.</p>
                  {property.appliesTo === undefined && parentProperty ? (
                    <div className="property-editor-inherited">
                      Inherited from {parentProperty.label ?? parentProperty.id}
                    </div>
                  ) : null}
                  {property.appliesTo !== undefined && parentProperty ? (
                    <button
                      type="button"
                      className="property-editor-action"
                      onClick={() => onSetAppliesTo(undefined)}
                    >
                      Use inherited scope
                    </button>
                  ) : null}
                  <div className="property-editor-choice-list">
                    {entityTypes.map((type) => (
                      <label key={type.id}>
                        <input
                          type="checkbox"
                          checked={selectedTypeIds.includes(type.id)}
                          onChange={(event) => {
                            const next = event.target.checked
                              ? [...new Set([...selectedTypeIds, type.id])]
                              : selectedTypeIds.filter((id) => id !== type.id);
                            onSetAppliesTo(
                              !parentProperty && next.length === entityTypes.length
                                ? undefined
                                : next,
                            );
                          }}
                        />
                        <span>{type.label}</span>
                      </label>
                    ))}
                  </div>
                </>
              ) : null}

              {activePanel === "options" ? (
                <>
                  <p>Edit labels, stored values, and colors.</p>
                  <div className="property-editor-option-list">
                    {optionsDraft.map((option, index) => (
                      <div key={index} className="property-editor-option-row">
                        <input
                          value={option.label}
                          onChange={(event) => updateOption(index, { label: event.target.value })}
                          onBlur={() => commitOptions()}
                          placeholder="Label"
                          aria-label={`Option ${index + 1} label`}
                        />
                        <input
                          value={option.value}
                          onChange={(event) => updateOption(index, { value: event.target.value })}
                          onBlur={() => commitOptions()}
                          placeholder="value"
                          aria-label={`Option ${index + 1} value`}
                        />
                        <input
                          type="color"
                          value={option.color ?? "#64748b"}
                          onChange={(event) => updateOption(index, { color: event.target.value })}
                          onBlur={() => commitOptions()}
                          title="Color"
                          aria-label={`Option ${index + 1} color`}
                        />
                        <button
                          type="button"
                          className="danger"
                          title="Delete option"
                          aria-label={`Delete option ${option.label}`}
                          onClick={() => {
                            const next = optionsDraft.filter(
                              (_, optionIndex) => optionIndex !== index,
                            );
                            setOptionsDraft(next);
                            commitOptions(next);
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="property-editor-action"
                    onClick={() => {
                      const next = [
                        ...optionsDraft,
                        {
                          value: `option-${optionsDraft.length + 1}`,
                          label: `Option ${optionsDraft.length + 1}`,
                        },
                      ];
                      setOptionsDraft(next);
                      commitOptions(next);
                    }}
                  >
                    <Plus size={13} />
                    Add option
                  </button>
                </>
              ) : null}

              {activePanel === "conditions" ? (
                <>
                  <p>All conditions must match. Values inside one condition use OR.</p>
                  {Object.entries(conditions).map(([conditionId, selectedValues]) => {
                    const conditionProperty = allProperties.find(
                      (candidate) => candidate.id === conditionId,
                    );
                    return (
                      <div key={conditionId} className="property-editor-condition">
                        <select
                          value={conditionId}
                          aria-label="Condition property"
                          onChange={(event) => {
                            const { [conditionId]: _removed, ...rest } = conditions;
                            const options = optionSets[event.target.value] ?? [];
                            commitConditions({
                              ...rest,
                              [event.target.value]: options[0] ? [options[0].value] : [],
                            });
                          }}
                        >
                          {dependencyParents.map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.label ?? candidate.id}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => {
                            const { [conditionId]: _removed, ...rest } = conditions;
                            commitConditions(rest);
                          }}
                          aria-label={`Remove condition for ${conditionProperty?.label ?? conditionId}`}
                        >
                          <Trash2 size={13} />
                        </button>
                        <div className="property-editor-choice-list compact">
                          {(optionSets[conditionId] ?? []).map((option) => (
                            <label key={option.value}>
                              <input
                                type="checkbox"
                                checked={selectedValues.includes(option.value)}
                                onChange={(event) =>
                                  commitConditions({
                                    ...conditions,
                                    [conditionId]: event.target.checked
                                      ? [...selectedValues, option.value]
                                      : selectedValues.filter((value) => value !== option.value),
                                  })
                                }
                              />
                              <span>{option.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    className="property-editor-action"
                    disabled={dependencyParents.every((candidate) => candidate.id in conditions)}
                    onClick={() => {
                      const candidate = dependencyParents.find((item) => !(item.id in conditions));
                      if (!candidate) return;
                      const options = optionSets[candidate.id] ?? [];
                      commitConditions({
                        ...conditions,
                        [candidate.id]: options[0] ? [options[0].value] : [],
                      });
                    }}
                  >
                    <Plus size={13} />
                    Add condition
                  </button>
                </>
              ) : null}

              {activePanel === "parent" ? (
                <>
                  <p>Moving stored values will open a migration preview.</p>
                  <div className="property-editor-choice-list">
                    <label>
                      <input
                        type="radio"
                        name="property-parent"
                        checked={!parentId}
                        onChange={() => onMoveParent(null)}
                      />
                      <span>Top level</span>
                    </label>
                    {parentCandidates.map((candidate) => (
                      <label key={candidate.id}>
                        <input
                          type="radio"
                          name="property-parent"
                          checked={parentId === candidate.id}
                          onChange={() => onMoveParent(candidate.id)}
                        />
                        <span>{(propertyPaths[candidate.id] ?? [candidate.id]).join(" / ")}</span>
                      </label>
                    ))}
                  </div>
                </>
              ) : null}

              {activePanel === "yaml" ? (
                <div className="property-editor-yaml-preview">
                  <code>{storagePath.join(".")}</code>
                  <pre>{yamlPreview}</pre>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <div className="property-editor-footer">
          <button type="button" onClick={onDuplicate}>
            <Copy size={13} />
            Duplicate
          </button>
          <button type="button" className="danger" disabled={isProtected} onClick={onDelete}>
            <Trash2 size={13} />
            Delete
          </button>
        </div>
      </div>
    </FloatingPortal>
  );
}
