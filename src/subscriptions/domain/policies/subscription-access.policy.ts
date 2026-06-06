import { type Principal, Role } from '../../../shared/domain/role';
import type { SubscriptionBundle } from '../entities/subscription-bundle';

export class SubscriptionAccessPolicy {
  canManage(principal: Principal, bundle: SubscriptionBundle): boolean {
    return principal.role === Role.Admin || bundle.isOwnedBy(principal.userId);
  }

  canViewAll(principal: Principal): boolean {
    return principal.role === Role.Admin;
  }
}
