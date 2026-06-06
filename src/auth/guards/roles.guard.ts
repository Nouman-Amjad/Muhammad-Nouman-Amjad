import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Role } from '../../shared/domain/role';
import type { Principal } from '../../shared/domain/role';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Controller-level RBAC guard. Works in tandem with the domain-level policy
 * checks inside use-cases, providing defence-in-depth: an unauthorised role
 * never even reaches the application layer.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const req = ctx.switchToHttp().getRequest<Request & { user: Principal }>();
    const { role } = req.user;

    if (!requiredRoles.includes(role)) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}
