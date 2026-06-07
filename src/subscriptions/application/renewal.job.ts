import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SUBSCRIPTION_BUNDLE_REPOSITORY } from '../domain/repositories/subscription-bundle.repository';
import type { SubscriptionBundleRepository } from '../domain/repositories/subscription-bundle.repository';
import { BillingSimulationService } from '../domain/services/billing-simulation.service';
import { SubscriptionLifecycleService } from '../domain/services/subscription-lifecycle.service';

@Injectable()
export class RenewalJob {
  private readonly logger = new Logger(RenewalJob.name);
  private readonly lifecycle = new SubscriptionLifecycleService(new BillingSimulationService());

  constructor(
    @Inject(SUBSCRIPTION_BUNDLE_REPOSITORY)
    private readonly bundleRepo: SubscriptionBundleRepository,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async runRenewals(): Promise<void> {
    const now = new Date();
    const due = await this.bundleRepo.findDueForRenewal(now);

    this.logger.log(`Renewal job: processing ${due.length} bundle(s)`);

    for (const bundle of due) {
      const result = this.lifecycle.attemptRenewal(bundle, now);
      await this.bundleRepo.save(result.bundle);

      if (result.payment.succeeded) {
        this.logger.log(`Bundle renewed: bundleId=${bundle.id} userId=${bundle.userId}`);
      } else {
        this.logger.warn(
          `Bundle deactivated: bundleId=${bundle.id} userId=${bundle.userId} reason=${result.payment.failureReason}`,
        );
      }
    }
  }
}
