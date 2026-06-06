export const BillingCycle = {
  Monthly: 'MONTHLY',
  Yearly: 'YEARLY',
} as const;

export type BillingCycle = (typeof BillingCycle)[keyof typeof BillingCycle];

export const BILLING_CYCLE_MONTHS: Readonly<Record<BillingCycle, number>> = {
  [BillingCycle.Monthly]: 1,
  [BillingCycle.Yearly]: 12,
};
