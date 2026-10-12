import { getPluginDefinitions } from "./utils/pluginRegistry";
import type { SettingsPage } from "./settingsIntegration";
import { worldnotionSettingsCopy, worldnotionSurfaceText } from "./i18n";
import { EDITOR_COMMANDS } from "./editorTypes";
const catalog: Array<[string,string,string,string,string,boolean,Array<[string,string,string,string[]?]>]> = [
  [
    "general",
    "General",
    "General",
    "Language and appearance",
    "Idioma y apariencia",
    false,
    [
      [
        "locale",
        "Interface language",
        "Idioma de la interfaz"
      ],
      [
        "theme",
        "Theme",
        "Tema",
        [
          "Active style",
          "Estilo activo",
          "Style",
          "Estilo"
        ]
      ],
      [
        "mode",
        "Theme mode",
        "Modo del tema"
      ],
      [
        "ambient",
        "Soft background",
        "Fondo difuminado"
      ],
      [
        "scene",
        "Background scene",
        "Escena de fondo",
        ["Escena","Scene","Background image","Imagen de fondo"]
      ]
    ]
  ],
  [
    "overview",
    "Universe",
    "Universo",
    "Identity and languages",
    "Identidad e idiomas",
    true,
    [
      [
        "name",
        "Universe name",
        "Nombre del universo"
      ],
      [
        "primary-language",
        "Primary language",
        "Idioma principal"
      ],
      [
        "languages",
        "Additional languages",
        "Idiomas adicionales"
      ],
      [
        "invented-language",
        "Invented language",
        "Idioma inventado"
      ],
      [
        "icon",
        "Universe icon",
        "Icono del universo",
        [
          "Use book icon",
          "Usar icono libro"
        ]
      ]
    ]
  ],
  [
    "properties",
    "Universe",
    "Universo",
    "Properties",
    "Propiedades",
    true,
    [
      [
        "properties",
        "Properties",
        "Propiedades"
      ],
      [
        "types",
        "Types",
        "Tipos",
        [
          "Entity types",
          "Tipos de entidad"
        ]
      ],
      [
        "template",
        "Apply template",
        "Aplicar plantilla"
      ]
    ]
  ],
  [
    "utils",
    "Universe",
    "Universo",
    "Maintenance",
    "Mantenimiento",
    true,
    [
      [
        "structure",
        "Upgrade property structure",
        "Actualizar estructura de propiedades"
      ],
      [
        "frontmatter",
        "Add missing frontmatter",
        "Añadir metadatos faltantes"
      ],
      [
        "normalize",
        "Normalize properties",
        "Normalizar propiedades"
      ]
    ]
  ],
  [
    "document",
    "WorldNotion",
    "WorldNotion",
    "Document appearance",
    "Apariencia del documento",
    false,
    [
      [
        "pageStyle",
        "Page style",
        "Estilo de página"
      ],
      [
        "customPageColor",
        "Custom page color",
        "Color de página personalizado"
      ],
      [
        "paperShadow",
        "Paper shadow (Write mode)",
        "Sombra de papel (modo Escritura)"
      ],
      [
        "writeFont",
        "Write font",
        "Fuente de escritura"
      ],
      [
        "sourceFont",
        "Source font",
        "Fuente de código"
      ],
      [
        "fontSize",
        "Font size",
        "Tamaño de fuente"
      ]
    ]
  ],
  [
    "editor",
    "WorldNotion",
    "WorldNotion",
    "Editor",
    "Editor",
    false,
    [
      [
        "lineWrap",
        "lineWrap",
        "lineWrap"
      ],
      [
        "tabSize",
        "tabSize",
        "tabSize"
      ],
      [
        "lineNumbers",
        "lineNumbers",
        "lineNumbers"
      ],
      [
        "activeLine",
        "activeLine",
        "activeLine"
      ],
      [
        "defaultMode",
        "defaultMode",
        "defaultMode"
      ],
      [
        "breadcrumbs",
        "breadcrumbs",
        "breadcrumbs"
      ],
      [
        "codeFolding",
        "codeFolding",
        "codeFolding"
      ],
      [
        "floatingToolbar",
        "floatingToolbar",
        "floatingToolbar"
      ],
      [
        "outlineGuide",
        "outlineGuide",
        "outlineGuide"
      ],
      [
        "outlinePosition",
        "outlinePosition",
        "outlinePosition"
      ],
      [
        "documentHeader",
        "documentHeader",
        "documentHeader"
      ],
      [
        "showProjectName",
        "showProjectName",
        "showProjectName"
      ],
      [
        "commandPalette",
        "commandPalette",
        "commandPalette"
      ],
      [
        "quickSwitcher",
        "quickSwitcher",
        "quickSwitcher"
      ],
      [
        "findReplace",
        "findReplace",
        "findReplace"
      ]
    ]
  ],
  [
    "workspace",
    "WorldNotion",
    "WorldNotion",
    "Workspace",
    "Espacio de trabajo",
    false,
    [
      [
        "tab-size",
        "Dock tab size",
        "Tamaño de pestañas"
      ],
      [
        "tab-scale",
        "Dock tab scale",
        "Escala de pestañas"
      ],
      [
        "persist",
        "Persist tabs",
        "Conservar pestañas"
      ],
      [
        "reuse",
        "Reuse open tabs",
        "Reutilizar pestañas abiertas"
      ],
      [
        "confirm-close",
        "Confirm closing unsaved tabs",
        "Confirmar cierre de pestañas sin guardar"
      ],
      [
        "confirmMoves",
        "confirmMoves",
        "confirmMoves"
      ],
      [
        "showHidden",
        "showHidden",
        "showHidden"
      ],
      [
        "folderNotes",
        "folderNotes",
        "folderNotes"
      ],
      [
        "showImages",
        "showImages",
        "showImages"
      ]
    ]
  ],
  [
    "shortcuts",
    "WorldNotion",
    "WorldNotion",
    "Keyboard shortcuts",
    "Atajos de teclado",
    false,
    [
      [
        "reset-shortcuts",
        "Reset defaults",
        "Restablecer valores predeterminados"
      ]
    ]
  ],
  [
    "plugins",
    "WorldNotion",
    "WorldNotion",
    "Plugins",
    "Plugins",
    false,
    [
      [
        "plugins",
        "Plugins",
        "Plugins"
      ],
      [
        "plugin-search",
        "Search plugins",
        "Buscar plugins"
      ]
    ]
  ],
  [
    "ai-advisor",
    "WorldNotion",
    "WorldNotion",
    "AI advisor",
    "Asesor IA",
    false,
    [
      [
        "providers",
        "AI Advisor providers",
        "Proveedores del asesor IA"
      ],
      [
        "new-provider",
        "New provider name",
        "Nombre del nuevo proveedor"
      ],
      [
        "provider-url",
        "New provider URL",
        "URL del nuevo proveedor"
      ]
    ]
  ],
  [
    "help",
    "Help",
    "Ayuda",
    "Help and tutorials",
    "Ayuda y tutoriales",
    false,
    [
      [
        "help",
        "Help & Documentation",
        "Ayuda y documentación"
      ]
    ]
  ]
];
export const worldnotionSettingsPages: SettingsPage[] = catalog.map(([id,groupEn,groupEs,titleEn,titleEs,requiresUniverse,controls]) => ({
  id: "worldnotion." + id, owner: "worldnotion", group: {en:groupEn,es:groupEs}, title: {en:titleEn,es:titleEs}, requiresUniverse,
  controls: controls.map(([control,en,es,match]) => ({ id: "worldnotion." + id + "." + control, label: {en,es}, match })),
}));
for (const page of worldnotionSettingsPages) for (const control of page.controls) {
  const key = control.label.en as keyof ReturnType<typeof worldnotionSettingsCopy>;
  if (key in worldnotionSettingsCopy("en")) control.label = { en: worldnotionSettingsCopy("en")[key], es: worldnotionSettingsCopy("es")[key] };
}
worldnotionSettingsPages.find(page => page.id === "worldnotion.shortcuts")!.controls.push(...EDITOR_COMMANDS.map(command => ({id:"worldnotion.shortcuts."+command.id,label:{en:command.label,es:worldnotionSurfaceText("es",command.label)}})));
export function worldnotionSettingsPage(section?: string) {
  const legacy: Record<string,string> = {"suite":"suite.language","update":"suite.update","license":"suite.license","appearance-behavior":"worldnotion.document","overview":"worldnotion.overview","utils":"worldnotion.utils","properties":"worldnotion.properties","help":"worldnotion.help"};
  return legacy[section ?? ""] ?? "worldnotion." + (section ?? "document");
}


