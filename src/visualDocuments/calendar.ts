/** Calendar arithmetic is integer-only and does not depend on Date, locale or timezone.
 * Ordinals count fixed ticks from the document's epoch. One tick is one clock second;
 * changing the calendar is a new lens over the same stored ordinal, never a rewrite. */
export type CalendarPrecision = "year" | "month" | "day" | "hour" | "minute" | "second";
export const CALENDAR_PRECISIONS: CalendarPrecision[] = [
  "year",
  "month",
  "day",
  "hour",
  "minute",
  "second",
];
export type CalendarDate = {
  year: number;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
  second?: number;
  precision?: CalendarPrecision;
};
export type CalendarDefinition = {
  id: string;
  name: string;
  months: { id: string; name: string; days: number }[];
  hoursPerDay: number;
  minutesPerHour: number;
  secondsPerMinute: number;
  weekdays: string[];
  weekOffset: number;
  weekMode?: "continuous" | "monthly";
  yearZero: boolean;
  yearSuffix: string;
  negativeYearSuffix?: string;
  leap?: {
    every: number;
    exceptEvery?: number;
    includeEvery?: number;
    offset?: number;
    month: number;
    days: number;
  };
  eras: { id: string; name: string; suffix: string; startYear: number; resetYear?: number }[];
  /** Decimal strings retain fractional moon cycles exactly, without floating point. */
  moons: { id: string; name: string; periodDays: string; offsetDays: string; phases: string[] }[];
};

