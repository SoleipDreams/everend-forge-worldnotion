import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { MessageDialog } from "./MessageDialog";
import { InputDialog } from "./InputDialog";
import { useNotify } from "../notifications";

export interface ConfirmDialogOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export interface AlertDialogOptions {
  title?: string;
}

export type ConfirmDialogFn = (message: string, options?: ConfirmDialogOptions) => Promise<boolean>;
export type AlertDialogFn = (message: string, options?: AlertDialogOptions) => Promise<void>;
export type PromptDialogFn = (
  title: string,
  placeholder?: string,
  defaultValue?: string,
) => Promise<string | null>;

interface DialogContextValue {
  confirmDialog: ConfirmDialogFn;
  alertDialog: AlertDialogFn;
  promptDialog: PromptDialogFn;
}

const DialogContext = createContext<DialogContextValue | undefined>(undefined);

/**
 * Diálogos de aplicación (confirmación, aviso y entrada de texto) como
 * promesas. Sustituyen a window.alert/confirm/prompt, que son no-ops en
 * algunos webviews de Tauri y rompen la coherencia visual.
 */
export function useAppDialogs(): DialogContextValue {
  const context = useContext(DialogContext);
  if (!context) {
    // Fallback para cuando no hay provider disponible (ej. en tests o componentes aislados)
    console.warn("useAppDialogs called outside DialogProvider - using fallback");
    return {
      confirmDialog: async (message) => {
        console.warn("confirmDialog (fallback):", message);
        return confirm(message);
      },
      alertDialog: async (message) => {
        console.warn("alertDialog (fallback):", message);
        alert(message);
      },
      promptDialog: async (title, placeholder) => {
        console.warn("promptDialog (fallback):", title);
        return prompt(title, placeholder) ?? null;
      },
    };
  }
  return context;
}

type ConfirmState = {
  message: string;
  options?: ConfirmDialogOptions;
  resolve: (confirmed: boolean) => void;
};

type AlertState = {
  message: string;
  options?: AlertDialogOptions;
  resolve: () => void;
};

type PromptState = {
  title: string;
  placeholder?: string;
  defaultValue?: string;
  resolve: (value: string | null) => void;
};

export function DialogProvider({ children, notifyAlerts = false }: { children: ReactNode; notifyAlerts?: boolean }) {
  const notify = useNotify();
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [alertState, setAlertState] = useState<AlertState | null>(null);
  const [promptState, setPromptState] = useState<PromptState | null>(null);

  const confirmDialog = useCallback<ConfirmDialogFn>((message, options) => {
    return new Promise((resolve) => {
      setConfirmState({ message, options, resolve });
    });
  }, []);

  const alertDialog = useCallback<AlertDialogFn>((message, options) => {
    if (notifyAlerts) {
      notify({ message, title: options?.title, kind: /required|unique|cannot|could not|failed/i.test(message) ? "warning" : "info" });
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      setAlertState({ message, options, resolve });
    });
  }, [notify, notifyAlerts]);

  const promptDialog = useCallback<PromptDialogFn>((title, placeholder, defaultValue) => {
    return new Promise((resolve) => {
      setPromptState({ title, placeholder, defaultValue, resolve });
    });
  }, []);

  const value = useMemo(
    () => ({ confirmDialog, alertDialog, promptDialog }),
    [confirmDialog, alertDialog, promptDialog],
  );

  return (
    <DialogContext.Provider value={value}>
      {children}
      <ConfirmDialog
        isOpen={confirmState !== null}
        message={confirmState?.message ?? ""}
        title={confirmState?.options?.title}
        confirmLabel={confirmState?.options?.confirmLabel}
        cancelLabel={confirmState?.options?.cancelLabel}
        destructive={confirmState?.options?.destructive}
        onConfirm={() => {
          confirmState?.resolve(true);
          setConfirmState(null);
        }}
        onCancel={() => {
          confirmState?.resolve(false);
          setConfirmState(null);
        }}
      />
      <MessageDialog
        isOpen={alertState !== null}
        message={alertState?.message ?? ""}
        title={alertState?.options?.title}
        onClose={() => {
          alertState?.resolve();
          setAlertState(null);
        }}
      />
      <InputDialog
        isOpen={promptState !== null}
        title={promptState?.title ?? ""}
        placeholder={promptState?.placeholder}
        defaultValue={promptState?.defaultValue}
        onConfirm={async (inputValue) => {
          promptState?.resolve(inputValue);
          setPromptState(null);
        }}
        onCancel={() => {
          promptState?.resolve(null);
          setPromptState(null);
        }}
      />
    </DialogContext.Provider>
  );
}
