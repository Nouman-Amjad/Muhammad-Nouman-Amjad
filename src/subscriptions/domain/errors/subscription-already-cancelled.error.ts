import { DomainError } from '../../../shared/domain/domain-error';

export class SubscriptionAlreadyCancelledError extends DomainError {
  readonly code = 'SUBSCRIPTION_ALREADY_CANCELLED';

  constructor(bundleId: string) {
    super(`Subscription ${bundleId} is already cancelled`);
  }
}
