import { IsEnum } from 'class-validator';
import { BillingCycle } from '../../../shared/domain/billing-cycle';
import { SubscriptionTier } from '../../../shared/domain/subscription-tier';

export class CreateSubscriptionDto {
  @IsEnum(SubscriptionTier)
  tier!: SubscriptionTier;

  @IsEnum(BillingCycle)
  billingCycle!: BillingCycle;
}
