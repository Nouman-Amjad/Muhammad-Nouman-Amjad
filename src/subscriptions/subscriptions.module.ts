import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HumanizerModule } from '../humanizer/humanizer.module';
import { PrismaSubscriptionBundleRepository } from './infrastructure/prisma-subscription-bundle.repository';
import { CreateSubscriptionUseCase } from './application/create-subscription.use-case';
import { CancelSubscriptionUseCase } from './application/cancel-subscription.use-case';
import { SubscriptionController } from './controllers/subscription.controller';
import { SUBSCRIPTION_BUNDLE_REPOSITORY } from './domain/repositories/subscription-bundle.repository';

@Module({
  imports: [AuthModule, HumanizerModule],
  controllers: [SubscriptionController],
  providers: [
    {
      provide: SUBSCRIPTION_BUNDLE_REPOSITORY,
      useClass: PrismaSubscriptionBundleRepository,
    },
    CreateSubscriptionUseCase,
    CancelSubscriptionUseCase,
  ],
})
export class SubscriptionsModule {}
