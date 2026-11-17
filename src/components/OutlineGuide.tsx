import type { OutlineHeader } from "../utils/outlineExtractor";

interface OutlineGuideProps {
  outline: OutlineHeader[];
  currentHeader: OutlineHeader | null;
  onNavigate: (line: number) => void;
  position?: "left" | "right";
  ariaLabel?: string;
}

export function OutlineGuide({
  outline,
  currentHeader,
  onNavigate,
  position = "right",
  ariaLabel = "Document outline",
}: OutlineGuideProps) {
  const renderHeader = (header: OutlineHeader, depth = 0) => {
    const isCurrent = currentHeader?.id === header.id;

    return (
      <div key={header.id}>
        <button
          type="button"
          className={`outline-item ${isCurrent ? "active" : ""}`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => onNavigate(header.line)}
          aria-current={isCurrent ? "location" : undefined}
          title={header.text}
        >
          <span className="outline-item-text">{header.text}</span>
        </button>
        {header.children.map((child) => renderHeader(child, depth + 1))}
      </div>
    );
  };

  if (outline.length === 0) {
    return null;
  }

  return (
    <nav className={`outline-guide-notion position-${position}`} aria-label={ariaLabel}>
      {outline.map((header) => renderHeader(header, 0))}
    </nav>
  );
}
