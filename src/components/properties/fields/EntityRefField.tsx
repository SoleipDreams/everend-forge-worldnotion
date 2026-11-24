import { useMemo, useRef, useState, useEffect } from "react";
import { ChevronDown, ExternalLink, Link2, X } from "lucide-react";
import { autoUpdate, flip, offset, shift, useFloating } from "@floating-ui/react";
import type { VaultIndex } from "../../../domain";
import type { BasePropertyDefinition, CustomFieldDefinition } from "../../../editorTypes";
import { PickerPopover } from "../PickerPopover";
import {
  entityPickerItems,
  entityRefDisplayLabel,
  findEntityById,
  parseEntityRef,
  buildEntityRef,
} from "./EntityRefUtils";

// Re-export for backward compatibility
export {
  entityPickerItems,
  entityRefDisplayLabel,
  findEntityById,
  parseEntityRef,
  buildEntityRef,
} from "./EntityRefUtils";

type PropertyLike = BasePropertyDefinition | CustomFieldDefinition;

export type EntityRefFieldProps = {
  property: PropertyLike;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly?: boolean;
  vaultIndex: VaultIndex;
  onOpenEntity?: (path: string) => void;
};

/**
 * Single entity reference: shows the resolved entity as a chip and picks a
 * replacement from a fuzzy popover filtered by the property's targetTypes.
 * Supports optional variant selection in format "entity-id@variant-id".
 */
export function EntityRefField({
  property,
  value,
  onChange,
  readOnly,
  vaultIndex,
  onOpenEntity,
}: EntityRefFieldProps) {
  const [open, setOpen] = useState(false);
  const [variantOpen, setVariantOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const variantAnchorRef = useRef<HTMLButtonElement>(null);
  const variantMenuRef = useRef<HTMLDivElement>(null);

  const stringValue = typeof value === "string" ? value : "";
  const { entityId, variantId } = parseEntityRef(stringValue);

  const resolved = useMemo(
    () => (entityId ? findEntityById(vaultIndex, entityId) : undefined),
    [entityId, vaultIndex],
  );

  const items = useMemo(
    () => entityPickerItems(vaultIndex, property.targetTypes),
    [property.targetTypes, vaultIndex],
  );

  const { refs: variantRefs, floatingStyles: variantFloatingStyles } = useFloating({
    open: variantOpen,
    placement: "bottom-start",
    middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  useEffect(() => {
    variantRefs.setReference(variantAnchorRef.current);
    variantRefs.setFloating(variantMenuRef.current);
  }, [variantRefs, variantOpen]);

  const displayLabel = resolved
    ? entityRefDisplayLabel(vaultIndex, stringValue)
    : stringValue || "";

  return (
    <div className="entity-ref-field">
      <button
        ref={anchorRef}
        type="button"
        className={`entity-ref-chip ${entityId && !resolved ? "entity-ref-unresolved" : ""} ${entityId ? "" : "entity-ref-empty"}`}
        onClick={() => !readOnly && setOpen((current) => !current)}
        disabled={readOnly}
        title={
          resolved
            ? `${resolved.name} (${resolved.path})`
            : entityId
              ? `Unresolved id: ${entityId}`
              : `Link a ${property.targetTypes?.join("/") || "entity"}`
        }
      >
        <Link2 size={12} aria-hidden="true" />
        <span className="entity-ref-chip-label">
          {displayLabel}
          {!entityId ? `Link ${property.targetTypes?.join("/") || "entity"}…` : null}
        </span>
      </button>
      {resolved && resolved.variants && resolved.variants.length > 0 ? (
        <button
          ref={variantAnchorRef}
          type="button"
          className="entity-ref-variant-selector"
          onClick={() => !readOnly && setVariantOpen((current) => !current)}
          disabled={readOnly}
          title="Select variant"
        >
          <ChevronDown size={12} aria-hidden="true" />
        </button>
      ) : null}
      {resolved && onOpenEntity ? (
        <button
          type="button"
          className="entity-ref-action"
          onClick={() => onOpenEntity(resolved.path)}
          title={`Open ${resolved.name}`}
        >
          <ExternalLink size={12} />
        </button>
      ) : null}
      {entityId && !readOnly ? (
        <button
          type="button"
          className="entity-ref-action"
          onClick={() => onChange("")}
          title="Clear reference"
        >
          <X size={12} />
        </button>
      ) : null}
      <PickerPopover
        open={open}
        anchorRef={anchorRef}
        items={items}
        placeholder={`Search ${property.targetTypes?.join(", ") || "entities"}…`}
        emptyLabel="No matching entities"
        onSelect={(item) => onChange(buildEntityRef(item.id))}
        onClose={() => setOpen(false)}
      />
      {resolved && resolved.variants && resolved.variants.length > 0 ? (
        <div
          ref={variantMenuRef}
          className={`entity-ref-variant-menu ${variantOpen ? "open" : ""}`}
          style={variantFloatingStyles}
        >
          {resolved.variants.map((variant) => (
            <button
              key={variant.id}
              type="button"
              className={`entity-ref-variant-option ${variantId === variant.id ? "selected" : ""}`}
              onClick={() => {
                onChange(buildEntityRef(entityId, variant.id));
                setVariantOpen(false);
              }}
            >
              {variant.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
