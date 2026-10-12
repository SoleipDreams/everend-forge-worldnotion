import { useEffect, useRef, useState } from "react";
import { ChevronRight, Home } from "lucide-react";
import type { Locale } from "../i18n";
import { hasCustomWindowChrome } from "../utils/windowTitlebar";

type MenuItem = { label: string; id?: string; shortcut?: string; command?: string; separator?: boolean };
type MenuGroup = { label: string; items: MenuItem[] };

function menuGroups(spanish: boolean): MenuGroup[] {
  const item = (en: string, es: string, id: string, shortcut?: string): MenuItem => ({ label: spanish ? es : en, id, shortcut });
  const separator: MenuItem = { label: "", separator: true };
  return [
    { label: spanish ? "Archivo" : "File", items: [
      item("New Note", "Nueva nota", "wn:file:new-note", "Ctrl+N"),
      item("New Timeline", "Nueva cronología", "wn:file:new-timeline"),
      item("New Relation Tree", "Nuevo árbol de relaciones", "wn:file:new-relationships"),
      item("New Folder", "Nueva carpeta", "wn:file:new-folder", "Ctrl+Shift+N"), separator,
      item("Open Universe…", "Abrir universo…", "wn:file:open-universe", "Ctrl+O"),
      item("Open Recent", "Abrir reciente", "wn:file:open-recent"), separator,
      item("Save", "Guardar", "wn:file:save", "Ctrl+S"),
      item("Reveal Universe", "Mostrar universo en el explorador", "wn:file:reveal-universe"), separator,
      item("Close Tab", "Cerrar pestaña", "wn:file:close-tab", "Ctrl+W"),
      item("Quit", "Salir", "wn:window:close"),
    ] },
    { label: spanish ? "Editar" : "Edit", items: [
      item("Undo", "Deshacer", "wn:edit:undo", "Ctrl+Z"),
      item("Redo", "Rehacer", "wn:edit:redo", "Ctrl+Shift+Z"), separator,
      { label: spanish ? "Cortar" : "Cut", command: "cut", shortcut: "Ctrl+X" },
      { label: spanish ? "Copiar" : "Copy", command: "copy", shortcut: "Ctrl+C" },
      { label: spanish ? "Pegar" : "Paste", command: "paste", shortcut: "Ctrl+V" },
      { label: spanish ? "Seleccionar todo" : "Select All", command: "selectAll", shortcut: "Ctrl+A" }, separator,
      item("Find", "Buscar", "wn:edit:find", "Ctrl+F"),
      item("Find and Replace", "Buscar y reemplazar", "wn:edit:replace", "Ctrl+H"),
      item("Find Next", "Buscar siguiente", "wn:edit:find-next", "F3"),
      item("Find Previous", "Buscar anterior", "wn:edit:find-previous", "Shift+F3"), separator,
      item("Bold", "Negrita", "wn:edit:bold", "Ctrl+B"),
      item("Italic", "Cursiva", "wn:edit:italic", "Ctrl+I"),
      item("Insert Link", "Insertar enlace", "wn:edit:link", "Ctrl+K"),
      item("Insert Wikilink", "Insertar wikienlace", "wn:edit:wikilink", "Ctrl+Shift+K"),
    ] },
    { label: spanish ? "Ver" : "View", items: [
      item("Toggle Sidebar", "Alternar explorador", "wn:view:toggle-sidebar", "Ctrl+\\"),
      item("Toggle Inspector", "Alternar inspector", "wn:view:toggle-inspector", "Ctrl+Shift+\\"),
      item("Toggle Light/Dark", "Cambiar modo claro/oscuro", "wn:view:toggle-light-dark", "Ctrl+Shift+L"), separator,
      item("Command Palette", "Paleta de comandos", "wn:view:command-palette", "Ctrl+P"),
      item("Quick Switcher", "Selector rápido", "wn:view:quick-switcher", "Ctrl+Alt+O"),
      item("Toggle Outline", "Alternar esquema", "wn:view:toggle-outline", "Ctrl+Shift+O"),
      item("Reload Window", "Recargar ventana", "wn:view:reload", "Ctrl+R"), separator,
      item("Zoom In", "Acercar", "wn:view:zoom-in", "Ctrl++"),
      item("Zoom Out", "Alejar", "wn:view:zoom-out", "Ctrl+-"),
      item("Reset Zoom", "Restablecer zoom", "wn:view:zoom-reset", "Ctrl+0"),
    ] },
    { label: spanish ? "Ventana" : "Window", items: [
      item("Minimize", "Minimizar", "wn:window:minimize"),
      item("Close Window", "Cerrar ventana", "wn:window:close"), separator,
      item("Everend Forge Theme", "Tema Everend Forge", "wn:window:style:forge-mono"),
      item("GitHub Theme", "Tema GitHub", "wn:window:style:github"),
      item("One Dark Pro Theme", "Tema One Dark Pro", "wn:window:style:one-dark-pro"),
      item("Dracula Theme", "Tema Dracula", "wn:window:style:dracula"),
      item("Night Owl Theme", "Tema Night Owl", "wn:window:style:night-owl"),
      item("Material Palenight Theme", "Tema Material Palenight", "wn:window:style:material-palenight"),
    ] },
    { label: spanish ? "Ayuda" : "Help", items: [
      item("About WorldNotion", "Acerca de WorldNotion", "wn:help:about"),
      item("Open Project Folder", "Abrir carpeta del proyecto", "wn:help:open-project-folder"),
      item("Documentation", "Documentación", "wn:help:docs"),
    ] },
  ];
}

