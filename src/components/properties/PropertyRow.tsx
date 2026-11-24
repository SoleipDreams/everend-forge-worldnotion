import { useCallback, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { CollisionPriority } from "@dnd-kit/abstract";
import { OptimisticSortingPlugin } from "@dnd-kit/dom/sortable";
import { ChevronDown, ChevronRight, Plus, RotateCcw, Wand2 } from "lucide-react";
import type { BasePropertyDefinition, CustomFieldDefinition } from "../../editorTypes";
import { useWorldnotionUi } from "../../i18n";
import type { InspectorPropertyTreeNode } from "../../utils/propertiesConfig";
import { PropertyFieldRenderer } from "../PropertyFieldRenderer";
import type { PropertyFieldRendererProps } from "../PropertyFieldRenderer";
import { entityRefDisplayLabel } from "./fields/EntityRefUtils";
import { PropertyValuePopover } from "./PropertyValuePopover";
import { propertyTypeIcon } from "./propertyTypeIcons";

type PropertyLike = BasePropertyDefinition | CustomFieldDefinition;

export type PropertyRowHandlers = {
  getValue: (property: PropertyLike) => unknown;
  getOptions: (property: PropertyLike) => PropertyFieldRendererProps["availableOptions"];
  onChange: (propertyId: string, value: unknown) => void;
  onContextMenu: (event: React.MouseEvent, property: PropertyLike) => void;
  onToggleGroup: (propertyId: string) => void;
  onOpenPropertyEditor: (propertyId: string, anchorEl: HTMLElement) => void;
  isVariantMode?: boolean;
  canOverride?: (propertyId: string) => boolean;
  isOverridden?: (propertyId: string) => boolean;
  onCreateOverride?: (propertyId: string) => void;
  onRestoreOverride?: (propertyId: string) => void;
  vaultIndexProps?: Pick<
    PropertyFieldRendererProps,
    "vaultIndex" | "onOpenEntity" | "onRequestImage"
  >;
};

export type InspectorPropertyDragData = {
  kind: "property";
  propertyId: string;
  propertyLabel: string;
  isGroup: boolean;
  parentId: string | null;
  sectionId: string;
};

export type InspectorPropertyGroupDropData = {
  kind: "group";
  propertyId: string;
  propertyLabel: string;
  parentId: string;
  sectionId: string;
};

export type InspectorPropertyDropPreview =
  | { kind: "property"; propertyId: string; position: "before" | "after" }
  | { kind: "group"; propertyId: string };

export type PropertyRowProps = {
  node: InspectorPropertyTreeNode;
  entityType: string;
  sectionId: string;
  sortableIndex: number;
  collapsedGroups: Set<string>;
  dropPreview?: InspectorPropertyDropPreview | null;
  handlers: PropertyRowHandlers;
};

const POPOVER_VALUE_TYPES = new Set(["entity-ref-list", "multiselect", "image"]);

function propertyValuePreview(
  property: PropertyLike,
  value: unknown,
  options: PropertyFieldRendererProps["availableOptions"],
  vaultIndex: PropertyFieldRendererProps["vaultIndex"],
): string[] {
  if (property.type === "entity-ref-list") {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => String(item))
      .filter(Boolean)
      .map((item) => (vaultIndex ? entityRefDisplayLabel(vaultIndex, item) : item));
  }

  if (property.type === "multiselect") {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => String(item))
      .filter(Boolean)
      .map((item) => options?.find((option) => option.value === item)?.label ?? item);
  }

  if (property.type === "image" && typeof value === "string" && value) {
    return [value.split(/[\\/]/).at(-1) || value];
  }

  return [];
}

/**
 * Compact Obsidian-style property row: [type icon + name | inline value].
 * Groups render a collapsible header; children are indented by depth.
 */
