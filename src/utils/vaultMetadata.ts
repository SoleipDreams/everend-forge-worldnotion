import type { PropertiesConfig } from "../editorTypes";
import type {
  EntityTemplate,
  UniverseIcon,
  UniverseProfile,
  ValidationFinding,
  VaultFile,
} from "../domain";
import { normalizeCoreBaseProperties } from "./taxonomyConfig";
import { deserializePropertiesConfig } from "./propertiesSerializer";
import { normalizeLocaleList, normalizeLocaleNames } from "./localization";

function basenameWithoutExtension(path: string): string {
  const filename = path.split("/").pop() ?? path;
  return filename.replace(/\.[^.]+$/, "");
}

function createFinding(
  code: ValidationFinding["code"],
  severity: ValidationFinding["severity"],
  message: string,
  file?: string,
  field?: string,
): ValidationFinding {
  return { code, severity, message, file, field };
}

export function parseTemplates(files: VaultFile[]): EntityTemplate[] {
  return files
    .filter((file) => file.relativePath.startsWith(".everend/templates/"))
    .filter((file) => file.relativePath.endsWith(".md"))
    .map((file) => ({
      type: basenameWithoutExtension(file.relativePath),
      path: file.relativePath,
      content: file.content,
      modifiedMs: file.modifiedMs,
    }))
    .sort((a, b) => a.type.localeCompare(b.type));
}

export function parseUniverseProfile(
  files: VaultFile[],
  findings: ValidationFinding[],
): UniverseProfile | undefined {
  const profileFile = files.find((file) => file.relativePath === ".everend/universe.json");
  if (!profileFile) return undefined;

  try {
    const parsed = JSON.parse(profileFile.content) as UniverseProfile | null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    const icon: UniverseIcon | undefined =
      parsed.icon?.type && parsed.icon.value
        ? {
            type: parsed.icon.type === "image" ? "image" : "preset",
            value: String(parsed.icon.value),
          }
        : undefined;
    return {
      ...parsed,
      name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : undefined,
      icon,
      localization: parsed.localization?.primaryLocale
        ? (() => {
            const locales = normalizeLocaleList(
              parsed.localization.primaryLocale,
              Array.isArray(parsed.localization.locales)
                ? parsed.localization.locales.filter(
                    (locale): locale is string => typeof locale === "string",
                  )
                : [],
            );
            return {
              primaryLocale: locales[0],
              locales,
              localeNames: normalizeLocaleNames(parsed.localization.localeNames, locales),
            };
          })()
        : undefined,
    };
  } catch {
    findings.push(
      createFinding(
        "missing_runtime_asset",
        "warning",
        "Universe profile must be valid JSON.",
        ".everend/universe.json",
      ),
    );
    return undefined;
  }
}

export function parsePropertiesConfig(
  files: VaultFile[],
  findings: ValidationFinding[],
): PropertiesConfig | undefined {
  const propertiesFile = files.find((file) => file.relativePath === ".everend/properties.json");
  if (!propertiesFile) return undefined;

  try {
    const { config } = deserializePropertiesConfig(propertiesFile.content);
    if (
      !config.version ||
      !config.tags ||
      !config.entityTypes ||
      !config.statuses ||
      !config.customFields
    ) {
      findings.push(
        createFinding(
          "missing_runtime_asset",
          "warning",
          "Properties config is missing required fields.",
          propertiesFile.relativePath,
        ),
      );
      return undefined;
    }

    return normalizeCoreBaseProperties(config);
  } catch (error) {
    findings.push(
      createFinding(
        "missing_runtime_asset",
        "warning",
        `Properties config must be valid JSON: ${error instanceof Error ? error.message : String(error)}`,
        propertiesFile.relativePath,
      ),
    );
    return undefined;
  }
}
