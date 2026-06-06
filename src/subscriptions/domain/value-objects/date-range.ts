export class DateRange {
  private constructor(
    readonly start: Date,
    readonly end: Date,
  ) {}

  static of(start: Date, end: Date): DateRange {
    if (end <= start) {
      throw new RangeError('end must be after start');
    }
    return new DateRange(start, end);
  }

  contains(date: Date): boolean {
    return date >= this.start && date <= this.end;
  }

  get isExpired(): boolean {
    return new Date() > this.end;
  }
}
