import { learningText as t, type LearningStep, type LearningLesson } from "./learning";

const step = (
  id: string,
  title: [string, string],
  body: [string, string],
  section: string,
  target: string,
  event?: string,
  character: "brio" | "temple" = "brio",
  sameDocument = false,
): LearningStep => ({
  id,
  title: t(...title),
  body: t(...body),
  section,
  target,
  event,
  character,
  sameDocument,
});

export const worldnotionIntroduction = [
  step(
    "purpose",
    ["Da forma a tu mundo", "Shape your world"],
    [
      "Las entidades de tu mundo —personajes, lugares e ideas— se guardan como páginas Markdown. Toda entidad que creas en WorldNotion pertenece al canon del universo; puedes conservarla y llevarla contigo.",
      "Your world's entities—characters, places, and ideas—are stored as Markdown pages. Every entity created in WorldNotion belongs to the universe's canon, and you can keep and carry it with you.",
    ],
    "notes",
    "worldnotion.explorer",
  ),
  step(
    "inspector",
    ["Una entidad y sus detalles", "An entity and its details"],
    [
      "El explorador reúne las entidades; el inspector muestra sus propiedades. Selecciona una entidad cuando quieras revisar sus detalles.",
      "The explorer holds your entities; the inspector shows their properties. Select an entity whenever you want to review its details.",
    ],
    "properties",
    "worldnotion.inspector",
    undefined,
    "temple",
  ),
  step(
    "workspace",
    ["Carpetas y páginas", "Folders and pages"],
    [
      "El explorador muestra las carpetas y páginas Markdown del universo. Desde aquí puedes organizar tus ideas y abrir una nota para trabajarla; la guía de primeros pasos te acompaña cuando quieras crear tu primera carpeta y nota.",
      "The Explorer shows the universe's folders and Markdown pages. Use it to organize ideas and open a note to work on; the getting-started guide walks you through creating your first folder and note whenever you are ready.",
    ],
    "notes",
    "worldnotion.explorer",
  ),
];