export function DesktopMenuBar({ locale, onHome, onCommand, onEditCommand }: {
  locale: Locale;
  onHome: () => void | Promise<void>;
  onCommand: (id: string) => void | Promise<void>;
  onEditCommand: (command: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string>();
  const menuRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const spanish = locale === "es";
  const desktopMenuAvailable = hasCustomWindowChrome();
  const label = spanish ? "Inicio y menú de la aplicación" : "Home and application menu";
  const close = () => { setOpen(false); setOpenGroup(undefined); };

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) close();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { close(); triggerRef.current?.focus(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", keyboard);
    };
  }, [open]);

  const invoke = async (item: MenuItem) => {
    close();
    if (previousFocus.current?.isConnected) previousFocus.current.focus();
    if (item.id) await onCommand(item.id);
    else if (item.command) await onEditCommand(item.command);
  };

  return (
    <nav className="wn-desktop-menu" aria-label={spanish ? "Menú de la aplicación" : "Application menu"} ref={menuRef} data-tauri-drag-region="false">
      <button ref={triggerRef} type="button" className={`dock-icon-button wn-home-menu-trigger ${open ? "active" : ""}`} title={label} aria-label={label} aria-haspopup={desktopMenuAvailable ? "menu" : undefined} aria-expanded={desktopMenuAvailable ? open : undefined}
        onFocus={(event) => { if (!open && event.relatedTarget instanceof HTMLElement && !menuRef.current?.contains(event.relatedTarget)) previousFocus.current = event.relatedTarget; }}
        onMouseDown={() => { if (!open) previousFocus.current = document.activeElement as HTMLElement | null; }}
        onClick={() => {
          if (!desktopMenuAvailable) { void onHome(); return; }
          setOpen(current => !current); setOpenGroup(undefined);
        }}>
        <Home size={15} aria-hidden="true" />
      </button>
      {desktopMenuAvailable && open ? <div className="wn-home-menu-popover" role="menu" aria-label={spanish ? "Menú de la aplicación" : "Application menu"}>
        <button type="button" role="menuitem" className="wn-home-menu-item" onClick={() => { close(); void onHome(); }}><Home size={14} aria-hidden="true" /><span>{spanish ? "Volver al Home" : "Back to Home"}</span></button>
        <div className="wn-desktop-menu-separator" role="separator" />
        {menuGroups(spanish).map(group => <div className="wn-desktop-menu-group" key={group.label}>
          <button type="button" role="menuitem" className={openGroup === group.label ? "active" : ""} aria-haspopup="menu" aria-expanded={openGroup === group.label} onClick={() => setOpenGroup(current => current === group.label ? undefined : group.label)}><span>{group.label}</span><ChevronRight size={14} aria-hidden="true" /></button>
          {openGroup === group.label ? <div className="wn-desktop-menu-submenu" role="menu" aria-label={group.label}>
            {group.items.map((item, i) => item.separator ? <div key={i} className="wn-desktop-menu-separator" role="separator" /> : <button key={i} type="button" role="menuitem" aria-label={item.label} aria-keyshortcuts={item.shortcut?.replace("Ctrl", "Control")} onClick={() => { void invoke(item); }}><span>{item.label}</span><kbd aria-hidden="true">{item.shortcut}</kbd></button>)}
          </div> : null}
        </div>)}
      </div> : null}
    </nav>
  );
}
