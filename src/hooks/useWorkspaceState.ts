import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  AppSettingsV4,
  DocumentTabGroup,
  OpenTab,
  WorkspaceLayoutV1,
} from "../editorTypes";
import { serializeWorkspaceSession } from "../utils/tabUtils";
import { normalizeDocumentTabGroups } from "../utils/documentTabGroups";
import { explorerAncestorsForPath } from "../utils/explorerSelectors";
import {
  closeDockTab as closeDockLayoutTab,
  createDefaultWorkspaceLayout,
  layoutHasPanel,
  orderOpenTabsByLayout,
  panelDockTabId,
  syncLayoutWithOpenTabs,
} from "../utils/workspaceLayout";

export type WorkspaceDocumentState = {
  tabs: OpenTab[];
  documentTabGroups: DocumentTabGroup[];
  activeTabPath?: string;
  workspaceLayout: WorkspaceLayoutV1;
};

function normalizeWorkspaceDocumentState(
  state: WorkspaceDocumentState,
  previous?: WorkspaceDocumentState,
): WorkspaceDocumentState {
  // A panel can be selected while the last active document remains unchanged.
  const activePathToSync =
    previous?.activeTabPath !== state.activeTabPath ? state.activeTabPath : undefined;
  const workspaceLayout = syncLayoutWithOpenTabs(
    state.workspaceLayout,
    state.tabs,
    activePathToSync,
  );
  const orderedTabs = orderOpenTabsByLayout(state.tabs, workspaceLayout);
  const tabs = orderedTabs.every((tab, index) => tab === state.tabs[index]) &&
    orderedTabs.length === state.tabs.length
    ? state.tabs
    : orderedTabs;
  return {
    ...state,
    tabs,
    workspaceLayout,
    documentTabGroups: normalizeDocumentTabGroups(
      state.documentTabGroups,
      tabs,
      workspaceLayout,
    ),
  };
}

interface UseWorkspaceStateParams {
  rootPath: string | undefined;
  persistTabs: boolean;
  selectedPath: string | undefined;
  sessions: AppSettingsV4["sessions"];
  setSettings: Dispatch<SetStateAction<AppSettingsV4>>;
  onTabsChange?: (tabs: OpenTab[], previous: OpenTab[]) => void;
}

/**
 * Estado del workspace: tabs abiertos, grupos de tabs, layout de paneles y
 * carpetas expandidas del explorer, junto con los efectos que los mantienen
 * coherentes entre sí y los persisten en la sesión del universo activo.
 *
 * El orden relativo de los efectos reproduce el que tenían en App.tsx; los
 * setters conservan la firma de useState para no cambiar los puntos de uso.
 */
