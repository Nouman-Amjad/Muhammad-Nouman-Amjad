import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Principal } from '../../shared/domain/role';
import type { JwtVerificationService } from '../services/jwt-verification.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtVerification: JwtVerificationService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user: Principal; rawToken: string }>();
    const token = this.extractBearer(req);

    const payload = await this.jwtVerification.verify(token);
    const role = this.jwtVerification.extractRole(payload);

    req.user = { userId: payload.sub, role };
    // Stored so the session guard can read the sid without re-parsing the token.
    (req as unknown as Record<string, unknown>)['keycloakSid'] = payload.sid;
    req.rawToken = token;

    return true;
  }

  private extractBearer(req: Request): string {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authorization header missing or malformed');
    }
    const token = auth.slice(7).trim();
    if (!token) {
      throw new UnauthorizedException('Bearer token is empty');
    }
    return token;
  }
}
