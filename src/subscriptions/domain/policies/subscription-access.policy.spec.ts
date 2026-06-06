import { BillingCycle } from '../../../shared/domain/billing-cycle';
import { type Principal, Role } from '../../../shared/domain/role';
import { SubscriptionTier } from '../../../shared/domain/subscription-tier';
import { SubscriptionBundle } from '../entities/subscription-bundle';
import { SubscriptionPrice } from '../value-objects/subscription-price';
import { SubscriptionAccessPolicy } from './subscription-access.policy';

const bundle = SubscriptionBundle.create({
  id: 'b1',
  userId: 'user-1',
  tier: SubscriptionTier.Basic,
  billingCycle: BillingCycle.Monthly,
  price: SubscriptionPrice.for(SubscriptionTier.Basic, BillingCycle.Monthly),
  startDate: new Date(),
  autoRenew: true,
});

const owner: Principal = { userId: 'user-1', role: Role.User };
const stranger: Principal = { userId: 'user-2', role: Role.User };
const admin: Principal = { userId: 'admin-1', role: Role.Admin };

describe('SubscriptionAccessPolicy', () => {
  const policy = new SubscriptionAccessPolicy();

  it('allows the owner to manage their own bundle', () => {
    expect(policy.canManage(owner, bundle)).toBe(true);
  });

  it('blocks a stranger from managing another user bundle', () => {
    expect(policy.canManage(stranger, bundle)).toBe(false);
  });

  it('grants an admin full management access', () => {
    expect(policy.canManage(admin, bundle)).toBe(true);
    expect(policy.canViewAll(admin)).toBe(true);
  });

  it('denies a regular user system-wide view access', () => {
    expect(policy.canViewAll(owner)).toBe(false);
  });
});
