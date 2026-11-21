/**
 * Core club time utility functions.
 * Per section 1, 3.3 and 4: "day" means club-local day computed only here.
 * Default club timezone is 'Asia/Kolkata'.
 */

import { Settings } from './settings.js';

export const DEFAULT_CLUB_TIMEZONE = 'Asia/Kolkata';

/**
 * Reads configured club timezone from settings, falling back to 'Asia/Kolkata'.
 */
export async function getClubTimezone(): Promise<string> {
  const tz = await Settings.get<string>('club.timezone');
  return tz || DEFAULT_CLUB_TIMEZONE;
}

/**
 * Returns the club local date string formatted as 'YYYY-MM-DD'.
 */
export function toClubLocalDate(instant: Date, timeZone = DEFAULT_CLUB_TIMEZONE): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(instant);
}

/**
 * Returns today's club local date string formatted as 'YYYY-MM-DD'.
 */
export function clubLocalToday(timeZone = DEFAULT_CLUB_TIMEZONE): string {
  return toClubLocalDate(new Date(), timeZone);
}

/**
 * Adds or subtracts days to a YYYY-MM-DD date string, returning the resulting YYYY-MM-DD string.
 */
export function addClubDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return date.toISOString().slice(0, 10);
}

/**
 * Returns the club local weekday: 0 = Sunday, 1 = Monday, ..., 6 = Saturday.
 */
export function toClubLocalWeekday(instant: Date, timeZone = DEFAULT_CLUB_TIMEZONE): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  });
  const dayStr = formatter.format(instant);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[dayStr] ?? 0;
}

/**
 * Returns the club local time formatted as 'HH:mm'.
 */
export function toClubLocalTime(instant: Date, timeZone = DEFAULT_CLUB_TIMEZONE): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.format(instant);
  // Normalize 24:00 to 00:00 if present
  if (parts.startsWith('24:')) {
    return `00:${parts.slice(3)}`;
  }
  return parts;
}

/**
 * Returns timezone offset in milliseconds between the local time and UTC at the given instant.
 * offset = local - UTC
 */
export function getTimezoneOffsetMs(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  let year = 0;
  let month = 0;
  let day = 0;
  let hour = 0;
  let minute = 0;
  let second = 0;

  for (const part of parts) {
    if (part.type === 'year') year = parseInt(part.value, 10);
    if (part.type === 'month') month = parseInt(part.value, 10);
    if (part.type === 'day') day = parseInt(part.value, 10);
    if (part.type === 'hour') hour = parseInt(part.value, 10);
    if (part.type === 'minute') minute = parseInt(part.value, 10);
    if (part.type === 'second') second = parseInt(part.value, 10);
  }
  if (hour === 24) hour = 0;

  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return localAsUtc - date.getTime();
}

/**
 * Converts local (year, month, day, hour, minute) to UTC Date in given timezone.
 */
export function localToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone = DEFAULT_CLUB_TIMEZONE
): Date {
  const targetUtcEstimate = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const initialOffset = getTimezoneOffsetMs(new Date(targetUtcEstimate), timeZone);
  let utcTime = targetUtcEstimate - initialOffset;

  // Refine for DST boundaries if needed
  const refinedOffset = getTimezoneOffsetMs(new Date(utcTime), timeZone);
  if (refinedOffset !== initialOffset) {
    utcTime = targetUtcEstimate - refinedOffset;
  }

  return new Date(utcTime);
}

/**
 * Returns start and end of a club-local day as UTC Date instants.
 * dateStr must be 'YYYY-MM-DD'.
 * [start, end) half-open interval.
 */
export function clubLocalDayBoundsUtc(
  dateStr: string,
  timeZone = DEFAULT_CLUB_TIMEZONE
): { start: Date; end: Date } {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  const start = localToUtc(year, month, day, 0, 0, timeZone);
  // End of day is start of next day (half-open range [start, end))
  const nextDate = new Date(Date.UTC(year, month - 1, day + 1));
  const end = localToUtc(
    nextDate.getUTCFullYear(),
    nextDate.getUTCMonth() + 1,
    nextDate.getUTCDate(),
    0,
    0,
    timeZone
  );

  return { start, end };
}

/**
 * Checks whether an instant aligns with the slot grid in club time.
 * For 30-min slots: minutes in club time must be 0 or 30, and seconds & ms must be 0.
 */
export function isSlotAligned(
  instant: Date,
  slotMinutes = 30,
  timeZone = DEFAULT_CLUB_TIMEZONE
): boolean {
  if (instant.getUTCMilliseconds() !== 0 || instant.getUTCSeconds() !== 0) {
    return false;
  }
  const timeStr = toClubLocalTime(instant, timeZone);
  const [, minuteStr] = timeStr.split(':');
  const minute = parseInt(minuteStr, 10);
  return minute % slotMinutes === 0;
}
