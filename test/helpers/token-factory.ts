import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import type { JWKSObject, KeyLike } from 'jose';

export class TokenFactory {
  private privateKey!: KeyLike;
  private jwks!: JWKSObject;
  readonly issuer = 'http://localhost:8080/realms/ggi';
  readonly audience = 'ggi-backend';

  async init(): Promise<void> {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    this.privateKey = privateKey;
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'test-key';
    jwk.use = 'sig';
    jwk.alg = 'RS256';
    this.jwks = { keys: [jwk] };
  }

  getJwks(): JWKSObject {
    return this.jwks;
  }

  async sign(params: {
    sub: string;
    sid: string;
    roles?: string[];
    expiresIn?: string;
  }): Promise<string> {
    return new SignJWT({
      sid: params.sid,
      realm_access: { roles: params.roles ?? ['user'] },
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setSubject(params.sub)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt()
      .setExpirationTime(params.expiresIn ?? '1h')
      .sign(this.privateKey);
  }
}
