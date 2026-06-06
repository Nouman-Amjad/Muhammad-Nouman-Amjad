import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { Principal } from '../../shared/domain/role';
import type { SessionService } from '../services/session.service';

/**
 * Enforces the session-bound token constraint: a valid JWT alone is not
 * sufficient. The Keycloak session ID (sid claim) must map to an active,
 * non-revoked, device-bound session row. A stolen token presented from a
 * different device or after server-side revocation is rejected here.
 */
@Injectable()
export class SessionBoundGuard implements CanActivate {
  constructor(private readonly sessionService: SessionService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { user: Principal } & Record<string, unknown>>();

    const { userId } = req.user;
    const keycloakSid = req['keycloakSid'] as string;
    const userAgent = req.headers['user-agent'] ?? 'unknown';

    const fingerprint = this.sessionService.computeFingerprint(userId, keycloakSid, userAgent);

    await this.sessionService.resolveSession({ userId, keycloakSid, fingerprint });

    return true;
  }
}
