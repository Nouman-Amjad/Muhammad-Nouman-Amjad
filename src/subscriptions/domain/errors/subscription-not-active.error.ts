import { DomainError } from '../../../shared/domain/domain-error';

export class SubscriptionNotActiveError extends DomainError {
  readonly code = 'SUBSCRIPTION_NOT_ACTIVE';

  constructor(bundleId: string) {
    super(`Subscription ${bundleId} is not active`);
  }
}
