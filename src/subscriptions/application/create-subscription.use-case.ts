import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { BillingCycle } from '../../shared/domain/billing-cycle';
import type { SubscriptionTier } from '../../shared/domain/subscription-tier';
import { SubscriptionBundle } from '../domain/entities/subscription-bundle';
import { SUBSCRIPTION_BUNDLE_REPOSITORY } from '../domain/repositories/subscription-bundle.repository';
import type { SubscriptionBundleRepository } from '../domain/repositories/subscription-bundle.repository';
import { SubscriptionPrice } from '../domain/value-objects/subscription-price';

export interface CreateSubscriptionCommand {
  readonly userId: string;
  readonly tier: SubscriptionTier;
  readonly billingCycle: BillingCycle;
}

@Injectable()
export class CreateSubscriptionUseCase {
  constructor(
    @Inject(SUBSCRIPTION_BUNDLE_REPOSITORY)
    private readonly bundleRepo: SubscriptionBundleRepository,
  ) {}

  async execute(cmd: CreateSubscriptionCommand): Promise<SubscriptionBundle> {
    const bundle = SubscriptionBundle.create({
      id: randomUUID(),
      userId: cmd.userId,
      tier: cmd.tier,
      billingCycle: cmd.billingCycle,
      price: SubscriptionPrice.for(cmd.tier, cmd.billingCycle),
      startDate: new Date(),
      autoRenew: true,
    });

    await this.bundleRepo.save(bundle);
    return bundle;
  }
}