export function useWorkspaceState({
  rootPath,
  persistTabs,
  selectedPath,
  sessions,
  setSettings,
  onTabsChange,
}: UseWorkspaceStateParams) {
  const [workspaceDocumentState, setWorkspaceDocumentState] = useState<WorkspaceDocumentState>(
    () =>
      normalizeWorkspaceDocumentState({
        tabs: [],
        documentTabGroups: [],
        workspaceLayout: createDefaultWorkspaceLayout(),
      }),
  );
  const { tabs, documentTabGroups, activeTabPath, workspaceLayout } = workspaceDocumentState;
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const tabsRef = useRef<OpenTab[]>([]);
  const workspaceDocumentStateRef = useRef(workspaceDocumentState);
  const onTabsChangeRef = useRef(onTabsChange);
  onTabsChangeRef.current = onTabsChange;

  // Structural tab state is committed together so layout, order, active tab,
  // and group membership cannot be persisted from different transitions.
  const updateWorkspaceDocumentState = useCallback<
    Dispatch<SetStateAction<WorkspaceDocumentState>>
  >((update) => {
    const previous = workspaceDocumentStateRef.current;
    const updated = typeof update === "function" ? update(previous) : update;
    const next = normalizeWorkspaceDocumentState(updated, previous);
    if (next.tabs !== previous.tabs) {
      onTabsChangeRef.current?.(next.tabs, previous.tabs);
    }
    workspaceDocumentStateRef.current = next;
    tabsRef.current = next.tabs;
    setWorkspaceDocumentState(next);
  }, []);

  const setTabs = useCallback<Dispatch<SetStateAction<OpenTab[]>>>((update) => {
    updateWorkspaceDocumentState((current) => ({
      ...current,
      tabs: typeof update === "function" ? update(current.tabs) : update,
    }));
  }, [updateWorkspaceDocumentState]);
  const setDocumentTabGroups = useCallback<Dispatch<SetStateAction<DocumentTabGroup[]>>>(
    (update) => {
      updateWorkspaceDocumentState((current) => ({
        ...current,
        documentTabGroups:
          typeof update === "function" ? update(current.documentTabGroups) : update,
      }));
    },
    [updateWorkspaceDocumentState],
  );
  const setActiveTabPath = useCallback<Dispatch<SetStateAction<string | undefined>>>(
    (update) => {
      updateWorkspaceDocumentState((current) => ({
        ...current,
        activeTabPath: typeof update === "function" ? update(current.activeTabPath) : update,
      }));
    },
    [updateWorkspaceDocumentState],
  );
  const setWorkspaceLayout = useCallback<Dispatch<SetStateAction<WorkspaceLayoutV1>>>(
    (update) => {
      updateWorkspaceDocumentState((current) => ({
        ...current,
        workspaceLayout: typeof update === "function" ? update(current.workspaceLayout) : update,
      }));
    },
    [updateWorkspaceDocumentState],
  );
  const sessionsRef = useRef(sessions);
  const legacyExpandedPathsLoadedRef = useRef<Set<string>>(new Set());

  // Se sincroniza antes que el efecto de restauración para que este lea la
  // sesión del render actual sin declarar `sessions` como dependencia (lo que
  // re-dispararía la restauración en cada escritura de sesión).
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    if (!rootPath || !persistTabs) return;
    const session = serializeWorkspaceSession(
      rootPath,
      activeTabPath,
      tabs,
      workspaceLayout,
      documentTabGroups,
      Array.from(expandedPaths),
    );
    setSettings((current) => ({
      ...current,
      sessions: { ...current.sessions, [rootPath]: { ...current.sessions[rootPath], ...session } },
    }));
  }, [
    activeTabPath,
    documentTabGroups,
    expandedPaths,
    rootPath,
    persistTabs,
    tabs,
    workspaceLayout,
    setSettings,
  ]);

  useEffect(() => {
    if (!rootPath || persistTabs) return;
    const nextExpandedPaths = Array.from(expandedPaths);
    setSettings((current) => {
      const session = current.sessions[rootPath] ?? { rootPath, tabs: [] };
      const previousExpandedPaths = session.explorerExpandedPaths ?? [];
      if (
        previousExpandedPaths.length === nextExpandedPaths.length &&
        previousExpandedPaths.every((path, pathIndex) => path === nextExpandedPaths[pathIndex])
      ) {
        return current;
      }
      return {
        ...current,
        sessions: {
          ...current.sessions,
          [rootPath]: {
            ...session,
            explorerExpandedPaths: nextExpandedPaths,
          },
        },
      };
    });
  }, [expandedPaths, rootPath, persistTabs, setSettings]);

  // El outline se muestra dentro del editor, nunca como tab del dock.
  useEffect(() => {
    if (!layoutHasPanel(workspaceLayout, "outline")) return;
    setWorkspaceLayout((current) => closeDockLayoutTab(current, panelDockTabId("outline")));
  }, [workspaceLayout]);

  useEffect(() => {
    if (!rootPath) return;
    const restored = sessionsRef.current[rootPath]?.explorerExpandedPaths;
    if (restored) {
      setExpandedPaths(new Set(restored));
      return;
    }
    if (legacyExpandedPathsLoadedRef.current.has(rootPath)) {
      setExpandedPaths(new Set());
      return;
    }
    legacyExpandedPathsLoadedRef.current.add(rootPath);
    const stored = localStorage.getItem("worldnotion.expandedPaths");
    try {
      setExpandedPaths(stored ? new Set(JSON.parse(stored)) : new Set());
    } catch {
      setExpandedPaths(new Set());
    }
  }, [rootPath]);

  useEffect(() => {
    // The explorer can select a folder while a document remains open in the
    // editor. In that state, following `activeTabPath` would immediately
    // re-expand the folder the user just collapsed. The selected document is
    // already kept in sync when a tab is activated, so it is the only path
    // that should drive automatic ancestor expansion here.
    const path = selectedPath?.endsWith(".md") ? selectedPath : undefined;
    if (!path) return;
    const ancestors = explorerAncestorsForPath(path);
    if (!ancestors.length) return;
    setExpandedPaths((current) => {
      if (ancestors.every((ancestor) => current.has(ancestor))) return current;
      const next = new Set(current);
      ancestors.forEach((ancestor) => next.add(ancestor));
      return next;
    });
  }, [selectedPath]);

  return {
    tabs,
    setTabs,
    tabsRef,
    documentTabGroups,
    setDocumentTabGroups,
    activeTabPath,
    setActiveTabPath,
    workspaceLayout,
    setWorkspaceLayout,
    updateWorkspaceDocumentState,
    expandedPaths,
    setExpandedPaths,
  };
}
