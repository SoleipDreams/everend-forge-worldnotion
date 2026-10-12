import type { VaultIndex } from "../domain";
import type { TimelineDocument } from "./timelineTypes";
import type { RelationshipTreeDocument } from "./relationshipTypes";

export type { TimelineDocument } from "./timelineTypes";
export type { RelationshipTreeDocument } from "./relationshipTypes";
export type VisualDocument = TimelineDocument | RelationshipTreeDocument;
export type VisualDocumentKind = VisualDocument["kind"];

/** Transient, per-user presentation. Never part of forgeView or runtime exports. */
export type VisualDocumentSession = {
  drafts?: Record<string, { value: unknown; label: string }>;
  viewport?: { x: number; y: number; zoom: number };
  selectedIds?: string[];
  variantId?: string;
  activeViewId?: string;
  timelineScale?: { origin: string; ticksPerUnit: string };
  timelineFilters?: { tags: string[]; kinds: ("event" | "period")[]; search: string };
};

export type VisualDocumentEditorProps<T extends VisualDocument> = {
  document: T;
  onChange: (next: T, label?: string) => void;
  vaultIndex?: VaultIndex;
  onOpenReference?: (ref: string) => void;
  session?: VisualDocumentSession;
  onSessionChange?: (next: VisualDocumentSession) => void;
  active?: boolean;
  locale?: "en" | "es";
};
