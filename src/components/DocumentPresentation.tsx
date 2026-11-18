import { ImagePlus, Trash2 } from "lucide-react";
import type { VaultIndex } from "../domain";
import { useVaultImage } from "../utils/vaultImages";

export type PresentationImageLabels = {
  addPortrait: string;
  changePortrait: string;
  removePortrait: string;
  addCover: string;
  changeCover: string;
  removeCover: string;
  actions: string;
};

type DocumentPresentationProps = {
  vaultIndex: VaultIndex;
  name: string;
  typeLabel: string;
  hasPortrait?: boolean;
  hasPortraitRole?: boolean;
  hasCoverRole?: boolean;
  portraitPath?: string;
  coverPath?: string;
  imageLabels?: PresentationImageLabels;
  onChoosePortrait?: () => void | Promise<void>;
  onRemovePortrait?: () => void;
  onChooseCover?: () => void | Promise<void>;
  onRemoveCover?: () => void;
  onDocumentNameChange?: (newName: string) => Promise<void> | void;
};

/** Cover presentation only; the entity title and portrait live in the writing area. */
export function DocumentPresentation({
  vaultIndex,
  hasCoverRole,
  coverPath,
  imageLabels,
  onChooseCover,
  onRemoveCover,
}: DocumentPresentationProps) {
  const cover = useVaultImage(vaultIndex, coverPath ?? "");
  const showCoverRole = hasCoverRole ?? Boolean(coverPath);
  const showEmptyCover = showCoverRole && Boolean(onChooseCover) && !cover.url && !coverPath;
  const showCoverActions = showCoverRole && Boolean(onChooseCover) && Boolean(coverPath);
  if (!cover.url && !showEmptyCover && !showCoverActions) return null;

  return (
    <header
      className={`document-presentation${showEmptyCover ? " document-presentation-empty-cover" : ""}`}
      aria-label={imageLabels?.actions ?? "Document cover"}
    >
      {cover.url ? (
        <div className="document-presentation-cover">
          <img src={cover.url} alt="" />
        </div>
      ) : showEmptyCover ? (
        <button
          type="button"
          className="document-presentation-cover document-presentation-cover-empty"
          aria-label={imageLabels?.addCover ?? "Add banner"}
          title={imageLabels?.addCover ?? "Add banner"}
          onClick={() => void onChooseCover?.()}
        >
          <ImagePlus size={18} />
          <span>{imageLabels?.addCover ?? "Add banner"}</span>
        </button>
      ) : null}
      {imageLabels && showCoverActions && onChooseCover && coverPath ? (
        <div className="document-presentation-image-actions" aria-label={imageLabels.actions}>
          <div className="document-presentation-image-action">
            <button
              type="button"
              className="document-presentation-image-button"
              aria-label={coverPath ? imageLabels.changeCover : imageLabels.addCover}
              title={coverPath ? imageLabels.changeCover : imageLabels.addCover}
              onClick={() => void onChooseCover()}
            >
              <ImagePlus size={15} />
              <span>{coverPath ? imageLabels.changeCover : imageLabels.addCover}</span>
            </button>
            {coverPath && onRemoveCover ? (
              <button
                type="button"
                className="document-presentation-image-remove"
                aria-label={imageLabels.removeCover}
                title={imageLabels.removeCover}
                onClick={onRemoveCover}
              >
                <Trash2 size={14} />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}
