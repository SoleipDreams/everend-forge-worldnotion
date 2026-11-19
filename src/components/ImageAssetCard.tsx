import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ChevronDown, Image, Link2, MoreHorizontal } from "lucide-react";
import type { VaultIndex } from "../domain";
import { pathName } from "../utils/pathUtils";
import type { ImageUsage } from "../utils/imageRelinking";
import { useVaultImage } from "../utils/vaultImages";

type ImageUsageLabels = {
  unused: string;
  note: string;
  notes: string;
  reference: string;
  references: string;
  variant: string;
  variants: string;
  showLocations: string;
  hideLocations: string;
  worldNotion: string;
  noReferences: string;
  pathBranching: string;
};

type ImageAssetCardProps = {
  index: VaultIndex;
  path: string;
  selected: boolean;
  layout?: "gallery" | "list";
  manageLabel: string;
  usage?: ImageUsage;
  usageLabels: ImageUsageLabels;
  onSelect: (path: string) => void;
  onContextMenu: (event: MouseEvent, path: string, kind: "file") => void;
};

export function ImageAssetCard({
  index,
  path,
  selected,
  layout = "gallery",
  manageLabel,
  usage = {
    referenceCount: 0,
    documentPaths: [],
    variantReferenceCount: 0,
    pathBranchingReferenceCount: 0,
    pathBranchingVariantReferenceCount: 0,
    pathBranchingLocations: [],
  },
  usageLabels,
  onSelect,
  onContextMenu,
}: ImageAssetCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");
  const [usageOpen, setUsageOpen] = useState(false);
  const { url, error } = useVaultImage(visible ? index : undefined, path);

  useEffect(() => {
    if (visible || !cardRef.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "120px" },
    );
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [visible]);

  const name = pathName(path);
  const usageSummaryParts = [];
  if (usage.documentPaths.length) {
    usageSummaryParts.push(
      `${usage.documentPaths.length} ${usage.documentPaths.length === 1 ? usageLabels.note : usageLabels.notes} · ${usage.referenceCount} ${usage.referenceCount === 1 ? usageLabels.reference : usageLabels.references}`,
    );
  }
  if (usage.variantReferenceCount) {
    usageSummaryParts.push(
      `${usage.variantReferenceCount} ${usage.variantReferenceCount === 1 ? usageLabels.variant : usageLabels.variants}`,
    );
  }
  if (usage.pathBranchingReferenceCount) {
    const variantUsage = usage.pathBranchingVariantReferenceCount
      ? ` (${usage.pathBranchingVariantReferenceCount} ${usage.pathBranchingVariantReferenceCount === 1 ? usageLabels.variant : usageLabels.variants})`
      : "";
    usageSummaryParts.push(
      `${usageLabels.pathBranching}: ${usage.pathBranchingReferenceCount}${variantUsage}`,
    );
  }
  const usageSummary = usageSummaryParts.length ? usageSummaryParts.join(" · ") : usageLabels.unused;

  return (
    <article
      ref={cardRef}
      className={`image-asset-card ${layout === "list" ? "image-asset-row" : ""} ${selected ? "active" : ""}`}
      onContextMenu={(event) => onContextMenu(event, path, "file")}
    >
      <button
        type="button"
        className="image-asset-card-open"
        aria-label={name}
        aria-pressed={selected}
        title={path}
        onClick={() => onSelect(path)}
      >
        <span className="image-asset-card-media" aria-hidden="true">
          {url && !error ? <img src={url} alt="" loading="lazy" /> : <Image size={22} />}
        </span>
        <span className="image-asset-card-details">
          <span className="image-asset-card-name">{name}</span>
          <span className="image-asset-card-path">{path}</span>
        </span>
      </button>
      <div className="image-asset-card-usage">
        <button
          type="button"
          className="image-asset-card-usage-toggle"
          aria-label={usageOpen ? usageLabels.hideLocations : usageLabels.showLocations}
          aria-expanded={usageOpen}
          onClick={() => setUsageOpen((open) => !open)}
        >
          <Link2 size={12} />
          <span>{usageSummary}</span>
          <ChevronDown size={12} className={usageOpen ? "is-open" : ""} />
        </button>
        {usageOpen ? (
          <div className="image-asset-card-usage-details">
            {usage.documentPaths.length ? (
              <>
                <span className="image-asset-card-usage-heading">{usageLabels.worldNotion}</span>
                {usage.documentPaths.map((documentPath) => (
                  <button
                    key={documentPath}
                    type="button"
                    className="image-asset-card-usage-document"
                    title={documentPath}
                    onClick={() => onSelect(documentPath)}
                  >
                    {documentPath}
                  </button>
                ))}
              </>
            ) : null}
            {usage.pathBranchingLocations.length ? (
              <>
                <span className="image-asset-card-usage-heading">{usageLabels.pathBranching}</span>
                {usage.pathBranchingLocations.map((location) => (
                  <span
                    key={location}
                    className="image-asset-card-usage-location"
                    title={location}
                  >
                    {location}
                  </span>
                ))}
              </>
            ) : null}
            {!usage.documentPaths.length && !usage.pathBranchingLocations.length ? (
              <span className="image-asset-card-usage-empty">{usageLabels.noReferences}</span>
            ) : null}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="image-asset-card-manage"
        aria-label={manageLabel.replace("{{name}}", name)}
        title={manageLabel.replace("{{name}}", name)}
        onClick={(event) => onContextMenu(event, path, "file")}
      >
        <MoreHorizontal size={16} />
      </button>
    </article>
  );
}
