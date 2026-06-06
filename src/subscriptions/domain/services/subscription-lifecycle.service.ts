import type { Result } from '../../../shared/domain/result';
import { err, ok } from '../../../shared/domain/result';
import type { SubscriptionBundle } from '../entities/subscription-bundle';
import type { SubscriptionAlreadyCancelledError } from '../errors/subscription-already-cancelled.error';
import type { SubscriptionNotActiveError } from '../errors/subscription-not-active.error';
import { SubscriptionAlreadyCancelledError as CancelledError } from '../errors/subscription-already-cancelled.error';
import { SubscriptionNotActiveError as NotActiveError } from '../errors/subscription-not-active.error';
import type { BillingSimulationService, PaymentOutcome } from './billing-simulation.service';

export interface RenewalResult {
  readonly bundle: SubscriptionBundle;
  readonly payment: PaymentOutcome;
}

/**
 * Pure orchestrator for subscription state transitions. No I/O — the use-case
 * layer owns persistence and injects the billing service.
 */
export class SubscriptionLifecycleService {
  constructor(private readonly billing: BillingSimulationService) {}

  cancel(
    bundle: SubscriptionBundle,
    now: Date,
  ): Result<SubscriptionBundle, SubscriptionAlreadyCancelledError | SubscriptionNotActiveError> {
    if (!bundle.active) {
      return err(new NotActiveError(bundle.id));
    }
    if (bundle.cancelledAt !== null) {
      return err(new CancelledError(bundle.id));
    }
    return ok(bundle.cancel(now));
  }

  /**
   * Attempts renewal for a bundle whose renewalDate has passed. If payment
   * succeeds the bundle advances by one billing cycle with fresh quota. On
   * failure the bundle is deactivated; historical data is untouched.
   */
  attemptRenewal(bundle: SubscriptionBundle, now: Date): RenewalResult {
    const payment = this.billing.processPayment();

    if (!payment.succeeded) {
      return { bundle: bundle.deactivate(), payment };
    }

    return { bundle: bundle.renew(now), payment };
  }

  isDueForRenewal(bundle: SubscriptionBundle, now: Date): boolean {
    return bundle.active && bundle.autoRenew && now >= bundle.renewalDate;
  }
}