worldnotionSettingsPages.find(page => page.id === "worldnotion.plugins")!.controls.push(...getPluginDefinitions().map(plugin => ({id:"worldnotion.plugins."+plugin.id,label:{en:plugin.name,es:worldnotionSurfaceText("es",plugin.name)},description:{en:plugin.description,es:worldnotionSurfaceText("es",plugin.description)}})));

worldnotionSettingsPages.find(page => page.id === "worldnotion.properties")!.controls = [
{ id:"worldnotion.properties.customTags",label:{en:"Allow custom tags",es:"Permitir etiquetas personalizadas"},description:{en:"Accept tags outside the hierarchy",es:"Acepta etiquetas que no estén en la jerarquía"} },
{ id:"worldnotion.properties.slash",label:{en:"Detect slash notation",es:"Auto-detectar notación de barras"} },
{ id:"worldnotion.properties.hierarchy",label:{en:"Tag hierarchy",es:"Jerarquía de etiquetas"},keywords:["categories","categorías","etiquetas","tags"] },
];

worldnotionSettingsPages.find(page => page.id === "worldnotion.plugins")!.controls = worldnotionSettingsPages.find(page => page.id === "worldnotion.plugins")!.controls.filter(control => control.id !== "worldnotion.plugins.plugins");

worldnotionSettingsPages.find(page => page.id === "worldnotion.general")!.controls.push({id:"worldnotion.general.interface-font",label:{en:"Interface typeface",es:"Fuente de interfaz"}});
