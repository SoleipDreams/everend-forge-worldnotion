import { useEffect, useLayoutEffect, useRef } from "react";
import type { SuiteChrome } from "../suiteChrome";
import { useAppIsActive } from "./useAppInteraction";

/** Global shortcuts belong to the visible tool; standalone is always active. */
export function useAppKeyboard(
  suiteChrome: Pick<SuiteChrome, "active"> | undefined,
  onKeyDown: (event: KeyboardEvent) => void,
) {
  const appActive = useAppIsActive();
  const active = appActive && (!suiteChrome || suiteChrome.active);
  const latest = useRef({ active, onKeyDown });
  useLayoutEffect(() => {
    latest.current = { active, onKeyDown };
  }, [active, onKeyDown]);

  useEffect(() => {
    if (!active) return;
    const listener = (event: KeyboardEvent) => {
      if (latest.current.active) latest.current.onKeyDown(event);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [active]);
}
