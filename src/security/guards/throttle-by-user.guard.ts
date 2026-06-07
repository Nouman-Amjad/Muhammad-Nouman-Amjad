import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import type { Principal } from '../../shared/domain/role';

/**
 * Extends the default throttler guard to key rate-limit buckets on the
 * authenticated user ID when available, falling back to the originating IP
 * for unauthenticated requests (e.g. health/auth endpoints).
 *
 * shouldSkip is delegated to the base class so that @SkipThrottle decorators
 * on individual controllers can opt specific named buckets out (e.g. a chat
 * controller skips the auth and subscription buckets).
 */
@Injectable()
export class ThrottleByUserGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    const user = (req as unknown as Request & { user?: Principal }).user;
    if (user?.userId) {
      return Promise.resolve(`user:${user.userId}`);
    }
    const forwarded = (req as unknown as Request).headers['x-forwarded-for'];
    const ip =
      typeof forwarded === 'string'
        ? forwarded.split(',')[0]?.trim()
        : (req as unknown as Request).ip;
    return Promise.resolve(`ip:${ip ?? 'unknown'}`);
  }
}
