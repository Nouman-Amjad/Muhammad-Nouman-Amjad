import type { MonthKey } from '../value-objects/month-key';

export const FREE_MONTHLY_ALLOWANCE = 3;

/**
 * Per-user record of free messages consumed within a single calendar month. The window is
 * never mutated in place; a deduction produces the next state, and a window whose month no
 * longer matches "now" is read as a fresh allowance (the monthly reset).
 */
export class FreeQuotaWindow {
  private constructor(
    readonly userId: string,
    readonly monthKey: MonthKey,
    readonly used: number,
  ) {}

  static start(userId: string, monthKey: MonthKey): FreeQuotaWindow {
    return new FreeQuotaWindow(userId, monthKey, 0);
  }

  static restore(userId: string, monthKey: MonthKey, used: number): FreeQuotaWindow {
    if (!Number.isInteger(used) || used < 0) {
      throw new RangeError('used must be a non-negative integer');
    }
    return new FreeQuotaWindow(userId, monthKey, Math.min(used, FREE_MONTHLY_ALLOWANCE));
  }

  usedIn(currentMonth: MonthKey): number {
    return this.monthKey.equals(currentMonth) ? this.used : 0;
  }

  remainingIn(currentMonth: MonthKey): number {
    return FREE_MONTHLY_ALLOWANCE - this.usedIn(currentMonth);
  }

  hasRemainingIn(currentMonth: MonthKey): boolean {
    return this.remainingIn(currentMonth) > 0;
  }

  consumeFor(currentMonth: MonthKey): FreeQuotaWindow {
    const nextUsed = this.usedIn(currentMonth) + 1;
    if (nextUsed > FREE_MONTHLY_ALLOWANCE) {
      throw new RangeError('free allowance exhausted for the current month');
    }
    return new FreeQuotaWindow(this.userId, currentMonth, nextUsed);
  }
}
