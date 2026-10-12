import { useLayoutEffect, type RefObject } from "react";
import { useAppIsActive, focusAppElement } from "./useAppInteraction";

/** Keep keyboard focus in the active dialog and restore its owning trigger. */
export function useModalFocus(ref: RefObject<HTMLElement | null>, open: boolean) {
  const active = useAppIsActive();
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!open || !active || !dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    focusAppElement(dialog);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const controls = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]',
        ),
      ).filter(
        (element) =>
          !element.closest("[hidden], [inert]") &&
          !element.closest("details:not([open]) > :not(summary)") &&
          element.getClientRects().length > 0,
      );
      const first = controls[0];
      const last = controls.at(-1);
      if (!first) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === dialog ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("keydown", onKeyDown);
    return () => {
      dialog.removeEventListener("keydown", onKeyDown);
      if (dialog.contains(document.activeElement) || document.activeElement === document.body)
        focusAppElement(trigger);
    };
  }, [open, active, ref]);
}
