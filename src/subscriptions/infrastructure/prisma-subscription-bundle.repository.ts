import { Injectable } from '@nestjs/common';
import type { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { SubscriptionBundle } from '../domain/entities/subscription-bundle';
import type { BillingCycle } from '../../shared/domain/billing-cycle';
import { isUnlimitedTier, UNLIMITED } from '../../shared/domain/subscription-tier';
import type { SubscriptionTier } from '../../shared/domain/subscription-tier';
import { SubscriptionPrice } from '../domain/value-objects/subscription-price';
import type {
  ListBundlesQuery,
  SubscriptionBundlePage,
  SubscriptionBundleRepository,
} from '../domain/repositories/subscription-bundle.repository';

@Injectable()
export class PrismaSubscriptionBundleRepository implements SubscriptionBundleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(bundle: SubscriptionBundle): Promise<void> {
    const data = {
      userId: bundle.userId,
      tier: bundle.tier,
      billingCycle: bundle.billingCycle,
      maxMessages: bundle.maxMessages === UNLIMITED ? 0 : bundle.maxMessages,
      remaining: bundle.remaining,
      price: bundle.price.cents / 100,
      startDate: bundle.startDate,
      endDate: bundle.endDate,
      renewalDate: bundle.renewalDate,
      autoRenew: bundle.autoRenew,
      active: bundle.active,
      cancelledAt: bundle.cancelledAt,
      activatedAt: bundle.activatedAt,
    };

    await this.prisma.subscriptionBundle.upsert({
      where: { id: bundle.id },
      create: { id: bundle.id, ...data },
      update: data,
    });
  }

  async findById(id: string): Promise<SubscriptionBundle | null> {
    const row = await this.prisma.subscriptionBundle.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findDueForRenewal(before: Date): Promise<readonly SubscriptionBundle[]> {
    const rows = await this.prisma.subscriptionBundle.findMany({
      where: {
        active: true,
        autoRenew: true,
        renewalDate: { lte: before },
      },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async list(query: ListBundlesQuery): Promise<SubscriptionBundlePage> {
    const where = {
      userId: query.userId,
      ...(query.activeOnly === true ? { active: true } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.subscriptionBundle.findMany({
        where,
        orderBy: { activatedAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.subscriptionBundle.count({ where }),
    ]);

    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  private toDomain(row: {
    id: string;
    userId: string;
    tier: string;
    billingCycle: string;
    maxMessages: number;
    remaining: number;
    startDate: Date;
    endDate: Date;
    renewalDate: Date;
    autoRenew: boolean;
    active: boolean;
    cancelledAt: Date | null;
    activatedAt: Date;
  }): SubscriptionBundle {
    const tier = row.tier as SubscriptionTier;
    const billingCycle = row.billingCycle as BillingCycle;

    return SubscriptionBundle.restore({
      id: row.id,
      userId: row.userId,
      tier,
      billingCycle,
      maxMessages: isUnlimitedTier(tier) ? UNLIMITED : row.maxMessages,
      remaining: row.remaining,
      price: SubscriptionPrice.for(tier, billingCycle),
      startDate: row.startDate,
      endDate: row.endDate,
      renewalDate: row.renewalDate,
      autoRenew: row.autoRenew,
      active: row.active,
      cancelledAt: row.cancelledAt,
      activatedAt: row.activatedAt,
    });
  }
}
