import { createContext, useContext, useEffect, useRef } from "react";

export class UniverseDraftRegistry {
  private drafts = new Set<() => boolean>();
  register(draft: () => boolean) {
    this.drafts.add(draft);
    return () => {
      this.drafts.delete(draft);
    };
  }
  hasDrafts = () => [...this.drafts].some((draft) => draft());
}

export const UniverseDraftContext = createContext<UniverseDraftRegistry | null>(null);

/** Manual form drafts remain local until explicitly saved. */
export function useUniverseDraft(dirty: boolean) {
  const registry = useContext(UniverseDraftContext);
  const current = useRef(dirty);
  current.current = dirty;
  useEffect(() => registry?.register(() => current.current), [registry]);
}
