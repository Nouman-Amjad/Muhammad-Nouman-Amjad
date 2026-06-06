import { Inject, Injectable } from '@nestjs/common';
import type { Result } from '../../shared/domain/result';
import { err } from '../../shared/domain/result';
import type { DomainError } from '../../shared/domain/domain-error';
import { Role } from '../../shared/domain/role';
import type { SubscriptionBundle } from '../domain/entities/subscription-bundle';
import { SUBSCRIPTION_BUNDLE_REPOSITORY } from '../domain/repositories/subscription-bundle.repository';
import type { SubscriptionBundleRepository } from '../domain/repositories/subscription-bundle.repository';
import { SubscriptionNotFoundError } from '../domain/errors/subscription-not-found.error';
import { BillingSimulationService } from '../domain/services/billing-simulation.service';
import { SubscriptionLifecycleService } from '../domain/services/subscription-lifecycle.service';
import { ForbiddenActionError } from '../../shared/errors/forbidden-action.error';

export interface CancelSubscriptionCommand {
  readonly subscriptionId: string;
  readonly userId: string;
  readonly role: Role;
}

@Injectable()
export class CancelSubscriptionUseCase {
  private readonly lifecycle = new SubscriptionLifecycleService(
    new BillingSimulationService(),
  );

  constructor(
    @Inject(SUBSCRIPTION_BUNDLE_REPOSITORY)
    private readonly bundleRepo: SubscriptionBundleRepository,
  ) {}

  async execute(
    cmd: CancelSubscriptionCommand,
  ): Promise<Result<SubscriptionBundle, DomainError>> {
    const bundle = await this.bundleRepo.findById(cmd.subscriptionId);

    if (!bundle) {
      return err(new SubscriptionNotFoundError(cmd.subscriptionId));
    }

    if (cmd.role !== Role.Admin && !bundle.isOwnedBy(cmd.userId)) {
      return err(new ForbiddenActionError('cancel subscription', { targetId: cmd.subscriptionId }));
    }

    const result = this.lifecycle.cancel(bundle, new Date());
    if (result.isErr) {
      return result;
    }

    await this.bundleRepo.save(result.value);
    return result;
  }
}
