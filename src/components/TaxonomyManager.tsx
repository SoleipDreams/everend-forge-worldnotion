import type { PropertiesConfig } from "../editorTypes";
import { TagHierarchyEditor } from "./TagHierarchyEditor";
import "../App.css";

type PropertiesManagerProps = {
  locale?: "en" | "es";
  config: PropertiesConfig;
  onChange: (config: PropertiesConfig) => void;
};

export function PropertiesManager({ config, onChange, locale = "es" }: PropertiesManagerProps) {
  const es = locale === "es";

  return (
    <div className="ecosystem-manager">
      <h3>{es ? "Etiquetas" : "Tags"}</h3>
      <div className="ecosystem-content">
        <div className="ecosystem-panel">
          {(
            <div className="panel-settings">
              <label className="setting-toggle" data-setting-id="worldnotion.properties.customTags">
                <input
                  type="checkbox"
                  checked={config.tags.allowCustomTags}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      tags: { ...config.tags, allowCustomTags: e.target.checked },
                    })
                  }
                />
                <div className="setting-info">
                  <span className="setting-label">{es ? "Permitir etiquetas personalizadas" : "Allow custom tags"}</span>
                  <span className="setting-description">
                    {es ? "Acepta etiquetas que no estén en la jerarquía" : "Accept tags outside the hierarchy"}
                  </span>
                </div>
              </label>
              <label className="setting-toggle" data-setting-id="worldnotion.properties.slash">
                <input
                  type="checkbox"
                  checked={config.tags.autoDetectSlashNotation}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      tags: { ...config.tags, autoDetectSlashNotation: e.target.checked },
                    })
                  }
                />
                <div className="setting-info">
                  <span className="setting-label">{es ? "Auto-detectar notación de barras" : "Detect slash notation"}</span>
                  <span className="setting-description">
                    {es ? "Reconoce automáticamente la estructura jerárquica" : "Recognize the hierarchy automatically"}
                  </span>
                </div>
              </label>
            </div>
          )}
          <TagHierarchyEditor locale={locale}
            nodes={config.tags.rootNodes}
            onChange={(rootNodes) =>
              onChange({
                ...config,
                tags: { ...config.tags, rootNodes },
              })
            }
          />
        </div>
      </div>
    </div>
  );
}

export const TaxonomyManager = PropertiesManager;
