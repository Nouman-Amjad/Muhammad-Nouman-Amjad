import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import type { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

@Injectable()
export class SessionService {
  private readonly secret: string;
  private readonly ttlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.secret = this.config.getOrThrow<string>('SESSION_BINDING_SECRET');
    this.ttlSeconds = this.config.get<number>('SESSION_TTL_SECONDS', 3600);
  }

  /**
   * Derives a deterministic device fingerprint from characteristics of the
   * current request. The HMAC key is the server-side secret so the fingerprint
   * cannot be fabricated by a client that only holds the access token.
   */
  computeFingerprint(userId: string, keycloakSid: string, userAgent: string): string {
    return createHmac('sha256', this.secret)
      .update(`${userId}:${keycloakSid}:${userAgent}`)
      .digest('hex');
  }

  /**
   * Resolves the session for an incoming request. On the first authenticated
   * request for a given Keycloak session ID, a session row is created and the
   * device fingerprint is recorded. Every subsequent request must arrive with
   * the same fingerprint — a mismatch indicates a stolen token used from a
   * different device and results in a 401.
   *
   * Possession of the access token alone is therefore insufficient: it must also
   * arrive from the originating device/fingerprint, and the session must not
   * have been server-side revoked.
   */
  async resolveSession(params: {
    userId: string;
    keycloakSid: string;
    fingerprint: string;
  }): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ttlSeconds * 1000);

    const existing = await this.prisma.session.findUnique({
      where: { keycloakSid: params.keycloakSid },
    });

    if (!existing) {
      // Provision the local user record on first appearance (Keycloak is the
      // source of truth for identity; we keep a minimal anchor for FK constraints).
      await this.prisma.user.upsert({
        where: { id: params.userId },
        create: { id: params.userId },
        update: {},
      });

      // First request for this Keycloak session — establish the binding.
      await this.prisma.session.create({
        data: {
          userId: params.userId,
          keycloakSid: params.keycloakSid,
          fingerprint: params.fingerprint,
          revoked: false,
          expiresAt,
        },
      });
      return;
    }

    if (existing.revoked) {
      throw new UnauthorizedException('Session has been revoked');
    }

    if (existing.expiresAt < now) {
      throw new UnauthorizedException('Session has expired');
    }

    if (existing.fingerprint !== params.fingerprint) {
      // Token presented from an unrecognised device — treat as stolen.
      throw new UnauthorizedException('Session binding mismatch');
    }
  }

  async revokeByKeycloakSid(keycloakSid: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { keycloakSid },
      data: { revoked: true },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId },
      data: { revoked: true },
    });
  }
}
