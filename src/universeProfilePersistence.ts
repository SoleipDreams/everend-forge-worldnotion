/** Preserve unrelated fields in the portable universe profile. Invalid JSON must never be replaced silently. */
export function mergeUniverseProfile(source: string | undefined, patch: object): Record<string, unknown> {
  const current: unknown = source === undefined ? {} : JSON.parse(source);
  if (!current || typeof current !== "object" || Array.isArray(current)) throw new Error("Invalid universe profile.");
  const result = { ...current, ...patch } as Record<string, unknown>;
  const before = (current as Record<string, unknown>).localization, after = result.localization;
  if (before && after && typeof before === "object" && typeof after === "object" && !Array.isArray(before) && !Array.isArray(after)) result.localization = { ...before, ...after };
  return result;
}
import { invoke } from "@tauri-apps/api/core";
export async function readUniverseProfileSource(root: string): Promise<string | undefined> {
  try {
    const encoded = await invoke<string>("read_file_base64", { vaultPath: root, relativePath: ".everend/universe.json" });
    return new TextDecoder().decode(Uint8Array.from(atob(encoded), character => character.charCodeAt(0)));
  } catch (error) {
    if (/os error (2|3)\b|not found|NotFoundError/i.test(String(error))) return undefined;
    throw error;
  }
}

