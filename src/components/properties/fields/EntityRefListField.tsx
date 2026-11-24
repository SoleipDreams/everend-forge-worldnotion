import { useMemo, useRef, useState, useEffect } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
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

type PropertyLike = BasePropertyDefinition | CustomFieldDefinition;

type EntityRefItemProps = {
  refValue: string;
  vaultIndex: VaultIndex;
  readOnly?: boolean;
  onOpenEntity?: (path: string) => void;
  onRemove: () => void;
  onChangeRef: (newRef: string) => void;
};

function EntityRefItem({
  refValue,
  vaultIndex,
  readOnly,
  onOpenEntity,
  onRemove,
  onChangeRef,
}: EntityRefItemProps) {
  const [variantOpen, setVariantOpen] = useState(false);
  const variantAnchorRef = useRef<HTMLButtonElement>(null);
  const variantMenuRef = useRef<HTMLDivElement>(null);

  const { entityId, variantId } = parseEntityRef(refValue);
  const resolved = findEntityById(vaultIndex, entityId);
  const displayLabel = resolved ? entityRefDisplayLabel(vaultIndex, refValue) : refValue;

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

  return (
    <span
      className={`entity-ref-chip ${resolved ? "" : "entity-ref-unresolved"}`}
      title={resolved ? resolved.path : `Unresolved id: ${refValue}`}
    >
      <button
        type="button"
        className="entity-ref-chip-label"
        onClick={() => resolved && onOpenEntity?.(resolved.path)}
        disabled={!resolved || !onOpenEntity}
      >
        {displayLabel}
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
          <ChevronDown size={11} aria-hidden="true" />
        </button>
      ) : null}
      {!readOnly ? (
        <button type="button" className="entity-ref-chip-remove" onClick={onRemove} title="Remove">
          <X size={11} />
        </button>
      ) : null}
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
                const newRef = buildEntityRef(entityId, variant.id);
                onChangeRef(newRef);
                setVariantOpen(false);
              }}
            >
              {variant.label}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}

export type EntityRefListFieldProps = {
  property: PropertyLike;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly?: boolean;
  vaultIndex: VaultIndex;
  onOpenEntity?: (path: string) => void;
};

/**
 * List of entity references as removable chips plus a "+" picker that
 * excludes already-selected entity ids. Supports optional variant selection
 * in format "entity-id@variant-id".
 */
export function EntityRefListField({
  property,
  value,
  onChange,
  readOnly,
  vaultIndex,
  onOpenEntity,
}: EntityRefListFieldProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const refs = useMemo(
    () => (Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : []),
    [value],
  );

  const entityIds = useMemo(
    () => refs.map((ref) => parseEntityRef(ref).entityId).filter(Boolean),
    [refs],
  );

  const items = useMemo(
    () => entityPickerItems(vaultIndex, property.targetTypes, new Set(entityIds)),
    [entityIds, property.targetTypes, vaultIndex],
  );

  const removeRef = (ref: string) => {
    onChange(refs.filter((candidate) => candidate !== ref));
  };

  const updateRef = (oldRef: string, newRef: string) => {
    onChange(refs.map((r) => (r === oldRef ? newRef : r)));
  };

  return (
    <div className="entity-ref-list-field">
      {refs.map((ref) => (
        <EntityRefItem
          key={ref}
          refValue={ref}
          vaultIndex={vaultIndex}
          readOnly={readOnly}
          onOpenEntity={onOpenEntity}
          onRemove={() => removeRef(ref)}
          onChangeRef={(newRef) => updateRef(ref, newRef)}
        />
      ))}
      {!readOnly ? (
        <button
          ref={anchorRef}
          type="button"
          className="entity-ref-add"
          onClick={() => setOpen((current) => !current)}
          title={`Add ${property.targetTypes?.join("/") || "entity"}`}
        >
          <Plus size={12} />
        </button>
      ) : null}
      <PickerPopover
        open={open}
        anchorRef={anchorRef}
        items={items}
        placeholder={`Search ${property.targetTypes?.join(", ") || "entities"}…`}
        emptyLabel="No matching entities"
        onSelect={(item) => onChange([...refs, buildEntityRef(item.id)])}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
