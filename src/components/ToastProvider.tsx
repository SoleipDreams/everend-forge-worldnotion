import { createContext, useCallback, useContext, type ReactNode } from "react";
import type { ToastKind } from "./Toast";
import { useNotify, NotificationProvider } from "../notifications";
import { NOTIFICATION_DURATION } from "../notificationStore";

export const TOAST_DURATION_MS: Record<ToastKind, number> = NOTIFICATION_DURATION;

export type ShowToast = (message: string, kind?: ToastKind) => void;

const ToastContext = createContext<{ showToast: ShowToast } | undefined>(undefined);

export function useToast(): { showToast: ShowToast } {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context;
}

function ToastBridge({ children }: { children: ReactNode }) {
  const notify = useNotify();
  const showToast = useCallback<ShowToast>(
    (message, kind = "info") => notify({ message, kind }),
    [notify],
  );
  return <ToastContext.Provider value={{ showToast }}>{children}</ToastContext.Provider>;
}
export function ToastProvider({
  children,
  integrated = false,
}: {
  children: ReactNode;
  integrated?: boolean;
}) {
  const bridge = <ToastBridge>{children}</ToastBridge>;
  return integrated ? (
    bridge
  ) : (
    <NotificationProvider source="WorldNotion">{bridge}</NotificationProvider>
  );
}
