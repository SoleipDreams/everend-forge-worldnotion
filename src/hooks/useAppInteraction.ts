import { createContext, useContext } from "react";

export const AppInteractionContext = createContext(true);
export const useAppIsActive = () => useContext(AppInteractionContext);

/** Deferred focus must not escape into an inactive Suite tool or hidden form. */
export function focusAppElement(element: HTMLElement | null | undefined) {
  if (!element?.isConnected || element.closest('[data-app-active="false"], [hidden], [inert]'))
    return;
  element.focus();
}
