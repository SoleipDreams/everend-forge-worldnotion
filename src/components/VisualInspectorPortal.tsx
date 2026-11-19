import { createPortal } from "react-dom";
import type { ReactNode } from "react";

export function VisualInspectorPortal({
  target,
  children,
}: {
  target?: Element | null;
  children: ReactNode;
}) {
  return target ? createPortal(children, target) : <>{children}</>;
}
