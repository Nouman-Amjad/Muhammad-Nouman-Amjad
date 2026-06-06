import { DomainError } from '../../../shared/domain/domain-error';

export class SubscriptionNotFoundError extends DomainError {
  readonly code = 'SUBSCRIPTION_NOT_FOUND';

  constructor(bundleId: string) {
    super(`Subscription ${bundleId} not found`);
  }
}
