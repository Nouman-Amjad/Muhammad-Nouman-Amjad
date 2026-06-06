import type { SubscriptionTier } from '../../../shared/domain/subscription-tier';
import { isUnlimitedTier } from '../../../shared/domain/subscription-tier';
import { Quota } from './quota';

/**
 * Read model the chat domain consumes to make a deduction decision. It is a projection of
 * a subscription bundle owned by the subscriptions module, deliberately narrowed to the
 * fields quota selection needs so the two modules stay decoupled.
 */
export class QuotaBundleSnapshot {
  private constructor(
    readonly bundleId: string,
    readonly tier: SubscriptionTier,
    readonly quota: Quota,
    readonly activatedAt: Date,
    readonly active: boolean,
  ) {}

  static create(params: {
    bundleId: string;
    tier: SubscriptionTier;
    remaining: number;
    activatedAt: Date;
    active: boolean;
  }): QuotaBundleSnapshot {
    return new QuotaBundleSnapshot(
      params.bundleId,
      params.tier,
      Quota.of(params.remaining),
      params.activatedAt,
      params.active,
    );
  }

  get isUnlimited(): boolean {
    return isUnlimitedTier(this.tier);
  }

  get isConsumable(): boolean {
    return this.active && (this.isUnlimited || !this.quota.isExhausted);
  }

  /** Comparator weight for "bundle with the latest remaining quota"; unlimited ranks highest. */
  get rankableRemaining(): number {
    return this.isUnlimited ? Number.POSITIVE_INFINITY : this.quota.remaining;
  }
}
