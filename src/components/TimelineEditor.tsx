import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Filter,
  Flag,
  Moon,
  Plus,
  Save,
  Settings2,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { VaultIndex } from "../domain";
import { useAppIsActive } from "../hooks/useAppInteraction";
import { useUniverseDraft } from "../hooks/useUniverseDraft";
import { timelineText } from "../visualDocuments/timelineText";
import { resolveVisualDocumentReference } from "../visualDocuments/references";
import { isImagePath, useVaultImage } from "../utils/vaultImages";
import { getIconComponent } from "./IconPicker";
import {
  CALENDAR_PRECISIONS,
  EARTH_CALENDAR,
  GENERIC_CALENDAR,
  calendarDateBounds,
  copyCalendar,
  eraDurationYears,
  floorDiv,
  formatCalendarDate,
  fromOrdinal,
  moonPhasesAt,
  parseOrdinal,
  ticksPerDay,
  validateCalendar,
  weekdayAt,
  yearFromEra,
  yearInEra,
  type CalendarDate,
  type CalendarDefinition,
  type CalendarPrecision,
} from "../visualDocuments/calendar";
import type {
  TimelineDocument,
  TimelineItem,
  TimelineSavedView,
} from "../visualDocuments/timelineTypes";
import type { VisualDocumentEditorProps, VisualDocumentSession } from "../visualDocuments/types";
import { viewportPoint, zoomViewport, type VisualViewport } from "../visualDocuments/viewport";
import "./TimelineEditor.css";

type TimelineFilters = { tags: string[]; kinds: ("event" | "period")[]; search: string };
const TimelineTextContext = createContext<(value: string) => string>((value) => value);
type TimelineScale = { origin: string; ticksPerUnit: string };
type TimelineSession = VisualDocumentSession & {
  timelineFilters?: TimelineFilters;
  timelineScale?: TimelineScale;
};
export type TimelineEditorProps = VisualDocumentEditorProps<TimelineDocument> & {
  calendarPresets?: CalendarDefinition[];
  onSaveCalendarPreset?: (calendar: CalendarDefinition) => Promise<void>;
};
const EMPTY_FILTERS: TimelineFilters = { tags: [], kinds: ["event", "period"], search: "" };
const uid = () => crypto.randomUUID();
const PIXELS_PER_UNIT = 100;
const COLOR_PRESETS = ["#7c8dc4", "#b8886f", "#749e87", "#bd8caa", "#a69656", "#89949e"];
const ICON_PRESETS = [
  "flag",
  "calendar",
  "star",
  "crown",
  "sword",
  "moon",
  "heart",
  "skull",
  "tree",
  "book",
];

function initialScale(items: TimelineItem[]): TimelineScale {
  const values = items.flatMap((item) => [
    parseOrdinal(item.start),
    ...(item.end ? [parseOrdinal(item.end)] : []),
  ]);
  const low = values.reduce((a, b) => (a < b ? a : b), values[0] ?? 0n);
  const high = values.reduce((a, b) => (a > b ? a : b), low);
  return {
    origin: low.toString(),
    ticksPerUnit: (high - low > 0n ? (high - low) / 6n + 1n : 30n * 86400n).toString(),
  };
}
function positionFor(value: string | bigint, scale: TimelineScale): number {
  return (
    (Number(
      ((parseOrdinal(value) - parseOrdinal(scale.origin)) * 1_000_000n) /
        parseOrdinal(scale.ticksPerUnit),
    ) /
      1_000_000) *
    PIXELS_PER_UNIT
  );
}
function ordinalFor(x: number, scale: TimelineScale): bigint {
  return (
    parseOrdinal(scale.origin) +
    (BigInt(Math.round((x / PIXELS_PER_UNIT) * 1_000_000)) * parseOrdinal(scale.ticksPerUnit)) /
      1_000_000n
  );
}
function timelineLayout(
  items: TimelineItem[],
  scale: TimelineScale,
  zoom: number,
  cardWidth: number,
) {
  const eventLanes: number[] = [],
    periodLanes: number[] = [];
  return [...items]
    .sort((a, b) =>
      parseOrdinal(a.start) < parseOrdinal(b.start)
        ? -1
        : parseOrdinal(a.start) > parseOrdinal(b.start)
          ? 1
          : a.id.localeCompare(b.id),
    )
    .map((item) => {
      const x = positionFor(item.start, scale) * zoom;
      const endX = item.end ? positionFor(item.end, scale) * zoom : x;
      const occupied = item.kind === "event" ? eventLanes : periodLanes;
      const left = item.kind === "event" ? x - 10 : x;
      const right = item.kind === "event" ? left + cardWidth : Math.max(x + cardWidth, endX);
      const automatic = occupied.findIndex((value) => value + 16 < left);
      const lane = item.lane ?? (automatic >= 0 ? automatic : occupied.length);
      occupied[lane] = Math.max(occupied[lane] ?? -Infinity, right);
      const height = item.kind === "event" && item.image ? 76 : 58;
      return {
        item,
        x,
        endX,
        lane,
        height,
        left,
        right,
        y: item.kind === "event" ? -height - 14 - lane * 94 : 32 + lane * 52,
      };
    });
}
function elideTimelineText(value: string, width: number, averageCharacterWidth = 6.4) {
  const length = Math.max(2, Math.floor(width / averageCharacterWidth));
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}
function tickStep(wanted: bigint, calendar: CalendarDefinition): bigint {
  const minute = BigInt(calendar.secondsPerMinute);
  const hour = minute * BigInt(calendar.minutesPerHour);
  const day = ticksPerDay(calendar);
  const candidates = [1n, minute, hour, day, 7n * day, 30n * day, 90n * day, 365n * day];
  const value = candidates.find((candidate) => candidate >= wanted);
  if (value) return value;
  let step = 365n * day;
  while (step < wanted) step *= 10n;
  return step;
}
function dateLabel(
  calendar: CalendarDefinition,
  ordinal: string,
  precision: CalendarPrecision = "day",
): string {
  try {
    return formatCalendarDate(calendar, ordinal, precision);
  } catch {
    return ordinal;
  }
}

function TimelineImage({
  index,
  path,
  x,
  y,
  width = 36,
  height = 36,
}: {
  index?: VaultIndex;
  path?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}) {
  const { url } = useVaultImage(index, path ?? "");
  return url ? (
    <image
      href={url}
      x={x}
      y={y}
      width={width}
      height={height}
      preserveAspectRatio="xMidYMid slice"
    />
  ) : null;
}

function TimelineTags({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const t = useContext(TimelineTextContext);
  const [text, setText] = useState(tags.join(", "));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(tags.join(", "));
  }, [tags]);
  return (
    <label>
      {t("Tags · comma separated")}
      <input
        value={text}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
          setText(tags.join(", "));
        }}
        onChange={(event) => {
          setText(event.target.value);
          onChange([
            ...new Set(
              event.target.value
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
            ),
          ]);
        }}
      />
    </label>
  );
}

