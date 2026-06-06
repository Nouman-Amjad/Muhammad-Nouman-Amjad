/**
 * Concurrency integration tests for PrismaQuotaRepository.
 *
 * These tests require a live PostgreSQL instance. Set DATABASE_URL in your
 * environment (or .env) before running:
 *
 *   npm run test:integration
 *
 * The tests are excluded from the regular `npm test` run (unit-only).
 */
import { Test } from '@nestjs/testing';
import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { Err } from '../../shared/domain/result';
import type { Result } from '../../shared/domain/result';
import { SubscriptionTier } from '../../shared/domain/subscription-tier';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { FREE_MONTHLY_ALLOWANCE } from '../domain/entities/free-quota-window';
import { QuotaExhaustedError } from '../domain/errors/quota-exhausted.error';
import { QuotaService } from '../domain/services/quota.service';
import type { DeductionPlan, QuotaState } from '../domain/services/quota.service';
import { PrismaQuotaRepository } from './prisma-quota.repository';

const DB_URL = process.env['DATABASE_URL'];
const describeIf = DB_URL ? describe : describe.skip;

function isErr(r: Result<DeductionPlan, QuotaExhaustedError>): r is Err<QuotaExhaustedError> {
  return r.isErr;
}

describeIf('PrismaQuotaRepository — concurrency', () => {
  let prisma: PrismaService;
  let repository: PrismaQuotaRepository;
  let quotaService: QuotaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PrismaService, PrismaQuotaRepository],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    repository = moduleRef.get(PrismaQuotaRepository);
    quotaService = new QuotaService();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function resolve(state: QuotaState, now: Date): Result<DeductionPlan, QuotaExhaustedError> {
    return quotaService.resolveDeduction(state, now);
  }

  async function createUser(prismaClient: PrismaClient): Promise<string> {
    const userId = randomUUID();
    await prismaClient.user.create({ data: { id: userId } });
    return userId;
  }

  async function teardownUser(userId: string): Promise<void> {
    await prisma.chatMessage.deleteMany({ where: { userId } });
    await prisma.subscriptionBundle.deleteMany({ where: { userId } });
    await prisma.freeQuotaWindow.deleteMany({ where: { userId } });
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }

  function currentMonthKey(now: Date): string {
    const y = now.getUTCFullYear().toString().padStart(4, '0');
    const m = (now.getUTCMonth() + 1).toString().padStart(2, '0');
    return `${y}-${m}`;
  }

  describe('free-quota atomicity', () => {
    it('grants exactly FREE_MONTHLY_ALLOWANCE messages when concurrent requests race on an empty window', async () => {
      const userId = await createUser(prisma);
      const now = new Date();

      try {
        const concurrency = FREE_MONTHLY_ALLOWANCE + 3;
        const results = await Promise.all(
          Array.from({ length: concurrency }, () =>
            repository.deductWithinTransaction(userId, now, resolve),
          ),
        );

        const successes = results.filter((r) => r.isOk);
        const failures = results.filter(isErr);

        expect(successes).toHaveLength(FREE_MONTHLY_ALLOWANCE);
        expect(failures).toHaveLength(concurrency - FREE_MONTHLY_ALLOWANCE);
        failures.forEach((r) => {
          expect(r.error).toBeInstanceOf(QuotaExhaustedError);
        });

        // Confirm the DB counter matches — no phantom increments.
        const [row] = await prisma.$queryRaw<{ used: number }[]>`
          SELECT used FROM free_quota_windows WHERE user_id = ${userId}
        `;
        expect(row?.used).toBe(FREE_MONTHLY_ALLOWANCE);
      } finally {
        await teardownUser(userId);
      }
    });
  });

  describe('bundle-quota atomicity', () => {
    it('deducts exactly once from a bundle with 1 remaining when multiple requests race', async () => {
      const userId = await createUser(prisma);
      const now = new Date();

      // Pre-exhaust the free window so the resolver falls through to the bundle.
      await prisma.freeQuotaWindow.create({
        data: { userId, monthKey: currentMonthKey(now), used: FREE_MONTHLY_ALLOWANCE },
      });

      const bundle = await prisma.subscriptionBundle.create({
        data: {
          userId,
          tier: 'BASIC',
          billingCycle: 'MONTHLY',
          maxMessages: 10,
          remaining: 1,
          price: 9.99,
          startDate: now,
          endDate: new Date(now.getTime() + 30 * 86400 * 1000),
          renewalDate: new Date(now.getTime() + 30 * 86400 * 1000),
          autoRenew: true,
          active: true,
        },
      });

      try {
        const concurrency = 5;
        const results = await Promise.all(
          Array.from({ length: concurrency }, () =>
            repository.deductWithinTransaction(userId, now, resolve),
          ),
        );

        const successes = results.filter((r) => r.isOk);
        const failures = results.filter(isErr);

        expect(successes).toHaveLength(1);
        expect(failures).toHaveLength(4);
        failures.forEach((r) => {
          expect(r.error).toBeInstanceOf(QuotaExhaustedError);
        });

        // remaining must land on exactly 0, never negative.
        const updated = await prisma.subscriptionBundle.findUnique({ where: { id: bundle.id } });
        expect(updated?.remaining).toBe(0);
      } finally {
        await teardownUser(userId);
      }
    });

    it('never decrements an Enterprise (unlimited) bundle', async () => {
      const userId = await createUser(prisma);
      const now = new Date();

      await prisma.freeQuotaWindow.create({
        data: { userId, monthKey: currentMonthKey(now), used: FREE_MONTHLY_ALLOWANCE },
      });

      const bundle = await prisma.subscriptionBundle.create({
        data: {
          userId,
          tier: SubscriptionTier.Enterprise,
          billingCycle: 'MONTHLY',
          maxMessages: 0,
          remaining: 0,
          price: 299.99,
          startDate: now,
          endDate: new Date(now.getTime() + 30 * 86400 * 1000),
          renewalDate: new Date(now.getTime() + 30 * 86400 * 1000),
          autoRenew: true,
          active: true,
        },
      });

      try {
        const results = await Promise.all(
          Array.from({ length: 10 }, () =>
            repository.deductWithinTransaction(userId, now, resolve),
          ),
        );

        expect(results.every((r) => r.isOk)).toBe(true);

        // remaining stays at 0; the Enterprise branch never writes to it.
        const updated = await prisma.subscriptionBundle.findUnique({ where: { id: bundle.id } });
        expect(updated?.remaining).toBe(0);
      } finally {
        await teardownUser(userId);
      }
    });
  });
});