export const worldnotionLessons: LearningLesson[] = [
  {
    id: "express-start",
    title: t("Crear mi espacio en WorldNotion", "Create my WorldNotion space"),
    summary: t(
      "Crea una carpeta del explorador, una nota y conoce sus propiedades.",
      "Create an Explorer folder and a note, then learn about their properties.",
    ),
    section: "notes",
    steps: [
      step(
        "folder",
        ["Una carpeta dentro del universo", "A folder inside your universe"],
        [
          "En el Explorador, crea una carpeta llamada «WorldNotion» o elige el nombre que prefieras. Esta carpeta está dentro de la carpeta local del universo (por ejemplo, «Mundo»); sirve para organizar sus notas.",
          "In Explorer, create a folder named “WorldNotion” or choose any name you like. This folder lives inside your universe's local folder (for example, “World”); it organizes the notes in that universe.",
        ],
        "notes",
        "worldnotion.create-folder",
        "folder-created",
      ),
      step(
        "note",
        ["Tu primera nota", "Your first note"],
        [
          "Con esa carpeta seleccionada, crea una página en blanco y llámala «Primera nota» o ponle otro nombre. Las notas se guardan como archivos Markdown dentro de tu universo.",
          "With that folder selected, create a blank page called “First note” or choose another name. Notes are saved as Markdown files inside your universe.",
        ],
        "notes",
        "worldnotion.create-note",
        "note-created",
      ),
      step(
        "properties",
        ["El panel de Propiedades", "The Properties panel"],
        [
          "El panel de Propiedades muestra datos estructurados de la nota. Los campos base incluyen ID, nombre, tipo, estado, etiquetas y alias; el inspector muestra los que corresponden al elemento seleccionado. Puedes personalizarlos desde Ajustes, pero no necesitas cambiar nada para continuar.",
          "The Properties panel shows structured details for a note. Base fields include ID, name, type, status, tags and aliases; the inspector shows the fields that apply to the selected item. You can customize them in Settings, but you do not need to change anything to continue.",
        ],
        "properties",
        "worldnotion.inspector",
        undefined,
        "temple",
      ),
    ],
  },
  {
    id: "pathbranching-prep",
    title: t("Preparar el canon para PathBranching", "Prepare canon for PathBranching"),
    summary: t(
      "Configura propiedades, organiza el canon y conecta personaje con lugar.",
      "Set up properties, organize canon and connect a character to a place.",
    ),
    section: "property-schema",
    steps: [
      step(
        "properties",
        ["Prepara los tipos del canon", "Set up canon types"],
        [
          "En Ajustes → Propiedades, revisa los tipos y campos que usarás en PathBranching. Asegúrate de tener character (Personaje) y location (Lugar), y guarda la configuración. Este paso se confirma cuando ambos tipos están guardados.",
          "In Settings → Properties, review the types and fields you will use in PathBranching. Make sure character and location exist, then save the configuration. This step completes when both types are saved.",
        ],
        "property-schema",
        "worldnotion.properties-settings",
        "pathbranching-properties-ready",
      ),
      step(
        "folder",
        ["Crea una carpeta de canon", "Create a canon folder"],
        [
          "En el explorador, abre el menú contextual y crea una carpeta para reunir los elementos que llevarás a PathBranching. Puedes llamarla Canon o elegir otro nombre.",
          "In Explorer, open the context menu and create a folder to hold the items you will take into PathBranching. You can call it Canon or choose another name.",
        ],
        "notes",
        "worldnotion.create-folder",
        "folder-created",
      ),
      step(
        "folder-note",
        ["Describe la carpeta", "Describe the folder"],
        [
          "Con la carpeta seleccionada, crea su nota de carpeta. Puedes anotar qué tipo de información guardarás aquí.",
          "With the folder selected, create its folder note. Add a short description of the information you will keep here.",
        ],
        "notes",
        "worldnotion.create-folder-note",
        "folder-note-created",
      ),
      step(
        "character-note",
        ["Crea una página de personaje", "Create a character page"],
        [
          "Con la carpeta de canon seleccionada, abre el menú de creación y elige Nueva página en blanco. Ponle el nombre de un personaje que quieras usar en la historia.",
          "With the canon folder selected, open the creation menu and choose New blank page. Name a character you want to use in the story.",
        ],
        "notes",
        "worldnotion.create-note",
        "note-created",
      ),
      step(
        "character-type",
        ["Asígnale el tipo Personaje", "Set its type to Character"],
        [
          "Selecciona la página, cambia su propiedad Tipo a character (Personaje) y guarda. WorldNotion la reconoce como entidad y, por crearse aquí, forma parte del canon.",
          "Select the page, set its Type property to character, and save. WorldNotion recognizes it as an entity, and because it was created here, it belongs to the canon.",
        ],
        "properties",
        "worldnotion.entity-type",
        "entity-type-saved:character",
        "temple",
        true,
      ),
      step(
        "location-note",
        ["Crea una página de lugar", "Create a location page"],
        [
          "Con la carpeta de canon seleccionada, abre el menú de creación y elige Nueva página en blanco. Nombra un lugar importante para tu historia.",
          "With the canon folder selected, open the creation menu and choose New blank page. Name an important place in your story.",
        ],
        "notes",
        "worldnotion.create-note",
        "note-created",
      ),
      step(
        "location-type",
        ["Asígnale el tipo Lugar", "Set its type to Location"],
        [
          "Selecciona la página, cambia su propiedad Tipo a location (Lugar) y guarda. WorldNotion la reconoce como entidad y, por crearse aquí, forma parte del canon.",
          "Select the page, set its Type property to location, and save. WorldNotion recognizes it as an entity, and because it was created here, it belongs to the canon.",
        ],
        "properties",
        "worldnotion.entity-type",
        "entity-type-saved:location",
        "temple",
        true,
      ),
      step(
        "connect-canon",
        ["Conecta personaje y lugar", "Connect character and place"],
        [
          "En la entidad de Lugar, añade un enlace [[Nombre del personaje]] y guarda. La referencia debe apuntar a la entidad de Personaje que acabas de crear.",
          "In the Location entity, add a [[Character name]] link and save. The reference should point to the Character entity you just created.",
        ],
        "references",
        "worldnotion.document",
        "reference-saved",
        "temple",
        true,
      ),
    ],
  },
  {
    id: "notes",
    title: t("Crear una entidad", "Create an entity"),
    summary: t(
      "Crea una entidad para tu universo y guarda su página Markdown.",
      "Create an entity for your universe and save its Markdown page.",
    ),
    section: "notes",
    steps: [
      step(
        "create",
        ["Un lugar para tu idea", "A home for your idea"],
        [
          "Haz clic derecho en el explorador y elige Nueva página en blanco. Ponle un nombre y asígnale un tipo para crear una entidad de tu universo.",
          "Right-click in the explorer and choose New blank page. Name it and assign a type to create an entity in your universe.",
        ],
        "notes",
        "worldnotion.explorer",
        "note-created",
      ),
      step(
        "save",
        ["Conserva lo que escribiste", "Keep what you wrote"],
        [
          "Escribe el contenido de la entidad en su página Markdown y guarda con Ctrl+S. El paso se confirma cuando la escritura en disco termina.",
          "Write the entity's content on its Markdown page and save with Ctrl+S. This step is confirmed when the file write succeeds.",
        ],
        "notes",
        "worldnotion.document",
        "note-saved",
        "temple",
      ),
    ],
  },
  {
    id: "properties",
    title: t("Añadir propiedades", "Add properties"),
    summary: t("Define un detalle de una entidad.", "Define a detail of an entity."),
    section: "properties",
    steps: [
      step(
        "property",
        ["Los detalles también cuentan", "Details matter too"],
        [
          "Selecciona una entidad y cambia una propiedad en el inspector: tipo, estado, etiquetas o una propiedad propia.",
          "Select an entity and change a property in the inspector: type, status, tags or a custom property.",
        ],
        "properties",
        "worldnotion.inspector",
        "property-edited",
        "temple",
      ),
      step(
        "save",
        ["Guarda los detalles", "Save the details"],
        [
          "Guarda la entidad. Si el guardado automático ya terminó, realiza un cambio y guarda de nuevo.",
          "Save the entity. If autosave already finished, make an edit and save again.",
        ],
        "properties",
        "worldnotion.inspector",
        "note-saved",
        "temple",
      ),
    ],
  },
  {
    id: "references",
    title: t("Conectar referencias", "Connect references"),
    summary: t("Une las entidades de tu mundo.", "Connect the entities in your world."),
    section: "references",
    steps: [
      step(
        "link",
        ["Una entidad encuentra a otra", "One entity meets another"],
        [
          "En una entidad, añade un enlace [[Nombre de otra entidad]] hacia otra entidad de tu universo. Puedes usar las sugerencias del editor.",
          "In an entity, add a [[Another entity name]] link to another entity in your universe. You can use the editor suggestions.",
        ],
        "references",
        "worldnotion.document",
        "reference-added",
      ),
      step(
        "save",
        ["Conserva la conexión", "Keep the connection"],
        [
          "Guarda la entidad para conservar el enlace y revisarlo en Enlaces.",
          "Save the entity to keep the link and review it in Links.",
        ],
        "references",
        "worldnotion.document",
        "note-saved",
        "temple",
      ),
    ],
  },
];
