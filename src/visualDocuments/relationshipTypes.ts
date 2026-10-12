export type TreePoint = { x: number; y: number };
export type TreePort = "top" | "right" | "bottom" | "left";
export type TreeEndpoint =
  | { kind: "node"; nodeId: string; port: TreePort }
  | { kind: "junction"; edgeId: string; t: number };
export type RelationshipPerson = {
  id: string;
  name: string;
  x: number;
  y: number;
  reference?: string;
  portrait?: string;
  deceased?: boolean;
  [key: string]: unknown;
};
export type RelationshipEdge = {
  id: string;
  from: TreeEndpoint;
  to: TreeEndpoint;
  typeId: string;
  label?: string;
  icon?: string;
  color?: string;
  style?: "solid" | "dashed" | "dotted";
  [key: string]: unknown;
};
export type RelationshipType = {
  id: string;
  name: string;
  icon?: string;
  style?: "solid" | "dashed" | "dotted";
  color?: string;
  [key: string]: unknown;
};
export type TreeAnnotation = {
  id: string;
  kind: "note" | "text";
  text: string;
  x: number;
  y: number;
  color?: string;
  width?: number;
  [key: string]: unknown;
};
export type TreeGroup = {
  id: string;
  name: string;
  nodeIds: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  [key: string]: unknown;
};
export type TreeDrawing = {
  id: string;
  points: TreePoint[];
  color: string;
  width: number;
  [key: string]: unknown;
};
export type RelationshipCanvas = {
  id: string;
  name: string;
  nodes: RelationshipPerson[];
  edges: RelationshipEdge[];
  annotations: TreeAnnotation[];
  groups: TreeGroup[];
  drawings: TreeDrawing[];
  [key: string]: unknown;
};
/** This payload is stored literally under forgeView, separate from canon variants. */
export type RelationshipTreeDocument = {
  version: 1;
  kind: "relationships";
  id: string;
  variants: Record<string, RelationshipCanvas>;
  relationshipTypes: RelationshipType[];
  [key: string]: unknown;
};
export type RelationshipDocument = RelationshipTreeDocument;
