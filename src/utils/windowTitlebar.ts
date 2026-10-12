import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauriRuntime } from "./appEnvironment";

export function hasCustomWindowChrome() {
  return isTauriRuntime() && !/Mac|iPhone|iPad/.test(navigator.platform);
}

export function handleWindowTitlebarMouseDown(event: Pick<MouseEvent, "button" | "detail" | "target">) {
  if (!hasCustomWindowChrome() || event.button !== 0) return;
  if (event.target instanceof Element && event.target.closest(
    "button, a, input, select, textarea, label, summary, details, [role='button'], [role='link'], [role='menu'], [role^='menuitem'], [contenteditable='true'], [data-tauri-drag-region='false']",
  )) return;

  const window = getCurrentWindow();
  void (event.detail === 2 ? window.toggleMaximize() : window.startDragging()).catch(() => undefined);
}
