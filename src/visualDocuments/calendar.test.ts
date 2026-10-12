import { describe, expect, it } from "vitest";
import {
  CALENDAR_PRECISIONS,
  EARTH_CALENDAR,
  GENERIC_CALENDAR,
  calendarDateBounds,
  copyCalendar,
  daysInMonth,
  formatCalendarDate,
  formatCalendarYear,
  eraDurationYears,
  fromOrdinal,
  isLeapYear,
  moonPhasesAt,
  ticksPerDay,
  toOrdinal,
  validateCalendar,
  weekdayAt,
  yearFromEra,
  yearInEra,
} from "./calendar";
import { createTimelineDocument } from "./timelineTypes";
import {
  parseCalendarPresets,
  serializeCalendarPresets,
  upsertCalendarPreset,
} from "./calendarPresets";

describe("exact ordinal calendar", () => {
  it("round trips Earth dates across leap boundaries and negative years without a Date API", () => {
    for (const year of [
      -10_000, -401, -400, -101, -100, -4, -1, 1, 4, 100, 400, 1900, 2000, 2024, 1_000_000,
    ]) {
      for (let month = 1; month <= 12; month++) {
        const date = {
          year,
          month,
          day: daysInMonth(EARTH_CALENDAR, year, month),
          hour: 23,
          minute: 59,
          second: 59,
        };
        expect(fromOrdinal(EARTH_CALENDAR, toOrdinal(EARTH_CALENDAR, date))).toMatchObject(date);
      }
    }
  });
  it("implements proleptic Gregorian centuries and skips civil year zero", () => {
    expect(isLeapYear(EARTH_CALENDAR, 1900)).toBe(false);
    expect(isLeapYear(EARTH_CALENDAR, 2000)).toBe(true);
    expect(isLeapYear(EARTH_CALENDAR, -1)).toBe(true);
    expect(() => toOrdinal(EARTH_CALENDAR, { year: 0 })).toThrow("no year zero");
    expect(toOrdinal(EARTH_CALENDAR, { year: 1 })).toBe(0n);
    expect(fromOrdinal(EARTH_CALENDAR, -1n)).toMatchObject({
      year: -1,
      month: 12,
      day: 31,
      hour: 23,
      minute: 59,
      second: 59,
    });
  });
  it("retains precision and reports half-open exact bounds", () => {
    const date = { year: 2024, month: 2, day: 29, hour: 12, minute: 34, second: 56 };
    const expected = [366n * 86400n, 29n * 86400n, 86400n, 3600n, 60n, 1n];
    CALENDAR_PRECISIONS.forEach((precision, index) => {
      const bounds = calendarDateBounds(EARTH_CALENDAR, { ...date, precision });
      expect(bounds.endExclusive - bounds.start).toBe(expected[index]);
      expect(fromOrdinal(EARTH_CALENDAR, bounds.start, precision).precision).toBe(precision);
    });
    expect(calendarDateBounds(EARTH_CALENDAR, { year: -1, precision: "year" }).endExclusive).toBe(
      0n,
    );
  });
  it("supports arbitrary month lengths, hours, weeks, leap offsets, and year zero", () => {
    const calendar = copyCalendar(GENERIC_CALENDAR);
    calendar.months = [
      { id: "a", name: "Ash", days: 11 },
      { id: "b", name: "Rain", days: 7 },
    ];
    calendar.hoursPerDay = 10;
    calendar.minutesPerHour = 13;
    calendar.secondsPerMinute = 17;
    calendar.weekdays = ["Dawn", "Dusk", "Night"];
    calendar.weekOffset = 1;
    calendar.leap = { every: 3, offset: 1, month: 2, days: 2 };
    for (const year of [-10_000, -2, -1, 0, 1, 2, 3, 4, 100_000]) {
      const date = {
        year,
        month: 2,
        day: daysInMonth(calendar, year, 2),
        hour: 9,
        minute: 12,
        second: 16,
      };
      expect(fromOrdinal(calendar, toOrdinal(calendar, date))).toMatchObject(date);
    }
    expect(daysInMonth(calendar, 1, 2)).toBe(9);
    expect(weekdayAt(calendar, -ticksPerDay(calendar))).toEqual({ index: 0, name: "Dawn" });
  });
  it("does not truncate very large exact tick values through Number", () => {
    const date = { year: 900_000_000, month: 12, day: 31, hour: 23, minute: 59, second: 59 };
    const ordinal = toOrdinal(EARTH_CALENDAR, date);
    expect(ordinal > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(fromOrdinal(EARTH_CALENDAR, ordinal.toString())).toMatchObject(date);
  });
  it("rejects impossible days, out-of-clock values and malformed ordinals", () => {
    expect(() => toOrdinal(EARTH_CALENDAR, { year: 1900, month: 2, day: 29 })).toThrow("Day");
    expect(() => toOrdinal(EARTH_CALENDAR, { year: 2000, hour: 24 })).toThrow("Hour");
    expect(() => fromOrdinal(EARTH_CALENDAR, "1.5")).toThrow("integer string");
    const bad = copyCalendar(GENERIC_CALENDAR);
    bad.leap = { every: 4, exceptEvery: 6, month: 1, days: 1 };
    expect(validateCalendar(bad)).toContain("Leap exception must be a multiple of the leap cycle");
  });
  it("formats suffixes and ordered eras across the no-zero boundary", () => {
    const calendar = copyCalendar(EARTH_CALENDAR);
    calendar.eras = [{ id: "new", name: "New age", suffix: "NA", startYear: 2000 }];
    expect(formatCalendarYear(calendar, 2000)).toBe("1 NA");
    expect(formatCalendarYear(calendar, 2024)).toBe("25 NA");
    expect(formatCalendarDate(calendar, { year: -1, month: 2, day: 3, precision: "day" })).toBe(
      "3 February 1 BCE",
    );
  });
  it("resets weekdays per month when configured and keeps continuous weeks otherwise", () => {
    const calendar = copyCalendar(GENERIC_CALENDAR);
    const firstMonth = toOrdinal(calendar, { year: -2, month: 1, day: 1 });
    const secondMonth = toOrdinal(calendar, { year: -2, month: 2, day: 1 });
    expect(weekdayAt(calendar, firstMonth)?.index).not.toBe(
      weekdayAt(calendar, secondMonth)?.index,
    );
    calendar.weekMode = "monthly";
    expect(weekdayAt(calendar, firstMonth)?.index).toBe(0);
    expect(weekdayAt(calendar, secondMonth)?.index).toBe(0);
  });
  it("converts era presentation in both directions without changing the underlying instant", () => {
    const calendar = copyCalendar(EARTH_CALENDAR);
    calendar.eras = [
      { id: "old", name: "Old", suffix: "OA", startYear: -2, resetYear: 0 },
      { id: "new", name: "New", suffix: "NA", startYear: 2, resetYear: 1 },
    ];
    expect(eraDurationYears(calendar, "old")).toBe(3n);
    expect(yearInEra(calendar, 1, "old")).toBe(2);
    expect(yearFromEra(calendar, 2, "old")).toBe(1);
    for (const year of [-4, -2, -1, 1, 2, 10])
      expect(yearFromEra(calendar, yearInEra(calendar, year, "new"), "new")).toBe(year);
  });
  it("computes exact fractional moon phases and wraps before epoch", () => {
    const calendar = copyCalendar(GENERIC_CALENDAR);
    calendar.moons = [
      { id: "red", name: "Red", periodDays: "2.5", offsetDays: "0.5", phases: ["New", "Full"] },
    ];
    expect(moonPhasesAt(calendar, ticksPerDay(calendar) / 2n)[0].phase).toBe("New");
    expect(moonPhasesAt(calendar, (ticksPerDay(calendar) * 7n) / 4n)[0].phase).toBe("Full");
    expect(moonPhasesAt(calendar, -1n)[0].phase).toBe("Full");
  });
  it("copies universe presets and never changes stored ordinals when changing lens", () => {
    const document = createTimelineDocument(EARTH_CALENDAR);
    document.items.push({
      id: "event",
      kind: "event",
      title: "Event",
      start: "9007199254740993",
      precision: "second",
      tags: [],
    });
    document.calendar.months[0].name = "Changed locally";
    expect(EARTH_CALENDAR.months[0].name).toBe("January");
    document.calendar = copyCalendar(GENERIC_CALENDAR);
    expect(document.items[0].start).toBe("9007199254740993");
    const presets = upsertCalendarPreset([], document.calendar);
    document.calendar.months[0].name = "Another edit";
    expect(presets[0].months[0].name).toBe("Month 1");
    expect(parseCalendarPresets(serializeCalendarPresets(presets)).calendars).toEqual(presets);
    expect(parseCalendarPresets('{"version":2,"calendars":[]}').issues.length).toBe(1);
  });
});
