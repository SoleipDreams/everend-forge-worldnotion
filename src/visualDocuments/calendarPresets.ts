import {
  copyCalendar,
  EARTH_CALENDAR,
  GENERIC_CALENDAR,
  validateCalendar,
  type CalendarDefinition,
} from "./calendar";

export const CALENDAR_PRESETS_PATH = ".everend/calendars.json";
export type CalendarPresetFile = { version: 1; calendars: CalendarDefinition[] };
export const BUILTIN_CALENDAR_PRESETS = [EARTH_CALENDAR, GENERIC_CALENDAR];

/** The caller owns vault I/O; preset parsing never edits a timeline snapshot. */
export function parseCalendarPresets(content: string | undefined): {
  calendars: CalendarDefinition[];
  issues: string[];
} {
  if (!content?.trim()) return { calendars: [], issues: [] };
  try {
    const file = JSON.parse(content) as CalendarPresetFile;
    if (file.version !== 1 || !Array.isArray(file.calendars))
      return {
        calendars: [],
        issues: ["Unsupported calendar preset file; expected version 1 and calendars array"],
      };
    const calendars: CalendarDefinition[] = [];
    const issues: string[] = [];
    const ids = new Set<string>();
    file.calendars.forEach((value, index) => {
      try {
        const errors = validateCalendar(value);
        if (!value.id?.trim()) errors.push("Calendar id is required");
        if (ids.has(value.id)) errors.push("Calendar ids must be unique");
        if (errors.length) {
          issues.push(`Preset ${index + 1}: ${errors.join("; ")}`);
          return;
        }
        ids.add(value.id);
        calendars.push(copyCalendar(value));
      } catch {
        issues.push(`Preset ${index + 1}: invalid calendar definition`);
      }
    });
    return { calendars, issues };
  } catch {
    return { calendars: [], issues: ["Calendar preset file is not valid JSON"] };
  }
}
export function serializeCalendarPresets(calendars: CalendarDefinition[]): string {
  const content = JSON.stringify({ version: 1, calendars }, null, 2);
  const parsed = parseCalendarPresets(content);
  if (parsed.issues.length) throw new RangeError(parsed.issues.join("; "));
  return `${content}\n`;
}
export function upsertCalendarPreset(
  calendars: CalendarDefinition[],
  calendar: CalendarDefinition,
): CalendarDefinition[] {
  const copy = copyCalendar(calendar);
  const result = calendars.filter((entry) => entry.id !== calendar.id);
  return [...result, copy];
}
