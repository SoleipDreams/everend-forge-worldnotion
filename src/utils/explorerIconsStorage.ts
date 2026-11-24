import { invoke } from "@tauri-apps/api/core";
import type { VaultHandle } from "./vaultFileOps";
import {
  ensureBrowserWritePermission,
  getBrowserFile,
  writeBrowserFile,
  type BrowserDirectoryHandle,
} from "./browserVault";

// Persisted icon map. Values are icon-name strings validated at render time;
// kept as plain strings to match settings.explorer.customIcons and tolerate
// arbitrary values read from disk.
export type ExplorerIconsData = Record<string, string>;

const ICONS_STORAGE_PATH = ".everend/.worldnotion/explorer-icons.json";

/**
 * Loads explorer icons from `.everend/.worldnotion/explorer-icons.json`.
 * Falls back to empty object if file doesn't exist or on parse error.
 */
export async function loadExplorerIcons(vault: VaultHandle): Promise<ExplorerIconsData> {
  try {
    if (vault.kind === "browser") {
      return await loadExplorerIconsBrowser(vault.root);
    }

    const result = await invoke<{ ok: boolean; content?: string; message?: string }>(
      "read_explorer_icons",
      { vaultPath: vault.rootPath },
    );

    if (!result.ok || !result.content) {
      return {};
    }

    const parsed = JSON.parse(result.content) as ExplorerIconsData;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    // File doesn't exist yet or parse error - return empty
    return {};
  }
}

/**
 * Saves explorer icons to `.everend/.worldnotion/explorer-icons.json`.
 * Creates the directory structure if needed.
 */
export async function saveExplorerIcons(
  vault: VaultHandle,
  icons: ExplorerIconsData,
): Promise<void> {
  try {
    if (vault.kind === "browser") {
      return await saveExplorerIconsBrowser(vault.root, icons);
    }

    const content = JSON.stringify(icons, null, 2);
    const result = await invoke<{ ok: boolean; message?: string }>("save_explorer_icons", {
      vaultPath: vault.rootPath,
      content,
    });

    if (!result.ok) {
      throw new Error(result.message || "Failed to save explorer icons");
    }
  } catch (error) {
    console.error("Failed to save explorer icons:", error);
    throw error;
  }
}

/**
 * Browser implementation: reads explorer icons from FileSystem Access API.
 */
async function loadExplorerIconsBrowser(root: BrowserDirectoryHandle): Promise<ExplorerIconsData> {
  try {
    const fileHandle = await getBrowserFile(root, ICONS_STORAGE_PATH, false);
    const file = await fileHandle.getFile();
    const content = await file.text();
    if (!content) return {};
    const parsed = JSON.parse(content) as ExplorerIconsData;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    // File doesn't exist or error reading - return empty
    return {};
  }
}

/**
 * Browser implementation: writes explorer icons using FileSystem Access API.
 */
async function saveExplorerIconsBrowser(
  root: BrowserDirectoryHandle,
  icons: ExplorerIconsData,
): Promise<void> {
  await ensureBrowserWritePermission(root);
  const content = JSON.stringify(icons, null, 2);
  await writeBrowserFile(root, ICONS_STORAGE_PATH, content);
}
