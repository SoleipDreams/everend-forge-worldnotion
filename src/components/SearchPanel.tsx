import { useWorldnotionSurfaceText } from "../i18n";
import { useState, useEffect, useCallback, useRef } from "react";
import { focusAppElement, useAppIsActive } from "../hooks/useAppInteraction";
import { X, ChevronDown, ChevronRight } from "lucide-react";
import type { EditorView } from "@codemirror/view";
import { findNext, findPrevious } from "@codemirror/search";

interface SearchPanelProps {
  editorView: EditorView | null;
  onClose: () => void;
}

export function SearchPanel({ editorView, onClose }: SearchPanelProps) {
  const t = useWorldnotionSurfaceText();
  const appActive = useAppIsActive();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQueryLocal] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [showReplace, setShowReplace] = useState(false);

  const updateSearch = useCallback(
    (query: string) => {
      if (!editorView || !query) return;

      // The search highlighting is handled by CodeMirror's findNext/findPrevious
      // This function is prepared for future enhancements
    },
    [editorView],
  );

  const handleFindNext = useCallback(() => {
    if (editorView && searchQuery) {
      updateSearch(searchQuery);
      findNext(editorView);
    }
  }, [editorView, searchQuery, updateSearch]);

  const handleFindPrevious = useCallback(() => {
    if (editorView && searchQuery) {
      updateSearch(searchQuery);
      findPrevious(editorView);
    }
  }, [editorView, searchQuery, updateSearch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          handleFindPrevious();
        } else {
          handleFindNext();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [handleFindNext, handleFindPrevious, onClose],
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQueryLocal(value);
      updateSearch(value);
    },
    [updateSearch],
  );

  useEffect(() => {
    // Auto-focus search input when panel opens
    const input = searchInputRef.current;
    if (input && appActive) {
      focusAppElement(input);
      input.select();
    }
  }, [appActive]);

  return (
    <div className="search-panel">
      <div className="search-panel-header">
        <div className="search-panel-row">
          <button
            type="button"
            className="search-panel-toggle"
            onClick={() => setShowReplace(!showReplace)}
            title={showReplace ? "Hide replace" : "Show replace"}
          >
            {showReplace ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <input
            ref={searchInputRef}
            type="text"
            className="search-panel-input"
            placeholder="Find"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="search-panel-options">
            <button type="button" className="search-option-btn" disabled title={t("Match case (Aa)")}>
              Aa
            </button>
            <button type="button" className="search-option-btn" disabled title={t("Match whole word (Ab)")}>
              Ab
            </button>
            <button type="button" className="search-option-btn" disabled title={t("Use regex (.*)")}>
              .*
            </button>
          </div>
          <button
            type="button"
            className="search-panel-close"
            onClick={onClose}
            title={t("Close (Esc)")}
          >
            <X size={14} />
          </button>
        </div>

        {showReplace && (
          <div className="search-panel-row">
            <div className="search-panel-spacer" />
            <input
              type="text"
              className="search-panel-input"
              placeholder={t("Replace")}
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div className="search-panel-replace-actions">
              <button
                type="button"
                className="search-action-btn" disabled
                title={t("Replace next (implementation pending)")}
              >
                {t("Replace")}
              </button>
              <button
                type="button"
                className="search-action-btn" disabled
                title={t("Replace all (implementation pending)")}
              >
                {t("All")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
