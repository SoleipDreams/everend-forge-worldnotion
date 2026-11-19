import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Search, X } from "lucide-react";
import type { VaultIndex } from "../domain";
import { useWorldnotionUi } from "../i18n";
import { useAppIsActive, focusAppElement } from "../hooks/useAppInteraction";
import { useModalFocus } from "../hooks/useModalFocus";
import { pathName } from "../utils/pathUtils";
import { isImagePath, useVaultImage } from "../utils/vaultImages";
import "../App.css";

type ImageRelinkDialogProps = {
  index: VaultIndex;
  sourcePath: string;
  referenceCount: number;
  documentCount: number;
  onClose: () => void;
  onRelink: (targetPath: string) => Promise<void>;
};

function RelinkImageThumbnail({ index, path }: { index: VaultIndex; path: string }) {
  const itemRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");
  const { url, error } = useVaultImage(visible ? index : undefined, path);

  useEffect(() => {
    if (visible || !itemRef.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" },
    );
    observer.observe(itemRef.current);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <span ref={itemRef} className="image-relink-thumbnail" aria-hidden="true">
      {url && !error ? <img src={url} alt="" loading="lazy" /> : <Image size={18} />}
    </span>
  );
}

export function ImageRelinkDialog({
  index,
  sourcePath,
  referenceCount,
  documentCount,
  onClose,
  onRelink,
}: ImageRelinkDialogProps) {
  const ui = useWorldnotionUi();
  const appActive = useAppIsActive();
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState("");
  const [selectedPath, setSelectedPath] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useModalFocus(dialogRef, true);

  useEffect(() => {
    if (appActive) focusAppElement(closeRef.current);
  }, [appActive]);

  const candidates = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return index.files
      .filter((file) => isImagePath(file.relativePath) && file.relativePath !== sourcePath)
      .filter(
        (file) =>
          !normalizedQuery || file.relativePath.toLocaleLowerCase().includes(normalizedQuery),
      )
      .sort((first, second) => first.relativePath.localeCompare(second.relativePath));
  }, [index.files, query, sourcePath]);

  async function submit() {
    if (!selectedPath || submitting || referenceCount === 0) return;
    setSubmitting(true);
    try {
      await onRelink(selectedPath);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="modal-overlay image-relink-overlay"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="modal-dialog image-relink-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={ui.imageRelinkTitle}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !submitting) onClose();
        }}
      >
        <header className="modal-header image-preview-header image-relink-header">
          <div>
            <h2>{ui.imageRelinkTitle}</h2>
            <p>{ui.imageRelinkDescription}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="image-preview-close"
            aria-label={ui.close}
            onClick={() => {
              if (!submitting) onClose();
            }}
            disabled={submitting}
          >
            <X size={18} />
          </button>
        </header>

        <div className="image-relink-source">
          <span className="image-relink-source-label">{ui.imageRelinkCurrent}</span>
          <RelinkImageThumbnail index={index} path={sourcePath} />
          <span className="image-relink-source-details">
            <strong>{pathName(sourcePath)}</strong>
            <small>{sourcePath}</small>
          </span>
        </div>

        <div className="image-relink-body">
          <div className="image-relink-section-heading">
            <strong>{ui.imageRelinkReplacement}</strong>
            {referenceCount ? (
              <span>
                {referenceCount}{" "}
                {referenceCount === 1
                  ? ui.imageRelinkReference
                  : ui.imageRelinkReferences.toLocaleLowerCase()}
                {documentCount
                  ? ` · ${documentCount} ${documentCount === 1 ? ui.imageRelinkDocument : ui.imageRelinkDocuments.toLocaleLowerCase()}`
                  : ""}
              </span>
            ) : (
              <span>{ui.imageRelinkNoReferences}</span>
            )}
          </div>
          <label className="image-relink-search">
            <Search size={15} aria-hidden="true" />
            <input
              autoFocus
              type="search"
              value={query}
              placeholder={ui.imageRelinkSearch}
              aria-label={ui.imageRelinkSearch}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          {candidates.length ? (
            <div
              className="image-relink-options"
              role="listbox"
              aria-label={ui.imageRelinkReplacement}
            >
              {candidates.map((file) => (
                <button
                  key={file.relativePath}
                  type="button"
                  role="option"
                  aria-selected={selectedPath === file.relativePath}
                  className={`image-relink-option ${selectedPath === file.relativePath ? "active" : ""}`}
                  onClick={() => setSelectedPath(file.relativePath)}
                >
                  <RelinkImageThumbnail index={index} path={file.relativePath} />
                  <span className="image-relink-option-details">
                    <strong>{pathName(file.relativePath)}</strong>
                    <small>{file.relativePath}</small>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="image-relink-empty">{ui.imageRelinkNoImages}</p>
          )}
          {!selectedPath && candidates.length ? (
            <p className="image-relink-hint">{ui.imageRelinkChoose}</p>
          ) : null}
        </div>

        <footer className="modal-footer image-relink-footer">
          <button
            type="button"
            className="btn modal-button"
            onClick={onClose}
            disabled={submitting}
          >
            {ui.cancel}
          </button>
          <button
            type="button"
            className="btn btn-primary modal-button"
            onClick={() => void submit()}
            disabled={!selectedPath || submitting || referenceCount === 0}
          >
            {submitting ? ui.imageRelinkWorking : ui.imageRelinkConfirm}
          </button>
        </footer>
      </section>
    </div>
  );
}
