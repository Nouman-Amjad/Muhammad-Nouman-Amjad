/**
 * Calendar month identity (UTC) used to scope free-quota windows. Keying usage on a
 * MonthKey is what makes the free allowance "reset on the 1st": a request in a new month
 * reads a window whose key no longer matches, so its consumed count is treated as zero.
 */
export class MonthKey {
  private constructor(
    readonly year: number,
    readonly month: number,
  ) {}

  static of(year: number, month: number): MonthKey {
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new RangeError(`Invalid month key: ${year}-${month}`);
    }
    return new MonthKey(year, month);
  }

  static current(now: Date): MonthKey {
    return new MonthKey(now.getUTCFullYear(), now.getUTCMonth() + 1);
  }

  static fromString(value: string): MonthKey {
    const match = /^(\d{4})-(\d{2})$/.exec(value);
    if (!match) {
      throw new RangeError(`Invalid month key string: ${value}`);
    }
    return MonthKey.of(Number(match[1]), Number(match[2]));
  }

  equals(other: MonthKey): boolean {
    return this.year === other.year && this.month === other.month;
  }

  toString(): string {
    return `${this.year.toString().padStart(4, '0')}-${this.month.toString().padStart(2, '0')}`;
  }
}
