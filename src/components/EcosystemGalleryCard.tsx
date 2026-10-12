import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { FileText } from "lucide-react";
import type { Entity, VaultIndex } from "../domain";
import { getPresentationRoleValue } from "../utils/entityPresentation";
import { resolveNoteImagePath, useVaultImage } from "../utils/vaultImages";

type EcosystemGalleryCardProps = {
  index: VaultIndex;
  entity: Entity;
  typeLabel: string;
  color?: string;
  selected: boolean;
  onSelectPath: (path: string) => void;
  onContextMenu: (event: MouseEvent, path: string, kind: "file") => void;
};

/** A view of an indexed note. It adds no metadata or new document format. */
export function EcosystemGalleryCard({
  index,
  entity,
  typeLabel,
  color,
  selected,
  onSelectPath,
  onContextMenu,
}: EcosystemGalleryCardProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set());
  const paths = useMemo(() => {
    const resolveRole = (role: "portrait" | "cover") => {
      const value = getPresentationRoleValue(
        index.propertiesConfig,
        entity.type,
        entity.customProperties,
        role,
      );
      return value ? (resolveNoteImagePath(index, entity.path, value) ?? "") : "";
    };
    return { portrait: resolveRole("portrait"), cover: resolveRole("cover") };
  }, [entity.customProperties, entity.path, entity.type, index]);

  useEffect(() => {
    if (visible || !buttonRef.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "120px" },
    );
    observer.observe(buttonRef.current);
    return () => observer.disconnect();
  }, [visible]);

  const portrait = useVaultImage(visible ? index : undefined, paths.portrait);
  const cover = useVaultImage(visible ? index : undefined, paths.cover);
  const imageUrl = [portrait.url, cover.url].find((url) => url && !failedUrls.has(url));
  const initials = entity.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("");
  const statusLabel =
    index.propertiesConfig?.statuses.definitions.find((status) => status.id === entity.status)
      ?.label ?? entity.status;

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`ecosystem-gallery-card ${selected ? "active" : ""}`}
      style={color ? ({ "--entity-color": color } as CSSProperties) : undefined}
      aria-label={entity.name}
      aria-pressed={selected}
      title={entity.path}
      onClick={() => onSelectPath(entity.path)}
      onContextMenu={(event) => onContextMenu(event, entity.path, "file")}
    >
      <span className={`ecosystem-gallery-media ${imageUrl ? "has-image" : ""}`} aria-hidden="true">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            onError={() => setFailedUrls((current) => new Set([...current, imageUrl]))}
          />
        ) : (
          <span className="ecosystem-gallery-placeholder">
            {initials || <FileText size={24} />}
          </span>
        )}
      </span>
      <span className="ecosystem-gallery-details">
        <span className="ecosystem-gallery-name">{entity.name}</span>
        <span className="ecosystem-gallery-meta">
          <span>{typeLabel === "_untyped" ? "Sin tipo" : typeLabel}</span>
          {statusLabel ? <span className="ecosystem-gallery-status">{statusLabel}</span> : null}
        </span>
      </span>
    </button>
  );
}
