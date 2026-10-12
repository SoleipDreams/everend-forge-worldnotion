import {
  copyCalendar,
  EARTH_CALENDAR,
  type CalendarDefinition,
  type CalendarPrecision,
} from "./calendar";

export type TimelineItem = {
  id: string;
  kind: "event" | "period";
  title: string;
  description?: string;
  /** Exact ordinal ticks as decimal strings: always preserved on calendar changes. */
  start: string;
  end?: string;
  precision: CalendarPrecision;
  endPrecision?: CalendarPrecision;
  color?: string;
  icon?: string;
  tags: string[];
  reference?: string;
  image?: string;
  lane?: number;
};
export type TimelineSavedView = {
  id: string;
  name: string;
  tags: string[];
  kinds: ("event" | "period")[];
  search?: string;
  /** An authored temporal range is distinct from local pan/zoom. */
  range?: { start: string; end: string };
};
export type TimelineDocument = {
  version: 1;
  kind: "timeline";
  calendar: CalendarDefinition;
  items: TimelineItem[];
  views: TimelineSavedView[];
};
export function createTimelineDocument(
  calendar: CalendarDefinition = EARTH_CALENDAR,
): TimelineDocument {
  return { version: 1, kind: "timeline", calendar: copyCalendar(calendar), items: [], views: [] };
}
