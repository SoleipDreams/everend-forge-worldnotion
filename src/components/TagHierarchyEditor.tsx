import { useState } from "react";
import { ChevronRight, ChevronDown, Plus, Edit2, Trash2 } from "lucide-react";
import type { TagHierarchyNode } from "../editorTypes";
import { useAppDialogs } from "./DialogProvider";

type TagHierarchyEditorProps = {
  locale?: "en" | "es";
  nodes: TagHierarchyNode[];
  onChange: (nodes: TagHierarchyNode[]) => void;
};

type TagNodeItemProps = {
  locale?: "en" | "es";
  node: TagHierarchyNode;
  depth: number;
  onUpdate: (node: TagHierarchyNode) => void;
  onDelete: (nodeId: string) => void;
  onAddChild: (parentId: string) => void;
};

function TagNodeItem({ node, depth, onUpdate, onDelete, onAddChild, locale = "en" }: TagNodeItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(node.label);
  const [color, setColor] = useState(node.color ?? "");

  const handleSave = () => {
    onUpdate({
      ...node,
      label: label.trim() || node.label,
      color: color.trim() || undefined,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setLabel(node.label);
    setColor(node.color ?? "");
    setIsEditing(false);
  };

  return (
    <div className="tag-node-item" style={{ paddingLeft: `${depth * 16}px` }}>
      <div className="tag-node-header">
        {node.children.length > 0 && (
          <button
            type="button"
            className="tag-node-toggle"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? (locale === "es" ? "Contraer" : "Collapse") : (locale === "es" ? "Expandir" : "Expand")}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}

        {isEditing ? (
          <div className="tag-node-edit">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={(locale === "es" ? "Nombre de etiqueta" : "Tag label")}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") { e.stopPropagation(); handleCancel(); }
              }}
            />
            <input
              type="color"
              value={color || "#6b7280"}
              onChange={(e) => setColor(e.target.value)}
              title={(locale === "es" ? "Color de etiqueta" : "Tag color")}
            />
            <button type="button" onClick={handleSave}>
              {locale === "es" ? "Guardar etiqueta" : "Save tag"}
            </button>
            <button type="button" onClick={handleCancel}>
              {locale === "es" ? "Cancelar" : "Cancel"}
            </button>
          </div>
        ) : (
          <>
            <div className="tag-node-info">
              {node.color && (
                <span className="tag-color-indicator" style={{ backgroundColor: node.color }} />
              )}
              <span className="tag-node-label">{node.label}</span>
              <span className="tag-node-path">{node.fullPath}</span>
            </div>
            <div className="tag-node-actions">
              <button type="button" onClick={() => onAddChild(node.id)} title={locale === "es" ? "Añadir etiqueta hija" : "Add child tag"}>
                <Plus size={14} />
              </button>
              <button type="button" onClick={() => setIsEditing(true)} title={locale === "es" ? "Editar etiqueta" : "Edit tag"}>
                <Edit2 size={14} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(node.id)}
                title={locale === "es" ? "Eliminar etiqueta" : "Delete tag"}
                className="danger"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </>
        )}
      </div>

      {isExpanded && node.children.length > 0 && (
        <div className="tag-node-children">
          {node.children.map((child) => (
            <TagNodeItem locale={locale}
              key={child.id}
              node={child}
              depth={depth + 1}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TagHierarchyEditor({ nodes, onChange, locale = "en" }: TagHierarchyEditorProps) {
  const { confirmDialog, promptDialog } = useAppDialogs();
  const [newTagLabel, setNewTagLabel] = useState("");

  const findNodeById = (nodes: TagHierarchyNode[], id: string): TagHierarchyNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
    return null;
  };

  const updateNodeInTree = (
    nodes: TagHierarchyNode[],
    nodeId: string,
    updater: (node: TagHierarchyNode) => TagHierarchyNode,
  ): TagHierarchyNode[] => {
    return nodes.map((node) => {
      if (node.id === nodeId) {
        return updater(node);
      }
      if (node.children.length > 0) {
        return {
          ...node,
          children: updateNodeInTree(node.children, nodeId, updater),
        };
      }
      return node;
    });
  };

  const deleteNodeFromTree = (nodes: TagHierarchyNode[], nodeId: string): TagHierarchyNode[] => {
    return nodes
      .filter((node) => node.id !== nodeId)
      .map((node) => ({
        ...node,
        children: deleteNodeFromTree(node.children, nodeId),
      }));
  };

  const handleUpdateNode = (updatedNode: TagHierarchyNode) => {
    onChange(updateNodeInTree(nodes, updatedNode.id, () => updatedNode));
  };

  const handleDeleteNode = async (nodeId: string) => {
    const confirmed = await confirmDialog((locale === "es" ? "¿Eliminar esta etiqueta y sus etiquetas hijas?" : "Delete this tag and all its children?"), {
      title: (locale === "es" ? "Eliminar etiqueta" : "Delete tag"),
      confirmLabel: (locale === "es" ? "Eliminar" : "Delete"),
      destructive: true,
    });
    if (confirmed) {
      onChange(deleteNodeFromTree(nodes, nodeId));
    }
  };

  const handleAddChild = async (parentId: string) => {
    const parent = findNodeById(nodes, parentId);
    if (!parent) return;

    const childLabel = await promptDialog((locale === "es" ? "Introduce el nombre de la etiqueta:" : "Enter new tag label:"), (locale === "es" ? "Nombre de etiqueta" : "tag label"));
    if (!childLabel?.trim()) return;

    const newChild: TagHierarchyNode = {
      id: `${parentId}-${childLabel.toLowerCase().replace(/\s+/g, "-")}`,
      label: childLabel.trim(),
      fullPath: `${parent.fullPath}/${childLabel.trim()}`,
      children: [],
      parentId: parentId,
    };

    onChange(
      updateNodeInTree(nodes, parentId, (node) => ({
        ...node,
        children: [...node.children, newChild],
      })),
    );
  };

  const handleAddRoot = () => {
    if (!newTagLabel.trim()) return;

    const newRoot: TagHierarchyNode = {
      id: newTagLabel.toLowerCase().replace(/\s+/g, "-"),
      label: newTagLabel.trim(),
      fullPath: newTagLabel.trim(),
      children: [],
    };

    onChange([...nodes, newRoot]);
    setNewTagLabel("");
  };

  return (
    <div className="tag-hierarchy-editor">
      <div className="tag-hierarchy-add-root">
        <input
          type="text"
          aria-label={locale === "es" ? "Nueva etiqueta raíz" : "New root tag"}
          data-setting-id="worldnotion.properties.hierarchy"
          value={newTagLabel}
          onChange={(e) => setNewTagLabel(e.target.value)}
          placeholder={locale === "es" ? "Nueva etiqueta raíz…" : "New root tag..."}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAddRoot();
          }}
        />
        <button type="button" onClick={handleAddRoot} disabled={!newTagLabel.trim()}>
          <Plus size={14} />
          {locale === "es" ? "Añadir etiqueta raíz" : "Add Root Tag"}
        </button>
      </div>

      {nodes.length === 0 ? (
        <p className="taxonomy-placeholder">
          {locale === "es" ? "No hay etiquetas. Añade una etiqueta raíz o activa la detección automática." : "No tags defined yet. Add a root tag or enable auto-detection."}
        </p>
      ) : (
        <div className="tag-hierarchy-tree">
          {nodes.map((node) => (
            <TagNodeItem locale={locale}
              key={node.id}
              node={node}
              depth={0}
              onUpdate={handleUpdateNode}
              onDelete={handleDeleteNode}
              onAddChild={handleAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}
