import { useCallback, useEffect, useState } from "react";
import { useAppIsActive } from "./useAppInteraction";

/**
 * Estado de un menú contextual anclado que se cierra automáticamente con
 * mousedown en cualquier parte del documento o con Escape mientras está
 * abierto. `setMenu` conserva la misma firma que el setState original para
 * que los puntos de apertura no cambien.
 */
export function useDismissableMenu<T>() {
  const appActive = useAppIsActive();
  const [menu, setMenu] = useState<T | null>(null);

  const close = useCallback(() => setMenu(null), []);

  useEffect(() => {
    if (!menu || !appActive) return;

    function closeMenu() {
      setMenu(null);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }

    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menu, appActive]);

  return { menu, setMenu, close };
}
