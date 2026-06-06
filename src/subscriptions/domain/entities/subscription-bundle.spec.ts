import { BillingCycle } from '../../../shared/domain/billing-cycle';
import { SubscriptionTier, UNLIMITED } from '../../../shared/domain/subscription-tier';
import { SubscriptionPrice } from '../value-objects/subscription-price';
import { SubscriptionBundle } from './subscription-bundle';

function makeBundle(
  overrides: Partial<{
    tier: SubscriptionTier;
    cycle: BillingCycle;
    autoRenew: boolean;
    startDate: Date;
  }> = {},
): SubscriptionBundle {
  const tier = overrides.tier ?? SubscriptionTier.Basic;
  const cycle = overrides.cycle ?? BillingCycle.Monthly;
  return SubscriptionBundle.create({
    id: 'bundle-1',
    userId: 'user-1',
    tier,
    billingCycle: cycle,
    price: SubscriptionPrice.for(tier, cycle),
    startDate: overrides.startDate ?? new Date(Date.UTC(2026, 0, 1)),
    autoRenew: overrides.autoRenew ?? true,
  });
}

describe('SubscriptionBundle', () => {
  describe('creation', () => {
    it('sets endDate one month ahead for a monthly cycle', () => {
      const bundle = makeBundle({ startDate: new Date(Date.UTC(2026, 0, 1)) });
      expect(bundle.endDate).toEqual(new Date(Date.UTC(2026, 1, 1)));
    });

    it('sets endDate twelve months ahead for a yearly cycle', () => {
      const bundle = makeBundle({
        cycle: BillingCycle.Yearly,
        startDate: new Date(Date.UTC(2026, 0, 1)),
      });
      expect(bundle.endDate).toEqual(new Date(Date.UTC(2027, 0, 1)));
    });

    it('initialises remaining to the tier message cap for Basic', () => {
      const bundle = makeBundle({ tier: SubscriptionTier.Basic });
      expect(bundle.remaining).toBe(10);
      expect(bundle.maxMessages).toBe(10);
    });

    it('initialises remaining to 0 and maxMessages to UNLIMITED for Enterprise', () => {
      const bundle = makeBundle({ tier: SubscriptionTier.Enterprise });
      expect(bundle.remaining).toBe(0);
      expect(bundle.maxMessages).toBe(UNLIMITED);
      expect(bundle.isUnlimited).toBe(true);
    });

    it('starts as active with no cancellation timestamp', () => {
      const bundle = makeBundle();
      expect(bundle.active).toBe(true);
      expect(bundle.cancelledAt).toBeNull();
    });
  });

  describe('renewal', () => {
    it('advances dates by one billing cycle and restores quota', () => {
      const original = makeBundle({ startDate: new Date(Date.UTC(2026, 0, 1)) });
      const now = new Date(Date.UTC(2026, 1, 1));
      const renewed = original.renew(now);

      expect(renewed.startDate).toEqual(new Date(Date.UTC(2026, 1, 1)));
      expect(renewed.endDate).toEqual(new Date(Date.UTC(2026, 2, 1)));
      expect(renewed.remaining).toBe(10);
    });

    it('refuses to renew an inactive bundle', () => {
      const deactivated = makeBundle().deactivate();
      expect(() => deactivated.renew(new Date())).toThrow('cannot renew an inactive subscription');
    });

    it('refuses to renew a cancelled bundle', () => {
      const cancelled = makeBundle().cancel(new Date());
      expect(() => cancelled.renew(new Date())).toThrow('cannot renew a cancelled subscription');
    });
  });

  describe('cancellation', () => {
    it('records the cancellation timestamp and disables auto-renew', () => {
      const now = new Date(Date.UTC(2026, 5, 1));
      const cancelled = makeBundle({ autoRenew: true }).cancel(now);

      expect(cancelled.cancelledAt).toEqual(now);
      expect(cancelled.autoRenew).toBe(false);
      expect(cancelled.active).toBe(true); // still active until end of cycle
    });

    it('refuses a second cancellation', () => {
      const cancelled = makeBundle().cancel(new Date());
      expect(() => cancelled.cancel(new Date())).toThrow('already cancelled');
    });
  });

  describe('deactivation', () => {
    it('marks the bundle inactive without altering other fields', () => {
      const bundle = makeBundle();
      const deactivated = bundle.deactivate();
      expect(deactivated.active).toBe(false);
      expect(deactivated.tier).toBe(bundle.tier);
      expect(deactivated.remaining).toBe(bundle.remaining);
    });
  });
});
