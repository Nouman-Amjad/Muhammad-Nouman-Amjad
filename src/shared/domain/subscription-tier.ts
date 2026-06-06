export const SubscriptionTier = {
  Basic: 'BASIC',
  Pro: 'PRO',
  Enterprise: 'ENTERPRISE',
} as const;

export type SubscriptionTier = (typeof SubscriptionTier)[keyof typeof SubscriptionTier];

export const UNLIMITED = 'unlimited' as const;
export type Unlimited = typeof UNLIMITED;

/** Response allowance granted by each tier. Enterprise is uncapped. */
export const TIER_MAX_MESSAGES: Readonly<Record<SubscriptionTier, number | Unlimited>> = {
  [SubscriptionTier.Basic]: 10,
  [SubscriptionTier.Pro]: 100,
  [SubscriptionTier.Enterprise]: UNLIMITED,
};

export const isUnlimitedTier = (tier: SubscriptionTier): boolean =>
  TIER_MAX_MESSAGES[tier] === UNLIMITED;
