import { SubscriptionTier } from '../../../shared/domain/subscription-tier';
import type { BillingCycle } from '../../../shared/domain/billing-cycle';
import { BILLING_CYCLE_MONTHS } from '../../../shared/domain/billing-cycle';

/** Monthly base prices in USD cents (avoids floating-point representation issues). */
const MONTHLY_BASE_CENTS: Readonly<Record<SubscriptionTier, number>> = {
  [SubscriptionTier.Basic]: 999,
  [SubscriptionTier.Pro]: 2999,
  [SubscriptionTier.Enterprise]: 29999,
};

export class SubscriptionPrice {
  private constructor(
    readonly cents: number,
    readonly cycle: BillingCycle,
  ) {}

  static for(tier: SubscriptionTier, cycle: BillingCycle): SubscriptionPrice {
    const monthly = MONTHLY_BASE_CENTS[tier];
    const months = BILLING_CYCLE_MONTHS[cycle];
    return new SubscriptionPrice(monthly * months, cycle);
  }

  get dollars(): number {
    return this.cents / 100;
  }
}