export function PropertyRow({
  node,
  entityType,
  sectionId,
  sortableIndex,
  collapsedGroups,
  dropPreview = null,
  handlers,
}: PropertyRowProps) {
  const ui = useWorldnotionUi();
  const property = node.property as PropertyLike;
  const [isValueEditorOpen, setIsValueEditorOpen] = useState(false);
  const valueEditorTrigger = useRef<HTMLButtonElement>(null);
  const hasChildren = Boolean(node.children.length);
  const isGroup = property.type === "group";
  const isCollapsed = collapsedGroups.has(property.id);
  const isPinnedProperty = property.id === "type";
  const propertyLabel = property.label || property.id;
  const sortableGroupId = node.parentId ? `parent:${node.parentId}` : `section:${sectionId}`;
  const {
    ref: sortableRef,
    handleRef,
    isDragging,
  } = useSortable<InspectorPropertyDragData>({
    id: `property:${property.id}`,
    index: sortableIndex,
    group: sortableGroupId,
    plugins: (defaults) => defaults.filter((plugin) => plugin !== OptimisticSortingPlugin),
    data: {
      kind: "property",
      propertyId: property.id,
      propertyLabel,
      isGroup,
      parentId: node.parentId ?? null,
      sectionId,
    },
    disabled: !node.conditionActive || isPinnedProperty,
  });
  const { ref: groupDropRef } = useDroppable<InspectorPropertyGroupDropData>({
    id: `group-drop:${property.id}`,
    data: {
      kind: "group",
      propertyId: property.id,
      propertyLabel,
      parentId: property.id,
      sectionId,
    },
    collisionPriority: CollisionPriority.High,
    disabled: !isGroup || !node.conditionActive,
  });
  const groupLabelRef = useCallback(
    (element: HTMLButtonElement | null) => {
      handleRef(element);
      groupDropRef(element);
    },
    [groupDropRef, handleRef],
  );
  const canOverride = handlers.isVariantMode && handlers.canOverride?.(property.id);
  const overridden = handlers.isOverridden?.(property.id);
  const isReadOnly = Boolean(
    ("readOnly" in property && property.readOnly) || (handlers.isVariantMode && !canOverride),
  );
  const value = handlers.getValue(property);
  const options = handlers.getOptions(property);
  const usesValuePopover = POPOVER_VALUE_TYPES.has(property.type);
  const previewValues = usesValuePopover
    ? propertyValuePreview(property, value, options, handlers.vaultIndexProps?.vaultIndex)
    : [];
  const valueEditorLabel = `${ui.editValues}: ${propertyLabel}`;
  const propertyActionHint = isPinnedProperty
    ? `Edit ${propertyLabel}`
    : `${ui.reorderPropertyHint} · Edit ${propertyLabel}`;
  const TypeIcon = propertyTypeIcon(property.type);
  const isPropertyDropTarget =
    dropPreview?.kind === "property" && dropPreview.propertyId === property.id;
  const propertyDropPosition = isPropertyDropTarget ? dropPreview.position : null;
  const isInsideGroupDropTarget =
    dropPreview?.kind === "group" && dropPreview.propertyId === property.id;

  if (!node.conditionActive) {
    return (
      <div
        ref={sortableRef}
        className={`property-row-wrapper property-row-locked-wrapper ${!node.visibleInType ? "property-row-hidden-in-type" : ""}`}
        data-onboarding-target={property.id === "type" ? "worldnotion.entity-type" : undefined}
        onContextMenu={(event) => handlers.onContextMenu(event, property)}
      >
        <div className={`property-row property-row-locked property-row-depth-${node.depth}`}>
          <button
            type="button"
            className="property-row-key property-row-label"
            title={`Edit ${propertyLabel}`}
            aria-label={`Edit ${propertyLabel}`}
            aria-haspopup="dialog"
            onClick={(event) => handlers.onOpenPropertyEditor(property.id, event.currentTarget)}
          >
            {/* eslint-disable-next-line react-hooks/static-components */}
            <TypeIcon size={13} className="property-row-type-icon" aria-hidden="true" />
            <span className="property-row-name">{propertyLabel}</span>
          </button>
          <span className="property-row-locked-hint" title={node.conditionLabel}>
            Conditional
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={sortableRef}
      className={`property-row-wrapper ${isDragging ? "dragging" : ""} ${propertyDropPosition ? `drop-target-${propertyDropPosition}` : ""} ${isInsideGroupDropTarget ? "drop-inside-target" : ""} ${!node.visibleInType ? "property-row-hidden-in-type" : ""}`}
    >
      <div
        className={`property-row property-row-depth-${node.depth} ${isGroup ? "property-row-group" : ""} ${isPinnedProperty ? "property-row-primary" : ""} ${handlers.isVariantMode && !isGroup ? "property-row-variant-mode" : ""}`}
        data-property-id={property.id}
        data-onboarding-target={property.id === "type" ? "worldnotion.entity-type" : undefined}
        onContextMenu={(event) => handlers.onContextMenu(event, property)}
      >
        {isGroup ? (
          <div className="property-row-group-controls">
            <button
              type="button"
              className="property-row-group-collapse"
              onClick={() => handlers.onToggleGroup(property.id)}
              aria-expanded={!isCollapsed}
              aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${propertyLabel}`}
              title={`${isCollapsed ? "Expand" : "Collapse"} ${propertyLabel}`}
            >
              {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
            </button>
            <button
              type="button"
              ref={groupLabelRef}
              className={`property-row-key property-row-label ${isInsideGroupDropTarget ? "property-row-group-drop-target" : ""}`}
              title={propertyActionHint}
              aria-label={`Edit ${propertyLabel}`}
              aria-haspopup="dialog"
              aria-keyshortcuts={
                isPinnedProperty ? undefined : "Space ArrowUp ArrowDown ArrowLeft ArrowRight Escape"
              }
              onClick={(event) => handlers.onOpenPropertyEditor(property.id, event.currentTarget)}
            >
              {/* eslint-disable-next-line react-hooks/static-components */}
              <TypeIcon size={13} className="property-row-type-icon" aria-hidden="true" />
              <span className="property-row-name">{propertyLabel}</span>
            </button>
            <small className="property-row-count">{node.children.length}</small>
          </div>
        ) : (
          <>
            <button
              type="button"
              ref={isPinnedProperty ? undefined : handleRef}
              className="property-row-key property-row-label"
              title={propertyActionHint}
              aria-label={`Edit ${propertyLabel}`}
              aria-haspopup="dialog"
              aria-keyshortcuts={
                isPinnedProperty ? undefined : "Space ArrowUp ArrowDown ArrowLeft ArrowRight Escape"
              }
              onClick={(event) => handlers.onOpenPropertyEditor(property.id, event.currentTarget)}
            >
              {/* eslint-disable-next-line react-hooks/static-components */}
              <TypeIcon size={13} className="property-row-type-icon" aria-hidden="true" />
              <span className="property-row-name">
                {propertyLabel}
                {property.required ? <span className="required-star">*</span> : null}
              </span>
            </button>
            <div
              className={`property-row-value ${property.type === "number" ? "property-row-value-number" : ""}`}
            >
              {usesValuePopover ? (
                <button
                  ref={valueEditorTrigger}
                  type="button"
                  className={`property-row-value-summary ${isValueEditorOpen ? "open" : ""}`}
                  title={valueEditorLabel}
                  aria-label={valueEditorLabel}
                  aria-haspopup="dialog"
                  aria-expanded={isValueEditorOpen}
                  aria-controls={
                    isValueEditorOpen ? `property-value-editor-${property.id}` : undefined
                  }
                  onClick={() => setIsValueEditorOpen((current) => !current)}
                >
                  {previewValues.length > 0 ? (
                    <>
                      <span className="property-row-value-summary-item">{previewValues[0]}</span>
                      {previewValues.length > 1 ? (
                        <small className="property-row-value-summary-count">
                          +{previewValues.length - 1}
                        </small>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {!isReadOnly ? <Plus size={12} aria-hidden="true" /> : null}
                      <span>{isReadOnly ? "—" : ui.add}</span>
                    </>
                  )}
                  <ChevronDown size={12} aria-hidden="true" />
                </button>
              ) : (
                <PropertyFieldRenderer
                  property={property}
                  value={value}
                  onChange={(newValue) => handlers.onChange(property.id, newValue)}
                  readOnly={isReadOnly}
                  entityType={entityType}
                  availableOptions={options}
                  {...handlers.vaultIndexProps}
                />
              )}
            </div>
            {handlers.isVariantMode ? (
              canOverride && overridden ? (
                <button
                  type="button"
                  className="property-row-variant"
                  title="Restore inherited value"
                  onClick={() => handlers.onRestoreOverride?.(property.id)}
                >
                  <RotateCcw size={12} />
                </button>
              ) : (
                <button
                  type="button"
                  className="property-row-variant"
                  title="Override in variant"
                  disabled={!canOverride}
                  onClick={() => handlers.onCreateOverride?.(property.id)}
                >
                  <Wand2 size={12} />
                </button>
              )
            ) : null}
          </>
        )}
      </div>
      {usesValuePopover ? (
        <PropertyValuePopover
          id={`property-value-editor-${property.id}`}
          anchorEl={isValueEditorOpen ? valueEditorTrigger.current : null}
          label={propertyLabel}
          description={property.description}
          onClose={() => setIsValueEditorOpen(false)}
        >
          <PropertyFieldRenderer
            property={property}
            value={value}
            onChange={(newValue) => handlers.onChange(property.id, newValue)}
            readOnly={isReadOnly}
            entityType={entityType}
            availableOptions={options}
            {...handlers.vaultIndexProps}
          />
        </PropertyValuePopover>
      ) : null}
      {hasChildren && !isCollapsed ? (
        <div className="property-row-children">
          {node.children.map((child, index) => (
            <PropertyRow
              key={child.property.id}
              node={child}
              entityType={entityType}
              sectionId={sectionId}
              sortableIndex={index}
              collapsedGroups={collapsedGroups}
              dropPreview={dropPreview}
              handlers={handlers}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
