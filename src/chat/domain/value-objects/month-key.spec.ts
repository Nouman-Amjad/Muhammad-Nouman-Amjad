import { MonthKey } from './month-key';

describe('MonthKey', () => {
  it('derives the current calendar month in UTC', () => {
    const key = MonthKey.current(new Date(Date.UTC(2026, 5, 15, 23, 0, 0)));
    expect(key.toString()).toBe('2026-06');
  });

  it('treats two keys for the same month as equal', () => {
    expect(MonthKey.of(2026, 6).equals(MonthKey.of(2026, 6))).toBe(true);
    expect(MonthKey.of(2026, 6).equals(MonthKey.of(2026, 7))).toBe(false);
  });

  it('round-trips through its string form', () => {
    expect(MonthKey.fromString('2026-01').toString()).toBe('2026-01');
  });

  it('rejects out-of-range months', () => {
    expect(() => MonthKey.of(2026, 0)).toThrow(RangeError);
    expect(() => MonthKey.of(2026, 13)).toThrow(RangeError);
    expect(() => MonthKey.fromString('2026-13')).toThrow(RangeError);
  });
});