export const EARTH_CALENDAR: CalendarDefinition = {
  id: "earth",
  name: "Earth · Gregorian",
  yearZero: false,
  yearSuffix: "CE",
  negativeYearSuffix: "BCE",
  months: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31].map((days, i) => ({
    id: `month-${i + 1}`,
    name: [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ][i],
    days,
  })),
  hoursPerDay: 24,
  minutesPerHour: 60,
  secondsPerMinute: 60,
  weekdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  weekOffset: 0,
  leap: { every: 4, exceptEvery: 100, includeEvery: 400, month: 2, days: 1 },
  eras: [],
  moons: [
    {
      id: "moon",
      name: "Moon",
      periodDays: "29.530588",
      offsetDays: "0",
      phases: [
        "New moon",
        "Waxing crescent",
        "First quarter",
        "Waxing gibbous",
        "Full moon",
        "Waning gibbous",
        "Last quarter",
        "Waning crescent",
      ],
    },
  ],
};
export const GENERIC_CALENDAR: CalendarDefinition = {
  id: "generic",
  name: "Generic · 360 days",
  yearZero: true,
  yearSuffix: "",
  months: Array.from({ length: 12 }, (_, i) => ({
    id: `month-${i + 1}`,
    name: `Month ${i + 1}`,
    days: 30,
  })),
  hoursPerDay: 24,
  minutesPerHour: 60,
  secondsPerMinute: 60,
  weekdays: ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"],
  weekOffset: 0,
  eras: [],
  moons: [],
};
export function copyCalendar(calendar: CalendarDefinition): CalendarDefinition {
  return JSON.parse(JSON.stringify(calendar)) as CalendarDefinition;
}
export function floorDiv(n: bigint, d: bigint): bigint {
  if (d <= 0n) throw new RangeError("Divisor must be positive");
  const quotient = n / d;
  return n % d < 0n ? quotient - 1n : quotient;
}
export function modulo(n: bigint, d: bigint): bigint {
  return n - floorDiv(n, d) * d;
}
function integer(value: number, name: string, min = 1, max = 1_000_000): void {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new RangeError(`${name} must be an integer between ${min} and ${max}`);
}
export function decimalRatio(value: string): { numerator: bigint; denominator: bigint } {
  const match = /^([+-]?)(\d+)(?:\.(\d{1,12}))?$/.exec(value.trim());
  if (!match) throw new RangeError("Use a decimal number with at most 12 decimal places");
  const numerator = BigInt(`${match[2]}${match[3] ?? ""}`) * (match[1] === "-" ? -1n : 1n);
  return { numerator, denominator: 10n ** BigInt(match[3]?.length ?? 0) };
}
export function validateCalendar(calendar: CalendarDefinition): string[] {
  const issues: string[] = [];
  if (!calendar || typeof calendar !== "object") return ["Calendar must be an object"];
  if (
    !Array.isArray(calendar.months) ||
    !Array.isArray(calendar.weekdays) ||
    !Array.isArray(calendar.eras) ||
    !Array.isArray(calendar.moons)
  )
    return ["Calendar months, weekdays, eras and moons must be arrays"];
  if (typeof calendar.id !== "string" || !calendar.id.trim())
    issues.push("Calendar id is required");
  if (typeof calendar.name !== "string" || !calendar.name.trim())
    issues.push("Calendar name is required");
  if (typeof calendar.yearZero !== "boolean")
    issues.push("Calendar year-zero setting must be boolean");
  if (
    typeof calendar.yearSuffix !== "string" ||
    (calendar.negativeYearSuffix !== undefined && typeof calendar.negativeYearSuffix !== "string")
  )
    issues.push("Calendar year suffixes must be text");
  if (
    calendar.months.some(
      (month) => !month || typeof month.id !== "string" || typeof month.name !== "string",
    ) ||
    calendar.weekdays.some((day) => typeof day !== "string") ||
    calendar.eras.some(
      (era) =>
        !era ||
        typeof era.id !== "string" ||
        typeof era.name !== "string" ||
        typeof era.suffix !== "string",
    ) ||
    calendar.moons.some(
      (moon) =>
        !moon ||
        typeof moon.id !== "string" ||
        typeof moon.name !== "string" ||
        typeof moon.periodDays !== "string" ||
        typeof moon.offsetDays !== "string" ||
        !Array.isArray(moon.phases) ||
        moon.phases.some((phase) => typeof phase !== "string"),
    )
  )
    return [...issues, "Invalid calendar month, weekday, era or moon fields"];
  for (const [name, entries] of [
    ["month", calendar.months],
    ["era", calendar.eras],
    ["moon", calendar.moons],
  ] as const) {
    if (
      new Set(entries.map((entry) => entry.id)).size !== entries.length ||
      entries.some((entry) => !entry.id.trim())
    )
      issues.push(`Calendar ${name} ids must be nonempty and unique`);
  }
  const check = (fn: () => void) => {
    try {
      fn();
    } catch (error) {
      issues.push(error instanceof Error ? error.message : String(error));
    }
  };
  if (!calendar.months?.length || calendar.months.length > 1000)
    issues.push("A calendar needs 1–1000 months");
  (calendar.months ?? []).forEach((month, i) => {
    if (!month.name?.trim()) issues.push(`Month ${i + 1} needs a name`);
    check(() => integer(month.days, `Month ${i + 1} days`));
  });
  check(() => integer(calendar.hoursPerDay, "Hours per day"));
  check(() => integer(calendar.minutesPerHour, "Minutes per hour"));
  check(() => integer(calendar.secondsPerMinute, "Seconds per minute"));
  check(() => integer(calendar.weekOffset, "Week offset", -1_000_000));
  if (calendar.weekMode && !["continuous", "monthly"].includes(calendar.weekMode))
    issues.push("Week mode must be continuous or monthly");
  if (
    !Array.isArray(calendar.weekdays) ||
    calendar.weekdays.length > 1000 ||
    calendar.weekdays.some((day) => !day.trim())
  )
    issues.push("Weekday names cannot be empty");
  if (calendar.leap) {
    const rule = calendar.leap;
    check(() => integer(rule.every, "Leap cycle"));
    check(() => integer(rule.month, "Leap month", 1, calendar.months.length));
    check(() => integer(rule.days, "Leap days"));
    check(() => integer(rule.offset ?? 0, "Leap offset", -1_000_000));
    if (rule.exceptEvery !== undefined) {
      check(() => integer(rule.exceptEvery!, "Leap exception"));
      if (rule.exceptEvery % rule.every !== 0)
        issues.push("Leap exception must be a multiple of the leap cycle");
    }
    if (rule.includeEvery !== undefined) {
      check(() => integer(rule.includeEvery!, "Leap inclusion"));
      if (!rule.exceptEvery || rule.includeEvery % rule.exceptEvery !== 0)
        issues.push("Leap inclusion must be a multiple of the exception");
    }
  }
  const seenEras = new Set<number>();
  (calendar.eras ?? []).forEach((era) => {
    check(() =>
      integer(
        era.startYear,
        `Era ${era.name} start`,
        Number.MIN_SAFE_INTEGER,
        Number.MAX_SAFE_INTEGER,
      ),
    );
    if (!calendar.yearZero && era.startYear === 0)
      issues.push("Era start cannot be year zero in this calendar");
    check(() =>
      integer(
        era.resetYear ?? 1,
        `Era ${era.name} reset year`,
        Number.MIN_SAFE_INTEGER,
        Number.MAX_SAFE_INTEGER,
      ),
    );
    if (seenEras.has(era.startYear)) issues.push("Eras must start in different years");
    seenEras.add(era.startYear);
  });
  (calendar.moons ?? []).forEach((moon) => {
    check(() => {
      if (decimalRatio(moon.periodDays).numerator <= 0n)
        throw new RangeError(`Moon ${moon.name} needs a positive cycle`);
    });
    check(() => {
      decimalRatio(moon.offsetDays);
    });
    if (!moon.phases?.length || moon.phases.some((phase) => !phase.trim()))
      issues.push(`Moon ${moon.name} needs phase names`);
  });
  return issues;
}
export function assertCalendar(calendar: CalendarDefinition): void {
  const issues = validateCalendar(calendar);
  if (issues.length) throw new RangeError(issues.join("; "));
}
function yearIndex(calendar: CalendarDefinition, year: number): bigint {
  integer(year, "Year", Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
  if (!calendar.yearZero && year === 0) throw new RangeError("This calendar has no year zero");
  return BigInt(calendar.yearZero || year < 0 ? year : year - 1);
}
function civilYear(calendar: CalendarDefinition, index: bigint): number {
  const civil = calendar.yearZero || index < 0n ? index : index + 1n;
  const year = Number(civil);
  if (!Number.isSafeInteger(year))
    throw new RangeError("Year exceeds the supported exact integer range");
  return year;
}
export function ticksPerDay(calendar: CalendarDefinition): bigint {
  return (
    BigInt(calendar.hoursPerDay) *
    BigInt(calendar.minutesPerHour) *
    BigInt(calendar.secondsPerMinute)
  );
}
export function isLeapYear(calendar: CalendarDefinition, year: number): boolean {
  if (!calendar.leap) return false;
  const rule = calendar.leap;
  const y = yearIndex(calendar, year) + (calendar.yearZero ? 0n : 1n) - BigInt(rule.offset ?? 0);
  return (
    modulo(y, BigInt(rule.every)) === 0n &&
    (!rule.exceptEvery ||
      modulo(y, BigInt(rule.exceptEvery)) !== 0n ||
      Boolean(rule.includeEvery && modulo(y, BigInt(rule.includeEvery)) === 0n))
  );
}
export function daysInMonth(calendar: CalendarDefinition, year: number, month: number): number {
  integer(month, "Month", 1, calendar.months.length);
  return (
    calendar.months[month - 1].days +
    (calendar.leap?.month === month && isLeapYear(calendar, year) ? calendar.leap.days : 0)
  );
}
function daysBeforeYearIndex(calendar: CalendarDefinition, index: bigint): bigint {
  const base = BigInt(calendar.months.reduce((sum, month) => sum + month.days, 0));
  if (!calendar.leap) return index * base;
  const rule = calendar.leap;
  const shift = (calendar.yearZero ? 0n : 1n) - BigInt(rule.offset ?? 0);
  const count = (divisor: number) =>
    floorDiv(index - 1n + shift, BigInt(divisor)) - floorDiv(-1n + shift, BigInt(divisor));
  const leaps =
    count(rule.every) -
    (rule.exceptEvery ? count(rule.exceptEvery) : 0n) +
    (rule.includeEvery ? count(rule.includeEvery) : 0n);
  return index * base + leaps * BigInt(rule.days);
}
export function validateCalendarDate(calendar: CalendarDefinition, date: CalendarDate): string[] {
  const issues: string[] = [];
  try {
    yearIndex(calendar, date.year);
    integer(date.month ?? 1, "Month", 1, calendar.months.length);
    integer(date.day ?? 1, "Day", 1, daysInMonth(calendar, date.year, date.month ?? 1));
    integer(date.hour ?? 0, "Hour", 0, calendar.hoursPerDay - 1);
    integer(date.minute ?? 0, "Minute", 0, calendar.minutesPerHour - 1);
    integer(date.second ?? 0, "Second", 0, calendar.secondsPerMinute - 1);
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
  }
  return issues;
}
export function toOrdinal(calendar: CalendarDefinition, date: CalendarDate): bigint {
  assertCalendar(calendar);
  const issues = validateCalendarDate(calendar, date);
  if (issues.length) throw new RangeError(issues.join("; "));
  let days = daysBeforeYearIndex(calendar, yearIndex(calendar, date.year));
  for (let month = 1; month < (date.month ?? 1); month++)
    days += BigInt(daysInMonth(calendar, date.year, month));
  days += BigInt((date.day ?? 1) - 1);
  return (
    days * ticksPerDay(calendar) +
    BigInt(date.hour ?? 0) * BigInt(calendar.minutesPerHour) * BigInt(calendar.secondsPerMinute) +
    BigInt(date.minute ?? 0) * BigInt(calendar.secondsPerMinute) +
    BigInt(date.second ?? 0)
  );
}
export function parseOrdinal(value: string | bigint): bigint {
  if (typeof value === "bigint") return value;
  if (!/^-?\d+$/.test(value)) throw new RangeError("Ordinal must be an exact integer string");
  return BigInt(value);
}
export function fromOrdinal(
  calendar: CalendarDefinition,
  value: string | bigint,
  precision: CalendarPrecision = "second",
): CalendarDate {
  assertCalendar(calendar);
  const ordinal = parseOrdinal(value);
  const dayOrdinal = floorDiv(ordinal, ticksPerDay(calendar));
  const baseYearDays = BigInt(calendar.months.reduce((sum, month) => sum + month.days, 0));
  let low = floorDiv(dayOrdinal, baseYearDays);
  let high = low + 1n;
  let step = 1n;
  while (daysBeforeYearIndex(calendar, low) > dayOrdinal) {
    high = low;
    low -= step;
    step *= 2n;
  }
  step = 1n;
  while (daysBeforeYearIndex(calendar, high) <= dayOrdinal) {
    low = high;
    high += step;
    step *= 2n;
  }
  while (high - low > 1n) {
    const mid = floorDiv(high + low, 2n);
    if (daysBeforeYearIndex(calendar, mid) <= dayOrdinal) low = mid;
    else high = mid;
  }
  const year = civilYear(calendar, low);
  let dayInYear = dayOrdinal - daysBeforeYearIndex(calendar, low);
  let month = 1;
  while (
    month < calendar.months.length &&
    dayInYear >= BigInt(daysInMonth(calendar, year, month))
  ) {
    dayInYear -= BigInt(daysInMonth(calendar, year, month));
    month++;
  }
  let time = modulo(ordinal, ticksPerDay(calendar));
  const hourTicks = BigInt(calendar.minutesPerHour) * BigInt(calendar.secondsPerMinute);
  const hour = Number(time / hourTicks);
  time %= hourTicks;
  const minute = Number(time / BigInt(calendar.secondsPerMinute));
  return {
    year,
    month,
    day: Number(dayInYear) + 1,
    hour,
    minute,
    second: Number(time % BigInt(calendar.secondsPerMinute)),
    precision,
  };
}
export function calendarDateBounds(
  calendar: CalendarDefinition,
  date: CalendarDate,
): { start: bigint; endExclusive: bigint } {
  const precision = date.precision ?? "day";
  const rank = CALENDAR_PRECISIONS.indexOf(precision);
  const first = {
    ...date,
    month: rank >= 1 ? (date.month ?? 1) : 1,
    day: rank >= 2 ? (date.day ?? 1) : 1,
    hour: rank >= 3 ? (date.hour ?? 0) : 0,
    minute: rank >= 4 ? (date.minute ?? 0) : 0,
    second: rank >= 5 ? (date.second ?? 0) : 0,
  };
  const start = toOrdinal(calendar, first);
  if (precision === "year") {
    const year = date.year + 1 === 0 && !calendar.yearZero ? 1 : date.year + 1;
    return { start, endExclusive: toOrdinal(calendar, { year }) };
  }
  if (precision === "month") {
    const nextMonth = first.month + 1;
    const year =
      nextMonth > calendar.months.length
        ? date.year + 1 === 0 && !calendar.yearZero
          ? 1
          : date.year + 1
        : date.year;
    return {
      start,
      endExclusive: toOrdinal(calendar, {
        year,
        month: nextMonth > calendar.months.length ? 1 : nextMonth,
      }),
    };
  }
  const duration =
    precision === "day"
      ? ticksPerDay(calendar)
      : precision === "hour"
        ? BigInt(calendar.minutesPerHour * calendar.secondsPerMinute)
        : precision === "minute"
          ? BigInt(calendar.secondsPerMinute)
          : 1n;
  return { start, endExclusive: start + duration };
}
export function yearInEra(calendar: CalendarDefinition, year: number, eraId: string): number {
  const era = calendar.eras.find((entry) => entry.id === eraId);
  if (!era) return year;
  return Number(
    yearIndex(calendar, year) - yearIndex(calendar, era.startYear) + BigInt(era.resetYear ?? 1),
  );
}
export function yearFromEra(calendar: CalendarDefinition, eraYear: number, eraId: string): number {
  const era = calendar.eras.find((entry) => entry.id === eraId);
  if (!era) return eraYear;
  integer(eraYear, "Era year", Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
  return civilYear(
    calendar,
    yearIndex(calendar, era.startYear) + BigInt(eraYear) - BigInt(era.resetYear ?? 1),
  );
}
export function eraDurationYears(calendar: CalendarDefinition, eraId: string): bigint | undefined {
  const eras = [...calendar.eras].sort((a, b) => a.startYear - b.startYear);
  const index = eras.findIndex((entry) => entry.id === eraId);
  if (index < 0 || !eras[index + 1]) return undefined;
  return (
    yearIndex(calendar, eras[index + 1].startYear) - yearIndex(calendar, eras[index].startYear)
  );
}
export function formatCalendarYear(calendar: CalendarDefinition, year: number): string {
  const index = yearIndex(calendar, year);
  const era = [...calendar.eras]
    .sort((a, b) => b.startYear - a.startYear)
    .find((entry) => yearIndex(calendar, entry.startYear) <= index);
  if (era)
    return `${yearInEra(calendar, year, era.id)}${era.suffix ? ` ${era.suffix}` : ` ${era.name}`}`;
  return `${year < 0 && calendar.negativeYearSuffix ? Math.abs(year) : year}${year < 0 && calendar.negativeYearSuffix ? ` ${calendar.negativeYearSuffix}` : calendar.yearSuffix ? ` ${calendar.yearSuffix}` : ""}`;
}
export function formatCalendarDate(
  calendar: CalendarDefinition,
  value: CalendarDate | string | bigint,
  precision?: CalendarPrecision,
): string {
  const date = typeof value === "object" ? value : fromOrdinal(calendar, value, precision);
  const rank = CALENDAR_PRECISIONS.indexOf(precision ?? date.precision ?? "day");
  const pieces = [formatCalendarYear(calendar, date.year)];
  if (rank >= 1) pieces.unshift(calendar.months[(date.month ?? 1) - 1].name);
  if (rank >= 2) pieces.unshift(String(date.day ?? 1));
  if (rank >= 3)
    pieces.push(
      `${String(date.hour ?? 0).padStart(2, "0")}${rank >= 4 ? `:${String(date.minute ?? 0).padStart(2, "0")}` : ""}${rank >= 5 ? `:${String(date.second ?? 0).padStart(2, "0")}` : ""}`,
    );
  return pieces.join(" ");
}
export function weekdayAt(
  calendar: CalendarDefinition,
  value: string | bigint,
): { index: number; name: string } | undefined {
  if (!calendar.weekdays.length) return undefined;
  const day =
    calendar.weekMode === "monthly"
      ? BigInt((fromOrdinal(calendar, value).day ?? 1) - 1)
      : floorDiv(parseOrdinal(value), ticksPerDay(calendar));
  const index = Number(modulo(day + BigInt(calendar.weekOffset), BigInt(calendar.weekdays.length)));
  return { index, name: calendar.weekdays[index] };
}
export function moonPhasesAt(
  calendar: CalendarDefinition,
  value: string | bigint,
): { id: string; name: string; phase: string; phaseIndex: number; fraction: number }[] {
  const tick = parseOrdinal(value);
  return calendar.moons.map((moon) => {
    const cycle = decimalRatio(moon.periodDays);
    const offset = decimalRatio(moon.offsetDays);
    const duration = cycle.numerator * ticksPerDay(calendar) * offset.denominator;
    const position = modulo(
      tick * cycle.denominator * offset.denominator -
        offset.numerator * ticksPerDay(calendar) * cycle.denominator,
      duration,
    );
    const phaseIndex = Number((position * BigInt(moon.phases.length)) / duration);
    return {
      id: moon.id,
      name: moon.name,
      phase: moon.phases[phaseIndex],
      phaseIndex,
      fraction: Number((position * 1_000_000n) / duration) / 1_000_000,
    };
  });
}
