import { describe, it, expect } from 'vitest';
import {
  toClubLocalDate,
  toClubLocalWeekday,
  toClubLocalTime,
  clubLocalDayBoundsUtc,
  isSlotAligned,
} from '../src/core/clubTime.js';

describe('core/clubTime', () => {
  it('converts instants to club-local date and weekday in Asia/Kolkata', () => {
    // 2026-11-21 12:00:00 UTC -> 17:30:00 IST on 2026-11-21 (Saturday = 6)
    const instant = new Date('2026-11-21T12:00:00.000Z');
    expect(toClubLocalDate(instant)).toBe('2026-11-21');
    expect(toClubLocalWeekday(instant)).toBe(6);
    expect(toClubLocalTime(instant)).toBe('17:30');
  });

  it('correctly lands 23:30 IST and 00:30 IST on different club-local days', () => {
    // 23:30 IST on 2026-11-21 is 18:00 UTC on 2026-11-21
    const lateNightBooking = new Date('2026-11-21T18:00:00.000Z');
    // 00:30 IST on 2026-11-22 is 19:00 UTC on 2026-11-21
    const earlyMorningBooking = new Date('2026-11-21T19:00:00.000Z');

    // In UTC, both are on 2026-11-21:
    expect(lateNightBooking.toISOString().startsWith('2026-11-21')).toBe(true);
    expect(earlyMorningBooking.toISOString().startsWith('2026-11-21')).toBe(true);

    // But in club-local time (Asia/Kolkata):
    expect(toClubLocalTime(lateNightBooking)).toBe('23:30');
    expect(toClubLocalDate(lateNightBooking)).toBe('2026-11-21');

    expect(toClubLocalTime(earlyMorningBooking)).toBe('00:30');
    expect(toClubLocalDate(earlyMorningBooking)).toBe('2026-11-22');

    // They land on different club-local days!
    expect(toClubLocalDate(lateNightBooking)).not.toBe(toClubLocalDate(earlyMorningBooking));
  });

  it('computes club-local day bounds in UTC for Asia/Kolkata (+05:30)', () => {
    const { start, end } = clubLocalDayBoundsUtc('2026-11-21', 'Asia/Kolkata');
    // 2026-11-21 00:00:00 IST is 2026-11-20 18:30:00 UTC
    expect(start.toISOString()).toBe('2026-11-20T18:30:00.000Z');
    // 2026-11-22 00:00:00 IST is 2026-11-21 18:30:00 UTC
    expect(end.toISOString()).toBe('2026-11-21T18:30:00.000Z');
  });

  it('validates 30-min slot-grid alignment in club time', () => {
    // 17:30 IST (12:00 UTC) -> aligned
    expect(isSlotAligned(new Date('2026-11-21T12:00:00.000Z'), 30)).toBe(true);
    // 18:00 IST (12:30 UTC) -> aligned
    expect(isSlotAligned(new Date('2026-11-21T12:30:00.000Z'), 30)).toBe(true);
    // 17:15 IST (11:45 UTC) -> not aligned to 30 min
    expect(isSlotAligned(new Date('2026-11-21T11:45:00.000Z'), 30)).toBe(false);
    // With non-zero seconds -> not aligned
    expect(isSlotAligned(new Date('2026-11-21T12:00:05.000Z'), 30)).toBe(false);
  });
});
