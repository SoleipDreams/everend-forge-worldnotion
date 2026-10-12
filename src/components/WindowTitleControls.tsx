import { useEffect, useState } from "react";
import { Copy, Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Locale } from "../i18n";
import { hasCustomWindowChrome } from "../utils/windowTitlebar";

export function WindowChromeSetup({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled || !hasCustomWindowChrome()) return;
    void getCurrentWindow().setDecorations(false).catch((error) => {
      console.error("Could not disable native window decorations:", error);
    });
  }, [enabled]);
  return null;
}

export function WindowTitleControls({ locale, onClose }: { locale: Locale; onClose: () => void | Promise<void> }) {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    if (!hasCustomWindowChrome()) return;
    const window = getCurrentWindow();
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const refresh = () => {
      void window.isMaximized().then((value) => { if (!disposed) setMaximized(value); }).catch(() => undefined);
    };
    refresh();
    void window.onResized(refresh).then((stop) => {
      unlisten = stop;
      if (disposed) stop();
    }).catch(() => undefined);
    return () => { disposed = true; unlisten?.(); };
  }, []);
  if (!hasCustomWindowChrome()) return null;
  const labels = locale === "es"
    ? { minimize: "Minimizar", maximize: "Maximizar", restore: "Restaurar", close: "Cerrar", group: "Controles de ventana" }
    : { minimize: "Minimize", maximize: "Maximize", restore: "Restore", close: "Close", group: "Window controls" };
  return (
    <div className="wn-window-title-controls" role="group" aria-label={labels.group} data-tauri-drag-region="false">
      <button type="button" className="dock-icon-button" title={labels.minimize} aria-label={labels.minimize} onClick={() => { void getCurrentWindow().minimize(); }}>
        <Minus size={14} aria-hidden="true" />
      </button>
      <button type="button" className="dock-icon-button" title={maximized ? labels.restore : labels.maximize} aria-label={maximized ? labels.restore : labels.maximize} onClick={() => { void getCurrentWindow().toggleMaximize().then(() => getCurrentWindow().isMaximized()).then(setMaximized); }}>
        {maximized ? <Copy size={12} aria-hidden="true" /> : <Square size={12} aria-hidden="true" />}
      </button>
      <button type="button" className="dock-icon-button wn-window-close" title={labels.close} aria-label={labels.close} onClick={() => { void onClose(); }}>
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
