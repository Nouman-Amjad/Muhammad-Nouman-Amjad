import { UnauthorizedException } from '@nestjs/common';
import { createLocalJWKSet, jwtVerify } from 'jose';
import type { JWKSObject, JWTPayload, JWTVerifyGetKey } from 'jose';
import type { KeycloakTokenPayload } from '../../src/auth/services/jwt-verification.service';
import type { Role } from '../../src/shared/domain/role';

export class MockJwtVerificationService {
  private readonly localJwks: JWTVerifyGetKey;

  constructor(
    jwks: JWKSObject,
    private readonly issuer: string,
    private readonly audience: string,
  ) {
    this.localJwks = createLocalJWKSet(jwks);
  }

  async verify(rawToken: string): Promise<KeycloakTokenPayload> {
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(rawToken, this.localJwks, {
        issuer: this.issuer,
        audience: this.audience,
      }));
    } catch {
      throw new UnauthorizedException('Token verification failed');
    }

    if (!payload.sub || !(payload as KeycloakTokenPayload).sid) {
      throw new UnauthorizedException('Token is missing required claims (sub, sid)');
    }

    return payload as KeycloakTokenPayload;
  }

  extractRole(payload: KeycloakTokenPayload): Role {
    const roles = (payload as KeycloakTokenPayload).realm_access?.roles ?? [];
    return roles.includes('admin') ? 'admin' : 'user';
  }
}
