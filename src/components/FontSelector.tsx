import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { focusAppElement, useAppIsActive } from "../hooks/useAppInteraction";

export interface FontSelectorProps {
  currentFont?: string;
  onSelectFont: (fontFamily: string) => void;
  availableFonts: string[];
}

export function FontSelector({ currentFont, onSelectFont, availableFonts }: FontSelectorProps) {
  const appActive = useAppIsActive();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    }

    if (isOpen && appActive) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, appActive]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && appActive && inputRef.current) {
      focusAppElement(inputRef.current);
    }
  }, [isOpen, appActive]);

  const filteredFonts = availableFonts.filter((font) =>
    font.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const displayFont = currentFont || "Default";

  // Simplify long font family names for display
  const simplifyFontName = (font: string): string => {
    return font.split(",")[0].trim().replace(/['"]/g, "");
  };

  return (
    <div className="font-selector" ref={dropdownRef}>
      <button
        type="button"
        className="font-selector-trigger"
        onClick={() => setIsOpen(!isOpen)}
        onMouseDown={(e) => e.preventDefault()}
        title="Font family"
      >
        <span className="font-selector-current">{simplifyFontName(displayFont)}</span>
        <ChevronDown size={14} />
      </button>

      {isOpen && (
        <div className="font-selector-dropdown">
          <div className="font-selector-search">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search fonts..."
              className="font-selector-search-input"
            />
          </div>

          <div className="font-selector-list">
            {filteredFonts.length === 0 ? (
              <div className="font-selector-empty">No fonts found</div>
            ) : (
              filteredFonts.map((font) => (
                <button
                  key={font}
                  type="button"
                  className={`font-selector-option ${currentFont === font ? "selected" : ""}`}
                  style={{ fontFamily: font }}
                  onClick={() => {
                    onSelectFont(font);
                    setIsOpen(false);
                    setSearchQuery("");
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {simplifyFontName(font)}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
