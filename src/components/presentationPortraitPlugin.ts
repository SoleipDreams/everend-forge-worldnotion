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

type PortraitActionLabels = {
  add: string;
  change: string;
  remove: string;
  actions?: string;
};

const DEFAULT_ACTION_LABELS: PortraitActionLabels = {
  add: "Add portrait",
  change: "Change portrait",
  remove: "Remove portrait",
  actions: "Portrait actions",
};

class PresentationPortraitWidget extends WidgetType {
  constructor(
    readonly path: string | undefined,
    readonly alt: string,
    private readonly resolve: ImageResolver,
    private readonly labels: PortraitActionLabels,
    private readonly onChoose?: () => void | Promise<void>,
    private readonly onRemove?: () => void,
  ) {
    super();
  }

  eq(other: PresentationPortraitWidget) {
    return (
      other.path === this.path &&
      other.alt === this.alt &&
      other.labels.add === this.labels.add &&
      other.labels.change === this.labels.change &&
      other.labels.remove === this.labels.remove &&
      other.labels.actions === this.labels.actions &&
      other.onChoose === this.onChoose &&
      other.onRemove === this.onRemove
    );
  }

  toDOM(view: EditorView) {
    const figure = document.createElement("figure");
    figure.className = `cm-presentation-portrait${this.path ? " cm-presentation-portrait-loading" : " cm-presentation-portrait-empty"}`;
    if (this.path) figure.dataset.imagePath = this.path;

    if (this.path) {
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
          view.requestMeasure();
        });
    } else if (this.onChoose) {
      const addButton = createActionButton(
        this.labels.add,
        "cm-presentation-portrait-add",
        createImagePlusIcon(),
        () => void this.onChoose?.(),
      );
      const label = document.createElement("span");
      label.textContent = this.labels.add;
      addButton.append(label);
      figure.append(addButton);
    } else {
      const placeholder = document.createElement("span");
      placeholder.className = "cm-presentation-portrait-placeholder";
      placeholder.setAttribute("aria-hidden", "true");
      placeholder.append(createImagePlusIcon());
      figure.append(placeholder);
    }

    if (this.path && this.onChoose) {
      const actions = document.createElement("span");
      actions.className = "cm-presentation-portrait-actions";
      actions.setAttribute("aria-label", this.labels.actions ?? "Portrait actions");
      actions.append(
        createActionButton(
          this.path ? this.labels.change : this.labels.add,
          "cm-presentation-portrait-change",
          createImagePlusIcon(),
          () => void this.onChoose?.(),
        ),
      );
      if (this.path && this.onRemove) {
        actions.append(
          createActionButton(
            this.labels.remove,
            "cm-presentation-portrait-remove",
            createTrashIcon(),
            () => this.onRemove?.(),
          ),
        );
      }
      figure.append(actions);
    }

    return figure;
  }

  ignoreEvent(event: Event) {
    return event.target instanceof Element && Boolean(event.target.closest("button"));
  }
}

function createIcon(paths: string[], circles: string[] = []) {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("width", "20");
  icon.setAttribute("height", "20");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "1.8");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.setAttribute("aria-hidden", "true");
  paths.forEach((d) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    icon.append(path);
  });
  circles.forEach((geometry) => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", geometry.split(" ")[0]);
    circle.setAttribute("cy", geometry.split(" ")[1]);
    circle.setAttribute("r", geometry.split(" ")[2]);
    icon.append(circle);
  });
  return icon;
}

function createImagePlusIcon() {
  return createIcon(
    [
      "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
      "m3 16 5-5 4 4 3-3 6 6",
      "M19 3v6",
      "M16 6h6",
    ],
    ["8.5 8.5 1.5"],
  );
}

function createTrashIcon() {
  return createIcon(["M3 6h18", "M8 6V4h8v2", "m19 6-1 14H6L5 6", "M10 11v5", "M14 11v5"]);
}

function createActionButton(
  label: string,
  className: string,
  icon: SVGSVGElement,
  onClick: () => void,
) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `cm-presentation-portrait-action ${className}`;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.append(icon);
  button.addEventListener("mousedown", (event) => event.stopPropagation());
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  return button;
}

export function presentationPortraitPlugin(options: {
  path?: string;
  alt: string;
  resolve: ImageResolver;
  labels?: PortraitActionLabels;
  onChoose?: () => void | Promise<void>;
  onRemove?: () => void;
}) {
  function getDecorations(): DecorationSet {
    if (!options.path?.trim() && !options.onChoose) return Decoration.none;
    const widget = new PresentationPortraitWidget(
      options.path,
      options.alt,
      options.resolve,
      options.labels ?? DEFAULT_ACTION_LABELS,
      options.onChoose,
      options.onRemove,
    );
    const decoration: Range<Decoration> = Decoration.widget({ widget, side: -2 }).range(0);
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
