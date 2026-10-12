import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Plus,
  Hand,
  MousePointer2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Pencil,
  StickyNote,
  Type,
  Users,
  Trash2,
  ExternalLink,
} from "lucide-react";
import type { VaultIndex } from "../domain";
import type { VisualDocumentSession } from "../visualDocuments/types";
import type {
  RelationshipCanvas,
  RelationshipTreeDocument,
  RelationshipPerson,
  TreeEndpoint,
  TreePoint,
} from "../visualDocuments/relationshipTypes";
import {
  cloneTreeVariant,
  connectTree,
  createRelationshipCanvas,
  endpointPoint,
  junctionAt,
  moveTreeSelection,
  nodePortPoint,
  PERSON_HEIGHT,
  PERSON_WIDTH,
  removeTreeSelection,
  resolveTreeReference,
  TREE_PORTS,
  treeBounds,
  treeId,
} from "../visualDocuments/relationships";
import {
  DEFAULT_VISUAL_VIEWPORT,
  fitViewport,
  readVisualSession,
  viewportPoint,
  writeVisualSession,
  zoomViewport,
  type VisualViewport,
} from "../visualDocuments/viewport";
import { getPresentationRoleValue } from "../utils/entityPresentation";
import { resolveNoteImagePath, useVaultImage } from "../utils/vaultImages";
import { parseMarkdownFrontmatter } from "../domain";
import { resolveVariantFrontmatter } from "../utils/noteVariants";
import { useUniverseDraft } from "../hooks/useUniverseDraft";
import "./visualDocumentEditors.css";

type Props = {
  document: RelationshipTreeDocument;
  onChange: (document: RelationshipTreeDocument, label?: string) => void;
  vaultIndex?: VaultIndex;
  onOpenReference?: (reference: string) => void;
  locale?: string;
  documentPath?: string;
  session?: VisualDocumentSession;
  onSessionChange?: (session: VisualDocumentSession) => void;
  active?: boolean;
};
type Drag =
  | { kind: "pan"; start: TreePoint; viewport: VisualViewport }
  | { kind: "move"; start: TreePoint; canvas: RelationshipCanvas; ids: string[] }
  | {
      kind: "connection";
      from: TreeEndpoint;
      point: TreePoint;
      edgeId?: string;
      end?: "from" | "to";
    }
  | { kind: "draw"; points: TreePoint[] };
const RELATION_ES: Record<string, string> = {
  parent: "Padre",
  child: "Hijo",
  partner: "Pareja",
  ex: "Ex",
  sibling: "Hermano",
  "half-sibling": "Medio hermano",
  adopted: "Adopción",
  "step-parent": "Padrastro",
  unnamed: "Sin nombre",
};

function PersonImage({
  node,
  index,
  documentPath,
}: {
  node: RelationshipPerson;
  index?: VaultIndex;
  documentPath?: string;
}) {
  const resolution = resolveTreeReference(index?.entities || [], node.reference);
  const entity = resolution.entity;
  const metadata = entity
    ? resolveVariantFrontmatter(
        parseMarkdownFrontmatter(entity.file.content)?.data || {},
        resolution.variantId,
      )
    : undefined;
  const role =
    entity && index
      ? getPresentationRoleValue(
          index.propertiesConfig,
          entity.type,
          metadata || entity.customProperties,
          "portrait",
        )
      : undefined;
  const raw = node.portrait || role || "";
  const external = /^https?:\/\//i.test(raw) ? raw : undefined;
  const path =
    index && !external
      ? resolveNoteImagePath(index, entity?.path || documentPath || "", raw)
      : null;
  const image = useVaultImage(index, path || "");
  const url = external || image.url;
  return url ? (
    <image
      href={url}
      x={node.x + 38}
      y={node.y + 12}
      width={56}
      height={56}
      preserveAspectRatio="xMidYMid slice"
    />
  ) : (
    <text
      x={node.x + PERSON_WIDTH / 2}
      y={node.y + 48}
      textAnchor="middle"
      className="ef-tree-initial"
    >
      {(node.name || entity?.name || "?").slice(0, 1)}
    </text>
  );
}