function DateFields({
  calendar,
  ordinal,
  precision,
  label,
  onApply,
  draft: suppliedDraft,
  onDraftChange,
}: {
  calendar: CalendarDefinition;
  ordinal: string;
  precision: CalendarPrecision;
  label: string;
  onApply: (ordinal: string, precision: CalendarPrecision) => boolean | void;
  draft?: CalendarDate;
  onDraftChange: (next?: CalendarDate) => void;
}) {
  const t = useContext(TimelineTextContext);
  const source = useMemo(
    () => fromOrdinal(calendar, ordinal, precision),
    [calendar, ordinal, precision],
  );
  const draft = suppliedDraft ?? source;
  const [eraId, setEraId] = useState("");
  const [error, setError] = useState("");
  const rank = CALENDAR_PRECISIONS.indexOf(draft.precision ?? precision);
  const update = (field: keyof CalendarDate, value: number | CalendarPrecision) => {
    const next = { ...draft, [field]: value };
    onDraftChange(JSON.stringify(next) === JSON.stringify(source) ? undefined : next);
  };
  const apply = () => {
    try {
      const bounds = calendarDateBounds(calendar, draft);
      if (onApply(bounds.start.toString(), draft.precision ?? precision) === false) return;
      onDraftChange(undefined);
      setError("");
    } catch (issue) {
      setError(t(issue instanceof Error ? issue.message : String(issue)));
    }
  };
  const week = weekdayAt(calendar, ordinal);
  const moons = moonPhasesAt(calendar, ordinal);
  return (
    <fieldset className="timeline-date-fields">
      <legend>{label}</legend>
      <label>
        {t("Precision")}
        <select
          value={draft.precision ?? precision}
          onChange={(event) => update("precision", event.target.value as CalendarPrecision)}
        >
          {CALENDAR_PRECISIONS.map((value) => (
            <option key={value} value={value}>
              {t(value)}
            </option>
          ))}
        </select>
      </label>
      {calendar.eras.length > 0 && (
        <label>
          {t("Era")}
          <select value={eraId} onChange={(event) => setEraId(event.target.value)}>
            <option value="">{t("Base calendar")}</option>
            {calendar.eras.map((era) => (
              <option key={era.id} value={era.id}>
                {era.name} · {era.suffix}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="timeline-date-grid">
        <label>
          {t("Year")}
          <input
            type="number"
            step="1"
            value={yearInEra(calendar, draft.year, eraId)}
            onChange={(event) => {
              try {
                update("year", yearFromEra(calendar, Number(event.target.value), eraId));
                setError("");
              } catch (issue) {
                setError(t(issue instanceof Error ? issue.message : String(issue)));
              }
            }}
          />
        </label>
        {rank >= 1 && (
          <label>
            {t("Month")}
            <select
              value={draft.month ?? 1}
              onChange={(event) => update("month", Number(event.target.value))}
            >
              {calendar.months.map((month, i) => (
                <option key={month.id} value={i + 1}>
                  {month.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {rank >= 2 && (
          <label>
            {t("Day")}
            <input
              type="number"
              min="1"
              step="1"
              value={draft.day ?? 1}
              onChange={(event) => update("day", Number(event.target.value))}
            />
          </label>
        )}
        {rank >= 3 && (
          <label>
            {t("Hour")}
            <input
              type="number"
              min="0"
              max={calendar.hoursPerDay - 1}
              value={draft.hour ?? 0}
              onChange={(event) => update("hour", Number(event.target.value))}
            />
          </label>
        )}
        {rank >= 4 && (
          <label>
            {t("Minute")}
            <input
              type="number"
              min="0"
              max={calendar.minutesPerHour - 1}
              value={draft.minute ?? 0}
              onChange={(event) => update("minute", Number(event.target.value))}
            />
          </label>
        )}
        {rank >= 5 && (
          <label>
            {t("Second")}
            <input
              type="number"
              min="0"
              max={calendar.secondsPerMinute - 1}
              value={draft.second ?? 0}
              onChange={(event) => update("second", Number(event.target.value))}
            />
          </label>
        )}
      </div>
      <button type="button" onClick={apply}>
        {t("Apply date")}
      </button>
      {suppliedDraft && (
        <button
          type="button"
          onClick={() => {
            onDraftChange(undefined);
            setError("");
          }}
        >
          {t("Discard changes")}
        </button>
      )}
      {error && (
        <p className="timeline-error" role="alert">
          {error}
        </p>
      )}
      <small>
        {dateLabel(calendar, ordinal, precision)}
        {week ? ` · ${week.name}` : ""}
      </small>
      {moons.length > 0 && (
        <div className="timeline-moon-phases">
          {moons.map((moon) => (
            <span key={moon.id}>
              <Moon size={12} />
              {moon.name}: {moon.phase}
            </span>
          ))}
        </div>
      )}
    </fieldset>
  );
}

function CalendarSettings({
  value,
  presets,
  onApply,
  onSavePreset,
  onClose,
  draft: suppliedDraft,
  onDraftChange,
}: {
  value: CalendarDefinition;
  presets: CalendarDefinition[];
  onApply: (value: CalendarDefinition) => boolean | void;
  onSavePreset?: (calendar: CalendarDefinition) => Promise<void>;
  onClose: () => void;
  draft?: CalendarDefinition;
  onDraftChange: (next?: CalendarDefinition) => void;
}) {
  const t = useContext(TimelineTextContext);
  const draft = suppliedDraft ?? value;
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const change = (patch: Partial<CalendarDefinition>) => onDraftChange({ ...draft, ...patch });
  const apply = () => {
    const issues = validateCalendar(draft);
    if (issues.length) {
      setError(issues.join("; "));
      return;
    }
    if (onApply(copyCalendar(draft)) === false) {
      setError(t("Apply or discard date drafts before changing calendar."));
      return;
    }
    onDraftChange(undefined);
    onClose();
  };
  const savePreset = async () => {
    const issues = validateCalendar(draft);
    if (issues.length) {
      setError(issues.join("; "));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSavePreset?.(
        copyCalendar({
          ...draft,
          id: draft.id === "earth" || draft.id === "generic" ? uid() : draft.id,
        }),
      );
    } catch (issue) {
      setError(t(issue instanceof Error ? issue.message : String(issue)));
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="timeline-calendar-panel" aria-label={t("Calendar settings")}>
      <div className="timeline-inspector-heading">
        <h3>{t("Calendar")}</h3>
        <button type="button" onClick={onClose} aria-label={t("Close calendar settings")}>
          ×
        </button>
      </div>
      <p className="timeline-hint">
        {t(
          "This calendar is copied into this document. Changing it keeps every event’s exact instant.",
        )}
      </p>
      <label>
        {t("Preset")}
        <select
          value=""
          onChange={(event) => {
            const preset = presets.find((entry) => entry.id === event.target.value);
            if (preset) {
              onDraftChange(copyCalendar(preset));
              setError("");
            }
          }}
        >
          <option value="">{t("Choose a calendar…")}</option>
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("Calendar name")}
        <input value={draft.name} onChange={(event) => change({ name: event.target.value })} />
      </label>
      <div className="timeline-date-grid">
        <label>
          {t("Hours / day")}
          <input
            type="number"
            min="1"
            value={draft.hoursPerDay}
            onChange={(event) => change({ hoursPerDay: Number(event.target.value) })}
          />
        </label>
        <label>
          {t("Minutes / hour")}
          <input
            type="number"
            min="1"
            value={draft.minutesPerHour}
            onChange={(event) => change({ minutesPerHour: Number(event.target.value) })}
          />
        </label>
        <label>
          {t("Seconds / minute")}
          <input
            type="number"
            min="1"
            value={draft.secondsPerMinute}
            onChange={(event) => change({ secondsPerMinute: Number(event.target.value) })}
          />
        </label>
      </div>
      <label className="timeline-checkbox">
        <input
          type="checkbox"
          checked={draft.yearZero}
          onChange={(event) => change({ yearZero: event.target.checked })}
        />
        {t("Include year zero")}
      </label>
      <div className="timeline-date-grid">
        <label>
          {t("Year suffix")}
          <input
            value={draft.yearSuffix}
            onChange={(event) => change({ yearSuffix: event.target.value })}
          />
        </label>
        <label>
          {t("Before epoch suffix")}
          <input
            value={draft.negativeYearSuffix ?? ""}
            onChange={(event) => change({ negativeYearSuffix: event.target.value })}
          />
        </label>
      </div>
      <fieldset>
        <legend>{t("Months")}</legend>
        {draft.months.map((month, index) => (
          <div className="timeline-calendar-row" key={month.id}>
            <input
              aria-label={`${t("Month")} ${index + 1} · ${t("Name")}`}
              value={month.name}
              onChange={(event) =>
                change({
                  months: draft.months.map((entry, i) =>
                    i === index ? { ...entry, name: event.target.value } : entry,
                  ),
                })
              }
            />
            <input
              aria-label={`${t("Month")} ${index + 1} · ${t("Day")}`}
              type="number"
              min="1"
              value={month.days}
              onChange={(event) =>
                change({
                  months: draft.months.map((entry, i) =>
                    i === index ? { ...entry, days: Number(event.target.value) } : entry,
                  ),
                })
              }
            />
            <button
              type="button"
              aria-label={`${t("Remove month")} ${index + 1}`}
              disabled={draft.months.length === 1}
              onClick={() => change({ months: draft.months.filter((_, i) => i !== index) })}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            change({
              months: [
                ...draft.months,
                { id: uid(), name: `Month ${draft.months.length + 1}`, days: 30 },
              ],
            })
          }
        >
          {t("+ Month")}
        </button>
      </fieldset>
      <fieldset>
        <legend>{t("Weeks")}</legend>
        <label>
          {t("Week progression")}
          <select
            value={draft.weekMode ?? "continuous"}
            onChange={(event) =>
              change({ weekMode: event.target.value as "continuous" | "monthly" })
            }
          >
            <option value="continuous">{t("Continuous across months")}</option>
            <option value="monthly">{t("Restart with each month")}</option>
          </select>
        </label>
        <label>
          {t("Weekday names · one per line")}
          <textarea
            rows={3}
            value={draft.weekdays.join("\n")}
            onChange={(event) =>
              change({ weekdays: event.target.value ? event.target.value.split("\n") : [] })
            }
          />
        </label>
        <label>
          {t("First weekday offset")}
          <input
            type="number"
            value={draft.weekOffset}
            onChange={(event) => change({ weekOffset: Number(event.target.value) })}
          />
        </label>
      </fieldset>
      <fieldset>
        <legend>{t("Leap years")}</legend>
        <label className="timeline-checkbox">
          <input
            type="checkbox"
            checked={Boolean(draft.leap)}
            onChange={(event) =>
              change({ leap: event.target.checked ? { every: 4, month: 1, days: 1 } : undefined })
            }
          />
          {t("Enable leap cycle")}
        </label>
        {draft.leap && (
          <div className="timeline-date-grid">
            {(["every", "exceptEvery", "includeEvery", "offset", "month", "days"] as const).map(
              (field) => (
                <label key={field}>
                  {t(
                    {
                      every: "Every N years",
                      exceptEvery: "Except every",
                      includeEvery: "Include every",
                      offset: "Cycle offset",
                      month: "Month number",
                      days: "Extra days",
                    }[field],
                  )}
                  <input
                    type="number"
                    value={draft.leap?.[field] ?? ""}
                    onChange={(event) =>
                      change({
                        leap: {
                          ...draft.leap!,
                          [field]:
                            event.target.value === "" ? undefined : Number(event.target.value),
                        },
                      })
                    }
                  />
                </label>
              ),
            )}
          </div>
        )}
      </fieldset>
      <fieldset>
        <legend>{t("Eras")}</legend>
        {draft.eras.map((era, i) => (
          <div className="timeline-calendar-entry" key={era.id}>
            <label>
              {t("Name")}
              <input
                value={era.name}
                onChange={(event) =>
                  change({
                    eras: draft.eras.map((entry, index) =>
                      index === i ? { ...entry, name: event.target.value } : entry,
                    ),
                  })
                }
              />
            </label>
            <div className="timeline-date-grid">
              <label>
                {t("Starts in base year")}
                <input
                  type="number"
                  value={era.startYear}
                  onChange={(event) =>
                    change({
                      eras: draft.eras.map((entry, index) =>
                        index === i ? { ...entry, startYear: Number(event.target.value) } : entry,
                      ),
                    })
                  }
                />
              </label>
              <label>
                {t("Suffix")}
                <input
                  value={era.suffix}
                  onChange={(event) =>
                    change({
                      eras: draft.eras.map((entry, index) =>
                        index === i ? { ...entry, suffix: event.target.value } : entry,
                      ),
                    })
                  }
                />
              </label>
              <label>
                {t("Resets year to")}
                <input
                  type="number"
                  value={era.resetYear ?? 1}
                  onChange={(event) =>
                    change({
                      eras: draft.eras.map((entry, index) =>
                        index === i ? { ...entry, resetYear: Number(event.target.value) } : entry,
                      ),
                    })
                  }
                />
              </label>
            </div>
            <small>
              {(() => {
                try {
                  const duration = eraDurationYears(draft, era.id);
                  return duration === undefined
                    ? t("Open-ended era")
                    : `${duration} ${t("years until next era")}`;
                } catch {
                  return t("Set valid era start years");
                }
              })()}
            </small>
            <button
              type="button"
              onClick={() => change({ eras: draft.eras.filter((_, index) => index !== i) })}
            >
              {t("Remove era")}
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            change({
              eras: [
                ...draft.eras,
                { id: uid(), name: "New era", suffix: "NE", startYear: draft.yearZero ? 0 : 1 },
              ],
            })
          }
        >
          {t("+ Era")}
        </button>
      </fieldset>
      <fieldset>
        <legend>{t("Moons")}</legend>
        {draft.moons.map((moon, i) => (
          <div className="timeline-calendar-entry" key={moon.id}>
            <label>
              {t("Name")}
              <input
                value={moon.name}
                onChange={(event) =>
                  change({
                    moons: draft.moons.map((entry, index) =>
                      index === i ? { ...entry, name: event.target.value } : entry,
                    ),
                  })
                }
              />
            </label>
            <div className="timeline-date-grid">
              <label>
                {t("Cycle in days")}
                <input
                  inputMode="decimal"
                  value={moon.periodDays}
                  onChange={(event) =>
                    change({
                      moons: draft.moons.map((entry, index) =>
                        index === i ? { ...entry, periodDays: event.target.value } : entry,
                      ),
                    })
                  }
                />
              </label>
              <label>
                {t("Offset in days")}
                <input
                  inputMode="decimal"
                  value={moon.offsetDays}
                  onChange={(event) =>
                    change({
                      moons: draft.moons.map((entry, index) =>
                        index === i ? { ...entry, offsetDays: event.target.value } : entry,
                      ),
                    })
                  }
                />
              </label>
            </div>
            <label>
              {t("Phases · one per line")}
              <textarea
                rows={3}
                value={moon.phases.join("\n")}
                onChange={(event) =>
                  change({
                    moons: draft.moons.map((entry, index) =>
                      index === i ? { ...entry, phases: event.target.value.split("\n") } : entry,
                    ),
                  })
                }
              />
            </label>
            <button
              type="button"
              onClick={() => change({ moons: draft.moons.filter((_, index) => index !== i) })}
            >
              {t("Remove moon")}
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            change({
              moons: [
                ...draft.moons,
                {
                  id: uid(),
                  name: "Moon",
                  periodDays: "28",
                  offsetDays: "0",
                  phases: ["New", "First quarter", "Full", "Last quarter"],
                },
              ],
            })
          }
        >
          {t("+ Moon")}
        </button>
      </fieldset>
      {error && (
        <p className="timeline-error" role="alert">
          {error}
        </p>
      )}
      <div className="timeline-panel-actions">
        <button type="button" onClick={apply}>
          {t("Apply calendar")}
        </button>
        {suppliedDraft && (
          <button
            type="button"
            onClick={() => {
              onDraftChange(undefined);
              setError("");
            }}
          >
            {t("Discard changes")}
          </button>
        )}
        {onSavePreset && (
          <button type="button" onClick={() => void savePreset()} disabled={saving}>
            <Save size={14} />
            {t(saving ? "Saving…" : "Save universe preset")}
          </button>
        )}
      </div>
    </section>
  );
}

export function TimelineEditor({
  document,
  onChange,
  vaultIndex,
  onOpenReference,
  session: suppliedSession,
  onSessionChange,
  active = true,
  locale = "en",
  calendarPresets = [],
  onSaveCalendarPreset,
}: TimelineEditorProps) {
  const t = timelineText(locale);
  const appActive = useAppIsActive();
  const documentActive = appActive && active;
  const documentRevision = JSON.stringify(document);
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const referenceListId = useId();
  const imageListId = useId();
  const [localSession, setLocalSession] = useState<TimelineSession>(suppliedSession ?? {});
  const session = (suppliedSession ?? localSession) as TimelineSession;
  const [initialBasis] = useState(() => initialScale(document.items));
  const scale = session.timelineScale ?? initialBasis;
  const [size, setSize] = useState({ width: 900, height: 600 });
  const view = session.viewport ?? { x: 80, y: size.height / 2, zoom: 1 };
  const filters = session.timelineFilters ?? EMPTY_FILTERS;
  const gestureRevision = `${documentRevision}:${JSON.stringify([scale, session.activeViewId, filters])}`;
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const viewName = String(session.drafts?.["timeline.viewName"]?.value ?? "");
  const [error, setError] = useState("");
  const [previewItem, setPreviewItem] = useState<TimelineItem>();
  type Drag = {
    revision: string;
    pointer: number;
    startX: number;
    startY: number;
    origin: VisualViewport;
    item?: TimelineItem;
    part?: "move" | "start" | "end";
    moved: boolean;
  };
  const drag = useRef<Drag | null>(null);
  const latestSession = useRef(session);
  latestSession.current = session;
  const updateSession = (patch: Partial<TimelineSession>) => {
    const next = { ...latestSession.current, ...patch };
    latestSession.current = next;
    setLocalSession(next);
    onSessionChange?.(next);
  };
  const updateDraft = (key: string, value: unknown, label: string) => {
    const drafts = { ...latestSession.current.drafts };
    if (value === undefined || value === "") delete drafts[key];
    else drafts[key] = { value, label };
    updateSession({ drafts });
  };
  const setViewName = (value: string) => updateDraft("timeline.viewName", value, t("View name"));
  const pendingDrafts = Object.entries(session.drafts ?? {}).filter(([key]) =>
    key.startsWith("timeline."),
  );
  useUniverseDraft(pendingDrafts.length > 0);
  useEffect(() => {
    const host = canvasRef.current;
    if (!host) return;
    const measure = () => {
      if (host.clientWidth && host.clientHeight)
        setSize({ width: host.clientWidth, height: host.clientHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !appActive) return;
    const preventScroll = (event: WheelEvent) => event.preventDefault();
    svg.addEventListener("wheel", preventScroll, { passive: false });
    return () => svg.removeEventListener("wheel", preventScroll);
  }, [appActive]);
  useEffect(() => {
    if (drag.current && (!appActive || drag.current.revision !== gestureRevision)) {
      drag.current = null;
      setPreviewItem(undefined);
    }
  }, [appActive, gestureRevision]);
  const selectedId = session.selectedIds?.[0];
  const selected = document.items.find((item) => item.id === selectedId);
  const allTags = [...new Set(document.items.flatMap((item) => item.tags))].sort();
  const visibleItems = document.items.filter(
    (item) =>
      filters.kinds.includes(item.kind) &&
      (!filters.tags.length || filters.tags.some((tag) => item.tags.includes(tag))) &&
      (!filters.search ||
        [item.title, item.description, ...item.tags]
          .join(" ")
          .toLowerCase()
          .includes(filters.search.toLowerCase())),
  );
  const cardWidth = Math.min(168, Math.max(100, size.width - 40));
  const positioned = timelineLayout(
    visibleItems.map((item) => (item.id === previewItem?.id ? previewItem : item)),
    scale,
    view.zoom,
    cardWidth,
  );
  const leftOrdinal = ordinalFor(viewportPoint(view, { x: 0, y: 0 }).x, scale);
  const rightOrdinal = ordinalFor(viewportPoint(view, { x: size.width, y: 0 }).x, scale);
  const step = tickStep(
    (rightOrdinal - leftOrdinal) / BigInt(Math.max(2, Math.floor(size.width / 155))),
    document.calendar,
  );
  const firstTick = floorDiv(leftOrdinal, step) * step;
  const ticks: { x: number; label: string }[] = [];
  for (let i = 0; i < 40; i++) {
    const ordinal = firstTick + BigInt(i) * step;
    if (ordinal > rightOrdinal) break;
    ticks.push({
      x: positionFor(ordinal, scale) * view.zoom,
      label: dateLabel(
        document.calendar,
        ordinal.toString(),
        step >= ticksPerDay(document.calendar) * 330n
          ? "year"
          : step >= ticksPerDay(document.calendar)
            ? "day"
            : "minute",
      ),
    });
  }
  const replaceItem = (item: TimelineItem, label = "Edit timeline item") =>
    onChange(
      { ...document, items: document.items.map((entry) => (entry.id === item.id ? item : entry)) },
      label,
    );
  const patchItem = (patch: Partial<TimelineItem>) => {
    if (selected) replaceItem({ ...selected, ...patch });
  };
  const zoom = (factor: number) =>
    updateSession({
      viewport: {
        ...zoomViewport(view, factor, { x: size.width / 2, y: size.height / 2 }),
        y: view.y,
      },
    });
  const fit = () => {
    const nextScale = initialScale(visibleItems);
    const endpoints = visibleItems.flatMap((item) => [
      parseOrdinal(item.start),
      ...(item.end ? [parseOrdinal(item.end)] : []),
    ]);
    const high = endpoints.reduce((a, b) => (a > b ? a : b), parseOrdinal(nextScale.origin));
    const span = high - parseOrdinal(nextScale.origin);
    const timeWidth = BigInt(Math.max(8, Math.floor(size.width - cardWidth - 48)));
    if (span > 0n)
      nextScale.ticksPerUnit = (
        (span * BigInt(PIXELS_PER_UNIT) + timeWidth - 1n) /
        timeWidth
      ).toString();
    const layout = timelineLayout(visibleItems, nextScale, 1, cardWidth);
    const left = Math.min(0, ...layout.map((item) => item.left));
    const right = Math.max(cardWidth, ...layout.map((item) => item.right));
    const top = Math.min(-32, ...layout.map((item) => item.y));
    const bottom = Math.max(
      32,
      ...layout.map((item) => item.y + (item.item.kind === "event" ? item.height : 34)),
    );
    updateSession({
      timelineScale: nextScale,
      viewport: {
        x: (size.width - (right - left)) / 2 - left,
        y: Math.max(12 - top, (size.height - (bottom - top)) / 2 - top),
        zoom: 1,
      },
    });
  };
  const addItem = (kind: "event" | "period") => {
    const start = ordinalFor(viewportPoint(view, { x: size.width / 2, y: 0 }).x, scale);
    const snapped =
      floorDiv(start, ticksPerDay(document.calendar)) * ticksPerDay(document.calendar);
    const item: TimelineItem = {
      id: uid(),
      kind,
      title: t(kind === "event" ? "New event" : "New period"),
      start: snapped.toString(),
      ...(kind === "period"
        ? { end: (snapped + ticksPerDay(document.calendar) * 30n).toString() }
        : {}),
      precision: "day",
      tags: [],
      color: COLOR_PRESETS[document.items.length % COLOR_PRESETS.length],
      icon: kind === "event" ? "flag" : "calendar",
    };
    onChange({ ...document, items: [...document.items, item] }, `Add ${kind}`);
    updateSession({ selectedIds: [item.id] });
  };
  const beginDrag = (
    event: ReactPointerEvent<SVGElement>,
    item?: TimelineItem,
    part: "move" | "start" | "end" = "move",
  ) => {
    if (!appActive || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    if (item) updateSession({ selectedIds: [item.id] });
    else if (!(event.target as Element).closest("[data-timeline-item]"))
      updateSession({ selectedIds: [] });
    drag.current = {
      revision: gestureRevision,
      pointer: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: view,
      item,
      part,
      moved: false,
    };
    svgRef.current?.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = drag.current;
    if (
      !current ||
      !appActive ||
      current.revision !== gestureRevision ||
      current.pointer !== event.pointerId
    )
      return;
    const dx = event.clientX - current.startX,
      dy = event.clientY - current.startY;
    current.moved ||= Math.abs(dx) + Math.abs(dy) > 3;
    if (!current.item) {
      updateSession({
        viewport: { ...current.origin, x: current.origin.x + dx, y: current.origin.y + dy },
      });
      return;
    }
    const delta =
      (BigInt(Math.round((dx / current.origin.zoom / PIXELS_PER_UNIT) * 1_000_000)) *
        parseOrdinal(scale.ticksPerUnit)) /
      1_000_000n;
    const day = ticksPerDay(document.calendar);
    const snap =
      current.item.precision === "year" ||
      current.item.precision === "month" ||
      current.item.precision === "day"
        ? day
        : 1n;
    const snapped = floorDiv(delta + snap / 2n, snap) * snap;
    const next = { ...current.item };
    if (current.part !== "end") next.start = (parseOrdinal(next.start) + snapped).toString();
    if (next.end && current.part !== "start")
      next.end = (parseOrdinal(next.end) + snapped).toString();
    if (next.end && parseOrdinal(next.end) < parseOrdinal(next.start)) return;
    setPreviewItem(next);
  };
  const finishDrag = (cancel = false, pointer?: number) => {
    const current = drag.current;
    if (pointer !== undefined && current && pointer !== current.pointer) return;
    drag.current = null;
    if (
      !cancel &&
      current?.moved &&
      current.revision === gestureRevision &&
      previewItem &&
      appActive
    )
      replaceItem(
        previewItem,
        current.part === "move" ? "Move timeline item" : "Resize timeline period",
      );
    setPreviewItem(undefined);
  };
  const filterPatch = (patch: Partial<TimelineFilters>) =>
    updateSession({ timelineFilters: { ...filters, ...patch }, activeViewId: undefined });
  const applyView = (id: string) => {
    const saved = document.views.find((candidate) => candidate.id === id);
    updateSession({
      activeViewId: id || undefined,
      timelineFilters: saved
        ? { tags: [...saved.tags], kinds: [...saved.kinds], search: saved.search ?? "" }
        : EMPTY_FILTERS,
    });
    if (saved?.range) {
      const origin = parseOrdinal(saved.range.start),
        end = parseOrdinal(saved.range.end);
      if (end > origin)
        updateSession({
          timelineScale: {
            origin: origin.toString(),
            ticksPerUnit: ((end - origin) / 6n + 1n).toString(),
          },
          viewport: { x: 60, y: size.height / 2, zoom: Math.max(0.1, (size.width - 120) / 600) },
        });
    }
  };
  const saveView = () => {
    if (!viewName.trim()) return;
    const saved: TimelineSavedView = {
      id: uid(),
      name: viewName.trim(),
      tags: [...filters.tags],
      kinds: [...filters.kinds],
      search: filters.search || undefined,
    };
    onChange({ ...document, views: [...document.views, saved] }, "Save timeline view");
    updateSession({ activeViewId: saved.id });
    setViewName("");
  };
  const deleteSelected = () => {
    if (!selected) return;
    if (pendingDrafts.some(([key]) => key.startsWith(`timeline.date:${selected.id}:`))) {
      setError(t("Apply or discard date drafts before deleting this item."));
      return;
    }
    finishDrag(true);
    onChange(
      { ...document, items: document.items.filter((item) => item.id !== selected.id) },
      "Delete timeline item",
    );
    updateSession({ selectedIds: [] });
  };
  const referenceChoices = vaultIndex?.entities ?? [];
  const brokenReference = Boolean(
    selected?.reference &&
    resolveVisualDocumentReference(vaultIndex, selected.reference).status !== "resolved",
  );
  const calendarIssues = validateCalendar(document.calendar);
  if (calendarIssues.length)
    return (
      <section className="timeline-editor timeline-invalid" role="alert">
        {t("Calendar needs repair:")}
        {calendarIssues.join("; ")}
        {t(". Open Source to preserve and repair this document.")}
      </section>
    );

  return (
    <TimelineTextContext.Provider value={t}>
      <section
        className="timeline-editor"
        inert={!appActive}
        aria-label={locale === "es" ? "Editor de cronología" : "Timeline editor"}
        data-active={appActive}
        data-document-active={documentActive}
      >
        <div className="timeline-toolbar">
          <div className="timeline-toolbar-group">
            <button type="button" onClick={() => addItem("event")}>
              <Flag size={15} />
              {locale === "es" ? "Evento" : "Event"}
            </button>
            <button type="button" onClick={() => addItem("period")}>
              <Plus size={15} />
              {locale === "es" ? "Periodo" : "Period"}
            </button>
          </div>
          <div className="timeline-toolbar-group">
            <button
              type="button"
              onClick={() => zoom(1 / 1.25)}
              title={t("Zoom out")}
              aria-label={t("Zoom out")}
            >
              <ZoomOut size={16} />
            </button>
            <button
              type="button"
              onClick={() => zoom(1.25)}
              title={t("Zoom in")}
              aria-label={t("Zoom in")}
            >
              <ZoomIn size={16} />
            </button>
            <button
              type="button"
              onClick={fit}
              title={t("Fit timeline")}
              aria-label={t("Fit timeline")}
            >
              <Crosshair size={16} />
            </button>
          </div>
          <button
            type="button"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            <Filter size={15} />
            {visibleItems.length}/{document.items.length}
          </button>
          <select
            aria-label={t("Saved timeline view")}
            value={session.activeViewId ?? ""}
            onChange={(event) => applyView(event.target.value)}
          >
            <option value="">{t("All / custom view")}</option>
            {document.views.map((saved) => (
              <option key={saved.id} value={saved.id}>
                {saved.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="timeline-calendar-button"
            aria-expanded={calendarOpen}
            onClick={() => setCalendarOpen(!calendarOpen)}
          >
            <Calendar size={15} />
            {document.calendar.name}
            <Settings2 size={13} />
          </button>
        </div>
        {pendingDrafts.length > 0 && (
          <div className="timeline-pending-drafts" role="status">
            <strong>{t("Pending changes")}</strong>
            {pendingDrafts.map(([key, draft]) => (
              <span key={key}>
                <button
                  type="button"
                  onClick={() => {
                    if (key === "timeline.calendar") setCalendarOpen(true);
                    else if (key === "timeline.viewName") setFiltersOpen(true);
                    else {
                      const id = key.slice("timeline.date:".length).replace(/:(start|end)$/, "");
                      updateSession({ selectedIds: [id] });
                      setCalendarOpen(false);
                    }
                  }}
                >
                  {t("Review")}: {draft.label}
                </button>
                <button
                  type="button"
                  onClick={() => updateDraft(key, undefined, draft.label)}
                  aria-label={`${t("Discard")}: ${draft.label}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        {filtersOpen && (
          <div className="timeline-filters" aria-label={t("Timeline filters")}>
            <label>
              {t("Search")}
              <input
                placeholder={t("Title, description, tags…")}
                value={filters.search}
                onChange={(event) => filterPatch({ search: event.target.value })}
              />
            </label>
            <div className="timeline-filter-checks">
              {(["event", "period"] as const).map((kind) => (
                <label className="timeline-checkbox" key={kind}>
                  <input
                    type="checkbox"
                    checked={filters.kinds.includes(kind)}
                    onChange={(event) =>
                      filterPatch({
                        kinds: event.target.checked
                          ? [...filters.kinds, kind]
                          : filters.kinds.filter((value) => value !== kind),
                      })
                    }
                  />
                  {t(kind)}
                </label>
              ))}
              {allTags.map((tag) => (
                <label className="timeline-checkbox" key={tag}>
                  <input
                    type="checkbox"
                    checked={filters.tags.includes(tag)}
                    onChange={(event) =>
                      filterPatch({
                        tags: event.target.checked
                          ? [...filters.tags, tag]
                          : filters.tags.filter((value) => value !== tag),
                      })
                    }
                  />
                  {tag}
                </label>
              ))}
            </div>
            <div className="timeline-save-view">
              <input
                aria-label={t("New view name")}
                placeholder={t("View name…")}
                value={viewName}
                onChange={(event) => setViewName(event.target.value)}
              />
              <button type="button" disabled={!viewName.trim()} onClick={saveView}>
                {t("Save view")}
              </button>
              {session.activeViewId && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(
                      {
                        ...document,
                        views: document.views.filter((saved) => saved.id !== session.activeViewId),
                      },
                      "Delete saved view",
                    );
                    updateSession({ activeViewId: undefined });
                  }}
                >
                  {t("Delete view")}
                </button>
              )}
            </div>
          </div>
        )}
        <div className="timeline-editor-workspace">
          <div className="timeline-canvas" ref={canvasRef}>
            <svg
              ref={svgRef}
              role="img"
              aria-label={t("Timeline canvas: events above the axis and periods below")}
              width="100%"
              height="100%"
              onPointerDown={beginDrag}
              onPointerMove={moveDrag}
              onPointerUp={(event) => finishDrag(false, event.pointerId)}
              onPointerCancel={(event) => finishDrag(true, event.pointerId)}
              onWheel={(event) => {
                if (!appActive) return;
                const rect = event.currentTarget.getBoundingClientRect();
                updateSession({
                  viewport: {
                    ...zoomViewport(view, event.deltaY < 0 ? 1.12 : 1 / 1.12, {
                      x: event.clientX - rect.left,
                      y: event.clientY - rect.top,
                    }),
                    y: view.y,
                  },
                });
              }}
              onKeyDown={(event) => {
                if (!documentActive || event.target !== event.currentTarget) return;
                if (event.key === "Delete" || event.key === "Backspace") {
                  event.preventDefault();
                  deleteSelected();
                }
                if (event.key === "Escape") {
                  finishDrag(true);
                  updateSession({ selectedIds: [] });
                }
              }}
              tabIndex={0}
            >
              <rect width="100%" height="100%" className="timeline-canvas-background" />
              <g className="timeline-content" transform={`translate(${view.x} ${view.y})`}>
                <line
                  x1={-view.x}
                  x2={size.width - view.x}
                  y1="0"
                  y2="0"
                  className="timeline-axis"
                />
                {ticks.map((tick, i) => (
                  <g key={i} transform={`translate(${tick.x} 0)`}>
                    <line y1="-7" y2="7" className="timeline-axis-tick" />
                    <text y="22" textAnchor="middle" className="timeline-tick-label">
                      {tick.label}
                    </text>
                  </g>
                ))}
                {positioned.map(({ item, x, endX, y, height }) => {
                  const Icon = getIconComponent(item.icon);
                  const selectedItem = selectedId === item.id;
                  return (
                    <g
                      key={item.id}
                      data-timeline-item={item.id}
                      data-timeline-lane-y={y}
                      className={`timeline-item ${item.kind} ${selectedItem ? "selected" : ""}`}
                      style={
                        {
                          "--timeline-item-color": item.color ?? COLOR_PRESETS[0],
                        } as React.CSSProperties
                      }
                      onPointerDown={(event) => beginDrag(event, item)}
                      onDoubleClick={() => item.reference && onOpenReference?.(item.reference)}
                      role="button"
                      aria-label={`${item.title}: ${dateLabel(document.calendar, item.start, item.precision)}`}
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (documentActive && (event.key === "Enter" || event.key === " ")) {
                          event.preventDefault();
                          updateSession({ selectedIds: [item.id] });
                        }
                      }}
                    >
                      <title>
                        {item.title} · {dateLabel(document.calendar, item.start, item.precision)}
                        {item.end
                          ? ` — ${dateLabel(document.calendar, item.end, item.endPrecision ?? item.precision)}`
                          : ""}
                      </title>
                      {item.kind === "event" ? (
                        <>
                          <line
                            x1={x}
                            x2={x}
                            y1="0"
                            y2={y + height}
                            className="timeline-event-stem"
                          />
                          <circle cx={x} cy="0" r="5" />
                          <rect
                            x={x - 10}
                            y={y}
                            width={cardWidth}
                            height={height}
                            rx="8"
                            className="timeline-item-card"
                          />
                          <Icon x={x} y={y + 10} width={15} height={15} />
                          <text x={x + 24} y={y + 21} className="timeline-item-title">
                            {elideTimelineText(item.title, cardWidth - 42)}
                          </text>
                          <text x={x} y={y + 43} className="timeline-item-date">
                            {elideTimelineText(
                              dateLabel(document.calendar, item.start, item.precision),
                              cardWidth - 20,
                              5.5,
                            )}
                          </text>
                          {item.image && (
                            <TimelineImage
                              index={vaultIndex}
                              path={item.image}
                              x={x + cardWidth - 52}
                              y={y + 32}
                              width={32}
                              height={32}
                            />
                          )}
                        </>
                      ) : (
                        <>
                          <rect
                            x={x}
                            y={y}
                            width={Math.max(20, endX - x)}
                            height="34"
                            rx="6"
                            className="timeline-period-bar"
                          />
                          <rect
                            x={x + 4}
                            y={y + 4}
                            width={cardWidth - 8}
                            height="26"
                            rx="4"
                            className="timeline-period-label"
                          />
                          <Icon x={x + 8} y={y + 9} width={15} height={15} />
                          <text x={x + 29} y={y + 22} className="timeline-item-title">
                            {elideTimelineText(item.title, cardWidth - 40)}
                          </text>
                          {selectedItem && (
                            <>
                              <rect
                                x={x - 4}
                                y={y + 4}
                                width="8"
                                height="26"
                                rx="3"
                                className="timeline-period-handle"
                                aria-label={t("Resize period start")}
                                onPointerDown={(event) => beginDrag(event, item, "start")}
                              />
                              <rect
                                x={endX - 4}
                                y={y + 4}
                                width="8"
                                height="26"
                                rx="3"
                                className="timeline-period-handle"
                                aria-label={t("Resize period end")}
                                onPointerDown={(event) => beginDrag(event, item, "end")}
                              />
                            </>
                          )}
                        </>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
            {!document.items.length && (
              <div className="timeline-empty">
                <Calendar size={32} />
                <h3>{locale === "es" ? "Tu historia en el tiempo" : "Your story through time"}</h3>
                <p>{t("Add an event or period, then set its date in the inspector.")}</p>
                <button type="button" onClick={() => addItem("event")}>
                  {t("+ First event")}
                </button>
              </div>
            )}
            <div className="timeline-canvas-help">
              {Math.round(view.zoom * 100)}
              {t("% · Drag to pan · Wheel to zoom · Drag an item to move")}
            </div>
          </div>
          {(calendarOpen || selected) && (
            <aside className="timeline-inspector" aria-label={t("Timeline inspector")}>
              {calendarOpen ? (
                <CalendarSettings
                  value={document.calendar}
                  draft={
                    session.drafts?.["timeline.calendar"]?.value as CalendarDefinition | undefined
                  }
                  onDraftChange={(next) =>
                    updateDraft("timeline.calendar", next, t("Calendar changes"))
                  }
                  presets={[
                    EARTH_CALENDAR,
                    GENERIC_CALENDAR,
                    ...calendarPresets.filter(
                      (preset) => !["earth", "generic"].includes(preset.id),
                    ),
                  ]}
                  onClose={() => setCalendarOpen(false)}
                  onApply={(calendar) => {
                    if (pendingDrafts.some(([key]) => key.startsWith("timeline.date:")))
                      return false;
                    onChange({ ...document, calendar }, "Change calendar lens");
                    return true;
                  }}
                  onSavePreset={onSaveCalendarPreset}
                />
              ) : (
                selected && (
                  <>
                    <div className="timeline-inspector-heading">
                      <h3>{t(selected.kind === "event" ? "Event" : "Period")}</h3>
                      <button
                        type="button"
                        aria-label={t("Close item inspector")}
                        onClick={() => updateSession({ selectedIds: [] })}
                      >
                        ×
                      </button>
                    </div>
                    <label>
                      {t("Title")}
                      <input
                        value={selected.title}
                        onChange={(event) => patchItem({ title: event.target.value })}
                      />
                    </label>
                    <label>
                      {t("Description")}
                      <textarea
                        rows={3}
                        value={selected.description ?? ""}
                        onChange={(event) => patchItem({ description: event.target.value })}
                      />
                    </label>
                    <DateFields
                      key={`${selected.id}:start`}
                      calendar={document.calendar}
                      ordinal={selected.start}
                      precision={selected.precision}
                      label={t(selected.kind === "period" ? "Start" : "Date")}
                      draft={
                        session.drafts?.[`timeline.date:${selected.id}:start`]?.value as
                          CalendarDate | undefined
                      }
                      onDraftChange={(next) =>
                        updateDraft(
                          `timeline.date:${selected.id}:start`,
                          next,
                          `${selected.title} · ${t("Start")}`,
                        )
                      }
                      onApply={(start, precision) => {
                        if (selected.end && parseOrdinal(start) > parseOrdinal(selected.end)) {
                          setError(t("Start must not be after the period end"));
                          return false;
                        }
                        setError("");
                        patchItem({ start, precision });
                      }}
                    />
                    {selected.kind === "period" && (
                      <DateFields
                        key={`${selected.id}:end`}
                        calendar={document.calendar}
                        ordinal={selected.end ?? selected.start}
                        precision={selected.endPrecision ?? selected.precision}
                        label={t("End")}
                        draft={
                          session.drafts?.[`timeline.date:${selected.id}:end`]?.value as
                            CalendarDate | undefined
                        }
                        onDraftChange={(next) =>
                          updateDraft(
                            `timeline.date:${selected.id}:end`,
                            next,
                            `${selected.title} · ${t("End")}`,
                          )
                        }
                        onApply={(end, endPrecision) => {
                          if (parseOrdinal(end) < parseOrdinal(selected.start)) {
                            setError(t("End must not be before the period start"));
                            return false;
                          }
                          setError("");
                          patchItem({ end, endPrecision });
                        }}
                      />
                    )}
                    {error && (
                      <p className="timeline-error" role="alert">
                        {error}
                      </p>
                    )}
                    <div className="timeline-nudge">
                      <button
                        type="button"
                        title={t("Move one day earlier")}
                        onClick={() => {
                          const delta = ticksPerDay(document.calendar);
                          patchItem({
                            start: (parseOrdinal(selected.start) - delta).toString(),
                            ...(selected.end
                              ? { end: (parseOrdinal(selected.end) - delta).toString() }
                              : {}),
                          });
                        }}
                      >
                        <ChevronLeft size={14} />
                        {t("One day")}
                      </button>
                      <button
                        type="button"
                        title={t("Move one day later")}
                        onClick={() => {
                          const delta = ticksPerDay(document.calendar);
                          patchItem({
                            start: (parseOrdinal(selected.start) + delta).toString(),
                            ...(selected.end
                              ? { end: (parseOrdinal(selected.end) + delta).toString() }
                              : {}),
                          });
                        }}
                      >
                        {t("One day")}
                        <ChevronRight size={14} />
                      </button>
                    </div>
                    <label>
                      {t("Canon reference")}
                      <input
                        list={referenceListId}
                        value={selected.reference ?? ""}
                        placeholder={t("Entity id or note path")}
                        onChange={(event) =>
                          patchItem({ reference: event.target.value || undefined })
                        }
                      />
                    </label>
                    <datalist id={referenceListId}>
                      {referenceChoices.map((entity) => (
                        <option key={entity.path} value={entity.path}>
                          {entity.name}
                        </option>
                      ))}
                    </datalist>
                    {selected.reference && (
                      <>
                        <button
                          type="button"
                          disabled={brokenReference}
                          onClick={() => onOpenReference?.(selected.reference!)}
                        >
                          {t("Open linked note")}
                        </button>
                        {brokenReference && (
                          <p className="timeline-hint">
                            {t("Reference not found in this universe. It is preserved.")}
                          </p>
                        )}
                      </>
                    )}
                    <label>
                      {t("Image")}
                      <input
                        list={imageListId}
                        value={selected.image ?? ""}
                        placeholder={t("Vault-relative image path")}
                        onChange={(event) => patchItem({ image: event.target.value || undefined })}
                      />
                    </label>
                    <datalist id={imageListId}>
                      {vaultIndex?.files
                        .filter((file) => isImagePath(file.relativePath))
                        .map((file) => (
                          <option key={file.relativePath} value={file.relativePath} />
                        ))}
                    </datalist>
                    <div className="timeline-date-grid">
                      <label>
                        {t("Color")}
                        <input
                          type="color"
                          value={
                            /^#[0-9a-f]{6}$/i.test(selected.color ?? "")
                              ? selected.color
                              : COLOR_PRESETS[0]
                          }
                          onChange={(event) => patchItem({ color: event.target.value })}
                        />
                      </label>
                      <label>
                        {t("Icon")}
                        <select
                          value={selected.icon ?? "flag"}
                          onChange={(event) => patchItem({ icon: event.target.value })}
                        >
                          {ICON_PRESETS.map((icon) => (
                            <option key={icon}>{icon}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <TimelineTags
                      key={selected.id}
                      tags={selected.tags}
                      onChange={(tags) => patchItem({ tags })}
                    />
                    <label>
                      {t("Lane")}
                      <input
                        type="number"
                        min="0"
                        placeholder={t("Automatic")}
                        value={selected.lane ?? ""}
                        onChange={(event) =>
                          patchItem({
                            lane:
                              event.target.value === ""
                                ? undefined
                                : Math.max(0, Math.floor(Number(event.target.value))),
                          })
                        }
                      />
                    </label>
                    <button type="button" className="timeline-delete" onClick={deleteSelected}>
                      <Trash2 size={14} />
                      {t("Delete")} {t(selected.kind)}
                    </button>
                  </>
                )
              )}
            </aside>
          )}
        </div>
      </section>
    </TimelineTextContext.Provider>
  );
}
