import { learningText as t, type LearningStep, type LearningLesson } from "./learning";

const step = (id: string, title: [string, string], body: [string, string], section: string, target: string, event?: string, character: "brio" | "temple" = "brio"): LearningStep =>
  ({ id, title: t(...title), body: t(...body), section, target, event, character });

export const worldnotionIntroduction = [
  step("purpose", ["Da forma a tu mundo", "Shape your world"], ["Aquí viven tus personajes, lugares e ideas en notas Markdown. Tu universo es una carpeta que puedes conservar y llevar contigo.", "Characters, places and ideas live here in Markdown notes. Your universe is a folder you can keep and take with you."], "notes", "worldnotion.explorer"),
  step("inspector", ["Una nota, sus detalles", "A note and its details"], ["El explorador reúne las notas; el inspector muestra sus propiedades. Selecciona una nota cuando quieras conocer sus detalles.", "The explorer holds your notes; the inspector shows their properties. Select a note whenever you want to see its details."], "properties", "worldnotion.inspector", undefined, "temple"),
  step("start", ["Tu primera idea", "Your first idea"], ["En el explorador, abre el menú contextual y elige Nueva página en blanco. También puedes usar Nueva nota cuando no hay un documento seleccionado. Puedes elegir un tutorial más adelante.", "In the explorer, open the context menu and choose New blank page. You can also use New note when no document is selected. Choose a tutorial whenever you like."], "notes", "worldnotion.explorer"),
];

export const worldnotionLessons: LearningLesson[] = [
  { id: "notes", title: t("Crear una nota", "Create a note"), summary: t("Da un lugar a una idea y guárdala.", "Give an idea a home and save it."), section: "notes", steps: [
    step("create", ["Un lugar para tu idea", "A home for your idea"], ["Haz clic derecho en el explorador y elige Nueva página en blanco. Elige un nombre para una idea de tu universo.", "Right-click in the explorer and choose New blank page. Name an idea from your universe."], "notes", "worldnotion.explorer", "note-created"),
    step("save", ["Conserva lo que escribiste", "Keep what you wrote"], ["Escribe algo en la nota y guarda con Ctrl+S. El paso se confirma cuando la escritura en disco termina.", "Write something in the note and save with Ctrl+S. This step is confirmed when the file write succeeds."], "notes", "worldnotion.document", "note-saved", "temple"),
  ] },
  { id: "properties", title: t("Añadir propiedades", "Add properties"), summary: t("Define un detalle de una nota.", "Define a detail of a note."), section: "properties", steps: [
    step("property", ["Los detalles también cuentan", "Details matter too"], ["Selecciona una nota y cambia una propiedad en el inspector: tipo, estado, etiquetas o una propiedad propia.", "Select a note and change a property in the inspector: type, status, tags or a custom property."], "properties", "worldnotion.inspector", "property-edited", "temple"),
    step("save", ["Guarda los detalles", "Save the details"], ["Guarda la nota. Si el guardado automático ya terminó, realiza un cambio y guarda de nuevo.", "Save the note. If autosave already finished, make an edit and save again."], "properties", "worldnotion.inspector", "note-saved", "temple"),
  ] },
  { id: "references", title: t("Conectar referencias", "Connect references"), summary: t("Une las ideas de tu mundo.", "Connect the ideas in your world."), section: "references", steps: [
    step("link", ["Una idea encuentra a otra", "One idea meets another"], ["En una nota, añade un enlace [[Nombre de otra nota]] hacia una nota que exista en tu universo. Puedes usar las sugerencias del editor.", "In a note, add a [[Another note name]] link to a note that exists in your universe. You can use the editor suggestions."], "references", "worldnotion.document", "reference-added"),
    step("save", ["Conserva la conexión", "Keep the connection"], ["Guarda la nota para conservar el enlace y revisarlo en Enlaces.", "Save the note to keep the link and review it in Links."], "references", "worldnotion.document", "note-saved", "temple"),
  ] },
];