export function RelationshipTreeEditor({
  document,
  onChange,
  vaultIndex,
  onOpenReference,
  locale = "es",
  documentPath,
  session,
  onSessionChange,
  active = true,
}: Props) {
  const es = locale.startsWith("es");
  const text = (spanish: string, english: string) => (es ? spanish : english);
  const sessionKey = `${vaultIndex?.rootPath || ""}:${documentPath || document.id}:relationships`;
  const [localSession, setLocalSession] = useState<VisualDocumentSession>(() =>
    readVisualSession(sessionKey, {
      viewport: DEFAULT_VISUAL_VIEWPORT,
      variantId: Object.keys(document.variants)[0],
      selectedIds: [],
    }),
  );
  const ui = session || localSession;
  const view = ui.viewport || DEFAULT_VISUAL_VIEWPORT;
  const variantId = document.variants[ui.variantId || ""]
    ? ui.variantId!
    : Object.keys(document.variants)[0];
  const canvas = document.variants[variantId] || createRelationshipCanvas();
  const selected = ui.selectedIds || [];
  const [tool, setTool] = useState<"select" | "pan" | "draw" | "note" | "text">("select");
  const [drag, setDrag] = useState<Drag | null>(null);
  const [preview, setPreview] = useState<RelationshipCanvas | null>(null);
  const [relationshipType, setRelationshipType] = useState("partner");
  const [labelMode, setLabelMode] = useState<"always" | "hover">("always");
  const [variantName, setVariantName] = useState(() =>
    String(ui.drafts?.["tree-variant"]?.value || ""),
  );
  const [newTypeName, setNewTypeName] = useState(() =>
    String(ui.drafts?.["tree-relationship-type"]?.value || ""),
  );
  useUniverseDraft(Boolean(variantName.trim() || newTypeName.trim()));
  const [error, setError] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !active) return;
    const preventScroll = (event: WheelEvent) => event.preventDefault();
    svg.addEventListener("wheel", preventScroll, { passive: false });
    return () => svg.removeEventListener("wheel", preventScroll);
  }, [active]);
  const shown = preview || canvas;
  const updateSession = (patch: Partial<VisualDocumentSession>) => {
    const next = { ...ui, ...patch };
    setLocalSession(next);
    writeVisualSession(sessionKey, next);
    onSessionChange?.(next);
  };
  const composerDrafts = (key: string, value: string, label: string) => {
    const drafts = { ...ui.drafts };
    if (value.trim()) drafts[key] = { value, label };
    else delete drafts[key];
    return drafts;
  };
  useEffect(() => {
    if (!active) {
      setDrag(null);
      setPreview(null);
    }
  }, [active]);
  // A gesture belongs to its original document revision and variant. External
  // edits, deletion, undo or a variant switch must never commit a stale preview.
  const documentRevision = JSON.stringify(document);
  useEffect(() => {
    setDrag(null);
    setPreview(null);
  }, [documentRevision, variantId]);
  const commit = (next: RelationshipCanvas, label: string) =>
    onChange({ ...document, variants: { ...document.variants, [variantId]: next } }, label);
  const position = (event: { clientX: number; clientY: number }) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const world = (event: { clientX: number; clientY: number }) =>
    viewportPoint(view, position(event));
  const capture = (event: ReactPointerEvent) => {
    svgRef.current?.setPointerCapture(event.pointerId);
  };
  const pick = (id: string, add = false) =>
    updateSession({
      selectedIds: add
        ? selected.includes(id)
          ? selected.filter((item) => item !== id)
          : [...selected, id]
        : [id],
    });
  const selectOnKey = (event: ReactKeyboardEvent, id: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      pick(id, event.shiftKey);
    }
  };
  const beginMove = (event: ReactPointerEvent, id: string) => {
    if (tool !== "select" || event.button !== 0) return;
    event.stopPropagation();
    capture(event);
    const ids = selected.includes(id) ? selected : event.shiftKey ? [...selected, id] : [id];
    updateSession({ selectedIds: ids });
    setDrag({ kind: "move", start: world(event), canvas, ids });
  };
  const addPerson = (from?: TreeEndpoint) => {
    const anchor = from ? endpointPoint(canvas, from) : undefined;
    const center = svgRef.current
      ? viewportPoint(view, {
          x: svgRef.current.clientWidth / 2,
          y: svgRef.current.clientHeight / 2,
        })
      : { x: 150, y: 120 };
    const node: RelationshipPerson = {
      id: treeId(),
      name: text("Persona", "Person"),
      x: anchor ? anchor.x + 180 : center.x - 66,
      y: anchor ? anchor.y - 70 : center.y - 70,
    };
    let next = { ...canvas, nodes: [...canvas.nodes, node] };
    if (from)
      next = connectTree(
        next,
        from,
        { kind: "node", nodeId: node.id, port: "left" },
        relationshipType,
      );
    commit(next, text("Añadir persona", "Add person"));
    pick(node.id);
  };
  const remove = () => {
    commit(removeTreeSelection(canvas, selected), text("Eliminar selección", "Delete selection"));
    updateSession({ selectedIds: [] });
  };
  const startConnection = (
    event: ReactPointerEvent,
    from: TreeEndpoint,
    edgeId?: string,
    end?: "from" | "to",
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    capture(event);
    setDrag({ kind: "connection", from, point: world(event), edgeId, end });
  };
  const finishConnection = (target: TreeEndpoint) => {
    if (drag?.kind !== "connection") return;
    try {
      if (drag.edgeId && drag.end) {
        const next = {
          ...canvas,
          edges: canvas.edges.map((edge) =>
            edge.id === drag.edgeId ? { ...edge, [drag.end!]: target } : edge,
          ),
        };
        const changed = next.edges.find((edge) => edge.id === drag.edgeId)!;
        if (!endpointPoint(next, changed.from) || !endpointPoint(next, changed.to))
          throw new Error(text("La unión formaría un ciclo.", "The junction would form a cycle."));
        commit(next, text("Mover extremo", "Move endpoint"));
      } else {
        if (JSON.stringify(drag.from) === JSON.stringify(target)) {
          setDrag(null);
          return;
        }
        commit(
          connectTree(canvas, drag.from, target, relationshipType),
          text("Conectar personas", "Connect people"),
        );
      }
      setError("");
    } catch (problem) {
      setError(String(problem));
    }
    setDrag(null);
  };
  const finishPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    if (drag.kind === "move" && preview) commit(preview, text("Mover selección", "Move selection"));
    if (drag.kind === "draw" && drag.points.length > 1)
      commit(
        {
          ...canvas,
          drawings: [
            ...canvas.drawings,
            { id: treeId(), points: drag.points, color: "#7d84db", width: 3 },
          ],
        },
        text("Dibujar", "Draw"),
      );
    if (drag.kind === "connection") {
      // Pointer capture routes up to SVG. Hit-test the actual target to permit port and junction drops.
      const target = globalThis.document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest("[data-tree-port],[data-tree-edge]") as SVGElement | null;
      const nodeId = target?.getAttribute("data-tree-node");
      const port = target?.getAttribute("data-tree-port");
      const edgeId = target?.getAttribute("data-tree-edge");
      if (nodeId && port && TREE_PORTS.includes(port as (typeof TREE_PORTS)[number]))
        finishConnection({ kind: "node", nodeId, port: port as (typeof TREE_PORTS)[number] });
      else if (edgeId && edgeId !== drag.edgeId) {
        const edge = canvas.edges.find((item) => item.id === edgeId);
        const junction = edge && junctionAt(canvas, edge, world(event));
        if (junction) finishConnection(junction);
      }
    }
    setDrag(null);
    setPreview(null);
  };
  const selectedNode = canvas.nodes.find((node) => selected.includes(node.id));
  const selectedEdge = !selectedNode
    ? canvas.edges.find((edge) => selected.includes(edge.id))
    : undefined;
  const selectedEdgeType = document.relationshipTypes.find(
    (type) => type.id === selectedEdge?.typeId,
  );
  const selectedAnnotation =
    !selectedNode && !selectedEdge
      ? canvas.annotations.find((note) => selected.includes(note.id))
      : undefined;
  const selectedGroup = canvas.groups.find((group) => selected.includes(group.id));
  const selectedDrawing = canvas.drawings.find((drawing) => selected.includes(drawing.id));
  const changeNode = (patch: Partial<RelationshipPerson>) =>
    selectedNode &&
    commit(
      {
        ...canvas,
        nodes: canvas.nodes.map((node) =>
          node.id === selectedNode.id ? { ...node, ...patch } : node,
        ),
      },
      text("Editar persona", "Edit person"),
    );
  const referenceResolution = selectedNode
    ? resolveTreeReference(vaultIndex?.entities || [], selectedNode.reference)
    : undefined;

  return (
    <section
      className="ef-visual-editor ef-relationships"
      aria-label={text("Árbol de relaciones", "Relationship tree")}
      tabIndex={0}
      onKeyDown={(event) => {
        if (
          !active ||
          (event.target as HTMLElement).closest("input,textarea,select,[contenteditable=true]")
        )
          return;
        if (event.key === "Escape") {
          setDrag(null);
          setPreview(null);
          updateSession({ selectedIds: [] });
        }
        if ((event.key === "Delete" || event.key === "Backspace") && selected.length) {
          event.preventDefault();
          remove();
        }
        if (event.key.toLowerCase() === "v") setTool("select");
        if (event.key.toLowerCase() === "h") setTool("pan");
        if (event.key.toLowerCase() === "t") setTool("text");
        if (
          ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) &&
          selected.length
        ) {
          event.preventDefault();
          const step = event.shiftKey ? 20 : 2;
          const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
          const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
          commit(
            moveTreeSelection(canvas, selected, dx, dy),
            text("Mover selección", "Move selection"),
          );
        }
      }}
    >
      <div
        className="ef-visual-toolbar"
        role="toolbar"
        aria-label={text("Herramientas del árbol", "Tree tools")}
      >
        <button
          type="button"
          title={text("Seleccionar (V)", "Select (V)")}
          aria-label={text("Seleccionar", "Select")}
          aria-pressed={tool === "select"}
          onClick={() => setTool("select")}
        >
          <MousePointer2 size={16} />
        </button>
        <button
          type="button"
          title={text("Mover (H)", "Pan (H)")}
          aria-label={text("Mover lienzo", "Pan canvas")}
          aria-pressed={tool === "pan"}
          onClick={() => setTool("pan")}
        >
          <Hand size={16} />
        </button>
        <button type="button" onClick={() => addPerson()}>
          <Plus size={16} />
          {text("Persona", "Person")}
        </button>
        <button
          type="button"
          aria-pressed={tool === "note"}
          onClick={() => setTool("note")}
          title={text("Añadir nota", "Add note")}
          aria-label={text("Añadir nota", "Add note")}
        >
          <StickyNote size={16} />
        </button>
        <button
          type="button"
          aria-pressed={tool === "text"}
          onClick={() => setTool("text")}
          title={text("Añadir texto (T)", "Add text (T)")}
          aria-label={text("Añadir texto", "Add text")}
        >
          <Type size={16} />
        </button>
        <button
          type="button"
          aria-pressed={tool === "draw"}
          onClick={() => setTool("draw")}
          title={text("Dibujo libre", "Free drawing")}
          aria-label={text("Dibujo libre", "Free drawing")}
        >
          <Pencil size={16} />
        </button>
        <button
          type="button"
          title={text("Agrupar selección", "Group selection")}
          aria-label={text("Agrupar selección", "Group selection")}
          disabled={!canvas.nodes.some((node) => selected.includes(node.id))}
          onClick={() => {
            const nodes = canvas.nodes.filter((node) => selected.includes(node.id)),
              box = treeBounds({
                ...canvas,
                nodes,
                edges: [],
                annotations: [],
                groups: [],
                drawings: [],
              });
            const group = {
              id: treeId(),
              name: text("Grupo", "Group"),
              nodeIds: nodes.map((node) => node.id),
              x: box.x - 20,
              y: box.y - 32,
              width: box.width + 40,
              height: box.height + 52,
            };
            commit({ ...canvas, groups: [...canvas.groups, group] }, text("Agrupar", "Group"));
            pick(group.id);
          }}
        >
          <Users size={16} />
        </button>
        <select
          aria-label={text("Tipo de relación al conectar", "Relationship type when connecting")}
          value={relationshipType}
          onChange={(event) => setRelationshipType(event.target.value)}
        >
          {document.relationshipTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.icon} {(es && RELATION_ES[type.id]) || type.name}
            </option>
          ))}
        </select>
        <select
          aria-label={text("Variante del árbol", "Tree variant")}
          value={variantId}
          onChange={(event) => updateSession({ variantId: event.target.value, selectedIds: [] })}
        >
          {Object.values(document.variants).map((variant) => (
            <option key={variant.id} value={variant.id}>
              {variant.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          title={text("Alejar", "Zoom out")}
          aria-label={text("Alejar", "Zoom out")}
          onClick={() => updateSession({ viewport: zoomViewport(view, 0.8, { x: 200, y: 150 }) })}
        >
          <ZoomOut size={16} />
        </button>
        <span className="ef-visual-zoom">{Math.round(view.zoom * 100)}%</span>
        <button
          type="button"
          title={text("Acercar", "Zoom in")}
          aria-label={text("Acercar", "Zoom in")}
          onClick={() => updateSession({ viewport: zoomViewport(view, 1.25, { x: 200, y: 150 }) })}
        >
          <ZoomIn size={16} />
        </button>
        <button
          type="button"
          title={text("Ajustar", "Fit")}
          aria-label={text("Ajustar", "Fit")}
          onClick={() =>
            updateSession({
              viewport: fitViewport(
                treeBounds(canvas),
                svgRef.current?.clientWidth || 600,
                svgRef.current?.clientHeight || 400,
              ),
            })
          }
        >
          <Maximize size={16} />
        </button>
      </div>
      {error && (
        <div className="ef-visual-diagnostic" role="alert">
          {error}
        </div>
      )}
      <div className="ef-visual-body">
        <svg
          ref={svgRef}
          className={`ef-visual-canvas tool-${tool} labels-${labelMode}`}
          aria-label={text("Lienzo de relaciones", "Relationship canvas")}
          tabIndex={0}
          onWheel={(event) => {
            updateSession({
              viewport:
                event.ctrlKey || event.metaKey
                  ? zoomViewport(view, Math.exp(-event.deltaY * 0.002), position(event))
                  : { ...view, x: view.x - event.deltaX, y: view.y - event.deltaY },
            });
          }}
          onPointerDown={(event) => {
            if (event.button !== 0 && event.button !== 1) return;
            capture(event);
            if (tool === "pan" || event.button === 1 || event.altKey)
              setDrag({ kind: "pan", start: position(event), viewport: view });
            else if (tool === "draw") setDrag({ kind: "draw", points: [world(event)] });
            else if (tool === "note" || tool === "text") {
              const point = world(event),
                note = {
                  id: treeId(),
                  kind: tool,
                  text: text(tool === "note" ? "Nota" : "Texto", tool === "note" ? "Note" : "Text"),
                  ...point,
                };
              commit(
                { ...canvas, annotations: [...canvas.annotations, note] },
                text("Añadir anotación", "Add annotation"),
              );
              pick(note.id);
              setTool("select");
            } else updateSession({ selectedIds: [] });
          }}
          onPointerMove={(event) => {
            if (!drag) return;
            if (drag.kind === "pan") {
              const point = position(event);
              updateSession({
                viewport: {
                  ...drag.viewport,
                  x: drag.viewport.x + point.x - drag.start.x,
                  y: drag.viewport.y + point.y - drag.start.y,
                },
              });
            }
            if (drag.kind === "move") {
              const point = world(event),
                dx = point.x - drag.start.x,
                dy = point.y - drag.start.y;
              setPreview(moveTreeSelection(drag.canvas, drag.ids, dx, dy));
            }
            if (drag.kind === "connection") setDrag({ ...drag, point: world(event) });
            if (drag.kind === "draw") setDrag({ ...drag, points: [...drag.points, world(event)] });
          }}
          onPointerUp={finishPointer}
          onPointerCancel={() => {
            setDrag(null);
            setPreview(null);
          }}
        >
          <g transform={`translate(${view.x} ${view.y}) scale(${view.zoom})`}>
            {shown.groups.map((group) => (
              <g
                key={group.id}
                role="button"
                tabIndex={0}
                aria-label={group.name}
                onKeyDown={(event) => selectOnKey(event, group.id)}
                onPointerDown={(event) => beginMove(event, group.id)}
              >
                <rect
                  className={`ef-tree-group ${selected.includes(group.id) ? "selected" : ""}`}
                  x={group.x}
                  y={group.y}
                  width={group.width}
                  height={group.height}
                  rx={10}
                  style={{ stroke: group.color }}
                />
                <text x={group.x + 12} y={group.y + 20}>
                  {group.name}
                </text>
              </g>
            ))}
            {shown.drawings.map((drawing, index) => (
              <polyline
                key={drawing.id}
                role="button"
                tabIndex={0}
                aria-label={`${text("Dibujo", "Drawing")} ${index + 1}`}
                points={drawing.points.map((point) => `${point.x},${point.y}`).join(" ")}
                fill="none"
                stroke={drawing.color}
                strokeWidth={selected.includes(drawing.id) ? drawing.width + 2 : drawing.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                onKeyDown={(event) => selectOnKey(event, drawing.id)}
                onPointerDown={(event) => beginMove(event, drawing.id)}
              />
            ))}
            {shown.edges.map((edge) => {
              const from = endpointPoint(shown, edge.from),
                to = endpointPoint(shown, edge.to);
              if (!from || !to)
                return (
                  <text key={edge.id} x={20} y={20} className="ef-tree-warning">
                    {text("Conexión inválida", "Invalid connection")}: {edge.id}
                  </text>
                );
              const type = document.relationshipTypes.find((item) => item.id === edge.typeId);
              const style = edge.style || type?.style || "solid",
                color = edge.color || type?.color;
              return (
                <g
                  key={edge.id}
                  className={`ef-tree-edge ${selected.includes(edge.id) ? "selected" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${text("Relación", "Relationship")}: ${edge.label ?? ((es && RELATION_ES[edge.typeId]) || type?.name || edge.typeId)}`}
                  onKeyDown={(event) => selectOnKey(event, edge.id)}
                >
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    style={color ? { stroke: color } : undefined}
                    strokeDasharray={
                      style === "dashed" ? "9 6" : style === "dotted" ? "2 5" : undefined
                    }
                  />
                  <line
                    className="ef-tree-edge-hit"
                    data-tree-edge={edge.id}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    onPointerDown={(event) => {
                      if (tool !== "select") return;
                      event.stopPropagation();
                      pick(edge.id, event.shiftKey);
                    }}
                    onPointerUp={(event) => {
                      if (drag?.kind === "connection") {
                        event.stopPropagation();
                        const endpoint = junctionAt(shown, edge, world(event));
                        if (endpoint) finishConnection(endpoint);
                      }
                    }}
                  />
                  <text
                    className="ef-tree-edge-label"
                    x={(from.x + to.x) / 2}
                    y={(from.y + to.y) / 2 - 8}
                    textAnchor="middle"
                  >
                    {edge.icon || type?.icon}{" "}
                    {edge.label ?? ((es && RELATION_ES[edge.typeId]) || type?.name)}
                  </text>
                  {[edge.from, edge.to]
                    .filter((end) => end.kind === "junction")
                    .map((end, i) => {
                      const point = endpointPoint(shown, end)!;
                      return (
                        <circle
                          key={i}
                          cx={point.x}
                          cy={point.y}
                          r={4}
                          className="ef-tree-junction"
                        />
                      );
                    })}
                </g>
              );
            })}
            {shown.annotations.map((note) => (
              <g
                key={note.id}
                role="button"
                tabIndex={0}
                aria-label={note.text}
                onKeyDown={(event) => selectOnKey(event, note.id)}
                onPointerDown={(event) => beginMove(event, note.id)}
              >
                {note.kind === "note" && (
                  <rect
                    className={`ef-tree-note ${selected.includes(note.id) ? "selected" : ""}`}
                    x={note.x}
                    y={note.y}
                    width={note.width || 180}
                    height={100}
                    rx={8}
                    style={{ fill: note.color }}
                  />
                )}
                <foreignObject
                  x={note.x + 10}
                  y={note.y + 8}
                  width={(note.width || 180) - 20}
                  height={86}
                >
                  <div
                    className="ef-tree-note-text"
                    style={{ color: note.kind === "text" ? note.color : undefined }}
                  >
                    {note.text}
                  </div>
                </foreignObject>
              </g>
            ))}
            {shown.nodes.map((node) => {
              const ref = resolveTreeReference(vaultIndex?.entities || [], node.reference);
              const name = node.name || ref.entity?.name || text("Persona", "Person");
              return (
                <g
                  key={node.id}
                  className={`ef-tree-person ${selected.includes(node.id) ? "selected" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${name}${ref.diagnostic ? ` (${text("Referencia no resuelta", "Unresolved reference")})` : ""}`}
                  onKeyDown={(event) => selectOnKey(event, node.id)}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    if (node.reference && !ref.diagnostic) onOpenReference?.(node.reference);
                  }}
                  onPointerDown={(event) => beginMove(event, node.id)}
                >
                  <rect
                    x={node.x}
                    y={node.y}
                    width={PERSON_WIDTH}
                    height={PERSON_HEIGHT}
                    rx={8}
                    className="ef-tree-person-card"
                  />
                  <circle cx={node.x + 66} cy={node.y + 40} r={30} className="ef-tree-avatar" />
                  <PersonImage node={node} index={vaultIndex} documentPath={documentPath} />
                  {node.deceased && (
                    <path
                      d={`M${node.x + 40},${node.y + 62} L${node.x + 90},${node.y + 15}`}
                      className="ef-tree-deceased"
                    />
                  )}
                  <foreignObject x={node.x + 8} y={node.y + 78} width={116} height={48}>
                    <div className="ef-tree-person-name">{name}</div>
                  </foreignObject>
                  {node.reference && (
                    <text
                      x={node.x + 66}
                      y={node.y + 133}
                      textAnchor="middle"
                      className={ref.diagnostic ? "ef-tree-warning" : "ef-tree-linked"}
                    >
                      {ref.diagnostic ? "⚠" : "↗"}
                    </text>
                  )}
                  {TREE_PORTS.map((port) => {
                    const point = nodePortPoint(node, port);
                    return (
                      <circle
                        key={port}
                        data-tree-port={port}
                        data-tree-node={node.id}
                        className="ef-tree-port"
                        cx={point.x}
                        cy={point.y}
                        r={6}
                        role="button"
                        tabIndex={0}
                        aria-label={`${text("Conectar", "Connect")} ${name} ${port}`}
                        onPointerDown={(event) =>
                          startConnection(event, { kind: "node", nodeId: node.id, port })
                        }
                        onPointerUp={(event) => {
                          if (drag?.kind === "connection") {
                            event.stopPropagation();
                            finishConnection({ kind: "node", nodeId: node.id, port });
                          }
                        }}
                        onDoubleClick={(event) => {
                          event.stopPropagation();
                          addPerson({ kind: "node", nodeId: node.id, port });
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.stopPropagation();
                            addPerson({ kind: "node", nodeId: node.id, port });
                          }
                        }}
                      />
                    );
                  })}
                </g>
              );
            })}
            {/* Endpoint handles must be above person ports at the same coordinates. */}
            {shown.edges
              .filter((edge) => selected.includes(edge.id))
              .flatMap((edge) =>
                (["from", "to"] as const).map((end) => {
                  const point = endpointPoint(shown, edge[end]);
                  return (
                    point && (
                      <circle
                        key={`${edge.id}:${end}`}
                        className="ef-tree-port"
                        cx={point.x}
                        cy={point.y}
                        r={7}
                        aria-label={`${text("Mover extremo", "Move endpoint")} ${end}`}
                        onPointerDown={(event) =>
                          startConnection(event, edge[end === "from" ? "to" : "from"], edge.id, end)
                        }
                      />
                    )
                  );
                }),
              )}
            {drag?.kind === "connection" &&
              (() => {
                const start = endpointPoint(shown, drag.from);
                return (
                  start && (
                    <line
                      className="ef-tree-connection-preview"
                      x1={start.x}
                      y1={start.y}
                      x2={drag.point.x}
                      y2={drag.point.y}
                    />
                  )
                );
              })()}
            {drag?.kind === "draw" && (
              <polyline
                points={drag.points.map((point) => `${point.x},${point.y}`).join(" ")}
                fill="none"
                stroke="#7d84db"
                strokeWidth={3}
              />
            )}
          </g>
        </svg>
        {!canvas.nodes.length && !canvas.annotations.length && (
          <div className="ef-visual-empty">
            {text(
              "Añade una persona para empezar. Arrastra entre puertos para conectar.",
              "Add a person to begin. Drag between ports to connect.",
            )}
          </div>
        )}
        <aside
          className="ef-visual-inspector"
          aria-label={text("Inspector del árbol", "Tree inspector")}
        >
          <h3>
            {selectedNode
              ? text("Persona", "Person")
              : selectedEdge
                ? text("Relación", "Relationship")
                : selectedAnnotation
                  ? text("Anotación", "Annotation")
                  : selectedGroup
                    ? text("Grupo", "Group")
                    : selectedDrawing
                      ? text("Dibujo", "Drawing")
                      : text("Árbol", "Tree")}
          </h3>
          {selectedNode && (
            <>
              <label>
                {text("Nombre", "Name")}
                <input
                  value={selectedNode.name}
                  onChange={(event) => changeNode({ name: event.target.value })}
                />
              </label>
              <label>
                {text("Vincular ficha", "Link card")}
                <select
                  value={selectedNode.reference || ""}
                  onChange={(event) =>
                    changeNode({
                      reference: event.target.value || undefined,
                      name:
                        selectedNode.name === text("Persona", "Person")
                          ? vaultIndex?.entities.find((entity) => entity.id === event.target.value)
                              ?.name || selectedNode.name
                          : selectedNode.name,
                    })
                  }
                >
                  <option value="">{text("Persona independiente", "Independent person")}</option>
                  {selectedNode.reference &&
                    !vaultIndex?.entities.some(
                      (entity) => entity.id === selectedNode.reference,
                    ) && <option value={selectedNode.reference}>{selectedNode.reference}</option>}
                  {vaultIndex?.entities.map((entity) => (
                    <option key={entity.path} value={entity.id}>
                      {entity.name} · {entity.path}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {text("Referencia / variante", "Reference / variant")}
                <input
                  value={selectedNode.reference || ""}
                  placeholder="id@variant"
                  onChange={(event) => changeNode({ reference: event.target.value || undefined })}
                />
              </label>
              {referenceResolution?.diagnostic && (
                <p role="status" className="ef-visual-diagnostic">
                  {text("Referencia", "Reference")}:{" "}
                  {referenceResolution.diagnostic === "ambiguous"
                    ? text("ambigua; usa la ruta de la ficha.", "ambiguous; use the card path.")
                    : referenceResolution.diagnostic === "missing-variant"
                      ? text("variante inexistente.", "missing variant.")
                      : text("no encontrada.", "not found.")}
                </p>
              )}
              <button
                type="button"
                disabled={!selectedNode.reference || Boolean(referenceResolution?.diagnostic)}
                onClick={() => onOpenReference?.(selectedNode.reference!)}
              >
                <ExternalLink size={14} />
                {text("Abrir ficha al lado", "Open card alongside")}
              </button>
              <label>
                {text("Retrato (ruta o URL)", "Portrait (path or URL)")}
                <input
                  value={selectedNode.portrait || ""}
                  onChange={(event) => changeNode({ portrait: event.target.value || undefined })}
                />
              </label>
              <label className="ef-visual-check">
                <input
                  type="checkbox"
                  checked={Boolean(selectedNode.deceased)}
                  onChange={(event) => changeNode({ deceased: event.target.checked })}
                />
                {text("Fallecido", "Deceased")}
              </label>
              <p className="ef-visual-hint">
                {text(
                  "Doble clic en un puerto añade una persona conectada.",
                  "Double-click a port to add a connected person.",
                )}
              </p>
            </>
          )}
          {selectedEdge && (
            <>
              <label>
                {text("Tipo", "Type")}
                <select
                  value={selectedEdge.typeId}
                  onChange={(event) =>
                    commit(
                      {
                        ...canvas,
                        edges: canvas.edges.map((edge) =>
                          edge.id === selectedEdge.id
                            ? { ...edge, typeId: event.target.value }
                            : edge,
                        ),
                      },
                      text("Editar relación", "Edit relationship"),
                    )
                  }
                >
                  {document.relationshipTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {(es && RELATION_ES[type.id]) || type.name}
                    </option>
                  ))}
                </select>
              </label>
              {(["label", "icon", "color"] as const).map((key) => (
                <label key={key}>
                  {key === "label"
                    ? text("Etiqueta", "Label")
                    : key === "icon"
                      ? text("Icono", "Icon")
                      : "Color"}
                  <input
                    type={key === "color" ? "color" : "text"}
                    value={
                      selectedEdge[key] ||
                      (key === "color" ? selectedEdgeType?.color || "#8890a2" : "")
                    }
                    onChange={(event) =>
                      commit(
                        {
                          ...canvas,
                          edges: canvas.edges.map((edge) =>
                            edge.id === selectedEdge.id
                              ? { ...edge, [key]: event.target.value }
                              : edge,
                          ),
                        },
                        text("Editar relación", "Edit relationship"),
                      )
                    }
                  />
                </label>
              ))}
              <label>
                {text("Línea", "Line")}
                <select
                  value={selectedEdge.style || selectedEdgeType?.style || "solid"}
                  onChange={(event) =>
                    commit(
                      {
                        ...canvas,
                        edges: canvas.edges.map((edge) =>
                          edge.id === selectedEdge.id
                            ? {
                                ...edge,
                                style: event.target.value as "solid" | "dashed" | "dotted",
                              }
                            : edge,
                        ),
                      },
                      text("Editar relación", "Edit relationship"),
                    )
                  }
                >
                  <option value="solid">{text("Sólida", "Solid")}</option>
                  <option value="dashed">{text("Discontinua", "Dashed")}</option>
                  <option value="dotted">{text("Punteada", "Dotted")}</option>
                </select>
              </label>
              <p className="ef-visual-hint">
                {text(
                  "Arrastra los extremos a otro puerto o a una conexión para crear una unión.",
                  "Drag endpoints to another port or onto a connection to create a junction.",
                )}
              </p>
            </>
          )}
          {selectedAnnotation && (
            <>
              <label>
                {text("Texto", "Text")}
                <textarea
                  value={selectedAnnotation.text}
                  onChange={(event) =>
                    commit(
                      {
                        ...canvas,
                        annotations: canvas.annotations.map((note) =>
                          note.id === selectedAnnotation.id
                            ? { ...note, text: event.target.value }
                            : note,
                        ),
                      },
                      text("Editar anotación", "Edit annotation"),
                    )
                  }
                />
              </label>
              <label>
                Color
                <input
                  type="color"
                  value={selectedAnnotation.color || "#e7d898"}
                  onChange={(event) =>
                    commit(
                      {
                        ...canvas,
                        annotations: canvas.annotations.map((note) =>
                          note.id === selectedAnnotation.id
                            ? { ...note, color: event.target.value }
                            : note,
                        ),
                      },
                      text("Editar anotación", "Edit annotation"),
                    )
                  }
                />
              </label>
            </>
          )}
          {selectedGroup && (
            <>
              <label>
                {text("Nombre del grupo", "Group name")}
                <input
                  value={selectedGroup.name}
                  onChange={(event) =>
                    commit(
                      {
                        ...canvas,
                        groups: canvas.groups.map((group) =>
                          group.id === selectedGroup.id
                            ? { ...group, name: event.target.value }
                            : group,
                        ),
                      },
                      text("Editar grupo", "Edit group"),
                    )
                  }
                />
              </label>
              <label>
                Color
                <input
                  type="color"
                  value={selectedGroup.color || "#7d84db"}
                  onChange={(event) =>
                    commit(
                      {
                        ...canvas,
                        groups: canvas.groups.map((group) =>
                          group.id === selectedGroup.id
                            ? { ...group, color: event.target.value }
                            : group,
                        ),
                      },
                      text("Editar grupo", "Edit group"),
                    )
                  }
                />
              </label>
              {(["width", "height"] as const).map((key) => (
                <label key={key}>
                  {key === "width" ? text("Ancho", "Width") : text("Alto", "Height")}
                  <input
                    type="number"
                    min={50}
                    value={selectedGroup[key]}
                    onChange={(event) =>
                      commit(
                        {
                          ...canvas,
                          groups: canvas.groups.map((group) =>
                            group.id === selectedGroup.id
                              ? { ...group, [key]: Math.max(50, Number(event.target.value) || 50) }
                              : group,
                          ),
                        },
                        text("Redimensionar grupo", "Resize group"),
                      )
                    }
                  />
                </label>
              ))}
            </>
          )}
          {selectedDrawing && (
            <>
              <label>
                Color
                <input
                  type="color"
                  value={selectedDrawing.color}
                  onChange={(event) =>
                    commit(
                      {
                        ...canvas,
                        drawings: canvas.drawings.map((drawing) =>
                          drawing.id === selectedDrawing.id
                            ? { ...drawing, color: event.target.value }
                            : drawing,
                        ),
                      },
                      text("Editar dibujo", "Edit drawing"),
                    )
                  }
                />
              </label>
              <label>
                {text("Grosor", "Width")}
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={selectedDrawing.width}
                  onChange={(event) =>
                    commit(
                      {
                        ...canvas,
                        drawings: canvas.drawings.map((drawing) =>
                          drawing.id === selectedDrawing.id
                            ? {
                                ...drawing,
                                width: Math.min(30, Math.max(1, Number(event.target.value) || 1)),
                              }
                            : drawing,
                        ),
                      },
                      text("Editar dibujo", "Edit drawing"),
                    )
                  }
                />
              </label>
            </>
          )}
          {selected.length > 0 && (
            <button type="button" onClick={remove}>
              <Trash2 size={14} />
              {text("Eliminar selección", "Delete selection")}
            </button>
          )}
          <label>
            {text("Etiquetas", "Labels")}
            <select
              value={labelMode}
              onChange={(event) => setLabelMode(event.target.value as "always" | "hover")}
            >
              <option value="always">{text("Siempre", "Always")}</option>
              <option value="hover">{text("Al pasar el cursor", "On hover")}</option>
            </select>
          </label>
          <details>
            <summary>{text("Variantes completas", "Complete variants")}</summary>
            <label>
              {text("Nombre de esta variante", "This variant's name")}
              <input
                value={canvas.name}
                onChange={(event) =>
                  commit(
                    { ...canvas, name: event.target.value },
                    text("Renombrar variante", "Rename variant"),
                  )
                }
              />
            </label>
            <label>
              {text("Nueva variante", "New variant")}
              <input
                value={variantName}
                onChange={(event) => {
                  setVariantName(event.target.value);
                  updateSession({
                    drafts: composerDrafts(
                      "tree-variant",
                      event.target.value,
                      text("Nueva variante del árbol", "New tree variant"),
                    ),
                  });
                }}
              />
            </label>
            <button
              type="button"
              disabled={!variantName.trim()}
              onClick={() => {
                const id = treeId();
                onChange(
                  cloneTreeVariant(document, variantId, id, variantName.trim()),
                  text("Duplicar variante", "Duplicate variant"),
                );
                updateSession({
                  variantId: id,
                  selectedIds: [],
                  drafts: composerDrafts("tree-variant", "", ""),
                });
                setVariantName("");
              }}
            >
              {text("Duplicar canvas actual", "Duplicate current canvas")}
            </button>
            <button
              type="button"
              disabled={!variantName.trim()}
              onClick={() => {
                const id = treeId();
                onChange(
                  {
                    ...document,
                    variants: {
                      ...document.variants,
                      [id]: createRelationshipCanvas(id, variantName.trim()),
                    },
                  },
                  text("Crear variante", "Create variant"),
                );
                updateSession({
                  variantId: id,
                  selectedIds: [],
                  drafts: composerDrafts("tree-variant", "", ""),
                });
                setVariantName("");
              }}
            >
              {text("Crear canvas vacío", "Create empty canvas")}
            </button>
            <button
              type="button"
              disabled={Object.keys(document.variants).length < 2}
              onClick={() => {
                const variants = { ...document.variants };
                delete variants[variantId];
                onChange({ ...document, variants }, text("Eliminar variante", "Delete variant"));
                updateSession({ variantId: Object.keys(variants)[0], selectedIds: [] });
              }}
            >
              {text("Eliminar variante actual", "Delete current variant")}
            </button>
          </details>
          <details>
            <summary>{text("Relaciones personalizadas", "Custom relationships")}</summary>
            <label>
              {text("Nombre de relación", "Relationship name")}
              <input
                value={newTypeName}
                onChange={(event) => {
                  setNewTypeName(event.target.value);
                  updateSession({
                    drafts: composerDrafts(
                      "tree-relationship-type",
                      event.target.value,
                      text("Nueva relación personalizada", "New custom relationship"),
                    ),
                  });
                }}
              />
            </label>
            <button
              type="button"
              disabled={!newTypeName.trim()}
              onClick={() => {
                const id = treeId();
                onChange(
                  {
                    ...document,
                    relationshipTypes: [
                      ...document.relationshipTypes,
                      { id, name: newTypeName.trim() },
                    ],
                  },
                  text("Crear tipo de relación", "Create relationship type"),
                );
                setRelationshipType(id);
                updateSession({ drafts: composerDrafts("tree-relationship-type", "", "") });
                setNewTypeName("");
              }}
            >
              {text("Crear relación", "Create relationship")}
            </button>
            {document.relationshipTypes
              .filter((type) => !RELATION_ES[type.id])
              .map((type) => (
                <div className="ef-visual-custom-type" key={type.id}>
                  <input
                    aria-label={text("Nombre de relación", "Relationship name")}
                    value={type.name}
                    onChange={(event) =>
                      onChange(
                        {
                          ...document,
                          relationshipTypes: document.relationshipTypes.map((item) =>
                            item.id === type.id ? { ...item, name: event.target.value } : item,
                          ),
                        },
                        text("Editar tipo", "Edit type"),
                      )
                    }
                  />
                  <input
                    aria-label={text("Icono de relación", "Relationship icon")}
                    value={type.icon || ""}
                    onChange={(event) =>
                      onChange(
                        {
                          ...document,
                          relationshipTypes: document.relationshipTypes.map((item) =>
                            item.id === type.id ? { ...item, icon: event.target.value } : item,
                          ),
                        },
                        text("Editar tipo", "Edit type"),
                      )
                    }
                  />
                  <select
                    aria-label={text("Estilo de relación", "Relationship style")}
                    value={type.style || "solid"}
                    onChange={(event) =>
                      onChange(
                        {
                          ...document,
                          relationshipTypes: document.relationshipTypes.map((item) =>
                            item.id === type.id
                              ? {
                                  ...item,
                                  style: event.target.value as "solid" | "dashed" | "dotted",
                                }
                              : item,
                          ),
                        },
                        text("Editar tipo", "Edit type"),
                      )
                    }
                  >
                    <option value="solid">{text("Sólida", "Solid")}</option>
                    <option value="dashed">{text("Discontinua", "Dashed")}</option>
                    <option value="dotted">{text("Punteada", "Dotted")}</option>
                  </select>
                  <input
                    aria-label={text("Color de relación", "Relationship color")}
                    type="color"
                    value={type.color || "#8890a2"}
                    onChange={(event) =>
                      onChange(
                        {
                          ...document,
                          relationshipTypes: document.relationshipTypes.map((item) =>
                            item.id === type.id ? { ...item, color: event.target.value } : item,
                          ),
                        },
                        text("Editar tipo", "Edit type"),
                      )
                    }
                  />
                </div>
              ))}
          </details>
        </aside>
      </div>
    </section>
  );
}
