import type { BillingCycle } from '../../../shared/domain/billing-cycle';
import { BILLING_CYCLE_MONTHS } from '../../../shared/domain/billing-cycle';
import type {
  SubscriptionTier,
  UNLIMITED} from '../../../shared/domain/subscription-tier';
import {
  isUnlimitedTier,
  TIER_MAX_MESSAGES
} from '../../../shared/domain/subscription-tier';
import type { SubscriptionPrice } from '../value-objects/subscription-price';

export interface SubscriptionBundleProps {
  readonly id: string;
  readonly userId: string;
  readonly tier: SubscriptionTier;
  readonly billingCycle: BillingCycle;
  readonly maxMessages: number | typeof UNLIMITED;
  readonly remaining: number;
  readonly price: SubscriptionPrice;
  readonly startDate: Date;
  readonly endDate: Date;
  readonly renewalDate: Date;
  readonly autoRenew: boolean;
  readonly active: boolean;
  readonly cancelledAt: Date | null;
  readonly activatedAt: Date;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

export class SubscriptionBundle {
  private constructor(private readonly props: SubscriptionBundleProps) {}

  static create(params: {
    id: string;
    userId: string;
    tier: SubscriptionTier;
    billingCycle: BillingCycle;
    price: SubscriptionPrice;
    startDate: Date;
    autoRenew: boolean;
  }): SubscriptionBundle {
    const months = BILLING_CYCLE_MONTHS[params.billingCycle];
    const endDate = addMonths(params.startDate, months);
    const maxMessages = TIER_MAX_MESSAGES[params.tier];

    return new SubscriptionBundle({
      id: params.id,
      userId: params.userId,
      tier: params.tier,
      billingCycle: params.billingCycle,
      maxMessages,
      remaining: isUnlimitedTier(params.tier) ? 0 : (maxMessages as number),
      price: params.price,
      startDate: params.startDate,
      endDate,
      renewalDate: endDate,
      autoRenew: params.autoRenew,
      active: true,
      cancelledAt: null,
      activatedAt: params.startDate,
    });
  }

  static restore(props: SubscriptionBundleProps): SubscriptionBundle {
    return new SubscriptionBundle(props);
  }

  get id(): string { return this.props.id; }
  get userId(): string { return this.props.userId; }
  get tier(): SubscriptionTier { return this.props.tier; }
  get billingCycle(): BillingCycle { return this.props.billingCycle; }
  get maxMessages(): number | typeof UNLIMITED { return this.props.maxMessages; }
  get remaining(): number { return this.props.remaining; }
  get price(): SubscriptionPrice { return this.props.price; }
  get startDate(): Date { return this.props.startDate; }
  get endDate(): Date { return this.props.endDate; }
  get renewalDate(): Date { return this.props.renewalDate; }
  get autoRenew(): boolean { return this.props.autoRenew; }
  get active(): boolean { return this.props.active; }
  get cancelledAt(): Date | null { return this.props.cancelledAt; }
  get activatedAt(): Date { return this.props.activatedAt; }
  get isUnlimited(): boolean { return isUnlimitedTier(this.props.tier); }

  isOwnedBy(userId: string): boolean {
    return this.props.userId === userId;
  }

  /** Returns a new bundle advanced by one billing cycle with fresh quota. */
  renew(now: Date): SubscriptionBundle {
    if (!this.props.active) {
      throw new Error('cannot renew an inactive subscription');
    }
    if (this.props.cancelledAt !== null) {
      throw new Error('cannot renew a cancelled subscription');
    }
    const months = BILLING_CYCLE_MONTHS[this.props.billingCycle];
    const newStart = this.props.renewalDate;
    const newEnd = addMonths(newStart, months);
    const maxMessages = TIER_MAX_MESSAGES[this.props.tier];

    return new SubscriptionBundle({
      ...this.props,
      remaining: isUnlimitedTier(this.props.tier) ? 0 : (maxMessages as number),
      startDate: newStart,
      endDate: newEnd,
      renewalDate: newEnd,
      activatedAt: now,
    });
  }

  /** Marks the subscription inactive due to payment failure. */
  deactivate(): SubscriptionBundle {
    return new SubscriptionBundle({ ...this.props, active: false });
  }

  /**
   * Cancels the subscription: disables auto-renew and records the cancellation
   * timestamp. The current billing cycle runs to its natural end; no future
   * renewal is triggered. Historical usage data is preserved on chat_messages.
   */
  cancel(now: Date): SubscriptionBundle {
    if (this.props.cancelledAt !== null) {
      throw new Error('subscription is already cancelled');
    }
    return new SubscriptionBundle({
      ...this.props,
      autoRenew: false,
      cancelledAt: now,
    });
  }

  withAutoRenew(enabled: boolean): SubscriptionBundle {
    return new SubscriptionBundle({ ...this.props, autoRenew: enabled });
  }
}
