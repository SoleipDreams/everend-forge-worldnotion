import { WorldNotionDropdown } from "../SettingsDropdown.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Webview } from "@tauri-apps/api/webview";
import { openUrl as openExternalUrl } from "@tauri-apps/plugin-opener";
import { isTauriRuntime } from "../utils/appEnvironment";
import type { AiAdvisorSettings } from "../editorTypes";
import { normalizeAiProviderUrl } from "../utils/aiProviders";

const AI_ADVISOR_WEBVIEW_LABEL = "ai-advisor";
const AI_ADVISOR_DATA_STORE_IDENTIFIER = [
  0x57, 0x6f, 0x72, 0x6c, 0x64, 0x4e, 0x6f, 0x74, 0x69, 0x6f, 0x6e, 0x41, 0x49, 0x30, 0x30, 0x31,
];

type WebviewBounds = { x: number; y: number; width: number; height: number };

type AiAdvisorPanelProps = {
  settings: AiAdvisorSettings;
  onChange: (settings: AiAdvisorSettings) => void;
};

export function AiAdvisorPanel({ settings, onChange }: AiAdvisorPanelProps) {
  const [webviewError, setWebviewError] = useState<string>();
  const panelRef = useRef<HTMLElement | null>(null);
  const toolbarRef = useRef<HTMLElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const webviewRef = useRef<Webview | null>(null);
  const lastWebviewBoundsRef = useRef<WebviewBounds | null>(null);
  const webviewVisibleRef = useRef(false);
  const enabledProviders = useMemo(
    () =>
      settings.providers.filter(
        (candidate) => candidate.enabled && Boolean(normalizeAiProviderUrl(candidate.url)),
      ),
    [settings.providers],
  );
  const provider =
    enabledProviders.find((candidate) => candidate.id === settings.activeProviderId) ??
    enabledProviders[0];
  const providerUrl = provider?.url;

  const openProviderExternally = useCallback(async () => {
    if (!providerUrl) return;
    try {
      if (isTauriRuntime()) {
        await openExternalUrl(providerUrl);
      } else {
        window.open(providerUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      setWebviewError(error instanceof Error ? error.message : String(error));
    }
  }, [providerUrl]);

  const syncWebviewBounds = useCallback(async (webview = webviewRef.current) => {
    const host = hostRef.current;
    if (!webview || !host) return;
    const bounds = host.getBoundingClientRect();
    const panelBounds = panelRef.current?.getBoundingClientRect();
    const toolbarBounds = toolbarRef.current?.getBoundingClientRect();
    const left = Math.max(bounds.left, panelBounds?.left ?? bounds.left);
    const right = Math.min(bounds.right, panelBounds?.right ?? bounds.right);
    const top = Math.max(bounds.top, toolbarBounds?.bottom ?? bounds.top);
    const bottom = Math.min(bounds.bottom, panelBounds?.bottom ?? bounds.bottom);
    const x = Math.round(Math.max(0, left));
    const y = Math.round(Math.max(0, top));
    const width = Math.round(right - left);
    const height = Math.round(bottom - top);
    if (width < 1 || height < 1) {
      if (webviewVisibleRef.current) {
        await webview.hide();
        webviewVisibleRef.current = false;
      }
      return;
    }
    const previous = lastWebviewBoundsRef.current;
    if (!previous || previous.x !== x || previous.y !== y) {
      await webview.setPosition(new LogicalPosition(x, y));
    }
    if (!previous || previous.width !== width || previous.height !== height) {
      await webview.setSize(new LogicalSize(width, height));
    }
    lastWebviewBoundsRef.current = { x, y, width, height };
    if (!webviewVisibleRef.current) {
      await webview.show();
      webviewVisibleRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!isTauriRuntime() || !providerUrl) return;

    let disposed = false;
    let createdWebview: Webview | undefined;
    let webviewReady = false;
    let syncFrame: number | undefined;
    let pendingSync = Promise.resolve();
    lastWebviewBoundsRef.current = null;
    webviewVisibleRef.current = false;

    const scheduleBoundsSync = (webview?: Webview | null) => {
      if (!webviewReady || disposed || syncFrame !== undefined) return;
      syncFrame = window.requestAnimationFrame(() => {
        syncFrame = undefined;
        const target = webview ?? webviewRef.current;
        if (!target || disposed || !webviewReady) return;
        pendingSync = pendingSync
          .then(() => {
            if (!disposed && webviewReady) return syncWebviewBounds(target);
          })
          .catch((error) => {
            if (!disposed) setWebviewError(error instanceof Error ? error.message : String(error));
          });
      });
    };

    async function mountWebview() {
      const existing = await Webview.getByLabel(AI_ADVISOR_WEBVIEW_LABEL).catch(() => undefined);
      if (existing) await existing.close().catch(() => undefined);
      if (disposed) return;

      const webview = new Webview(getCurrentWindow(), AI_ADVISOR_WEBVIEW_LABEL, {
        url: providerUrl,
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        focus: false,
        dragDropEnabled: false,
        devtools: false,
        incognito: false,
        dataDirectory: "ai-advisor-profile",
        dataStoreIdentifier: AI_ADVISOR_DATA_STORE_IDENTIFIER,
      });
      createdWebview = webview;
      webviewRef.current = webview;
      void webview.once("tauri://error", (event) => {
        if (!disposed) setWebviewError(String(event.payload));
      });
      void webview.once("tauri://created", () => {
        webviewReady = true;
        scheduleBoundsSync(webview);
      });
    }

    void mountWebview().catch((error) => {
      if (!disposed) setWebviewError(error instanceof Error ? error.message : String(error));
    });

    const host = hostRef.current;
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(() => scheduleBoundsSync());
    if (host) resizeObserver?.observe(host);
    const handleWindowResize = () => scheduleBoundsSync();
    window.addEventListener("resize", handleWindowResize);

    return () => {
      disposed = true;
      webviewReady = false;
      if (syncFrame !== undefined) window.cancelAnimationFrame(syncFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleWindowResize);
      webviewRef.current = null;
      void createdWebview?.close().catch(() => undefined);
    };
  }, [providerUrl, syncWebviewBounds]);

  return (
    <section ref={panelRef} className="ai-advisor-panel" aria-label="AI Advisor">
      <header ref={toolbarRef} className="ai-advisor-toolbar">
        <div className="ai-advisor-provider-control">
          <label htmlFor="ai-advisor-provider">Provider</label>
          <WorldNotionDropdown
            id="ai-advisor-provider"
            value={provider?.id ?? ""}
            disabled={!enabledProviders.length}
            onChange={(event) => {
              onChange({ ...settings, activeProviderId: event.target.value });
              setWebviewError(undefined);
            }}
          >
            {enabledProviders.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </WorldNotionDropdown>
        </div>
        <span
          className="ai-advisor-privacy-note"
          title="WorldNotion does not send vault data to this webview."
        >
          <ShieldCheck size={14} />
          <span>Vault isolated</span>
        </span>
        <button
          type="button"
          className="ai-advisor-open-button"
          onClick={() => void openProviderExternally()}
          aria-label={provider ? `Open ${provider.name} externally` : "Open provider externally"}
          title={provider ? `Open ${provider.name} externally` : "Open provider externally"}
          disabled={!provider}
        >
          <ExternalLink size={14} />
        </button>
      </header>
      <div ref={hostRef} className="ai-advisor-webview-host">
        {!isTauriRuntime() && provider ? (
          <div className="ai-advisor-browser-fallback">
            <p>Embedded provider webviews are available in the Tauri desktop app.</p>
            <button type="button" onClick={() => void openProviderExternally()}>
              Open {provider.name}
            </button>
          </div>
        ) : null}
        {!provider ? (
          <div className="ai-advisor-browser-fallback">
            <p>No enabled providers are configured.</p>
            <small>Open Settings → AI Advisor to add or enable one.</small>
          </div>
        ) : null}
        {webviewError && provider ? (
          <div className="ai-advisor-browser-fallback">
            <p>Could not load {provider.name} inside WorldNotion.</p>
            <small>{webviewError}</small>
            <button type="button" onClick={() => void openProviderExternally()}>
              Open externally
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
