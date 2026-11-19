import { useEffect, type ReactNode } from "react";
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  size,
  useFloating,
} from "@floating-ui/react";
import { X } from "lucide-react";
import { focusAppElement, useAppIsActive } from "../../hooks/useAppInteraction";
import { useWorldnotionUi } from "../../i18n";

export type PropertyValuePopoverProps = {
  id: string;
  anchorEl: HTMLElement | null;
  label: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
};

/** A bounded editing surface for property values that need more room. */
export function PropertyValuePopover({
  id,
  anchorEl,
  label,
  description,
  onClose,
  children,
}: PropertyValuePopoverProps) {
  const ui = useWorldnotionUi();
  const appActive = useAppIsActive();
  const open = Boolean(anchorEl);
  const { refs, floatingStyles } = useFloating({
    open,
    placement: "bottom-start",
    strategy: "fixed",
    middleware: [
      offset(6),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply({ availableWidth, availableHeight, elements }) {
          elements.floating.style.maxWidth = `${availableWidth}px`;
          elements.floating.style.maxHeight = `${Math.max(80, Math.min(availableHeight, 460))}px`;
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  useEffect(() => {
    refs.setReference(anchorEl);
  }, [anchorEl, refs]);

  useEffect(() => {
    if (!open || !anchorEl || !appActive) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (refs.floating.current?.contains(target)) return;
      if (target instanceof Element && target.closest(".picker-popover")) return;
      if (anchorEl.contains(target)) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      focusAppElement(anchorEl);
      onClose();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchorEl, appActive, onClose, open, refs.floating]);

  if (!open || !anchorEl) return null;

  const closeAndRestoreFocus = () => {
    focusAppElement(anchorEl);
    onClose();
  };

  return (
    <FloatingPortal root={anchorEl.closest<HTMLElement>(".forge-worldnotion") ?? undefined}>
      <div
        id={id}
        ref={refs.setFloating}
        style={floatingStyles}
        className="property-value-popover"
        role="dialog"
        aria-label={`${ui.editValues}: ${label}`}
      >
        <header className="property-value-popover-header">
          <div>
            <strong>{label}</strong>
            {description ? <p>{description}</p> : null}
          </div>
          <button
            type="button"
            className="property-value-popover-close"
            onClick={closeAndRestoreFocus}
            aria-label={ui.close}
            title={ui.close}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </header>
        <div className="property-value-popover-body">{children}</div>
      </div>
    </FloatingPortal>
  );
}
