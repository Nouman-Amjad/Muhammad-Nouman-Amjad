import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTPayload, JWTVerifyGetKey } from 'jose';
import type { Role } from '../../shared/domain/role';

export interface KeycloakTokenPayload extends JWTPayload {
  readonly sub: string;
  readonly sid: string;
  readonly realm_access?: { readonly roles: readonly string[] };
  readonly preferred_username?: string;
}

@Injectable()
export class JwtVerificationService {
  private readonly jwks: JWTVerifyGetKey;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(private readonly config: ConfigService) {
    this.jwks = createRemoteJWKSet(
      new URL(this.config.getOrThrow<string>('OIDC_JWKS_URI')),
    );
    this.issuer = this.config.getOrThrow<string>('OIDC_ISSUER_URL');
    this.audience = this.config.getOrThrow<string>('OIDC_AUDIENCE');
  }

  async verify(rawToken: string): Promise<KeycloakTokenPayload> {
    let payload: JWTPayload;

    try {
      ({ payload } = await jwtVerify(rawToken, this.jwks, {
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
    const roles = payload.realm_access?.roles ?? [];
    return roles.includes('admin') ? 'admin' : 'user';
  }
}
