import { useEffect, useRef } from "react";
import type { ClipboardEvent, KeyboardEvent } from "react";
import type { VaultIndex } from "../domain";
import { useVaultImage } from "../utils/vaultImages";

type DocumentPresentationProps = {
  vaultIndex: VaultIndex;
  name: string;
  typeLabel: string;
  hasPortrait?: boolean;
  coverPath?: string;
  onDocumentNameChange?: (newName: string) => Promise<void> | void;
};

function insertPlainTextAtSelection(element: HTMLElement, text: string) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) {
    element.append(document.createTextNode(text));
    return;
  }
  const range = selection.getRangeAt(0);
  if (!element.contains(range.commonAncestorContainer)) return;
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function EditablePresentationTitle({
  name,
  onDocumentNameChange,
}: {
  name: string;
  onDocumentNameChange?: (newName: string) => Promise<void> | void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const originalNameRef = useRef(name);
  const savingRef = useRef(false);

  useEffect(() => {
    const title = titleRef.current;
    if (!title || document.activeElement === title) return;
    title.textContent = name;
    originalNameRef.current = name;
    delete title.dataset.error;
    title.removeAttribute("title");
  }, [name]);

  const finishEditing = async () => {
    const title = titleRef.current;
    if (!title || savingRef.current) return false;

    const newName = (title.textContent ?? "").replace(/[\r\n]+/g, " ").trim();
    title.textContent = newName;
    if (!newName) {
      title.dataset.error = "true";
      title.title = "Document name cannot be empty.";
      window.requestAnimationFrame(() => title.focus());
      return false;
    }
    if (newName === originalNameRef.current || !onDocumentNameChange) return true;

    savingRef.current = true;
    title.setAttribute("aria-busy", "true");
    delete title.dataset.error;
    title.removeAttribute("title");
    try {
      await onDocumentNameChange(newName);
      originalNameRef.current = newName;
      title.textContent = newName;
      return true;
    } catch (error) {
      title.dataset.error = "true";
      title.title = error instanceof Error ? error.message : String(error);
      window.requestAnimationFrame(() => title.focus());
      return false;
    } finally {
      savingRef.current = false;
      title.removeAttribute("aria-busy");
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLHeadingElement>) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      if (titleRef.current) {
        titleRef.current.textContent = originalNameRef.current;
        delete titleRef.current.dataset.error;
        titleRef.current.removeAttribute("title");
        titleRef.current.blur();
      }
    } else if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void finishEditing().then((saved) => {
        if (saved) titleRef.current?.blur();
      });
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLHeadingElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain").replace(/[\r\n]+/g, " ");
    if (text && titleRef.current) insertPlainTextAtSelection(titleRef.current, text);
  };

  return (
    <h1
      ref={titleRef}
      contentEditable={Boolean(onDocumentNameChange)}
      suppressContentEditableWarning
      spellCheck={false}
      onFocus={() => {
        originalNameRef.current = titleRef.current?.textContent || name;
      }}
      onBlur={() => {
        void finishEditing();
      }}
      onKeyDown={onDocumentNameChange ? handleKeyDown : undefined}
      onPaste={onDocumentNameChange ? handlePaste : undefined}
    >
      {name}
    </h1>
  );
}

/** Presentation header. Its images are stored by normal image properties in YAML. */
export function DocumentPresentation({
  vaultIndex,
  name,
  typeLabel,
  hasPortrait = false,
  coverPath,
  onDocumentNameChange,
}: DocumentPresentationProps) {
  const cover = useVaultImage(vaultIndex, coverPath ?? "");
  // A configured but unavailable file must not leave a blank media frame. The
  // title remains available, and the generic CodeMirror header stays suppressed.
  if (!hasPortrait && !coverPath) return null;

  return (
    <header className="document-presentation" aria-label={`${name} presentation`}>
      {cover.url ? (
        <div className="document-presentation-cover">
          <img src={cover.url} alt="" />
        </div>
      ) : null}
      <div className={`document-presentation-title ${cover.url ? "has-cover" : ""}`}>
        <div>
          <p>{typeLabel}</p>
          <EditablePresentationTitle name={name} onDocumentNameChange={onDocumentNameChange} />
        </div>
      </div>
    </header>
  );
}
