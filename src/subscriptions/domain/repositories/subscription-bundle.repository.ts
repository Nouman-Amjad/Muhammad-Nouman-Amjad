import type { SubscriptionBundle } from '../entities/subscription-bundle';

export interface SubscriptionBundlePage {
  readonly items: readonly SubscriptionBundle[];
  readonly total: number;
}

export interface ListBundlesQuery {
  readonly userId: string;
  readonly activeOnly?: boolean;
  readonly limit: number;
  readonly offset: number;
}

export interface SubscriptionBundleRepository {
  save(bundle: SubscriptionBundle): Promise<void>;
  findById(id: string): Promise<SubscriptionBundle | null>;
  findDueForRenewal(before: Date): Promise<readonly SubscriptionBundle[]>;
  list(query: ListBundlesQuery): Promise<SubscriptionBundlePage>;
}

export const SUBSCRIPTION_BUNDLE_REPOSITORY = Symbol('SubscriptionBundleRepository');
