import { Injectable } from '@nestjs/common';
import type { SubscriptionTier } from '@prisma/client';
import type { Result } from '../../shared/domain/result';
import type { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { DeductionSource } from '../domain/entities/chat-message';
import { FreeQuotaWindow } from '../domain/entities/free-quota-window';
import type { QuotaExhaustedError } from '../domain/errors/quota-exhausted.error';
import type {
  QuotaRepository,
  QuotaResolver,
} from '../domain/repositories/quota.repository';
import type { DeductionPlan, QuotaState } from '../domain/services/quota.service';
import { MonthKey } from '../domain/value-objects/month-key';
import { QuotaBundleSnapshot } from '../domain/value-objects/quota-bundle-snapshot';

interface FreeWindowRow {
  userId: string;
  monthKey: string;
  used: number;
}

interface BundleRow {
  bundleId: string;
  tier: SubscriptionTier;
  remaining: number;
  activatedAt: Date;
  active: boolean;
}

@Injectable()
export class PrismaQuotaRepository implements QuotaRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Loads quota state inside a single transaction with all candidate rows locked via
   * SELECT … FOR UPDATE, then calls `resolve` (the pure QuotaService) against that
   * snapshot and writes the resulting plan — all before releasing the locks. Any
   * concurrent request racing on the same user blocks at the SELECT until this
   * transaction commits, then re-runs against the already-decremented state.
   */
  async deductWithinTransaction(
    userId: string,
    now: Date,
    resolve: QuotaResolver,
  ): Promise<Result<DeductionPlan, QuotaExhaustedError>> {
    return this.prisma.$transaction(async (tx) => {
      const currentMonthKey = MonthKey.current(now).toString();

      // Guarantee a row exists before we try to lock it. ON CONFLICT DO NOTHING
      // is safe under concurrency: whichever transaction wins the INSERT proceeds;
      // the losers observe the existing row once the winner commits.
      await tx.$executeRaw`
        INSERT INTO free_quota_windows (user_id, month_key, used)
        VALUES (${userId}, ${currentMonthKey}, 0)
        ON CONFLICT (user_id, month_key) DO NOTHING
      `;

      const freeRows = await tx.$queryRaw<FreeWindowRow[]>`
        SELECT
          user_id   AS "userId",
          month_key AS "monthKey",
          used
        FROM free_quota_windows
        WHERE user_id = ${userId} AND month_key = ${currentMonthKey}
        FOR UPDATE
      `;

      const bundleRows = await tx.$queryRaw<BundleRow[]>`
        SELECT
          id            AS "bundleId",
          tier,
          remaining,
          activated_at  AS "activatedAt",
          active
        FROM subscription_bundles
        WHERE user_id = ${userId} AND active = true
        FOR UPDATE
      `;

      const freeRow: FreeWindowRow | undefined = freeRows[0];
      const freeWindow =
        freeRow !== undefined
          ? FreeQuotaWindow.restore(userId, MonthKey.fromString(freeRow.monthKey), freeRow.used)
          : FreeQuotaWindow.start(userId, MonthKey.current(now));

      const bundles = bundleRows.map((row) =>
        QuotaBundleSnapshot.create({
          bundleId: row.bundleId,
          tier: row.tier,
          remaining: row.remaining,
          activatedAt: row.activatedAt,
          active: row.active,
        }),
      );

      const state: QuotaState = { userId, freeWindow, bundles };
      const result = resolve(state, now);

      if (result.isErr) {
        return result;
      }

      const plan = result.value;

      if (plan.source === DeductionSource.Free) {
        await tx.$executeRaw`
          UPDATE free_quota_windows
          SET used = ${plan.nextUsed}
          WHERE user_id = ${userId} AND month_key = ${plan.month.toString()}
        `;
      } else if (!plan.unlimited) {
        // Explicit remaining > 0 guard in the WHERE clause catches any race that
        // somehow slips through the lock (defense-in-depth; should never trigger).
        await tx.$executeRaw`
          UPDATE subscription_bundles
          SET remaining = remaining - 1
          WHERE id = ${plan.bundleId} AND remaining > 0
        `;
      }
      // Enterprise (unlimited) — no row update needed.

      return result;
    });
  }

  async getState(userId: string, now: Date): Promise<QuotaState> {
    const currentMonthKey = MonthKey.current(now).toString();

    const [freeRows, bundleRows] = await Promise.all([
      this.prisma.$queryRaw<FreeWindowRow[]>`
        SELECT
          user_id   AS "userId",
          month_key AS "monthKey",
          used
        FROM free_quota_windows
        WHERE user_id = ${userId} AND month_key = ${currentMonthKey}
      `,
      this.prisma.$queryRaw<BundleRow[]>`
        SELECT
          id            AS "bundleId",
          tier,
          remaining,
          activated_at  AS "activatedAt",
          active
        FROM subscription_bundles
        WHERE user_id = ${userId} AND active = true
      `,
    ]);

    const freeRow: FreeWindowRow | undefined = freeRows[0];
    const freeWindow =
      freeRow !== undefined
        ? FreeQuotaWindow.restore(userId, MonthKey.fromString(freeRow.monthKey), freeRow.used)
        : FreeQuotaWindow.start(userId, MonthKey.current(now));

    const bundles = bundleRows.map((row) =>
      QuotaBundleSnapshot.create({
        bundleId: row.bundleId,
        tier: row.tier,
        remaining: row.remaining,
        activatedAt: row.activatedAt,
        active: row.active,
      }),
    );

    return { userId, freeWindow, bundles };
  }
}
