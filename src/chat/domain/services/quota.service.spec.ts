import { SubscriptionTier } from '../../../shared/domain/subscription-tier';
import { DeductionSource } from '../entities/chat-message';
import { FREE_MONTHLY_ALLOWANCE, FreeQuotaWindow } from '../entities/free-quota-window';
import { QuotaExhaustedError } from '../errors/quota-exhausted.error';
import { MonthKey } from '../value-objects/month-key';
import { QuotaBundleSnapshot } from '../value-objects/quota-bundle-snapshot';
import { QuotaService, type QuotaState } from './quota.service';

const NOW = new Date(Date.UTC(2026, 5, 15));
const JUNE = MonthKey.of(2026, 6);
const MAY = MonthKey.of(2026, 5);

const bundle = (params: {
  id: string;
  tier: SubscriptionTier;
  remaining: number;
  activatedAt?: Date;
  active?: boolean;
}): QuotaBundleSnapshot =>
  QuotaBundleSnapshot.create({
    bundleId: params.id,
    tier: params.tier,
    remaining: params.remaining,
    activatedAt: params.activatedAt ?? new Date(Date.UTC(2026, 0, 1)),
    active: params.active ?? true,
  });

const state = (over: Partial<QuotaState>): QuotaState => ({
  userId: 'user-1',
  freeWindow: FreeQuotaWindow.start('user-1', JUNE),
  bundles: [],
  ...over,
});

describe('QuotaService', () => {
  const service = new QuotaService();

  describe('free allowance', () => {
    it('deducts from the free window while it has remaining', () => {
      const result = service.resolveDeduction(state({}), NOW);

      expect(result.isOk).toBe(true);
      expect(result.unwrap()).toEqual({
        source: DeductionSource.Free,
        month: JUNE,
        nextUsed: 1,
      });
    });

    it('resets the free allowance on a new calendar month', () => {
      const stale = FreeQuotaWindow.restore('user-1', MAY, FREE_MONTHLY_ALLOWANCE);

      const result = service.resolveDeduction(state({ freeWindow: stale }), NOW);

      expect(result.unwrap()).toMatchObject({ source: DeductionSource.Free, nextUsed: 1 });
    });

    it('prefers free quota over an available bundle', () => {
      const result = service.resolveDeduction(
        state({ bundles: [bundle({ id: 'b1', tier: SubscriptionTier.Pro, remaining: 100 })] }),
        NOW,
      );

      expect(result.unwrap().source).toBe(DeductionSource.Free);
    });
  });

  describe('bundle selection once free is exhausted', () => {
    const exhaustedFree = FreeQuotaWindow.restore('user-1', JUNE, FREE_MONTHLY_ALLOWANCE);

    it('falls back to the only active bundle', () => {
      const result = service.resolveDeduction(
        state({
          freeWindow: exhaustedFree,
          bundles: [bundle({ id: 'basic', tier: SubscriptionTier.Basic, remaining: 10 })],
        }),
        NOW,
      );

      expect(result.unwrap()).toEqual({
        source: DeductionSource.Bundle,
        bundleId: 'basic',
        unlimited: false,
      });
    });

    it('chooses the bundle with the greatest remaining quota', () => {
      const result = service.resolveDeduction(
        state({
          freeWindow: exhaustedFree,
          bundles: [
            bundle({ id: 'basic', tier: SubscriptionTier.Basic, remaining: 5 }),
            bundle({ id: 'pro', tier: SubscriptionTier.Pro, remaining: 40 }),
          ],
        }),
        NOW,
      );

      expect(result.unwrap()).toMatchObject({ bundleId: 'pro' });
    });

    it('ranks an unlimited Enterprise bundle above any finite balance', () => {
      const result = service.resolveDeduction(
        state({
          freeWindow: exhaustedFree,
          bundles: [
            bundle({ id: 'pro', tier: SubscriptionTier.Pro, remaining: 100 }),
            bundle({ id: 'ent', tier: SubscriptionTier.Enterprise, remaining: 0 }),
          ],
        }),
        NOW,
      );

      expect(result.unwrap()).toEqual({
        source: DeductionSource.Bundle,
        bundleId: 'ent',
        unlimited: true,
      });
    });

    it('breaks ties toward the most recently activated bundle', () => {
      const result = service.resolveDeduction(
        state({
          freeWindow: exhaustedFree,
          bundles: [
            bundle({
              id: 'older',
              tier: SubscriptionTier.Pro,
              remaining: 40,
              activatedAt: new Date(Date.UTC(2026, 0, 1)),
            }),
            bundle({
              id: 'newer',
              tier: SubscriptionTier.Pro,
              remaining: 40,
              activatedAt: new Date(Date.UTC(2026, 4, 1)),
            }),
          ],
        }),
        NOW,
      );

      expect(result.unwrap()).toMatchObject({ bundleId: 'newer' });
    });

    it('ignores inactive bundles even when they hold quota', () => {
      const result = service.resolveDeduction(
        state({
          freeWindow: exhaustedFree,
          bundles: [
            bundle({ id: 'inactive', tier: SubscriptionTier.Pro, remaining: 100, active: false }),
            bundle({ id: 'active', tier: SubscriptionTier.Basic, remaining: 2 }),
          ],
        }),
        NOW,
      );

      expect(result.unwrap()).toMatchObject({ bundleId: 'active' });
    });
  });

  describe('exhaustion', () => {
    it('returns a typed QuotaExhaustedError when nothing is consumable', () => {
      const result = service.resolveDeduction(
        state({
          freeWindow: FreeQuotaWindow.restore('user-1', JUNE, FREE_MONTHLY_ALLOWANCE),
          bundles: [
            bundle({ id: 'empty', tier: SubscriptionTier.Basic, remaining: 0 }),
            bundle({ id: 'inactive', tier: SubscriptionTier.Pro, remaining: 50, active: false }),
          ],
        }),
        NOW,
      );

      expect(result.isErr).toBe(true);
      const error = (result as { error: QuotaExhaustedError }).error;
      expect(error).toBeInstanceOf(QuotaExhaustedError);
      expect(error.code).toBe('QUOTA_EXHAUSTED');
      expect(error.context).toMatchObject({ userId: 'user-1', month: '2026-06' });
    });
  });
});
