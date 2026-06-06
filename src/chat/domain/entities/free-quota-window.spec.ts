import { MonthKey } from '../value-objects/month-key';
import { FREE_MONTHLY_ALLOWANCE, FreeQuotaWindow } from './free-quota-window';

const june = MonthKey.of(2026, 6);
const may = MonthKey.of(2026, 5);

describe('FreeQuotaWindow', () => {
  it('grants the full monthly allowance to a new window', () => {
    const window = FreeQuotaWindow.start('user-1', june);
    expect(window.remainingIn(june)).toBe(FREE_MONTHLY_ALLOWANCE);
    expect(window.hasRemainingIn(june)).toBe(true);
  });

  it('resets when the stored month differs from the current month', () => {
    const exhaustedLastMonth = FreeQuotaWindow.restore('user-1', may, FREE_MONTHLY_ALLOWANCE);
    expect(exhaustedLastMonth.remainingIn(june)).toBe(FREE_MONTHLY_ALLOWANCE);
    expect(exhaustedLastMonth.usedIn(june)).toBe(0);
  });

  it('reports no remaining once the allowance is consumed in the current month', () => {
    const window = FreeQuotaWindow.restore('user-1', june, FREE_MONTHLY_ALLOWANCE);
    expect(window.hasRemainingIn(june)).toBe(false);
  });

  it('advances the consumed count and re-keys to the current month on consume', () => {
    const next = FreeQuotaWindow.restore('user-1', may, FREE_MONTHLY_ALLOWANCE).consumeFor(june);
    expect(next.monthKey.equals(june)).toBe(true);
    expect(next.used).toBe(1);
  });

  it('refuses to consume beyond the monthly allowance', () => {
    const window = FreeQuotaWindow.restore('user-1', june, FREE_MONTHLY_ALLOWANCE);
    expect(() => window.consumeFor(june)).toThrow(RangeError);
  });
});
