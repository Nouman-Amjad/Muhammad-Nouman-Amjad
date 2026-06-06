import { BillingCycle } from '../../../shared/domain/billing-cycle';
import { SubscriptionTier } from '../../../shared/domain/subscription-tier';
import { SubscriptionPrice } from '../value-objects/subscription-price';
import { SubscriptionBundle } from '../entities/subscription-bundle';
import { SubscriptionAlreadyCancelledError } from '../errors/subscription-already-cancelled.error';
import { SubscriptionNotActiveError } from '../errors/subscription-not-active.error';
import { BillingSimulationService } from './billing-simulation.service';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';

const START = new Date(Date.UTC(2026, 0, 1));
const RENEWAL_DATE = new Date(Date.UTC(2026, 1, 1));
const NOW = new Date(Date.UTC(2026, 1, 2));

function makeBundle(
  overrides: Partial<{ active: boolean; autoRenew: boolean; cancelled: boolean }> = {},
): SubscriptionBundle {
  let bundle = SubscriptionBundle.create({
    id: 'bundle-1',
    userId: 'user-1',
    tier: SubscriptionTier.Pro,
    billingCycle: BillingCycle.Monthly,
    price: SubscriptionPrice.for(SubscriptionTier.Pro, BillingCycle.Monthly),
    startDate: START,
    autoRenew: overrides.autoRenew ?? true,
  });
  if (overrides.active === false) bundle = bundle.deactivate();
  if (overrides.cancelled === true) bundle = bundle.cancel(START);
  return bundle;
}

function makeService(alwaysSucceeds: boolean): SubscriptionLifecycleService {
  const billing = new BillingSimulationService(alwaysSucceeds ? 0 : 1);
  return new SubscriptionLifecycleService(billing);
}

describe('SubscriptionLifecycleService', () => {
  describe('cancel', () => {
    it('cancels an active bundle successfully', () => {
      const service = makeService(true);
      const result = service.cancel(makeBundle(), NOW);

      expect(result.isOk).toBe(true);
      const cancelled = result.unwrap();
      expect(cancelled.cancelledAt).toEqual(NOW);
      expect(cancelled.autoRenew).toBe(false);
    });

    it('returns SubscriptionNotActiveError for an inactive bundle', () => {
      const service = makeService(true);
      const result = service.cancel(makeBundle({ active: false }), NOW);

      expect(result.isErr).toBe(true);
      expect(result.isErr && result.error).toBeInstanceOf(SubscriptionNotActiveError);
    });

    it('returns SubscriptionAlreadyCancelledError when cancelled twice', () => {
      const service = makeService(true);
      const result = service.cancel(makeBundle({ cancelled: true }), NOW);

      expect(result.isErr).toBe(true);
      expect(result.isErr && result.error).toBeInstanceOf(SubscriptionAlreadyCancelledError);
    });
  });

  describe('attemptRenewal', () => {
    it('renews the bundle and reports success when payment goes through', () => {
      const service = makeService(true);
      const { bundle, payment } = service.attemptRenewal(makeBundle(), NOW);

      expect(payment.succeeded).toBe(true);
      expect(bundle.active).toBe(true);
      expect(bundle.startDate).toEqual(RENEWAL_DATE);
      expect(bundle.remaining).toBe(100); // Pro tier
    });

    it('deactivates the bundle and reports failure when payment fails', () => {
      const service = makeService(false);
      const { bundle, payment } = service.attemptRenewal(makeBundle(), NOW);

      expect(payment.succeeded).toBe(false);
      expect(payment.failureReason).not.toBeNull();
      expect(bundle.active).toBe(false);
    });

    it('preserves the original bundle state on payment failure', () => {
      const service = makeService(false);
      const original = makeBundle();
      const { bundle } = service.attemptRenewal(original, NOW);

      // Only active flag changes; quota and tier are untouched
      expect(bundle.remaining).toBe(original.remaining);
      expect(bundle.tier).toBe(original.tier);
      expect(bundle.cancelledAt).toBeNull();
    });
  });

  describe('isDueForRenewal', () => {
    it('reports true when now is on or after renewalDate and auto-renew is on', () => {
      const service = makeService(true);
      expect(service.isDueForRenewal(makeBundle(), RENEWAL_DATE)).toBe(true);
      expect(service.isDueForRenewal(makeBundle(), NOW)).toBe(true);
    });

    it('reports false when renewalDate has not yet passed', () => {
      const service = makeService(true);
      const before = new Date(Date.UTC(2026, 0, 15));
      expect(service.isDueForRenewal(makeBundle(), before)).toBe(false);
    });

    it('reports false when auto-renew is disabled', () => {
      const service = makeService(true);
      const bundle = makeBundle({ autoRenew: false });
      expect(service.isDueForRenewal(bundle, NOW)).toBe(false);
    });

    it('reports false for an inactive bundle', () => {
      const service = makeService(true);
      expect(service.isDueForRenewal(makeBundle({ active: false }), NOW)).toBe(false);
    });
  });
});
