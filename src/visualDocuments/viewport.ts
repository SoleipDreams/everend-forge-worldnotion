export type VisualViewport = { x: number; y: number; zoom: number };
export const DEFAULT_VISUAL_VIEWPORT: VisualViewport = { x: 60, y: 70, zoom: 1 };
export function viewportPoint(view: VisualViewport, point: { x: number; y: number }) {
  return { x: (point.x - view.x) / view.zoom, y: (point.y - view.y) / view.zoom };
}
export function zoomViewport(
  view: VisualViewport,
  factor: number,
  anchor: { x: number; y: number },
): VisualViewport {
  const zoom = Math.min(4, Math.max(0.1, view.zoom * factor));
  const world = viewportPoint(view, anchor);
  return { zoom, x: anchor.x - world.x * zoom, y: anchor.y - world.y * zoom };
}
export function fitViewport(
  bounds: { x: number; y: number; width: number; height: number },
  width: number,
  height: number,
): VisualViewport {
  const zoom = Math.min(
    1.5,
    Math.max(
      0.1,
      Math.min(
        (width - 80) / Math.max(1, bounds.width),
        (height - 80) / Math.max(1, bounds.height),
      ),
    ),
  );
  return {
    zoom,
    x: (width - bounds.width * zoom) / 2 - bounds.x * zoom,
    y: (height - bounds.height * zoom) / 2 - bounds.y * zoom,
  };
}
/** UI state is local and never included in Markdown/runtime content. */
export function readVisualSession<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(`ef-visual:${key}`);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
export function writeVisualSession(key: string, state: unknown) {
  try {
    sessionStorage.setItem(`ef-visual:${key}`, JSON.stringify(state));
  } catch {
    /* An unavailable session store never prevents editing. */
  }
}
