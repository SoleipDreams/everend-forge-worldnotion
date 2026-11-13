import { Range } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { isStructuralChange } from "./pluginUtils";
import type { ImageResolver } from "./imagePlugin";

class PresentationPortraitWidget extends WidgetType {
  constructor(
    readonly path: string,
    readonly alt: string,
    private readonly resolve: ImageResolver,
  ) {
    super();
  }

  eq(other: PresentationPortraitWidget) {
    return other.path === this.path && other.alt === this.alt;
  }

  toDOM(view: EditorView) {
    const figure = document.createElement("figure");
    figure.className = "cm-presentation-portrait cm-presentation-portrait-loading";
    figure.dataset.imagePath = this.path;

    const image = document.createElement("img");
    image.alt = this.alt;
    image.addEventListener("load", () => {
      figure.classList.remove("cm-presentation-portrait-loading");
      view.requestMeasure();
    });
    image.addEventListener("error", () => {
      figure.classList.add("cm-presentation-portrait-unavailable");
      view.requestMeasure();
    });

    void this.resolve(this.path)
      .then((url) => {
        if (!url || !figure.isConnected) {
          figure.classList.add("cm-presentation-portrait-unavailable");
          return;
        }
        image.src = url;
        figure.append(image);
      })
      .catch(() => {
        figure.classList.add("cm-presentation-portrait-unavailable");
      });

    return figure;
  }

  ignoreEvent() {
    return false;
  }
}

export function presentationPortraitPlugin(options: {
  path: string;
  alt: string;
  resolve: ImageResolver;
}) {
  function getDecorations(): DecorationSet {
    if (!options.path.trim()) return Decoration.none;
    const widget = new PresentationPortraitWidget(options.path, options.alt, options.resolve);
    const decoration: Range<Decoration> = Decoration.widget({ widget, side: -1 }).range(0);
    return Decoration.set([decoration]);
  }

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor() {
        this.decorations = getDecorations();
      }

      update(update: ViewUpdate) {
        if (isStructuralChange(update)) this.decorations = getDecorations();
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}
